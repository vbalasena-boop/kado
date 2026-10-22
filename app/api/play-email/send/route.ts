import { randomInt, randomUUID } from "node:crypto";
import { z } from "zod";
import { publicRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { rateLimit } from "@/lib/rate-limit";
import { playEmailHash, playEmailCodeHash } from "@/lib/play-email";
import { sendPlayEmailCode } from "@/lib/email";

export const POST = publicRoute({
  schema: z.object({ slug: z.string().min(1).max(200), email: z.string().trim().email().max(254) }),
  handler: async ({ body }) => {
    const db = getAdminClient();
    const { data: biz, error } = await db.from("businesses").select("id, status").eq("slug", body.slug).maybeSingle();
    if (error || !biz || biz.status !== "active") return Response.json({ error: "unavailable" }, { status: 404 });
    const emailHash = playEmailHash(body.email);
    if (!(await rateLimit(`play-email-send:${biz.id}:${emailHash}`, 3, 3600))) {
      return Response.json({ error: "rate_limited" }, { status: 429 });
    }
    const id = randomUUID();
    const code = randomInt(0, 1_000_000).toString().padStart(6, "0");
    const { error: saveError } = await db.from("play_email_challenges").insert({
      id, business_id: biz.id, email_hash: emailHash, code_hash: playEmailCodeHash(id, code),
      expires_at: new Date(Date.now() + 10 * 60_000).toISOString(),
    });
    if (saveError) return Response.json({ error: "unavailable" }, { status: 503 });
    const sent = await sendPlayEmailCode(body.email, code);
    if (!sent.ok) return Response.json({ error: "email_unavailable" }, { status: 503 });
    return Response.json({ challengeId: id });
  },
});
