import { z } from "zod";
import { merchantRoute } from "@/lib/api";
import { getAdminClient } from "@/lib/supabase/admin";
import { sendEmail, emailLayout } from "@/lib/email";
import { escapeHtml } from "@/lib/campaigns";
import { reportError } from "@/lib/report";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const Body = z.object({
  email: z.string().email("Adresse e-mail invalide").max(200),
});

/**
 * Changement de l'e-mail de connexion par le commerçant lui-même.
 *
 * Pourquoi côté serveur (admin API) et pas `auth.updateUser` côté client :
 * la connexion se fait par code OTP à usage unique, sans mot de passe. Se
 * « reconnecter » avec un nouvel e-mail crée en réalité un NOUVEAU compte
 * Supabase (nouvel identifiant), et l'établissement — rattaché à l'ancien
 * `owner_user_id` — se retrouve orphelin (effet « doublon » vécu par le
 * commerçant). Ici on met à jour l'e-mail SUR LE MÊME compte
 * (`updateUserById`, id inchangé) : l'établissement reste lié, aucun doublon.
 *
 * La saisie est déjà authentifiée (le commerçant prouve qu'il possède le
 * compte) : on confirme l'e-mail directement (`email_confirm: true`) et on
 * prévient l'ANCIENNE adresse par sécurité. La double-saisie côté UI protège
 * contre la faute de frappe.
 */
export const POST = merchantRoute({
  schema: Body,
  rateLimit: {
    key: ({ ip }) => `account-email:${ip}`,
    limit: 5,
    windowSeconds: 3600,
  },
  handler: async ({ body, user }) => {
    const newEmail = body.email.trim().toLowerCase();
    const oldEmail = (user.email || "").trim().toLowerCase();

    if (!newEmail) {
      return Response.json({ error: "email_required" }, { status: 400 });
    }
    if (newEmail === oldEmail) {
      return Response.json({ error: "same_email" }, { status: 400 });
    }

    const db = getAdminClient();

    // Un autre compte utilise-t-il déjà cet e-mail ? (sinon on créerait un
    // conflit, ou on « fusionnerait » deux comptes distincts). On refuse.
    try {
      const { data: list } = await db.auth.admin.listUsers();
      const clash = list?.users.find(
        (u) => u.id !== user.id && u.email?.toLowerCase() === newEmail
      );
      if (clash) {
        return Response.json({ error: "email_taken" }, { status: 409 });
      }
    } catch (e) {
      // La vérification n'a pas pu aboutir : on laisse `updateUserById`
      // trancher (il refusera lui-même un e-mail déjà pris).
      reportError(e, { where: "account.email.listUsers" });
    }

    const { error } = await db.auth.admin.updateUserById(user.id, {
      email: newEmail,
      email_confirm: true,
    });
    if (error) {
      const msg = (error.message || "").toLowerCase();
      if (msg.includes("already") || msg.includes("registered") || msg.includes("exist")) {
        return Response.json({ error: "email_taken" }, { status: 409 });
      }
      reportError(error, { where: "account.email.update" });
      return Response.json({ error: "update_failed" }, { status: 500 });
    }

    // Notification de sécurité à l'ANCIENNE adresse (best effort).
    if (oldEmail) {
      try {
        const html = emailLayout({
          preview: "L'e-mail de connexion de votre compte Kado a été modifié",
          emoji: "🔐",
          heading: "Votre e-mail de connexion a été modifié",
          bodyHtml: `
            <p style="margin:0 0 14px;">Bonjour,</p>
            <p style="margin:0 0 14px;">L'adresse e-mail utilisée pour vous
            connecter à votre espace Kado vient d'être remplacée par
            <b>${escapeHtml(newEmail)}</b>.</p>
            <p style="margin:0 0 14px;">Vous vous connecterez désormais avec
            cette nouvelle adresse. Cette ancienne adresse ne permet plus
            d'accéder au compte.</p>
            <p style="margin:0;"><b>Ce n'est pas vous ?</b> Répondez
            immédiatement à cet e-mail : nous rétablirons votre accès.</p>`,
        });
        await sendEmail({
          to: oldEmail,
          subject: "Kado — votre e-mail de connexion a été modifié",
          html,
          text: `L'e-mail de connexion de votre compte Kado a été remplacé par ${newEmail}. Ce n'est pas vous ? Répondez à cet e-mail.`,
        });
      } catch (e) {
        reportError(e, { where: "account.email.notifyOld" });
      }
    }

    // Confirmation à la NOUVELLE adresse (best effort).
    try {
      const html = emailLayout({
        preview: "Votre nouvel e-mail de connexion Kado est confirmé",
        emoji: "✅",
        heading: "Nouvel e-mail de connexion confirmé",
        bodyHtml: `
          <p style="margin:0 0 14px;">Bonjour,</p>
          <p style="margin:0 0 14px;">Cette adresse est désormais l'e-mail de
          connexion de votre espace Kado. À votre prochaine connexion, entrez
          cette adresse pour recevoir votre code.</p>
          <p style="margin:0;">Vos établissements, votre roue et vos données
          restent inchangés.</p>`,
      });
      await sendEmail({
        to: newEmail,
        subject: "Kado — votre nouvel e-mail de connexion",
        html,
        text: "Cette adresse est désormais l'e-mail de connexion de votre espace Kado. Vos données restent inchangées.",
      });
    } catch (e) {
      reportError(e, { where: "account.email.notifyNew" });
    }

    return Response.json({ ok: true, email: newEmail });
  },
});
