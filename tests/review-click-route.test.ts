import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Vérifie POST /api/review-click : enregistre un clic sur le lien avis Google.
//  - slug valide → 200 (insertion) ;
//  - slug absent → 400 ;
//  - commerce inconnu → 404 ;
//  - table 0077 absente (42P01) → 200 (tolérant, la mesure ne bloque jamais).

let BIZ: any = { id: "biz1" };
let INSERT_ERROR: any = null;
const inserts: any[] = [];

function makeClient() {
  return {
    from(table: string) {
      const b: any = {
        select: () => b,
        eq: () => b,
        maybeSingle: () =>
          Promise.resolve(
            table === "businesses"
              ? { data: BIZ, error: null }
              : { data: null, error: null }
          ),
        insert: (row: any) => {
          inserts.push({ table, row });
          return Promise.resolve({ error: INSERT_ERROR });
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
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { POST } from "@/app/api/review-click/route";

function post(body: any) {
  return new NextRequest("http://localhost/api/review-click", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/review-click", () => {
  beforeEach(() => {
    BIZ = { id: "biz1" };
    INSERT_ERROR = null;
    inserts.length = 0;
  });

  it("slug valide → 200 + insertion", async () => {
    const res = await POST(post({ slug: "cafe" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(inserts).toEqual([
      { table: "review_clicks", row: { business_id: "biz1" } },
    ]);
  });

  it("slug absent → 400", async () => {
    const res = await POST(post({}));
    expect(res.status).toBe(400);
    expect(inserts).toHaveLength(0);
  });

  it("commerce inconnu → 404", async () => {
    BIZ = null;
    const res = await POST(post({ slug: "inconnu" }));
    expect(res.status).toBe(404);
  });

  it("table 0077 absente (42P01) → 200 (tolérant)", async () => {
    INSERT_ERROR = { code: "42P01" };
    const res = await POST(post({ slug: "cafe" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("autre erreur d'insertion → 500", async () => {
    INSERT_ERROR = { code: "23505" };
    const res = await POST(post({ slug: "cafe" }));
    expect(res.status).toBe(500);
  });
});
