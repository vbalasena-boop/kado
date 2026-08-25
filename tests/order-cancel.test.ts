import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Route POST /api/dashboard/orders — branche « annulation » (story 11.2).
// On laisse tourner le VRAI `performOrderRefund` (et `refundEligibility`) contre
// un Stripe + un Supabase factices, pour exercer le câblage best-effort :
//   • payée en ligne → refund déclenché + client notifié
//   • payée sur place → aucun refund, client tout de même notifié
//   • échec refund → l'annulation reste actée (non bloquante)
// Mocks de bord : Stripe, e-mail, push, Supabase admin, @/lib/api (auth).
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
  sendEmail: vi.fn(),
  push: vi.fn(),
  stripeThrows: false,
  db: {
    order: null as any,
    selectError: null as any,
    statusUpdateError: null as any,
    refundUpdateError: null as any,
    // toutes les chaînes UPDATE awaitées, dans l'ordre
    updates: [] as Array<{ payload: any; filters: any }>,
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => {
    // Simule une config Stripe absente : getStripe() lève (le refund ne doit
    // JAMAIS bloquer l'annulation déjà actée).
    if (h.stripeThrows) throw new Error("STRIPE_SECRET_KEY manquant");
    return {
      checkout: { sessions: { retrieve: h.retrieve } },
      refunds: { create: h.create },
    };
  },
}));

vi.mock("@/lib/email", () => ({
  sendEmail: h.sendEmail,
  emailLayout: () => "<html></html>",
}));

vi.mock("@/lib/push", () => ({
  pushToSubscriptionDetailed: h.push,
}));

vi.mock("@/lib/api", () => ({
  merchantRoute:
    (opts: any) =>
    async (req: any) => {
      const body = await req.json();
      return opts.handler({
        req,
        params: {},
        body,
        business: { id: "biz-1", slug: "cafe", name: "Café Test" },
        user: {},
      });
    },
}));

vi.mock("@/lib/supabase/admin", () => {
  function ordersTable() {
    let payload: any = null;
    const filters: any = {};
    const builder: any = {
      select: () => builder,
      update: (p: any) => {
        payload = p;
        return builder;
      },
      eq: (col: string, val: any) => {
        filters[col] = val;
        return builder;
      },
      order: () => builder,
      limit: () => builder,
      maybeSingle: async () => ({ data: h.db.order, error: h.db.selectError }),
      // awaiter des chaînes update().eq()...
      then: (resolve: any) => {
        h.db.updates.push({ payload, filters });
        const err =
          payload && "status" in payload
            ? h.db.statusUpdateError
            : payload && "refunded" in payload
            ? h.db.refundUpdateError
            : null;
        resolve({ error: err });
      },
    };
    return builder;
  }
  return { getAdminClient: () => ({ from: () => ordersTable() }) };
});

import { POST } from "@/app/api/dashboard/orders/route";

