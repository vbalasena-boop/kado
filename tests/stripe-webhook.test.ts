import { describe, it, expect, vi, beforeEach } from "vitest";

// Vérifie le garde de sécurité du webhook Stripe : la signature DOIT être
// validée avant tout traitement.
const constructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));

// Client admin factice : chaque `from()` renvoie un builder capturant la table,
// le payload d'update et les filtres .eq() de la chaîne update().eq()... , avec
// une erreur d'update pilotable (colonnes 0047 absentes).
const cap = vi.hoisted(() => ({
  table: null as string | null,
  payload: null as any,
  filters: {} as any,
  error: null as any,
}));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    from: (t: string) => {
      cap.table = t;
      const builder: any = {
        select: () => builder,
        update: (p: any) => {
          cap.payload = p;
          return builder;
        },
        eq: (col: string, val: any) => {
          cap.filters[col] = val;
          return builder;
        },
        maybeSingle: async () => ({ data: null, error: null }),
        then: (resolve: any) => resolve({ error: cap.error }),
      };
      return builder;
    },
  }),
}));
vi.mock("@/lib/email", () => ({
  sendEmail: async () => ({ ok: true }),
  emailLayout: () => "",
  getOwnerContact: async () => ({ email: null, businessName: null }),
}));
const reportSpy = vi.hoisted(() => vi.fn());
vi.mock("@/lib/report", () => ({ reportError: reportSpy }));

import { POST } from "@/app/api/billing/webhook/route";

function req(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    body,
    headers,
  }) as any;
}

beforeEach(() => {
  constructEvent.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
  cap.table = null;
  cap.payload = null;
  cap.filters = {};
  cap.error = null;
});

describe("POST /api/billing/webhook — garde de signature", () => {
  it("500 si le secret webhook n'est pas configuré", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(req("{}", { "stripe-signature": "x" }));
    expect(res.status).toBe(500);
  });

  it("400 sans en-tête stripe-signature", async () => {
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_signature");
  });

  it("400 si la signature est invalide (constructEvent lève)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req("{}", { "stripe-signature": "bad" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_signature");
  });

  it("accepte un événement correctement signé", async () => {
    constructEvent.mockReturnValue({ type: "ping", data: { object: {} } });
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// F2 — Réconciliation du statut réel des remboursements (refund.updated +
// charge.refund.updated) via `reconcileRefundEvent`.
// ---------------------------------------------------------------------------
describe("POST /api/billing/webhook — réconciliation refund (F2)", () => {
  function refundEvent(type: string, refund: any) {
    return { type, data: { object: refund } };
  }

  it("refund.updated succeeded (metadata.order_id) → orders.refunded=true + stripe_refund_id", async () => {
    constructEvent.mockReturnValue(
      refundEvent("refund.updated", {
        id: "re_9",
        status: "succeeded",
        metadata: { order_id: "ord-9" },
      })
    );
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect(cap.table).toBe("orders");
    expect(cap.payload).toMatchObject({ refunded: true, stripe_refund_id: "re_9" });
    expect(cap.payload.refunded_at).toBeTruthy();
    expect(cap.filters).toEqual({ id: "ord-9", refunded: false });
  });

  it("refund.updated failed → orders.refunded=false, révocation gardée par stripe_refund_id (anti-clobber)", async () => {
    constructEvent.mockReturnValue(
      refundEvent("refund.updated", {
        id: "re_9",
        status: "failed",
        metadata: { order_id: "ord-9" },
      })
    );
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    // stripe_refund_id CONSERVÉ (audit) ; ciblé par CE refund + garde refunded=true
    expect(cap.payload).toEqual({ refunded: false, refunded_at: null });
    expect(cap.filters).toEqual({ stripe_refund_id: "re_9", refunded: true });
  });

  it("refund.failed (type dédié) → route vers la réconciliation (révocation)", async () => {
    constructEvent.mockReturnValue(
      refundEvent("refund.failed", {
        id: "re_9",
        status: "failed",
        metadata: { order_id: "ord-9" },
      })
    );
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect(cap.payload).toEqual({ refunded: false, refunded_at: null });
    expect(cap.filters).toEqual({ stripe_refund_id: "re_9", refunded: true });
  });

  it("refund.updated pending → no-op (aucune écriture)", async () => {
    constructEvent.mockReturnValue(
      refundEvent("refund.updated", {
        id: "re_9",
        status: "pending",
        metadata: { order_id: "ord-9" },
      })
    );
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect(cap.payload).toBeNull();
    expect(cap.table).toBeNull();
  });

  it("charge.refund.updated succeeded sans metadata → repli sur stripe_refund_id", async () => {
    constructEvent.mockReturnValue(
      refundEvent("charge.refund.updated", {
        id: "re_old",
        status: "succeeded",
        metadata: {},
      })
    );
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect(cap.filters).toEqual({ stripe_refund_id: "re_old", refunded: false });
  });

  it("colonnes 0047 absentes (update échoue) → 200 quand même (tolérant)", async () => {
    cap.error = { message: 'column "stripe_refund_id" does not exist' };
    constructEvent.mockReturnValue(
      refundEvent("refund.updated", {
        id: "re_9",
        status: "succeeded",
        metadata: { order_id: "ord-9" },
      })
    );
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Story 3 — observabilité : un échec d'écriture DB (paid=true) ne doit plus
// être avalé en silence (→ reportError), mais le webhook reste 200 (Stripe
// rejouerait sinon).
// ---------------------------------------------------------------------------
describe("POST /api/billing/webhook — écriture paid=true (observabilité Story 3)", () => {
  beforeEach(() => {
    reportSpy.mockClear();
  });

  function orderPaidEvent() {
    return {
      type: "checkout.session.completed",
      data: {
        object: {
          metadata: { kind: "order", order_code: "ABCDE", business_id: "biz1" },
          payment_status: "paid",
        },
      },
    };
  }

  it("vraie erreur DB sur paid=true → reportError appelé, webhook toujours 200", async () => {
    cap.error = { code: "42501", message: "permission denied" }; // RLS, pas colonne absente
    constructEvent.mockReturnValue(orderPaidEvent());
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect(reportSpy).toHaveBeenCalled();
  });

  it("colonne absente (42703) → tolérée, aucun reportError, 200", async () => {
    cap.error = { code: "42703", message: 'column "paid" does not exist' };
    constructEvent.mockReturnValue(orderPaidEvent());
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect(reportSpy).not.toHaveBeenCalled();
  });
});
