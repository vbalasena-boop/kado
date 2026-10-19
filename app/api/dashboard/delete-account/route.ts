import { NextRequest } from "next/server";
import { getMyBusinesses } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendEmail, emailLayout } from "@/lib/email";
import { escapeHtml } from "@/lib/campaigns";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Suppression du compte par le commerçant lui-même.
 * Annule l'abonnement Stripe de CHAQUE établissement, supprime TOUS ses
 * établissements (roue, cadeaux, tours, fidélité, consentement en cascade)
 * puis supprime le compte utilisateur.
 *
 * Multi-établissements : un compte peut posséder plusieurs boutiques. On les
 * traite TOUTES — sinon les abonnements des autres boutiques continueraient
 * d'être prélevés (le compte étant supprimé, plus aucun moyen de résilier) et
 * leurs données ne seraient jamais effacées (droit à l'effacement RGPD).
 */
export async function POST(_req: NextRequest) {
  const { user, businesses } = await getMyBusinesses();
  if (!user) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const db = getAdminClient();

  // 1) Annuler les abonnements avant toute suppression. En cas d'échec, garder
  // le compte et ses données permet au commerçant de réessayer sans continuer
  // à facturer un compte inaccessible.
  const failedCancellations: string[] = [];
  for (const b of businesses) {
    if (b.stripe_subscription_id) {
      try {
        await getStripe().subscriptions.cancel(b.stripe_subscription_id);
      } catch {
        failedCancellations.push(b.id);
      }
    }
  }
  if (failedCancellations.length) {
    return Response.json({ error: "subscription_cancel_failed" }, { status: 502 });
  }

  // 2) Supprimer TOUS les établissements du propriétaire (cascade :
  //    wheel_configs, prizes, plays, loyalty_cards, consent_events, orders…).
  const { error: delErr } = await db
    .from("businesses")
    .delete()
    .eq("owner_user_id", user.id);
  if (delErr) {
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }

  const firstBusinessName = businesses[0]?.name ?? null;

  // 3) Supprimer le compte utilisateur.
  const { error: authDeleteError } = await db.auth.admin.deleteUser(user.id);
  if (authDeleteError) {
    return Response.json({ error: "account_delete_partial" }, { status: 500 });
  }

  // 4) E-mail de confirmation (best effort), seulement après suppression.
  if (user.email) {
    const html = emailLayout({
      preview: "Votre compte Kado a bien été supprimé",
      emoji: "👋",
      heading: "Votre compte a bien été supprimé",
      bodyHtml: `
        <p style="margin:0 0 14px;">Bonjour,</p>
        <p style="margin:0 0 14px;">Votre espace Kado${
          firstBusinessName ? ` (« ${escapeHtml(firstBusinessName)} »)` : ""
        } et toutes ses données ont été supprimés, et vos abonnements ont été
        résiliés. Vous ne serez plus débité.</p>
        <p style="margin:0;">Merci d'avoir utilisé Kado. La porte reste ouverte —
        vous pourrez recréer un espace à tout moment sur
        <a href="https://kado-app.fr" style="color:#f0a52e;">kado-app.fr</a>.</p>`,
    });
    await sendEmail({
      to: user.email,
      subject: "Kado — votre compte a été supprimé",
      html,
      text: "Votre espace Kado et vos données ont été supprimés, et votre abonnement résilié. À bientôt peut-être sur kado-app.fr.",
    });
  }

  return Response.json({ ok: true });
}
