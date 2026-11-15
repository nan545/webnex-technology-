import { writePublication } from "@/server/api/publications";

export async function PATCH(request: Request, { params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  return writePublication(request, kind, id);
}
