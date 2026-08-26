import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { aiWriterConfigured, writeMessagesWithAI } from "@/lib/prospection/ai-writer";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z.object({ limit: z.number().int().min(1).max(20).optional() }).optional();

type Db = ReturnType<typeof getAdminClient>;

type Row = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  email: string | null;
  instagram_handle: string | null;
  google_reviews_count: number | null;
};

/**
 * Écrit un brouillon EN PLACE pour un canal, sans jamais toucher un message
 * déjà envoyé/ignoré (sent/skipped) ni écraser un statut approuvé.
 */
async function upsertDraft(
  db: Db,
  prospectId: string,
  channel: "email" | "instagram",
  payload: { subject: string | null; body: string }
): Promise<void> {
  const { data: existing } = await db
    .from("prospect_messages")
    .select("id, status")
    .eq("prospect_id", prospectId)
    .eq("channel", channel)
    .eq("step", 1);
  const rows = (existing ?? []) as { id: string; status: string }[];
  if (rows.some((r) => r.status === "sent" || r.status === "skipped")) return;

  const approved = rows.find((r) => r.status === "approved");
  if (approved) {
    await db.from("prospect_messages").update(payload).eq("id", approved.id);
    await db
      .from("prospect_messages")
      .delete()
      .eq("prospect_id", prospectId)
      .eq("channel", channel)
      .eq("step", 1)
      .eq("status", "draft");
  } else {
    await db
      .from("prospect_messages")
      .delete()
      .eq("prospect_id", prospectId)
      .eq("channel", channel)
      .eq("step", 1)
      .eq("status", "draft");
    await db
      .from("prospect_messages")
      .insert({ prospect_id: prospectId, channel, step: 1, status: "draft", ...payload });
  }
}

/**
 * Rédaction IA des messages (admin) — opt-in `ANTHROPIC_API_KEY`.
 * Traite par petits lots (défaut 8) les prospects avec un contact et pas encore
 * rédigés par IA (marqueur `ai_written`), classés par score. Chaque appel écrit
 * des BROUILLONS (email + DM) — rien n'est envoyé sans validation humaine.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body }) => {
    if (!aiWriterConfigured()) {
      return Response.json({
        ok: true,
        configured: false,
        written: 0,
        failed: 0,
        remaining: 0,
      });
    }

    const limit = body?.limit ?? 8;
    const db = getAdminClient();

    // Prospects déjà rédigés par IA → à exclure (le lot avance dans la liste).
    const { data: doneEvents } = await db
      .from("prospect_events")
      .select("prospect_id")
      .eq("type", "ai_written")
      .limit(10000);
    const doneIds = new Set((doneEvents ?? []).map((e) => e.prospect_id as string));

    // Candidats : contactables (statut non final) avec un email OU un Instagram.
    const { data, error } = await db
      .from("prospects")
      .select("id, name, city, category, email, instagram_handle, google_reviews_count, score")
      .in("status", ["new", "queued", "emailed", "dm_pending"])
      .or("email.not.is.null,instagram_handle.not.is.null")
      .order("score", { ascending: false, nullsFirst: false })
      .limit(500);
    if (error) return Response.json({ error: "db_error" }, { status: 500 });

    const candidates = ((data ?? []) as (Row & { score: number | null })[]).filter(
      (p) => !doneIds.has(p.id)
    );
    const batch = candidates.slice(0, limit);

    let written = 0;
    let failed = 0;
    for (const p of batch) {
      try {
        const ai = await writeMessagesWithAI({
          name: p.name,
          city: p.city,
          category: p.category,
          google_reviews_count: p.google_reviews_count,
          seed: p.id,
        });
        if (p.email) {
          await upsertDraft(db, p.id, "email", { subject: ai.subject, body: ai.body });
        }
        if (p.instagram_handle) {
          await upsertDraft(db, p.id, "instagram", { subject: null, body: ai.dm });
        }
        await db
          .from("prospect_events")
          .insert({ prospect_id: p.id, type: "ai_written", meta: {} });
        written++;
      } catch {
        failed++;
      }
    }

    return Response.json({
      ok: true,
      configured: true,
      written,
      failed,
      remaining: Math.max(0, candidates.length - written),
    });
  },
});
