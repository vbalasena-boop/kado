/**
 * Aide pure pour le champ ville multi-valeurs (autocomplétion).
 * Séparé du composant React pour être testable en environnement node.
 */

/** Séparateurs entre villes : virgule, point-virgule, retour ligne. */
export const CITY_SEP = /[,;\n]/;

/**
 * Découpe la saisie en `[préfixe, jeton]` :
 * - `préfixe` = les villes déjà validées, séparateur inclus (ex. "Versailles, ")
 * - `jeton`   = la ville en cours de frappe, après le dernier séparateur.
 *
 * Sans séparateur, tout est le jeton courant.
 */
export function splitActiveToken(value: string): [string, string] {
  let idx = -1;
  for (let i = value.length - 1; i >= 0; i--) {
    if (CITY_SEP.test(value[i])) {
      idx = i;
      break;
    }
  }
  if (idx === -1) return ["", value];
  return [value.slice(0, idx + 1), value.slice(idx + 1)];
}

/**
 * Remplace le jeton courant par la ville choisie, en conservant les villes
 * déjà saisies. Normalise l'espace après la virgule du préfixe.
 */
export function applyPickedCity(value: string, chosen: string): string {
  const [prefix] = splitActiveToken(value);
  const pretty = prefix && !prefix.endsWith(" ") ? prefix + " " : prefix;
  return pretty + chosen;
}
