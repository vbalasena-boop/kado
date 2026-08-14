import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import LeadsClient, { Lead } from "./LeadsClient";

export const dynamic = "force-dynamic";

export default async function LeadsPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const admin = getAdminClient();
  const { data } = await admin
    .from("leads")
    .select("email, phone, created_at")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false });

  return <LeadsClient leads={(data as Lead[]) ?? []} />;
}
