export type Prize = {
  id: string;
  label: string;
  emoji: string;
  weight: number;
  color: string;
  position: number;
};

/**
 * Tire un index de cadeau selon les poids (probabilités relatives).
 * Effectué CÔTÉ SERVEUR pour éviter toute triche et fiabiliser les stats.
 */
export function weightedIndex(prizes: Pick<Prize, "weight">[]): number {
  const total = prizes.reduce((s, p) => s + Math.max(0, p.weight), 0);
  if (total <= 0) return Math.floor(Math.random() * prizes.length);
  let r = Math.random() * total;
  for (let i = 0; i < prizes.length; i++) {
    r -= Math.max(0, prizes[i].weight);
    if (r < 0) return i;
  }
  return prizes.length - 1;
}

/** Code de lot court et lisible, ex: "SR-4K9Q2". */
export function generateCode(prefix = "SR"): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}
