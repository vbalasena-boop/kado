import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// Vérifie POST /api/order/arrived : prévient le comptoir que le client est là.
//  - slug+code valides → 200 + un push envoyé ;
//  - slug/code absent → 400 ;
//  - commerce/commande inconnus → 404 ;
//  - re-signalement rapproché (throttle par code) → 200 sans push.

let BIZ: any = { id: "biz1" };
let ORDER: any = { status: "ready", buzzer_no: 7 };
// Le rate-limit par CODE (clé « :code: ») ; le rate-limit externe (publicRoute)
// reste toujours passant pour isoler le throttle applicatif.
let CODE_OK = true;
const pushes: any[] = [];

function makeClient() {
  return {
    from(table: string) {
      const b: any = {
        select: () => b,
        eq: () => b,
        order: () => b,
        limit: () => b,
        maybeSingle: () =>
          Promise.resolve(
            table === "businesses" ? { data: BIZ } : { data: ORDER }
          ),
      };
      return b;
    },
  };
}

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: async (key: string) => (key.includes(":code:") ? CODE_OK : true),
  clientIp: () => "test-ip",
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => makeClient() }));
vi.mock("@/lib/push", () => ({
  sendPushToBusiness: async (_db: any, id: string, payload: any) => {
    pushes.push({ id, payload });
  },
}));

import { POST } from "@/app/api/order/arrived/route";

function post(body: any) {
  return new NextRequest("http://localhost/api/order/arrived", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
  });
}

describe("POST /api/order/arrived", () => {
  beforeEach(() => {
    BIZ = { id: "biz1" };
    ORDER = { status: "ready", buzzer_no: 7 };
    CODE_OK = true;
    pushes.length = 0;
  });

  it("slug+code valides → 200 + push au commerçant (avec le n° de bipeur)", async () => {
    const res = await POST(post({ slug: "cafe", code: "abc123" }));
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
    expect(pushes).toHaveLength(1);
    expect(pushes[0].payload.body).toContain("ABC123");
    expect(pushes[0].payload.body).toContain("n°7");
  });

  it("slug ou code manquant → 400", async () => {
    expect((await POST(post({ code: "abc123" }))).status).toBe(400);
    expect((await POST(post({ slug: "cafe" }))).status).toBe(400);
    expect(pushes).toHaveLength(0);
  });

  it("commerce inconnu → 404", async () => {
    BIZ = null;
    expect((await POST(post({ slug: "x", code: "abc123" }))).status).toBe(404);
  });

  it("commande inconnue → 404", async () => {
    ORDER = null;
    expect((await POST(post({ slug: "cafe", code: "zzz999" }))).status).toBe(404);
  });

  it("re-signalement rapproché (throttle) → 200 sans push", async () => {
    CODE_OK = false;
    const res = await POST(post({ slug: "cafe", code: "abc123" }));
    expect(res.status).toBe(200);
    expect((await res.json()).throttled).toBe(true);
    expect(pushes).toHaveLength(0);
  });
});
