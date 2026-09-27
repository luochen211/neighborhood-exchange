import {
  createClient,
  ApiClientError,
  ApiProtocolError,
  type ApiClient,
  type CreateItem,
  type CreateTrade,
  type ItemQuery,
  type Pagination,
  type TradeQuery,
} from "@neighborhood/contracts";
export { ApiClientError };
export function errorMessage(error: unknown): string {
  if (error instanceof ApiClientError)
    return `${error.message}（请求 ${error.error.requestId}）`;
  if (error instanceof ApiProtocolError)
    return "服务响应格式异常，请重试或联系维护者。";
  if (error instanceof Error && error.name === "TimeoutError")
    return "请求超时，请刷新核实操作结果后再试。";
  if (error instanceof Error && error.name === "AbortError")
    return "操作已取消，输入已保留。";
  return "暂时无法连接服务，请检查网络后重试。";
}
export function createApi(client: ApiClient) {
  const empty = { path: {}, query: {}, body: undefined };
  const options = (signal?: AbortSignal) => ({
    signal: signal
      ? AbortSignal.any([signal, AbortSignal.timeout(18000)])
      : AbortSignal.timeout(18000),
  });
  return {
    users: (signal?: AbortSignal) =>
      client.call("demoUsers", empty, options(signal)),
    me: (signal?: AbortSignal) => client.call("me", empty, options(signal)),
    login: (userId: string) =>
      client.call("demoLogin", { ...empty, body: { userId } }, options()),
    logout: () => client.call("logout", empty, options()),
    items: (query: ItemQuery, signal?: AbortSignal) =>
      client.call("listItems", { ...empty, query }, options(signal)),
    item: (id: string, signal?: AbortSignal) =>
      client.call("getItem", { ...empty, path: { id } }, options(signal)),
    publish: (body: CreateItem) =>
      client.call("createItem", { ...empty, body }, options()),
    myItems: (query: Pagination = {}, signal?: AbortSignal) =>
      client.call("myItems", { ...empty, query }, options(signal)),
    myInterests: (query: Pagination = {}, signal?: AbortSignal) =>
      client.call("myInterests", { ...empty, query }, options(signal)),
    want: (id: string) =>
      client.call("wantItem", { ...empty, path: { id } }, options()),
    withdraw: (id: string) =>
      client.call("withdrawInterest", { ...empty, path: { id } }, options()),
    interests: (id: string, query: Pagination = {}, signal?: AbortSignal) =>
      client.call(
        "itemInterests",
        { ...empty, path: { id }, query },
        options(signal),
      ),
    comments: (id: string, query: Pagination = {}, signal?: AbortSignal) =>
      client.call(
        "listComments",
        { ...empty, path: { id }, query },
        options(signal),
      ),
    comment: (id: string, body: string) =>
      client.call(
        "createComment",
        { ...empty, path: { id }, body: { body } },
        options(),
      ),
    reserve: (id: string, body: CreateTrade) =>
      client.call("createTrade", { ...empty, path: { id }, body }, options()),
    trades: (query: TradeQuery = {}, signal?: AbortSignal) =>
      client.call("myTrades", { ...empty, query }, options(signal)),
    tradesForItem: async (id: string, signal?: AbortSignal) => {
      let cursor: string | undefined;
      const seen = new Set<string>();
      do {
        const response = await client.call(
          "myTrades",
          { ...empty, query: { limit: 50, cursor } },
          options(signal),
        );
        const matches = response.data.filter(
          (trade) => trade.itemId === id && trade.status !== "CANCELLED",
        );
        if (matches.length || !response.page.nextCursor) return matches;
        cursor = response.page.nextCursor;
        if (seen.has(cursor)) throw new ApiProtocolError(200);
        seen.add(cursor);
      } while (cursor);
      return [];
    },
    confirm: (id: string) =>
      client.call("confirmTrade", { ...empty, path: { id } }, options()),
    cancel: (id: string) =>
      client.call("cancelTrade", { ...empty, path: { id } }, options()),
    complete: (id: string) =>
      client.call("completeTrade", { ...empty, path: { id } }, options()),
    dashboard: (signal?: AbortSignal) =>
      client.call("dashboard", empty, options(signal)),
    assist: (
      body: { title: string; description: string },
      signal?: AbortSignal,
    ) => client.call("assistListing", { ...empty, body }, options(signal)),
  };
}
export type Api = ReturnType<typeof createApi>;
export const mockMode =
  import.meta.env.DEV && import.meta.env.VITE_API_MODE === "mock";
export async function configuredApi(): Promise<Api> {
  const transport = mockMode
    ? (await import("./mock")).createStatefulMock()
    : undefined;
  return createApi(
    createClient({
      baseUrl: mockMode
        ? "/api/v1"
        : import.meta.env.VITE_API_BASE_URL || "/api/v1",
      fetch: transport,
    }),
  );
}
