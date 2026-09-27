import type { FastifyInstance } from "fastify";
import { and, desc, eq, sql } from "drizzle-orm";
import { interests } from "../../db/schema.js";
import { cursorWhere, fail, iso, page, type Context } from "../../context.js";
export function interestsRoutes(app: FastifyInstance, c: Context) {
  for (const name of ["wantItem", "withdrawInterest"] as const)
    c.route(app, name, ({ path }, user) =>
      c.tx(() => {
        const item = c.itemRow(path.id);
        if (item.ownerId === user.id) fail(403);
        if (item.status !== "AVAILABLE") fail(409);
        const active = name === "wantItem",
          now = c.now();
        const old = c.orm
          .select()
          .from(interests)
          .where(
            and(eq(interests.itemId, path.id), eq(interests.userId, user.id)),
          )
          .get();
        if (old) {
          if (old.active !== active)
            c.orm
              .update(interests)
              .set({ active, updatedAt: now })
              .where(eq(interests.id, old.id))
              .run();
        } else if (active)
          c.orm
            .insert(interests)
            .values({
              id: c.id(),
              itemId: path.id,
              userId: user.id,
              active,
              createdAt: now,
              updatedAt: now,
            })
            .run();
        return { data: { active, count: c.countInterests(path.id) } };
      }),
    );
  c.route(app, "itemInterests", ({ path, query }, user) => {
    if (c.itemRow(path.id).ownerId !== user.id) fail(403);
    const scope = `interests:${path.id}:${user.id}`;
    return page(
      c.orm
        .select()
        .from(interests)
        .where(
          and(
            eq(interests.itemId, path.id),
            eq(interests.active, true),
            cursorWhere(
              query.cursor,
              scope,
              sql`${interests.createdAt}`,
              sql`${interests.id}`,
            ),
          ),
        )
        .orderBy(desc(interests.createdAt), desc(interests.id))
        .limit(query.limit + 1)
        .all(),
      query.limit,
      scope,
      (r) => ({ ...c.user(r.userId), createdAt: iso(r.createdAt) }),
    );
  });
  c.route(app, "myInterests", ({ query }, user) => {
    const scope = `myInterests:${user.id}`;
    return page(
      c.orm
        .select()
        .from(interests)
        .where(
          and(
            eq(interests.userId, user.id),
            eq(interests.active, true),
            cursorWhere(
              query.cursor,
              scope,
              sql`${interests.createdAt}`,
              sql`${interests.id}`,
            ),
          ),
        )
        .orderBy(desc(interests.createdAt), desc(interests.id))
        .limit(query.limit + 1)
        .all(),
      query.limit,
      scope,
      (r) => ({
        id: r.id,
        item: c.item(c.itemRow(r.itemId), user),
        createdAt: iso(r.createdAt),
      }),
    );
  });
}
