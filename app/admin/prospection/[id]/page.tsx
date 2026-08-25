import Link from "next/link";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import ProspectDetailClient, {
  type ProspectDetail,
  type MessageRow,
} from "./ProspectDetailClient";

export const dynamic = "force-dynamic";

/** Fiche prospect (admin) — story C2 : signaux + messages générés éditables. */
export default async function ProspectPage({
  params,
}: {
  params: { id: string };
}) {
  const user = await getAdminUser();
  if (!user) return null;

  const db = getAdminClient();
  const { data: p, error } = await db
    .from("prospects")
    .select(
      "id, name, category, city, address, google_rating, google_reviews_count, website, instagram_handle, email, score, score_factors, status, note"
    )
    .eq("id", params.id)
    .single();

  if (error || !p) {
    return (
      <div className="dash-card">
        <p>Prospect introuvable.</p>
        <Link href="/admin/prospection">← Retour à la prospection</Link>
      </div>
    );
  }

  const { data: msgs } = await db
    .from("prospect_messages")
    .select("id, channel, step, subject, body, status")
    .eq("prospect_id", params.id)
    .order("channel", { ascending: true })
    .order("step", { ascending: true });

  return (
    <ProspectDetailClient
      prospect={p as ProspectDetail}
      messages={(msgs ?? []) as MessageRow[]}
    />
  );
}
