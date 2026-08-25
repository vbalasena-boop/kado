/**
 * Prospection Kado — génération des messages (stories C1 + variation).
 *
 * Chaque prospect reçoit une COMBINAISON différente de phrases (objet, accroche,
 * argumentaire, appel à l'action…) pour éviter les emails identiques — signal
 * "bulk" qui fait tomber en spam. La variation est **déterministe par prospect**
 * (seed) : un même commerce garde toujours le même message.
 *
 * Fonctions pures et testables, 0 € (aucune IA). Le lien de désinscription et
 * les mentions RGPD sont insérés via un marqueur remplacé à l'envoi.
 */
import type { ProspectSegment } from "@/lib/prospection/types";

export interface TemplateContext {
  name: string;
  city: string | null;
  category: ProspectSegment | string | null;
  google_reviews_count: number | null;
  /** Graine de variation (ex. id du prospect). Défaut : nom + ville. */
  seed?: string;
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

// --- Moteur de variation déterministe (sans Math.random) ---
function hash(s: string): number {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Choisit un élément d'une liste, de façon stable pour (seed, salt). */
function pick<T>(seed: string, salt: string, arr: T[]): T {
  return arr[hash(`${seed}|${salt}`) % arr.length];
}

function seedOf(ctx: TemplateContext): string {
  return ctx.seed || `${ctx.name}|${ctx.city ?? ""}`;
}

/** Génère l'email de prospection (objet + corps) personnalisé + varié. */
export function renderEmail(ctx: TemplateContext): GeneratedEmail {
  const seed = seedOf(ctx);
  const noun = segmentNoun(ctx.category ?? null);
  const hook = reviewHook(ctx.google_reviews_count);
  const city = ctx.city ? ` à ${ctx.city}` : "";

  const subject = pick(seed, "subject", [
    `Plus d'avis Google pour ${ctx.name} ?`,
    `Une idée pour ${ctx.name}`,
    `${ctx.name} : plus d'avis, sans effort`,
    `Booster la visibilité de ${ctx.name} ?`,
    `Un mot rapide pour ${ctx.name}`,
  ]);

  const opener = pick(seed, "opener", [
    `J'ai repéré votre ${noun}${city} et j'ai remarqué que ${hook}.`,
    `Je suis tombé sur votre ${noun}${city} — j'ai vu que ${hook}.`,
    `En parcourant les ${noun}s${city}, le vôtre a attiré mon attention : ${hook}.`,
    `Petit message au sujet de votre ${noun}${city} : ${hook}.`,
  ]);

  const pitch = pick(seed, "pitch", [
    `Chez Kado, on aide les commerces de proximité à obtenir plus d'avis Google ` +
      `et d'abonnés Instagram grâce à un petit jeu : vos clients scannent un QR code, ` +
      `tournent une roue et gagnent un cadeau — en échange d'un avis ou d'un suivi.`,
    `Kado, c'est un petit jeu à scanner en boutique : vos clients gagnent un cadeau ` +
      `en laissant un avis Google ou en vous suivant sur Instagram. Ludique, et sans ` +
      `effort pour vous.`,
    `On a créé Kado pour transformer vos clients satisfaits en avis Google et en ` +
      `abonnés Instagram : ils scannent un QR code, jouent, gagnent un cadeau.`,
    `Avec Kado, chaque client peut, en 30 secondes, vous laisser un avis Google ou ` +
      `vous suivre sur Insta — motivé par un petit cadeau via un jeu de roue.`,
  ]);

  const cta = pick(seed, "cta", [
    `Seriez-vous ouvert(e) à une démo de 5 minutes ?`,
    `Ça vous dirait d'en voir un aperçu en 5 minutes ?`,
    `Un rapide échange de 5 minutes pour vous montrer, ça vous tente ?`,
    `Je peux vous montrer ce que ça donnerait pour votre ${noun} — 5 minutes suffisent.`,
  ]);

  const signoff = pick(seed, "signoff", [
    `Belle journée,`,
    `Au plaisir d'échanger,`,
    `Bien à vous,`,
    `À très vite,`,
  ]);

  const body = [
    `Bonjour ${ctx.name},`,
    ``,
    opener,
    ``,
    pitch,
    ``,
    cta,
    ``,
    signoff,
    `L'équipe Kado`,
    ``,
    `—`,
    `Vous recevez cet email car votre ${noun} est un professionnel de proximité. ` +
      `Pour ne plus être contacté : ${UNSUBSCRIBE_MARKER}`,
  ].join("\n");

  return { subject, body };
}

/** Génère l'email de RELANCE (2ᵉ contact, si pas de réponse) — varié. */
export function renderFollowupEmail(ctx: TemplateContext): GeneratedEmail {
  const seed = seedOf(ctx);
  const noun = segmentNoun(ctx.category ?? null);

  const subject = pick(seed, "fu_subject", [
    `Re: pour ${ctx.name}`,
    `Petit rappel pour ${ctx.name}`,
    `On se manque pour ${ctx.name} ?`,
  ]);

  const opener = pick(seed, "fu_opener", [
    `Je me permets de revenir vers vous — mon précédent message est peut-être passé inaperçu.`,
    `Petit up au cas où mon message se serait perdu dans votre boîte.`,
    `Je reviens brièvement vers vous, sans vouloir insister.`,
  ]);

  const pitch = pick(seed, "fu_pitch", [
    `En deux mots : Kado aide les ${noun}s comme le vôtre à récolter plus d'avis ` +
      `Google et d'abonnés Instagram, via un petit jeu à scanner en boutique. Zéro effort.`,
    `Pour rappel, Kado transforme vos clients en avis Google et abonnés Insta grâce à ` +
      `un jeu de roue à scanner — sans rien à gérer de votre côté.`,
    `L'idée de Kado : un QR code en boutique, vos clients jouent, gagnent un cadeau, et ` +
      `vous laissent un avis ou un suivi.`,
  ]);

  const cta = pick(seed, "fu_cta", [
    `Un simple « oui » et je vous montre en 5 minutes.`,
    `Dites-moi si une démo de 5 minutes vous intéresse.`,
    `Répondez-moi juste « ok » et je vous envoie un aperçu.`,
  ]);

  const body = [
    `Bonjour ${ctx.name},`,
    ``,
    opener,
    ``,
    pitch,
    ``,
    cta,
    ``,
    `Belle journée,`,
    `L'équipe Kado`,
    ``,
    `—`,
    `Pour ne plus être contacté : ${UNSUBSCRIBE_MARKER}`,
  ].join("\n");

  return { subject, body };
}

/** Génère un DM Instagram court, naturel et varié pour un prospect. */
export function renderDm(ctx: TemplateContext): string {
  const seed = seedOf(ctx);
  const hook = reviewHook(ctx.google_reviews_count);

  const opener = pick(seed, "dm_opener", [
    `Bonjour ${ctx.name} 👋`,
    `Hello ${ctx.name} 👋`,
    `Coucou ${ctx.name} 🙂`,
  ]);

  const body = pick(seed, "dm_body", [
    `On adore ce que vous faites ! On a vu que ${hook} — on aide les commerces comme ` +
      `le vôtre à en obtenir plus (et des abonnés Insta) avec un petit jeu à scanner en boutique 🎡`,
    `Super compte ! On a remarqué que ${hook}. Kado aide les commerces à récolter plus ` +
      `d'avis Google et d'abonnés grâce à un jeu à scanner sur place 🎁`,
    `On aime beaucoup votre univers ✨ On a vu que ${hook} — avec Kado, vos clients jouent ` +
      `et vous laissent un avis ou un suivi, en échange d'un cadeau 🎡`,
  ]);

  const cta = pick(seed, "dm_cta", [
    `Ça vous dirait qu'on vous montre en 2 min ?`,
    `On vous fait une démo rapide ?`,
    `Envie d'en voir un aperçu ?`,
  ]);

  return [opener, body, cta].join("\n\n");
}
