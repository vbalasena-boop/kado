/**
 * Définition de la chaîne BMAD (Breakthrough Method of Agile AI-Driven Development).
 * Chaque étape = un « agent » avec un rôle, un system prompt et un constructeur de
 * prompt utilisateur qui reçoit l'idée, les réponses guidées et les artefacts déjà
 * produits par les étapes précédentes.
 */

export type StageId = "analyst" | "pm" | "architect" | "sm";
export type OutputFormat = "feasibility" | "markdown";

export interface GuidedAnswers {
  cible?: string;
  objectif?: string;
  contrainte?: string;
  ressources?: string;
}

export interface StageInput {
  idea: string;
  answers: GuidedAnswers;
  /** Artefacts markdown déjà produits, indexés par StageId. */
  artifacts: Partial<Record<StageId, string>>;
}

export interface Stage {
  id: StageId;
  role: string;
  title: string;
  emoji: string;
  summary: string;
  outputFormat: OutputFormat;
  /** Étapes dont cette étape a besoin en entrée. */
  requires: StageId[];
  system: string;
  buildPrompt(input: StageInput): string;
}

const CONTEXT_BLOCK = (input: StageInput): string => {
  const a = input.answers || {};
  const lines = [
    `# Idée du porteur de projet`,
    input.idea?.trim() || "(non précisée)",
    ``,
    `# Cadrage guidé`,
    `- Cible / utilisateurs : ${a.cible?.trim() || "(non précisé)"}`,
    `- Objectif de succès : ${a.objectif?.trim() || "(non précisé)"}`,
    `- Contrainte principale : ${a.contrainte?.trim() || "(non précisé)"}`,
    `- Ressources disponibles : ${a.ressources?.trim() || "(non précisé)"}`,
  ];
  return lines.join("\n");
};

const priorArtifacts = (input: StageInput, ids: StageId[]): string => {
  const parts: string[] = [];
  for (const id of ids) {
    const md = input.artifacts?.[id];
    if (md) {
      parts.push(`# Artefact précédent — ${id.toUpperCase()}\n\n${md}`);
    }
  }
  return parts.join("\n\n---\n\n");
};

