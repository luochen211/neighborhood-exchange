import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { items } from "../../db/schema.js";
import { cursorWhere, page, type Context } from "../../context.js";
export function itemsRoutes(app: FastifyInstance, c: Context) {
  c.route(app, "createItem", ({ body }, user) =>
    c.tx(() => {
      const now = c.now(),
        id = c.id();
      c.orm
        .insert(items)
        .values({
          ...body,
          id,
          ownerId: user.id,
          status: "AVAILABLE",
          createdAt: now,
          updatedAt: now,
        })
        .run();
      return { data: c.item(c.itemRow(id), user) };
    }),
  );
  c.route(app, "getItem", ({ path }, user) => ({
    data: c.item(c.itemRow(path.id), user),
  }));
  c.route(app, "listItems", ({ query }, user) => {
    const scope = JSON.stringify([
      "items",
      query.scope,
      query.q ?? "",
      query.tradeMode ?? "",
    ]);
    const q = query.q?.replace(/[\\%_]/g, "\\$&");
    const rows = c.orm
      .select()
      .from(items)
      .where(
        and(
          query.scope === "archive"
            ? eq(items.status, "GIVEN")
            : sql`${items.status} IN ('AVAILABLE','RESERVED')`,
          query.tradeMode ? eq(items.tradeMode, query.tradeMode) : undefined,
          q
            ? sql`(${items.title} LIKE ${"%" + q + "%"} ESCAPE ${"\\"} OR ${items.description} LIKE ${"%" + q + "%"} ESCAPE ${"\\"})`
            : undefined,
          cursorWhere(
            query.cursor,
            scope,
            sql`${items.createdAt}`,
            sql`${items.id}`,
          ),
        ),
      )
      .orderBy(desc(items.createdAt), desc(items.id))
      .limit(query.limit + 1)
      .all();
    return page(rows, query.limit, scope, (r) => c.item(r, user));
  });
  c.route(app, "myItems", ({ query }, user) => {
    const scope = `myItems:${user.id}`;
    return page(
      c.orm
        .select()
        .from(items)
        .where(
          and(
            eq(items.ownerId, user.id),
            cursorWhere(
              query.cursor,
              scope,
              sql`${items.createdAt}`,
              sql`${items.id}`,
            ),
          ),
        )
        .orderBy(desc(items.createdAt), desc(items.id))
        .limit(query.limit + 1)
        .all(),
      query.limit,
      scope,
      (r) => c.item(r, user),
    );
  });
}
