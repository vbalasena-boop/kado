import { NextRequest } from "next/server";
import { getMyBusiness, getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendBatch } from "@/lib/email";
import {
  buildCampaignAudience,
  buildCampaignPayloads,
} from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/** L'accès campagnes : inclus pendant l'essai, sinon option payante. */
async function hasCampaignAccess(business: {
  id: string;
  subscription_status: string;
}) {
  if (business.subscription_status === "trial") return true;
  try {
    const { data } = await getAdminClient()
      .from("businesses")
      .select("campaigns_addon")
      .eq("id", business.id)
      .maybeSingle();
    return !!(data as any)?.campaigns_addon;
  } catch {
    return false;
  }
}

/** Envoie (ou programme) une campagne e-mail aux clients opt-in. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }
  if (!(await hasCampaignAccess(business))) {
    return Response.json({ error: "addon_required" }, { status: 403 });
  }

  let body: { subject?: string; message?: string; scheduledFor?: string };
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

  const db = getAdminClient();

  // Quota : 1 campagne créée par 24 h
  try {
    const dayAgo = new Date(Date.now() - 24 * 3600e3).toISOString();
    const { count } = await db
      .from("campaigns")
      .select("*", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", dayAgo);
    if ((count ?? 0) > 0) {
      return Response.json({ error: "quota" }, { status: 429 });
    }
  } catch {
    return Response.json({ error: "migration_missing" }, { status: 500 });
  }

  // Campagne programmée : on l'enregistre, le cron quotidien l'enverra
  if (scheduledFor) {
    const { error } = await db.from("campaigns").insert({
      business_id: business.id,
      subject,
      body: message,
      sent_count: 0,
      scheduled_for: scheduledFor,
    });
    if (error) {
      return Response.json({ error: "save_failed" }, { status: 500 });
    }
    return Response.json({ ok: true, scheduled: true, scheduledFor });
  }

  // Envoi immédiat
  const recipients = await buildCampaignAudience(db, business.id);
  if (recipients.length === 0) {
    return Response.json({ error: "no_audience" }, { status: 400 });
  }
  const user = await getSessionUser();
  const payloads = buildCampaignPayloads(
    { id: business.id, name: business.name, slug: business.slug },
    user?.email ?? undefined,
    subject,
    message,
    recipients
  );
  const sent = await sendBatch(payloads);

  await db.from("campaigns").insert({
    business_id: business.id,
    subject,
    body: message,
    sent_count: sent,
    sent_at: new Date().toISOString(),
  });

  return Response.json({ ok: true, sent });
}

/** Annule une campagne programmée (pas encore envoyée). */
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
  const { error } = await db
    .from("campaigns")
    .delete()
    .eq("id", body.id)
    .eq("business_id", business.id)
    .is("sent_at", null);
  if (error) return Response.json({ error: "delete_failed" }, { status: 500 });
  return Response.json({ ok: true });
}
