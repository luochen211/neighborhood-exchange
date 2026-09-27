import { describe, it, expect } from "vitest";
import { randomUUID } from "node:crypto";
import { fixture, itemBody } from "./test-support.js";
import { items, interests, trades } from "./db/schema.js";
import { DEMO_USERS } from "./db/seed.js";

describe("dashboard from a database snapshot", () => {
  it("uses Beijing month boundaries and nullable empty rankings", async () => {
    const f = await fixture();
    f.setNow(Date.parse("2026-09-30T16:00:00Z"));
    expect((await f.call("dashboard")).json().data).toMatchObject({
      month: "2026-10",
      publishedThisMonth: 0,
      completedThisMonth: 0,
      activeCount: 0,
      fastestItem: null,
      mostWantedItem: null,
    });
    const boundary = Date.parse("2026-09-30T16:00:00Z"),
      next = Date.parse("2026-10-31T16:00:00Z");
    for (const createdAt of [boundary - 1, boundary, next - 1, next])
      f.db.orm
        .insert(items)
        .values({
          ...itemBody,
          id: randomUUID(),
          ownerId: DEMO_USERS[0].id,
          status: "AVAILABLE",
          createdAt,
          updatedAt: createdAt,
        })
        .run();
    expect((await f.call("dashboard")).json().data).toMatchObject({
      month: "2026-10",
      publishedThisMonth: 2,
      activeCount: 4,
    });
  });
  it("ranks milliseconds before rounding, deterministic ties, active unique people and month completions", async () => {
    const f = await fixture(),
      boundary = Date.parse("2026-09-30T16:00:00Z");
    f.setNow(boundary + 20000);
    const ids = [
      "10000000-0000-4000-8000-000000000001",
      "10000000-0000-4000-8000-000000000002",
      "10000000-0000-4000-8000-000000000003",
    ];
    const complete = (id: string, createdAt: number, completedAt: number) => {
      f.db.orm
        .insert(items)
        .values({
          ...itemBody,
          id,
          ownerId: DEMO_USERS[0].id,
          status: "GIVEN",
          createdAt,
          updatedAt: completedAt,
          givenAt: completedAt,
        })
        .run();
      f.db.orm
        .insert(trades)
        .values({
          id: randomUUID(),
          itemId: id,
          recipientId: DEMO_USERS[1].id,
          status: "COMPLETED",
          meetingStart: createdAt + 1,
          meetingEnd: createdAt + 2,
          meetingPlace: "公共空间",
          createdAt,
          confirmedAt: createdAt + 1,
          completedAt,
        })
        .run();
    };
    complete(ids[0]!, boundary - 3000, boundary - 1);
    complete(ids[1]!, boundary, boundary + 1001);
    complete(ids[2]!, boundary, boundary + 1000);
    let data = (await f.call("dashboard")).json().data;
    expect(data.completedThisMonth).toBe(2);
    expect(data.fastestItem.itemId).toBe(ids[2]);
    expect(data.fastestItem.durationSeconds).toBe(1);
    f.db.sqlite
      .prepare("UPDATE trades SET completed_at=? WHERE item_id=?")
      .run(boundary + 1000, ids[1]);
    data = (await f.call("dashboard")).json().data;
    expect(data.fastestItem.itemId).toBe(ids[1]);
    const a = await f.login(),
      b = await f.login(1);
    const active: string[] = [];
    for (let i = 0; i < 2; i++) {
      const id = (await f.call("createItem", { body: itemBody }, a)).json().data
        .id;
      active.push(id);
      await f.call("wantItem", { path: { id } }, b);
      await f.call("wantItem", { path: { id } }, b);
    }
    data = (await f.call("dashboard")).json().data;
    expect(data.mostWantedItem).toMatchObject({
      itemId: [...active].sort().at(-1),
      interestCount: 1,
    });
    await f.call("withdrawInterest", { path: { id: active[0]! } }, b);
    await f.call("withdrawInterest", { path: { id: active[1]! } }, b);
    f.db.orm
      .insert(interests)
      .values({
        id: randomUUID(),
        itemId: ids[0]!,
        userId: DEMO_USERS[1].id,
        active: true,
        createdAt: boundary,
        updatedAt: boundary,
      })
      .run();
    expect((await f.call("dashboard")).json().data.mostWantedItem).toBeNull();
  });
});
