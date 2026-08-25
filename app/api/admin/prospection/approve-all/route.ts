import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { renderEmail } from "@/lib/prospection/templates";
import { NON_CONTACTABLE_STATUSES, type ProspectStatus } from "@/lib/prospection/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

type Prospect = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  google_reviews_count: number | null;
  email: string | null;
  status: ProspectStatus;
};

/**
 * Génère + approuve l'email de TOUS les prospects contactables ayant un email
 * (gain de temps : remplit la file d'envoi en 1 clic). Ne re-approuve pas ni ne
 * renvoie ce qui est déjà approuvé/envoyé.
 */
export const POST = adminRoute({
  handler: async () => {
    const db = getAdminClient();
    const { data, error } = await db
      .from("prospects")
      .select("id, name, city, category, google_reviews_count, email, status")
      .not("email", "is", null)
      .limit(2000);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const prospects = ((data ?? []) as Prospect[]).filter(
      (p) => !NON_CONTACTABLE_STATUSES.includes(p.status)
    );
    if (prospects.length === 0) return Response.json({ ok: true, approved: 0 });

    // Messages email (step 1) existants pour ces prospects.
    const ids = prospects.map((p) => p.id);
    const { data: msgs } = await db
      .from("prospect_messages")
      .select("id, prospect_id, status")
      .eq("channel", "email")
      .eq("step", 1)
      .in("prospect_id", ids);
    const existing = new Map<string, { id: string; status: string }>();
    for (const m of msgs ?? []) existing.set(m.prospect_id as string, { id: m.id as string, status: m.status as string });

    const now = new Date().toISOString();
    let approved = 0;

    for (const p of prospects) {
      const ex = existing.get(p.id);
      if (ex) {
        if (ex.status === "sent" || ex.status === "approved") continue; // déjà fait
        const { error: upErr } = await db
          .from("prospect_messages")
          .update({ status: "approved", approved_at: now })
          .eq("id", ex.id);
        if (!upErr) approved++;
      } else {
        const email = renderEmail({
          name: p.name,
          city: p.city,
          category: p.category,
          google_reviews_count: p.google_reviews_count,
          seed: p.id,
        });
        const { error: insErr } = await db.from("prospect_messages").insert({
          prospect_id: p.id,
          channel: "email",
          step: 1,
          subject: email.subject,
          body: email.body,
          status: "approved",
          approved_at: now,
        });
        if (!insErr) approved++;
      }
    }

    return Response.json({ ok: true, approved });
  },
});
