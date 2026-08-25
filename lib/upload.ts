/**
 * Types d'image autorisés à l'upload, avec leur extension normalisée.
 *
 * On EXCLUT volontairement `image/svg+xml` : un SVG peut contenir du `<script>`
 * et, servi depuis un bucket public, ouvrirait une XSS stockée. On refuse aussi
 * tout type non listé — le `file.type` vient du navigateur (donc du client) et
 * ne doit pas être réutilisé tel quel comme `contentType` de stockage.
 */
export const ALLOWED_IMAGE_TYPES: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
};

/** Extension normalisée pour un type MIME autorisé, ou null si refusé. */
export function imageExt(type: string | undefined | null): string | null {
  return (type && ALLOWED_IMAGE_TYPES[type]) || null;
}
