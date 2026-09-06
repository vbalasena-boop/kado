import { describe, it, expect, vi } from "vitest";
import { isMissingColumnError, selectTolerant } from "@/lib/db-errors";

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

describe("selectTolerant", () => {
  it("premier palier OK → renvoie ses données, pas d'appel au repli", async () => {
    const build = vi.fn(async (_cols: string) => ({
      data: [{ id: "a" }],
      error: null,
    }));
    const { data, error } = await selectTolerant(build, ["wide", "narrow"]);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "a" }]);
    expect(build).toHaveBeenCalledTimes(1);
    expect(build).toHaveBeenCalledWith("wide");
  });

  it("colonne absente sur le large → repli sur l'étroit", async () => {
    const build = vi.fn(async (cols: string) =>
      cols === "wide"
        ? { data: null, error: { code: "42703" } }
        : { data: [{ id: "b" }], error: null }
    );
    const { data, error } = await selectTolerant(build, ["wide", "narrow"]);
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "b" }]);
    expect(build).toHaveBeenCalledTimes(2);
    expect(build).toHaveBeenNthCalledWith(2, "narrow");
  });

  it("erreur non « colonne absente » (RLS) → s'arrête et renvoie l'erreur, sans repli", async () => {
    const build = vi.fn(async (_cols: string) => ({
      data: null,
      error: { code: "42501" },
    }));
    const { data, error } = await selectTolerant(build, ["wide", "narrow"]);
    expect(data).toBeNull();
    expect(error).toEqual({ code: "42501" });
    // On ne retente PAS avec moins de colonnes sur une vraie panne.
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("tous les paliers en colonne absente → renvoie la dernière erreur", async () => {
    const build = vi.fn(async (_cols: string) => ({
      data: null,
      error: { code: "42P01" },
    }));
    const { data, error } = await selectTolerant(build, ["wide", "narrow"]);
    expect(data).toBeNull();
    expect(error).toEqual({ code: "42P01" });
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("data null au succès → normalisé en null", async () => {
    const build = vi.fn(async (_cols: string) => ({ data: null, error: null }));
    const { data, error } = await selectTolerant(build, ["wide"]);
    expect(error).toBeNull();
    expect(data).toBeNull();
  });
});
