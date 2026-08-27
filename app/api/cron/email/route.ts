import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { drainEmailQueue } from "@/lib/email-queue";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Drain de la file d'e-mails (migration 0069). Envoie les messages en attente
 * au rythme autorisé par Resend (backoff 429 dans sendEmail), dans un budget de
 * temps pour tenir dans la fenêtre serverless. Complète le drain du cron
 * quotidien : ici on peut tourner plus souvent pour lisser les gros volumes.
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || req.headers.get("authorization") !== `Bearer ${secret}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const startedAt = Date.now();
  try {
    const drain = await drainEmailQueue(getAdminClient(), {
      max: 800,
      deadlineMs: startedAt + 50_000,
    });
    return Response.json({ ok: true, ...drain });
  } catch (e: any) {
    reportError(e, { where: "cron/email" });
    return Response.json(
      { ok: false, error: e?.message ?? "error" },
      { status: 500 }
    );
  }
}
