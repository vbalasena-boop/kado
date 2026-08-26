import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Vérifie le comportement RGPD/idempotence de la désinscription fidélité :
//  - token valide + carte inscrite → update loyalty_cards filtré
//    (`.is(unsubscribed_at,null)`) + marketing_ok:false + 1 consent_events
//    'unsubscribed' (audit best-effort).
//  - re-hit (carte déjà désinscrite → 0 ligne) : AUCUN nouvel consent_events.
//  - token invalide → aucune écriture.
//  - audit KO (insert lève) : la désinscription réussit quand même + reportError.

process.env.PLAYER_COOKIE_SECRET = "test-secret-unsub";

// État configurable du mock Supabase.
let loyaltyUpdateRows: { id: string }[] = [];
let insertThrows = false;
const updateCalls: { table: string; payload: Record<string, unknown> }[] = [];
const insertCalls: { table: string; payload: Record<string, unknown> }[] = [];

function makeClient() {
  return {
    from(table: string) {
      const q: any = {};
      q.update = (payload: Record<string, unknown>) => {
        updateCalls.push({ table, payload });
        return q;
      };
      q.eq = () => q;
      q.is = () => q;
      // Terminal de l'update loyalty_cards : `.update()...is().select("id")`.
      q.select = () =>
        Promise.resolve({ data: loyaltyUpdateRows, error: null });
      q.insert = (payload: Record<string, unknown>) => {
        insertCalls.push({ table, payload });
        if (insertThrows) return Promise.reject(new Error("audit KO"));
        return Promise.resolve({ data: null, error: null });
      };
      return q;
    },
  };
}

// Token de désinscription déterministe (contrôle valide/invalide dans le test).
vi.mock("@/lib/unsub", () => ({
  unsubToken: (b: string, e: string) => `valid:${b}:${e}`,
  verifyUnsubToken: (b: string, e: string, t: string) =>
    !!b && !!e && t === `valid:${b}:${e}`,
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => makeClient() }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { reportError } from "@/lib/report";
import { GET as unsubGet } from "@/app/api/unsubscribe/route";

const B = "biz1";
const EMAIL = "a@b.fr";
const enc = (s: string) => Buffer.from(s, "utf8").toString("base64url");
const validToken = `valid:${B}:${EMAIL}`;

function unsubReq(params: Record<string, string>) {
  const qs = new URLSearchParams(params).toString();
  return new NextRequest(`http://localhost/api/unsubscribe?${qs}`, {
    method: "GET",
  });
}

beforeEach(() => {
  loyaltyUpdateRows = [];
  insertThrows = false;
  updateCalls.length = 0;
  insertCalls.length = 0;
  (reportError as any).mockClear();
});

describe("GET /api/unsubscribe (désinscription fidélité)", () => {
  it("token valide + carte inscrite → update filtré + 1 consent_events 'unsubscribed'", async () => {
    loyaltyUpdateRows = [{ id: "c1" }];
    const res = await unsubGet(
      unsubReq({ b: B, e: enc(EMAIL), t: validToken })
    );
    expect(res.status).toBe(200);

    const cardUpdate = updateCalls.find((c) => c.table === "loyalty_cards");
    expect(cardUpdate).toBeTruthy();
    expect(cardUpdate!.payload.marketing_ok).toBe(false);
    expect(typeof cardUpdate!.payload.unsubscribed_at).toBe("string");

    const events = insertCalls.filter((c) => c.table === "consent_events");
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      type: "unsubscribed",
      source: "unsubscribe_route",
      business_id: B,
      email: EMAIL,
      card_id: "c1",
    });
  });

  it("re-hit (carte déjà désinscrite → 0 ligne) → AUCUN nouvel consent_events (idempotent)", async () => {
    loyaltyUpdateRows = []; // le filtre .is(unsubscribed_at,null) n'affecte rien
    const res = await unsubGet(
      unsubReq({ b: B, e: enc(EMAIL), t: validToken })
    );
    expect(res.status).toBe(200);
    // L'update est bien tenté (filtré), mais aucun event puisque 0 ligne.
    expect(updateCalls.some((c) => c.table === "loyalty_cards")).toBe(true);
    expect(insertCalls.filter((c) => c.table === "consent_events")).toHaveLength(0);
  });

  it("token invalide → aucune écriture, 400", async () => {
    loyaltyUpdateRows = [{ id: "c1" }];
    const res = await unsubGet(
      unsubReq({ b: B, e: enc(EMAIL), t: "forge" })
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
    expect(insertCalls).toHaveLength(0);
  });

  it("audit KO (insert lève) → désinscription réussit quand même + reportError", async () => {
    loyaltyUpdateRows = [{ id: "c1" }];
    insertThrows = true;
    const res = await unsubGet(
      unsubReq({ b: B, e: enc(EMAIL), t: validToken })
    );
    // La désinscription reste actée (best-effort).
    expect(res.status).toBe(200);
    expect(updateCalls.some((c) => c.table === "loyalty_cards")).toBe(true);
    expect(reportError as any).toHaveBeenCalledTimes(1);
  });
});
