/**
 * Prospection Kado — interface d'envoi email (story D0).
 *
 * Contrat unique `sendProspectEmail`, avec une implémentation SMTP dédiée
 * (nodemailer). **Jamais Resend** : le cold email ne doit pas transiter par le
 * compte/domaine transactionnel de Kado (règlement Resend + risque de couper
 * les emails de connexion des commerçants).
 *
 * Tant qu'aucun SMTP n'est configuré (`PROSPECT_SMTP_HOST`), on est en **mode
 * simulation** : rien n'est envoyé, mais le flux fonctionne (dev/test).
 */
import nodemailer from "nodemailer";
import { reportError } from "@/lib/report";
import { UNSUBSCRIBE_MARKER } from "@/lib/prospection/templates";
import { unsubUrl } from "@/lib/prospection/unsub";

export interface SendArgs {
  to: string;
  subject: string;
  text: string;
}

export interface SendResult {
  ok: boolean;
  simulated?: boolean;
  error?: string;
}

/** Remplace le marqueur de désinscription par le vrai lien signé. */
export function finalizeBody(body: string, to: string, siteUrl: string): string {
  return body.split(UNSUBSCRIBE_MARKER).join(unsubUrl(to, siteUrl));
}

function isConfigured(): boolean {
  return Boolean(process.env.PROSPECT_SMTP_HOST && process.env.PROSPECT_EMAIL_FROM);
}

/**
 * Envoie un email de prospection via le SMTP dédié.
 * Ne lève jamais : renvoie un résultat exploitable par l'appelant (cron).
 */
export async function sendProspectEmail(args: SendArgs): Promise<SendResult> {
  if (!isConfigured()) {
    // Mode simulation : aucun envoi réel (pas de SMTP configuré).
    return { ok: true, simulated: true };
  }
  try {
    const transporter = nodemailer.createTransport({
      host: process.env.PROSPECT_SMTP_HOST,
      port: Number(process.env.PROSPECT_SMTP_PORT || 587),
      secure: process.env.PROSPECT_SMTP_SECURE === "true",
      auth: {
        user: process.env.PROSPECT_SMTP_USER,
        pass: process.env.PROSPECT_SMTP_PASS,
      },
    });
    await transporter.sendMail({
      from: process.env.PROSPECT_EMAIL_FROM,
      replyTo: process.env.PROSPECT_REPLY_TO || undefined,
      to: args.to,
      subject: args.subject,
      text: args.text,
    });
    return { ok: true };
  } catch (err) {
    reportError(err, { where: "prospection.sendProspectEmail", to: args.to });
    return { ok: false, error: "send_failed" };
  }
}
