import { getMyBusiness } from "@/lib/auth";
import BillingClient from "./BillingClient";

export const dynamic = "force-dynamic";

export default async function BillingPage({
  searchParams,
}: {
  searchParams: { success?: string };
}) {
  const { business } = await getMyBusiness();
  if (!business) return null;

  const hasSubscription = !!business.stripe_subscription_id;
  const labels: Record<string, string> = {
    active: "Actif",
    trial: "Essai",
    suspended: "Suspendu / inactif",
  };

  return (
    <BillingClient
      hasSubscription={hasSubscription}
      statusLabel={labels[business.subscription_status] || business.subscription_status}
      endsAt={business.subscription_ends_at}
      success={searchParams?.success === "1"}
      currentPlan={business.plan || "roue"}
      isTrial={business.subscription_status === "trial"}
    />
  );
}
