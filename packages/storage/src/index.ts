import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { env } from "@receivingX/env/server";

let client: S3Client | null = null;
let publicClient: S3Client | null = null;

/** Internal client - used for server-to-server object reads/writes (OCR, email attachments). */
export function getS3Client(): S3Client {
  if (!client) {
    client = new S3Client({
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return client;
}

/**
 * Client used only to *sign* URLs handed to the browser. SigV4 signatures
 * cover the host, so presigned URLs must be generated against an endpoint
 * the browser can actually resolve/reach - which in Docker is usually not
 * the same as the internal service name (e.g. `minio:9000`). Falls back to
 * S3_ENDPOINT if no public endpoint is configured (e.g. plain local dev).
 */
export function getPublicS3Client(): S3Client {
  if (!env.S3_PUBLIC_ENDPOINT) return getS3Client();
  if (!publicClient) {
    publicClient = new S3Client({
      endpoint: env.S3_PUBLIC_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY,
        secretAccessKey: env.S3_SECRET_KEY,
      },
    });
  }
  return publicClient;
}

export const BUCKET = env.S3_BUCKET;

/** Object key convention: packages/{packageId}/{photoId}.{ext} */
export function packagePhotoKey(packageId: string, photoId: string, ext: string): string {
  return `packages/${packageId}/${photoId}.${ext}`;
}

export function labelKey(publicId: string): string {
  return `labels/${publicId}.pdf`;
}

/** A short-lived URL the browser can PUT the photo bytes to directly. */
export async function createUploadUrl(key: string, contentType: string, expiresInSeconds = 300): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(getPublicS3Client(), command, { expiresIn: expiresInSeconds });
}

/** A short-lived URL the browser (or email client) can GET the object from. */
export async function createDownloadUrl(key: string, expiresInSeconds = 3600): Promise<string> {
  const command = new GetObjectCommand({ Bucket: BUCKET, Key: key });
  return getSignedUrl(getPublicS3Client(), command, { expiresIn: expiresInSeconds });
}

export async function getObjectBuffer(key: string): Promise<Buffer> {
  const res = await getS3Client().send(new GetObjectCommand({ Bucket: BUCKET, Key: key }));
  const bytes = await res.Body?.transformToByteArray();
  if (!bytes) throw new Error(`Object not found or empty: ${key}`);
  return Buffer.from(bytes);
}

export async function putObjectBuffer(key: string, body: Buffer | Uint8Array, contentType: string): Promise<void> {
  await getS3Client().send(
    new PutObjectCommand({ Bucket: BUCKET, Key: key, Body: body, ContentType: contentType }),
  );
}
