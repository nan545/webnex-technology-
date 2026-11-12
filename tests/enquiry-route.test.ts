import assert from "node:assert/strict";
import test from "node:test";
import { POST } from "../app/api/v1/enquiries/route";

const endpoint = "http://localhost/api/v1/enquiries";
const idempotencyKey = "f9c0f13a-2809-4e31-bd86-4f37b77d17d2";

test("enquiry endpoint rejects unsupported content types", async () => {
  const response = await POST(
    new Request(endpoint, { method: "POST", headers: { "Content-Type": "text/plain" } }),
  );
  assert.equal(response.status, 415);
});

test("enquiry endpoint rejects cross-origin requests", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "https://untrusted.example",
        "Idempotency-Key": idempotencyKey,
      },
      body: "{}",
    }),
  );
  assert.equal(response.status, 403);
});

test("enquiry endpoint requires an idempotency key", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: "http://localhost" },
      body: "{}",
    }),
  );
  assert.equal(response.status, 400);
});

test("enquiry endpoint rejects malformed JSON without database access", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "Idempotency-Key": idempotencyKey,
      },
      body: "{",
    }),
  );
  assert.equal(response.status, 400);
});

test("enquiry endpoint rejects oversized requests", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "Content-Length": "20000",
      },
      body: "{}",
    }),
  );
  assert.equal(response.status, 413);
});

test("enquiry endpoint validates submitted fields before database access", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({ email: "invalid" }),
    }),
  );
  const payload = (await response.json()) as { error?: { code?: string } };

  assert.equal(response.status, 422);
  assert.equal(payload.error?.code, "VALIDATION_FAILED");
});

test("enquiry endpoint rejects the spam honeypot", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        fullName: "Ada Example",
        email: "ada@example.com",
        phone: "",
        company: "",
        service: "web-development",
        budget: "",
        description: "We need a responsive website for our business.",
        preferredContact: "Email",
        website: "spam",
      }),
    }),
  );
  assert.equal(response.status, 422);
});

test("enquiry endpoint rejects missing required fields", async () => {
  const response = await POST(
    new Request(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Origin: "http://localhost",
        "Idempotency-Key": idempotencyKey,
      },
      body: JSON.stringify({
        fullName: "",
        email: "",
        description: "",
      }),
    }),
  );
  const payload = (await response.json()) as {
    error?: { code?: string; details?: Array<{ field: string }> };
  };

  assert.equal(response.status, 422);
  assert.equal(payload.error?.code, "VALIDATION_FAILED");
  assert.ok((payload.error?.details?.length ?? 0) >= 5);
});

test("enquiry endpoint fails closed when the private rate-limit secret is absent", async () => {
  const previousSecret = process.env.RATE_LIMIT_SECRET;
  delete process.env.RATE_LIMIT_SECRET;

  try {
    const response = await POST(
      new Request(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Origin: "http://localhost",
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({
          fullName: "Ada Example",
          email: "ada@example.com",
          phone: "",
          company: "",
          service: "web-development",
          budget: "",
          description: "We need a responsive website for our business.",
          preferredContact: "Email",
        }),
      }),
    );
    const payload = (await response.json()) as {
      error?: { code?: string; message?: string };
    };

    assert.equal(response.status, 503);
    assert.equal(payload.error?.code, "SERVICE_UNAVAILABLE");
    assert.doesNotMatch(JSON.stringify(payload), /secret/i);
  } finally {
    if (previousSecret === undefined) delete process.env.RATE_LIMIT_SECRET;
    else process.env.RATE_LIMIT_SECRET = previousSecret;
  }
});
