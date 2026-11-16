import { writePublication } from "@/server/api/publications";

export async function POST(request: Request, { params }: { params: Promise<{ kind: string }> }) {
  const { kind } = await params;
  return writePublication(request, kind, null);
}
