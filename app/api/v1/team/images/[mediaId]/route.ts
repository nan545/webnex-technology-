import { z } from "zod";
import { prisma } from "@/server/db";
import { readPrivateObject } from "@/server/integrations/object-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const { mediaId } = await params;
  if (!z.string().uuid().safeParse(mediaId).success) return new Response(null, { status: 404 });

  try {
    const media = await prisma.mediaAsset.findFirst({
      where: {
        id: mediaId,
        teamMembers: {
          some: {
            isActive: true,
            status: "PUBLISHED",
            publishedAt: { lte: new Date() },
          },
        },
      },
      select: { storageKey: true },
    });
    if (!media) return new Response(null, { status: 404 });

    return new Response(await readPrivateObject(media.storageKey), {
      headers: {
        "Cache-Control": "public, max-age=3600, stale-while-revalidate=86400",
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Public team image could not be loaded", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
