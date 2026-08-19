import { getAdminClient } from "@/lib/supabase/admin";
import { getAffiliateStats } from "@/lib/affiliates";
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

  const stats = await getAffiliateStats(db, aff.id);
  const data: VendorStatsData = {
    name: aff.name,
    code: aff.code,
    commissionRoue: aff.commission_roue_cents / 100,
    commissionFidelite: aff.commission_fidelite_cents / 100,
    commissionComplet: aff.commission_complet_cents / 100,
    ...stats,
  };
  return <StatsView data={data} />;
}
