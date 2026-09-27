import type { FastifyInstance } from "fastify";
import { and, asc, eq, sql } from "drizzle-orm";
import { comments } from "../../db/schema.js";
import { cursorWhere, fail, page, type Context } from "../../context.js";
export function commentsRoutes(app: FastifyInstance, c: Context) {
  c.route(app, "listComments", ({ path, query }) => {
    c.itemRow(path.id);
    const scope = `comments:${path.id}`;
    return page(
      c.orm
        .select()
        .from(comments)
        .where(
          and(
            eq(comments.itemId, path.id),
            cursorWhere(
              query.cursor,
              scope,
              sql`${comments.createdAt}`,
              sql`${comments.id}`,
              true,
            ),
          ),
        )
        .orderBy(asc(comments.createdAt), asc(comments.id))
        .limit(query.limit + 1)
        .all(),
      query.limit,
      scope,
      c.comment,
    );
  });
  c.route(app, "createComment", ({ path, body }, user) =>
    c.tx(() => {
      if (c.itemRow(path.id).status === "GIVEN") fail(409);
      const row = {
        id: c.id(),
        itemId: path.id,
        authorId: user.id,
        body: body.body,
        createdAt: c.now(),
      };
      c.orm.insert(comments).values(row).run();
      return { data: c.comment(row) };
    }),
  );
}
