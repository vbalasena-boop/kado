import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import CampaignsClient from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = getAdminClient();

  // Audience : leads opt-in + fidélité avec accord marketing (dédupliquée)
  const emails = new Set<string>();
  const { data: leads } = await db
    .from("leads")
    .select("email, unsubscribed_at")
    .eq("business_id", business.id)
    .not("email", "is", null);
  for (const l of leads ?? []) {
    if (l.email && !l.unsubscribed_at) emails.add(l.email.toLowerCase());
  }
  try {
    const { data: cards } = await db
      .from("loyalty_cards")
      .select("email, marketing_ok, unsubscribed_at")
      .eq("business_id", business.id)
      .eq("marketing_ok", true);
    for (const c of cards ?? []) {
      if (c.email && !c.unsubscribed_at) emails.add(c.email.toLowerCase());
    }
  } catch {
    /* colonnes absentes */
  }

  // Historique + quota
  let history: { subject: string; sent_count: number; created_at: string }[] =
    [];
  let lastAt: string | null = null;
  try {
    const { data: rows } = await db
      .from("campaigns")
      .select("subject, sent_count, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(10);
    history = rows ?? [];
    lastAt = rows?.[0]?.created_at ?? null;
  } catch {
    /* table absente */
  }

  return (
    <CampaignsClient
      audience={emails.size}
      businessName={business.name}
      history={history}
      lastAt={lastAt}
    />
  );
}
