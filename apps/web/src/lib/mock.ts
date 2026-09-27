import {
  AI_DISCLAIMER,
  validateTradeWindow,
  type Item,
  type Trade,
  type Comment,
  type User,
  type ErrorCode,
} from "@neighborhood/contracts";
import {
  createMockFetch,
  fixtureItems,
  fixtureUsers,
  fixtureTrade,
  type MockHandlers,
} from "@neighborhood/contracts/mock";

export function createStatefulMock() {
  const users = structuredClone(fixtureUsers);
  let viewer: User | null = null;
  const now = () => new Date().toISOString();
  const items: Item[] = structuredClone(fixtureItems).map((item, i) => ({
    ...item,
    createdAt: new Date(Date.now() - (i * 36 + 2) * 3600000).toISOString(),
    givenAt: item.status === "GIVEN" ? now() : null,
  }));
  items.push(
    {
      ...items[0]!,
      id: "00000000-0000-4000-8000-000000000014",
      title: "窗边的实木小椅子",
      description:
        "书房整理换下的小椅子。椅面有使用痕迹，结构稳固，请在交接时查看实物。",
      imageKey: "chair",
      owner: users[2]!,
      pickupBuilding: users[2]!.building,
      tradeMode: "FREE",
      priceCents: 0,
    },
    {
      ...items[0]!,
      id: "00000000-0000-4000-8000-000000000015",
      title: "读过的书，交给下一位读者",
      description:
        "整理书架留下的几本旧书，书页有少量笔记。有需要的邻居可以留言了解。",
      imageKey: "books",
      owner: users[1]!,
      pickupBuilding: users[1]!.building,
      tradeMode: "FLEXIBLE",
      priceCents: null,
    },
  );
  const trades: Trade[] = [
    {
      ...structuredClone(fixtureTrade),
      itemId: items[1]!.id,
      meetingStart: new Date(Date.now() + 86400000).toISOString(),
      meetingEnd: new Date(Date.now() + 90000000).toISOString(),
      createdAt: now(),
    },
    {
      ...structuredClone(fixtureTrade),
      id: crypto.randomUUID(),
      itemId: items[2]!.id,
      status: "COMPLETED",
      confirmedAt: now(),
      completedAt: now(),
    },
  ];
  const comments: Comment[] = [];
  const interests = new Map(
    items.map((i) => [
      i.id,
      new Map([
        [
          users.find((u) => u.id !== i.owner.id)!.id,
          { id: crypto.randomUUID(), createdAt: now() },
        ],
      ]),
    ]),
  );
  const fail = (code: ErrorCode, message: string) => ({
    error: { code, message, requestId: "development-mock" },
  });
  const loginError = () => fail("UNAUTHORIZED", "请先选择演示身份");
  const item = (id: string) => items.find((i) => i.id === id);
  const dto = (i: Item): Item => ({
    ...i,
    interestCount: interests.get(i.id)?.size ?? 0,
    viewerHasInterest: !!viewer && !!interests.get(i.id)?.has(viewer.id),
    serverNow: now(),
  });
  const page = <T>(data: T[], query: { cursor?: string; limit?: number }) => {
    const start = Number(query.cursor ?? 0);
    const limit = query.limit ?? 20;
    return {
      data: data.slice(start, start + limit),
      page: {
        nextCursor: start + limit < data.length ? String(start + limit) : null,
      },
    };
  };
  const sort = (a: Item, b: Item) =>
    b.createdAt.localeCompare(a.createdAt) || b.id.localeCompare(a.id);
  const changeTrade = (
    id: string,
    action: "confirm" | "cancel" | "complete",
  ) => {
    if (!viewer) return loginError();
    const trade = trades.find((t) => t.id === id);
    if (!trade) return fail("NOT_FOUND", "预约不存在");
    if (
      ![trade.owner.id, trade.recipient.id].includes(viewer.id) ||
      (action === "confirm" && viewer.id !== trade.recipient.id) ||
      (action === "complete" && viewer.id !== trade.owner.id)
    )
      return fail("FORBIDDEN", "没有操作权限");
    const target = {
      confirm: "CONFIRMED",
      cancel: "CANCELLED",
      complete: "COMPLETED",
    } as const;
    if (trade.status === target[action]) return { data: { data: trade } };
    if (
      (action === "confirm" && trade.status !== "PENDING") ||
      (action === "complete" && trade.status !== "CONFIRMED") ||
      (action === "cancel" && !["PENDING", "CONFIRMED"].includes(trade.status))
    )
      return fail("CONFLICT", "状态已变化，请刷新");
    trade.status = target[action];
    const current = item(trade.itemId)!;
    if (action === "confirm") trade.confirmedAt = now();
    if (action === "cancel") {
      trade.cancelledAt = now();
      trade.cancelledBy = viewer.id;
      current.status = "AVAILABLE";
    }
    if (action === "complete") {
      trade.completedAt = now();
      current.status = "GIVEN";
      current.givenAt = trade.completedAt;
    }
    return { data: { data: trade } };
  };
  const handlers: MockHandlers = {
    health: () => ({ data: { data: { status: "ok", database: "ok" } } }),
    demoUsers: () => ({ data: page(users, {}) }),
    demoLogin: ({ body }) => {
      viewer = users.find((u) => u.id === body.userId) ?? null;
      return viewer
        ? { data: { data: viewer } }
        : fail("NOT_FOUND", "身份不存在");
    },
    logout: () => {
      viewer = null;
      return { data: { data: { loggedOut: true } } };
    },
    me: () => (viewer ? { data: { data: viewer } } : loginError()),
    listItems: ({ query }) => ({
      data: page(
        items
          .filter(
            (i) =>
              (query.scope === "archive"
                ? i.status === "GIVEN"
                : i.status !== "GIVEN") &&
              (!query.tradeMode || i.tradeMode === query.tradeMode) &&
              (!query.q ||
                `${i.title} ${i.description}`
                  .toLowerCase()
                  .includes(query.q.toLowerCase())),
          )
          .sort(sort)
          .map(dto),
        query,
      ),
    }),
    getItem: ({ path }) => {
      const i = item(path.id);
      return i ? { data: { data: dto(i) } } : fail("NOT_FOUND", "物品不存在");
    },
    createItem: ({ body }) => {
      if (!viewer) return loginError();
      const i: Item = {
        ...body,
        id: crypto.randomUUID(),
        owner: viewer,
        status: "AVAILABLE",
        createdAt: now(),
        givenAt: null,
        interestCount: 0,
        viewerHasInterest: false,
        freshnessLabel: "刚上架",
        serverNow: now(),
      };
      items.unshift(i);
      interests.set(i.id, new Map());
      return { data: { data: dto(i) } };
    },
    myItems: ({ query }) =>
      viewer
        ? {
            data: page(
              items
                .filter((i) => i.owner.id === viewer!.id)
                .sort(sort)
                .map(dto),
              query,
            ),
          }
        : loginError(),
    myInterests: ({ query }) =>
      viewer
        ? {
            data: page(
              items
                .flatMap((i) => {
                  const interest = interests.get(i.id)?.get(viewer!.id);
                  return interest ? [{ ...interest, item: dto(i) }] : [];
                })
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
              query,
            ),
          }
        : loginError(),
    wantItem: ({ path }) => {
      if (!viewer) return loginError();
      const i = item(path.id);
      if (!i) return fail("NOT_FOUND", "物品不存在");
      if (i.owner.id === viewer.id)
        return fail("FORBIDDEN", "不能想要自己的物品");
      if (i.status !== "AVAILABLE") return fail("CONFLICT", "物品当前不可领取");
      const set = interests.get(i.id)!;
      if (!set.has(viewer.id))
        set.set(viewer.id, { id: crypto.randomUUID(), createdAt: now() });
      return { data: { data: { active: true, count: set.size } } };
    },
    withdrawInterest: ({ path }) => {
      if (!viewer) return loginError();
      const i = item(path.id);
      if (!i) return fail("NOT_FOUND", "物品不存在");
      if (i.status !== "AVAILABLE")
        return fail("CONFLICT", "预约后不能撤回意向");
      interests.get(i.id)?.delete(viewer.id);
      return {
        data: {
          data: { active: false, count: interests.get(i.id)?.size ?? 0 },
        },
      };
    },
    itemInterests: ({ path, query }) => {
      if (!viewer) return loginError();
      const i = item(path.id);
      if (!i) return fail("NOT_FOUND", "物品不存在");
      if (i.owner.id !== viewer.id)
        return fail("FORBIDDEN", "仅发布者可查看意向名单");
      return {
        data: page(
          users
            .filter((u) => interests.get(i.id)?.has(u.id))
            .map((u) => ({
              ...u,
              createdAt: interests.get(i.id)!.get(u.id)!.createdAt,
            })),
          query,
        ),
      };
    },
    listComments: ({ path, query }) =>
      item(path.id)
        ? {
            data: page(
              comments.filter((c) => c.itemId === path.id),
              query,
            ),
          }
        : fail("NOT_FOUND", "物品不存在"),
    createComment: ({ path, body }) => {
      if (!viewer) return loginError();
      const i = item(path.id);
      if (!i) return fail("NOT_FOUND", "物品不存在");
      if (i.status === "GIVEN") return fail("CONFLICT", "已归档物品只读");
      const c = {
        id: crypto.randomUUID(),
        itemId: i.id,
        author: viewer,
        body: body.body,
        createdAt: now(),
      };
      comments.push(c);
      return { data: { data: c } };
    },
    createTrade: ({ path, body }) => {
      if (!viewer) return loginError();
      const i = item(path.id);
      if (!i) return fail("NOT_FOUND", "物品不存在");
      if (i.owner.id !== viewer.id)
        return fail("FORBIDDEN", "仅发布者可以预约");
      if (i.status !== "AVAILABLE") return fail("CONFLICT", "物品已预约");
      if (!interests.get(i.id)?.has(body.recipientId))
        return fail("CONFLICT", "领取者需要先表达想要");
      try {
        validateTradeWindow(body, new Date());
      } catch {
        return fail("BAD_REQUEST", "请选择未来七天内的有效时间段");
      }
      const t: Trade = {
        meetingStart: body.meetingStart,
        meetingEnd: body.meetingEnd,
        meetingPlace: body.meetingPlace,
        id: crypto.randomUUID(),
        itemId: i.id,
        owner: viewer,
        recipient: users.find((u) => u.id === body.recipientId)!,
        status: "PENDING",
        createdAt: now(),
        confirmedAt: null,
        completedAt: null,
        cancelledAt: null,
        cancelledBy: null,
      };
      trades.unshift(t);
      i.status = "RESERVED";
      return { data: { data: t } };
    },
    myTrades: ({ query }) =>
      viewer
        ? {
            data: page(
              trades
                .filter(
                  (t) =>
                    [t.owner.id, t.recipient.id].includes(viewer!.id) &&
                    (!query.status || t.status === query.status),
                )
                .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
              query,
            ),
          }
        : loginError(),
    getTrade: ({ path }) => {
      if (!viewer) return loginError();
      const t = trades.find((t) => t.id === path.id);
      return !t
        ? fail("NOT_FOUND", "预约不存在")
        : ![t.owner.id, t.recipient.id].includes(viewer.id)
          ? fail("FORBIDDEN", "仅交易双方可查看")
          : { data: { data: t } };
    },
    confirmTrade: ({ path }) => changeTrade(path.id, "confirm"),
    cancelTrade: ({ path }) => changeTrade(path.id, "cancel"),
    completeTrade: ({ path }) => changeTrade(path.id, "complete"),
    dashboard: () => {
      const month = new Date(Date.now() + 8 * 3600000)
        .toISOString()
        .slice(0, 7);
      const inMonth = (date: string) =>
        new Date(Date.parse(date) + 8 * 3600000)
          .toISOString()
          .startsWith(month);
      const completed = items
        .filter((i) => i.givenAt)
        .sort(
          (a, b) =>
            Date.parse(a.givenAt!) -
              Date.parse(a.createdAt) -
              (Date.parse(b.givenAt!) - Date.parse(b.createdAt)) ||
            a.givenAt!.localeCompare(b.givenAt!) ||
            a.id.localeCompare(b.id),
        );
      const wanted = items
        .filter((i) => i.status !== "GIVEN")
        .map(dto)
        .filter((i) => i.interestCount > 0)
        .sort((a, b) => b.interestCount - a.interestCount || sort(a, b));
      const fast = completed[0],
        most = wanted[0];
      return {
        data: {
          data: {
            month,
            timezone: "Asia/Shanghai",
            publishedThisMonth: items.filter((i) => inMonth(i.createdAt))
              .length,
            completedThisMonth: completed.filter((i) => inMonth(i.givenAt!))
              .length,
            activeCount: items.filter((i) => i.status !== "GIVEN").length,
            fastestItem: fast
              ? {
                  itemId: fast.id,
                  title: fast.title,
                  durationSeconds: Math.floor(
                    (Date.parse(fast.givenAt!) - Date.parse(fast.createdAt)) /
                      1000,
                  ),
                }
              : null,
            mostWantedItem: most
              ? {
                  itemId: most.id,
                  title: most.title,
                  interestCount: most.interestCount,
                }
              : null,
            asOf: now(),
          },
        },
      };
    },
    assistListing: ({ body }) =>
      viewer
        ? {
            data: {
              data: {
                ...body,
                suggestedTradeMode: "FLEXIBLE",
                suggestedPriceRangeCents: null,
                rationale: "Mock 示例：保留输入原文，不生成或补造物品事实。",
                missingInfo: ["请补充品牌、成色及领取条件"],
                disclaimer: AI_DISCLAIMER,
              },
            },
          }
        : loginError(),
  };
  return createMockFetch({ enabled: true, handlers });
}
