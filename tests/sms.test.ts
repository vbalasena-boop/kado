import { describe, it, expect } from "vitest";
import { normalizeFrMobile } from "@/lib/sms";

describe("normalizeFrMobile", () => {
  it("format national 06/07 → 33…", () => {
    expect(normalizeFrMobile("0612345678")).toBe("33612345678");
    expect(normalizeFrMobile("0712345678")).toBe("33712345678");
  });

  it("ignore espaces, points et tirets", () => {
    expect(normalizeFrMobile("06 12 34 56 78")).toBe("33612345678");
    expect(normalizeFrMobile("06.12.34.56.78")).toBe("33612345678");
    expect(normalizeFrMobile("06-12-34-56-78")).toBe("33612345678");
  });

  it("format international +33 et 0033", () => {
    expect(normalizeFrMobile("+33612345678")).toBe("33612345678");
    expect(normalizeFrMobile("+33 6 12 34 56 78")).toBe("33612345678");
    expect(normalizeFrMobile("0033612345678")).toBe("33612345678");
  });

  it("déjà au bon format → inchangé", () => {
    expect(normalizeFrMobile("33612345678")).toBe("33612345678");
  });

  it("rejette un fixe (01–05) : on ne facture pas un SMS voué à l'échec", () => {
    expect(normalizeFrMobile("0123456789")).toBeNull();
    expect(normalizeFrMobile("0555555555")).toBeNull();
  });

  it("rejette les numéros mal formés", () => {
    expect(normalizeFrMobile("061234")).toBeNull(); // trop court
    expect(normalizeFrMobile("06123456789")).toBeNull(); // trop long
    expect(normalizeFrMobile("abc")).toBeNull();
    expect(normalizeFrMobile("")).toBeNull();
    expect(normalizeFrMobile(null)).toBeNull();
    expect(normalizeFrMobile(undefined)).toBeNull();
  });
});
