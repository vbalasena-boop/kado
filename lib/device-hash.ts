/**
 * Empreinte d'appareil anonyme, calculée dans le navigateur.
 *
 * Sert de VERROU SECONDAIRE au cookie joueur : contrairement au cookie, une
 * empreinte survit au passage en navigation privée / au vidage des cookies sur
 * le MÊME appareil — c'est ce qui permet de fermer ce trou de rejeu.
 *
 * Ce n'est volontairement PAS un identifiant parfait : deux appareils
 * identiques peuvent produire la même empreinte. Elle n'est donc utilisée que
 * comme signal souple, jamais comme garantie dure. Aucune donnée personnelle
 * n'est stockée : seulement un hachage SHA-256.
 */

/**
 * Valide une empreinte reçue côté serveur : uniquement un hex SHA-256
 * (64 caractères 0-9a-f). Pure et sans DOM → utilisable côté serveur et testable.
 */
export function isValidDeviceHash(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
}

function canvasFingerprint(): string {
  try {
    const c = document.createElement("canvas");
    c.width = 200;
    c.height = 40;
    const ctx = c.getContext("2d");
    if (!ctx) return "";
    ctx.textBaseline = "top";
    ctx.font = "14px 'Arial'";
    ctx.fillStyle = "#f60";
    ctx.fillRect(0, 0, 100, 20);
    ctx.fillStyle = "#069";
    ctx.fillText("Kado✦roue", 2, 2);
    ctx.fillStyle = "rgba(102,204,0,0.7)";
    ctx.fillText("Kado✦roue", 4, 4);
    return c.toDataURL();
  } catch {
    return "";
  }
}

/**
 * Renvoie l'empreinte (hex SHA-256), ou null si indisponible
 * (JS/API restreints). En cas de null, le serveur retombe sur le cookie seul.
 */
export async function deviceHash(): Promise<string | null> {
  try {
    if (typeof window === "undefined" || !window.crypto?.subtle) return null;
    const nav = window.navigator;
    const scr = window.screen;
    const parts = [
      nav.userAgent,
      nav.language,
      Array.isArray(nav.languages) ? nav.languages.join(",") : "",
      (nav as { platform?: string }).platform ?? "",
      String(nav.hardwareConcurrency ?? ""),
      String((nav as { deviceMemory?: number }).deviceMemory ?? ""),
      `${scr.width}x${scr.height}x${scr.colorDepth}`,
      Intl.DateTimeFormat().resolvedOptions().timeZone ?? "",
      canvasFingerprint(),
    ];
    const bytes = new TextEncoder().encode(parts.join("|"));
    const buf = await window.crypto.subtle.digest("SHA-256", bytes);
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}
