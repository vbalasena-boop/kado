import { describe, it, expect } from "vitest";
import { nextQueueState } from "@/lib/email-queue";

describe("nextQueueState", () => {
  it("envoi réussi → sent, tentative incrémentée", () => {
    expect(nextQueueState(0, true)).toEqual({ status: "sent", attempts: 1 });
  });

  it("clé absente (skipped) → failed d'emblée (inutile de réessayer)", () => {
    expect(nextQueueState(0, false, true)).toEqual({
      status: "failed",
      attempts: 1,
    });
  });

  it("échec passager → reste pending tant qu'il reste des tentatives", () => {
    expect(nextQueueState(0, false)).toEqual({ status: "pending", attempts: 1 });
    expect(nextQueueState(3, false)).toEqual({ status: "pending", attempts: 4 });
  });

  it("échec passager après 5 tentatives → failed", () => {
    expect(nextQueueState(4, false)).toEqual({ status: "failed", attempts: 5 });
  });
});
