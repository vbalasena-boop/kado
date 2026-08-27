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
  const booking = bookingUrl(ctx);
  const facts = [
    `Nom du commerce : ${prettyName(ctx.name)}`,
    ctx.city ? `Ville : ${ctx.city}` : null,
    `Type : ${noun(ctx.category ?? null)}`,
    ctx.google_reviews_count != null ? `Avis Google : ${ctx.google_reviews_count}` : null,
  ]
    .filter(Boolean)
    .join("\n");

  const system = [
    "Tu es un commercial B2B français qui prospecte des commerces de proximité pour Kado.",
    "Kado : un jeu à scanner (QR code) en boutique qui transforme les clients en avis Google et en abonnés Instagram. 14 jours offerts, sans engagement.",
    "Tu écris des messages de prospection à froid COURTS, chaleureux, naturels et crédibles — jamais 'spammy'.",
    "Règles strictes :",
    "- Tutoyer JAMAIS le prospect : vouvoiement.",
    "- Personnalise avec le nom/la ville/le secteur, sans en faire trop.",
    "- N'invente AUCUN fait (pas de faux chiffres, pas de fausse visite).",
    "- Pas de MAJUSCULES criardes, pas de '!!!', pas de mots comme 'gratuit', 'promo', 'urgent', 'argent'.",
    "- N'ajoute PAS de signature, PAS de mentions légales, PAS de lien de désinscription : c'est ajouté séparément.",
    "- Email : ~70-100 mots. DM Instagram : ~40-60 mots, ton plus direct.",
    booking
      ? `- Termine l'email par une invitation à réserver un appel de 15 min via ce lien EXACT : ${booking}`
      : "- Termine l'email en proposant un court appel de 15 min et en demandant au prospect ses disponibilités.",
    "Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format :",
    '{"subject": "...", "body": "...", "dm": "..."}',
    "Le body commence par 'Bonjour <nom>,' et se termine par une formule de politesse suivie de 'L\\'équipe Kado'.",
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

/** Assemble l'email final : corps IA + lien de RDV (si manquant) + pied de page RGPD. */
export function assembleEmail(ctx: TemplateContext, ai: AiMessages): GeneratedEmail {
  const booking = bookingUrl(ctx);
  let body = ai.body.trimEnd();
  // Filet de sécurité : garantir la présence du lien de RDV.
  if (booking && !body.includes(booking)) {
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
