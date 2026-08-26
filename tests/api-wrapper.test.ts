import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  getMyBusiness: vi.fn(),
  getSessionUser: vi.fn(),
  getAdminUser: vi.fn(),
  rateLimit: vi.fn(),
}));

// On garde les VRAIES `hasAccess`/`hasModule` (pures) et on ne remplace que
// la résolution d'établissement, pour tester le gating réel du wrapper.
vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getMyBusiness: mocks.getMyBusiness,
    getSessionUser: mocks.getSessionUser,
  };
});
vi.mock("@/lib/admin-guard", () => ({ getAdminUser: mocks.getAdminUser }));
vi.mock("@/lib/rate-limit", () => ({
  rateLimit: mocks.rateLimit,
  clientIp: () => "ip",
}));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { publicRoute, merchantRoute, adminRoute } from "@/lib/api";

function req(body?: unknown) {
  return new NextRequest("http://localhost/api/test", {
    method: "POST",
    body: body === undefined ? undefined : JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

const Schema = z.object({ name: z.string().min(1) });

beforeEach(() => {
  mocks.rateLimit.mockResolvedValue(true);
  mocks.getMyBusiness.mockReset();
  mocks.getAdminUser.mockReset();
});

describe("publicRoute", () => {
  it("rejette un corps invalide (400 invalid_body)", async () => {
    const h = publicRoute({ schema: Schema, handler: () => Response.json({ ok: true }) });
    const res = await h(req({ name: "" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("invalid_body");
  });

  it("passe le corps validé et typé au handler", async () => {
    const h = publicRoute({
      schema: Schema,
      handler: ({ body }) => Response.json({ got: body.name }),
    });
    const res = await h(req({ name: "Kado" }));
    expect(res.status).toBe(200);
    expect((await res.json()).got).toBe("Kado");
  });

  it("renvoie 429 quand le rate-limit est dépassé", async () => {
    mocks.rateLimit.mockResolvedValue(false);
    const h = publicRoute({
      rateLimit: { key: () => "k", limit: 1, windowSeconds: 60 },
      handler: () => Response.json({ ok: true }),
    });
    expect((await h(req())).status).toBe(429);
  });
});

describe("merchantRoute", () => {
  it("401 sans établissement rattaché", async () => {
    mocks.getMyBusiness.mockResolvedValue({ user: null, business: null });
    const h = merchantRoute({ handler: () => Response.json({ ok: true }) });
    expect((await h(req())).status).toBe(401);
  });

  it("fournit l'établissement au handler", async () => {
    mocks.getMyBusiness.mockResolvedValue({
      user: { id: "u" },
      business: { id: "b", slug: "s" },
    });
    const h = merchantRoute({
      handler: ({ business }) => Response.json({ id: business.id }),
    });
    expect((await (await h(req())).json()).id).toBe("b");
  });

  const activeBiz = {
    id: "b",
    slug: "s",
    status: "active",
    subscription_status: "active",
    subscription_ends_at: null,
    plan: "complet",
  };

  it("requireActive : 403 si l'établissement est suspendu", async () => {
    mocks.getMyBusiness.mockResolvedValue({
      user: { id: "u" },
      business: { ...activeBiz, status: "suspended" },
    });
    const h = merchantRoute({
      requireActive: true,
      handler: () => Response.json({ ok: true }),
    });
    const res = await h(req());
    expect(res.status).toBe(403);
    expect((await res.json()).reason).toBe("inactive");
  });

  it("requireActive : 403 si l'abonnement est expiré", async () => {
    mocks.getMyBusiness.mockResolvedValue({
      user: { id: "u" },
      business: { ...activeBiz, subscription_ends_at: "2000-01-01T00:00:00Z" },
    });
    const h = merchantRoute({
      requireActive: true,
      handler: () => Response.json({ ok: true }),
    });
    expect((await h(req())).status).toBe(403);
  });

  it("requireActive : laisse passer un établissement actif", async () => {
    mocks.getMyBusiness.mockResolvedValue({
      user: { id: "u" },
      business: activeBiz,
    });
    const h = merchantRoute({
      requireActive: true,
      handler: () => Response.json({ ok: true }),
    });
    expect((await h(req())).status).toBe(200);
  });

  it("requireModule : 403 quand le module manque, 200 sinon", async () => {
    mocks.getMyBusiness.mockResolvedValue({
      user: { id: "u" },
      business: { ...activeBiz, plan: "comptoir" }, // aucun jeu
    });
    const gated = merchantRoute({
      requireModule: "roue",
      handler: () => Response.json({ ok: true }),
    });
    expect((await gated(req())).status).toBe(403);

    mocks.getMyBusiness.mockResolvedValue({
      user: { id: "u" },
      business: { ...activeBiz, plan: "roue" },
    });
    const ok = merchantRoute({
      requireModule: "roue",
      handler: () => Response.json({ ok: true }),
    });
    expect((await ok(req())).status).toBe(200);
  });
});

describe("adminRoute", () => {
  it("403 pour un non-admin", async () => {
    mocks.getAdminUser.mockResolvedValue(null);
    const h = adminRoute({ handler: () => Response.json({ ok: true }) });
    expect((await h(req())).status).toBe(403);
  });

  it("appelle le handler pour un admin", async () => {
    mocks.getAdminUser.mockResolvedValue({ id: "a", email: "a@b.c" });
    const h = adminRoute({ handler: () => Response.json({ ok: true }) });
    expect((await h(req())).status).toBe(200);
  });
});
