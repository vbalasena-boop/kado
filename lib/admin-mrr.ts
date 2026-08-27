/**
 * Revenu récurrent (MRR) et santé de l'abonnement — logique PURE (testable).
 *
 * Les prix vivent chez Stripe ; on en tient ici une copie pour le pilotage
 * interne (tableau de bord admin). À garder synchronisée avec la page /tarifs.
 */

export const PLAN_PRICE_EUR: Record<string, number> = {
  roue: 29,
  fidelite: 19,
  complet: 44,
  comptoir: 19,
};
export const ADDON_CAMPAIGNS_EUR = 15; // option « Campagnes »
export const ADDON_COMPTOIR_EUR = 12; // option « Suivi au comptoir »

export type MrrBusiness = {
  status?: string | null;
  subscription_status?: string | null;
  plan?: string | null;
  campaigns_addon?: boolean | null;
  order_tracking?: boolean | null;
};

/**
 * MRR (€/mois) d'un commerce. Ne compte QUE les abonnements réellement payants
 * (`subscription_status === 'active'`, non suspendus) : les essais et comptes
 * sans abonnement valent 0.
 */
export function businessMrrEur(b: MrrBusiness): number {
  if (b.status === "suspended") return 0;
  if (b.subscription_status !== "active") return 0;
  const base = (b.plan && PLAN_PRICE_EUR[b.plan]) || 0;
  return (
    base +
    (b.campaigns_addon ? ADDON_CAMPAIGNS_EUR : 0) +
    (b.order_tracking ? ADDON_COMPTOIR_EUR : 0)
  );
}

export type MrrSummary = {
  mrrEur: number;
  arrEur: number; // MRR × 12
  payingCount: number;
  byPlan: Record<string, number>; // MRR par formule
};

/** Agrège le MRR d'un ensemble de commerces. */
export function summarizeMrr(businesses: MrrBusiness[]): MrrSummary {
  let mrrEur = 0;
  let payingCount = 0;
  const byPlan: Record<string, number> = {};
  for (const b of businesses) {
    const m = businessMrrEur(b);
    if (m > 0) {
      mrrEur += m;
      payingCount++;
      const key = b.plan || "inconnu";
      byPlan[key] = (byPlan[key] ?? 0) + m;
    }
  }
  return { mrrEur, arrEur: mrrEur * 12, payingCount, byPlan };
}
