import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { interests, items, trades } from "../../db/schema.js";
import { cursorWhere, fail, page, type Context } from "../../context.js";
export function tradesRoutes(app: FastifyInstance, c: Context) {
  c.route(app, "createTrade", ({ path, body }, user) =>
    c.tx(() => {
      const item = c.itemRow(path.id),
        now = c.now();
      if (item.ownerId !== user.id) fail(403);
      if (item.status !== "AVAILABLE") fail(409);
      const start = Date.parse(body.meetingStart),
        end = Date.parse(body.meetingEnd);
      if (!(now < start && start < end && end <= now + 7 * 86400000))
        fail(400, "交接时间须在未来七天内");
      if (
        body.recipientId === user.id ||
        !c.orm
          .select()
          .from(interests)
          .where(
            and(
              eq(interests.itemId, item.id),
              eq(interests.userId, body.recipientId),
              eq(interests.active, true),
            ),
          )
          .get()
      )
        fail(409, "领取人必须有有效意向");
      const id = c.id();
      c.orm
        .insert(trades)
        .values({
          id,
          itemId: item.id,
          recipientId: body.recipientId,
          status: "PENDING",
          meetingStart: start,
          meetingEnd: end,
          meetingPlace: body.meetingPlace,
          createdAt: now,
        })
        .run();
      if (
        c.orm
          .update(items)
          .set({ status: "RESERVED", updatedAt: now })
          .where(and(eq(items.id, item.id), eq(items.status, "AVAILABLE")))
          .run().changes !== 1
      )
        fail(409);
      return { data: c.trade(c.tradeRow(id)) };
    }),
  );
  c.route(app, "getTrade", ({ path }, user) => {
    const row = c.tradeRow(path.id);
    if (
      row.recipientId !== user.id &&
      c.itemRow(row.itemId).ownerId !== user.id
    )
      fail(403);
    return { data: c.trade(row) };
  });
  c.route(app, "myTrades", ({ query }, user) => {
    const scope = JSON.stringify(["trades", user.id, query.status ?? ""]);
    return page(
      c.orm
        .select({
          id: trades.id,
          itemId: trades.itemId,
          recipientId: trades.recipientId,
          status: trades.status,
          meetingStart: trades.meetingStart,
          meetingEnd: trades.meetingEnd,
          meetingPlace: trades.meetingPlace,
          createdAt: trades.createdAt,
          confirmedAt: trades.confirmedAt,
          completedAt: trades.completedAt,
          cancelledAt: trades.cancelledAt,
          cancelledBy: trades.cancelledBy,
        })
        .from(trades)
        .innerJoin(items, eq(items.id, trades.itemId))
        .where(
          and(
            sql`(${trades.recipientId}=${user.id} OR ${items.ownerId}=${user.id})`,
            query.status ? eq(trades.status, query.status) : undefined,
            cursorWhere(
              query.cursor,
              scope,
              sql`${trades.createdAt}`,
              sql`${trades.id}`,
            ),
          ),
        )
        .orderBy(desc(trades.createdAt), desc(trades.id))
        .limit(query.limit + 1)
        .all(),
      query.limit,
      scope,
      c.trade,
    );
  });
  for (const name of ["confirmTrade", "cancelTrade", "completeTrade"] as const)
    c.route(app, name, ({ path }, user) =>
      c.tx(() => {
        const row = c.tradeRow(path.id),
          item = c.itemRow(row.itemId),
          now = c.now();
        if (
          name === "confirmTrade"
            ? row.recipientId !== user.id
            : name === "completeTrade"
              ? item.ownerId !== user.id
              : row.recipientId !== user.id && item.ownerId !== user.id
        )
          fail(403);
        const target =
          name === "confirmTrade"
            ? "CONFIRMED"
            : name === "cancelTrade"
              ? "CANCELLED"
              : "COMPLETED";
        // Check the same transaction's target before touching its item: old retries are harmless.
        if (row.status === target) return { data: c.trade(row) };
        if (
          item.status !== "RESERVED" ||
          (name === "confirmTrade"
            ? row.status !== "PENDING"
            : name === "completeTrade"
              ? row.status !== "CONFIRMED"
              : !["PENDING", "CONFIRMED"].includes(row.status))
        )
          fail(409);
        const times =
          name === "confirmTrade"
            ? { confirmedAt: now }
            : name === "cancelTrade"
              ? { cancelledAt: now, cancelledBy: user.id }
              : { completedAt: now };
        if (
          c.orm
            .update(trades)
            .set({ status: target, ...times })
            .where(and(eq(trades.id, row.id), eq(trades.status, row.status)))
            .run().changes !== 1
        )
          fail(409);
        if (
          name !== "confirmTrade" &&
          c.orm
            .update(items)
            .set({
              status: name === "cancelTrade" ? "AVAILABLE" : "GIVEN",
              givenAt: name === "completeTrade" ? now : null,
              updatedAt: now,
            })
            .where(and(eq(items.id, item.id), eq(items.status, "RESERVED")))
            .run().changes !== 1
        )
          fail(409);
        return { data: c.trade(c.tradeRow(row.id)) };
      }),
    );
}
