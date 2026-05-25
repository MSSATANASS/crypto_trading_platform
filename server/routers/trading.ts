import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import {
  getPortfolioByUserId,
  getTradesByUserId,
  insertActivityLog,
  insertTrade,
  upsertPortfolioHolding,
} from "../db";
import { notifyOwner } from "../_core/notification";

const SIGNIFICANT_TRADE_USD = 1000;

export const tradingRouter = router({
  /**
   * Execute a simulated trade (buy or sell)
   */
  executeTrade: protectedProcedure
    .input(
      z.object({
        pair: z.string().min(1).max(20),
        side: z.enum(["buy", "sell"]),
        amount: z.number().positive(),
        price: z.number().positive(),
      })
    )
    .mutation(async ({ input, ctx }) => {
      const total = input.amount * input.price;
      const symbol = input.pair.split("-")[0] ?? input.pair;

      await insertTrade({
        userId: ctx.user.id,
        pair: input.pair,
        side: input.side,
        amount: input.amount.toFixed(8),
        price: input.price.toFixed(2),
        total: total.toFixed(2),
        status: "filled",
      });

      // Update portfolio
      const portfolio = await getPortfolioByUserId(ctx.user.id);
      const holding = portfolio.find((h) => h.symbol === symbol);
      const currentAmount = parseFloat(holding?.amount ?? "0");
      const currentAvg = parseFloat(holding?.avgBuyPrice ?? "0");

      let newAmount: number;
      let newAvg: number;

      if (input.side === "buy") {
        newAmount = currentAmount + input.amount;
        // Weighted average price
        newAvg =
          currentAmount > 0
            ? (currentAmount * currentAvg + input.amount * input.price) / newAmount
            : input.price;
      } else {
        newAmount = Math.max(0, currentAmount - input.amount);
        newAvg = currentAvg; // Keep avg on sell
      }

      await upsertPortfolioHolding(
        ctx.user.id,
        symbol,
        newAmount.toFixed(8),
        newAvg.toFixed(2)
      );

      // Log the trade activity
      await insertActivityLog({
        userId: ctx.user.id,
        eventType: "trade",
        description: `${input.side.toUpperCase()} ${input.amount} ${symbol} @ $${input.price.toFixed(2)} (Total: $${total.toFixed(2)})`,
        metadata: JSON.stringify({ pair: input.pair, side: input.side, amount: input.amount, price: input.price, total }),
      });

      // Notify owner on significant trades (>= $1000 USD)
      if (total >= SIGNIFICANT_TRADE_USD) {
        notifyOwner({
          title: `Operación significativa: ${input.side.toUpperCase()} ${symbol}`,
          content: `**${ctx.user.name ?? ctx.user.email ?? "Usuario"}** ejecutó una operación de **${input.side === "buy" ? "compra" : "venta"}** por **$${total.toFixed(2)} USD**.\n\n- Par: ${input.pair}\n- Cantidad: ${input.amount} ${symbol}\n- Precio: $${input.price.toFixed(2)}\n- Fecha: ${new Date().toLocaleString("es-ES")}`,
        }).catch(() => {});
      }

      return {
        success: true,
        trade: {
          pair: input.pair,
          side: input.side,
          amount: input.amount,
          price: input.price,
          total,
        },
      };
    }),

  /**
   * Get user's trade history
   */
  history: protectedProcedure.query(async ({ ctx }) => {
    return getTradesByUserId(ctx.user.id);
  }),

  /**
   * Get user's portfolio holdings
   */
  portfolio: protectedProcedure.query(async ({ ctx }) => {
    return getPortfolioByUserId(ctx.user.id);
  }),
});
