import { describe, it, expect } from "vitest";
import { isMissingColumnError } from "@/lib/db-errors";

// Matrice du helper : on ne « tolère » (ignore) QUE colonne/table absente.
describe("isMissingColumnError", () => {
  it("colonne absente (42703) → true", () => {
    expect(isMissingColumnError({ code: "42703" })).toBe(true);
  });

  it("table absente (42P01) → true", () => {
    expect(isMissingColumnError({ code: "42P01" })).toBe(true);
  });

  it("cache PostgREST (PGRST204) → true", () => {
    expect(isMissingColumnError({ code: "PGRST204" })).toBe(true);
  });

  it("contrainte unique (23505) → false", () => {
    expect(isMissingColumnError({ code: "23505" })).toBe(false);
  });

  it("RLS (42501) → false", () => {
    expect(isMissingColumnError({ code: "42501" })).toBe(false);
  });

  it("erreur sans code (message seul) → false", () => {
    expect(isMissingColumnError({ message: "boom" })).toBe(false);
  });

  it("null → false", () => {
    expect(isMissingColumnError(null)).toBe(false);
  });

  it("undefined → false", () => {
    expect(isMissingColumnError(undefined)).toBe(false);
  });

  it("code non-string → false", () => {
    expect(isMissingColumnError({ code: 42703 })).toBe(false);
  });
});
