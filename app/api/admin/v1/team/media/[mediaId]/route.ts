import { z } from "zod";
import { authorizeAdmin } from "@/server/auth/admin-api";
import { prisma } from "@/server/db";
import { readPrivateObject } from "@/server/integrations/object-storage";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ mediaId: string }> },
) {
  const authorization = await authorizeAdmin("team:view");
  if (authorization.response) return authorization.response;
  const { mediaId } = await params;
  if (!z.string().uuid().safeParse(mediaId).success) return new Response(null, { status: 404 });

  try {
    const media = await prisma.mediaAsset.findUnique({
      where: { id: mediaId },
      select: { storageKey: true },
    });
    if (!media) return new Response(null, { status: 404 });
    return new Response(await readPrivateObject(media.storageKey), {
      headers: {
        "Cache-Control": "private, no-store",
        "Content-Type": "image/webp",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Administrator team photo preview failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return new Response(null, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
