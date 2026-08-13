/** Cadeaux par défaut d'une nouvelle roue. */
export const DEFAULT_PRIZES = [
  { label: "Café offert", emoji: "☕", weight: 22, color: "#ff5d73" },
  { label: "-10 %", emoji: "🏷️", weight: 20, color: "#8b6cff" },
  { label: "Dessert offert", emoji: "🍰", weight: 12, color: "#39d98a" },
  { label: "Rien cette fois", emoji: "🎯", weight: 14, color: "#5a4a86" },
  { label: "Boisson offerte", emoji: "🍹", weight: 8, color: "#ffc24d" },
  { label: "-20 %", emoji: "💸", weight: 10, color: "#4fc3f7" },
  { label: "Cadeau surprise", emoji: "🎁", weight: 6, color: "#ff8a5c" },
  { label: "1 visite -15 %", emoji: "⭐", weight: 8, color: "#ff5d73" },
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
