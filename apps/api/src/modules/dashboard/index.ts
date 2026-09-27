import type { FastifyInstance } from "fastify";
import { iso, type Context } from "../../context.js";
export function dashboardRoutes(app: FastifyInstance, c: Context) {
  c.route(app, "dashboard", () =>
    c.db.sqlite.transaction(() => {
      const now = c.now(),
        beijing = new Date(now + 8 * 3600000),
        year = beijing.getUTCFullYear(),
        month = beijing.getUTCMonth();
      const start = Date.UTC(year, month, 1) - 8 * 3600000,
        end = Date.UTC(year, month + 1, 1) - 8 * 3600000;
      const count = (query: string, ...args: number[]) =>
        (c.db.sqlite.prepare(query).get(...args) as { n: number }).n;
      const fastest = c.db.sqlite
        .prepare(
          "SELECT i.id AS itemId,i.title,(t.completed_at-i.created_at) AS duration FROM trades t JOIN items i ON i.id=t.item_id WHERE t.status='COMPLETED' ORDER BY duration ASC,t.completed_at ASC,i.id ASC LIMIT 1",
        )
        .get() as
        { itemId: string; title: string; duration: number } | undefined;
      const mostWanted = c.db.sqlite
        .prepare(
          "SELECT i.id AS itemId,i.title,count(DISTINCT n.user_id) AS interestCount FROM items i JOIN interests n ON n.item_id=i.id AND n.active=1 WHERE i.status!='GIVEN' GROUP BY i.id HAVING interestCount>0 ORDER BY interestCount DESC,i.created_at DESC,i.id DESC LIMIT 1",
        )
        .get();
      return {
        data: {
          month: `${year}-${String(month + 1).padStart(2, "0")}`,
          timezone: "Asia/Shanghai",
          publishedThisMonth: count(
            "SELECT count(*) n FROM items WHERE created_at>=? AND created_at<?",
            start,
            end,
          ),
          completedThisMonth: count(
            "SELECT count(*) n FROM trades WHERE status='COMPLETED' AND completed_at>=? AND completed_at<?",
            start,
            end,
          ),
          activeCount: count(
            "SELECT count(*) n FROM items WHERE status IN ('AVAILABLE','RESERVED')",
          ),
          fastestItem: fastest
            ? {
                itemId: fastest.itemId,
                title: fastest.title,
                durationSeconds: Math.floor(fastest.duration / 1000),
              }
            : null,
          mostWantedItem: mostWanted ?? null,
          asOf: iso(now),
        },
      };
    })(),
  );
}
