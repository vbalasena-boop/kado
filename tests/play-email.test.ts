import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const state = vi.hoisted(() => ({
  insert: vi.fn(), rpc: vi.fn(), rateLimit: vi.fn(), send: vi.fn(),
}));
vi.mock("@/lib/supabase/admin", () => ({ getAdminClient: () => ({
  from: (table: string) => table === "play_email_challenges" ? { insert: state.insert } : {
    select: () => ({ eq: () => ({ maybeSingle: async () => ({ data: { id: "biz1", status: "active" }, error: null }) }) }),
  }, rpc: state.rpc,
}) }));
vi.mock("@/lib/rate-limit", async (original) => ({
  ...await original<typeof import("@/lib/rate-limit")>(), rateLimit: state.rateLimit,
}));
vi.mock("@/lib/email", () => ({ sendPlayEmailCode: state.send }));
vi.mock("@/lib/report", () => ({ reportError: vi.fn() }));
import { POST as send } from "@/app/api/play-email/send/route";
import { POST as verify } from "@/app/api/play-email/verify/route";
import { normalizePlayEmail, playEmailHash, playEmailCodeHash, readPlayEmailToken, signPlayEmailToken } from "@/lib/play-email";

function request(body: object) {
  return new NextRequest("http://localhost/api/play-email", { method: "POST", body: JSON.stringify(body) });
}
const id = "00000000-0000-4000-8000-000000000001";
beforeEach(() => {
  vi.useRealTimers();
  vi.clearAllMocks();
  state.insert.mockResolvedValue({ error: null });
  state.rateLimit.mockResolvedValue(true);
  state.send.mockResolvedValue({ ok: true });
  state.rpc.mockResolvedValue({ data: null, error: null });
});

describe("Identité anti-rejeu", () => {
  it("normalise casse, tags et alias Gmail uniquement pour les points", () => {
    expect(normalizePlayEmail(" Jean.Dupont+jeu@GoogleMail.com ")).toBe("jeandupont@gmail.com");
    expect(playEmailHash("Jean.Dupont+jeu@gmail.com")).toBe(playEmailHash("jeandupont@gmail.com"));
    expect(normalizePlayEmail("Jean.Dupont+jeu@example.com")).toBe("jean.dupont@example.com");
    expect(playEmailHash("one@example.com")).not.toBe(playEmailHash("two@example.com"));
    expect(playEmailHash("one@example.com")).toMatch(/^[a-f0-9]{64}$/);
  });
  it("refuse un jeton altéré, d'un autre commerce, ou expiré", () => {
    vi.useFakeTimers();
    const hash = playEmailHash("one@example.com");
    const token = signPlayEmailToken("biz1", hash);
    expect(readPlayEmailToken(token, "biz1")).toBe(hash);
    expect(readPlayEmailToken(token, "biz2")).toBeNull();
    expect(readPlayEmailToken(token + "x", "biz1")).toBeNull();
    expect(readPlayEmailToken(token + ".extra", "biz1")).toBeNull();
    vi.advanceTimersByTime(600_000);
    expect(readPlayEmailToken(token, "biz1")).toBeNull();
  });
});

describe("Envoi du code", () => {
  it("envoie six chiffres, stocke seulement les HMAC et expire dans 10 minutes", async () => {
    const start = Date.now();
    const res = await send(request({ slug: "cafe", email: "Jean.Dupont+jeu@gmail.com" }));
    expect(res.status).toBe(200);
    const { challengeId } = await res.json();
    const [email, code] = state.send.mock.calls[0];
    expect(email).toBe("Jean.Dupont+jeu@gmail.com");
    expect(code).toMatch(/^\d{6}$/);
    const row = state.insert.mock.calls[0][0];
    expect(row).toEqual({ id: challengeId, business_id: "biz1", email_hash: playEmailHash(email), code_hash: playEmailCodeHash(challengeId, code), expires_at: expect.any(String) });
    expect(Date.parse(row.expires_at)).toBeGreaterThanOrEqual(start + 600_000);
    expect(Date.parse(row.expires_at)).toBeLessThanOrEqual(Date.now() + 600_000);
    expect(JSON.stringify(row)).not.toContain(email);
    expect(state.rateLimit).toHaveBeenCalledWith(`play-email-send:biz1:${playEmailHash(email)}`, 3, 3600);
  });
  it("bloque le quatrième envoi, y compris les variantes de la même adresse", async () => {
    let count = 0;
    state.rateLimit.mockImplementation(async () => ++count <= 3);
    for (const email of ["a.b@gmail.com", "ab+1@gmail.com", "ab@googlemail.com"]) {
      expect((await send(request({ slug: "cafe", email }))).status).toBe(200);
    }
    expect((await send(request({ slug: "cafe", email: "ab+2@gmail.com" }))).status).toBe(429);
    expect(state.send).toHaveBeenCalledTimes(3);
    expect(new Set(state.rateLimit.mock.calls.map(([key]) => key)).size).toBe(1);
  });
  it("ne prétend pas avoir envoyé si l'enregistrement ou le prestataire échoue", async () => {
    state.insert.mockResolvedValueOnce({ error: { message: "offline" } });
    expect((await send(request({ slug: "cafe", email: "a@example.com" }))).status).toBe(503);
    expect(state.send).not.toHaveBeenCalled();
    state.send.mockResolvedValueOnce({ ok: false });
    expect((await send(request({ slug: "cafe", email: "a@example.com" }))).status).toBe(503);
  });
});

describe("Vérification du code — contrat de la RPC atomique", () => {
  it("ne signe qu'après succès de la RPC, liée au commerce et au challenge", async () => {
    const hash = playEmailHash("a@example.com");
    state.rpc.mockResolvedValue({ data: hash, error: null });
    const res = await verify(request({ slug: "cafe", challengeId: id, code: "123456" }));
    expect(res.status).toBe(200);
    expect(readPlayEmailToken((await res.json()).token, "biz1")).toBe(hash);
    expect(state.rpc).toHaveBeenCalledWith("verify_play_email_challenge", { p_id: id, p_business_id: "biz1", p_code_hash: playEmailCodeHash(id, "123456") });
  });
  it("refuse cinq erreurs puis le bon code quand la RPC verrouille le challenge", async () => {
    // Double du contrat SQL : la vérification SQL réelle reste à lancer par Claude.
    let attempts = 0;
    state.rpc.mockImplementation(async (_name, args) => {
      if (attempts >= 5) return { data: null, error: null };
      attempts++;
      return { data: args.p_code_hash === playEmailCodeHash(id, "123456") ? playEmailHash("a@example.com") : null, error: null };
    });
    for (let i = 0; i < 5; i++) expect((await verify(request({ slug: "cafe", challengeId: id, code: "000000" }))).status).toBe(400);
    const res = await verify(request({ slug: "cafe", challengeId: id, code: "123456" }));
    expect(res.status).toBe(400);
    expect((await res.json()).token).toBeUndefined();
  });
  it("refuse un code expiré ou déjà consommé, et échoue fermé sur panne SQL", async () => {
    const res = await verify(request({ slug: "cafe", challengeId: id, code: "123456" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "invalid_or_expired_code" });
    state.rpc.mockResolvedValueOnce({ data: null, error: { message: "offline" } });
    expect((await verify(request({ slug: "cafe", challengeId: id, code: "123456" }))).status).toBe(503);
  });
});
