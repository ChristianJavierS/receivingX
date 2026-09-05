import { auth } from "@receivingX/auth";
import { ALL_ROLES } from "@receivingX/auth/roles";
import { z } from "zod";

import { roleProcedure, router } from "../index";

const roleSchema = z.enum(ALL_ROLES as [string, ...string[]]);

export const usersRouter = router({
  list: roleProcedure("admin").query(({ ctx }) => {
    return ctx.db.user.findMany({ orderBy: { name: "asc" }, include: { location: true } });
  }),

  create: roleProcedure("admin")
    .input(
      z.object({
        name: z.string().min(1),
        email: z.email(),
        password: z.string().min(8),
        role: roleSchema,
        locationId: z.string().optional(),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      const created = await auth.api.createUser({
        body: {
          name: input.name,
          email: input.email,
          password: input.password,
          // better-auth's admin plugin types `role` against its default
          // "admin" | "user" union; we use our own ReceivingX roles instead.
          role: input.role as "admin" | "user",
        },
      });
      const userId = (created as { user: { id: string } }).user.id;
      return ctx.db.user.update({ where: { id: userId }, data: { locationId: input.locationId } });
    }),

  update: roleProcedure("admin")
    .input(
      z.object({
        id: z.string(),
        role: roleSchema.optional(),
        locationId: z.string().nullable().optional(),
        active: z.boolean().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.user.update({ where: { id }, data });
    }),
});
