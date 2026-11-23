import { writeWorkProject } from "@/server/api/work-projects";

export async function POST(request: Request) {
  return writeWorkProject(request, null);
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
