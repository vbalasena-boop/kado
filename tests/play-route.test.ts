import { describe, it, expect, vi, beforeEach } from "vitest";
import { FINGERPRINT_CONSENT_VERSION } from "@/lib/fingerprint-consent";
import { signPlayEmailToken, playEmailHash } from "@/lib/play-email";
import { NextRequest } from "next/server";

// Vérifie la GARDE d'autorisation de POST /api/play (story 9.2) :
//  - une action configurée dans `trigger_actions` débloque un tour (200, tirage
//    serveur) ;
//  - une action non configurée est refusée (403 action_not_allowed) ;
//  - l'avis (`review`) est refusé (400 invalid_params, retiré de VALID_TYPES).
// Patron de mock idiomatique (cf. tests/wheel-route.test.ts, stripe-webhook).

// Actions déclenchantes renvoyées par le mock `wheel_configs` (mutable par test).
let TRIGGER: unknown = ["instagram"];
// Carte de fidélité active ? (gate de l'action « loyalty », mutable par test).
let LOYALTY_ENABLED = true;
// Lien Instagram renseigné ? (gate de l'action « instagram », mutable par test).
let INSTAGRAM_URL: string | null = "https://instagram.com/cafe";
let DAILY_LIMIT: number | null = null;
let CLAIM_ERROR = false;
let CLAIMED = true;
let INSERT_STATUS = "inserted";
let DEMO = false;
let PLAYER_ID = "player1";
let COOKIE_PRIZE: { prize_label: string; prize_code: string } | null = null;
let SAVED = new Map<string, { prize_label: string; prize_code: string }>();
let CONSENT: { consented: boolean; policy_version: string } | null = null;

const WINNING_PRIZE = {
  id: "p1",
  label: "Café offert",
  emoji: "☕",
  weight: 1,
  color: "#ffffff",
  position: 0,
  is_losing: false,
};
let PRIZES = [
  WINNING_PRIZE,
];

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(async (_key: string, _limit: number, _window: number) => true),
}));

