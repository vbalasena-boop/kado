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

/**
 * Source de vérité unique : un lot est-il « perdant » (aucun gain) ?
 *
 * Historiquement, la distinction gagné/perdu reposait sur la sous-chaîne
 * « rien » dans le libellé, dupliquée à ~6 endroits (jeu, validation en caisse,
 * plafond quotidien, stats). Les centraliser ici évite qu'elles divergent : une
 * seule définition à faire évoluer. (Correctif complet recommandé : une colonne
 * booléenne explicite `is_losing`, indépendante du libellé.)
 */
export function labelIsLosing(label: string | null | undefined): boolean {
  return !!label && label.toLowerCase().includes("rien");
}

/**
 * Vérité unique : un lot / un tour est-il « perdant » ?
 * Priorité au drapeau explicite `is_losing` (colonne 0037) quand il vaut `true` ;
 * repli sur le libellé sinon (données antérieures à la migration, ou drapeau non
 * renseigné). Ainsi renommer une case perdante ne casse plus la détection dès
 * lors que `is_losing = true` est posé, sans jamais régresser sur l'existant.
 */
export function prizeIsLosing(p: {
  is_losing?: boolean | null;
  label?: string | null;
}): boolean {
  return p.is_losing === true || labelIsLosing(p.label);
}

/**
 * Code de lot court et lisible, ex: "KD-4K9Q2".
 *
 * Tirage CRYPTOGRAPHIQUE (getRandomValues, dispo en Node et Edge) au lieu de
 * `Math.random()` : les codes de récompense/fidélité ne doivent pas être
 * devinables. Échantillonnage par rejet (buf < 252 = 36×7) pour un tirage
 * uniforme sur l'alphabet base36, sans biais de modulo.
 */
export function generateCode(prefix = "KD"): string {
  const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"; // 36 caractères
  const buf = new Uint8Array(1);
  let s = "";
  while (s.length < 5) {
    globalThis.crypto.getRandomValues(buf);
    if (buf[0] < 252) s += A[buf[0] % 36];
  }
  return `${prefix}-${s}`;
}
