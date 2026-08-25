import { describe, it, expect, vi, beforeEach } from "vitest";

// Vérifie que la route persiste des actions déclenchantes ASSAINIES :
//  - l'avis (« review ») n'est jamais écrit comme action ;
//  - une liste vide retombe sur ["instagram"] (jamais zéro action) ;
//  - une liste valide passe telle quelle.
// On espionne le payload passé à `.update(...)` sur wheel_configs.

const updateCalls: Record<string, any>[] = [];
// Payloads passés à `.upsert(...)` (l'upsert principal, où vivaient les flags
// legacy instagram_enabled/review_enabled et l'ancien remnant « au moins un canal »).
const upsertCalls: Record<string, any>[] = [];
// Erreur simulée sur les chaînes update().eq() (les 4 blocs tolérants) : null par
// défaut ; un test peut y injecter `{ code }` pour vérifier le tri absente/vraie.
let updateError: any = null;
// Si true, la chaîne update().eq() REJETTE (simulte un throw réseau) au lieu de
// résoudre `{ error }` → doit passer par le `catch` du bloc tolérant.
let updateReject = false;

function makeBuilder() {
  const b: any = {};
  b.select = () => b;
  b.eq = () => b;
  b.maybeSingle = () => Promise.resolve({ data: {}, error: null });
  b.upsert = (payload: any) => {
    upsertCalls.push(payload);
    return Promise.resolve({ error: null });
  };
  b.update = (payload: any) => {
    updateCalls.push(payload);
    return b;
  };
  b.delete = () => b;
  // rend le builder « awaitable » pour les chaînes update().eq() / delete().eq()
  b.then = (resolve: any, reject: any) =>
    updateReject ? reject(new Error("network down")) : resolve({ error: updateError });
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

function persistedBasePayload(): Record<string, any> | undefined {
  return [...upsertCalls].reverse().find((c) => "instagram_enabled" in c);
}

describe("POST /api/dashboard/wheel — colonnes canaux legacy (remnant retiré)", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    upsertCalls.length = 0;
    updateError = null;
    updateReject = false;
  });

  it("ne force plus instagram_enabled/review_enabled à true quand les deux sont faux", async () => {
    // Ancien remnant : si les deux étaient faux → forçés à true. Retiré :
    // trigger_actions est la seule source de vérité du « au moins un tour ».
    await POST(post({ instagram_enabled: false, review_enabled: false, trigger_actions: ["loyalty"] }));
    const base = persistedBasePayload();
    expect(base?.instagram_enabled).toBe(false);
    expect(base?.review_enabled).toBe(false);
  });

  it("écrit les colonnes canaux telles quelles (true par défaut si absentes)", async () => {
    await POST(post({ trigger_actions: ["instagram"] }));
    const base = persistedBasePayload();
    // absentes du payload → défaut historique true (cfg.x !== false)
    expect(base?.instagram_enabled).toBe(true);
    expect(base?.review_enabled).toBe(true);
  });
});

describe("POST /api/dashboard/wheel — persistance trigger_actions", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    updateError = null;
  });

  it("assainit une action interdite (avis) → instagram", async () => {
    await POST(post({ trigger_actions: ["review"] }));
    expect(persistedTriggerActions()).toEqual(["instagram"]);
  });

  it("liste vide → repli instagram (jamais zéro action)", async () => {
    await POST(post({ trigger_actions: [] }));
    expect(persistedTriggerActions()).toEqual(["instagram"]);
  });

  it("liste valide persistée telle quelle (carte fidélité active)", async () => {
    await POST(post({ trigger_actions: ["loyalty", "optin"], loyalty_enabled: true }));
    expect(persistedTriggerActions()).toEqual(["loyalty", "optin"]);
  });

  it("carte fidélité désactivée → « loyalty » purgée à la persistance (défense serveur)", async () => {
    await POST(post({ trigger_actions: ["loyalty", "optin"], loyalty_enabled: false }));
    expect(persistedTriggerActions()).toEqual(["optin"]);
  });
});

describe("POST /api/dashboard/wheel — tolérance des erreurs Supabase", () => {
  beforeEach(() => {
    updateCalls.length = 0;
    updateError = null;
    updateReject = false;
  });

  it("colonne absente (42703) sur les blocs tolérants → tous ignorés, route { ok: true }", async () => {
    // L'erreur simulée s'applique aux 4 blocs : « colonne absente » est tolérée
    // partout → la migration non appliquée ne casse pas l'enregistrement.
    updateError = { code: "42703", message: 'column "x" does not exist' };
    const res = await POST(post({ trigger_actions: ["loyalty"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("PGRST204 (cache de schéma) → toléré comme colonne absente, route { ok: true }", async () => {
    updateError = { code: "PGRST204", message: "column not found in schema cache" };
    const res = await POST(post({ trigger_actions: ["loyalty"] }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });

  it("vraie erreur (23505) → 500 save_failed dès le premier bloc tolérant (play_alerts)", async () => {
    // `updateError` est partagé par les 4 blocs : le 1er (play_alerts) déclenche
    // déjà le 500 — les blocs sont structurellement identiques.
    updateError = { code: "23505", message: "duplicate key" };
    const res = await POST(post({ play_alerts: true, trigger_actions: ["loyalty"] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "save_failed" });
  });

  it("erreur RLS (42501) → 500 (plus jamais de faux { ok: true })", async () => {
    updateError = { code: "42501", message: "permission denied" };
    const res = await POST(post({ trigger_actions: ["loyalty"] }));
    expect(res.status).toBe(500);
  });

  it("exception jetée (throw réseau) sur un bloc tolérant → capturée → 500 save_failed", async () => {
    updateReject = true;
    const res = await POST(post({ trigger_actions: ["loyalty"] }));
    expect(res.status).toBe(500);
    expect(await res.json()).toMatchObject({ error: "save_failed" });
  });
});
