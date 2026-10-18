import { describe, it, expect, vi, beforeEach } from "vitest";
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
let PLAY_PASS_REQUIRED = false;
let PLAY_PASS_VALID = true;

const PRIZES = [
  {
    id: "p1",
    label: "Café offert",
    emoji: "☕",
    weight: 1,
    color: "#ffffff",
    position: 0,
    is_losing: false,
  },
];

const mocks = vi.hoisted(() => ({
  rateLimit: vi.fn(async () => true),
  playWithPass: vi.fn(async (..._args: any[]) => ({ data: true, error: null })),
}));

// Client Supabase minimal : route les lectures selon la table + les colonnes.
function makeClient() {
  return {
    from(table: string) {
      let cols = "";
      const b: any = {
        select: (c: string) => {
          cols = c || "";
          return b;
        },
        eq: () => b,
        gte: () => b,
        gt: () => b,
        is: () => b,
        not: () => Promise.resolve({ count: 0 }),
        order: () => Promise.resolve({ data: PRIZES, error: null }),
        insert: () => Promise.resolve({ error: null }),
        maybeSingle: () => {
          if (table === "play_passes")
            return Promise.resolve({ data: PLAY_PASS_VALID ? { id: "pass1" } : null, error: null });
          if (table === "businesses")
            return Promise.resolve({
              data: { id: "biz1", status: "active" },
              error: null,
            });
          if (table === "wheel_configs") {
            if (cols.includes("play_pass_required"))
              return Promise.resolve({ data: { play_pass_required: PLAY_PASS_REQUIRED }, error: null });
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
              data: { daily_prize_limit: null },
              error: null,
            });
          }
          return Promise.resolve({ data: null, error: null });
        },
      };
      return b;
    },
    rpc: mocks.playWithPass,
  };
}

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  clientIp: () => "test-ip",
  hashRateLimitKey: (value: string) => `hashed:${value}`,
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => makeClient() }));
vi.mock("@/lib/player", () => ({ getOrCreatePlayerId: () => "player1" }));
vi.mock("@/lib/push", () => ({ sendPushToBusiness: async () => {} }));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { POST } from "@/app/api/play/route";

function post(playType: string, playPass?: string) {
  return new NextRequest("http://localhost/api/play", {
    method: "POST",
    body: JSON.stringify({ slug: "demo", playType, playPass }),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/play — garde des actions déclenchantes", () => {
  beforeEach(() => {
    TRIGGER = ["instagram"];
    LOYALTY_ENABLED = true;
    INSTAGRAM_URL = "https://instagram.com/cafe";
    PLAY_PASS_REQUIRED = false;
    PLAY_PASS_VALID = true;
    mocks.rateLimit.mockReset();
    mocks.rateLimit.mockResolvedValue(true);
    mocks.playWithPass.mockReset();
    mocks.playWithPass.mockResolvedValue({ data: true, error: null });
  });

  it("exige un code si le commerce a activé les passes", async () => {
    PLAY_PASS_REQUIRED = true;

    const res = await POST(post("instagram"));

    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("play_pass_required");
    expect(mocks.playWithPass).not.toHaveBeenCalled();
  });

  it("refuse un code inconnu ou déjà utilisé", async () => {
    PLAY_PASS_REQUIRED = true;
    PLAY_PASS_VALID = false;

    const res = await POST(post("instagram", "KDO-ABCDE-FGHJK"));

    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("invalid_play_pass");
    expect(mocks.playWithPass).not.toHaveBeenCalled();
  });

  it("consomme atomiquement un code valide avec le tour", async () => {
    PLAY_PASS_REQUIRED = true;

    const res = await POST(post("instagram", "kdo-abcde-fghjk"));

    expect(res.status).toBe(200);
    expect(mocks.playWithPass).toHaveBeenCalledOnce();
    expect(mocks.playWithPass.mock.calls[0][0]).toBe("play_with_pass");
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
