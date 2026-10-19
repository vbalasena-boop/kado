import sharp from "sharp";

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

/** Vérifie la signature binaire correspondant au MIME annoncé par le client. */
export function imageContentMatches(type: string, bytes: Uint8Array): boolean {
  if (type === "image/png") {
    return bytes.length >= 8 && [137, 80, 78, 71, 13, 10, 26, 10].every((v, i) => bytes[i] === v);
  }
  if (type === "image/jpeg") {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  }
  if (type === "image/webp") {
    return bytes.length >= 12 &&
      String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" &&
      String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  }
  return false;
}

const FORMAT_BY_MIME = {
  "image/png": "png",
  "image/jpeg": "jpeg",
  "image/webp": "webp",
} as const;

/** Decode, bound and re-encode untrusted images before publishing them. */
export async function normalizeUploadedImage(
  type: string,
  input: Buffer,
  maxBytes: number,
): Promise<{ buffer: Buffer; ext: string }> {
  const ext = imageExt(type);
  if (!ext || !imageContentMatches(type, input)) {
    throw new Error("invalid_image_content");
  }

  let output: Buffer;
  try {
    const image = sharp(input, {
      failOn: "warning",
      limitInputPixels: 16_000_000,
      limitInputChannels: 4,
      animated: false,
    });
    const metadata = await image.metadata();
    if (
      metadata.format !== FORMAT_BY_MIME[type as keyof typeof FORMAT_BY_MIME] ||
      !metadata.width ||
      !metadata.height ||
      metadata.width > 6000 ||
      metadata.height > 6000 ||
      metadata.width * metadata.height > 16_000_000
    ) {
      throw new Error("invalid_image_content");
    }

    const pipeline = image
      .rotate()
      .resize({ width: 4096, height: 4096, fit: "inside", withoutEnlargement: true });
    if (type === "image/png") output = await pipeline.png({ compressionLevel: 9 }).toBuffer();
    else if (type === "image/jpeg") output = await pipeline.jpeg({ quality: 86 }).toBuffer();
    else output = await pipeline.webp({ quality: 86 }).toBuffer();
  } catch {
    throw new Error("invalid_image_content");
  }

  if (output.length > maxBytes) throw new Error("too_large");
  return { buffer: output, ext };
}
