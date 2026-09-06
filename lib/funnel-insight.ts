/**
 * « Reco » du parcours client : transforme les chiffres bruts de l'entonnoir
 * (scans → tours → Instagram → clics avis Google) en UNE recommandation
 * actionnable, en français, pour le tableau de bord commerçant.
 *
 * Objectif produit : aider le commerçant à récolter PLUS d'avis Google et de
 * visibilité Instagram — sans jamais conditionner le cadeau à un avis (epic 9).
 * On pointe donc l'étape qui « fuit » le plus et on propose un levier conforme.
 *
 * Fonction PURE et déterministe (aucune I/O) → testable au cordeau.
 */

export type FunnelInsightTone = "good" | "tip" | "warn";

export interface FunnelInsight {
  tone: FunnelInsightTone;
  message: string;
}

export interface FunnelSignals {
  /** Scans du QR (1re marche). Comptés seulement depuis leur déploiement. */
  scans: number;
  /** Tours joués (toute la période). */
  plays: number;
  /** Tours ayant utilisé l'action Instagram. */
  insta: number;
  /** Clics vers le lien avis Google. */
  reviewClicks: number;
  /** Lien avis Google configuré ET actif. */
  reviewLinkReady: boolean;
  /** Compte Instagram relié. */
  instagramReady: boolean;
}

/** En-deçà, un ratio n'est pas fiable : on reste encourageant sans diagnostic. */
const MIN_PLAYS = 10;
/** Sous ce taux de clics avis / tours, le lien avis mérite d'être mis en avant. */
const LOW_REVIEW_RATE = 0.15;
/** Sous ce taux Instagram / tours, l'incitation Instagram mérite un coup de pouce. */
const LOW_INSTA_RATE = 0.25;

const pct = (part: number, whole: number) => Math.round((part / whole) * 100);

/**
 * @returns la recommandation la plus prioritaire pour ce parcours. Toujours
 * renvoyée (le bloc entonnoir ne s'affiche que s'il y a déjà de l'activité).
 */
export function funnelInsight(s: FunnelSignals): FunnelInsight {
  const { scans, plays, insta, reviewClicks, reviewLinkReady, instagramReady } = s;

  // 1. Fuite à l'entrée : on scanne mais on ne joue pas (échantillon suffisant).
  if (plays === 0) {
    if (scans >= MIN_PLAYS) {
      return {
        tone: "warn",
        message:
          "Vos clients scannent le QR mais ne lancent pas la roue. Vérifiez que la page s'ouvre vite et va droit au jeu.",
      };
    }
    return {
      tone: "good",
      message:
        "Le suivi démarre. Encore quelques parties et vous verrez précisément où agir.",
    };
  }

  // 2. Lien avis absent : c'est le premier levier « avis Google » à activer.
  if (!reviewLinkReady) {
    return {
      tone: "tip",
      message:
        "Ajoutez votre lien d'avis Google : vos joueurs sont une audience idéale pour récolter des avis — sans jamais conditionner le cadeau.",
    };
  }

  // 3. Échantillon trop faible pour un diagnostic de taux : on encourage.
  if (plays < MIN_PLAYS) {
    return {
      tone: "good",
      message:
        "Bon démarrage. Encore quelques parties et le parcours se lira précisément.",
    };
  }

  // 4. Taux de clics vers les avis trop faible → mettre le lien en avant.
  const reviewRate = reviewClicks / plays;
  if (reviewRate < LOW_REVIEW_RATE) {
    return {
      tone: "tip",
      message: `Seulement ${pct(reviewClicks, plays)}% de vos joueurs cliquent vers vos avis Google. Une relance douce en fin de partie et un lien plus visible augmentent nettement ce taux.`,
    };
  }

  // 5. Avis OK mais Instagram sous-exploité → coup de pouce Instagram.
  if (instagramReady && insta / plays < LOW_INSTA_RATE) {
    return {
      tone: "tip",
      message: `Vos avis progressent bien (${pct(reviewClicks, plays)}%). Côté Instagram, seuls ${pct(insta, plays)}% des joueurs passent par votre compte : mettez votre @ et vos Reels en avant pour gagner en visibilité.`,
    };
  }

  // 6. Tout est sain → on félicite et on chiffre.
  return {
    tone: "good",
    message: `Beau parcours 👍 ${pct(reviewClicks, plays)}% de vos joueurs cliquent vers vos avis Google.`,
  };
}
