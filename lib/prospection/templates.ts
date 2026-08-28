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
  /**
   * Extrait de texte du site du commerce (facultatif) — sert à la rédaction IA
   * pour personnaliser sans rien inventer. Ignoré par les gabarits.
   */
  siteText?: string;
  /** Tonalité souhaitée pour la rédaction IA (equilibre|direct|chaleureux|court). Ignoré par les gabarits. */
  tone?: string;
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
export const FOOTER = [
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

// Petits mots gardés en minuscule au milieu d'un nom (hors 1ᵉʳ mot).
const NAME_SMALL_WORDS = new Set([
  "le", "la", "les", "de", "des", "du", "d", "l", "et", "à", "au", "aux",
  "un", "une", "sur", "chez", "en", "the", "of",
]);

/**
 * Normalise la casse d'un nom de commerce venu de Google (souvent TOUT EN
 * MAJUSCULES → « LE BOUILLON VERSAILLES ») en casse de titre lisible
 * (« Le Bouillon Versailles »). N'agit QUE si le nom est intégralement en
 * capitales — sinon on respecte la casse d'origine (marques stylisées).
 * Évite aussi le faux positif anti-spam « trop de mots en majuscules ».
 */
export function prettyName(name: string): string {
  const raw = (name ?? "").trim();
  if (!raw) return raw;
  // Contient déjà une minuscule → casse volontaire, on ne touche pas.
  if (/[a-zà-ÿ]/.test(raw)) return raw;
  return raw
    .toLocaleLowerCase("fr")
    .split(/\s+/)
    .map((w, i) => {
      if (i > 0 && NAME_SMALL_WORDS.has(w.replace(/[.'’-]$/, ""))) return w;
      // Capitalise après un début de mot, un trait d'union ou une apostrophe.
      return w.replace(/(^|[-'’])([a-zà-ÿ])/g, (_, sep, ch) => sep + ch.toUpperCase());
    })
    .join(" ");
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

/** Index stable choisi pour (seed, salt) dans une liste de `len` éléments. */
function pickIndex(seed: string, salt: string, len: number): number {
  return hash(`${seed}|${salt}`) % len;
}

/** Choisit un élément d'une liste, de façon stable pour (seed, salt). */
function pick<T>(seed: string, salt: string, arr: T[]): T {
  return arr[pickIndex(seed, salt, arr.length)];
}

/**
 * Gabarits d'objet (le `{name}` est remplacé par le nom du prospect). Exposés
 * pour permettre de mesurer le taux de réponse PAR objet (le choix étant
 * déterministe par prospect, on peut le recalculer sans le stocker).
 */
export const SUBJECT_VARIANTS = [
  "Plus d'avis Google pour {name} ?",
  "Une idée pour {name}",
  "{name} : plus d'avis, sans effort",
  "Booster la visibilité de {name} ?",
  "Un mot rapide pour {name}",
] as const;

/** Index (0..N-1) de la variante d'objet reçue par un prospect (seed = son id). */
export function emailSubjectVariant(seed: string): number {
  return pickIndex(seed, "subject", SUBJECT_VARIANTS.length);
}

function seedOf(ctx: TemplateContext): string {
  return ctx.seed || `${ctx.name}|${ctx.city ?? ""}`;
}

/** Génère l'email de prospection (objet + corps) personnalisé + varié. */
export function renderEmail(ctx: TemplateContext): GeneratedEmail {
  const seed = seedOf(ctx);
  const name = prettyName(ctx.name);
  const noun = segmentNoun(ctx.category ?? null);
  const hook = reviewHook(ctx.google_reviews_count);
  const city = ctx.city ? ` à ${ctx.city}` : "";

  const subject = SUBJECT_VARIANTS[emailSubjectVariant(seed)].replace("{name}", name);

  const opener = pick(seed, "opener", [
    `J'ai repéré votre ${noun}${city} et j'ai remarqué que ${hook}.`,
    `Je suis tombé sur votre ${noun}${city} — j'ai vu que ${hook}.`,
    `En parcourant les ${noun}s${city}, le vôtre a attiré mon attention : ${hook}.`,
    `Petit message au sujet de votre ${noun}${city} : ${hook}.`,
  ]);

  // Pitch court, sobre (ton personnel 1:1 — on évite le vocabulaire « pub »
  // qui envoie l'email dans l'onglet Promotions de Gmail).
  const pitch = pick(seed, "pitch", [
    `On aide les commerces comme le vôtre à obtenir plus d'avis Google et ` +
      `d'abonnés Instagram, à partir d'un simple QR code en boutique — sans effort ` +
      `de votre côté.`,
    `Avec Kado, un QR code en boutique amène naturellement plus d'avis Google et ` +
      `d'abonnés Instagram, sans rien à gérer pour vous.`,
    `L'idée de Kado : un QR code en boutique qui vous ramène des avis Google et des ` +
      `abonnés Instagram, simplement.`,
  ]);

  // 1er email : PAS de lien (un lien pousse Gmail à classer en Promotions).
  // On invite à répondre ; le lien de RDV revient dans les relances.
  const cta = pick(seed, "cta", [
    `Est-ce un sujet sur lequel vous aimeriez avancer ? Un simple mot en réponse et ` +
      `je vous en dis plus.`,
    `Ça vous parle ? Répondez-moi et on en discute rapidement, quand vous voulez.`,
    `Si le sujet vous intéresse, dites-le-moi en réponse et je reviens vers vous avec ` +
      `les détails.`,
  ]);

  const signoff = pick(seed, "signoff", [
    `Belle journée,`,
    `Au plaisir,`,
    `Bien à vous,`,
    `À très vite,`,
  ]);

  // Email court : accroche + pitch (avec hook essai) + CTA.
  const body = [
    `Bonjour ${name},`,
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
  const name = prettyName(ctx.name);
  const noun = segmentNoun(ctx.category ?? null);

  const subject = pick(seed, "fu_subject", [
    `Re: pour ${name}`,
    `Petit rappel pour ${name}`,
    `On se manque pour ${name} ?`,
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
        `Si le sujet vous parle, réservez un appel de 15 min quand vous ` +
          `voulez → ${booking}`,
        `Le plus rapide : choisissez un créneau pour un court échange ` +
          `téléphonique → ${booking}`,
        `Un appel de 15 min pour en parler ? Réservez ici → ${booking}`,
      ])
    : pick(seed, "fu_cta", [
        `Un simple « oui » et je vous rappelle quand vous voulez.`,
        `Dites-moi si un court appel de 15 min vous intéresse.`,
        `Répondez-moi avec un créneau et je vous appelle.`,
      ]);

  const body = [
    `Bonjour ${name},`,
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

/**
 * Génère le DERNIER email (3ᵉ contact, « break-up ») — court, sans pression,
 * souvent le plus efficace pour déclencher une réponse. Varié.
 */
export function renderLastEmail(ctx: TemplateContext): GeneratedEmail {
  const seed = seedOf(ctx);
  const name = prettyName(ctx.name);

  const subject = pick(seed, "last_subject", [
    `Dernier message pour ${name}`,
    `Je vous laisse tranquille — ${name}`,
    `On en reste là pour ${name} ?`,
  ]);

  const opener = pick(seed, "last_opener", [
    `Je ne veux pas encombrer votre boîte, donc ce sera mon dernier message.`,
    `Promis, je n'insiste plus après celui-ci.`,
    `Un tout dernier mot, et je vous laisse tranquille.`,
  ]);

  const pitch = pick(seed, "last_pitch", [
    `Si récolter plus d'avis Google et d'abonnés Instagram via un petit jeu à ` +
      `scanner vous intéresse un jour, répondez simplement à cet email.`,
    `Si l'idée d'un jeu à scanner qui vous ramène des avis Google et des abonnés ` +
      `vous parle un jour, un mot suffit et je m'occupe du reste.`,
  ]);

  const booking = resolveBooking(ctx);
  const cta = booking
    ? pick(seed, "last_cta_book", [
        `Sinon, je n'insiste plus — le lien reste ici si besoin : ${booking}`,
        `Le créneau reste dispo au cas où → ${booking}. Belle continuation !`,
      ])
    : pick(seed, "last_cta", [
        `Sinon, je n'insiste plus — belle continuation à ${name} !`,
        `Sans réponse, je n'y reviendrai pas. Belle continuation !`,
      ]);

  const body = [
    `Bonjour ${name},`,
    ``,
    opener,
    ``,
    pitch,
    ``,
    cta,
    ``,
    `Bien à vous,`,
    `L'équipe Kado`,
    ``,
    FOOTER,
  ].join("\n");

  return { subject, body };
}

/** Génère un DM Instagram court, naturel et varié pour un prospect. */
export function renderDm(ctx: TemplateContext): string {
  const seed = seedOf(ctx);
  const name = prettyName(ctx.name);
  const hook = reviewHook(ctx.google_reviews_count);

  const opener = pick(seed, "dm_opener", [
    `Bonjour ${name} 👋`,
    `Hello ${name} 👋`,
    `Coucou ${name} 🙂`,
  ]);

  const body = pick(seed, "dm_body", [
    `On adore ce que vous faites ! On a vu que ${hook} — on aide les commerces comme ` +
      `le vôtre à en obtenir plus (et des abonnés Insta), à partir d'un simple QR code en boutique 🙂`,
    `Super compte ! On a remarqué que ${hook}. Kado aide les commerces à récolter plus ` +
      `d'avis Google et d'abonnés, simplement, via un QR code sur place.`,
    `On aime beaucoup votre univers ✨ On a vu que ${hook} — avec Kado, un QR code en ` +
      `boutique vous ramène des avis Google et des abonnés, sans effort.`,
  ]);

  // Sur Instagram, on évite de coller un lien brut dans un DM à froid (risque
  // de blocage du compte) : on propose l'appel « par réponse ». Mettez plutôt
  // votre lien de réservation dans la BIO du compte.
  const cta = pick(seed, "dm_cta", [
    `Ça vous dit un échange rapide de 15 min ? Répondez-moi et on cale un créneau 🙂`,
    `On peut en parler 15 min par téléphone ? Dites-moi vos dispos 😉`,
    `Envie d'en discuter 15 min ? Répondez et on trouve un créneau ✨`,
  ]);

  return [opener, body, cta].join("\n\n");
}
