import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { z } from "zod";

const mocks = vi.hoisted(() => ({
  getMyBusiness: vi.fn(),
  getSessionUser: vi.fn(),
  getAdminUser: vi.fn(),
  rateLimit: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  getMyBusiness: mocks.getMyBusiness,
  getSessionUser: mocks.getSessionUser,
}));
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
