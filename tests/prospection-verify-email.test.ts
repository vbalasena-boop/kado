import { describe, it, expect } from "vitest";
import { isValidEmailFormat, verifyEmail } from "@/lib/prospection/verify-email";

describe("isValidEmailFormat", () => {
  it("accepte les adresses bien formées", () => {
    for (const e of ["a@b.fr", "contact@kado-pro.fr", "jean.dupont@mail.co.uk"]) {
      expect(isValidEmailFormat(e)).toBe(true);
    }
  });
  it("rejette les adresses mal formées", () => {
    for (const e of ["", "a@b", "abc", "a@@b.fr", "a b@c.fr", "@domaine.fr"]) {
      expect(isValidEmailFormat(e)).toBe(false);
    }
  });
});

describe("verifyEmail (verdict)", () => {
  it("bad_format sans lookup", async () => {
    expect(await verifyEmail("pasunemail")).toBe("bad_format");
  });
  it("ok quand le domaine a des MX", async () => {
    const v = await verifyEmail("x@exemple.fr", async () => [{ exchange: "mx.exemple.fr" }]);
    expect(v).toBe("ok");
  });
  it("no_mx quand la liste MX est vide", async () => {
    const v = await verifyEmail("x@exemple.fr", async () => []);
    expect(v).toBe("no_mx");
  });
  it("no_mx quand le domaine n'existe pas (ENOTFOUND)", async () => {
    const v = await verifyEmail("x@nexistepas.zzz", async () => {
      const err = new Error("not found") as NodeJS.ErrnoException;
      err.code = "ENOTFOUND";
      throw err;
    });
    expect(v).toBe("no_mx");
  });
  it("unknown sur erreur DNS transitoire (n'exclut pas)", async () => {
    const v = await verifyEmail("x@exemple.fr", async () => {
      const err = new Error("timeout") as NodeJS.ErrnoException;
      err.code = "ETIMEOUT";
      throw err;
    });
    expect(v).toBe("unknown");
  });
});
