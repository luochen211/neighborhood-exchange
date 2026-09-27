import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  endpoints,
  SESSION_COOKIE_NAME,
  type Operation,
  type User,
} from "@neighborhood/contracts";
import { createHash, randomUUID } from "node:crypto";
import { and, eq, sql, type SQL } from "drizzle-orm";
import type { Db } from "./db/index.js";
import type { Config } from "./plugins/config.js";
import {
  users,
  sessions,
  items,
  interests,
  comments,
  trades,
} from "./db/schema.js";
import { ApiError } from "./plugins/errors.js";
export const iso = (n: number) => new Date(n).toISOString();
export const nullableIso = (n: number | null) => (n === null ? null : iso(n));
export const hash = (s: string) => createHash("sha256").update(s).digest("hex");
export function fail(status: number, message?: string): never {
  const codes: Record<number, string> = {
    400: "BAD_REQUEST",
    401: "UNAUTHORIZED",
    403: "FORBIDDEN",
    404: "NOT_FOUND",
    409: "CONFLICT",
    429: "RATE_LIMITED",
  };
  throw new ApiError(
    status,
    codes[status]!,
    message ??
      {
        400: "请求参数无效",
        401: "请先选择演示身份",
        403: "没有操作权限",
        404: "内容不存在",
        409: "状态已变化，请刷新",
        429: "操作过于频繁，请稍后重试",
      }[status] ??
      "请求失败",
  );
}
export function freshness(created: number, now: number) {
  const hours = Math.max(0, now - created) / 3600000;
  return hours < 24
    ? "刚上架"
    : hours < 72
      ? "新上架"
      : `已上架 ${Math.floor(hours / 24)} 天`;
}
export class Limiter {
  private windows = new Map<string, { start: number; count: number }>();
  take(key: string, limit: number, now: number) {
    for (const [k, v] of this.windows)
      if (now - v.start >= 60000) this.windows.delete(k);
    const v = this.windows.get(key) ?? { start: now, count: 0 };
    if (v.count >= limit) fail(429);
    v.count++;
    this.windows.set(key, v);
  }
}
export function createContext(
  db: Db,
  config: Config,
  now: () => number,
  fetcher: typeof fetch = fetch,
) {
  const orm = db.orm;
  const limiter = new Limiter();
  const user = (id: string): User => {
    const row = orm.select().from(users).where(eq(users.id, id)).get();
    if (!row) fail(404);
    return { id: row.id, nickname: row.nickname, building: row.building };
  };
  const itemRow = (id: string) => {
    const row = orm.select().from(items).where(eq(items.id, id)).get();
    if (!row) fail(404);
    return row;
  };
  const tradeRow = (id: string) => {
    const row = orm.select().from(trades).where(eq(trades.id, id)).get();
    if (!row) fail(404);
    return row;
  };
  const countInterests = (id: string) =>
    orm
      .select({ n: sql<number>`count(*)` })
      .from(interests)
      .where(and(eq(interests.itemId, id), eq(interests.active, true)))
      .get()!.n;
  const item = (row: typeof items.$inferSelect, viewer?: User) => ({
    id: row.id,
    owner: user(row.ownerId),
    title: row.title,
    description: row.description,
    tradeMode: row.tradeMode,
    priceCents: row.priceCents,
    imageKey: row.imageKey,
    pickupBuilding: row.pickupBuilding,
    status: row.status,
    createdAt: iso(row.createdAt),
    givenAt: nullableIso(row.givenAt),
    interestCount: countInterests(row.id),
    viewerHasInterest:
      !!viewer &&
      !!orm
        .select()
        .from(interests)
        .where(
          and(
            eq(interests.itemId, row.id),
            eq(interests.userId, viewer.id),
            eq(interests.active, true),
          ),
        )
        .get(),
    freshnessLabel: freshness(row.createdAt, now()),
    serverNow: iso(now()),
  });
  const trade = (row: typeof trades.$inferSelect) => ({
    id: row.id,
    itemId: row.itemId,
    owner: user(itemRow(row.itemId).ownerId),
    recipient: user(row.recipientId),
    status: row.status,
    meetingStart: iso(row.meetingStart),
    meetingEnd: iso(row.meetingEnd),
    meetingPlace: row.meetingPlace,
    createdAt: iso(row.createdAt),
    confirmedAt: nullableIso(row.confirmedAt),
    completedAt: nullableIso(row.completedAt),
    cancelledAt: nullableIso(row.cancelledAt),
    cancelledBy: row.cancelledBy,
  });
  const comment = (row: typeof comments.$inferSelect) => ({
    id: row.id,
    itemId: row.itemId,
    author: user(row.authorId),
    body: row.body,
    createdAt: iso(row.createdAt),
  });
  function viewer(req: FastifyRequest) {
    if (!config.demoMode) return undefined;
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) return undefined;
    const s = orm
      .select()
      .from(sessions)
      .where(
        and(
          eq(sessions.tokenHash, hash(token)),
          sql`${sessions.expiresAt}>${now()}`,
        ),
      )
      .get();
    return s ? user(s.userId) : undefined;
  }
  type Args<K extends Operation> = ReturnType<
    (typeof endpoints)[K]["input"]["parse"]
  >;
  function route<K extends Operation>(
    app: FastifyInstance,
    name: K,
    handler: (
      input: Args<K>,
      viewer: User,
      req: FastifyRequest,
      reply: FastifyReply,
    ) => unknown | Promise<unknown>,
  ) {
    const e = endpoints[name];
    app.route({
      method: e.method,
      url: e.path.replace("{id}", ":id"),
      handler: async (req, reply) => {
        if (e.auth === "demo" && !config.demoMode) fail(403, "演示模式未开启");
        const who = viewer(req);
        if (e.auth === "session" && !who) fail(401);
        const query = { ...(req.query as Record<string, unknown>) };
        if (typeof query.limit === "string" && /^[1-9]\d*$/.test(query.limit))
          query.limit = Number(query.limit);
        const parsed = e.input.safeParse({
          path: req.params,
          query,
          body: req.body,
        });
        if (!parsed.success) {
          const fields: Record<string, string[]> = {};
          for (const i of parsed.error.issues) {
            const key = i.path.slice(1).join(".") || "request";
            (fields[key] ??= []).push(i.message);
          }
          throw new ApiError(400, "BAD_REQUEST", "请检查输入", fields);
        }
        if (req.method !== "GET" && who)
          limiter.take(`write:${who.id}`, 60, now());
        const result = await handler(
          parsed.data as Args<K>,
          who as User,
          req,
          reply,
        );
        const output = e.output.safeParse(result);
        if (!output.success) throw new Error("Response contract violation");
        return reply.code(e.status).send(output.data);
      },
    });
  }
  return {
    db,
    orm,
    config,
    now,
    fetcher,
    limiter,
    user,
    itemRow,
    tradeRow,
    item,
    trade,
    comment,
    countInterests,
    route,
    id: randomUUID,
    tx: <T>(fn: () => T) => db.sqlite.transaction(fn).immediate(),
  };
}
export type Context = ReturnType<typeof createContext>;
export function cursorWhere(
  cursor: string | undefined,
  scope: string,
  created: SQL,
  id: SQL,
  ascending = false,
): SQL | undefined {
  if (!cursor) return undefined;
  try {
    const x = JSON.parse(Buffer.from(cursor, "base64url").toString()) as {
      s: string;
      t: number;
      i: string;
    };
    if (
      x.s !== scope ||
      !Number.isSafeInteger(x.t) ||
      typeof x.i !== "string" ||
      !/^[0-9a-f-]{36}$/.test(x.i)
    )
      fail(400);
    return ascending
      ? sql`(${created}>${x.t} OR (${created}=${x.t} AND ${id}>${x.i}))`
      : sql`(${created}<${x.t} OR (${created}=${x.t} AND ${id}<${x.i}))`;
  } catch {
    return fail(400, "分页游标无效");
  }
}
export function page<T extends { id: string; createdAt: number }>(
  rows: T[],
  limit: number,
  scope: string,
  map: (row: T) => unknown,
) {
  const visible = rows.slice(0, limit);
  const last = visible.at(-1);
  return {
    data: visible.map(map),
    page: {
      nextCursor:
        rows.length > limit && last
          ? Buffer.from(
              JSON.stringify({ s: scope, t: last.createdAt, i: last.id }),
            ).toString("base64url")
          : null,
    },
  };
}
