import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
  server: {
    DATABASE_URL: z.string().min(1),
    BETTER_AUTH_SECRET: z.string().min(32),
    BETTER_AUTH_URL: z.url(),
    CORS_ORIGIN: z.url(),
    NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
    APP_URL: z.url().default("http://localhost:3001"),

    // Object storage (MinIO / S3-compatible)
    S3_ENDPOINT: z.string().min(1).default("http://localhost:9000"),
    S3_REGION: z.string().min(1).default("us-east-1"),
    S3_BUCKET: z.string().min(1).default("receivingx"),
    S3_ACCESS_KEY: z.string().min(1).default("minioadmin"),
    S3_SECRET_KEY: z.string().min(1).default("minioadmin"),
    S3_FORCE_PATH_STYLE: z.coerce.boolean().default(true),
    S3_PUBLIC_URL: z.string().min(1).optional(),

    // OCR sidecar
    OCR_URL: z.string().min(1).default("http://localhost:8100"),
    OCR_TIMEOUT_MS: z.coerce.number().default(20000),

    // Microsoft Graph mail
    MS_TENANT_ID: z.string().optional(),
    MS_CLIENT_ID: z.string().optional(),
    MS_CLIENT_SECRET: z.string().optional(),
    MS_SENDER_UPN: z.string().optional(),

    // InvenTree
    INVENTREE_URL: z.string().optional(),
    INVENTREE_TOKEN: z.string().optional(),
    INVENTREE_DEFAULT_LOCATION: z.coerce.number().optional(),

    // Notification recipients (fallback if not set per-location in DB)
    RECEIVING_EMAIL: z.string().optional(),
    ACCOUNTING_EMAILS: z.string().optional(),
  },
  runtimeEnv: process.env,
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  emptyStringAsUndefined: true,
});
