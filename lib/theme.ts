// Thème CSS d'un commerce à partir de ses couleurs — partagé entre la page
// de jeu et la carte de fidélité pour une expérience cohérente côté client.

/** hex -> rgba(...) avec transparence. */
export function rgba(hex: string, a: number) {
  const h = (hex || "#000000").replace("#", "");
  const r = parseInt(h.slice(0, 2), 16) || 0;
  const g = parseInt(h.slice(2, 4), 16) || 0;
  const b = parseInt(h.slice(4, 6), 16) || 0;
  return `rgba(${r},${g},${b},${a})`;
}

/** Mélange une couleur hex vers une cible [r,g,b] (amt 0..1). */
export function mix(hex: string, target: [number, number, number], amt: number) {
  const h = (hex || "#000000").replace("#", "");
  if (h.length !== 6) return hex;
  let r = parseInt(h.slice(0, 2), 16);
  let g = parseInt(h.slice(2, 4), 16);
  let b = parseInt(h.slice(4, 6), 16);
  r = Math.round(r + (target[0] - r) * amt);
  g = Math.round(g + (target[1] - g) * amt);
  b = Math.round(b + (target[2] - b) * amt);
  return "#" + [r, g, b].map((x) => x.toString(16).padStart(2, "0")).join("");
}

export const lighten = (h: string, a: number) => mix(h, [255, 255, 255], a);
export const darken = (h: string, a: number) => mix(h, [0, 0, 0], a);

/** Luminance perçue (0 sombre → 1 clair) d'une couleur hex. */
export function luminance(hex: string) {
  const h = (hex || "#000000").replace("#", "");
  if (h.length !== 6) return 0;
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
}

/** Construit le thème CSS d'un commerce à partir de ses couleurs.
 *  Fond clair → mode clair (textes sombres, cartes blanches). Fond sombre →
 *  thème nuit. */
export function buildTheme(
  primary: string,
  accent: string,
  bg: string,
  bgImage?: string | null
) {
  const isLight = luminance(bg) > 0.55;
  const vars = isLight
    ? `
:root{
  --gold:${primary};
  --gold-deep:${darken(primary, 0.16)};
  --coral:${accent};
  --night:${bg};
  --night-2:${darken(bg, 0.03)};
  --surface:#ffffff;
  --surface-2:${darken(bg, 0.04)};
  --surface-glass:rgba(255,255,255,.88);
  --surface-glass-2:rgba(255,255,255,.8);
  --glow:${lighten(primary, 0.55)};
  --stroke:rgba(30,20,50,.12);
  --cream:#241b35;
  --cream-dim:#6b6480;
  --shadow:0 24px 70px -30px rgba(30,20,50,.28);
}`
    : `
:root{
  --gold:${primary};
  --gold-deep:${darken(primary, 0.16)};
  --coral:${accent};
  --night:${lighten(bg, 0.05)};
  --night-2:${bg};
  --surface:${lighten(bg, 0.16)};
  --surface-2:${lighten(bg, 0.22)};
  --surface-glass:${rgba(lighten(bg, 0.14), 0.72)};
  --surface-glass-2:${rgba(lighten(bg, 0.2), 0.72)};
  --glow:${lighten(bg, 0.3)};
  --stroke:rgba(253,244,227,.16);
}`;
  if (!bgImage) return vars;
  const veil = isLight
    ? `linear-gradient(${rgba("#ffffff", 0.86)}, ${rgba("#ffffff", 0.94)})`
    : `linear-gradient(${rgba(bg, 0.82)}, ${rgba(bg, 0.94)})`;
  return `${vars}
body{
  background:
    ${veil},
    url("${bgImage.replace(/"/g, "")}") center center / cover no-repeat fixed !important;
}`;
}
