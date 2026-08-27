import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { aiWriterConfigured, writeMessagesWithAI, AI_TONES } from "@/lib/prospection/ai-writer";
import { fetchSiteExcerpt } from "@/lib/prospection/site-excerpt";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const schema = z
  .object({
    limit: z.number().int().min(1).max(20).optional(),
    tone: z.enum(AI_TONES).optional(),
    // Si fourni : rédige uniquement CE prospect (depuis sa fiche), sans filtre.
    prospectId: z.string().uuid().optional(),
  })
  .optional();

type Db = ReturnType<typeof getAdminClient>;

type Row = {
  id: string;
  name: string;
  city: string | null;
  category: string | null;
  email: string | null;
  instagram_handle: string | null;
  website: string | null;
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

    const cols =
      "id, name, city, category, email, instagram_handle, website, google_reviews_count, score";

    let batch: (Row & { score: number | null })[];
    let candidatesLen: number;

    if (body?.prospectId) {
      // Mode fiche : un seul prospect, sans filtre de statut ni exclusion.
      const { data, error } = await db.from("prospects").select(cols).eq("id", body.prospectId).single();
      if (error || !data) return Response.json({ error: "not_found" }, { status: 404 });
      batch = [data as Row & { score: number | null }];
      candidatesLen = 1;
    } else {
      // Mode lot : prospects contactables non encore rédigés par IA, par score.
      const { data: doneEvents } = await db
        .from("prospect_events")
        .select("prospect_id")
        .eq("type", "ai_written")
        .limit(10000);
      const doneIds = new Set((doneEvents ?? []).map((e) => e.prospect_id as string));

      const { data, error } = await db
        .from("prospects")
        .select(cols)
        .in("status", ["new", "queued", "emailed", "dm_pending"])
        .or("email.not.is.null,instagram_handle.not.is.null")
        .order("score", { ascending: false, nullsFirst: false })
        .limit(500);
      if (error) return Response.json({ error: "db_error" }, { status: 500 });

      const candidates = ((data ?? []) as (Row & { score: number | null })[]).filter(
        (p) => !doneIds.has(p.id)
      );
      candidatesLen = candidates.length;
      batch = candidates.slice(0, limit);
    }

    let written = 0;
    let failed = 0;
    for (const p of batch) {
      try {
        // Extrait du site (best-effort) pour personnaliser sans rien inventer.
        const siteText = (await fetchSiteExcerpt(p.website).catch(() => null)) ?? undefined;
        const ai = await writeMessagesWithAI({
          name: p.name,
          city: p.city,
          category: p.category,
          google_reviews_count: p.google_reviews_count,
          seed: p.id,
          siteText,
          tone: body?.tone,
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
      remaining: Math.max(0, candidatesLen - written),
    });
  },
});
