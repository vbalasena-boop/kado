import { adminRoute } from "@/lib/api";
import { runProspectionSend } from "@/lib/prospection/send-run";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Déclenche manuellement l'envoi des emails approuvés (admin), sans attendre
 * le cron quotidien. Utile pour tester. Même logique/plafond que le cron.
 */
export const POST = adminRoute({
  handler: async () => {
    const summary = await runProspectionSend();
    return Response.json({ ok: true, ...summary });
  },
});
