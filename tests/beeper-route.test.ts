import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
const state = vi.hoisted(() => ({ rpc: vi.fn(), filters: [] as unknown[][], biz: { id: "biz", status: "active", subscription_ends_at: null }, order: { id: "order", number: 1, status: "preparing" } }));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({
  rpc: state.rpc,
  from: (table: string) => {
    const chain = {
      select: () => chain, eq: (...args: unknown[]) => { state.filters.push(args); return chain; },
      gte: () => chain, order: () => chain, limit: () => chain,
      maybeSingle: async () => ({ data: table === "businesses" ? state.biz : state.order, error: null }),
    };
    return chain;
  },
}) }));
vi.mock("@/lib/auth", () => ({ hasAccess: () => true }));
import { GET, POST } from "@/app/api/beeper/[slug]/route";
const ctx = { params: Promise.resolve({ slug: "cafe" }) };
const req = (method = "POST", cookie?: string) => new NextRequest("http://localhost/api/beeper/cafe", { method, headers: cookie ? { cookie } : {} });
describe("attribution et lecture beeper", () => {
  beforeEach(() => { vi.stubEnv("BEEPER_PILOT_SLUG", "cafe"); state.filters = []; state.rpc.mockReset().mockResolvedValue({ data: [state.order], error: null }); });
  afterEach(() => vi.unstubAllEnvs());
  it("attribue via la transaction SQL, pose un cookie HttpOnly sans exposer les empreintes", async () => {
    const r = await POST(req(), ctx);
    expect(r.status).toBe(200);
    expect(await r.json()).toEqual({ order: state.order });
    expect(r.headers.get("set-cookie")).toMatch(/kado-beeper-device=.*HttpOnly/i);
    const args = state.rpc.mock.calls[0][1];
    expect(args.device).toMatch(/^[a-f0-9]{64}$/);
    expect(args.ip).toMatch(/^[a-f0-9]{64}$/);
  });
  it("réutilise la même clé pour un cookie existant", async () => {
    const cookie = "kado-beeper-device=11111111-1111-4111-8111-111111111111";
    await POST(req("POST", cookie), ctx);
    await POST(req("POST", cookie), ctx);
    expect(state.rpc.mock.calls[0][1]).toEqual(state.rpc.mock.calls[1][1]);
  });
  it("retourne 429 si le quota atomique est atteint", async () => {
    state.rpc.mockResolvedValue({ error: { message: "beeper_limit" } });
    expect((await POST(req(), ctx)).status).toBe(429);
  });
  it("échoue fermé quand la base est indisponible", async () => {
    state.rpc.mockResolvedValue({ error: { message: "offline" } });
    expect((await POST(req(), ctx)).status).toBe(503);
  });
  it("refuse les commerces hors pilote et les créations cross-origin", async () => {
    expect((await POST(req(), { params: Promise.resolve({ slug: "autre" }) })).status).toBe(404);
    const request = new NextRequest("http://localhost/api/beeper/cafe", { method: "POST", headers: { origin: "https://other.example" } });
    expect((await POST(request, ctx)).status).toBe(403);
    expect(state.rpc).not.toHaveBeenCalled();
  });
  it("filtre la lecture par commerce et cookie sans créer de commande", async () => {
    const r = await GET(req("GET", "kado-beeper-device=11111111-1111-4111-8111-111111111111"), ctx);
    expect(r.status).toBe(200);
    expect(state.filters).toContainEqual(["business_id", "biz"]);
    expect(state.filters.some(f => f[0] === "device_key")).toBe(true);
    expect(state.rpc).not.toHaveBeenCalled();
  });
});
