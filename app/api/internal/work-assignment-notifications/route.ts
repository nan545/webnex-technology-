import { verifyNotificationWorkflowToken } from "@/server/integrations/github-notification-trigger";
import { dispatchWorkAssignmentNotifications } from "@/server/integrations/work-assignment-notifications";
import { errors } from "jose";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(request: Request) {
  if (!process.env.TWILIO_ACCOUNT_SID
    || !process.env.TWILIO_AUTH_TOKEN
    || !process.env.TWILIO_SMS_FROM
    || !process.env.TWILIO_WHATSAPP_FROM
    || !process.env.TWILIO_WHATSAPP_CONTENT_SID
    || !process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID
    || !process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF) {
    return Response.json({ error: "Message dispatch is not configured." }, { status: 503 });
  }
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ") || authorization.length > 10_000) {
    return Response.json({ error: "Unauthorized." }, { status: 401 });
  }
  try {
    if (!await verifyNotificationWorkflowToken(authorization.slice(7))) {
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
    const counts = await dispatchWorkAssignmentNotifications(10);
    return Response.json(counts, { status: counts.failed || counts.retried ? 503 : 200 });
  } catch (error) {
    console.error("Assignment message dispatch failed:", error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Assignment message dispatch failed; check server logs." }, { status: 503 });
  }
}
