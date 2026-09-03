import { describe, it, expect, vi, beforeEach } from "vitest";
import { refundEligibility } from "@/lib/orders";
import { performOrderRefund } from "@/lib/order-refund";

// ---------------------------------------------------------------------------
// 1. Matrice d'éligibilité (logique pure) — pas de mock nécessaire.
// ---------------------------------------------------------------------------
describe("refundEligibility", () => {
  it("éligible : payée en ligne, session présente, non remboursée", () => {
    expect(
      refundEligibility({ paid: true, stripe_session_id: "cs_123", refunded: false })
    ).toEqual({ ok: true });
  });

  it("non payée en ligne : paid falsy → not_online_paid", () => {
    expect(
      refundEligibility({ paid: false, stripe_session_id: "cs_123" })
    ).toEqual({ ok: false, code: "not_online_paid" });
  });

  it("non payée en ligne : stripe_session_id vide → not_online_paid", () => {
    expect(
      refundEligibility({ paid: true, stripe_session_id: "" })
    ).toEqual({ ok: false, code: "not_online_paid" });
    expect(
      refundEligibility({ paid: true, stripe_session_id: null })
    ).toEqual({ ok: false, code: "not_online_paid" });
  });

  it("déjà remboursée → already_refunded (prioritaire)", () => {
    expect(
      refundEligibility({ paid: true, stripe_session_id: "cs_123", refunded: true })
    ).toEqual({ ok: false, code: "already_refunded" });
  });
});

// ---------------------------------------------------------------------------
// 1bis. Cœur d'effets partagé `performOrderRefund` (helper, ne jette jamais).
//       On lui injecte un `db` et un `stripe` factices — pas de mock de module.
// ---------------------------------------------------------------------------
function fakeStripe(retrieve: any, create: any) {
  return {
    checkout: { sessions: { retrieve } },
    refunds: { create },
  } as any;
}

function fakeDb(updateError: any = null) {
  const captured: { payload: any; filters: any } = { payload: null, filters: {} };
  const builder: any = {
    update: (p: any) => {
      captured.payload = p;
      return builder;
    },
    eq: (col: string, val: any) => {
      captured.filters[col] = val;
      return builder;
    },
    // awaiter de la chaîne update().eq().eq().eq()
    then: (resolve: any) => resolve({ error: updateError }),
  };
  const db: any = { from: () => builder, __captured: captured };
  return db;
}

const ELIGIBLE = {
  id: "ord-9",
  business_id: "biz-9",
  paid: true,
  stripe_session_id: "cs_9",
  refunded: false,
};

