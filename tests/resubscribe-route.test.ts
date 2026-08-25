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
        if (table === "loyalty_cards")
          return Promise.resolve({ data: cardData, error: null });
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

import { sendEmail } from "@/lib/email";
import { POST as requestPost } from "@/app/api/loyalty/resubscribe/route";
import { POST as confirmPost } from "@/app/api/loyalty/resubscribe/confirm/route";
import { signResubToken, encodeEmail } from "@/lib/resubscribe";

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

beforeEach(() => {
  cardData = null;
  bizStatus = "active";
  updateRows = [];
  updateCalls.length = 0;
  (sendEmail as any).mockClear();
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
  const goodToken = (exp: number) => signResubToken("biz1", email, exp);

  it("token valide → rétablit le consentement (idempotent, filtré)", async () => {
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
    expect(await res.text()).toContain("ré-abonné");
  });

  it("token invalide → AUCUNE écriture, 400", async () => {
    const exp = Date.now() + 100000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: "forge" })
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });

  it("token expiré → AUCUNE écriture, 400", async () => {
    const exp = Date.now() - 1000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    expect(res.status).toBe(400);
    expect(updateCalls).toHaveLength(0);
  });

  it("rejeu idempotent (0 ligne modifiée) → 200 « déjà »", async () => {
    updateRows = [];
    const exp = Date.now() + 100000;
    const res = await confirmPost(
      confirmReq({ b: "biz1", e: encodeEmail(email), exp: String(exp), t: goodToken(exp) })
    );
    expect(res.status).toBe(200);
    expect(await res.text()).toContain("Déjà");
  });
});
