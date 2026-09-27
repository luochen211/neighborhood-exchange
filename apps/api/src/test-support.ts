import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect } from "vitest";
import { buildApp, type AppOptions } from "./app.js";
import { openDatabase, migrate } from "./db/index.js";
import { DEMO_USERS } from "./db/seed.js";
import { users } from "./db/schema.js";
import { readConfig } from "./plugins/config.js";
import { endpoints, type Operation, type Input } from "@neighborhood/contracts";
const cleanup: (() => Promise<void>)[] = [];
afterEach(async () => {
  for (const fn of cleanup.splice(0).reverse()) await fn();
});
export const NOW = Date.parse("2026-09-27T02:00:00Z");
export async function fixture(options: AppOptions = {}) {
  const dir = mkdtempSync(join(tmpdir(), "neighborhood-api-")),
    filename = join(dir, "test.sqlite");
  const db = openDatabase(filename);
  migrate(db);
  for (const u of DEMO_USERS)
    db.orm
      .insert(users)
      .values({ ...u, createdAt: NOW })
      .run();
  let clock = NOW;
  const config = {
    ...readConfig({ DEMO_MODE: "true", DATABASE_URL: filename }),
    ...options.config,
  };
  const app = await buildApp({
    database: db,
    config,
    now: () => clock,
    ...options,
  });
  cleanup.push(async () => {
    await app.close();
    if (db.sqlite.open) db.sqlite.close();
    rmSync(dir, { recursive: true, force: true });
  });
  const login = async (index = 0) => {
    const r = await app.inject({
      method: "POST",
      url: "/api/v1/auth/demo-login",
      payload: { userId: DEMO_USERS[index]!.id },
    });
    expect(r.statusCode).toBe(200);
    return r.cookies[0]!.value;
  };
  const call = async <K extends Operation>(
    op: K,
    args: Partial<Input<K>> = {},
    cookie?: string,
  ) => {
    const endpoint = endpoints[op],
      a = args as {
        path?: { id: string };
        query?: Record<string, unknown>;
        body?: unknown;
      };
    const query = new URLSearchParams(
      Object.entries(a.query ?? {}).map(([k, v]) => [k, String(v)]),
    );
    const url =
      "/api/v1" +
      endpoint.path.replace("{id}", a.path?.id ?? "") +
      (query.size ? "?" + query : "");
    const r = await app.inject({
      method: endpoint.method,
      url,
      ...(a.body !== undefined
        ? {
            payload: JSON.stringify(a.body),
            headers: { "content-type": "application/json" },
          }
        : {}),
      ...(cookie ? { cookies: { neighborhood_session: cookie } } : {}),
    });
    if (r.statusCode < 400)
      expect(
        endpoint.output.safeParse(r.json()).success,
        `${op}: ${r.body}`,
      ).toBe(true);
    return r;
  };
  return {
    app,
    db,
    filename,
    config,
    login,
    call,
    setNow: (n: number) => {
      clock = n;
    },
  };
}
export const itemBody = {
  title: "测试木椅",
  description: "搬家整理，详情可询问",
  tradeMode: "FREE" as const,
  priceCents: 0 as const,
  imageKey: "chair" as const,
  pickupBuilding: "1 号楼",
};
export const meeting = (recipientId: string = DEMO_USERS[1].id) => ({
  recipientId,
  meetingStart: new Date(NOW + 3600000).toISOString(),
  meetingEnd: new Date(NOW + 7200000).toISOString(),
  meetingPlace: "公共活动室",
});
