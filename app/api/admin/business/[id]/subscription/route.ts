import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout, getOwnerContact } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * 864e5);
}
function addMonths(base: Date, months: number) {
  const d = new Date(base);
  d.setMonth(d.getMonth() + months);
  return d;
}

/**
 * Gère l'abonnement d'un établissement.
 * action = 'trial' (essai 14j) | 'month1' (+1 mois) | 'month6' (+6 mois).
 * Prolonger réactive l'accès et repart de la date de fin actuelle si elle
 * est dans le futur (on n'écrase pas le temps déjà payé).
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { action?: string };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "bad_request" }, { status: 400 });
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("subscription_ends_at")
    .eq("id", params.id)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });

  const now = new Date();
  const current = biz.subscription_ends_at
    ? new Date(biz.subscription_ends_at)
    : now;
  const base = current > now ? current : now;

  let ends: Date;
  let subStatus: string;
  if (body.action === "trial") {
    ends = addDays(now, 14);
    subStatus = "trial";
  } else if (body.action === "month1") {
    ends = addMonths(base, 1);
    subStatus = "active";
  } else if (body.action === "month6") {
    ends = addMonths(base, 6);
    subStatus = "active";
  } else {
    return Response.json({ error: "invalid_action" }, { status: 400 });
  }

  const { error } = await db
    .from("businesses")
    .update({
      subscription_ends_at: ends.toISOString(),
      subscription_status: subStatus,
      status: "active",
    })
    .eq("id", params.id);
  if (error) return Response.json({ error: "update_failed" }, { status: 500 });

  // E-mail au commerçant : temps offert
  const giftLabel =
    body.action === "trial"
      ? "14 jours d'essai offerts"
      : body.action === "month6"
      ? "6 mois offerts"
      : "1 mois offert";
  const endsFr = ends.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });

  let emailSent = false;
  const { email, businessName } = await getOwnerContact(db, params.id);
  if (email) {
    const html = emailLayout({
      preview: `Bonne nouvelle : ${giftLabel} sur votre abonnement Kado`,
      emoji: "🎁",
      heading: `Bonne nouvelle : ${giftLabel} !`,
      bodyHtml: `
        <p style="margin:0 0 14px;">Bonjour,</p>
        <p style="margin:0 0 14px;">Nous venons d'ajouter <b>${giftLabel}</b> à
        votre abonnement Kado${businessName ? ` (« ${businessName} »)` : ""}.
        Rien à faire de votre côté, c'est déjà appliqué 🎉</p>
        <p style="margin:0 0 20px;">Votre accès est garanti jusqu'au
        <b>${endsFr}</b>.</p>
        <a href="https://kado-app.fr/dashboard" style="display:inline-block;background:linear-gradient(180deg,#ffc24d,#f0a52e);color:#1b1035;font-weight:800;text-decoration:none;padding:12px 22px;border-radius:999px;font-size:15px;">Accéder à mon espace →</a>`,
    });
    const r = await sendEmail({
      to: email,
      subject: `Kado — ${giftLabel} 🎁`,
      html,
      text: `Bonne nouvelle : ${giftLabel} sur votre abonnement Kado. Accès garanti jusqu'au ${endsFr}.`,
    });
    emailSent = r.ok;
  }

  return Response.json({
    ok: true,
    subscription_ends_at: ends.toISOString(),
    emailSent,
  });
}
