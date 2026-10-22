import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { playEmailCodeHash, signPlayEmailToken } from "@/lib/play-email";

export const POST = publicRoute({
  schema: z.object({ slug: z.string().min(1).max(200), challengeId: z.string().uuid(), code: z.string().regex(/^\d{6}$/) }),
  handler: async ({ body }) => {
    const db = getAdminClient();
    const { data: biz, error } = await db.from("businesses").select("id, status").eq("slug", body.slug).maybeSingle();
    if (error || !biz || biz.status !== "active") return Response.json({ error: "unavailable" }, { status: 404 });
    // Verrou de ligne SQL : les requêtes concurrentes consomment aussi un essai.
    const { data: emailHash, error: verifyError } = await db.rpc("verify_play_email_challenge", {
      p_id: body.challengeId, p_business_id: biz.id, p_code_hash: playEmailCodeHash(body.challengeId, body.code),
    });
    if (verifyError) return Response.json({ error: "unavailable" }, { status: 503 });
    if (!emailHash) return Response.json({ error: "invalid_or_expired_code" }, { status: 400 });
    return Response.json({ token: signPlayEmailToken(biz.id, emailHash) });
  },
});
