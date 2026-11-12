import "server-only";
import { prisma } from "@/server/db";
import { removePrivateObject } from "@/server/integrations/object-storage";

export async function removeUnreferencedTeamPhoto(mediaId: string) {
  const media = await prisma.mediaAsset.findUnique({
    where: { id: mediaId },
    select: { storageKey: true },
  });
  if (!media) return true;

  const references = await prisma.teamMember.count({
    where: { profileImageId: mediaId },
  });
  if (references > 0) return true;

  try {
    await removePrivateObject(media.storageKey);
    await prisma.mediaAsset.delete({ where: { id: mediaId } });
    return true;
  } catch (error) {
    console.error("Unused team photo cleanup failed", {
      mediaId,
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
    return false;
  }
}