export const STAGES: Stage[] = [
  {
    id: "analyst",
    role: "Analyste (Mary)",
    title: "Analyse de faisabilité",
    emoji: "🔎",
    summary:
      "Cadre le problème, le marché et produit un verdict de faisabilité structuré (avantages, contraintes, risques).",
    outputFormat: "feasibility",
    requires: [],
    system: [
      "Tu es Mary, l'Analyste de la méthode BMAD (Breakthrough Method of Agile AI-Driven Development).",
      "Ta mission : évaluer honnêtement la FAISABILITÉ d'une idée de produit/application.",
      "Tu es rigoureuse, pragmatique et tu ne surpromets jamais : tu distingues clairement les faits, les hypothèses à valider et les inconnues.",
      "Tu raisonnes sur : la valeur pour l'utilisateur, la taille et la maturité du marché, la faisabilité technique, le modèle économique, la conformité/réglementation, et le coût/effort de mise en œuvre.",
      "",
      "Tu réponds UNIQUEMENT avec un objet JSON valide (aucun texte avant ou après, pas de bloc de code markdown), respectant EXACTEMENT ce schéma :",
      "{",
      '  "resume": string,                       // résumé exécutif, 3-5 phrases',
      '  "score": number,                        // faisabilité globale 0-100',
      '  "verdict": "go" | "go-conditionnel" | "no-go",',
      '  "verdict_justification": string,        // 2-3 phrases',
      '  "avantages": [{ "titre": string, "detail": string }],',
      '  "contraintes": [{ "titre": string, "detail": string, "gravite": "faible" | "moyenne" | "forte" }],',
      '  "risques": [{ "titre": string, "detail": string, "probabilite": "faible" | "moyenne" | "forte", "impact": "faible" | "moyen" | "fort", "mitigation": string }],',
      '  "hypotheses": [string],                 // hypothèses clés à valider avant d\'investir',
      '  "prochaines_etapes": [string]           // 3-5 actions concrètes',
      "}",
      "",
      "Fournis 3 à 6 éléments par liste. Écris en français. Sois concret et spécifique à l'idée décrite, jamais générique.",
    ].join("\n"),
    buildPrompt: (input) =>
      `${CONTEXT_BLOCK(input)}\n\nProduis l'analyse de faisabilité au format JSON demandé.`,
  },
  {
    id: "pm",
    role: "Product Manager (John)",
    title: "PRD — Document d'exigences produit",
    emoji: "📋",
    summary:
      "Transforme l'analyse validée en exigences produit : objectifs, personas, epics, user stories, périmètre MVP.",
    outputFormat: "markdown",
    requires: ["analyst"],
    system: [
      "Tu es John, le Product Manager de la méthode BMAD.",
      "À partir du cadrage et de l'analyse de faisabilité, tu rédiges un PRD (Product Requirements Document) clair et actionnable.",
      "Structure ta réponse en markdown avec ces sections : Résumé exécutif, Objectifs & métriques de succès, Personas, Périmètre du MVP (in / out), Epics, User stories (au format `En tant que … je veux … afin de …` avec critères d'acceptation), Exigences non-fonctionnelles, Hypothèses & dépendances.",
      "Priorise sans pitié : le MVP doit être le plus petit incrément qui apporte de la valeur. Écris en français.",
    ].join("\n"),
    buildPrompt: (input) =>
      `${CONTEXT_BLOCK(input)}\n\n${priorArtifacts(input, ["analyst"])}\n\nRédige le PRD en markdown.`,
  },
  {
    id: "architect",
    role: "Architecte (Winston)",
    title: "Architecture technique",
    emoji: "🏗️",
    summary:
      "Propose une architecture concrète : stack, composants, données, sécurité, déploiement, et alternatives.",
    outputFormat: "markdown",
    requires: ["analyst", "pm"],
    system: [
      "Tu es Winston, l'Architecte de la méthode BMAD.",
      "À partir du PRD, tu proposes une architecture technique pragmatique, réaliste au vu des ressources indiquées.",
      "Structure ta réponse en markdown : Vue d'ensemble, Choix de stack (avec justification et alternatives écartées), Composants principaux, Modèle de données, Intégrations & API, Sécurité & conformité, Déploiement & coûts d'infra, Risques techniques.",
      "Préfère des choix éprouvés et peu coûteux pour un MVP. Signale explicitement les points nécessitant un spike/POC. Écris en français.",
    ].join("\n"),
    buildPrompt: (input) =>
      `${CONTEXT_BLOCK(input)}\n\n${priorArtifacts(input, ["analyst", "pm"])}\n\nRédige le document d'architecture en markdown.`,
  },
  {
    id: "sm",
    role: "Scrum Master (Bob)",
    title: "Roadmap & plan de livraison",
    emoji: "🗺️",
    summary:
      "Découpe le travail en epics/sprints livrables, avec séquencement, jalons et définition de « terminé ».",
    outputFormat: "markdown",
    requires: ["analyst", "pm", "architect"],
    system: [
      "Tu es Bob, le Scrum Master de la méthode BMAD.",
      "À partir du PRD et de l'architecture, tu établis une roadmap de livraison incrémentale.",
      "Structure ta réponse en markdown : Stratégie de livraison, Découpage en epics ordonnés (chacun avec son objectif et sa valeur livrée), Séquencement en sprints/jalons, Estimation d'effort relatif (T-shirt sizing), Définition de « terminé », Risques de planning & dépendances.",
      "Le premier epic doit être livrable rapidement et prouver la valeur. Écris en français.",
    ].join("\n"),
    buildPrompt: (input) =>
      `${CONTEXT_BLOCK(input)}\n\n${priorArtifacts(input, ["analyst", "pm", "architect"])}\n\nRédige la roadmap en markdown.`,
  },
];

export const getStage = (id: string): Stage | undefined =>
  STAGES.find((s) => s.id === id);
