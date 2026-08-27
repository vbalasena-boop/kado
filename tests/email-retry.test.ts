import { describe, it, expect } from "vitest";
import {
  isRetriableEmailStatus,
  emailBackoffMs,
  parseRetryAfterMs,
} from "@/lib/email";

describe("isRetriableEmailStatus", () => {
  it("réessaie sur 429, 408 et 5xx", () => {
    expect(isRetriableEmailStatus(429)).toBe(true);
    expect(isRetriableEmailStatus(408)).toBe(true);
    expect(isRetriableEmailStatus(500)).toBe(true);
    expect(isRetriableEmailStatus(503)).toBe(true);
  });
  it("n'insiste pas sur les erreurs client définitives", () => {
    expect(isRetriableEmailStatus(400)).toBe(false);
    expect(isRetriableEmailStatus(401)).toBe(false);
    expect(isRetriableEmailStatus(422)).toBe(false);
  });
});

describe("emailBackoffMs", () => {
  it("croît exponentiellement puis se borne", () => {
    expect(emailBackoffMs(1)).toBe(500);
    expect(emailBackoffMs(2)).toBe(1000);
    expect(emailBackoffMs(3)).toBe(2000);
    expect(emailBackoffMs(10)).toBe(4000); // borné
  });
});

describe("parseRetryAfterMs", () => {
  it("secondes → millisecondes (borné)", () => {
    expect(parseRetryAfterMs("2")).toBe(2000);
    expect(parseRetryAfterMs("100")).toBe(4000); // borné à 4s
  });
  it("null si absent ou illisible", () => {
    expect(parseRetryAfterMs(null)).toBeNull();
    expect(parseRetryAfterMs("bientôt")).toBeNull();
  });
});
