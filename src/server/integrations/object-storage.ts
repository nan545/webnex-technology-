import "server-only";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { z } from "zod";
import { env } from "@/server/env";

type ObjectStorageConfiguration = {
  endpoint: string;
  region: string;
  bucket: string;
  accessKeyId: string;
  secretAccessKey: string;
};

let client: S3Client | null = null;
let configuredFingerprint = "";

export function getObjectStorageConfiguration() {
  const values = [
    env.OBJECT_STORAGE_ENDPOINT,
    env.OBJECT_STORAGE_REGION,
    env.OBJECT_STORAGE_BUCKET,
    env.OBJECT_STORAGE_ACCESS_KEY_ID,
    env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  ];
  if (values.every((value) => value === undefined)) return null;
  const parsed = z.object({
    endpoint: z.string().url().refine(
      (value) => process.env.NODE_ENV !== "production" || new URL(value).protocol === "https:",
      "Object storage endpoint must use HTTPS in production.",
    ),
    region: z.string().min(1),
    bucket: z.string().min(1),
    accessKeyId: z.string().min(1),
    secretAccessKey: z.string().min(1),
  }).safeParse({
    endpoint: env.OBJECT_STORAGE_ENDPOINT,
    region: env.OBJECT_STORAGE_REGION,
    bucket: env.OBJECT_STORAGE_BUCKET,
    accessKeyId: env.OBJECT_STORAGE_ACCESS_KEY_ID,
    secretAccessKey: env.OBJECT_STORAGE_SECRET_ACCESS_KEY,
  });
  if (!parsed.success) {
    throw new Error("Object storage configuration is incomplete.");
  }
  return parsed.data;
}

function getClient(configuration: ObjectStorageConfiguration) {
  const fingerprint = [
    configuration.endpoint,
    configuration.region,
    configuration.bucket,
    configuration.accessKeyId,
    configuration.secretAccessKey,
  ].join("\0");
  if (!client || configuredFingerprint !== fingerprint) {
    client?.destroy();
    client = new S3Client({
      endpoint: configuration.endpoint,
      region: configuration.region,
      forcePathStyle: true,
      credentials: {
        accessKeyId: configuration.accessKeyId,
        secretAccessKey: configuration.secretAccessKey,
      },
    });
    configuredFingerprint = fingerprint;
  }
  return client;
}

export async function putPrivateObject(key: string, body: Buffer) {
  const configuration = getObjectStorageConfiguration();
  if (!configuration) throw new Error("Persistent object storage is not configured.");
  await getClient(configuration).send(new PutObjectCommand({
    Bucket: configuration.bucket,
    Key: key,
    Body: body,
    ContentType: "image/webp",
    CacheControl: "private, max-age=0, no-store",
  }));
}

export async function readPrivateObject(key: string) {
  const configuration = getObjectStorageConfiguration();
  if (!configuration) throw new Error("Persistent object storage is not configured.");
  const result = await getClient(configuration).send(new GetObjectCommand({
    Bucket: configuration.bucket,
    Key: key,
  }));
  if (!result.Body) throw new Error("Stored image has no response body.");
  return result.Body.transformToWebStream();
}

export async function removePrivateObject(key: string) {
  const configuration = getObjectStorageConfiguration();
  if (!configuration) throw new Error("Persistent object storage is not configured.");
  await getClient(configuration).send(new DeleteObjectCommand({
    Bucket: configuration.bucket,
    Key: key,
  }));
}
