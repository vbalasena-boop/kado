/**
 * Prospection Kado — rédaction des messages par IA (Claude).
 *
 * Écrit un email + un DM Instagram personnalisés pour un commerce, à partir de
 * ce qu'on connaît (nom, ville, secteur, avis Google, site). Opt-in : ne
 * s'active que si `ANTHROPIC_API_KEY` est présent. Sinon on retombe sur les
 * gabarits déterministes (0 €).
 *
 * Sécurité / délivrabilité :
 *  - l'IA n'écrit que le CORPS du message ; la signature + désinscription (RGPD)
 *    + le lien de RDV sont AJOUTÉS par le code (jamais oubliés, jamais inventés) ;
 *  - garde-fous : longueur limitée, repli sur gabarit à la moindre erreur ;
 *  - rien n'est envoyé automatiquement : la sortie reste un BROUILLON à valider.
 *
 * Aucune dépendance : appel HTTP direct de l'API Anthropic (comme enrich-serper).
 */
import type { ProspectSegment } from "@/lib/prospection/types";
import {
  FOOTER,
  prettyName,
  type GeneratedEmail,
  type TemplateContext,
} from "@/lib/prospection/templates";

const API_URL = "https://api.anthropic.com/v1/messages";
const DEFAULT_MODEL = "claude-haiku-4-5-20251001";

export function aiWriterConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

function model(): string {
  return (process.env.PROSPECT_AI_MODEL || DEFAULT_MODEL).trim();
}

// --- Tonalité des messages (réglable) ---
export const AI_TONES = ["equilibre", "direct", "chaleureux", "court"] as const;
export type AiTone = (typeof AI_TONES)[number];

const TONE_RULE: Record<AiTone, string> = {
  equilibre: "Ton équilibré : professionnel ET chaleureux, naturel.",
  direct: "Ton direct et efficace : droit au but, phrases courtes, une idée par phrase, pas de fioritures.",
  chaleureux: "Ton chaleureux et humain : bienveillant et proche, quelques mots sympathiques (sans excès ni familiarité déplacée).",
  court: "Ton ultra court : l'email fait 45-60 mots MAX, l'essentiel seulement ; le DM 30-40 mots.",
};

/** Normalise une valeur de ton (ou l'env) vers un ton connu. Défaut : équilibré. */
export function normalizeTone(value?: string | null): AiTone {
  const v = (value ?? process.env.PROSPECT_AI_TONE ?? "").trim().toLowerCase();
  return (AI_TONES as readonly string[]).includes(v) ? (v as AiTone) : "equilibre";
}

const SEGMENT_NOUN: Record<ProspectSegment, string> = {
  resto: "restaurant / bar / café",
  beaute: "salon de beauté / coiffure",
  boutique: "boutique",
  sport: "salle de sport / bien-être",
  autre: "commerce de proximité",
};

function noun(category: string | null): string {
  if (category && category in SEGMENT_NOUN) return SEGMENT_NOUN[category as ProspectSegment];
  return "commerce de proximité";
}

/** Lien de RDV effectif (contexte > variable d'env). */
function bookingUrl(ctx: TemplateContext): string | null {
  const url = (ctx.bookingUrl ?? process.env.PROSPECT_BOOKING_URL ?? "").trim();
  return url || null;
}

export interface AiMessages {
  subject: string;
  body: string; // corps SANS pied de page (ajouté ensuite)
  dm: string;
}

