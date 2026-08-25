import { describe, it, expect, vi, beforeEach } from "vitest";

// Vérifie le garde de sécurité du webhook Stripe : la signature DOIT être
// validée avant tout traitement.
const constructEvent = vi.fn();
vi.mock("@/lib/stripe", () => ({
  getStripe: () => ({ webhooks: { constructEvent } }),
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({}) }));
vi.mock("@/lib/email", () => ({
  sendEmail: async () => ({ ok: true }),
  emailLayout: () => "",
  getOwnerContact: async () => ({ email: null, businessName: null }),
}));
vi.mock("@/lib/report", () => ({ reportError: () => {} }));

import { POST } from "@/app/api/billing/webhook/route";

function req(body: string, headers: Record<string, string> = {}) {
  return new Request("http://localhost/api/billing/webhook", {
    method: "POST",
    body,
    headers,
  }) as any;
}

beforeEach(() => {
  constructEvent.mockReset();
  process.env.STRIPE_WEBHOOK_SECRET = "whsec_test";
});

describe("POST /api/billing/webhook — garde de signature", () => {
  it("500 si le secret webhook n'est pas configuré", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const res = await POST(req("{}", { "stripe-signature": "x" }));
    expect(res.status).toBe(500);
  });

  it("400 sans en-tête stripe-signature", async () => {
    const res = await POST(req("{}"));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("no_signature");
  });

  it("400 si la signature est invalide (constructEvent lève)", async () => {
    constructEvent.mockImplementation(() => {
      throw new Error("bad sig");
    });
    const res = await POST(req("{}", { "stripe-signature": "bad" }));
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad_signature");
  });

  it("accepte un événement correctement signé", async () => {
    constructEvent.mockReturnValue({ type: "ping", data: { object: {} } });
    const res = await POST(req("{}", { "stripe-signature": "good" }));
    expect(res.status).toBe(200);
    expect((await res.json()).received).toBe(true);
  });
});
