import { it, expect } from "vitest";
import { fixture, itemBody, meeting } from "./test-support.js";

it("rolls back trade creation and completion if the paired item write fails", async () => {
  const f = await fixture(),
    a = await f.login(),
    b = await f.login(1);
  const path = {
    id: (await f.call("createItem", { body: itemBody }, a)).json().data.id,
  };
  await f.call("wantItem", { path }, b);
  f.db.sqlite.exec(
    "CREATE TRIGGER reject_item BEFORE UPDATE ON items BEGIN SELECT RAISE(ABORT, 'test-only rejection'); END",
  );
  expect(
    (await f.call("createTrade", { path, body: meeting() }, a)).statusCode,
  ).toBe(409);
  expect(f.db.sqlite.prepare("SELECT count(*) n FROM trades").get()).toEqual({
    n: 0,
  });
  expect((await f.call("getItem", { path })).json().data.status).toBe(
    "AVAILABLE",
  );
  f.db.sqlite.exec("DROP TRIGGER reject_item");
  const tp = {
    id: (await f.call("createTrade", { path, body: meeting() }, a)).json().data
      .id,
  };
  await f.call("confirmTrade", { path: tp }, b);
  f.db.sqlite.exec(
    "CREATE TRIGGER reject_item BEFORE UPDATE ON items BEGIN SELECT RAISE(ABORT, 'test-only rejection'); END",
  );
  expect((await f.call("completeTrade", { path: tp }, a)).statusCode).toBe(409);
  expect((await f.call("getTrade", { path: tp }, a)).json().data.status).toBe(
    "CONFIRMED",
  );
  expect((await f.call("getItem", { path })).json().data.status).toBe(
    "RESERVED",
  );
});

it("accepts all pricing modes and keeps comments and private lists stably paged", async () => {
  const f = await fixture(),
    a = await f.login(),
    b = await f.login(1);
  for (const pricing of [
    { tradeMode: "FREE", priceCents: 0 },
    { tradeMode: "FLEXIBLE", priceCents: null },
    { tradeMode: "FIXED", priceCents: 1 },
    { tradeMode: "FIXED", priceCents: 9999900 },
  ] as const) {
    expect(
      (await f.call("createItem", { body: { ...itemBody, ...pricing } }, a))
        .statusCode,
    ).toBe(201);
  }
  const mine = (await f.call("myItems", { query: { limit: 2 } }, a)).json();
  expect(mine.data).toHaveLength(2);
  expect(mine.page.nextCursor).toBeTruthy();
  expect(
    (
      await f.call(
        "myItems",
        { query: { limit: 2, cursor: mine.page.nextCursor } },
        a,
      )
    ).json().data,
  ).toHaveLength(2);
  expect((await f.call("myItems", {}, b)).json().data).toHaveLength(0);
  expect(
    (await f.call("myItems", { query: { cursor: mine.page.nextCursor } }, b))
      .statusCode,
  ).toBe(400);
  const path = { id: mine.data[0].id };
  const ids: string[] = [];
  for (const body of ["第一条", "第二条", "第三条"])
    ids.push(
      (await f.call("createComment", { path, body: { body } }, b)).json().data
        .id,
    );
  const first = (
    await f.call("listComments", { path, query: { limit: 1 } })
  ).json();
  const second = (
    await f.call("listComments", {
      path,
      query: { limit: 1, cursor: first.page.nextCursor },
    })
  ).json();
  expect(first.data[0].id).toBe([...ids].sort()[0]);
  expect(second.data[0].id).toBe([...ids].sort()[1]);
  await f.call("wantItem", { path }, b);
  await f.call("createTrade", { path, body: meeting() }, a);
  expect(
    (await f.call("myTrades", { query: { status: "PENDING" } }, b)).json().data,
  ).toHaveLength(1);
  expect(
    (await f.call("myTrades", { query: { status: "COMPLETED" } }, b)).json()
      .data,
  ).toHaveLength(0);
});
