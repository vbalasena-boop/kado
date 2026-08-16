import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import CampaignsClient from "./CampaignsClient";

export const dynamic = "force-dynamic";

export default async function CampaignsPage() {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const db = getAdminClient();
  const isTrial = business.subscription_status === "trial";

  // Option campagnes active ? (colonne récente → tolérant)
  let addonOn = false;
  try {
    const { data } = await db
      .from("businesses")
      .select("campaigns_addon")
      .eq("id", business.id)
      .maybeSingle();
    addonOn = !!(data as any)?.campaigns_addon;
  } catch {
    /* migration non passée */
  }
  const hasAccess = isTrial || addonOn;

  // Audience opt-in dédupliquée
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
  let history: {
    id: string;
    subject: string;
    sent_count: number;
    created_at: string;
    scheduled_for: string | null;
    sent_at: string | null;
    remaining: number;
  }[] = [];
  let lastCreatedAt: string | null = null;
  try {
    const { data: rows } = await db
      .from("campaigns")
      .select(
        "id, subject, sent_count, created_at, scheduled_for, sent_at, pending_recipients"
      )
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(10);
    history = ((rows as any) ?? []).map((r: any) => ({
      id: r.id,
      subject: r.subject,
      sent_count: r.sent_count,
      created_at: r.created_at,
      scheduled_for: r.scheduled_for ?? null,
      sent_at: r.sent_at ?? null,
      remaining: Array.isArray(r.pending_recipients)
        ? r.pending_recipients.length
        : 0,
    }));
    lastCreatedAt = history[0]?.created_at ?? null;
  } catch {
    /* table / colonnes absentes */
  }

  return (
    <CampaignsClient
      hasAccess={hasAccess}
      isTrial={isTrial}
      addonOn={addonOn}
      hasSubscription={!!business.stripe_subscription_id}
      audience={emails.size}
      businessName={business.name}
      history={history}
      lastAt={lastCreatedAt}
    />
  );
}