/** Construit les prompts (pur, testable). */
export function buildPrompt(ctx: TemplateContext): { system: string; user: string } {
  const site = (ctx.siteText ?? "").trim();
  const facts = [
    `Nom du commerce : ${prettyName(ctx.name)}`,
    ctx.city ? `Ville : ${ctx.city}` : null,
    `Type : ${noun(ctx.category ?? null)}`,
    ctx.google_reviews_count != null ? `Avis Google : ${ctx.google_reviews_count}` : null,
    site ? `Extrait de leur site (pour personnaliser, SANS rien inventer au-delà) :\n"""${site}"""` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "Tu es un commercial B2B français qui prospecte des commerces de proximité pour Kado.",
    TONE_RULE[normalizeTone(ctx.tone)],
    site
      ? "Un extrait du site du commerce est fourni : appuie-toi dessus pour glisser UN détail concret et juste (ce qu'il propose, sa spécialité) — n'invente jamais au-delà de l'extrait."
      : "",
    "Kado : à partir d'un QR code en boutique, les clients laissent plus d'avis Google et deviennent abonnés Instagram, sans effort pour le commerçant.",
    "Tu écris un email de prospection à froid qui doit ressembler à un message PERSONNEL (1:1) écrit à la main — surtout PAS à une publicité (sinon il tombe dans l'onglet Promotions de Gmail).",
    "Règles strictes :",
    "- Tutoyer JAMAIS le prospect : vouvoiement.",
    "- Personnalise avec le nom/la ville/le secteur, sans en faire trop.",
    "- N'invente AUCUN fait (pas de faux chiffres, pas de fausse visite).",
    "- Pas de MAJUSCULES criardes, pas de '!!!'.",
    "- Bannis totalement le vocabulaire promotionnel : 'gratuit', 'offert', 'cadeau', 'jeu', 'gagnez', 'promo', 'urgent', 'argent', '14 jours'.",
    "- N'ajoute PAS de signature, PAS de mentions légales, PAS de lien de désinscription : c'est ajouté séparément.",
    "- Email : ~60-90 mots. DM Instagram : ~40-60 mots, ton plus direct.",
    "- N'inclus AUCUN lien dans l'email (un lien fait basculer en Promotions). Termine par UNE question simple qui invite à répondre (le prospect répondra s'il est intéressé) — surtout pas de lien de réservation ici.",
    "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :",
    '{"subject": "...", "body": "...", "dm": "..."}',
    "Le body commence par 'Bonjour <nom>,' et se termine par une formule de politesse suivie de 'Vobinson — Kado'.",
  ].join("\n");

  const user = `Rédige l'email et le DM pour ce commerce :\n${facts}`;
  return { system, user };
}

/** Extrait et valide le JSON renvoyé par le modèle (pur, testable). Jette si invalide. */
export function parseAiMessages(text: string): AiMessages {
  // Retire d'éventuels blocs ```json … ``` puis isole le 1er objet {...}.
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;

  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const subject = str(obj.subject);
  const body = str(obj.body);
  const dm = str(obj.dm);
  if (!subject || !body || !dm) throw new Error("missing_fields");
  // Garde-fous de longueur (anti-dérive / anti-spam).
  if (subject.length > 120 || body.length > 1500 || dm.length > 600) {
    throw new Error("too_long");
  }
  return { subject, body, dm };
}

/**
 * Assemble l'email final : corps IA + (optionnel) lien de RDV + pied de page RGPD.
 * `includeBooking` : n'ajoute le lien Calendly QUE pour les relances — le 1er
 * email reste sans lien (meilleure délivrabilité, évite l'onglet Promotions).
 */
export function assembleEmail(
  ctx: TemplateContext,
  ai: { subject: string; body: string },
  includeBooking = false
): GeneratedEmail {
  const booking = bookingUrl(ctx);
  let body = ai.body.trimEnd();
  if (includeBooking && booking && !body.includes(booking)) {
    body += `\n\nRéservez un appel de 15 min quand vous voulez → ${booking}`;
  }
  body += `\n\n${FOOTER}`;
  return { subject: ai.subject, body };
}

type Fetch = typeof fetch;

/**
 * Appelle l'API Anthropic et renvoie {subject, body(+footer), dm}. `doFetch`
 * injectable pour les tests. Jette en cas d'erreur (le caller retombe sur le
 * gabarit).
 */
