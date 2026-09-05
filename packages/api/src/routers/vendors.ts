import { z } from "zod";

import { protectedProcedure, router } from "../index";

export const vendorsRouter = router({
  list: protectedProcedure.input(z.object({ search: z.string().optional() }).optional()).query(({ ctx, input }) => {
    return ctx.db.vendor.findMany({
      where: input?.search ? { name: { contains: input.search, mode: "insensitive" } } : undefined,
      orderBy: { name: "asc" },
    });
  }),

  create: protectedProcedure
    .input(z.object({ name: z.string().min(1), contactEmail: z.email().optional() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.vendor.upsert({
        where: { name: input.name },
        create: input,
        update: { contactEmail: input.contactEmail },
      });
    }),

  update: protectedProcedure
    .input(z.object({ id: z.string(), name: z.string().optional(), contactEmail: z.email().optional() }))
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.vendor.update({ where: { id }, data });
    }),
});
