import { describe, it, expect } from "vitest";
import { leadsToCsv } from "@/lib/leads-csv";

describe("leadsToCsv", () => {
  it("produit l'en-tête même sans contact", () => {
    expect(leadsToCsv([])).toBe('"email","telephone","date"');
  });

  it("une ligne par contact, date en ISO, champs entre guillemets", () => {
    const csv = leadsToCsv([
      { email: "a@b.c", phone: "0600000000", created_at: "2026-08-01T10:00:00.000Z" },
    ]);
    expect(csv).toBe(
      '"email","telephone","date"\n"a@b.c","0600000000","2026-08-01T10:00:00.000Z"'
    );
  });

  it("remplace null par une chaîne vide", () => {
    const csv = leadsToCsv([
      { email: null, phone: null, created_at: "2026-08-01T10:00:00.000Z" },
    ]);
    expect(csv).toBe(
      '"email","telephone","date"\n"","","2026-08-01T10:00:00.000Z"'
    );
  });

  it("échappe les guillemets internes (doublage) — anti-injection de colonne", () => {
    const csv = leadsToCsv([
      { email: 'x","evil', phone: "", created_at: "2026-08-01T10:00:00.000Z" },
    ]);
    // Le guillemet est doublé, le champ reste un seul champ.
    expect(csv.split("\n")[1]).toBe(
      '"x"",""evil","","2026-08-01T10:00:00.000Z"'
    );
  });
});
