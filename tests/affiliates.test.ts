import { describe, it, expect } from "vitest";
import {
  cleanAffiliateCode,
  getAffiliateStats,
  DEFAULT_COMMISSIONS,
} from "@/lib/affiliates";

describe("cleanAffiliateCode", () => {
  it("normalise un nom en code de lien", () => {
    expect(cleanAffiliateCode("Paul Martin")).toBe("paul-martin");
    expect(cleanAffiliateCode("  Édith! ")).toBe("dith");
    expect(cleanAffiliateCode("PAUL_02")).toBe("paul_02");
  });
  it("rejette les caractères dangereux et borne la longueur", () => {
    expect(cleanAffiliateCode("<script>alert(1)</script>")).toBe(
      "scriptalert1script"
    );
    expect(cleanAffiliateCode("a".repeat(100))).toHaveLength(40);
    expect(cleanAffiliateCode("")).toBe("");
  });
});

/** Stub minimal du client Supabase pour la logique de stats. */
function stubDb(opts: {
  businesses: { id: string; subscription_status: string }[];
  commissions: {
    business_id: string;
    amount_cents: number;
    status: string;
    created_at: string;
  }[];
}) {
  return {
    from(table: string) {
      const data =
        table === "businesses" ? opts.businesses : opts.commissions;
      return {
        select() {
          return { eq: async () => ({ data }) };
        },
      };
    },
  } as any;
}

const daysAgo = (n: number) =>
  new Date(Date.now() - n * 864e5).toISOString();

describe("getAffiliateStats", () => {
  it("classe les commissions : exigible / en attente / versée", async () => {
    const db = stubDb({
      businesses: [
        { id: "A", subscription_status: "active" },
        { id: "B", subscription_status: "active" },
        { id: "C", subscription_status: "trial" },
        { id: "D", subscription_status: "suspended" },
      ],
      commissions: [
        // A : client actif, 2e prélèvement passé → exigible
        { business_id: "A", amount_cents: 3000, status: "due", created_at: daysAgo(35) },
        // B : client actif mais trop récent → en attente
        { business_id: "B", amount_cents: 4500, status: "due", created_at: daysAgo(5) },
        // D : client parti → ni exigible ni en attente (caduque côté admin)
        { business_id: "D", amount_cents: 2000, status: "due", created_at: daysAgo(10) },
        // A : une commission déjà versée
        { business_id: "A", amount_cents: 3000, status: "paid", created_at: daysAgo(90) },
        // annulée : ignorée des payants
        { business_id: "D", amount_cents: 2000, status: "canceled", created_at: daysAgo(60) },
      ],
    });
    const s = await getAffiliateStats(db, "aff-1");
    expect(s.totalClients).toBe(4);
    expect(s.trialClients).toBe(1);
    expect(s.paidClients).toBe(4); // toutes sauf l'annulée
    expect(s.exigibleCents).toBe(3000);
    expect(s.pendingCents).toBe(4500);
    expect(s.paidCents).toBe(3000);
  });

  it("reste à zéro sans clients ni commissions", async () => {
    const s = await getAffiliateStats(
      stubDb({ businesses: [], commissions: [] }),
      "aff-2"
    );
    expect(s).toEqual({
      totalClients: 0,
      trialClients: 0,
      paidClients: 0,
      exigibleCents: 0,
      pendingCents: 0,
      paidCents: 0,
    });
  });
});

describe("barème par défaut", () => {
  it("vaut 30/20/45 € (paiement unique, après le 2e prélèvement)", () => {
    expect(DEFAULT_COMMISSIONS.roue).toBe(3000);
    expect(DEFAULT_COMMISSIONS.fidelite).toBe(2000);
    expect(DEFAULT_COMMISSIONS.complet).toBe(4500);
  });
});
