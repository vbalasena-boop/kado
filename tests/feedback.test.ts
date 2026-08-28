import { describe, it, expect } from "vitest";
import { sanitizeFeedback } from "@/lib/feedback";

describe("sanitizeFeedback", () => {
  it("message valide + e-mail valide", () => {
    expect(sanitizeFeedback({ message: "Trop d'attente", email: "A@B.FR" })).toEqual({
      ok: true,
      message: "Trop d'attente",
      email: "a@b.fr",
    });
  });
  it("message vide → rejeté", () => {
    expect(sanitizeFeedback({ message: "   " })).toEqual({ ok: false });
  });
  it("e-mail invalide → ignoré, pas d'échec", () => {
    const r = sanitizeFeedback({ message: "ok", email: "xx" });
    expect(r).toEqual({ ok: true, message: "ok", email: null });
  });
  it("message trop long → tronqué à 1000", () => {
    const r = sanitizeFeedback({ message: "a".repeat(5000) });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.message.length).toBe(1000);
  });
});
