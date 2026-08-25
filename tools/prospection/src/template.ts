import { config } from './config';
import type { Prospect } from './db';

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Construit le mail personnalisé "Constat + Projection" pour un commerce.
 * - Constat  : son nombre d'avis vs le concurrent le plus fort de sa recherche.
 * - Projection: estimation d'avis récoltables en 90 jours avec Kado.
 * Inclut les mentions RGPD (identification + désinscription).
 */
export function renderEmail(p: Prospect): RenderedEmail {
  const gap = Math.max(0, p.leaderReviews - p.reviews);
  const projection = Math.round(config.projectionPerDay * 90);
  const ratingTxt = p.rating ? `${p.rating.toString().replace('.', ',')}★` : '';
  const demoLine = config.demoUrl
    ? `\nVoir une démo en 20 s : ${config.demoUrl}\n`
    : '';

  const subject = `${p.name} : ${p.reviews} avis Google, ${p.leaderName} en a ${p.leaderReviews}`;

  const text = `Bonjour,

En cherchant "${p.query}" sur Google, ${p.name} ressort avec ${p.reviews} avis${
    ratingTxt ? ' (' + ratingTxt + ')' : ''
  }.
Juste devant, ${p.leaderName} en affiche ${p.leaderReviews} — soit ${gap} de plus, et l'essentiel des clics des clients qui hésitent.

Kado aide les commerces à combler cet écart, simplement : vos clients scannent un QR code, jouent à une roue, et laissent un avis Google (ou vous suivent sur Instagram) pour gagner un petit cadeau. Le tour est verrouillé côté serveur, donc pas de triche.
À raison d'un avis récolté par jour, cela représente ~${projection} avis supplémentaires sur 90 jours.
${demoLine}
Si le sujet vous intéresse, je vous montre en 2 minutes ce que ça donnerait pour ${p.name}. Répondez simplement à ce mail.

Bien à vous,
${config.senderName}
${config.senderBusiness} — ${config.replyEmail}

—
Vous recevez ce message à titre professionnel, car votre établissement est référencé publiquement. Pour ne plus être contacté, répondez « STOP » à ce mail.`;

  const esc = (s: string) =>
    s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const html = `<div style="font-family:-apple-system,Segoe UI,Roboto,Arial,sans-serif;font-size:15px;line-height:1.55;color:#1a1a1a">
<p>Bonjour,</p>
<p>En cherchant «&nbsp;${esc(p.query)}&nbsp;» sur Google, <strong>${esc(
    p.name,
  )}</strong> ressort avec <strong>${p.reviews} avis</strong>${
    ratingTxt ? ' (' + ratingTxt + ')' : ''
  }.<br>
Juste devant, <strong>${esc(p.leaderName)}</strong> en affiche <strong>${
    p.leaderReviews
  }</strong> — soit ${gap} de plus, et l'essentiel des clics des clients qui hésitent.</p>
<p><strong>Kado</strong> aide les commerces à combler cet écart&nbsp;: vos clients scannent un QR&nbsp;code, jouent à une roue, et laissent un avis Google (ou vous suivent sur Instagram) pour gagner un petit cadeau. Le tour est verrouillé côté serveur, donc pas de triche.<br>
À raison d'un avis par jour, cela représente <strong>~${projection} avis supplémentaires sur 90&nbsp;jours</strong>.</p>
${
  config.demoUrl
    ? `<p><a href="${esc(config.demoUrl)}">Voir une démo en 20&nbsp;secondes →</a></p>`
    : ''
}
<p>Si le sujet vous intéresse, je vous montre en 2&nbsp;minutes ce que ça donnerait pour ${esc(
    p.name,
  )}. Répondez simplement à ce mail.</p>
<p>Bien à vous,<br>${esc(config.senderName)}<br>${esc(
    config.senderBusiness,
  )} — ${esc(config.replyEmail)}</p>
<hr style="border:none;border-top:1px solid #ddd;margin:18px 0">
<p style="font-size:12px;color:#888">Vous recevez ce message à titre professionnel, car votre établissement est référencé publiquement. Pour ne plus être contacté, répondez «&nbsp;STOP&nbsp;» à ce mail.</p>
</div>`;

  return { subject, text, html };
}
