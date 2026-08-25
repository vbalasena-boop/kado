import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { renderDm } from "@/lib/prospection/templates";
import { NON_CONTACTABLE_STATUSES, type ProspectStatus } from "@/lib/prospection/types";
import InstagramQueueClient, { type DmItem } from "./InstagramQueueClient";

export const dynamic = "force-dynamic";

/**
 * File Instagram assistée (admin) — story E1.
 * Aucun envoi automatisé : on prépare le DM, l'opérateur l'envoie lui-même
 * depuis son compte (respect des CGU Meta), puis marque « envoyé ».
 */
export default async function InstagramQueuePage() {
  const user = await getAdminUser();
  if (!user) return null;

  const db = getAdminClient();

  const { data: rows } = await db
    .from("prospects")
    .select(
      "id, name, city, category, google_reviews_count, instagram_handle, status"
    )
    .not("instagram_handle", "is", null)
    .order("score", { ascending: false, nullsFirst: false })
    .limit(200);

  // DM déjà rédigés/édités (on préfère la version stockée si elle existe).
  const ids = (rows ?? []).map((r) => r.id);
  const stored = new Map<string, string>();
  if (ids.length > 0) {
    const { data: msgs } = await db
      .from("prospect_messages")
      .select("prospect_id, body, channel")
      .in("prospect_id", ids)
      .eq("channel", "instagram");
    for (const m of msgs ?? []) stored.set(m.prospect_id, m.body);
  }

  const items: DmItem[] = (rows ?? [])
    .filter((r) => !NON_CONTACTABLE_STATUSES.includes(r.status as ProspectStatus))
    .map((r) => ({
      id: r.id,
      name: r.name,
      handle: r.instagram_handle as string,
      status: r.status as ProspectStatus,
      dm:
        stored.get(r.id) ??
        renderDm({
          name: r.name,
          city: r.city,
          category: r.category,
          google_reviews_count: r.google_reviews_count,
        }),
    }));

  return <InstagramQueueClient items={items} />;
}