describe("performOrderRefund", () => {
  it("éligible : refund plateforme idempotent + drapeau écrit → { refunded }", async () => {
    const retrieve = vi.fn().mockResolvedValue({ payment_intent: "pi_9" });
    const create = vi.fn().mockResolvedValue({ id: "re_9" });
    const db = fakeDb();

    const out = await performOrderRefund(db, fakeStripe(retrieve, create), ELIGIBLE);

    expect(out).toEqual({ status: "refunded", stripeRefundId: "re_9" });
    // refund plateforme : jamais { stripeAccount }, reverse_transfer +
    // refund_application_fee, clé d'idempotence dérivée de order.id.
    const [params, opts] = create.mock.calls[0];
    expect(params).toEqual({
      payment_intent: "pi_9",
      reverse_transfer: true,
      refund_application_fee: true,
      // Lien fiable événement→commande pour la réconciliation par webhook (F2).
      metadata: { order_id: "ord-9" },
    });
    expect(opts).toEqual({ idempotencyKey: "order-refund-ord-9" });
    // écriture : drapeau distinct (status non touché), filtres isolation +
    // idempotence.
    expect(db.__captured.payload).toMatchObject({
      refunded: true,
      stripe_refund_id: "re_9",
    });
    expect(db.__captured.payload.status).toBeUndefined();
    expect(db.__captured.filters).toEqual({
      id: "ord-9",
      business_id: "biz-9",
      refunded: false,
    });
  });

  it("non éligible (payée sur place) → { skipped, not_online_paid }, aucun Stripe", async () => {
    const retrieve = vi.fn();
    const create = vi.fn();
    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      { ...ELIGIBLE, paid: false, stripe_session_id: null }
    );
    expect(out).toEqual({ status: "skipped", code: "not_online_paid" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("non éligible (déjà remboursée) → { skipped, already_refunded }, aucun Stripe", async () => {
    const retrieve = vi.fn();
    const create = vi.fn();
    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      { ...ELIGIBLE, refunded: true }
    );
    expect(out).toEqual({ status: "skipped", code: "already_refunded" });
    expect(retrieve).not.toHaveBeenCalled();
    expect(create).not.toHaveBeenCalled();
  });

  it("pas de payment_intent sur la session → { no_payment_intent }, pas de refund", async () => {
    const retrieve = vi.fn().mockResolvedValue({ payment_intent: null });
    const create = vi.fn();
    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      ELIGIBLE
    );
    expect(out).toEqual({ status: "no_payment_intent" });
    expect(create).not.toHaveBeenCalled();
  });

  it("retrieve lève → { failed }, aucun refund", async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error("No such session"));
    const create = vi.fn();
    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      ELIGIBLE
    );
    expect(out.status).toBe("failed");
    expect(create).not.toHaveBeenCalled();
  });

  it("refunds.create lève → { failed }", async () => {
    const retrieve = vi.fn().mockResolvedValue({ payment_intent: "pi_9" });
    const create = vi.fn().mockRejectedValue(new Error("card_declined"));
    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      ELIGIBLE
    );
    expect(out.status).toBe("failed");
  });

  it("refund OK mais écriture KO → { record_failed } + stripeRefundId conservé", async () => {
    const retrieve = vi.fn().mockResolvedValue({ payment_intent: "pi_9" });
    const create = vi.fn().mockResolvedValue({ id: "re_9" });
    const out = await performOrderRefund(
      fakeDb({ message: "write failed" }),
      fakeStripe(retrieve, create),
      ELIGIBLE
    );
    expect(out).toEqual({ status: "record_failed", stripeRefundId: "re_9" });
    expect(create).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// 2. Route POST /api/dashboard/orders/refund — cœur Stripe / état.
//    Mocks : Stripe (retrieve + refunds.create), Supabase admin, @/lib/api
//    (injecte le business, contourne l'auth).
// ---------------------------------------------------------------------------
const h = vi.hoisted(() => ({
  retrieve: vi.fn(),
  create: vi.fn(),
  // état du client Supabase piloté par chaque test
  db: {
    order: null as any,
    selectError: null as any,
    updateError: null as any,
    updatePayload: null as any,
    // filtres .eq() appliqués à la chaîne UPDATE (garde d'isolation/idempotence)
    updateFilters: null as any,
  },
}));

vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({
    checkout: { sessions: { retrieve: h.retrieve } },
    refunds: { create: h.create },
  }),
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
        business: { id: "biz-1", slug: "cafe" },
        user: {},
      });
    },
}));

vi.mock("@/lib/supabase/admin", () => {
  // Chaque `from("orders")` renvoie un builder neuf : la chaîne SELECT et la
  // chaîne UPDATE ont chacune leur propre drapeau `updating`, donc on ne capture
  // que les filtres .eq() de l'UPDATE (isolation business_id + garde refunded).
  function ordersTable() {
    let updating = false;
    const builder: any = {
      select: () => builder,
      update: (payload: any) => {
        h.db.updatePayload = payload;
        h.db.updateFilters = {};
        updating = true;
        return builder;
      },
      eq: (col: string, val: any) => {
        if (updating) h.db.updateFilters[col] = val;
        return builder;
      },
      maybeSingle: async () => ({ data: h.db.order, error: h.db.selectError }),
      // awaiter de la chaîne update().eq().eq().eq()
      then: (resolve: any) => resolve({ error: h.db.updateError }),
    };
    return builder;
  }
  return { getAdminClient: () => ({ from: () => ordersTable() }) };
});

import { POST } from "@/app/api/dashboard/orders/refund/route";

function req(body: unknown) {
  return new Request("http://localhost/api/dashboard/orders/refund", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  }) as any;
}