export async function writeMessagesWithAI(
  ctx: TemplateContext,
  doFetch: Fetch = fetch
): Promise<{ subject: string; body: string; dm: string }> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("not_configured");

  const { system, user } = buildPrompt(ctx);
  const res = await doFetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: 700,
      temperature: 0.7,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`api_${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) throw new Error("empty_response");

  const ai = parseAiMessages(text);
  const email = assembleEmail(ctx, ai);
  return { subject: email.subject, body: email.body, dm: ai.dm };
}

// ---------- Relances (2ᵉ / 3ᵉ email) écrites par IA ----------

export type FollowupKind = "followup" | "last";

/** Appel bas niveau de l'API Claude → texte brut. Jette en cas d'erreur. */
async function callClaude(system: string, user: string, doFetch: Fetch): Promise<string> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("not_configured");
  const res = await doFetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: model(),
      max_tokens: 600,
      temperature: 0.7,
      system,
      messages: [{ role: "user", content: user }],
    }),
  });
  if (!res.ok) throw new Error(`api_${res.status}`);
  const data = (await res.json()) as { content?: { type: string; text?: string }[] };
  const text = (data.content ?? [])
    .filter((b) => b.type === "text")
    .map((b) => b.text ?? "")
    .join("");
  if (!text) throw new Error("empty_response");
  return text;
}

/** Prompts pour une relance (2ᵉ contact) ou le dernier email « break-up » (3ᵉ). */
export function buildFollowupPrompt(
  ctx: TemplateContext,
  kind: FollowupKind
): { system: string; user: string } {
  const booking = bookingUrl(ctx);
  const facts = [
    `Nom du commerce : ${prettyName(ctx.name)}`,
    ctx.city ? `Ville : ${ctx.city}` : null,
    `Type : ${noun(ctx.category ?? null)}`,
    ctx.google_reviews_count != null ? `Avis Google : ${ctx.google_reviews_count}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const stepRule =
    kind === "last"
      ? [
          "Contexte : c'est le DERNIER message (email de rupture / « break-up »), après un 1er email et une relance restés SANS RÉPONSE.",
          "Ton : détendu, sans aucune pression, TRÈS court (~40-70 mots). Dis clairement que c'est ton dernier message et que tu ne réécriras plus.",
          "Laisse une porte ouverte simple (un mot suffit / réserver un appel).",
        ].join("\n")
      : [
          "Contexte : c'est une RELANCE (2ᵉ contact), après un 1er email resté SANS RÉPONSE.",
          "Ton : poli, léger, sans insister, court (~50-80 mots). Rappelle brièvement l'intérêt de Kado.",
        ].join("\n");

  const system = [
    "Tu es un commercial B2B français qui relance des commerces de proximité pour Kado.",
    "Kado : un jeu à scanner (QR code) en boutique qui transforme les clients en avis Google et en abonnés Instagram. 14 jours offerts, sans engagement.",
    TONE_RULE[normalizeTone(ctx.tone)],
    stepRule,
    "Règles strictes :",
    "- Vouvoiement.",
    "- N'invente AUCUN fait (pas de faux chiffres, pas de fausse visite).",
    "- Pas de MAJUSCULES criardes, pas de '!!!'. Bannis le vocabulaire promotionnel : 'gratuit', 'offert', 'cadeau', 'jeu', 'gagnez', 'promo', 'urgent', 'argent'.",
    "- N'ajoute PAS de signature, PAS de mentions légales, PAS de lien de désinscription : c'est ajouté séparément.",
    booking
      ? `- Si tu proposes un appel, utilise ce lien EXACT : ${booking}`
      : "- Si tu proposes un appel, demande simplement au prospect ses disponibilités.",
    "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :",
    '{"subject": "...", "body": "..."}',
    "Le body commence par 'Bonjour <nom>,' et se termine par une formule de politesse suivie de 'Vobinson — Kado'.",
  ].join("\n");

  const user = `Rédige ${kind === "last" ? "le dernier email" : "la relance"} pour ce commerce (messages précédents restés sans réponse) :\n${facts}`;
  return { system, user };
}

/** Valide le JSON d'un email de relance (subject + body). Jette si invalide. */
export function parseAiEmail(text: string): { subject: string; body: string } {
  const cleaned = text.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = cleaned.indexOf("{");
  const end = cleaned.lastIndexOf("}");
  if (start < 0 || end <= start) throw new Error("no_json");
  const obj = JSON.parse(cleaned.slice(start, end + 1)) as Record<string, unknown>;
  const str = (v: unknown) => (typeof v === "string" ? v.trim() : "");
  const subject = str(obj.subject);
  const body = str(obj.body);
  if (!subject || !body) throw new Error("missing_fields");
  if (subject.length > 120 || body.length > 1500) throw new Error("too_long");
  return { subject, body };
}

/**
 * Écrit une relance (ou le dernier email) par IA, pied de page RGPD + lien de
 * RDV ajoutés par le code. Jette en cas d'erreur (le caller retombe sur le
 * gabarit).
 */
export async function writeFollowupWithAI(
  ctx: TemplateContext,
  kind: FollowupKind,
  doFetch: Fetch = fetch
): Promise<GeneratedEmail> {
  const { system, user } = buildFollowupPrompt(ctx, kind);
  const text = await callClaude(system, user, doFetch);
  // Relances : on garde le lien de RDV (l'historique justifie déjà l'échange).
  return assembleEmail(ctx, parseAiEmail(text), true);
}
