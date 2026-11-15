import { z } from "zod";
import { prisma } from "@/server/db";
import { readPrivateObject } from "@/server/integrations/object-storage";

export async function GET(_request: Request, { params }: { params: Promise<{ mediaId: string }> }) {
  const { mediaId } = await params;
  if (!z.string().uuid().safeParse(mediaId).success) return new Response(null, { status: 404 });
  try {
    const published = { status: "PUBLISHED" as const, publishedAt: { lte: new Date() } };
    const media = await prisma.mediaAsset.findFirst({
      where: { id: mediaId, OR: [{ projectCovers: { some: published } }, { blogPostCovers: { some: published } }] },
      select: { storageKey: true },
    });
    if (!media) return new Response(null, { status: 404, headers: { "Cache-Control": "no-store" } });
    return new Response(await readPrivateObject(media.storageKey), { headers: { "Content-Type": "image/webp", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  } catch (error) {
    console.error("Publication image could not be loaded", { errorType: error instanceof Error ? error.name : "UnknownError" });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}