// Client Supabase minimal : route les lectures selon la table + les colonnes.
function makeClient() {
  return {
    from(table: string) {
      let cols = "";
      const filters: Record<string, string> = {};
      const b: any = {
        select: (c: string) => {
          cols = c || "";
          return b;
        },
        eq: (key: string, value: string) => { filters[key] = value; return b; },
        in: () => b,
        limit: () => b,
        gte: () => b,
        gt: () => b,
        is: () => b,
        not: () => Promise.resolve({ count: 0 }),
        order: () => Promise.resolve({ data: PRIZES, error: null }),
        insert: () => Promise.resolve({ error: null }),
        maybeSingle: () => {
          if (table === "plays") return Promise.resolve({ data: filters.player_id ? COOKIE_PRIZE : SAVED.get(filters.email_hash) ?? null, error: null });
          if (table === "businesses")
            return Promise.resolve({
              data: { id: "biz1", status: "active", demo: DEMO },
              error: null,
            });
          if (table === "player_fingerprint_consents")
            return Promise.resolve({ data: CONSENT, error: null });
          if (table === "wheel_configs") {
            if (cols.includes("trigger_actions"))
              return Promise.resolve({
                data: {
                  trigger_actions: TRIGGER,
                  loyalty_enabled: LOYALTY_ENABLED,
                  instagram_url: INSTAGRAM_URL,
                },
                error: null,
              });
            if (cols.includes("play_alerts"))
              return Promise.resolve({
                data: { play_alerts: false },
                error: null,
              });
            return Promise.resolve({
              data: { daily_prize_limit: DAILY_LIMIT },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return b;
    },
    rpc: async (_name: string, args: any) => {
      if (args.p_email_hash && !CLAIM_ERROR && CLAIMED && INSERT_STATUS === "inserted") {
        if (SAVED.has(args.p_email_hash)) return { data: "already_played", error: null };
        SAVED.set(args.p_email_hash, { prize_label: args.p_prize_label, prize_code: args.p_prize_code });
      }
      return CLAIM_ERROR
      ? ({ data: null, error: { message: "function unavailable" } })
      : ({
          data: INSERT_STATUS !== "inserted"
            ? INSERT_STATUS
            : args.p_is_losing || CLAIMED
              ? "inserted"
              : "daily_prize_limit_reached",
          error: null,
        });
    },
  };
}

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  clientIp: () => "test-ip",
  hashRateLimitKey: (value: string) => `hashed:${value}`,
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => makeClient() }));
vi.mock("@/lib/player", () => ({ getOrCreatePlayerId: () => PLAYER_ID }));
vi.mock("@/lib/push", () => ({ sendPushToBusiness: async () => {} }));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { POST } from "@/app/api/play/route";

function post(playType: string, deviceHash?: string, emailToken: string | null = signPlayEmailToken("biz1", playEmailHash("player@example.com"))) {
  return new NextRequest("http://localhost/api/play", {
    method: "POST",
    body: JSON.stringify({ slug: "demo", playType, deviceHash, emailToken: emailToken ?? undefined }),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/play — garde des actions déclenchantes", () => {
  beforeEach(() => {
    DEMO = false;
    PLAYER_ID = "player1";
    COOKIE_PRIZE = null;
    SAVED = new Map();
    CONSENT = null;
    TRIGGER = ["instagram"];
    LOYALTY_ENABLED = true;
    INSTAGRAM_URL = "https://instagram.com/cafe";
    DAILY_LIMIT = null;
    PRIZES = [WINNING_PRIZE];
    CLAIM_ERROR = false;
    CLAIMED = true;
    INSERT_STATUS = "inserted";
    mocks.rateLimit.mockReset();
    mocks.rateLimit.mockResolvedValue(true);
  });

  it("refuse les tours quand le plafond réseau du commerce est atteint", async () => {
    mocks.rateLimit.mockResolvedValueOnce(true).mockResolvedValueOnce(false);

    const res = await POST(post("instagram"));

    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate_limited");
    expect(mocks.rateLimit).toHaveBeenNthCalledWith(
      2,
      "play-business:biz1:hashed:test-ip",
      80,
      3600
    );
  });

  it.each([
    ["absente", undefined, null],
    ["refusée", "a".repeat(64), { consented: false, policy_version: FINGERPRINT_CONSENT_VERSION }],
    ["sans consentement", "a".repeat(64), null],
    ["obsolète", "a".repeat(64), { consented: true, policy_version: "obsolete" }],
  ])("exige un e-mail si empreinte %s", async (_label, hash, consent) => {
    CONSENT = consent;
    const res = await POST(post("instagram", hash, null));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "email_required" });
    expect(SAVED.size).toBe(0);
  });

  it("rend le lot déjà obtenu avec les variantes Gmail, même sans cookie", async () => {
    const first = await POST(post("instagram", undefined, signPlayEmailToken("biz1", playEmailHash("Jean.Dupont+jeu@gmail.com"))));
    const prize = await first.json();
    expect(first.status).toBe(200);
    PLAYER_ID = "player2";
    const second = await POST(post("instagram", undefined, signPlayEmailToken("biz1", playEmailHash("jeandupont@googlemail.com"))));
    expect(second.status).toBe(409);
    expect(await second.json()).toEqual({ alreadyPlayed: true, label: prize.label, code: prize.code });
  });

  it("autorise deux e-mails sur la même IP sans plafond sans empreinte", async () => {
    for (const email of ["one@example.com", "two@example.com"]) {
      PLAYER_ID = email;
      expect((await POST(post("instagram", undefined, signPlayEmailToken("biz1", playEmailHash(email))))).status).toBe(200);
    }
    expect(mocks.rateLimit.mock.calls.some(([key]) => key.startsWith("play-nofp:"))).toBe(false);
  });

  it("retrouve le lot du cookie si le conflit SQL vient d'un autre e-mail", async () => {
    INSERT_STATUS = "already_played";
    COOKIE_PRIZE = { prize_label: "Café offert", prize_code: "EXISTANT" };
    const res = await POST(post("instagram"));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ alreadyPlayed: true, label: "Café offert", code: "EXISTANT" });
  });

  it("refuse un jeton destiné à un autre commerce", async () => {
    const res = await POST(post("instagram", undefined, signPlayEmailToken("autre", playEmailHash("a@example.com"))));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: "email_required" });
  });

  it("ne consomme pas le plafond sans empreinte avec un consentement valide", async () => {
    CONSENT = { consented: true, policy_version: FINGERPRINT_CONSENT_VERSION };
    expect((await POST(post("instagram", "a".repeat(64), null))).status).toBe(200);
    expect(mocks.rateLimit.mock.calls.some(([key]) => key.startsWith("play-nofp:"))).toBe(false);
  });

  it("exempte les démos des plafonds par commerce", async () => {
    DEMO = true;
    mocks.rateLimit.mockImplementation(async (key) => key.startsWith("play:"));
    for (let i = 0; i < 21; i++) {
      expect((await POST(post("instagram", undefined, null))).status).toBe(200);
    }
    expect(mocks.rateLimit.mock.calls.every(([key]) => key.startsWith("play:"))).toBe(true);
  });

  it("échoue fermé si l'enregistrement transactionnel est indisponible", async () => {
    DAILY_LIMIT = 1;
    CLAIM_ERROR = true;
    const res = await POST(post("instagram"));
    expect(res.status).toBe(503);
    expect((await res.json()).error).toBe("play_save_unavailable");
  });

  it("ne dépasse pas le plafond si aucun lot perdant n'est configuré", async () => {
    DAILY_LIMIT = 1;
    CLAIMED = false;
    const res = await POST(post("instagram"));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe("daily_prize_limit_reached");
  });

  it("enregistre un lot perdant au plafond sans consommer une réservation gagnante", async () => {
    DAILY_LIMIT = 1;
    CLAIMED = false;
    PRIZES.push({ ...WINNING_PRIZE, id: "p2", label: "Rien", is_losing: true, position: 1 });
    const res = await POST(post("instagram"));
    expect(res.status).toBe(200);
    expect((await res.json()).label).toBe("Rien");
  });

  it("instagram sans lien MAIS autre action offerte → 403 (bouton mort évité)", async () => {
    TRIGGER = ["instagram", "optin"];
    INSTAGRAM_URL = "";
    const res = await POST(post("instagram"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("action_not_allowed");
  });

  it("instagram sans lien, action unique → 200 (le jeu reste jouable)", async () => {
    TRIGGER = ["instagram"];
    INSTAGRAM_URL = null;
    const res = await POST(post("instagram"));
    expect(res.status).toBe(200);
  });

  it("action configurée → 200 + tirage serveur", async () => {
    TRIGGER = ["loyalty"];
    const res = await POST(post("loyalty"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.label).toBe("Café offert");
    expect(typeof data.code).toBe("string");
    expect(data.index).toBe(0);
  });

  it("loyalty configurée MAIS carte désactivée → 403 (impasse évitée)", async () => {
    TRIGGER = ["loyalty"];
    LOYALTY_ENABLED = false;
    const res = await POST(post("loyalty"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("action_not_allowed");
  });

  it("action non configurée → 403 action_not_allowed", async () => {
    TRIGGER = ["instagram"];
    const res = await POST(post("optin"));
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("action_not_allowed");
  });

  it("avis (review) → 400 invalid_params (retiré de VALID_TYPES)", async () => {
    TRIGGER = ["instagram", "loyalty", "optin"];
    const res = await POST(post("review"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_params");
  });
});
