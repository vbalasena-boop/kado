import { describe, it, expect, vi } from "vitest";

// La RPC Postgres est simulée en échec permanent : on vérifie que le limiteur
// NE « fail-open » PLUS mais applique bien un plafond en mémoire.
vi.mock("@/lib/supabase/admin", () => ({
  getAdminClient: () => ({
    rpc: async () => ({ data: null, error: { message: "rpc indisponible" } }),
  }),
}));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { clientIp, hashRateLimitKey, rateLimit } from "@/lib/rate-limit";

describe("rateLimit — repli mémoire (fail-closed)", () => {
  it("applique la limite en mémoire quand la RPC échoue", async () => {
    const key = `test-${Math.floor(performance.now())}-a`;
    expect(await rateLimit(key, 2, 60)).toBe(true); // 1er
    expect(await rateLimit(key, 2, 60)).toBe(true); // 2e
    expect(await rateLimit(key, 2, 60)).toBe(false); // 3e > limite de 2
  });

  it("isole les clés différentes", async () => {
    const a = `test-${Math.floor(performance.now())}-b`;
    const b = `test-${Math.floor(performance.now())}-c`;
    expect(await rateLimit(a, 1, 60)).toBe(true);
    expect(await rateLimit(a, 1, 60)).toBe(false);
    expect(await rateLimit(b, 1, 60)).toBe(true); // clé b intacte
  });
});

describe("clés anti-abus pseudonymisées", () => {
  it("produit un HMAC stable et opaque pour une même adresse", () => {
    expect(hashRateLimitKey("203.0.113.7")).toBe(hashRateLimitKey("203.0.113.7"));
    expect(hashRateLimitKey("203.0.113.7")).not.toBe("203.0.113.7");
    expect(hashRateLimitKey("203.0.113.7")).not.toBe(hashRateLimitKey("203.0.113.8"));
  });

  it("préfère l'IP fournie par le proxy et ignore le premier X-Forwarded-For", () => {
    const req = new Request("https://kado-app.fr/api/play", {
      headers: {
        "x-real-ip": "203.0.113.9",
        "x-forwarded-for": "198.51.100.1, 203.0.113.8",
      },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("utilise le dernier relais X-Forwarded-For en l'absence de x-real-ip", () => {
    const req = new Request("https://kado-app.fr/api/play", {
      headers: { "x-forwarded-for": "198.51.100.1, 203.0.113.8" },
    });
    expect(clientIp(req)).toBe("203.0.113.8");
  });
});
