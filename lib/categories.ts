import { DEFAULT_PRIZES } from "@/lib/defaults";

export type PrizePreset = {
  label: string;
  emoji: string;
  weight: number;
  color: string;
};

export type Category = {
  id: string;
  label: string;
  emoji: string;
  prizes: PrizePreset[];
};

// Palette réutilisée pour les parts de roue
const C = {
  coral: "#ff5d73",
  gold: "#ffc24d",
  mint: "#39d98a",
  violet: "#8b6cff",
  blue: "#4fc3f7",
  orange: "#ff8a5c",
  none: "#5a4a86",
};
const NO_WIN: PrizePreset = {
  label: "Rien cette fois",
  emoji: "🎯",
  weight: 16,
  color: C.none,
};

export const CATEGORIES: Category[] = [
  {
    id: "restaurant",
    label: "Restaurant",
    emoji: "🍽️",
    prizes: [
      { label: "Café offert", emoji: "☕", weight: 22, color: C.coral },
      { label: "Dessert offert", emoji: "🍰", weight: 14, color: C.gold },
      { label: "-10 % sur l'addition", emoji: "🏷️", weight: 18, color: C.mint },
      { label: "Apéritif offert", emoji: "🍹", weight: 10, color: C.blue },
      NO_WIN,
      { label: "Café + dessert", emoji: "🎁", weight: 8, color: C.violet },
    ],
  },
  {
    id: "bar-cafe",
    label: "Bar / Café",
    emoji: "☕",
    prizes: [
      { label: "Café offert", emoji: "☕", weight: 22, color: C.coral },
      { label: "Boisson offerte", emoji: "🍹", weight: 14, color: C.gold },
      { label: "-10 %", emoji: "🏷️", weight: 18, color: C.mint },
      { label: "Pâtisserie offerte", emoji: "🥐", weight: 10, color: C.orange },
      NO_WIN,
      { label: "2 boissons pour 1", emoji: "🍻", weight: 8, color: C.violet },
    ],
  },
  {
    id: "coiffeur",
    label: "Coiffeur",
    emoji: "💇",
    prizes: [
      { label: "Brushing offert", emoji: "💇", weight: 18, color: C.coral },
      { label: "-10 % sur une coupe", emoji: "🏷️", weight: 20, color: C.gold },
      { label: "Soin offert", emoji: "✨", weight: 12, color: C.mint },
      { label: "-20 % coloration", emoji: "💸", weight: 10, color: C.blue },
      NO_WIN,
      { label: "Coupe surprise", emoji: "🎁", weight: 8, color: C.violet },
    ],
  },
  {
    id: "beaute",
    label: "Institut / Ongles",
    emoji: "💅",
    prizes: [
      { label: "Pose offerte", emoji: "💅", weight: 16, color: C.coral },
      { label: "-10 % sur un soin", emoji: "🏷️", weight: 20, color: C.gold },
      { label: "Sourcils offerts", emoji: "✨", weight: 12, color: C.mint },
      { label: "-20 % forfait", emoji: "💸", weight: 10, color: C.blue },
      NO_WIN,
      { label: "Cadeau surprise", emoji: "🎁", weight: 8, color: C.violet },
    ],
  },
  {
    id: "boutique",
    label: "Boutique / Commerce",
    emoji: "🛍️",
    prizes: [
      { label: "-10 %", emoji: "🏷️", weight: 22, color: C.coral },
      { label: "-20 %", emoji: "💸", weight: 12, color: C.gold },
      { label: "Article offert", emoji: "⭐", weight: 10, color: C.mint },
      { label: "Livraison offerte", emoji: "📦", weight: 12, color: C.blue },
      NO_WIN,
      { label: "Cadeau surprise", emoji: "🎁", weight: 8, color: C.violet },
    ],
  },
  {
    id: "boulangerie",
    label: "Boulangerie / Pâtisserie",
    emoji: "🥐",
    prizes: [
      { label: "Viennoiserie offerte", emoji: "🥐", weight: 20, color: C.coral },
      { label: "Café offert", emoji: "☕", weight: 16, color: C.gold },
      { label: "-10 %", emoji: "🏷️", weight: 16, color: C.mint },
      { label: "Pâtisserie offerte", emoji: "🍰", weight: 10, color: C.orange },
      NO_WIN,
      { label: "Baguette offerte", emoji: "🥖", weight: 10, color: C.violet },
    ],
  },
  {
    id: "sport",
    label: "Salle de sport",
    emoji: "💪",
    prizes: [
      { label: "Séance offerte", emoji: "💪", weight: 16, color: C.coral },
      { label: "-10 % abonnement", emoji: "🏷️", weight: 20, color: C.gold },
      { label: "Bouteille offerte", emoji: "💧", weight: 12, color: C.blue },
      { label: "Coaching offert", emoji: "⭐", weight: 8, color: C.mint },
      NO_WIN,
      { label: "1 mois offert", emoji: "🎁", weight: 6, color: C.violet },
    ],
  },
  {
    id: "fleuriste",
    label: "Fleuriste",
    emoji: "🌸",
    prizes: [
      { label: "Fleur offerte", emoji: "🌸", weight: 20, color: C.coral },
      { label: "-10 %", emoji: "🏷️", weight: 18, color: C.gold },
      { label: "Bouquet surprise", emoji: "💐", weight: 10, color: C.mint },
      { label: "-20 %", emoji: "💸", weight: 10, color: C.blue },
      NO_WIN,
      { label: "Cadeau surprise", emoji: "🎁", weight: 8, color: C.violet },
    ],
  },
  {
    id: "autre",
    label: "Autre",
    emoji: "🎁",
    prizes: DEFAULT_PRIZES.map((p) => ({ ...p })),
  },
];

/** Renvoie les cadeaux d'une catégorie (ou les cadeaux génériques par défaut). */
export function prizesForCategory(id?: string | null): PrizePreset[] {
  const cat = CATEGORIES.find((c) => c.id === id);
  return (cat ?? CATEGORIES[CATEGORIES.length - 1]).prizes;
}
