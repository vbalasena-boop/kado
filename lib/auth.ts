import { createSSRClient } from "@/lib/supabase/ssr";
import { getAdminClient } from "@/lib/supabase/admin";

export type Business = {
  id: string;
  slug: string;
  name: string;
  logo_url: string | null;
  status: string;
  subscription_status: string;
  owner_user_id: string | null;
};

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
      "id, slug, name, logo_url, status, subscription_status, owner_user_id"
    )
    .eq("owner_user_id", user.id)
    .maybeSingle();
  return { user, business: (data as Business) ?? null };
}
