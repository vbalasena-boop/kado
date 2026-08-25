import { describe, it, expect, vi } from "vitest";
import { reconcileRefundEvent } from "@/lib/refund-reconcile";

// reportError → console/Sentry : on le neutralise pour garder la sortie propre.
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

// ---------------------------------------------------------------------------
// Faux `db` qui MODÉLISE des lignes `orders` et honore les filtres `.eq()`, afin
// de vérifier le comportement au niveau LIGNE (idempotence 0-ligne, anti-clobber
// de la révocation), pas seulement la requête construite. `.select("id")`
// applique le payload aux lignes filtrées et renvoie `{ data, error }`.
// ---------------------------------------------------------------------------
function fakeDb(rows: any[] = [], opts: { error?: any } = {}) {
  const cap: { table: string | null; payload: any; filters: any } = {
    table: null,
    payload: null,
    filters: {},
  };
  function builder() {
    let payload: any = null;
    const filters: Record<string, any> = {};
    const b: any = {
      update: (p: any) => {
        payload = p;
        cap.payload = p;
        return b;
      },
      eq: (col: string, val: any) => {
        filters[col] = val;
        cap.filters[col] = val;
        return b;
      },
      select: () => {
        if (opts.error) return Promise.resolve({ data: null, error: opts.error });
        // lignes correspondant à TOUS les filtres (état AVANT update)
        const matched = rows.filter((r) =>
          Object.entries(filters).every(([c, v]) => r[c] === v)
        );
        matched.forEach((r) => Object.assign(r, payload));
        return Promise.resolve({
          data: matched.map((r) => ({ id: r.id })),
          error: null,
        });
      },
    };
    return b;
  }
  return {
    from: (t: string) => {
      cap.table = t;
      return builder();
    },
    __cap: cap,
    __rows: rows,
  } as any;
}

function refund(overrides: any = {}): any {
  return { id: "re_1", status: "succeeded", metadata: {}, created: 1_700_000_000, ...overrides };
}

describe("reconcileRefundEvent — succeeded (confirme + ferme record_failed)", () => {
  it("metadata.order_id, ligne refunded=false → confirmed, écrit refunded=true + stripe_refund_id + refunded_at(refund.created)", async () => {
    const row = { id: "ord-9", refunded: false, stripe_refund_id: null, refunded_at: null };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "succeeded", metadata: { order_id: "ord-9" }, created: 1_700_000_000 })
    );

    expect(out).toEqual({ action: "confirmed", orderId: "ord-9" });
    expect(db.__cap.table).toBe("orders");
    expect(db.__cap.filters).toEqual({ id: "ord-9", refunded: false });
    // effet ligne : drapeau posé, id conservé, horodatage = refund.created
    expect(row.refunded).toBe(true);
    expect(row.stripe_refund_id).toBe("re_9");
    expect(row.refunded_at).toBe(new Date(1_700_000_000 * 1000).toISOString());
  });

  it("déjà enregistré (ligne refunded=true) → 0 ligne, noop idempotent, ligne inchangée", async () => {
    const row = { id: "ord-9", refunded: true, stripe_refund_id: "re_9" };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "succeeded", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "noop" });
    expect(row.refunded).toBe(true); // inchangée
  });

  it("commande introuvable (order_id inconnu) → 0 ligne → noop (ne prétend pas avoir réparé)", async () => {
    const db = fakeDb([{ id: "autre", refunded: false }]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "succeeded", metadata: { order_id: "inconnu" } })
    );
    expect(out).toEqual({ action: "noop" });
  });

  it("repli sur stripe_refund_id quand pas de metadata", async () => {
    const row = { id: "ord-x", refunded: false, stripe_refund_id: "re_old" };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_old", status: "succeeded", metadata: {} })
    );
    expect(out).toEqual({ action: "confirmed" }); // pas d'orderId (mapping par refund id)
    expect(db.__cap.filters).toEqual({ stripe_refund_id: "re_old", refunded: false });
    expect(row.refunded).toBe(true);
  });
});

describe("reconcileRefundEvent — failed/canceled (révocation gardée, anti-clobber)", () => {
  it("failed → reverted, refunded=false + refunded_at null ; stripe_refund_id CONSERVÉ (audit)", async () => {
    const row = { id: "ord-9", refunded: true, stripe_refund_id: "re_9", refunded_at: "2020-01-01" };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "failed", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "reverted", orderId: "ord-9" });
    // révocation ciblée par CE refund + garde refunded=true (idempotence)
    expect(db.__cap.filters).toEqual({ stripe_refund_id: "re_9", refunded: true });
    expect(row.refunded).toBe(false);
    expect(row.refunded_at).toBeNull();
    expect(row.stripe_refund_id).toBe("re_9"); // conservé pour l'audit
  });

  it("canceled → reverted (même comportement)", async () => {
    const row = { id: "ord-9", refunded: true, stripe_refund_id: "re_9" };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "canceled", metadata: { order_id: "ord-9" } })
    );
    expect(out.action).toBe("reverted");
    expect(row.refunded).toBe(false);
  });

  it("ANTI-CLOBBER : failed d'un refund re_1 n'efface PAS un bon refund re_2 sur la même commande", async () => {
    // La commande porte un 2ᵉ remboursement réussi (re_2). Un événement failed
    // TARDIF du 1er refund (re_1), livré hors-ordre, ne doit rien casser.
    const row = { id: "ord-9", refunded: true, stripe_refund_id: "re_2" };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_1", status: "failed", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "noop" }); // 0 ligne : re_1 ≠ re_2
    expect(row.refunded).toBe(true); // bon remboursement intact
    expect(row.stripe_refund_id).toBe("re_2");
  });

  it("rejeu d'un failed déjà appliqué (ligne refunded=false) → 0 ligne, noop idempotent", async () => {
    const row = { id: "ord-9", refunded: false, stripe_refund_id: "re_9" };
    const db = fakeDb([row]);
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "failed", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "noop" });
    expect(row.refunded).toBe(false);
  });
});

describe("reconcileRefundEvent — no-op & robustesse", () => {
  it("pending → noop, aucune écriture (from() jamais appelé)", async () => {
    const db = fakeDb();
    const out = await reconcileRefundEvent(
      db,
      refund({ status: "pending", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "noop" });
    expect(db.__cap.table).toBeNull();
    expect(db.__cap.payload).toBeNull();
  });

  it("statut inconnu → noop", async () => {
    const db = fakeDb();
    const out = await reconcileRefundEvent(db, refund({ status: "requires_action" }));
    expect(out).toEqual({ action: "noop" });
    expect(db.__cap.table).toBeNull();
  });

  it("colonnes 0047 absentes (update renvoie {error}) → noop tolérant", async () => {
    const db = fakeDb([{ id: "ord-9", refunded: false }], {
      error: { message: 'column "stripe_refund_id" does not exist' },
    });
    const out = await reconcileRefundEvent(
      db,
      refund({ id: "re_9", status: "succeeded", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "noop" });
  });

  it("db qui jette → avalé (noop), ne casse jamais le webhook", async () => {
    const db: any = {
      from: () => {
        throw new Error("boom");
      },
    };
    const out = await reconcileRefundEvent(
      db,
      refund({ status: "succeeded", metadata: { order_id: "ord-9" } })
    );
    expect(out).toEqual({ action: "noop" });
  });

  it("ne jette jamais, même avec un refund minimal", async () => {
    const db = fakeDb([{ id: "x", refunded: false, stripe_refund_id: "re_x" }]);
    await expect(
      reconcileRefundEvent(db, { id: "re_x", status: "succeeded" } as any)
    ).resolves.toBeTruthy();
  });
});
