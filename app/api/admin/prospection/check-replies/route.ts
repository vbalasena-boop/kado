import { adminRoute } from "@/lib/api";
import { runReplyDetection } from "@/lib/prospection/replies";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Vérifie manuellement les réponses (admin) : lit la boîte IMAP et marque
 * "replied" les prospects qui ont répondu. Même logique que le cron.
 */
export const POST = adminRoute({
  handler: async () => {
    const summary = await runReplyDetection();
    return Response.json({ ok: true, ...summary });
  },
});
