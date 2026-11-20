import { verifyEmailWorkflowToken } from "@/server/integrations/github-email-trigger";
import { dispatchWorkAssignmentEmails } from "@/server/integrations/work-assignment-email";
import { errors } from "jose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.WORK_ASSIGNMENT_EMAIL_PROVIDER !== "gmail"
    || !process.env.EMAIL_DISPATCH_GITHUB_REPOSITORY_ID
    || !process.env.EMAIL_DISPATCH_GITHUB_WORKFLOW_REF) {
    return Response.json({ error: "Email dispatch is not configured." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 10_000) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    if (!await verifyEmailWorkflowToken(authorization.slice(7))) {
      return Response.json({ error: "Unauthorized." }, { status: 401 });
    }
  } catch (error) {
    if (error instanceof errors.JWTInvalid
      || error instanceof errors.JWSInvalid
      || error instanceof errors.JWTExpired
      || error instanceof errors.JWTClaimValidationFailed
      || error instanceof errors.JWSSignatureVerificationFailed
      || error instanceof errors.JWKSNoMatchingKey
      || error instanceof errors.JOSENotSupported) {
      return Response.json({ error: "Workflow identity could not be verified." }, { status: 401 });
    }
    console.error("Workflow identity verification unavailable:", error instanceof Error ? error.name : "unknown error");
    return Response.json({ error: "Workflow identity verification unavailable." }, { status: 503 });
  }
  try {
    const counts = await dispatchWorkAssignmentEmails(10);
    return Response.json(counts, { status: counts.failed || counts.retried ? 503 : 200 });
  } catch (error) {
    console.error("Assignment email dispatch failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Assignment email dispatch failed; check server logs." }, { status: 503 });
  }
}
