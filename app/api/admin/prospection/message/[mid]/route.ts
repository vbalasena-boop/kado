import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const schema = z.object({
  subject: z.string().max(300).optional(),
  body: z.string().max(10000).optional(),
  status: z.enum(["draft", "approved", "skipped"]).optional(),
});

/**
 * Édite un message généré (objet / corps / statut) — story C2/C4.
 * L'opérateur peut relire et modifier avant validation ; rien ne part sans lui.
 */
export const POST = adminRoute({
  schema,
  handler: async ({ body, params }) => {
    const mid = params.mid;
    if (!mid) return Response.json({ error: "missing_id" }, { status: 400 });

    const patch: Record<string, unknown> = {};
    if (body.subject !== undefined) patch.subject = body.subject;
    if (body.body !== undefined) patch.body = body.body;
    if (body.status !== undefined) {
      patch.status = body.status;
      if (body.status === "approved") patch.approved_at = new Date().toISOString();
    }
    if (Object.keys(patch).length === 0) {
      return Response.json({ error: "nothing_to_update" }, { status: 400 });
    }

    const db = getAdminClient();
    const { error } = await db.from("prospect_messages").update(patch).eq("id", mid);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });

    return Response.json({ ok: true });
  },
});
