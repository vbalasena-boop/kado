import { NextRequest } from "next/server";
import { getMyBusiness } from "@/lib/auth";
import { getAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe";
import { sendEmail, emailLayout } from "@/lib/email";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Suppression du compte par le commerçant lui-même.
 * Annule l'abonnement Stripe, supprime l'établissement (roue, cadeaux,
 * tours en cascade) puis supprime le compte utilisateur.
 */
export async function POST(_req: NextRequest) {
  const { user, business } = await getMyBusiness();
  if (!user || !business) {
    return Response.json({ error: "not_authenticated" }, { status: 401 });
  }

  const db = getAdminClient();

  // 1) Annuler l'abonnement Stripe (best effort)
  const subId = (business as any).stripe_subscription_id as string | null;
  if (subId) {
    try {
      await getStripe().subscriptions.cancel(subId);
    } catch {
      /* on continue quand même la suppression */
    }
  }

  // 2) Supprimer l'établissement (cascade : wheel_configs, prizes, plays)
  const { error: delErr } = await db
    .from("businesses")
    .delete()
    .eq("id", business.id)
    .eq("owner_user_id", user.id);
  if (delErr) {
    return Response.json({ error: "delete_failed" }, { status: 500 });
  }

  // 3) E-mail d'adieu (best effort, avant de supprimer le compte)
  if (user.email) {
    const html = emailLayout({
      preview: "Votre compte Kado a bien été supprimé",
      emoji: "👋",
      heading: "Votre compte a bien été supprimé",
      bodyHtml: `
        <p style="margin:0 0 14px;">Bonjour,</p>
        <p style="margin:0 0 14px;">Votre espace Kado${
          business.name ? ` (« ${business.name} »)` : ""
        } et toutes ses données ont été supprimés, et votre abonnement a été
        résilié. Vous ne serez plus débité.</p>
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

  // 4) Supprimer le compte utilisateur (best effort)
  try {
    await db.auth.admin.deleteUser(user.id);
  } catch {
    /* le compte restera sans établissement — sera reproposé l'onboarding */
  }

  return Response.json({ ok: true });
}
