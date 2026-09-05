import { z } from "zod";

import { roleProcedure, router } from "../index";

export const settingsRouter = router({
  list: roleProcedure("admin").query(({ ctx }) => {
    return ctx.db.setting.findMany();
  }),

  get: roleProcedure("admin").input(z.object({ key: z.string() })).query(({ ctx, input }) => {
    return ctx.db.setting.findUnique({ where: { key: input.key } });
  }),

  set: roleProcedure("admin")
    .input(z.object({ key: z.string(), value: z.unknown() }))
    .mutation(({ ctx, input }) => {
      return ctx.db.setting.upsert({
        where: { key: input.key },
        create: { key: input.key, value: input.value as object },
        update: { value: input.value as object },
      });
    }),
});
