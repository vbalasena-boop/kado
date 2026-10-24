import { beforeEach, afterEach, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ user: true, filters: [] as unknown[][], result: { data: { id: "11111111-1111-4111-8111-111111111111", number: 1, status: "ready" }, error: null } as { data: unknown; error: unknown }, update: vi.fn() }));
vi.mock("@/lib/auth", () => ({
  getMyBusiness: async () => ({ user: state.user ? { id: "owner" } : null, business: { id: "biz", slug: "cafe" } }),
  getSessionUser: vi.fn(), hasAccess: () => true, hasModule: () => true, hasClickCollect: () => true,
}));
vi.mock("@/lib/supabase/ssr", () => ({ createSSRClient: async () => ({ from: () => {
  const chain = {
    update: (value: unknown) => { state.update(value); return chain; },
    eq: (...args: unknown[]) => { state.filters.push(args); return chain; },
    gte: () => chain, select: () => chain, maybeSingle: async () => state.result,
  };
  return chain;
} }) }));
import { PATCH } from "@/app/api/beeper/merchant/route";
const request = (status = "ready") => new NextRequest("http://localhost/api/beeper/merchant", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: "11111111-1111-4111-8111-111111111111", status }) });
beforeEach(() => { vi.stubEnv("BEEPER_PILOT_SLUG", "cafe"); state.user = true; state.filters = []; state.update.mockReset(); state.result = { data: { id: "11111111-1111-4111-8111-111111111111", number: 1, status: "ready" }, error: null }; });
afterEach(() => vi.unstubAllEnvs());
it("refuse une session absente", async () => { state.user = false; expect((await PATCH(request())).status).toBe(401); expect(state.update).not.toHaveBeenCalled(); });
it("utilise la session RLS et filtre commerce, commande et état antérieur", async () => {
  expect((await PATCH(request())).status).toBe(200);
  expect(state.filters).toContainEqual(["business_id", "biz"]);
  expect(state.filters).toContainEqual(["status", "preparing"]);
  expect(state.filters).toContainEqual(["id", "11111111-1111-4111-8111-111111111111"]);
});
it("récupération exige l'état prêt", async () => { await PATCH(request("collected")); expect(state.filters).toContainEqual(["status", "ready"]); });
it("interdit le retour en préparation", async () => { expect((await PATCH(request("preparing"))).status).toBe(400); expect(state.update).not.toHaveBeenCalled(); });
it("signale un conflit si la RLS ou l'état empêche la modification", async () => { state.result.data = null; expect((await PATCH(request())).status).toBe(409); });
