import { NextRequest } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import { drainEmailQueue } from "@/lib/email-queue";
import { reportError } from "@/lib/report";
import { mapLimit } from "@/lib/async";
import { pushToSubscriptionDetailed } from "@/lib/push";
import {
  isPickupReminderEligible,
  PICKUP_REMINDER_AFTER_MIN,
} from "@/lib/pickup-reminder";

const PICKUP_REMINDER_MAX_PER_RUN = 200;

/**
 * Rappel « votre commande vous attend » : commandes toujours « prêtes » passé
 * un délai, NON récupérées (client) et NON remises (commerçant), avec alerte
 * push. Un seul rappel par commande. Tolérant si la migration 0070 est absente.
 */
async function remindUnpickedOrders(
  db: ReturnType<typeof getAdminClient>
): Promise<number> {
  const nowMs = Date.now();
  const cutoffIso = new Date(
    nowMs - PICKUP_REMINDER_AFTER_MIN * 60000
  ).toISOString();
  const { data: orders, error } = await db
    .from("orders")
    .select(
      "id, business_id, code, status, notified_ready_at, picked_up_at, pickup_reminder_at, notify_push"
    )
    .eq("status", "ready")
    .is("picked_up_at", null)
    .is("pickup_reminder_at", null)
    .not("notify_push", "is", null)
    .lt("notified_ready_at", cutoffIso)
    .limit(PICKUP_REMINDER_MAX_PER_RUN);
  if (error || !orders || orders.length === 0) return 0;

  const eligible = (orders as any[]).filter((o) =>
    isPickupReminderEligible(o, nowMs)
  );
  if (eligible.length === 0) return 0;

  const ids = [...new Set(eligible.map((o) => o.business_id))];
  const { data: bizs } = await db
    .from("businesses")
    .select("id, name, slug")
    .in("id", ids);
  const bizBy = new Map((bizs ?? []).map((b: any) => [b.id, b]));

  let sent = 0;
  await mapLimit(eligible, 5, async (o: any) => {
    const biz: any = bizBy.get(o.business_id);
    if (!biz) return;
    const res = await pushToSubscriptionDetailed(o.notify_push, {
      title: `🔔 Votre commande vous attend`,
      body: `${biz.name} — commande ${o.code} est prête à être récupérée.`,
      url: `/${biz.slug}/suivi/${o.code}`,
    });
    // On marque le rappel « tenté » quoi qu'il arrive, pour ne pas boucler sur
    // un abonnement mort à chaque passage.
    await db
      .from("orders")
      .update({ pickup_reminder_at: new Date().toISOString() })
      .eq("id", o.id);
    if (res.ok) sent++;
  });
  return sent;
}

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
  const db = getAdminClient();

  // Rappels de retrait (best-effort, indépendant du drain).
  let pickupReminders = 0;
  try {
    pickupReminders = await remindUnpickedOrders(db);
  } catch (e) {
    reportError(e, { where: "cron/email.pickup" });
  }

  try {
    const drain = await drainEmailQueue(db, {
      max: 800,
      deadlineMs: startedAt + 50_000,
    });
    return Response.json({ ok: true, pickupReminders, ...drain });
  } catch (e: any) {
    reportError(e, { where: "cron/email" });
    return Response.json(
      { ok: false, error: e?.message ?? "error", pickupReminders },
      { status: 500 }
    );
  }
}
