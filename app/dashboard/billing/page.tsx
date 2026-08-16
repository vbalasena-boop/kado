import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string; setup_ok?: string };
}) {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const hasSubscription = !!business.stripe_subscription_id;
  const labels: Record<string, string> = {
    active: "Actif",
    trial: "Essai",
    suspended: "Suspendu / inactif",
  };

  // Installation clé en main déjà achetée ? Téléphone connu ?
  // (tolérant si les colonnes manquent)
  let setupPaid = false;
  let setupOption: string | null = null;
  let hasPhone = false;
  let address = "";
  try {
    const { data } = await getAdminClient()
      .from("businesses")
      .select("setup_option, setup_paid_at, phone, address")
      .eq("id", business.id)
      .maybeSingle();
    setupPaid = !!data?.setup_paid_at;
    setupOption = data?.setup_option ?? null;
    hasPhone = !!data?.phone;
    address = (data as any)?.address ?? "";
  } catch {
    /* colonnes absentes : valeurs par défaut */
  }

  return (
    <BillingClient
      hasSubscription={hasSubscription}
      statusLabel={labels[business.subscription_status] || business.subscription_status}
      endsAt={business.subscription_ends_at}
      success={searchParams?.success === "1"}
      setupOk={searchParams?.setup_ok === "1"}
      currentPlan={business.plan || "roue"}
      isTrial={business.subscription_status === "trial"}
      setupPaid={setupPaid}
      setupOption={setupOption}
      hasPhone={hasPhone}
      slug={business.slug}
      initialAddress={address}
    />
  );
}
