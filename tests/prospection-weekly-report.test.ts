import { describe, it, expect } from "vitest";
import { maybeSendWeeklyReport } from "@/lib/prospection/weekly-report";

describe("maybeSendWeeklyReport (créneau lundi)", () => {
  it("ne fait rien un jour qui n'est pas lundi (aucun accès DB)", async () => {
    // 2026-08-25 est un mardi (UTC).
    expect(await maybeSendWeeklyReport(new Date("2026-08-25T09:00:00Z"))).toBe(false);
    // 2026-08-27 est un jeudi.
    expect(await maybeSendWeeklyReport(new Date("2026-08-27T09:00:00Z"))).toBe(false);
  });
});
