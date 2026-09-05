import { protectedProcedure, publicProcedure, router } from "../index";
import { customersRouter } from "./customers";
import { healthRouter } from "./health";
import { labelsRouter } from "./labels";
import { locationsRouter } from "./locations";
import { notificationsRouter } from "./notifications";
import { ordersRouter } from "./orders";
import { receivingRouter } from "./receiving";
import { reportsRouter } from "./reports";
import { settingsRouter } from "./settings";
import { usersRouter } from "./users";
import { vendorsRouter } from "./vendors";

export const appRouter = router({
  healthCheck: publicProcedure.query(() => {
    return "OK";
  }),
  privateData: protectedProcedure.query(({ ctx }) => {
    return {
      message: "This is private",
      user: ctx.session.user,
    };
  }),
  users: usersRouter,
  locations: locationsRouter,
  customers: customersRouter,
  vendors: vendorsRouter,
  orders: ordersRouter,
  receiving: receivingRouter,
  labels: labelsRouter,
  notifications: notificationsRouter,
  reports: reportsRouter,
  settings: settingsRouter,
  health: healthRouter,
});
export type AppRouter = typeof appRouter;
