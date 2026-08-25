import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Vérifie les comportements SÉCURITÉ/RGPD des routes de ré-abonnement :
//  - demande : e-mail envoyé UNIQUEMENT si la carte est désinscrite ; réponse
//    toujours neutre (anti-énumération) ; aucune écriture de consentement.
//  - confirmation (POST, acte délibéré) : consentement rétabli UNIQUEMENT sur
//    token valide ; token invalide → aucune écriture ; idempotent.

process.env.PLAYER_COOKIE_SECRET = "test-secret-resub";

// État configurable du mock Supabase.
let cardData: { id: string; unsubscribed_at: string | null } | null = null;
let bizStatus = "active";
let updateRows: { id: string }[] = [];
const updateCalls: { payload: Record<string, unknown> }[] = [];
// Audit : capture des insertions consent_events ; `insertThrows` simule un KO.
const insertCalls: { table: string; payload: Record<string, unknown> }[] = [];
let insertThrows = false;
// `cardReadThrows` simule un blip DB à la pré-lecture de la carte (→ 503).
let cardReadThrows = false;

function makeClient() {
  return {
    from(table: string) {
      const q: any = { _cols: "", _update: null as Record<string, unknown> | null };
      q.select = (c: string) => {
        q._cols = c || "";
        // Terminal d'un update : `.update().eq()...select()` est awaité.
        return q._update ? Promise.resolve({ data: updateRows, error: null }) : q;
      };
      q.update = (payload: Record<string, unknown>) => {
        q._update = payload;
        updateCalls.push({ payload });
        return q;
      };
      q.insert = (payload: Record<string, unknown>) => {
        insertCalls.push({ table, payload });
        if (insertThrows) return Promise.reject(new Error("audit KO"));
        return Promise.resolve({ data: null, error: null });
      };
      q.eq = () => q;
      q.not = () => q;
      q.maybeSingle = () => {
        if (table === "businesses") {
          if (q._cols.includes("status"))
            return Promise.resolve({
              data: { id: "biz1", name: "Chez Test", status: bizStatus },
              error: null,
            });
          return Promise.resolve({ data: { name: "Chez Test" }, error: null });
        }
        if (table === "loyalty_cards") {
          if (cardReadThrows)
            return Promise.reject(new Error("db down (pré-lecture carte)"));
          return Promise.resolve({ data: cardData, error: null });
        }
        return Promise.resolve({ data: null, error: null });
      };
      return q;
    },
  };
}

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => true,
  clientIp: () => "test-ip",
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => makeClient() }));
vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(async () => ({ ok: true })),
  emailLayout: () => "<html></html>",
}));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));

import { sendEmail } from "@/lib/email";
import { reportError } from "@/lib/report";
import { POST as requestPost } from "@/app/api/loyalty/resubscribe/route";
import {
  GET as confirmGet,
  POST as confirmPost,
} from "@/app/api/loyalty/resubscribe/confirm/route";
import {
  signResubToken,
  verifyResubToken,
  buildResubConfirmUrl,
  encodeEmail,
} from "@/lib/resubscribe";

// `unsubscribed_at` courant de la carte, lié à la signature (usage unique).
const UNSUB = "2020-01-01T00:00:00.000Z";

