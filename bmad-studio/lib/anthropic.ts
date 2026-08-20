import Anthropic from "@anthropic-ai/sdk";

/**
 * Client Claude partagé (serveur uniquement).
 * La clé est lue depuis l'environnement (ANTHROPIC_API_KEY) — jamais côté navigateur.
 */
export const anthropic = new Anthropic();

/**
 * Modèle par défaut. Surchargeable via la variable d'env BMAD_MODEL.
 * Claude Opus 5 offre le meilleur raisonnement pour une analyse de faisabilité ;
 * passe à `claude-sonnet-5` pour réduire le coût si besoin.
 */
export const MODEL = process.env.BMAD_MODEL || "claude-opus-5";
