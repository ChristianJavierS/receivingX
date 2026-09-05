import { z } from "zod";

import { protectedProcedure, roleProcedure, router } from "../index";

export const locationsRouter = router({
  list: protectedProcedure.query(({ ctx }) => {
    return ctx.db.location.findMany({ orderBy: { name: "asc" } });
  }),

  default: protectedProcedure.query(async ({ ctx }) => {
    return (await ctx.db.location.findFirst({ where: { isDefault: true } })) ?? ctx.db.location.findFirst();
  }),

  create: roleProcedure("admin")
    .input(
      z.object({
        name: z.string().min(1),
        code: z.string().min(1),
        address: z.string().optional(),
        receivingEmail: z.email().optional(),
        accountingEmails: z.array(z.email()).default([]),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.location.create({ data: input });
    }),

  update: roleProcedure("admin")
    .input(
      z.object({
        id: z.string(),
        name: z.string().optional(),
        address: z.string().optional(),
        receivingEmail: z.email().optional(),
        accountingEmails: z.array(z.email()).optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.location.update({ where: { id }, data });
    }),
});
