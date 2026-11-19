import { writeWorkProject } from "@/server/api/work-projects";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  return writeWorkProject(request, (await params).id);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
