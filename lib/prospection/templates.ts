/**
 * Prospection Kado — génération des messages (story C1).
 *
 * Gabarits par segment avec champs de fusion, dans le ton Kado. Génère un
 * email (objet + corps) et un DM Instagram personnalisés par prospect, avec
 * une accroche liée au **nombre d'avis Google** (cœur de l'argumentaire).
 *
 * Fonctions pures et testables. Le lien de désinscription et les mentions RGPD
 * sont insérés via des marqueurs remplacés au moment de l'envoi (story C3/D).
 */
import type { ProspectSegment } from "@/lib/prospection/types";

export interface TemplateContext {
  name: string;
  city: string | null;
  category: ProspectSegment | string | null;
  google_reviews_count: number | null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

/** Marqueur remplacé par le vrai lien de désinscription à l'envoi. */
export const UNSUBSCRIBE_MARKER = "{{unsubscribe_url}}";

const SEGMENT_NOUN: Record<ProspectSegment, string> = {
  resto: "restaurant",
  beaute: "salon",
  boutique: "boutique",
  sport: "établissement",
  autre: "commerce",
};

function segmentNoun(category: string | null): string {
  if (category && category in SEGMENT_NOUN) {
    return SEGMENT_NOUN[category as ProspectSegment];
  }
  return "commerce";
}

/** Accroche personnalisée selon le nombre d'avis Google. */
export function reviewHook(count: number | null): string {
  if (count == null) return "vos avis Google";
  if (count === 0) return "vous n'avez pas encore d'avis Google";
  if (count < 30) return `vous avez seulement ${count} avis Google`;
  return `vos ${count} avis Google`;
}

/** Génère l'email de prospection (objet + corps) pour un prospect. */
export function renderEmail(ctx: TemplateContext): GeneratedEmail {
  const noun = segmentNoun(ctx.category ?? null);
  const hook = reviewHook(ctx.google_reviews_count);
  const city = ctx.city ? ` à ${ctx.city}` : "";

  const subject =
    ctx.google_reviews_count != null && ctx.google_reviews_count < 30
      ? `Plus d'avis Google pour ${ctx.name} ?`
      : `Une idée pour ${ctx.name}`;

  const body = [
    `Bonjour ${ctx.name},`,
    ``,
    `J'ai repéré votre ${noun}${city} et j'ai remarqué que ${hook}.`,
    ``,
    `Chez Kado, on aide les commerces de proximité à obtenir plus d'avis Google ` +
      `et d'abonnés Instagram grâce à un petit jeu : vos clients scannent un QR code, ` +
      `tournent une roue et gagnent un cadeau — en échange d'un avis ou d'un suivi. ` +
      `Simple, ludique, et sans effort pour vous.`,
    ``,
    `Seriez-vous ouvert(e) à une démo de 5 minutes ? Je peux vous montrer ce que ` +
      `ça donnerait pour votre ${noun}.`,
    ``,
    `Belle journée,`,
    `L'équipe Kado`,
    ``,
    `—`,
    `Vous recevez cet email car votre ${noun} est un professionnel de proximité. ` +
      `Pour ne plus être contacté : ${UNSUBSCRIBE_MARKER}`,
  ].join("\n");

  return { subject, body };
}

/** Génère l'email de RELANCE (2ᵉ contact, si pas de réponse). */
export function renderFollowupEmail(ctx: TemplateContext): GeneratedEmail {
  const noun = segmentNoun(ctx.category ?? null);
  const subject = `Re: pour ${ctx.name}`;
  const body = [
    `Bonjour ${ctx.name},`,
    ``,
    `Je me permets de revenir vers vous — mon précédent message est peut-être ` +
      `passé inaperçu.`,
    ``,
    `En deux mots : Kado aide les ${noun}s comme le vôtre à récolter plus d'avis ` +
      `Google et d'abonnés Instagram, via un petit jeu à scanner en boutique. Zéro ` +
      `effort de votre côté.`,
    ``,
    `Une démo de 5 minutes vous intéresserait-elle ? Un simple « oui » et je vous ` +
      `montre.`,
    ``,
    `Belle journée,`,
    `L'équipe Kado`,
    ``,
    `—`,
    `Pour ne plus être contacté : ${UNSUBSCRIBE_MARKER}`,
  ].join("\n");
  return { subject, body };
}

/** Génère un DM Instagram court et naturel pour un prospect. */
export function renderDm(ctx: TemplateContext): string {
  const hook = reviewHook(ctx.google_reviews_count);
  return [
    `Bonjour ${ctx.name} 👋`,
    `On adore ce que vous faites ! On a vu que ${hook} — on aide les commerces ` +
      `comme le vôtre à en obtenir plus (et des abonnés Insta) avec un petit jeu ` +
      `à scanner en boutique 🎡`,
    `Ça vous dirait qu'on vous montre en 2 min ?`,
  ].join("\n\n");
}
