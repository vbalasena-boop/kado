import { describe, it, expect } from "vitest";
import { isPickupReminderEligible } from "@/lib/pickup-reminder";

const NOW = Date.parse("2026-08-27T12:00:00Z");
const minAgo = (n: number) => new Date(NOW - n * 60000).toISOString();
const push = { endpoint: "https://x", p256dh: "a", auth: "b" };

const base = {
  status: "ready",
  notified_ready_at: minAgo(20),
  picked_up_at: null,
  pickup_reminder_at: null,
  notify_push: push,
};

describe("isPickupReminderEligible", () => {
  it("prête depuis > 15 min, non récupérée, jamais relancée, push actif → éligible", () => {
    expect(isPickupReminderEligible(base, NOW)).toBe(true);
  });
  it("prête depuis peu (< 15 min) → non éligible", () => {
    expect(
      isPickupReminderEligible({ ...base, notified_ready_at: minAgo(5) }, NOW)
    ).toBe(false);
  });
  it("client a confirmé le retrait → non éligible", () => {
    expect(
      isPickupReminderEligible({ ...base, picked_up_at: minAgo(2) }, NOW)
    ).toBe(false);
  });
  it("déjà relancée → non éligible", () => {
    expect(
      isPickupReminderEligible({ ...base, pickup_reminder_at: minAgo(1) }, NOW)
    ).toBe(false);
  });
  it("sans alerte push → non éligible (rien à envoyer)", () => {
    expect(isPickupReminderEligible({ ...base, notify_push: null }, NOW)).toBe(
      false
    );
  });
  it("plus « prête » (déjà remise) → non éligible", () => {
    expect(isPickupReminderEligible({ ...base, status: "done" }, NOW)).toBe(
      false
    );
  });
});
