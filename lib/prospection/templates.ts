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
  /**
   * Lien de réservation d'un RDV téléphonique (ex. Cal.com). Si absent, on
   * lit `PROSPECT_BOOKING_URL`. Sans lien, l'appel à l'action bascule sur une
   * prise de RDV « par réponse » (le prospect répond avec ses créneaux).
   */
  bookingUrl?: string;
}

/** Lien de réservation effectif (contexte > variable d'env > aucun). */
function resolveBooking(ctx: TemplateContext): string | null {
  const url = (ctx.bookingUrl ?? process.env.PROSPECT_BOOKING_URL ?? "").trim();
  return url ? url : null;
}

export interface GeneratedEmail {
  subject: string;
  body: string;
}

/** Marqueur remplacé par le vrai lien de désinscription à l'envoi. */
export const UNSUBSCRIBE_MARKER = "{{unsubscribe_url}}";

/** Pied de page commun : signature + mentions d'origine + désinscription (RGPD). */
const FOOTER = [
  `—`,
  `Kado · la solution qui aide les commerces de proximité (avis Google, ` +
    `Instagram, fidélité) · kado-app.fr`,
  `Vous recevez ce message en tant que professionnel local. Pour ne plus être ` +
    `contacté : ${UNSUBSCRIBE_MARKER}`,
].join("\n");

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

/**
 * Accroche personnalisée selon le nombre d'avis Google.
 * Renvoie TOUJOURS une proposition complète (avec un verbe), pour s'insérer
 * correctement après « que » / « : » dans les phrases générées.
 */
export function reviewHook(count: number | null): string {
  if (count == null) return "vous êtes présent sur Google";
  if (count === 0) return "vous n'avez pas encore d'avis Google";
  if (count < 30) return `vous avez seulement ${count} avis Google`;
  return `vous avez déjà ${count} avis Google`;
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

  // Pitch court (1 phrase) + hook essai, sans prix.
  const pitch = pick(seed, "pitch", [
    `Kado aide les commerces comme le vôtre à récolter plus d'avis Google et ` +
      `d'abonnés Instagram : vos clients scannent un QR code, jouent et gagnent un ` +
      `cadeau — en échange d'un avis ou d'un suivi. 14 jours offerts, sans engagement.`,
    `Avec Kado, un petit jeu à scanner en boutique transforme vos clients en avis ` +
      `Google et en abonnés Instagram, sans effort pour vous. Testable 14 jours, ` +
      `sans engagement.`,
    `Kado, c'est plus d'avis Google et d'abonnés Insta grâce à un jeu à scanner : ` +
      `vos clients jouent, gagnent un cadeau, vous laissent un avis. 14 jours offerts.`,
  ]);

  const booking = resolveBooking(ctx);
  const cta = booking
    ? pick(seed, "cta_book", [
        `Le plus simple : un court échange téléphonique de 10 min. ` +
          `Réservez le créneau qui vous arrange → ${booking}`,
        `Ça vous dirait d'en parler 10 min au téléphone ? ` +
          `Choisissez votre horaire ici → ${booking}`,
        `Je vous propose un appel rapide de 10 min — ` +
          `réservez quand vous voulez → ${booking}`,
      ])
    : pick(seed, "cta", [
        `Ça vous dirait qu'on en parle 10 min au téléphone ? ` +
          `Répondez-moi avec un créneau et je vous rappelle.`,
        `Un rapide appel de 10 min vous intéresse ? ` +
          `Dites-moi vos dispos, je m'adapte.`,
        `Je peux vous montrer en 5 min ce que ça donnerait pour votre ${noun} — ` +
          `dites-moi quand vous êtes joignable.`,
      ]);

  const signoff = pick(seed, "signoff", [
    `Belle journée,`,
    `Au plaisir,`,
    `Bien à vous,`,
    `À très vite,`,
  ]);

  // Email court : accroche + pitch (avec hook essai) + CTA.
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
    FOOTER,
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
      `Google et d'abonnés Instagram, via un petit jeu à scanner en boutique. ` +
      `14 jours offerts, sans engagement.`,
    `Pour rappel, Kado transforme vos clients en avis Google et abonnés Insta grâce à ` +
      `un jeu à scanner — sans rien à gérer. 14 jours offerts, sans CB.`,
    `L'idée de Kado : un QR code en boutique, vos clients jouent, gagnent un cadeau, ` +
      `et vous laissent un avis ou un suivi. Testable 14 jours, offerts.`,
  ]);

  const booking = resolveBooking(ctx);
  const cta = booking
    ? pick(seed, "fu_cta_book", [
        `Si le sujet vous parle, réservez un appel de 10 min quand vous ` +
          `voulez → ${booking}`,
        `Le plus rapide : choisissez un créneau pour un court échange ` +
          `téléphonique → ${booking}`,
        `Un appel de 10 min pour en parler ? Réservez ici → ${booking}`,
      ])
    : pick(seed, "fu_cta", [
        `Un simple « oui » et je vous rappelle quand vous voulez.`,
        `Dites-moi si un court appel de 10 min vous intéresse.`,
        `Répondez-moi avec un créneau et je vous appelle.`,
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
    FOOTER,
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

  // Sur Instagram, on évite de coller un lien brut dans un DM à froid (risque
  // de blocage du compte) : on propose l'appel « par réponse ». Mettez plutôt
  // votre lien de réservation dans la BIO du compte.
  const cta = pick(seed, "dm_cta", [
    `Ça vous dit un échange rapide de 10 min ? Répondez-moi et on cale un créneau 🙂 (14 jours offerts pour tester)`,
    `On peut en parler 10 min par téléphone ? Dites-moi vos dispos 😉`,
    `Envie d'en discuter 10 min ? Répondez et on trouve un créneau (14 jours offerts) ✨`,
  ]);

  return [opener, body, cta].join("\n\n");
}
