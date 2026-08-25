/**
 * Prospection Kado — moteur de scoring (story B1).
 *
 * Calcule un score de priorité 0–100 par prospect à partir de signaux publics.
 * Principe Kado : **peu d'avis Google = fort potentiel** (Kado sert justement à
 * en générer). Le score est *explicable* : chaque facteur est renvoyé avec sa
 * contribution, pour l'afficher dans l'UI.
 *
 * Fonction pure et déterministe (le "maintenant" est injectable pour les tests).
 */

export interface ScoreInput {
  google_reviews_count: number | null;
  google_rating: number | null;
  google_last_review_at: string | null; // ISO date (yyyy-mm-dd) ou null
  instagram_active: boolean | null;
  email: string | null;
}

export interface ScoreFactor {
  key: "reviews" | "rating" | "freshness" | "instagram" | "contact";
  points: number;
  reason: string;
}

export interface ScoreResult {
  score: number; // 0–100
  factors: ScoreFactor[];
}

// Poids maximum de chaque facteur (somme = 100).
const MAX = {
  reviews: 40,
  rating: 20,
  freshness: 15,
  instagram: 15,
  contact: 10,
} as const;

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n));
const round = (n: number) => Math.round(n);

/** Peu d'avis → beaucoup de points (fort potentiel). Plafonné à 200 avis. */
function reviewsFactor(count: number | null): ScoreFactor {
  if (count == null) {
    return { key: "reviews", points: round(MAX.reviews * 0.5), reason: "Nombre d'avis inconnu" };
  }
  const ratio = clamp(count, 0, 200) / 200;
  const points = round(MAX.reviews * (1 - ratio));
  return {
    key: "reviews",
    points,
    reason: `${count} avis Google${count < 30 ? " (peu — fort potentiel)" : ""}`,
  };
}

/** Note "perfectible" (≈3.5–4.4) = besoin d'alimenter des avis. */
function ratingFactor(rating: number | null): ScoreFactor {
  if (rating == null) {
    return { key: "rating", points: round(MAX.rating * 0.5), reason: "Note inconnue" };
  }
  let points: number;
  let reason: string;
  if (rating >= 3.5 && rating <= 4.4) {
    points = MAX.rating; // zone à améliorer : cible idéale
    reason = `Note ${rating.toFixed(1)} (perfectible — bon potentiel)`;
  } else if (rating < 3.5) {
    points = round(MAX.rating * 0.6); // note basse : utile mais plus difficile
    reason = `Note ${rating.toFixed(1)} (basse)`;
  } else {
    points = round(MAX.rating * 0.4); // déjà excellent : moins de besoin
    reason = `Note ${rating.toFixed(1)} (déjà élevée)`;
  }
  return { key: "rating", points, reason };
}

/** Pas d'avis récent → bon timing pour relancer la dynamique. */
function freshnessFactor(lastReviewAt: string | null, now: Date): ScoreFactor {
  if (!lastReviewAt) {
    return { key: "freshness", points: round(MAX.freshness * 0.7), reason: "Aucune date d'avis récent" };
  }
  const last = new Date(lastReviewAt).getTime();
  if (Number.isNaN(last)) {
    return { key: "freshness", points: round(MAX.freshness * 0.5), reason: "Date d'avis illisible" };
  }
  const months = (now.getTime() - last) / (1000 * 60 * 60 * 24 * 30);
  if (months >= 6) {
    return { key: "freshness", points: MAX.freshness, reason: "Aucun avis depuis 6 mois+ (décroche)" };
  }
  if (months >= 3) {
    return { key: "freshness", points: round(MAX.freshness * 0.6), reason: "Peu d'avis récents" };
  }
  return { key: "freshness", points: 0, reason: "Avis récents (dynamique déjà bonne)" };
}

function instagramFactor(active: boolean | null): ScoreFactor {
  if (active) {
    return { key: "instagram", points: MAX.instagram, reason: "Instagram actif (joignable + engagé)" };
  }
  return { key: "instagram", points: 0, reason: "Pas d'Instagram actif détecté" };
}

function contactFactor(email: string | null): ScoreFactor {
  if (email) {
    return { key: "contact", points: MAX.contact, reason: "Email trouvé (canal email dispo)" };
  }
  return { key: "contact", points: 0, reason: "Pas d'email (Instagram uniquement)" };
}

/** Score un prospect (0–100) avec le détail des facteurs. */
export function scoreProspect(input: ScoreInput, now: Date = new Date()): ScoreResult {
  const factors = [
    reviewsFactor(input.google_reviews_count),
    ratingFactor(input.google_rating),
    freshnessFactor(input.google_last_review_at, now),
    instagramFactor(input.instagram_active),
    contactFactor(input.email),
  ];
  const score = clamp(
    factors.reduce((sum, f) => sum + f.points, 0),
    0,
    100
  );
  return { score, factors };
}
