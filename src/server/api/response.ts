import { randomUUID } from "node:crypto";
import { Prisma } from "@/generated/prisma/client";
import { NextResponse } from "next/server";

type ApiError = {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
  meta: { requestId: string };
};

export function apiSuccess<T>(
  data: T,
  init?: { status?: number; headers?: HeadersInit },
) {
  return NextResponse.json(
    { data, meta: { requestId: randomUUID() } },
    {
      status: init?.status ?? 200,
      headers: { "Cache-Control": "no-store", ...init?.headers },
    },
  );
}

export function apiError(
  status: number,
  code: string,
  message: string,
  details?: unknown,
  headers?: HeadersInit,
) {
  const body: ApiError = {
    error: { code, message, ...(details === undefined ? {} : { details }) },
    meta: { requestId: randomUUID() },
  };

  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store", ...headers },
  });
}

export function handleApiFailure(error: unknown) {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    console.error("API database request failed", { code: error.code });
  } else {
    console.error("API request failed", {
      errorType: error instanceof Error ? error.name : "UnknownError",
    });
  }

  return apiError(503, "SERVICE_UNAVAILABLE", "The service is temporarily unavailable.");
}

export function parsePagination(searchParams: URLSearchParams) {
  const pageValue = searchParams.get("page") ?? "1";
  const pageSizeValue = searchParams.get("pageSize") ?? "12";
  const page = Number(pageValue);
  const pageSize = Number(pageSizeValue);

  if (
    !/^[1-9]\d*$/.test(pageValue) ||
    !/^[1-9]\d*$/.test(pageSizeValue) ||
    !Number.isSafeInteger(page) ||
    !Number.isSafeInteger(pageSize) ||
    pageSize > 50 ||
    !Number.isSafeInteger((page - 1) * pageSize) ||
    (page - 1) * pageSize > 100_000
  ) {
    return null;
  }

  return { page, pageSize, skip: (page - 1) * pageSize };
}
