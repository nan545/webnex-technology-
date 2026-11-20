import "server-only";
import { createRemoteJWKSet, jwtVerify, type JWTVerifyGetKey } from "jose";

const githubKeys = createRemoteJWKSet(new URL("https://token.actions.githubusercontent.com/.well-known/jwks"));
const issuer = "https://token.actions.githubusercontent.com";
const audience = "webnex-work-assignment-notifications";

export async function verifyNotificationWorkflowToken(token: string, key: JWTVerifyGetKey = githubKeys) {
  const repositoryId = process.env.NOTIFICATION_DISPATCH_GITHUB_REPOSITORY_ID;
  const workflowRef = process.env.NOTIFICATION_DISPATCH_GITHUB_WORKFLOW_REF;
  if (!repositoryId || !/^\d+$/.test(repositoryId) || !workflowRef) {
    throw new Error("Notification dispatch workflow identity is not configured.");
  }
  const { payload } = await jwtVerify(token, key, {
    issuer,
    audience,
    algorithms: ["RS256"],
    maxTokenAge: "10m",
    requiredClaims: ["sub", "iat", "exp"],
  });
  return payload.repository_id === repositoryId
    && payload.workflow_ref === workflowRef
    && payload.ref === "refs/heads/main"
    && (payload.event_name === "schedule" || payload.event_name === "workflow_dispatch");
}