function req(body: unknown) {
  return new Request("http://localhost/api/dashboard/orders", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as any;
}

const ONLINE_ORDER = {
  id: "ord-1",
  status: "new",
  code: "ABCDE",
  customer_name: "Alice",
  total_cents: 1500,
  customer_email: "alice@example.com",
  notify_push: { endpoint: "https://push", p256dh: "k", auth: "a" },
  paid: true,
  stripe_session_id: "cs_1",
  refunded: false,
  business_id: "biz-1",
};

beforeEach(() => {
  h.retrieve.mockReset();
  h.create.mockReset();
  h.sendEmail.mockReset().mockResolvedValue(undefined);
  h.push.mockReset().mockResolvedValue({ ok: true, reason: "sent" });
  h.db.order = null;
  h.db.selectError = null;
  h.db.statusUpdateError = null;
  h.db.refundUpdateError = null;
  h.db.updates = [];
  h.stripeThrows = false;
});

describe("POST /api/dashboard/orders — annulation", () => {
  it("payée en ligne : statut cancelled + refund déclenché + client notifié", async () => {
    h.db.order = { ...ONLINE_ORDER };
    h.retrieve.mockResolvedValue({ payment_intent: "pi_1" });
    h.create.mockResolvedValue({ id: "re_1" });

    const res = await POST(req({ id: "ord-1", status: "cancelled" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // transition de statut actée
    const statusUpd = h.db.updates.find((u) => u.payload && "status" in u.payload);
    expect(statusUpd?.payload.status).toBe("cancelled");

    // refund déclenché (mécanique 11.1) : reverse_transfer + clé d'idempotence
    expect(h.create).toHaveBeenCalledTimes(1);
    const [params, opts] = h.create.mock.calls[0];
    expect(params).toMatchObject({ reverse_transfer: true, refund_application_fee: true });
    expect(opts).toEqual({ idempotencyKey: "order-refund-ord-1" });
    expect(json.refund).toEqual({ status: "refunded", stripeRefundId: "re_1" });

    // drapeau remboursé écrit (garde d'idempotence à l'écriture)
    const refundUpd = h.db.updates.find((u) => u.payload && "refunded" in u.payload);
    expect(refundUpd?.payload.refunded).toBe(true);
    expect(refundUpd?.filters).toMatchObject({ business_id: "biz-1", refunded: false });

    // client prévenu — ET avec le contenu D'ANNULATION (pas « prête »)
    expect(h.push).toHaveBeenCalledTimes(1);
    expect(h.push.mock.calls[0][1].title).toContain("annulée");
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(h.sendEmail.mock.calls[0][0].subject).toContain("annulée");
    expect(json.notified).toMatchObject({ email: "sent", push: "sent" });
  });

  it("refund déclenché mais getStripe() lève (config absente) : annulation NON bloquée", async () => {
    h.db.order = { ...ONLINE_ORDER };
    h.stripeThrows = true; // Stripe non configuré → getStripe() jette

    const res = await POST(req({ id: "ord-1", status: "cancelled" }));
    // l'annulation reste actée malgré l'exception Stripe
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    const statusUpd = h.db.updates.find((u) => u.payload && "status" in u.payload);
    expect(statusUpd?.payload.status).toBe("cancelled");
    // l'échec est remonté, le client est tout de même notifié
    expect(json.refund.status).toBe("failed");
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
  });

  it("payée sur place : statut cancelled, AUCUN refund, client notifié", async () => {
    h.db.order = {
      ...ONLINE_ORDER,
      paid: false,
      stripe_session_id: null,
    };

    const res = await POST(req({ id: "ord-1", status: "cancelled" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);

    // aucun appel Stripe
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(json.refund).toEqual({ status: "skipped", code: "not_online_paid" });
    // aucune écriture du drapeau remboursé
    expect(h.db.updates.some((u) => u.payload && "refunded" in u.payload)).toBe(false);

    // client tout de même notifié de l'annulation
    expect(h.sendEmail).toHaveBeenCalledTimes(1);
    expect(json.notified.email).toBe("sent");
  });

  it("échec du refund : la commande reste cancelled (non bloquant), échec remonté", async () => {
    h.db.order = { ...ONLINE_ORDER };
    h.retrieve.mockResolvedValue({ payment_intent: "pi_1" });
    h.create.mockRejectedValue(new Error("card_declined"));

    const res = await POST(req({ id: "ord-1", status: "cancelled" }));
    // l'annulation n'est PAS bloquée par l'échec Stripe
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    const statusUpd = h.db.updates.find((u) => u.payload && "status" in u.payload);
    expect(statusUpd?.payload.status).toBe("cancelled");
    // l'échec est remonté au commerçant
    expect(json.refund.status).toBe("failed");
  });

  it("colonnes paiement absentes (refunded illisible) : annulation OK, aucun refund tenté", async () => {
    // 1er select (colonnes étendues) échoue → repli minimal → refundReadable=false
    h.db.selectError = { message: 'column "refunded" does not exist' };
    h.db.order = {
      id: "ord-1",
      status: "new",
      code: "ABCDE",
      customer_name: "Alice",
      total_cents: 1500,
    };

    const res = await POST(req({ id: "ord-1", status: "cancelled" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    // pas de refund non traçable
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(json.refund).toBeNull();
  });
});
