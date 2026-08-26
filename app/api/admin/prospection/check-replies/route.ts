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
    // Clic manuel : pas de notification email (l'opérateur est déjà dans l'admin).
    const summary = await runReplyDetection(14, { notify: false });
    return Response.json({ ok: true, ...summary });
  },
});
