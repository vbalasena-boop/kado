import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import LeadsClient, { Lead } from "./LeadsClient";
import { LEADS_PAGE_SIZE } from "@/lib/leads-csv";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const admin = getAdminClient();
  // Première page seulement (le reste via « Charger plus », l'export complet
  // via la route dédiée) : la page ne charge plus toute la base d'un coup.
  const { data, count } = await admin
    .from("leads")
    .select("email, phone, created_at", { count: "exact" })
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .range(0, LEADS_PAGE_SIZE - 1);

  return (
    <LeadsClient
      initialLeads={(data as Lead[]) ?? []}
      total={count ?? 0}
      pageSize={LEADS_PAGE_SIZE}
    />
  );
}
