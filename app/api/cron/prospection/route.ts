import { NextRequest } from "next/server";
import { reportError } from "@/lib/report";
import { runProspectionSend } from "@/lib/prospection/send-run";
import { runReplyDetection } from "@/lib/prospection/replies";
import { maybeSendWeeklyReport } from "@/lib/prospection/weekly-report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Cron d'envoi de la prospection email (story D3).
 * Envoie les emails APPROUVÉS dans la limite du plafond quotidien (cadence
 * lente / warm-up), en respectant la liste de désinscription. Idempotent.
 * Sécurité : exige CRON_SECRET (comme les autres crons).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const summary = await runProspectionSend();
    const replies = await runReplyDetection().catch(() => null);
    // Rapport hebdo : ne part que le lundi (aucun cron supplémentaire).
    const weeklyReport = await maybeSendWeeklyReport().catch(() => false);
    return Response.json({ ok: true, ...summary, replies, weeklyReport });
  } catch (err) {
    reportError(err, { where: "cron.prospection" });
    return Response.json({ error: "server_error" }, { status: 500 });
  }
}
