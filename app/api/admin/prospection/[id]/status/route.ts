import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { PROSPECT_STATUSES } from "@/lib/prospection/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  status: z.enum(PROSPECT_STATUSES).optional(),
  exclude_reason: z.string().max(200).optional(),
  note: z.string().max(1000).optional(),
});

/**
 * Met à jour le statut / la note d'un prospect (admin) — stories B2 & E3.
 * Sert notamment à EXCLURE un prospect (status = 'excluded' + motif) : il ne
 * réapparaîtra plus dans les listes à contacter.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body, params }) => {
    const id = params.id;
    if (!id) return Response.json({ error: "missing_id" }, { status: 400 });

    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (body.status !== undefined) patch.status = body.status;
    if (body.exclude_reason !== undefined) patch.exclude_reason = body.exclude_reason;
    if (body.note !== undefined) patch.note = body.note;

    if (Object.keys(patch).length === 1) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const db = getAdminClient();
    const { error } = await db.from("prospects").update(patch).eq("id", id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });

    if (body.status) {
      await db.from("prospect_events").insert({
        prospect_id: id,
        type: body.status === "excluded" ? "excluded" : "status_changed",
        meta: { status: body.status, reason: body.exclude_reason ?? null },
      });
    }

    return Response.json({ ok: true });
  },
});
