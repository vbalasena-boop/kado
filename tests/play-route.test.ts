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
        not: () => Promise.resolve({ count: 0 }),
        order: () => Promise.resolve({ data: PRIZES, error: null }),
        insert: () => Promise.resolve({ error: null }),
        maybeSingle: () => {
          if (table === "businesses")
            return Promise.resolve({
              data: { id: "biz1", status: "active" },
              error: null,
            });
          if (table === "wheel_configs") {
            if (cols.includes("trigger_actions"))
              return Promise.resolve({
                data: { trigger_actions: TRIGGER, loyalty_enabled: LOYALTY_ENABLED },
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
  };
}

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async () => true,
  clientIp: () => "test-ip",
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => makeClient() }));
vi.mock("@/lib/player", () => ({ getOrCreatePlayerId: () => "player1" }));
vi.mock("@/lib/push", () => ({ sendPushToBusiness: async () => {} }));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { POST } from "@/app/api/play/route";

function post(playType: string) {
  return new NextRequest("http://localhost/api/play", {
    method: "POST",
    body: JSON.stringify({ slug: "demo", playType }),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/play — garde des actions déclenchantes", () => {
  beforeEach(() => {
    TRIGGER = ["instagram"];
    LOYALTY_ENABLED = true;
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
