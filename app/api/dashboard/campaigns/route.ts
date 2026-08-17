import { NextRequest } from "next/server";
import { getMyBusiness, getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendBatch } from "@/lib/email";
import { sendPushToClients } from "@/lib/push";
import {
  buildCampaignAudience,
  buildCampaignPayloads,
  TRIAL_MAX_RECIPIENTS,
  DAILY_CHUNK,
} from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * Envoie ou programme une campagne e-mail.
 * - Essai gratuit : 10 destinataires max par campagne (découverte).
 * - Option payée : envoi étalé (100 e-mails/jour max) pour respecter les
 *   limites d'envoi — la suite part automatiquement via le cron quotidien.
 */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const isTrial = business.subscription_status === "trial";
  const db = getAdminClient();

  let addonOn = false;
  try {
    const { data } = await db
      .from("businesses")
      .select("campaigns_addon")
      .eq("id", business.id)
      .maybeSingle();
    addonOn = !!(data as any)?.campaigns_addon;
  } catch {
    /* migration non passée */
  }
  if (!isTrial && !addonOn) {
    return Response.json({ error: "addon_required" }, { status: 403 });
  }

  let body: {
    subject?: string;
    message?: string;
    scheduledFor?: string;
    channel?: string;
  };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  const subject = (body.subject || "").trim().slice(0, 90);
  const message = (body.message || "").trim().slice(0, 2500);
  if (!subject || message.length < 10) {
    return Response.json({ error: "missing_content" }, { status: 400 });
  }
  // Canal choisi par le commerçant : e-mail, push, ou les deux
  const channel = ["email", "push", "both"].includes(body.channel ?? "")
    ? (body.channel as "email" | "push" | "both")
    : "both";
  const wantEmail = channel !== "push";
  const wantPush = channel !== "email";

  // Programmation éventuelle (date au format YYYY-MM-DD, demain → +60 j)
  let scheduledFor: string | null = null;
  if (body.scheduledFor) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(body.scheduledFor)) {
      return Response.json({ error: "bad_date" }, { status: 400 });
    }
    const target = new Date(`${body.scheduledFor}T00:00:00Z`).getTime();
    const today = new Date(new Date().toISOString().slice(0, 10)).getTime();
    if (
      !Number.isFinite(target) ||
      target <= today ||
      target > today + 60 * 864e5
    ) {
      return Response.json({ error: "bad_date" }, { status: 400 });
    }
    scheduledFor = body.scheduledFor;
  }

  // Quota : 1 campagne créée / 24 h, et jamais deux campagnes en cours
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600e3).toISOString();
    const [{ count: recent }, { count: inFlight }] = await Promise.all([
      db
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .gte("created_at", dayAgo),
      db
        .from("campaigns")
        .select("*", { count: "exact", head: true })
        .eq("business_id", business.id)
        .is("sent_at", null),
    ]);
    if ((recent ?? 0) > 0) {
      return Response.json({ error: "quota" }, { status: 429 });
    }
    if ((inFlight ?? 0) > 0) {
      return Response.json({ error: "in_progress" }, { status: 429 });
    }
  } catch {
    return Response.json({ error: "migration_missing" }, { status: 500 });
  }

  // Insertion tolérante : les colonnes channel/pushed_count peuvent manquer
  async function insertCampaign(
    row: Record<string, unknown>,
    pushedCount: number
  ) {
    let { error } = await db
      .from("campaigns")
      .insert({ ...row, channel, pushed_count: pushedCount });
    if (error) {
      ({ error } = await db.from("campaigns").insert(row));
    }
    return error;
  }

  // Campagne programmée : enregistrée, le cron la démarrera le jour J
  if (scheduledFor) {
    const error = await insertCampaign(
      {
        business_id: business.id,
        subject,
        body: message,
        sent_count: 0,
        scheduled_for: scheduledFor,
      },
      0
    );
    if (error) {
      return Response.json({ error: "save_failed" }, { status: 500 });
    }
    return Response.json({ ok: true, scheduled: true, scheduledFor, channel });
  }

  // Envoi immédiat
  const audience = wantEmail
    ? await buildCampaignAudience(db, business.id)
    : [];

  // Notification push aux clients abonnés aux offres (gratuit, illimité,
  // best effort — jamais bloquant)
  let pushed = 0;
  if (wantPush) {
    try {
      pushed = await sendPushToClients(db, business.id, {
        title: `${business.name} : ${subject}`.slice(0, 80),
        body: message.slice(0, 140),
        url: `/${business.slug}`,
      });
    } catch {
      /* ignore */
    }
  }

  if (audience.length === 0 && pushed === 0) {
    return Response.json(
      { error: channel === "push" ? "no_push_audience" : "no_audience" },
      { status: 400 }
    );
  }

  const user = await getSessionUser();
  const bizInfo = { id: business.id, name: business.name, slug: business.slug };

  if (audience.length === 0) {
    // pas d'e-mails à envoyer (canal push, ou aucune adresse) : la
    // campagne est quand même partie en notifications
    await insertCampaign(
      {
        business_id: business.id,
        subject,
        body: message,
        sent_count: 0,
        sent_at: new Date().toISOString(),
      },
      pushed
    );
    return Response.json({ ok: true, sent: 0, pushed, channel });
  }

  if (isTrial && !addonOn) {
    // Essai : une seule fournée, plafonnée à 10 destinataires
    const recipients = audience.slice(0, TRIAL_MAX_RECIPIENTS);
    const sent = await sendBatch(
      buildCampaignPayloads(bizInfo, user?.email ?? undefined, subject, message, recipients)
    );
    await insertCampaign(
      {
        business_id: business.id,
        subject,
        body: message,
        sent_count: sent,
        sent_at: new Date().toISOString(),
      },
      pushed
    );
    return Response.json({
      ok: true,
      sent,
      pushed,
      channel,
      trialCapped: audience.length > TRIAL_MAX_RECIPIENTS,
    });
  }

  // Option payée : première fournée maintenant, le reste étalé par le cron
  const chunk = audience.slice(0, DAILY_CHUNK);
  const rest = audience.slice(DAILY_CHUNK);
  const sent = await sendBatch(
    buildCampaignPayloads(bizInfo, user?.email ?? undefined, subject, message, chunk)
  );
  await insertCampaign(
    {
      business_id: business.id,
      subject,
      body: message,
      sent_count: sent,
      ...(rest.length > 0
        ? { pending_recipients: rest }
        : { sent_at: new Date().toISOString() }),
    },
    pushed
  );

  return Response.json({ ok: true, sent, pushed, channel, remaining: rest.length });
}

/** Annule une campagne programmée, ou stoppe l'envoi étalé restant. */
export async function DELETE(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  let body: { id?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }
  if (!body.id) return Response.json({ error: "missing_id" }, { status: 400 });

  const db = getAdminClient();
  const { data: camp } = await db
    .from("campaigns")
    .select("id, sent_count, sent_at")
    .eq("id", body.id)
    .eq("business_id", business.id)
    .maybeSingle();
  if (!camp || camp.sent_at) {
    return Response.json({ error: "not_cancellable" }, { status: 400 });
  }

  if ((camp.sent_count ?? 0) > 0) {
    // envoi étalé démarré : on stoppe le reste, l'historique est conservé
    const { error } = await db
      .from("campaigns")
      .update({ pending_recipients: null, sent_at: new Date().toISOString() })
      .eq("id", camp.id);
    if (error) return Response.json({ error: "delete_failed" }, { status: 500 });
    return Response.json({ ok: true, stopped: true });
  }

  const { error } = await db.from("campaigns").delete().eq("id", camp.id);
  if (error) return Response.json({ error: "delete_failed" }, { status: 500 });
  return Response.json({ ok: true });
}
