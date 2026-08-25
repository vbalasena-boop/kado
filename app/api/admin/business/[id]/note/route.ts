import { z } from "zod";
import { adminRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const Body = z.object({
  note: z.any().optional(),
});

/** Enregistre la note interne d'un établissement (admin uniquement). */
export const POST = adminRoute({
  schema: Body,
  handler: async ({ body, params }) => {
    const note = (body.note ?? "").trim().slice(0, 500) || null;
    const { error } = await getAdminClient()
      .from("businesses")
      .update({ admin_note: note })
      .eq("id", params.id);
    if (error) return Response.json({ error: "update_failed" }, { status: 500 });

    return Response.json({ ok: true });
  },
});
