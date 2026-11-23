import "server-only";
import sharp from "sharp";

const allowedFormats = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function isAllowedMediaMimeType(mimeType: string) {
  return allowedFormats.has(mimeType);
}

export async function optimizeMediaImage(source: Buffer, declaredMimeType: string) {
  const expectedFormat = allowedFormats.get(declaredMimeType);
  if (!expectedFormat) throw new InvalidMediaImageError();

  const pipeline = sharp(source, { failOn: "error", limitInputPixels: 25_000_000 });
  const metadata = await pipeline.metadata();
  if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new InvalidMediaImageError();
  }

  const result = await pipeline
    .rotate()
    .resize(1600, 1600, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

export function safeMediaOriginalName(name: string) {
  const cleaned = name.replace(/[\u0000-\u001f\u007f]/g, "").trim();
  return (cleaned || "untitled").slice(0, 255);
}

export class InvalidMediaImageError extends Error {}
