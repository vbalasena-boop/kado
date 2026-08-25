import { describe, it, expect, vi, beforeEach } from "vitest";

// Vérifie que la route persiste des actions déclenchantes ASSAINIES :
//  - l'avis (« review ») n'est jamais écrit comme action ;
//  - une liste vide retombe sur ["instagram"] (jamais zéro action) ;
//  - une liste valide passe telle quelle.
// On espionne le payload passé à `.update(...)` sur wheel_configs.

const updateCalls: Record<string, any>[] = [];

function makeBuilder() {
  const b: any = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = () => Promise.resolve({ data: {}, error: null });
  b.upsert = () => Promise.resolve({ error: null });
  b.update = (payload: any) => {
    updateCalls.push(payload);
    return b;
  };
  b.delete = () => b;
  // rend le builder « awaitable » pour les chaînes update().eq() / delete().eq()
  b.then = (resolve: any) => resolve({ error: null });
  return b;
}

vi.mock("@/lib/auth", () => ({
  getMyBusiness: async () => ({ business: { id: "biz1", slug: "demo" } }),
}));
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({ from: () => makeBuilder() }),
}));
vi.mock("@/lib/prizes", () => ({
  insertPrizes: async () => ({ error: null }),
}));
vi.mock("next/cache", () => ({ revalidateTag: () => {} }));

import { POST } from "@/app/api/dashboard/wheel/route";

function post(config: Record<string, unknown>) {
  return new Request("http://localhost/api/dashboard/wheel", {
    method: "POST",
    body: JSON.stringify({
      config,
      prizes: [{ label: "Lot", emoji: "🎁", weight: 1, color: "#ff5d73" }],
    }),
    headers: { "content-type": "application/json" },
  }) as any;
}

function persistedTriggerActions(): string[] | undefined {
  const hit = [...updateCalls].reverse().find((c) => "trigger_actions" in c);
  return hit?.trigger_actions as string[] | undefined;
}

describe("POST /api/dashboard/wheel — persistance trigger_actions", () => {
  beforeEach(() => {
    updateCalls.length = 0;
  });

  it("assainit une action interdite (avis) → instagram", async () => {
    await POST(post({ trigger_actions: ["review"] }));
    expect(persistedTriggerActions()).toEqual(["instagram"]);
  });

  it("liste vide → repli instagram (jamais zéro action)", async () => {
    await POST(post({ trigger_actions: [] }));
    expect(persistedTriggerActions()).toEqual(["instagram"]);
  });

  it("liste valide persistée telle quelle", async () => {
    await POST(post({ trigger_actions: ["loyalty", "optin"] }));
    expect(persistedTriggerActions()).toEqual(["loyalty", "optin"]);
  });
});
