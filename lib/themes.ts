// Thèmes prêts à l'emploi proposés au commerçant (3 choix).
// La personnalisation avancée (couleurs libres + décor) est réservée à
// l'admin, pour les clients ayant pris la formule « Installation ».

export type GameTheme = {
  id: string;
  name: string;
  hint: string;
  primary: string;
  accent: string;
  bg: string;
  decor: string;
};

export const GAME_THEMES: GameTheme[] = [
  {
    id: "nuit",
    name: "🌙 Nuit festive",
    hint: "Fond sombre, ambiance fête — le grand classique.",
    primary: "#ffc24d",
    accent: "#ff5d73",
    bg: "#150c29",
    decor: "",
  },
  {
    id: "clair",
    name: "☀️ Clair chic",
    hint: "Fond blanc épuré, textes sombres — élégant et moderne.",
    primary: "#c98a3a",
    accent: "#6d6f7a",
    bg: "#ffffff",
    decor: "",
  },
  {
    id: "sable",
    name: "🏜️ Sable",
    hint: "Fond beige chaud, neutre et chaleureux — sans être typé.",
    primary: "#a9763f",
    accent: "#8a7f6b",
    bg: "#f4ecdf",
    decor: "",
  },
];

const norm = (v?: string | null) => (v || "").trim().toLowerCase();

/** Renvoie l'id du thème correspondant aux couleurs, ou null si personnalisé. */
export function matchTheme(c: {
  primary_color?: string | null;
  accent_color?: string | null;
  bg_color?: string | null;
}): string | null {
  const found = GAME_THEMES.find(
    (t) =>
      norm(t.primary) === norm(c.primary_color) &&
      norm(t.bg) === norm(c.bg_color) &&
      norm(t.accent) === norm(c.accent_color)
  );
  return found ? found.id : null;
}
