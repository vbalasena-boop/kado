import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { POST } from "@/app/api/lead/route";

vi.mock("@/lib/rate-limit", () => ({
  rateLimit: vi.fn().mockResolvedValue(true),
  clientIp: vi.fn().mockReturnValue("127.0.0.1"),
}));

vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: vi.fn() }));

describe("POST /api/lead", () => {
  const from = vi.mocked(getAdminClient);

  beforeEach(() => vi.clearAllMocks());

  it("requires affirmative consent before storing an email", async () => {
    const response = await POST(new NextRequest("http://localhost/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "cafe", email: "client@example.com" }),
    }));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "consent_required" });
    expect(from).not.toHaveBeenCalled();
  });

  it("normalizes the email and stores it only with consent", async () => {
    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "business-1" } });
    const db = {
      from: vi.fn((table: string) => table === "businesses"
        ? { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle })) })) }
        : { insert }),
    };
    vi.mocked(getAdminClient).mockReturnValue(db as any);

    const response = await POST(new NextRequest("http://localhost/api/lead", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ slug: "cafe", email: " Client@Example.COM ", consent: true }),
    }));

    expect(response.status).toBe(200);
    expect(insert).toHaveBeenCalledWith({
      business_id: "business-1",
      email: "client@example.com",
      phone: null,
      marketing_consented_at: expect.any(String),
      consent_source: "game_email_form",
    });
  });
});
