import { z } from "zod";

import { protectedProcedure, router } from "../index";

export const customersRouter = router({
  list: protectedProcedure.input(z.object({ search: z.string().optional() }).optional()).query(({ ctx, input }) => {
    return ctx.db.customer.findMany({
      where: input?.search
        ? { name: { contains: input.search, mode: "insensitive" } }
        : undefined,
      orderBy: { name: "asc" },
    });
  }),

  get: protectedProcedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => {
    return ctx.db.customer.findUniqueOrThrow({ where: { id: input.id } });
  }),

  create: protectedProcedure
    .input(
      z.object({
        name: z.string().min(1),
        accountNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      return ctx.db.customer.create({ data: input });
    }),

  update: protectedProcedure
    .input(
      z.object({
        id: z.string(),
        name: z.string().min(1).optional(),
        accountNumber: z.string().optional(),
        notes: z.string().optional(),
      }),
    )
    .mutation(({ ctx, input }) => {
      const { id, ...data } = input;
      return ctx.db.customer.update({ where: { id }, data });
    }),
});
