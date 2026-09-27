import { afterEach, describe, expect, it } from "vitest";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { buildApp } from "./app.js";
import { ApiError } from "./plugins/errors.js";
import { readConfig } from "./plugins/config.js";

const cleanup: (() => Promise<unknown>)[] = [];
afterEach(async () => {
  for (const close of cleanup.splice(0).reverse()) await close();
});
async function makeApp(options = {}) {
  const app = await buildApp({
    config: readConfig({ DATABASE_URL: ":memory:" }),
    ...options,
  });
  cleanup.push(() => app.close());
  return app;
}

describe("foundation HTTP boundary", () => {
  it("reports process and database readiness", async () => {
    const app = await makeApp();
    expect((await app.inject("/api/v1/status")).json()).toEqual({
      data: { status: "ok" },
    });
    expect((await app.inject("/api/v1/health")).json()).toEqual({
      data: { status: "ok", database: "ok" },
    });
  });
  it("hides unexpected errors and preserves explicit public errors", async () => {
    const app = await makeApp();
    app.get("/crash", () => {
      throw new Error("secret-provider-key SQL stack");
    });
    app.get("/invalid", () => {
      throw new ApiError(400, "VALIDATION_ERROR", "请检查输入", {
        title: ["必填"],
      });
    });
    const crash = await app.inject("/crash");
    expect(crash.statusCode).toBe(500);
    expect(crash.json()).toEqual({
      error: {
        code: "INTERNAL_ERROR",
        message: expect.any(String),
        requestId: expect.any(String),
      },
    });
    expect(crash.body).not.toMatch(/secret|SQL|stack/);
    expect((await app.inject("/invalid")).json().error).toMatchObject({
      code: "VALIDATION_ERROR",
      fieldErrors: { title: ["必填"] },
    });
  });
  it("normalizes invalid JSON and rejects oversized bodies", async () => {
    const app = await makeApp();
    app.post("/echo", async (request) => request.body);
    for (const [payload, status] of [
      ["{", 400],
      [JSON.stringify({ body: "x".repeat(33 * 1024) }), 413],
    ] as const) {
      const res = await app.inject({
        method: "POST",
        url: "/echo",
        headers: { "content-type": "application/json" },
        payload,
      });
      expect(res.statusCode).toBe(status);
      expect(res.json().error.requestId).toEqual(expect.any(String));
    }
  });
  it("serves SPA deep links while keeping API, assets and writes out of fallback", async () => {
    const root = await mkdtemp(join(tmpdir(), "neighborhood-web-"));
    cleanup.push(() => rm(root, { recursive: true, force: true }));
    await writeFile(
      join(root, "index.html"),
      "<!doctype html><title>shell</title>",
    );
    const app = await makeApp({ serveWeb: true, webRoot: root });
    const page = await app.inject({
      url: "/items/any-id",
      headers: { accept: "text/html" },
    });
    expect(page.statusCode).toBe(200);
    expect(page.body).toContain("<title>shell</title>");
    for (const url of ["/api", "/api/v1/missing", "/assets/missing.js"]) {
      const res = await app.inject({ url, headers: { accept: "text/html" } });
      expect(res.statusCode).toBe(404);
      expect(res.json().error.code).toBe("NOT_FOUND");
    }
    expect(
      (
        await app.inject({
          method: "POST",
          url: "/publish",
          headers: { accept: "text/html" },
        })
      ).statusCode,
    ).toBe(404);
  });
  it("fails fast on malformed server configuration", () => {
    expect(readConfig({})).toMatchObject({ host: "127.0.0.1", port: 3000 });
    expect(() => readConfig({ PORT: "not-a-port" })).toThrow();
    expect(() =>
      readConfig({ APP_ORIGIN: "https://example.test/path" }),
    ).toThrow();
  });
});
