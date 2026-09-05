import { createPrismaClient } from "@receivingX/db";
import { env } from "@receivingX/env/server";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { admin as adminPlugin } from "better-auth/plugins";

import { ROLES } from "./roles";

export function createAuth() {
  const prisma = createPrismaClient();

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
        sameSite: "none",
        secure: true,
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
