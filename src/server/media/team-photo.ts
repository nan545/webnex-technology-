import "server-only";
import sharp from "sharp";

const expectedFormats = new Map([
  ["image/jpeg", "jpeg"],
  ["image/png", "png"],
  ["image/webp", "webp"],
]);

export function isAllowedTeamPhotoMimeType(mimeType: string) {
  return expectedFormats.has(mimeType);
}

export async function optimizeTeamPhoto(source: Buffer, declaredMimeType: string) {
  const expectedFormat = expectedFormats.get(declaredMimeType);
  if (!expectedFormat) throw new InvalidTeamPhotoError();

  const pipeline = sharp(source, { failOn: "error", limitInputPixels: 25_000_000 });
  const metadata = await pipeline.metadata();
  if (metadata.format !== expectedFormat || !metadata.width || !metadata.height) {
    throw new InvalidTeamPhotoError();
  }
  const result = await pipeline
    .rotate()
    .resize(800, 1000, { fit: "cover", position: "attention" })
    .webp({ quality: 82, effort: 5 })
    .toBuffer({ resolveWithObject: true });

  return {
    data: result.data,
    width: result.info.width,
    height: result.info.height,
  };
}

export class InvalidTeamPhotoError extends Error {}
