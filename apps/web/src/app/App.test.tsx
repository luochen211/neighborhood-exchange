// @vitest-environment jsdom
import { afterEach, expect, it, vi } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { createClient } from "@neighborhood/contracts";
import { App } from "./App";
import { createApi } from "../lib/api";
import { createStatefulMock } from "../lib/mock";
import { Field } from "../components/ui";
import { freshness } from "../components/items";
Object.defineProperty(HTMLDialogElement.prototype, "close", {
  value: function (this: HTMLDialogElement) {
    this.removeAttribute("open");
  },
  configurable: true,
});
Object.defineProperty(HTMLDialogElement.prototype, "showModal", {
  value: function (this: HTMLDialogElement) {
    this.setAttribute("open", "");
  },
  configurable: true,
});
afterEach(cleanup);
it("shows public data and route errors through the contract client", async () => {
  const api = createApi(createClient({ fetch: createStatefulMock() }));
  render(
    <MemoryRouter initialEntries={["/"]}>
      <App api={api} />
    </MemoryRouter>,
  );
  expect(
    await screen.findByRole("heading", { name: "闲置电磁炉" }),
  ).toBeDefined();
  fireEvent.change(screen.getByLabelText("搜索闲置"), {
    target: { value: "不存在" },
  });
  fireEvent.click(screen.getByRole("button", { name: "搜索" }));
  expect(
    await screen.findByRole("heading", { name: "暂时没有符合条件的物品" }),
  ).toBeDefined();
});
it("archived details render literal comments and no write controls", async () => {
  const api = createApi(createClient({ fetch: createStatefulMock() }));
  render(
    <MemoryRouter
      initialEntries={["/items/00000000-0000-4000-8000-000000000013"]}
    >
      <App api={api} />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "旧书" });
  await waitFor(() => expect(screen.queryByText("正在加载…")).toBeNull());
  expect(screen.queryByRole("button", { name: "我想要" })).toBeNull();
  expect(screen.queryByLabelText("留言内容")).toBeNull();
  expect(screen.getByText(/所有操作已关闭/)).toBeDefined();
});
it("associates input error descriptions", () => {
  render(<Field label="标题" error="请输入标题" />);
  const input = screen.getByLabelText("标题");
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(
    document.getElementById(input.getAttribute("aria-describedby")!)
      ?.textContent,
  ).toBe("请输入标题");
});
it("uses server-corrected freshness at exact 24 and 72 hour boundaries", () => {
  const created = "2026-09-20T00:00:00Z";
  expect(freshness(created, "2026-09-20T23:59:59Z")).toBe("刚上架");
  expect(freshness(created, "2026-09-21T00:00:00Z")).toBe("新上架");
  expect(freshness(created, "2026-09-22T23:59:59Z")).toBe("新上架");
  expect(freshness(created, "2026-09-23T00:00:00Z")).toBe("已上架 3 天");
});
it("preserves the manual draft through AI and publish failures, then clears it on identity switch", async () => {
  sessionStorage.clear();
  const api = createApi(createClient({ fetch: createStatefulMock() }));
  const users = await api.users();
  await api.login(users.data[0]!.id);
  const { ApiClientError } = await import("../lib/api");
  api.assist = vi.fn().mockRejectedValue(
    new ApiClientError(503, {
      code: "AI_NOT_CONFIGURED",
      message: "AI 尚未配置",
      requestId: "ai-test",
    }),
  );
  api.publish = vi.fn().mockRejectedValue(
    new ApiClientError(503, {
      code: "DATABASE_BUSY",
      message: "数据库繁忙",
      requestId: "publish-test",
    }),
  );
  render(
    <MemoryRouter initialEntries={["/publish"]}>
      <App api={api} />
    </MemoryRouter>,
  );
  const title = await screen.findByLabelText("物品名称");
  fireEvent.change(title, { target: { value: "保留我的台灯" } });
  fireEvent.change(screen.getByLabelText("物品描述"), {
    target: { value: "描述不能丢失" },
  });
  fireEvent.change(screen.getByLabelText("自提楼栋"), {
    target: { value: "1栋" },
  });
  fireEvent.click(screen.getByRole("button", { name: "生成建议" }));
  await screen.findByText(/AI 尚未配置/);
  fireEvent.click(screen.getByRole("button", { name: "确认发布" }));
  await screen.findByText(/数据库繁忙/);
  expect((title as HTMLInputElement).value).toBe("保留我的台灯");
  expect(sessionStorage.getItem("listing-draft")).toContain("描述不能丢失");
  expect(api.publish).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: /邻居小林/ }));
  fireEvent.click(await screen.findByRole("button", { name: /邻居小周/ }));
  await waitFor(() =>
    expect((screen.getByLabelText("物品名称") as HTMLInputElement).value).toBe(
      "",
    ),
  );
  expect(sessionStorage.getItem("listing-draft")).not.toContain("描述不能丢失");
});
it("retries a failed read without substituting mock success", async () => {
  const api = createApi(createClient({ fetch: createStatefulMock() }));
  const original = api.items;
  api.items = vi
    .fn()
    .mockRejectedValueOnce(new Error("offline"))
    .mockImplementation(original);
  render(
    <MemoryRouter>
      <App api={api} />
    </MemoryRouter>,
  );
  await screen.findByRole("heading", { name: "暂时无法加载" });
  expect(screen.queryByRole("heading", { name: "闲置电磁炉" })).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "重试" }));
  await screen.findByRole("heading", { name: "闲置电磁炉" });
  expect(api.items).toHaveBeenCalledTimes(2);
});
it("keeps an unsent comment while refreshing on window focus", async () => {
  const api = createApi(createClient({ fetch: createStatefulMock() }));
  const users = await api.users();
  await api.login(users.data[1]!.id);
  const original = api.item;
  api.item = vi.fn().mockImplementation(original);
  render(
    <MemoryRouter
      initialEntries={["/items/00000000-0000-4000-8000-000000000011"]}
    >
      <App api={api} />
    </MemoryRouter>,
  );
  const input = await screen.findByLabelText("留言内容");
  fireEvent.change(input, { target: { value: "还没发送的留言" } });
  const before = vi.mocked(api.item).mock.calls.length;
  fireEvent.focus(window);
  await waitFor(() =>
    expect(vi.mocked(api.item).mock.calls.length).toBeGreaterThan(before),
  );
  await waitFor(() =>
    expect(
      (screen.getByLabelText("留言内容") as HTMLTextAreaElement).value,
    ).toBe("还没发送的留言"),
  );
});
