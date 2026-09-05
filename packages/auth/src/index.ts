import { createPrismaClient } from "@receivingX/db";
import { env } from "@receivingX/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";

import { ROLES } from "./roles";

export function createAuth() {
  const prisma = createPrismaClient();
  // SameSite=None cookies require Secure and only matter for genuinely
  // cross-site setups (e.g. separate public domains for web vs API). Plain
  // HTTP deploys (or same-site-but-different-port deploys, which is common
  // when web/server share a bare IP) need Lax + non-Secure or browsers drop
  // the cookie silently and auth breaks with no useful error.
  const isHttps = env.BETTER_AUTH_URL.startsWith("https://");

  return betterAuth({
    database: prismaAdapter(prisma, {
      provider: "postgresql",
    }),

    trustedOrigins: [env.CORS_ORIGIN],
    emailAndPassword: {
      enabled: true,
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      defaultCookieAttributes: {
        sameSite: isHttps ? "none" : "lax",
        secure: isHttps,
        httpOnly: true,
      },
    },
    user: {
      additionalFields: {
        locationId: {
          type: "string",
          required: false,
          input: false,
        },
        active: {
          type: "boolean",
          defaultValue: true,
          input: false,
        },
      },
    },
    plugins: [
      adminPlugin({
        defaultRole: ROLES.RECEIVER,
        adminRoles: [ROLES.ADMIN],
      }),
    ],
  });
}

export const auth = createAuth();
