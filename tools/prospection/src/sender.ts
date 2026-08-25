import { Resend } from 'resend';
import { config } from './config';
import type { Prospect } from './db';
import { renderEmail } from './template';

let client: Resend | null = null;
function resend(): Resend {
  if (!client) client = new Resend(config.resendApiKey);
  return client;
}

export interface SendOutcome {
  ok: boolean;
  subject: string;
  error?: string;
}

/** Envoie le mail personnalisé à un prospect (ou le simule si DRY_RUN=true). */
export async function sendToProspect(p: Prospect): Promise<SendOutcome> {
  if (!p.email) return { ok: false, subject: '', error: 'pas d’e-mail' };
  const { subject, text, html } = renderEmail(p);

  if (config.dryRun) {
    console.log(`   [DRY_RUN] → ${p.email}\n   Objet : ${subject}`);
    return { ok: true, subject };
  }

  try {
    const { error } = await resend().emails.send({
      from: `${config.senderName} <${config.fromEmail}>`,
      to: p.email,
      replyTo: config.replyEmail,
      subject,
      text,
      html,
      headers: {
        // Désinscription conforme (RGPD / bonnes pratiques email)
        'List-Unsubscribe': `<mailto:${config.replyEmail}?subject=STOP>`,
      },
    });
    if (error) return { ok: false, subject, error: error.message };
    return { ok: true, subject };
  } catch (e) {
    return { ok: false, subject, error: (e as Error).message };
  }
}
