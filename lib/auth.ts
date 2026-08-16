import { createSSRClient } from "@/lib/supabase/ssr";
import { getAdminClient } from "@/lib/supabase/admin";

export type Business = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  status: string;
  subscription_status: string;
  subscription_ends_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  owner_user_id: string | null;
  plan: string;
};

export type Plan = "roue" | "fidelite" | "complet";

export function hasModule(
  b: { plan: string; subscription_status: string },
  module: "roue" | "fidelite"
): boolean {
  if (b.subscription_status === "trial") return true;
  if (b.plan === "complet") return true;
  return b.plan === module;
}

/**
 * L'établissement a-t-il accès (page de jeu + espace) ?
 * Refusé si suspendu manuellement, ou si l'abonnement est expiré.
 */
export function hasAccess(b: {
  status: string;
  subscription_ends_at: string | null;
}): boolean {
  if (b.status === "suspended") return false;
  if (b.subscription_ends_at && new Date(b.subscription_ends_at).getTime() < Date.now())
    return false;
  return true;
}

/** Utilisateur connecté (ou null). */
export async function getSessionUser() {
  const supa = createSSRClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  return user;
}

/**
 * L'établissement rattaché au commerçant connecté.
 * Renvoie { user, business } ; business est null si aucun n'est lié au compte.
 */
export async function getMyBusiness(): Promise<{
  user: Awaited<ReturnType<typeof getSessionUser>>;
  business: Business | null;
}> {
  const user = await getSessionUser();
  if (!user) return { user: null, business: null };
  const admin = getAdminClient();
  const { data } = await admin
    .from("businesses")
    .select(
      "id, slug, name, logo_url, status, subscription_status, subscription_ends_at, stripe_customer_id, stripe_subscription_id, owner_user_id, plan"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();
  return { user, business: (data as Business) ?? null };
}