function jsonReq(body: unknown) {
  return new NextRequest("http://localhost/api/loyalty/resubscribe", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}
function confirmReq(fields: Record<string, string>) {
  return new NextRequest("http://localhost/api/loyalty/resubscribe/confirm", {
    method: "POST",
    body: new URLSearchParams(fields),
    headers: { "content-type": "application/x-www-form-urlencoded" },
  });
}
function confirmGetReq(fields: Record<string, string>) {
  const qs = new URLSearchParams(fields).toString();
  return new NextRequest(
    `http://localhost/api/loyalty/resubscribe/confirm?${qs}`,
    { method: "GET" }
  );
}

beforeEach(() => {
  cardData = null;
  bizStatus = "active";
  updateRows = [];
  updateCalls.length = 0;
  insertCalls.length = 0;
  insertThrows = false;
  cardReadThrows = false;
  (sendEmail as any).mockClear();
  (reportError as any).mockClear();
});

describe("POST /api/loyalty/resubscribe (demande)", () => {
  it("carte désinscrite → envoie l'e-mail, réponse neutre", async () => {
    cardData = { id: "c1", unsubscribed_at: "2020-01-01" };
    const res = await requestPost(jsonReq({ slug: "s", email: "A@B.fr" }));
    expect((await res.json()).ok).toBe(true);
    expect((sendEmail as any)).toHaveBeenCalledTimes(1);
  });

  it("carte NON désinscrite → aucun e-mail, réponse neutre", async () => {
    cardData = { id: "c1", unsubscribed_at: null };
    const res = await requestPost(jsonReq({ slug: "s", email: "a@b.fr" }));
    expect((await res.json()).ok).toBe(true);
    expect((sendEmail as any)).not.toHaveBeenCalled();
  });

  it("carte inconnue → aucun e-mail, réponse neutre", async () => {
    cardData = null;
    const res = await requestPost(jsonReq({ slug: "s", email: "a@b.fr" }));
    expect((await res.json()).ok).toBe(true);
    expect((sendEmail as any)).not.toHaveBeenCalled();
  });

  it("e-mail invalide → aucun e-mail, réponse neutre", async () => {
    cardData = { id: "c1", unsubscribed_at: "2020-01-01" };
    const res = await requestPost(jsonReq({ slug: "s", email: "pasunemail" }));
    expect((await res.json()).ok).toBe(true);
    expect((sendEmail as any)).not.toHaveBeenCalled();
  });
});

describe("POST /api/loyalty/resubscribe/confirm (confirmation délibérée)", () => {
  const email = "a@b.fr";
  // Le token est signé avec l'`unsubAt` COURANT de la carte (usage unique).
  const goodToken = (exp: number) => signResubToken("biz1", email, exp, UNSUB);

  it("token valide → rétablit le consentement + audit consent_events", async () => {
    cardData = { id: "c1", unsubscribed_at: UNSUB };
    updateRows = [{ id: "c1" }];
    const exp = Date.now() + 100000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(1);
    expect(updateCalls[0].payload).toEqual({
      unsubscribed_at: null,
      marketing_ok: true,
    });
    // Audit RGPD : exactement un événement resubscribe_confirmed horodaté.
    const events = insertCalls.filter((c) => c.table === "consent_events");
    expect(events).toHaveLength(1);
    expect(events[0].payload).toMatchObject({
      type: "resubscribe_confirmed",
      source: "confirm_route",
      business_id: "biz1",
      email,
      card_id: "c1",
    });
    expect(await res.text()).toContain("ré-abonné");
  });

  it("audit KO → ré-abonnement acté quand même (best-effort)", async () => {
    cardData = { id: "c1", unsubscribed_at: UNSUB };
    updateRows = [{ id: "c1" }];
    insertThrows = true;
    const exp = Date.now() + 100000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    // Le flux réussit malgré l'échec de l'écriture d'audit.
    expect(res.status).toBe(200);
    expect(updateCalls).toHaveLength(1);
    expect(await res.text()).toContain("ré-abonné");
    // …et l'erreur est bien signalée à reportError (pas avalée silencieusement).
    expect(reportError as any).toHaveBeenCalledTimes(1);
  });

  it("token invalide → AUCUNE écriture, 400", async () => {
    cardData = { id: "c1", unsubscribed_at: UNSUB };
    const exp = Date.now() + 100000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: "forge" })
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
    expect(insertCalls.filter((c) => c.table === "consent_events")).toHaveLength(0);
  });

  it("token expiré → AUCUNE écriture, 400", async () => {
    cardData = { id: "c1", unsubscribed_at: UNSUB };
    const exp = Date.now() - 1000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });

  it("déjà ré-abonné (carte déjà unsubscribed_at=null) → 200 « Déjà », aucune écriture", async () => {
    // Re-clic bénin sur un lien déjà utilisé : carte re-inscrite entre-temps.
    cardData = { id: "c1", unsubscribed_at: null };
    const exp = Date.now() + 100000;
    // Token signé avec l'ANCIEN unsubAt (avant le ré-abonnement).
    const t = signResubToken("biz1", email, exp, UNSUB);
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t })
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Déjà ré-abonné");
    expect(updateCalls).toHaveLength(0);
    expect(insertCalls.filter((c) => c.table === "consent_events")).toHaveLength(0);
  });

  it("usage unique : carte re-désinscrite (nouveau timestamp) → 400, aucune écriture", async () => {
    // La carte est de nouveau désinscrite, mais avec un AUTRE timestamp que
    // celui signé → le token ne re-dérive plus la même signature.
    cardData = { id: "c1", unsubscribed_at: "2022-09-09T00:00:00.000Z" };
    const exp = Date.now() + 100000;
    const t = signResubToken("biz1", email, exp, UNSUB);
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t })
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
    expect(insertCalls.filter((c) => c.table === "consent_events")).toHaveLength(0);
  });

  it("blip DB à la pré-lecture → 503 (pas « invalide »), POST", async () => {
    cardReadThrows = true;
    const exp = Date.now() + 100000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    expect(res.status).toBe(503);
    expect(updateCalls).toHaveLength(0);
  });

  it("blip DB à la pré-lecture → 503 (pas « invalide »), GET", async () => {
    cardReadThrows = true;
    const exp = Date.now() + 100000;
    const res = await confirmGet(
      confirmGetReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    expect(res.status).toBe(503);
  });

  it("round-trip demande→confirmation : le token forgé par buildResubConfirmUrl valide", () => {
    // Le lien produit à la DEMANDE doit valider à la CONFIRMATION (même unsubAt).
    const { exp, url } = buildResubConfirmUrl("biz1", email, UNSUB);
    const u = new URL(url);
    const t = u.searchParams.get("t") || "";
    expect(u.searchParams.get("exp")).toBe(String(exp));
    expect(verifyResubToken("biz1", email, exp, UNSUB, t)).toBe(true);
  });
});
