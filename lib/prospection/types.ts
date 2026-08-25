/**
 * Prospection Kado — types et constantes partagés.
 *
 * Source unique de vérité pour les valeurs "enum" du module prospection.
 * Ces listes DOIVENT rester alignées avec les contraintes CHECK de la
 * migration `supabase/migrations/0043_prospection.sql`.
 */

// ---------- Segments (catégories de commerces ciblés) ----------
export const PROSPECT_SEGMENTS = [
  "resto", // restos / bars / cafés
  "beaute", // beauté / coiffure
  "boutique", // boutiques / retail
  "sport", // sport / bien-être
  "autre",
] as const;
export type ProspectSegment = (typeof PROSPECT_SEGMENTS)[number];

// ---------- Statuts d'un prospect (cycle de vie) ----------
export const PROSPECT_STATUSES = [
  "new", // sourcé, pas encore traité
  "queued", // approuvé, en attente d'envoi
  "emailed", // email de prospection envoyé
  "dm_pending", // DM Instagram préparé, en attente d'envoi humain
  "dm_sent", // DM Instagram envoyé (par l'opérateur)
  "replied", // a répondu
  "interested", // intéressé
  "client", // devenu client Kado
  "excluded", // écarté (ne pas contacter)
] as const;
export type ProspectStatus = (typeof PROSPECT_STATUSES)[number];

// Statuts qui signifient "ne pas (re)mettre dans une liste à contacter".
export const NON_CONTACTABLE_STATUSES: ProspectStatus[] = [
  "replied",
  "interested",
  "client",
  "excluded",
];

/** Un prospect est-il encore contactable (pas déjà traité/exclu) ? */
export function isContactable(status: ProspectStatus): boolean {
  return !NON_CONTACTABLE_STATUSES.includes(status);
}

// ---------- Canaux de message ----------
export const MESSAGE_CHANNELS = ["email", "instagram"] as const;
export type MessageChannel = (typeof MESSAGE_CHANNELS)[number];

// ---------- Statuts d'un message ----------
export const MESSAGE_STATUSES = [
  "draft",
  "approved",
  "sent",
  "skipped",
] as const;
export type MessageStatus = (typeof MESSAGE_STATUSES)[number];

// ---------- Motifs de suppression (ne jamais recontacter) ----------
export const SUPPRESSION_REASONS = [
  "unsubscribed",
  "bounced",
  "manual",
] as const;
export type SuppressionReason = (typeof SUPPRESSION_REASONS)[number];

// ---------- Types de ligne (miroir des tables) ----------
export interface Prospect {
  id: string;
  place_id: string | null;
  name: string;
  category: ProspectSegment | string | null;
  city: string | null;
  address: string | null;
  google_rating: number | null;
  google_reviews_count: number | null;
  google_last_review_at: string | null;
  website: string | null;
  email: string | null;
  instagram_handle: string | null;
  instagram_active: boolean | null;
  score: number | null;
  score_factors: Record<string, unknown> | null;
  status: ProspectStatus;
  exclude_reason: string | null;
  note: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProspectMessage {
  id: string;
  prospect_id: string;
  channel: MessageChannel;
  step: number;
  subject: string | null;
  body: string;
  status: MessageStatus;
  approved_at: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface ProspectEvent {
  id: string;
  prospect_id: string;
  type: string;
  meta: Record<string, unknown> | null;
  created_at: string;
}

export interface SuppressionEntry {
  id: string;
  email: string | null;
  reason: SuppressionReason;
  created_at: string;
}