beforeEach(() => {
  h.retrieve.mockReset();
  h.create.mockReset();
  h.db.order = null;
  h.db.selectError = null;
  h.db.updateError = null;
  h.db.updatePayload = null;
  h.db.updateFilters = null;
});

describe("POST /api/dashboard/orders/refund", () => {
  it("succès : refund plateforme (reverse_transfer) + commande marquée remboursée", async () => {
    h.db.order = {
      id: "ord-1",
      status: "done",
      paid: true,
      stripe_session_id: "cs_123",
      refunded: false,
      code: "ABCDE",
      total_cents: 1500,
    };
    h.retrieve.mockResolvedValue({ payment_intent: "pi_123" });
    h.create.mockResolvedValue({ id: "re_123" });

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.stripe_refund_id).toBe("re_123");

    // refund plateforme : jamais { stripeAccount }, avec reverse_transfer +
    // refund_application_fee, clé d'idempotence dérivée de order.id.
    expect(h.create).toHaveBeenCalledTimes(1);
    const [params, opts] = h.create.mock.calls[0];
    expect(params).toEqual({
      payment_intent: "pi_123",
      reverse_transfer: true,
      refund_application_fee: true,
      // Lien fiable événement→commande pour la réconciliation par webhook (F2).
      metadata: { order_id: "ord-1" },
    });
    expect(opts).toEqual({ idempotencyKey: "order-refund-ord-1" });

    // écriture APRÈS succès : drapeau distinct, status non touché
    expect(h.db.updatePayload).toMatchObject({
      refunded: true,
      stripe_refund_id: "re_123",
    });
    expect(h.db.updatePayload.status).toBeUndefined();
    expect(h.db.updatePayload.refunded_at).toBeTruthy();

    // garde d'isolation (business_id) + garde d'idempotence à l'écriture
    // (refunded=false) : l'UPDATE est filtré sur les trois clés.
    expect(h.db.updateFilters).toEqual({
      id: "ord-1",
      business_id: "biz-1",
      refunded: false,
    });
  });

  it("échec lecture (colonne refunded absente / migration 0047) → 503, aucun Stripe", async () => {
    h.db.order = null;
    h.db.selectError = { message: 'column "refunded" does not exist' };

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("refund_unavailable");
    // fail-closed : on n'émet JAMAIS un refund qu'on ne saurait pas tracer.
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.db.updatePayload).toBeNull();
  });

  it("retrieve de la session lève → 502 refund_failed, aucun refund ni écriture", async () => {
    h.db.order = {
      id: "ord-1",
      status: "new",
      paid: true,
      stripe_session_id: "cs_123",
      refunded: false,
      code: "ABCDE",
      total_cents: 1500,
    };
    h.retrieve.mockRejectedValue(new Error("No such session"));

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("refund_failed");
    expect(h.create).not.toHaveBeenCalled();
    expect(h.db.updatePayload).toBeNull();
  });

  it("refund OK mais écriture DB échoue → 502 refund_recorded_partially + stripe_refund_id conservé", async () => {
    h.db.order = {
      id: "ord-1",
      status: "done",
      paid: true,
      stripe_session_id: "cs_123",
      refunded: false,
      code: "ABCDE",
      total_cents: 1500,
    };
    h.retrieve.mockResolvedValue({ payment_intent: "pi_123" });
    h.create.mockResolvedValue({ id: "re_123" });
    h.db.updateError = { message: "write failed" };

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("refund_recorded_partially");
    // le refund a réussi côté Stripe : on ne perd pas son id (réconciliation).
    expect(json.stripe_refund_id).toBe("re_123");
    expect(h.create).toHaveBeenCalledTimes(1);
  });

  it("échec Stripe : refunds.create lève → 502 et AUCUNE écriture", async () => {
    h.db.order = {
      id: "ord-1",
      status: "new",
      paid: true,
      stripe_session_id: "cs_123",
      refunded: false,
      code: "ABCDE",
      total_cents: 1500,
    };
    h.retrieve.mockResolvedValue({ payment_intent: "pi_123" });
    h.create.mockRejectedValue(new Error("card_declined"));

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(502);
    const json = await res.json();
    expect(json.error).toBe("refund_failed");
    // état intact : aucune update n'a été construite
    expect(h.db.updatePayload).toBeNull();
  });

  it("déjà remboursée : aucun appel Stripe, 400 already_refunded", async () => {
    h.db.order = {
      id: "ord-1",
      status: "done",
      paid: true,
      stripe_session_id: "cs_123",
      refunded: true,
      code: "ABCDE",
      total_cents: 1500,
    };

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("already_refunded");
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
    expect(h.db.updatePayload).toBeNull();
  });

  it("commande absente / autre tenant : 404 not_found, aucun Stripe", async () => {
    h.db.order = null;

    const res = await POST(req({ id: "unknown" }));
    expect(res.status).toBe(404);
    expect((await res.json()).error).toBe("not_found");
    expect(h.retrieve).not.toHaveBeenCalled();
    expect(h.create).not.toHaveBeenCalled();
  });

  it("pas de payment_intent sur la session : 400 no_payment_intent, pas de refund", async () => {
    h.db.order = {
      id: "ord-1",
      status: "new",
      paid: true,
      stripe_session_id: "cs_123",
      refunded: false,
      code: "ABCDE",
      total_cents: 1500,
    };
    h.retrieve.mockResolvedValue({ payment_intent: null });

    const res = await POST(req({ id: "ord-1" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_payment_intent");
    expect(h.create).not.toHaveBeenCalled();
    expect(h.db.updatePayload).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Charge DIRECTE (0075) : le paiement vit sur le compte du commerçant.
// ---------------------------------------------------------------------------
describe("performOrderRefund — charge directe", () => {
  const DIRECT = { ...ELIGIBLE, stripe_account_id: "acct_42" };

  it("session ET refund sont émis SUR le compte du commerçant", async () => {
    const retrieve = vi.fn().mockResolvedValue({ payment_intent: "pi_9" });
    const create = vi.fn().mockResolvedValue({ id: "re_9" });

    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      DIRECT
    );

    expect(out).toEqual({ status: "refunded", stripeRefundId: "re_9" });
    // La session vit sur le compte connecté : sans cette option, Stripe
    // répondrait « No such checkout.session ».
    expect(retrieve.mock.calls[0][2]).toEqual({ stripeAccount: "acct_42" });
    const [params, opts] = create.mock.calls[0];
    // Aucun transfert n'a eu lieu → reverse_transfer doit être ABSENT.
    expect(params.reverse_transfer).toBeUndefined();
    expect(params.refund_application_fee).toBe(true);
    expect(params.payment_intent).toBe("pi_9");
    expect(opts).toEqual({
      idempotencyKey: "order-refund-ord-9",
      stripeAccount: "acct_42",
    });
  });

  it("retombe sur la plateforme si la session est introuvable sur le compte", async () => {
    // Ancienne commande « destination » dont la colonne 0075 serait renseignée
    // à tort : la session ne répond que côté plateforme.
    const retrieve = vi
      .fn()
      .mockRejectedValueOnce(new Error("No such checkout.session"))
      .mockResolvedValueOnce({ payment_intent: "pi_9" });
    const create = vi.fn().mockResolvedValue({ id: "re_9" });

    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      DIRECT
    );

    expect(out).toEqual({ status: "refunded", stripeRefundId: "re_9" });
    expect(retrieve).toHaveBeenCalledTimes(2);
    const [params, opts] = create.mock.calls[0];
    // Schéma « destination » retrouvé : reverse_transfer requis, pas de compte.
    expect(params.reverse_transfer).toBe(true);
    expect(opts).toEqual({ idempotencyKey: "order-refund-ord-9" });
  });

  it("échoue proprement si aucun compte ne connaît la session", async () => {
    const retrieve = vi.fn().mockRejectedValue(new Error("introuvable"));
    const create = vi.fn();

    const out = await performOrderRefund(
      fakeDb(),
      fakeStripe(retrieve, create),
      DIRECT
    );

    expect(out.status).toBe("failed");
    expect(create).not.toHaveBeenCalled();
  });
});
