import { describe, it, expect } from "vitest";
import { createClient } from "@neighborhood/contracts";
import { fixtureUsers } from "@neighborhood/contracts/mock";
import { createStatefulMock } from "./mock";
import { createApi } from "./api";
const setup = () => createApi(createClient({ fetch: createStatefulMock() }));
const owner = fixtureUsers[0]!,
  recipient = fixtureUsers[1]!,
  third = fixtureUsers[2]!;
const draft = {
  title: "测试书架",
  description: "包含中文、100% 与 a_b 字符",
  tradeMode: "FREE" as const,
  priceCents: 0 as const,
  imageKey: "chair" as const,
  pickupBuilding: "1栋",
};
const windowInput = () => ({
  recipientId: recipient.id,
  meetingStart: new Date(Date.now() + 3600000).toISOString(),
  meetingEnd: new Date(Date.now() + 7200000).toISOString(),
  meetingPlace: "公共活动室",
});
describe("contract-backed frontend adapter", () => {
  it("supports publish, interest, reservation, confirmation and read-only archive with derived statistics", async () => {
    const api = setup();
    await expect(api.publish(draft)).rejects.toMatchObject({ status: 401 });
    await api.login(owner.id);
    const before = (await api.dashboard()).data;
    const item = (await api.publish(draft)).data;
    await expect(api.want(item.id)).rejects.toMatchObject({ status: 403 });
    await api.login(recipient.id);
    await api.want(item.id);
    await api.want(item.id);
    expect((await api.item(item.id)).data.interestCount).toBe(1);
    await api.comment(item.id, "<script>alert(1)</script>");
    await api.login(owner.id);
    const trade = (await api.reserve(item.id, windowInput())).data;
    await expect(api.reserve(item.id, windowInput())).rejects.toMatchObject({
      status: 409,
    });
    await api.login(third.id);
    await expect(api.confirm(trade.id)).rejects.toMatchObject({ status: 403 });
    await api.login(recipient.id);
    await expect(api.withdraw(item.id)).rejects.toMatchObject({ status: 409 });
    await api.confirm(trade.id);
    await api.login(owner.id);
    await api.complete(trade.id);
    await api.complete(trade.id);
    expect((await api.item(item.id)).data.status).toBe("GIVEN");
    expect(
      (await api.items({ scope: "archive" })).data.some(
        (i) => i.id === item.id,
      ),
    ).toBe(true);
    await expect(api.comment(item.id, "不能写入")).rejects.toMatchObject({
      status: 409,
    });
    const after = (await api.dashboard()).data;
    expect(after.completedThisMonth).toBe(before.completedThisMonth + 1);
    expect(after.publishedThisMonth).toBe(before.publishedThisMonth + 1);
    expect((await api.comments(item.id)).data[0]?.body).toContain("<script>");
  });
  it("restores availability after cancellation and old retries do not cancel a new reservation", async () => {
    const api = setup();
    await api.login(owner.id);
    const item = (await api.publish(draft)).data;
    await api.login(recipient.id);
    await api.want(item.id);
    await api.login(owner.id);
    const first = (await api.reserve(item.id, windowInput())).data;
    await api.cancel(first.id);
    expect((await api.item(item.id)).data.status).toBe("AVAILABLE");
    const second = (await api.reserve(item.id, windowInput())).data;
    await api.cancel(first.id);
    expect((await api.item(item.id)).data.status).toBe("RESERVED");
    await expect(api.complete(second.id)).rejects.toMatchObject({
      status: 409,
    });
  });
  it("combines search and mode filters and paginates without treating wildcards specially", async () => {
    const api = setup();
    await api.login(owner.id);
    await api.publish(draft);
    await api.publish({ ...draft, title: "第二个书架" });
    const r = await api.items({ q: "100%", tradeMode: "FREE", limit: 1 });
    expect(r.data).toHaveLength(1);
    expect(r.page.nextCursor).not.toBeNull();
    expect(
      (
        await api.items({
          q: "100%",
          tradeMode: "FREE",
          limit: 1,
          cursor: r.page.nextCursor!,
        })
      ).data[0]?.id,
    ).not.toBe(r.data[0]?.id);
    expect((await api.items({ q: "a_b", tradeMode: "FIXED" })).data).toEqual(
      [],
    );
  });
  it("cancels requests without a static fallback and HTTP transport retains same-origin cookies", async () => {
    let request: RequestInit | undefined;
    const api = createApi(
      createClient({
        fetch: async (_url, init) => {
          request = init;
          return new Response(
            JSON.stringify({
              error: {
                code: "SERVICE_UNAVAILABLE",
                message: "维护中",
                requestId: "test",
              },
            }),
            { status: 503 },
          );
        },
      }),
    );
    await expect(api.items({})).rejects.toMatchObject({ status: 503 });
    expect(request?.credentials).toBe("same-origin");
    const mock = setup();
    const controller = new AbortController();
    controller.abort();
    await expect(mock.items({}, controller.signal)).rejects.toMatchObject({
      name: "AbortError",
    });
  });
});
