import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { buildApp } from "./app.js";
import { fixture, itemBody, meeting, NOW } from "./test-support.js";
import { DEMO_USERS, seed } from "./db/seed.js";
import { freshness } from "./context.js";

describe("real database HTTP acceptance", () => {
  it("two identities complete the flow, preserve privacy, idempotency, archive and restart", async () => {
    const f = await fixture(),
      a = await f.login(),
      b = await f.login(1),
      outsider = await f.login(2);
    const created = await f.call("createItem", { body: itemBody }, a);
    expect(created.statusCode).toBe(201);
    const id = created.json().data.id,
      path = { id };
    expect((await f.call("wantItem", { path }, a)).statusCode).toBe(403);
    expect((await f.call("wantItem", { path }, b)).json().data.count).toBe(1);
    expect((await f.call("wantItem", { path }, b)).json().data.count).toBe(1);
    expect((await f.call("itemInterests", { path }, b)).statusCode).toBe(403);
    expect((await f.call("itemInterests", { path }, a)).json().data[0].id).toBe(
      DEMO_USERS[1].id,
    );
    expect(
      (
        await f.call(
          "createComment",
          { path, body: { body: "<script>alert(1)</script>" } },
          b,
        )
      ).statusCode,
    ).toBe(201);
    const t = await f.call("createTrade", { path, body: meeting() }, a);
    expect(t.statusCode).toBe(201);
    const tp = { id: t.json().data.id };
    expect((await f.call("getTrade", { path: tp }, outsider)).statusCode).toBe(
      403,
    );
    expect((await f.call("getItem", { path }, outsider)).body).not.toContain(
      "公共活动室",
    );
    expect((await f.call("withdrawInterest", { path }, b)).statusCode).toBe(
      409,
    );
    expect((await f.call("wantItem", { path }, outsider)).statusCode).toBe(409);
    expect(
      (
        await f.call(
          "createComment",
          { path, body: { body: "已预约后仍可公开留言" } },
          a,
        )
      ).statusCode,
    ).toBe(201);
    expect((await f.call("completeTrade", { path: tp }, a)).statusCode).toBe(
      409,
    );
    expect((await f.call("confirmTrade", { path: tp }, a)).statusCode).toBe(
      403,
    );
    const confirmed = await f.call("confirmTrade", { path: tp }, b);
    expect(confirmed.statusCode).toBe(200);
    expect((await f.call("confirmTrade", { path: tp }, b)).json()).toEqual(
      confirmed.json(),
    );
    expect((await f.call("completeTrade", { path: tp }, b)).statusCode).toBe(
      403,
    );
    f.setNow(NOW + 10000);
    const done = await f.call("completeTrade", { path: tp }, a);
    expect(done.statusCode).toBe(200);
    f.setNow(NOW + 20000);
    expect((await f.call("completeTrade", { path: tp }, a)).json()).toEqual(
      done.json(),
    );
    expect(
      (await f.call("completeTrade", { path: tp }, outsider)).statusCode,
    ).toBe(403);
    expect((await f.call("cancelTrade", { path: tp }, b)).statusCode).toBe(409);
    expect(
      (await f.call("createComment", { path, body: { body: "不能写" } }, b))
        .statusCode,
    ).toBe(409);
    expect((await f.call("wantItem", { path }, b)).statusCode).toBe(409);
    expect(
      (await f.call("createTrade", { path, body: meeting() }, a)).statusCode,
    ).toBe(409);
    expect(
      (await f.call("myInterests", {}, b)).json().data[0].item.status,
    ).toBe("GIVEN");
    expect((await f.call("listItems")).json().data).toHaveLength(0);
    expect(
      (await f.call("listItems", { query: { scope: "archive" } })).json().data,
    ).toHaveLength(1);
    expect((await f.call("dashboard")).json().data).toMatchObject({
      publishedThisMonth: 1,
      completedThisMonth: 1,
      activeCount: 0,
      fastestItem: { itemId: id, durationSeconds: 10 },
      mostWantedItem: null,
    });
    await f.app.close();
    f.db.sqlite.close();
    const restarted = await buildApp({ config: f.config });
    try {
      expect(
        (await restarted.inject(`/api/v1/items/${id}`)).json().data.status,
      ).toBe("GIVEN");
      expect(
        (
          await restarted.inject({
            url: `/api/v1/trades/${tp.id}`,
            cookies: { neighborhood_session: a },
          })
        ).json().data.status,
      ).toBe("COMPLETED");
    } finally {
      await restarted.close();
    }
  });
  it("withdraw/reactivate, competing reservations, cancellation recovery and stale cancel", async () => {
    const f = await fixture(),
      a = await f.login(),
      b = await f.login(1),
      d = await f.login(2);
    const id = (await f.call("createItem", { body: itemBody }, a)).json().data
        .id,
      path = { id };
    await f.call("wantItem", { path }, b);
    await f.call("withdrawInterest", { path }, b);
    expect(
      (await f.call("withdrawInterest", { path }, b)).json().data.count,
    ).toBe(0);
    expect(
      (await f.call("createTrade", { path, body: meeting() }, a)).statusCode,
    ).toBe(409);
    await f.call("wantItem", { path }, b);
    await f.call("wantItem", { path }, d);
    expect(
      f.db.sqlite.prepare("SELECT count(*) n FROM interests").get(),
    ).toEqual({ n: 2 });
    const attempts = await Promise.all([
      f.call("createTrade", { path, body: meeting() }, a),
      f.call("createTrade", { path, body: meeting() }, a),
    ]);
    expect(attempts.map((r) => r.statusCode).sort()).toEqual([201, 409]);
    const old = {
      id: attempts.find((r) => r.statusCode === 201)!.json().data.id,
    };
    expect((await f.call("cancelTrade", { path: old }, d)).statusCode).toBe(
      403,
    );
    const cancelled = await f.call("cancelTrade", { path: old }, b);
    expect(cancelled.statusCode).toBe(200);
    expect((await f.call("getItem", { path })).json().data.status).toBe(
      "AVAILABLE",
    );
    const next = await f.call(
      "createTrade",
      { path, body: meeting(DEMO_USERS[2].id) },
      a,
    );
    expect(next.statusCode).toBe(201);
    expect((await f.call("cancelTrade", { path: old }, a)).json()).toEqual(
      cancelled.json(),
    );
    expect((await f.call("getItem", { path })).json().data.status).toBe(
      "RESERVED",
    );
    expect((await f.call("confirmTrade", { path: old }, b)).statusCode).toBe(
      409,
    );
    const np = { id: next.json().data.id };
    await f.call("confirmTrade", { path: np }, d);
    expect((await f.call("cancelTrade", { path: np }, a)).statusCode).toBe(200);
    expect((await f.call("dashboard")).json().data.completedThisMonth).toBe(0);
  });
  it("strict request validation, search literals, stable pagination and time windows", async () => {
    const f = await fixture(),
      a = await f.login(),
      b = await f.login(1);
    for (const body of [
      { ...itemBody, priceCents: 1 },
      { ...itemBody, ownerId: DEMO_USERS[1].id },
      { ...itemBody, tradeMode: "FIXED", priceCents: 1.5 },
      { ...itemBody, imageKey: "https://evil.test/x" },
    ])
      expect(
        (
          await f.app.inject({
            method: "POST",
            url: "/api/v1/items",
            cookies: { neighborhood_session: a },
            payload: body,
          })
        ).statusCode,
      ).toBe(400);
    const ids: string[] = [];
    for (const title of ["灯 100%_中文", "LAMP", "灯 ordinary"])
      ids.push(
        (await f.call("createItem", { body: { ...itemBody, title } }, a)).json()
          .data.id,
      );
    expect(
      (await f.call("listItems", { query: { q: "%_" } })).json().data,
    ).toHaveLength(1);
    expect(
      (await f.call("listItems", { query: { q: "lamp" } })).json().data,
    ).toHaveLength(1);
    expect(
      (
        await f.call("listItems", { query: { q: "中文", tradeMode: "FIXED" } })
      ).json().data,
    ).toHaveLength(0);
    const all = (await f.call("listItems"))
      .json()
      .data.map((r: { id: string }) => r.id);
    expect(all).toEqual([...ids].sort().reverse());
    const first = (await f.call("listItems", { query: { limit: 1 } })).json();
    const second = (
      await f.call("listItems", {
        query: { limit: 1, cursor: first.page.nextCursor },
      })
    ).json();
    expect(second.data[0].id).toBe(all[1]);
    expect(
      (await f.call("listItems", { query: { cursor: "bad" } })).statusCode,
    ).toBe(400);
    for (const limit of ["1.5", "0", "-1", "abc", "51", "01"])
      expect(
        (await f.app.inject("/api/v1/items?limit=" + limit)).statusCode,
      ).toBe(400);
    const path = { id: ids[0]! };
    await f.call("wantItem", { path }, b);
    for (const body of [
      { ...meeting(), meetingStart: new Date(NOW).toISOString() },
      {
        ...meeting(),
        meetingEnd: new Date(NOW + 7 * 86400000 + 1).toISOString(),
      },
    ])
      expect((await f.call("createTrade", { path, body }, a)).statusCode).toBe(
        400,
      );
    expect(
      (
        await f.call(
          "createTrade",
          {
            path,
            body: {
              ...meeting(),
              meetingEnd: new Date(NOW + 7 * 86400000).toISOString(),
            },
          },
          a,
        )
      ).statusCode,
    ).toBe(201);
    expect(
      (await f.call("getItem", { path: { id: randomUUID() } })).statusCode,
    ).toBe(404);
  });
  it("database constraints and migration/seed are durable and non-destructive", async () => {
    const f = await fixture();
    seed(f.db, NOW);
    const before = f.db.sqlite.prepare("SELECT * FROM items ORDER BY id").all();
    seed(f.db, NOW + 86400000);
    expect(
      f.db.sqlite.prepare("SELECT * FROM items ORDER BY id").all(),
    ).toEqual(before);
    expect(() =>
      f.db.sqlite.exec(
        "UPDATE items SET price_cents=NULL WHERE trade_mode='FREE'",
      ),
    ).toThrow(/CHECK/);
    expect(() =>
      f.db.sqlite.exec("UPDATE items SET owner_id='missing'"),
    ).toThrow(/FOREIGN KEY/);
    expect(() =>
      f.db.sqlite.exec(
        "UPDATE trades SET status='COMPLETED' WHERE status='PENDING'",
      ),
    ).toThrow(/CHECK/);
    expect(() =>
      f.db.sqlite.exec(
        "INSERT INTO trades SELECT 'duplicate',item_id,recipient_id,status,meeting_start,meeting_end,meeting_place,created_at,confirmed_at,completed_at,cancelled_at,cancelled_by FROM trades WHERE status='PENDING'",
      ),
    ).toThrow(/UNIQUE/);
    expect(f.db.sqlite.pragma("journal_mode", { simple: true })).toBe("wal");
    expect(f.db.sqlite.pragma("foreign_keys", { simple: true })).toBe(1);
  });
  it("freshness exact boundaries", () => {
    expect(
      [86399999, 86400000, 259199999, 259200000].map((age) =>
        freshness(NOW - age, NOW),
      ),
    ).toEqual(["刚上架", "新上架", "新上架", "已上架 3 天"]);
  });
});
