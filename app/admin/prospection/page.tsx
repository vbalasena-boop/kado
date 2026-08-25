import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import ProspectionClient, { type ProspectRow } from "./ProspectionClient";

export const dynamic = "force-dynamic";

/**
 * Écran de prospection (admin) — story B3.
 * Liste les prospects triés par score (potentiel Kado) et permet de lancer un
 * sourcing. Le filtrage/tri fin se fait côté client (volumes faibles).
 */
export default async function ProspectionPage() {
  const user = await getAdminUser();
  if (!user) return null; // le layout admin gère l'accès refusé

  const admin = getAdminClient();
  const { data, error } = await admin
    .from("prospects")
    .select(
      "id, name, category, city, google_rating, google_reviews_count, website, instagram_handle, email, score, status, created_at"
    )
    .order("score", { ascending: false, nullsFirst: false })
    .limit(500);

  // Tolérant : si la table n'existe pas encore (migration non appliquée),
  // on affiche une liste vide plutôt que de planter.
  const prospects: ProspectRow[] = error ? [] : ((data ?? []) as ProspectRow[]);

  return (
    <ProspectionClient
      prospects={prospects}
      migrationMissing={Boolean(error)}
    />
  );
}
