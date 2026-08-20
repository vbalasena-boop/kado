/** Types et parsing défensif du rapport de faisabilité produit par l'Analyste. */

export type Verdict = "go" | "go-conditionnel" | "no-go";
export type Niveau = "faible" | "moyenne" | "forte";
export type Impact = "faible" | "moyen" | "fort";

export interface Avantage {
  titre: string;
  detail: string;
}

export interface Contrainte {
  titre: string;
  detail: string;
  gravite: Niveau;
}

export interface Risque {
  titre: string;
  detail: string;
  probabilite: Niveau;
  impact: Impact;
  mitigation: string;
}

export interface FeasibilityReport {
  resume: string;
  score: number;
  verdict: Verdict;
  verdict_justification: string;
  avantages: Avantage[];
  contraintes: Contrainte[];
  risques: Risque[];
  hypotheses: string[];
  prochaines_etapes: string[];
}

/**
 * Extrait un objet JSON d'une réponse LLM, même si le modèle a ajouté du texte
 * ou un bloc de code autour. Renvoie null si rien d'exploitable.
 */
export function extractJson<T = unknown>(text: string): T | null {
  if (!text) return null;

  // 1) Bloc de code ```json … ``` s'il existe.
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;

  // 2) Du premier { au dernier } (objet le plus englobant).
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const slice = candidate.slice(start, end + 1);
  try {
    return JSON.parse(slice) as T;
  } catch {
    return null;
  }
}
