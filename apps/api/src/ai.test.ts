import { describe, it, expect, vi } from "vitest";
import { fixture, NOW } from "./test-support.js";
import { readConfig } from "./plugins/config.js";
import { AI_DISCLAIMER } from "@neighborhood/contracts";
const config = readConfig({
  DEMO_MODE: "true",
  DATABASE_URL: ":memory:",
  LLM_BASE_URL: "https://provider.example/v1",
  LLM_MODEL: "test-stub",
  LLM_API_KEY: "synthetic-test-key",
});
const input = { title: "台灯", description: "整理出的台灯" };
const suggestion = {
  ...input,
  suggestedTradeMode: "FREE",
  suggestedPriceRangeCents: { min: 0, max: 0 },
  rationale: "仅整理用户提供的内容",
  missingInfo: ["功能是否正常"],
};
const response = (value: unknown) =>
  new Response(
    JSON.stringify({
      choices: [{ finish_reason: "stop", message: { content: JSON.stringify(value) } }],
    }),
    { status: 200 },
  );
describe("LLM adapter (explicit stub; not real provider acceptance)", () => {
  it("no configuration yields explicit 503 and manual item APIs remain available", async () => {
    const f = await fixture(),
      a = await f.login();
    const r = await f.call("assistListing", { body: input }, a);
    expect(r.statusCode).toBe(503);
    expect(r.json().error.code).toBe("AI_NOT_CONFIGURED");
    expect((await f.call("listItems")).statusCode).toBe(200);
  });
  it("sends one isolated request, checks structure and fixes disclaimer without persisting", async () => {
    const fetcher = vi
      .fn<typeof fetch>()
      .mockResolvedValue(response(suggestion));
    const f = await fixture({ config, fetcher }),
      a = await f.login();
    const r = await f.call("assistListing", { body: input }, a);
    expect(r.statusCode).toBe(200);
    expect(r.json().data.disclaimer).toBe(AI_DISCLAIMER);
    expect(fetcher).toHaveBeenCalledTimes(1);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe("https://provider.example/v1/chat/completions");
    const sent = JSON.parse(options!.body as string);
    expect(sent.messages[1].content).toBe(JSON.stringify(input));
    expect(sent.model).toBe("test-stub");
    expect(f.db.sqlite.prepare("SELECT count(*) n FROM items").get()).toEqual({
      n: 0,
    });
  });
  it.each([
    ["https://api.deepseek.com", true],
    ["https://api.deepseek.com/v1/", true],
    ["https://api.deepseek.com.example/v1", false],
    ["https://provider.example/v1", false],
  ])("keeps DeepSeek non-thinking options scoped to its official origin: %s", async (base, deepseek) => {
    const fetcher = vi.fn<typeof fetch>().mockResolvedValue(response(suggestion));
    const f = await fixture({ config: { ...config, llmBaseUrl: base as string, llmModel: "deepseek-flash" }, fetcher });
    const r = await f.call("assistListing", { body: input }, await f.login());
    expect(r.statusCode).toBe(200);
    const [url, options] = fetcher.mock.calls[0]!;
    expect(url).toBe(`${String(base).replace(/\/+$/, "")}/chat/completions`);
    expect(options?.redirect).toBe("error");
    const sent = JSON.parse(options!.body as string);
    expect(sent.response_format).toEqual({ type: "json_object" });
    expect(sent.stream).toBe(false);
    expect(sent.thinking).toEqual(deepseek ? { type: "disabled" } : undefined);
  });
  it.each(["length", "content_filter", "tool_calls"])("rejects incomplete completions even when content parses: %s", async (finish_reason) => {
    const upstream = new Response(JSON.stringify({ choices: [{ finish_reason, message: { content: JSON.stringify(suggestion) } }] }));
    const f = await fixture({ config, fetcher: async () => upstream });
    const r = await f.call("assistListing", { body: input }, await f.login());
    expect(r.statusCode).toBe(502);
    expect(r.json().error.code).toBe("AI_INVALID_RESPONSE");
  });
  it.each(["", null])("rejects empty DeepSeek content without exposing reasoning", async (content) => {
    const upstream = new Response(JSON.stringify({ choices: [{ finish_reason: "stop", message: { content, reasoning_content: "private reasoning" } }] }));
    const f = await fixture({ config, fetcher: async () => upstream });
    const r = await f.call("assistListing", { body: input }, await f.login());
    expect(r.statusCode).toBe(502);
    expect(r.body).not.toContain("private reasoning");
  });
  it.each([
    { ...suggestion, suggestedPriceRangeCents: { min: 1, max: 2 } },
    { ...suggestion, unknown: "x" },
    { ...suggestion, title: "" },
    [],
    null,
  ])("rejects invalid provider structure %j", async (value) => {
    const f = await fixture({ config, fetcher: async () => response(value) }),
      a = await f.login();
    const r = await f.call("assistListing", { body: input }, a);
    expect(r.statusCode).toBe(502);
    expect(r.json().error.code).toBe("AI_INVALID_RESPONSE");
  });
  it("hides upstream failures and malformed JSON, never retries", async () => {
    for (const upstream of [
      new Response("private-provider-body", { status: 429 }),
      new Response("not json", { status: 200 }),
    ]) {
      const fetcher = vi.fn<typeof fetch>().mockResolvedValue(upstream),
        f = await fixture({ config, fetcher }),
        a = await f.login();
      const r = await f.call("assistListing", { body: input }, a);
      expect(r.statusCode).toBe(upstream.status === 429 ? 503 : 502);
      expect(r.body).not.toContain("private-provider-body");
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it("times out at 15 seconds and aborts the upstream", async () => {
    let started!: () => void;
    const upstreamStarted = new Promise<void>((resolve) => {
      started = resolve;
    });
    const fetcher: typeof fetch = async (_url, opts) =>
      new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
        started();
      });
    const f = await fixture({ config, fetcher }),
      a = await f.login();
    await f.app.ready();
    vi.useFakeTimers({ toFake: ["setTimeout", "clearTimeout"] });
    try {
      const pending = Promise.resolve(
        f.call("assistListing", { body: input }, a),
      );
      await upstreamStarted;
      await vi.advanceTimersByTimeAsync(15001);
      const r = await pending;
      expect(r.statusCode).toBe(504);
      expect(r.json().error.code).toBe("AI_TIMEOUT");
    } finally {
      vi.useRealTimers();
    }
  });
  it("limits by both user and IP and resets after a minute", async () => {
    const f = await fixture({
        config,
        fetcher: async () => response(suggestion),
      }),
      a = await f.login(),
      b = await f.login(1),
      d = await f.login(2);
    for (let i = 0; i < 5; i++)
      expect(
        (await f.call("assistListing", { body: input }, a)).statusCode,
      ).toBe(200);
    expect((await f.call("assistListing", { body: input }, a)).statusCode).toBe(
      429,
    );
    for (let i = 0; i < 5; i++)
      expect(
        (await f.call("assistListing", { body: input }, b)).statusCode,
      ).toBe(200);
    expect((await f.call("assistListing", { body: input }, d)).statusCode).toBe(
      429,
    );
    f.setNow(NOW + 60000);
    expect((await f.call("assistListing", { body: input }, a)).statusCode).toBe(
      200,
    );
  });
});
