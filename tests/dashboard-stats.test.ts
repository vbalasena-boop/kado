import { describe, it, expect } from "vitest";
import {
  computePlayStats,
  computeLoyaltyStats,
  playStatsFromRpc,
  loyaltyStatsFromRpc,
  redemptionRateOf,
  finalizePlayStats,
} from "@/lib/dashboard-stats";

const SINCE = "2026-08-01T00:00:00.000Z";

describe("computePlayStats", () => {
  const rows = [
    // gagné (instagram, dans les 30 j, récupéré)
    { play_type: "instagram", prize_label: "Café offert", created_at: "2026-08-20T10:00:00Z", redeemed_at: "2026-08-21T10:00:00Z" },
    // gagné (review, hors 30 j, non récupéré)
    { play_type: "review", prize_label: "Café offert", created_at: "2026-07-01T10:00:00Z", redeemed_at: null },
    // perdant (libellé contient « rien », insensible casse)
    { play_type: "instagram", prize_label: "Rien pour cette fois", created_at: "2026-08-22T10:00:00Z", redeemed_at: null },
    // libellé nul → compté comme GAGNÉ (comportement historique)
    { play_type: "review", prize_label: null, created_at: "2026-08-23T10:00:00Z", redeemed_at: null },
  ];

  it("compte total / canaux / 30 jours", () => {
    const s = computePlayStats(rows, SINCE);
    expect(s.total).toBe(4);
    expect(s.insta).toBe(2);
    expect(s.review).toBe(2);
    expect(s.last30).toBe(3); // tout sauf le 2026-07-01
  });

  it("won exclut UNIQUEMENT les libellés contenant « rien » ; null compte", () => {
    const s = computePlayStats(rows, SINCE);
    expect(s.won).toBe(3); // 2 cafés + 1 libellé nul ; le « Rien... » exclu
    expect(s.redeemed).toBe(1);
    expect(s.redemptionRate).toBe(Math.round((1 / 3) * 100)); // 33
  });

  it("distribution ignore les libellés nuls, triée par fréquence puis libellé", () => {
    const s = computePlayStats(rows, SINCE);
    expect(s.distribution).toEqual([
      ["Café offert", 2],
      ["Rien pour cette fois", 1],
    ]);
  });

  it("jeu vide → tout à zéro, taux 0", () => {
    const s = computePlayStats([], SINCE);
    expect(s).toEqual({
      total: 0, insta: 0, review: 0, last30: 0, won: 0, redeemed: 0,
      redemptionRate: 0, distribution: [],
    });
  });

  it("départage les ex æquo de distribution de façon déterministe", () => {
    const s = computePlayStats(
      [
        { prize_label: "Banane" },
        { prize_label: "Avocat" },
      ],
      SINCE
    );
    expect(s.distribution).toEqual([["Avocat", 1], ["Banane", 1]]);
  });
});

describe("redemptionRateOf", () => {
  it("0 si aucun gagnant (pas de division par zéro)", () => {
    expect(redemptionRateOf(0, 0)).toBe(0);
    expect(redemptionRateOf(0, 5)).toBe(0);
  });
  it("arrondit", () => {
    expect(redemptionRateOf(3, 1)).toBe(33);
    expect(redemptionRateOf(2, 1)).toBe(50);
  });
});

describe("computeLoyaltyStats", () => {
  it("compte les cartes et somme tampons/récompenses (nuls = 0)", () => {
    const s = computeLoyaltyStats([
      { stamps: 3, rewards_earned: 1 },
      { stamps: null, rewards_earned: 2 },
      { stamps: 5 },
    ]);
    expect(s).toEqual({ cards: 3, stamps: 8, rewards: 3 });
  });
  it("aucune carte → zéros", () => {
    expect(computeLoyaltyStats([])).toEqual({ cards: 0, stamps: 0, rewards: 0 });
  });
});

describe("playStatsFromRpc", () => {
  it("normalise la sortie JSON de la RPC (nombres, distribution)", () => {
    const s = playStatsFromRpc({
      total: 4, insta: 2, review: 2, last30: 3, won: 3, redeemed: 1,
      distribution: [["Café offert", 2], ["Rien pour cette fois", 1]],
    });
    expect(s?.total).toBe(4);
    expect(s?.won).toBe(3);
    expect(s?.redemptionRate).toBe(33);
    expect(s?.distribution).toEqual([["Café offert", 2], ["Rien pour cette fois", 1]]);
  });

  it("coerce des compteurs en chaîne (bigint JSON) et ignore une distribution absente", () => {
    const s = playStatsFromRpc({ total: "10", won: "7", redeemed: "0" });
    expect(s?.total).toBe(10);
    expect(s?.won).toBe(7);
    expect(s?.distribution).toEqual([]);
  });

  it("renvoie null sur une entrée non exploitable", () => {
    expect(playStatsFromRpc(null)).toBeNull();
    expect(playStatsFromRpc("nope")).toBeNull();
  });

  it("produit le MÊME résultat que le repli JS pour des compteurs équivalents", () => {
    const rows = [
      { play_type: "instagram", prize_label: "Café offert", created_at: "2026-08-20T10:00:00Z", redeemed_at: "2026-08-21T10:00:00Z" },
      { play_type: "review", prize_label: "Café offert", created_at: "2026-07-01T10:00:00Z", redeemed_at: null },
      { play_type: "instagram", prize_label: "Rien", created_at: "2026-08-22T10:00:00Z", redeemed_at: null },
      { play_type: "review", prize_label: null, created_at: "2026-08-23T10:00:00Z", redeemed_at: null },
    ];
    const js = computePlayStats(rows, SINCE);
    const rpc = playStatsFromRpc({
      total: js.total, insta: js.insta, review: js.review, last30: js.last30,
      won: js.won, redeemed: js.redeemed, distribution: js.distribution,
    });
    expect(rpc).toEqual(js);
  });
});

describe("loyaltyStatsFromRpc", () => {
  it("normalise et coerce", () => {
    expect(loyaltyStatsFromRpc({ cards: "3", stamps: "8", rewards: 3 })).toEqual({
      cards: 3, stamps: 8, rewards: 3,
    });
  });
  it("null sur entrée invalide", () => {
    expect(loyaltyStatsFromRpc(undefined)).toBeNull();
  });
});

describe("finalizePlayStats", () => {
  it("ajoute le taux et trie la distribution sans muter l'entrée", () => {
    const input = { total: 2, insta: 0, review: 0, last30: 0, won: 2, redeemed: 1, distribution: [["B", 1], ["A", 1]] as [string, number][] };
    const out = finalizePlayStats(input);
    expect(out.redemptionRate).toBe(50);
    expect(out.distribution).toEqual([["A", 1], ["B", 1]]);
    // entrée non mutée
    expect(input.distribution).toEqual([["B", 1], ["A", 1]]);
  });
});
