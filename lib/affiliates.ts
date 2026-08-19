import type { SupabaseClient } from "@supabase/supabase-js";

/** Barème par défaut (centimes) : ≈ 1er mois arrondi, versé après le 2e
 *  prélèvement du client. */
export const DEFAULT_COMMISSIONS = {
  roue: 3000,
  fidelite: 2000,
  complet: 4500,
};

export type AffiliateStats = {
  totalClients: number;
  trialClients: number;
  paidClients: number;
  exigibleCents: number;
  pendingCents: number;
  paidCents: number;
};

const THIRTY_DAYS = 30 * 864e5;

/** Stats d'un vendeur : clients amenés + commissions, mêmes règles que
 *  l'admin (exigible = client actif ET ~2e prélèvement passé). */
export async function getAffiliateStats(
  db: SupabaseClient,
  affiliateId: string
): Promise<AffiliateStats> {
  let referred: { id: string; subscription_status: string }[] = [];
  let comms: {
    business_id: string;
    amount_cents: number;
    status: string;
    created_at: string;
  }[] = [];
  try {
    const { data } = await db
      .from("businesses")
      .select("id, subscription_status")
      .eq("affiliate_id", affiliateId);
    referred = (data as any[]) ?? [];
  } catch {
    referred = [];
  }
  try {
    const { data } = await db
      .from("affiliate_commissions")
      .select("business_id, amount_cents, status, created_at")
      .eq("affiliate_id", affiliateId);
    comms = (data as any[]) ?? [];
  } catch {
    comms = [];
  }

  const bizStatus = new Map(referred.map((b) => [b.id, b.subscription_status]));
  const isActiveBiz = (id: string) =>
    ["active", "trial"].includes(bizStatus.get(id) ?? "");
  const sum = (rows: { amount_cents: number }[]) =>
    rows.reduce((s, c) => s + c.amount_cents, 0);

  return {
    totalClients: referred.length,
    trialClients: referred.filter((b) => b.subscription_status === "trial")
      .length,
    paidClients: comms.filter((c) => c.status !== "canceled").length,
    exigibleCents: sum(
      comms.filter(
        (c) =>
          c.status === "due" &&
          isActiveBiz(c.business_id) &&
          Date.now() - new Date(c.created_at).getTime() >= THIRTY_DAYS
      )
    ),
    pendingCents: sum(
      comms.filter(
        (c) =>
          c.status === "due" &&
          isActiveBiz(c.business_id) &&
          Date.now() - new Date(c.created_at).getTime() < THIRTY_DAYS
      )
    ),
    paidCents: sum(comms.filter((c) => c.status === "paid")),
  };
}

/** Nettoie un code de lien vendeur (?ref=...). */
export function cleanAffiliateCode(raw: string): string {
  return (raw || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9_-]/g, "")
    .slice(0, 40);
}
