import { z } from "zod";

import { roleProcedure, router } from "../index";
import { sendSessionNotifications } from "../lib/notify";

export const notificationsRouter = router({
  list: roleProcedure("admin", "accounting").query(({ ctx }) => {
    return ctx.db.notification.findMany({
      orderBy: { createdAt: "desc" },
      take: 100,
      include: { session: { include: { location: true } } },
    });
  }),

  resend: roleProcedure("admin").input(z.object({ sessionId: z.string() })).mutation(async ({ ctx, input }) => {
    await sendSessionNotifications(ctx.db, input.sessionId);
    return { ok: true };
  }),
});
