import { NextRequest } from "next/server";
import { getAdminUser } from "@/lib/admin-guard";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendEmail, emailLayout, getOwnerContact } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function euros(cents: number, currency: string) {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency.toUpperCase(),
  }).format(cents / 100);
}

/**
 * Rembourse un commerçant (admin).
 * Par défaut : remboursement intégral du dernier paiement.
 * body.amount (en euros, optionnel) = remboursement partiel.
 * Envoie un e-mail de confirmation au propriétaire.
 */
export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const admin = await getAdminUser();
  if (!admin) return Response.json({ error: "forbidden" }, { status: 403 });

  let body: { amount?: number };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const db = getAdminClient();
  const { data: biz } = await db
    .from("businesses")
    .select("name, stripe_customer_id")
    .eq("id", params.id)
    .maybeSingle();
  if (!biz) return Response.json({ error: "not_found" }, { status: 404 });
  const customerId = biz.stripe_customer_id as string | null;
  if (!customerId) {
    return Response.json(
      { error: "Ce commerçant n'a aucun paiement Stripe (pas de client)." },
      { status: 400 }
    );
  }

  const stripe = getStripe();

  // Dernier paiement remboursable de ce client
  let charge;
  try {
    const charges = await stripe.charges.list({ customer: customerId, limit: 10 });
    charge = charges.data.find(
      (c) => c.paid && c.status === "succeeded" && c.amount_refunded < c.amount
    );
  } catch {
    return Response.json({ error: "Erreur Stripe (liste des paiements)." }, { status: 502 });
  }
  if (!charge) {
    return Response.json(
      { error: "Aucun paiement remboursable trouvé pour ce commerçant." },
      { status: 400 }
    );
  }

  // Montant : partiel (euros) ou intégral du reste
  const remaining = charge.amount - charge.amount_refunded;
  let amountCents: number | undefined;
  if (typeof body.amount === "number" && body.amount > 0) {
    amountCents = Math.round(body.amount * 100);
    if (amountCents > remaining) amountCents = remaining;
  }

  let refunded;
  try {
    refunded = await stripe.refunds.create({
      charge: charge.id,
      ...(amountCents ? { amount: amountCents } : {}),
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "échec du remboursement";
    return Response.json({ error: `Stripe : ${msg}` }, { status: 502 });
  }

  const refundedLabel = euros(refunded.amount, charge.currency);

  // E-mail au commerçant
  let emailSent = false;
  const { email } = await getOwnerContact(db, params.id);
  if (email) {
    const html = emailLayout({
      preview: `Remboursement de ${refundedLabel} effectué`,
      emoji: "💶",
      heading: "Votre remboursement a été effectué",
      bodyHtml: `
        <p style="margin:0 0 14px;">Bonjour,</p>
        <p style="margin:0 0 14px;">Nous avons procédé au remboursement de
        <b>${refundedLabel}</b> sur le moyen de paiement utilisé pour votre
        abonnement Kado${biz.name ? ` (« ${biz.name} »)` : ""}.</p>
        <p style="margin:0 0 14px;">Le montant apparaîtra sur votre relevé
        bancaire sous <b>5 à 10 jours ouvrés</b>, selon votre banque.</p>
        <p style="margin:0;">Une question ? Répondez simplement à cet e-mail.</p>`,
      footnote: "Remboursement traité via Stripe.",
    });
    const r = await sendEmail({
      to: email,
      subject: `Kado — remboursement de ${refundedLabel}`,
      html,
      text: `Nous avons remboursé ${refundedLabel} sur votre abonnement Kado. Le montant apparaîtra sous 5 à 10 jours ouvrés.`,
    });
    emailSent = r.ok;
  }

  return Response.json({
    ok: true,
    amount: refundedLabel,
    emailSent,
    ownerEmail: email,
  });
}
