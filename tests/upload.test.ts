import { describe, it, expect } from "vitest";
import sharp from "sharp";
import { imageContentMatches, imageExt, normalizeUploadedImage } from "@/lib/upload";

describe("imageExt — whitelist d'upload (correctif SVG)", () => {
  it("accepte png / jpeg / webp avec l'extension normalisée", () => {
    expect(imageExt("image/png")).toBe("png");
    expect(imageExt("image/jpeg")).toBe("jpg");
    expect(imageExt("image/webp")).toBe("webp");
  });

  it("refuse le SVG et tout type non listé", () => {
    expect(imageExt("image/svg+xml")).toBeNull(); // vecteur XSS stockée
    expect(imageExt("image/gif")).toBeNull();
    expect(imageExt("text/html")).toBeNull();
    expect(imageExt("")).toBeNull();
    expect(imageExt(undefined)).toBeNull();
    expect(imageExt(null)).toBeNull();
  });
});

describe("imageContentMatches — vérification de signature", () => {
  it("accepte une signature conforme au type annoncé", () => {
    expect(imageContentMatches("image/png", Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]))).toBe(true);
    expect(imageContentMatches("image/jpeg", Uint8Array.from([255, 216, 255]))).toBe(true);
    expect(imageContentMatches("image/webp", Uint8Array.from([82, 73, 70, 70, 0, 0, 0, 0, 87, 69, 66, 80]))).toBe(true);
  });

  it("refuse un type falsifié, un contenu incomplet et le SVG", () => {
    expect(imageContentMatches("image/png", new TextEncoder().encode("<svg>"))).toBe(false);
    expect(imageContentMatches("image/jpeg", Uint8Array.from([137, 80, 78, 71]))).toBe(false);
    expect(imageContentMatches("image/svg+xml", new TextEncoder().encode("<svg>"))).toBe(false);
  });
});

describe("normalizeUploadedImage — décodage et nettoyage avant publication", () => {
  it("décode et réencode les formats autorisés en supprimant les métadonnées", async () => {
    const source = await sharp({
      create: { width: 20, height: 12, channels: 4, background: "#bd3c28" },
    }).png().withMetadata({ exif: { IFD0: { Artist: "private metadata" } } }).toBuffer();

    const normalized = await normalizeUploadedImage("image/png", source, 3 * 1024 * 1024);
    const result = await sharp(normalized.buffer).metadata();

    expect(normalized.ext).toBe("png");
    expect(result.format).toBe("png");
    expect(result.width).toBe(20);
    expect(result.height).toBe(12);
    expect(result.exif).toBeUndefined();
  });

  it("rejette les fichiers qui ont une signature mais ne se décodent pas", async () => {
    await expect(
      normalizeUploadedImage(
        "image/png",
        Buffer.from([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3]),
        3 * 1024 * 1024,
      ),
    ).rejects.toThrow("invalid_image_content");
  });

  it("rejette une image réencodée plus grande que la limite", async () => {
    const source = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#fff" },
    }).png().toBuffer();

    await expect(normalizeUploadedImage("image/png", source, 1)).rejects.toThrow("too_large");
  });
});
