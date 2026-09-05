import type { Role } from "@receivingX/auth/roles";
import { initTRPC, TRPCError } from "@trpc/server";

import type { Context } from "./context";

export const t = initTRPC.context<Context>().create();

export const router = t.router;

export const publicProcedure = t.procedure;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.session) {
    throw new TRPCError({
      code: "UNAUTHORIZED",
      message: "Authentication required",
      cause: "No session",
    });
  }
  return next({
    ctx: {
      ...ctx,
      session: ctx.session,
    },
  });
});

/**
 * Restricts a procedure to one of the given roles. `admin` always passes,
 * since admins can do everything.
 */
export function roleProcedure(...allowed: Role[]) {
  return protectedProcedure.use(({ ctx, next }) => {
    const role = (ctx.session.user as { role?: string }).role;
    if (role !== "admin" && !allowed.includes(role as Role)) {
      throw new TRPCError({
        code: "FORBIDDEN",
        message: `Requires one of roles: ${allowed.join(", ")}`,
      });
    }
    return next({ ctx });
  });
}
