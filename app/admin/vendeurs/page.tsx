import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import VendeursClient, { AffiliateRow } from "./VendeursClient";

export const dynamic = "force-dynamic";

export default async function VendeursPage() {
  const user = await getAdminUser();
  if (!user) return null; // le layout gère l'accès refusé

  const db = getAdminClient();

  // Lecture tolérante : la table peut ne pas exister (migration 0032 pas
  // encore passée) → on affiche la marche à suivre.
  let tableMissing = false;
  let affiliates: any[] = [];
  try {
    const { data, error } = await db
      .from("affiliates")
      .select(
        "id, name, email, code, active, commission_roue_cents, commission_fidelite_cents, commission_complet_cents, created_at"
      )
      .order("created_at", { ascending: true });
    if (error) tableMissing = true;
    else affiliates = data ?? [];
  } catch {
    tableMissing = true;
  }

  let referred: {
    id: string;
    name: string;
    subscription_status: string;
    affiliate_id: string;
  }[] = [];
  let commissions: {
    affiliate_id: string;
    business_id: string;
    amount_cents: number;
    status: string;
    created_at: string;
  }[] = [];
  if (!tableMissing) {
    try {
      const { data } = await db
        .from("businesses")
        .select("id, name, subscription_status, affiliate_id")
        .not("affiliate_id", "is", null);
      referred = (data as any[]) ?? [];
    } catch {
      referred = [];
    }
    try {
      const { data } = await db
        .from("affiliate_commissions")
        .select("affiliate_id, business_id, amount_cents, status, created_at");
      commissions = (data as any[]) ?? [];
    } catch {
      commissions = [];
    }
  }

  // Exigible = client toujours actif ET ~2e prélèvement passé (30 jours).
  const THIRTY_DAYS = 30 * 864e5;
  const bizStatus = new Map(referred.map((b) => [b.id, b.subscription_status]));
  const isActiveBiz = (id: string) =>
    ["active", "trial"].includes(bizStatus.get(id) ?? "");

  const rows: AffiliateRow[] = affiliates.map((a) => {
    const mine = referred.filter((b) => b.affiliate_id === a.id);
    const myComms = commissions.filter((c) => c.affiliate_id === a.id);
    return {
      id: a.id,
      name: a.name,
      email: a.email,
      code: a.code,
      active: a.active,
      commissionRoue: a.commission_roue_cents / 100,
      commissionFidelite: a.commission_fidelite_cents / 100,
      commissionComplet: a.commission_complet_cents / 100,
      totalClients: mine.length,
      trialClients: mine.filter((b) => b.subscription_status === "trial").length,
      paidClients: myComms.filter((c) => c.status !== "canceled").length,
      exigibleCents: myComms
        .filter(
          (c) =>
            c.status === "due" &&
            isActiveBiz(c.business_id) &&
            Date.now() - new Date(c.created_at).getTime() >= THIRTY_DAYS
        )
        .reduce((s, c) => s + c.amount_cents, 0),
      pendingCents: myComms
        .filter(
          (c) =>
            c.status === "due" &&
            isActiveBiz(c.business_id) &&
            Date.now() - new Date(c.created_at).getTime() < THIRTY_DAYS
        )
        .reduce((s, c) => s + c.amount_cents, 0),
      lapsedCents: myComms
        .filter((c) => c.status === "due" && !isActiveBiz(c.business_id))
        .reduce((s, c) => s + c.amount_cents, 0),
      paidCents: myComms
        .filter((c) => c.status === "paid")
        .reduce((s, c) => s + c.amount_cents, 0),
    };
  });

  return <VendeursClient rows={rows} tableMissing={tableMissing} />;
}
