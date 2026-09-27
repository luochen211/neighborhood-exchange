// Uses only synthetic fixtures in an automatically removed temporary database.
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir, cpus, platform, arch } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { buildApp } from "../dist/app.js";
import { openDatabase, migrate } from "../dist/db/index.js";
import { seed, DEMO_USERS } from "../dist/db/seed.js";
import { readConfig } from "../dist/plugins/config.js";
import { endpoints } from "@neighborhood/contracts";
const dir = await mkdtemp(join(tmpdir(), "neighborhood-http-"));
const db = openDatabase(join(dir, "acceptance.db"));
migrate(db);
seed(db);
const config = readConfig({
  DEMO_MODE: "true",
  DATABASE_URL: join(dir, "acceptance.db"),
});
const app = await buildApp({ database: db, config });
try {
  const base = await app.listen({ host: "127.0.0.1", port: 0 });
  async function call(op, { id, body, query } = {}, cookie) {
    const e = endpoints[op];
    const r = await fetch(
      base +
        "/api/v1" +
        e.path.replace("{id}", id ?? "") +
        (query ? "?" + new URLSearchParams(query) : ""),
      {
        method: e.method,
        headers: {
          ...(body ? { "content-type": "application/json" } : {}),
          ...(cookie ? { cookie } : {}),
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      },
    );
    const data = await r.json();
    assert.equal(r.status, e.status, JSON.stringify(data));
    endpoints[op].output.parse(data);
    return {
      data: data.data,
      cookie: r.headers.get("set-cookie")?.split(";")[0],
    };
  }
  const a = (await call("demoLogin", { body: { userId: DEMO_USERS[0].id } }))
      .cookie,
    b = (await call("demoLogin", { body: { userId: DEMO_USERS[2].id } }))
      .cookie;
  const id = (
    await call(
      "createItem",
      {
        body: {
          title: "HTTP 验收椅子",
          description: "虚构测试物品",
          tradeMode: "FREE",
          priceCents: 0,
          imageKey: "chair",
          pickupBuilding: "1 号楼",
        },
      },
      a,
    )
  ).data.id;
  await call("wantItem", { id }, b);
  await call(
    "createComment",
    { id, body: { body: "可以在公共活动室交接" } },
    b,
  );
  const trade = (
    await call(
      "createTrade",
      {
        id,
        body: {
          recipientId: DEMO_USERS[2].id,
          meetingStart: new Date(Date.now() + 3600000).toISOString(),
          meetingEnd: new Date(Date.now() + 7200000).toISOString(),
          meetingPlace: "公共活动室",
        },
      },
      a,
    )
  ).data;
  await call("confirmTrade", { id: trade.id }, b);
  await call("completeTrade", { id: trade.id }, a);
  assert.equal((await call("getItem", { id })).data.status, "GIVEN");
  assert.equal(
    (await call("myTrades", {}, b)).data.some((t) => t.id === trade.id),
    true,
  );
  const count = db.sqlite.prepare("SELECT count(*) n FROM items").get().n;
  const insert = db.sqlite.prepare(
    "INSERT INTO items VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
  );
  db.sqlite.transaction(() => {
    for (let i = count; i < 1000; i++)
      insert.run(
        randomUUID(),
        DEMO_USERS[0].id,
        `物品 ${i}`,
        "性能验收虚构记录",
        "FREE",
        0,
        "chair",
        "1 号楼",
        "AVAILABLE",
        Date.now() - i,
        Date.now(),
        null,
      );
  })();
  const timings = [];
  await call("listItems");
  await Promise.all(
    Array.from({ length: 5 }, async () => {
      for (let i = 0; i < 20; i++) {
        const start = performance.now();
        await call("listItems", { query: { limit: "20" } });
        timings.push(performance.now() - start);
      }
    }),
  );
  timings.sort((a, b) => a - b);
  const p95 = timings[Math.ceil(timings.length * 0.95) - 1];
  assert.ok(p95 <= 500, `Read p95 ${p95.toFixed(2)} ms exceeds 500 ms`);
  console.log(
    JSON.stringify(
      {
        httpFlow: "passed",
        itemCount: 1000,
        concurrentClients: 5,
        samples: timings.length,
        p95Ms: Number(p95.toFixed(2)),
        node: process.version,
        platform: platform(),
        arch: arch(),
        cpu: cpus()[0]?.model,
        realLlm: "not tested",
      },
      null,
      2,
    ),
  );
} finally {
  await app.close();
  db.sqlite.close();
  await rm(dir, { recursive: true, force: true });
}
