/** Cadeaux par défaut d'une nouvelle roue. */
export const DEFAULT_PRIZES = [
  { label: "Café offert", emoji: "☕", weight: 22, color: "#e85b3d" },
  { label: "-10 %", emoji: "🏷️", weight: 20, color: "#efc64f" },
  { label: "Dessert offert", emoji: "🍰", weight: 12, color: "#6d9273" },
  { label: "Rien cette fois", emoji: "🎯", weight: 14, color: "#33204d" },
  { label: "Boisson offerte", emoji: "🍹", weight: 8, color: "#ddd2bf" },
  { label: "-20 %", emoji: "💸", weight: 10, color: "#e85b3d" },
  { label: "Cadeau surprise", emoji: "🎁", weight: 6, color: "#efc64f" },
  { label: "1 visite -15 %", emoji: "⭐", weight: 8, color: "#6d9273" },
];

/** Transforme un nom en slug d'URL (sans accents, minuscules, tirets). */
export function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "")
      .slice(0, 40) || "commerce"
  );
}
