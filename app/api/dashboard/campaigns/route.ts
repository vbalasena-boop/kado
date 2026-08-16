import { NextRequest } from "next/server";
import { getMyBusiness, getSessionUser } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendBatch, emailLayout } from "@/lib/email";
import { unsubToken } from "@/lib/unsub";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const SITE = "https://kado-app.fr";
const MAX_RECIPIENTS = 500;

function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/** Envoie une campagne e-mail aux clients ayant donné leur accord. */
export async function POST(req: NextRequest) {
  const { business } = await getMyBusiness();
  if (!business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  let body: { subject?: string; message?: string };
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

  const db = getAdminClient();

  // Quota : 1 campagne par 24 h
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

  // Audience : leads opt-in + cartes de fidélité avec accord marketing
  const emails = new Set<string>();
  const { data: leads } = await db
    .from("leads")
    .select("email, unsubscribed_at")
    .eq("business_id", business.id)
    .not("email", "is", null);
  for (const l of leads ?? []) {
    if (l.email && !l.unsubscribed_at) emails.add(l.email.toLowerCase());
  }
  try {
    const { data: cards } = await db
      .from("loyalty_cards")
      .select("email, marketing_ok, unsubscribed_at")
      .eq("business_id", business.id)
      .eq("marketing_ok", true);
    for (const c of cards ?? []) {
      if (c.email && !c.unsubscribed_at) emails.add(c.email.toLowerCase());
    }
  } catch {
    /* colonnes absentes */
  }

  const list = [...emails].slice(0, MAX_RECIPIENTS);
  if (list.length === 0) {
    return Response.json({ error: "no_audience" }, { status: 400 });
  }

  const user = await getSessionUser();
  const bodyHtml = escapeHtml(message).replace(/\n/g, "<br>");

  const payloads = list.map((to) => {
    const t = unsubToken(business.id, to);
    const unsub = `${SITE}/api/unsubscribe?b=${business.id}&e=${encodeURIComponent(
      Buffer.from(to).toString("base64url")
    )}&t=${t}`;
    return {
      to,
      subject,
      fromName: `${business.name} via Kado`,
      replyTo: user?.email ?? undefined,
      html: emailLayout({
        preview: subject,
        heading: subject,
        emoji: "💌",
        bodyHtml: `${bodyHtml}<br><br><a href="${SITE}/${business.slug}" style="display:inline-block;background:linear-gradient(135deg,#ff6b4a,#ff4e87);color:#fff;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:12px;">Voir ${escapeHtml(business.name)}</a>`,
        footnote: `Vous recevez cet e-mail car vous avez accepté les offres de ${escapeHtml(
          business.name
        )}. <a href="${unsub}" style="color:#9a94b4;">Se désinscrire</a>`,
      }),
    };
  });

  const sent = await sendBatch(payloads);

  await db.from("campaigns").insert({
    business_id: business.id,
    subject,
    body: message,
    sent_count: sent,
  });

  return Response.json({ ok: true, sent });
}
