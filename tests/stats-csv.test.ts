import { describe, it, expect } from "vitest";
import { playsToCsv, playActionLabel } from "@/lib/stats-csv";

describe("playActionLabel", () => {
  it("libellés français des actions, repli sur la valeur brute", () => {
    expect(playActionLabel("instagram")).toBe("Instagram");
    expect(playActionLabel("loyalty")).toBe("Fidélité");
    expect(playActionLabel("optin")).toBe("Offres e-mail");
    expect(playActionLabel("review")).toBe("Avis (ancien)");
    expect(playActionLabel("banana")).toBe("banana");
  });
});

describe("playsToCsv", () => {
  it("en-tête + une ligne par tour, gagné/perdu, récupération, échappement", () => {
    const csv = playsToCsv([
      {
        created_at: "2026-09-01T10:00:00.000Z",
        play_type: "instagram",
        prize_label: 'Café "maison"',
        prize_code: "ABC123",
        is_losing: false,
        redeemed_at: "2026-09-02T12:00:00.000Z",
      },
      {
        created_at: "2026-09-01T11:00:00.000Z",
        play_type: "optin",
        prize_label: "Rien cette fois",
        prize_code: "ZZZ999",
        is_losing: true,
        redeemed_at: null,
      },
    ]);
    const lines = csv.split("\n");
    expect(lines[0]).toBe('"date","action","lot","resultat","code","recupere"');
    // Guillemets doublés dans le lot ; gagné ; date de récupération présente.
    expect(lines[1]).toContain('"Café ""maison"""');
    expect(lines[1]).toContain('"Instagram"');
    expect(lines[1]).toContain('"gagné"');
    expect(lines[1]).toContain('"2026-09-02T12:00:00.000Z"');
    // Perdu ; pas de récupération (champ vide en fin de ligne).
    expect(lines[2]).toContain('"perdu"');
    expect(lines[2].endsWith('""')).toBe(true);
  });

  it("résultat déduit du libellé si `is_losing` absent", () => {
    const csv = playsToCsv([
      { created_at: "2026-09-01T10:00:00.000Z", play_type: "loyalty", prize_label: "Rien", prize_code: null },
    ]);
    expect(csv.split("\n")[1]).toContain('"perdu"');
  });
});
