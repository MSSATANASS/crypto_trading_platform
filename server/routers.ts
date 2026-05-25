import { systemRouter } from "./_core/systemRouter";
import { router } from "./_core/trpc";
import { authRouter } from "./routers/auth";
import { tradingRouter } from "./routers/trading";
import { adminRouter } from "./routers/admin";

export const appRouter = router({
  system: systemRouter,
  auth: authRouter,
  trading: tradingRouter,
  admin: adminRouter,
});

export type AppRouter = typeof appRouter;
