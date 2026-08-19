import { getAdminClient } from "@/lib/supabase/admin";
import StatsView, { VendorStatsData } from "./StatsView";

export const dynamic = "force-dynamic";
export const revalidate = 0;
export const metadata = {
  title: "Espace vendeur — Kado",
  robots: { index: false, follow: false },
};

function Unavailable() {
  return (
    <main className="landing">
      <div className="landing-card">
        <div className="landing-logo">🤝</div>
        <h1>Lien invalide</h1>
        <p>
          Ce lien vendeur n'existe pas ou n'est plus actif. Contactez Kado
          pour en recevoir un nouveau.
        </p>
      </div>
    </main>
  );
}

export default async function VendeurPage({
  params,
}: {
  params: { key: string };
}) {
  const key = (params.key || "").trim();
  // Clé = UUID ; on rejette tout le reste sans toucher la base.
  if (!/^[0-9a-f-]{36}$/i.test(key)) return <Unavailable />;

  let db;
  try {
    db = getAdminClient();
  } catch {
    return <Unavailable />;
  }

  let aff: any = null;
  try {
    const { data, error } = await db
      .from("affiliates")
      .select(
        "id, name, code, active, commission_roue_cents, commission_fidelite_cents, commission_complet_cents"
      )
      .eq("stats_key", key)
      .maybeSingle();
    if (error) return <Unavailable />;
    aff = data;
  } catch {
    return <Unavailable />;
  }
  if (!aff || !aff.active) return <Unavailable />;

  // Clients amenés + commissions (mêmes règles que l'admin)
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
      .eq("affiliate_id", aff.id);
    referred = (data as any[]) ?? [];
  } catch {
    referred = [];
  }
  try {
    const { data } = await db
      .from("affiliate_commissions")
      .select("business_id, amount_cents, status, created_at")
      .eq("affiliate_id", aff.id);
    comms = (data as any[]) ?? [];
  } catch {
    comms = [];
  }

  const THIRTY_DAYS = 30 * 864e5;
  const bizStatus = new Map(referred.map((b) => [b.id, b.subscription_status]));
  const isActiveBiz = (id: string) =>
    ["active", "trial"].includes(bizStatus.get(id) ?? "");

  const data: VendorStatsData = {
    name: aff.name,
    code: aff.code,
    commissionRoue: aff.commission_roue_cents / 100,
    commissionFidelite: aff.commission_fidelite_cents / 100,
    commissionComplet: aff.commission_complet_cents / 100,
    totalClients: referred.length,
    trialClients: referred.filter((b) => b.subscription_status === "trial")
      .length,
    paidClients: comms.filter((c) => c.status !== "canceled").length,
    exigibleCents: comms
      .filter(
        (c) =>
          c.status === "due" &&
          isActiveBiz(c.business_id) &&
          Date.now() - new Date(c.created_at).getTime() >= THIRTY_DAYS
      )
      .reduce((s, c) => s + c.amount_cents, 0),
    pendingCents: comms
      .filter(
        (c) =>
          c.status === "due" &&
          isActiveBiz(c.business_id) &&
          Date.now() - new Date(c.created_at).getTime() < THIRTY_DAYS
      )
      .reduce((s, c) => s + c.amount_cents, 0),
    paidCents: comms
      .filter((c) => c.status === "paid")
      .reduce((s, c) => s + c.amount_cents, 0),
  };

  return <StatsView data={data} />;
}
