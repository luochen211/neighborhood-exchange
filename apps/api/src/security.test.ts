import { describe, it, expect } from "vitest";
import { fixture, itemBody, NOW } from "./test-support.js";
import { readConfig } from "./plugins/config.js";
import { buildApp } from "./app.js";
import { DEMO_USERS } from "./db/seed.js";
import { openDatabase } from "./db/index.js";

describe("sessions, Origin and operational failures", () => {
  it("hashes tokens, clears and revokes sessions on switch/logout, enforces expiry", async () => {
    const f = await fixture(),
      token = await f.login();
    expect(
      JSON.stringify(f.db.sqlite.prepare("SELECT * FROM sessions").all()),
    ).not.toContain(token);
    const switched = await f.app.inject({
      method: "POST",
      url: "/api/v1/auth/demo-login",
      cookies: { neighborhood_session: token },
      payload: { userId: DEMO_USERS[1].id },
    });
    const set = switched.headers["set-cookie"] as string;
    expect(set).toContain("HttpOnly");
    expect(set).toContain("SameSite=Lax");
    expect(set).toContain("Path=/");
    expect(set).toContain("Max-Age=86400");
    expect((await f.call("me", {}, token)).statusCode).toBe(401);
    const next = switched.cookies[0]!.value;
    expect((await f.call("me", {}, next)).json().data.id).toBe(
      DEMO_USERS[1].id,
    );
    const logout = await f.call("logout", {}, next);
    expect(logout.statusCode).toBe(200);
    expect(logout.headers["set-cookie"]).toContain("Max-Age=0");
    expect((await f.call("me", {}, next)).statusCode).toBe(401);
    expect((await f.call("logout")).statusCode).toBe(200);
    const expiring = await f.login();
    f.setNow(NOW + 86400000);
    expect((await f.call("me", {}, expiring)).statusCode).toBe(401);
    expect((await f.call("createItem", { body: itemBody })).statusCode).toBe(
      401,
    );
  });
  it("DEMO_MODE off invalidates old sessions and HTTPS uses Secure cookie", async () => {
    const f = await fixture(),
      token = await f.login();
    const disabled = await buildApp({
      database: f.db,
      config: { ...f.config, demoMode: false },
    });
    try {
      for (const url of ["/demo/users", "/auth/me"])
        expect(
          (
            await disabled.inject({
              url: "/api/v1" + url,
              cookies: { neighborhood_session: token },
            })
          ).statusCode,
        ).toBe(url === "/demo/users" ? 403 : 401);
      expect(
        (
          await disabled.inject({
            method: "POST",
            url: "/api/v1/auth/demo-login",
            payload: { userId: DEMO_USERS[0].id },
          })
        ).statusCode,
      ).toBe(403);
    } finally {
      await disabled.close();
    }
    const secure = await fixture({
      config: readConfig({
        DEMO_MODE: "true",
        DATABASE_URL: ":memory:",
        APP_ORIGIN: "https://example.test",
      }),
    });
    expect(
      (
        await secure.app.inject({
          method: "POST",
          url: "/api/v1/auth/demo-login",
          payload: { userId: DEMO_USERS[0].id },
        })
      ).headers["set-cookie"],
    ).toContain("Secure");
  });
  it("checks Origin on login/logout/writes and rejects extra query/body fields", async () => {
    const f = await fixture(),
      cookie = await f.login();
    for (const origin of [
      "https://evil.test",
      "null",
      "http://127.0.0.1:3000.evil.test",
    ])
      expect(
        (
          await f.app.inject({
            method: "POST",
            url: "/api/v1/auth/logout",
            headers: { origin },
            cookies: { neighborhood_session: cookie },
          })
        ).statusCode,
      ).toBe(403);
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/v1/auth/logout",
          headers: { origin: f.config.appOrigin },
          cookies: { neighborhood_session: cookie },
        })
      ).statusCode,
    ).toBe(200);
    expect((await f.app.inject("/api/v1/items?admin=true")).statusCode).toBe(
      400,
    );
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/v1/auth/demo-login",
          payload: { userId: DEMO_USERS[0].id, role: "admin" },
        })
      ).statusCode,
    ).toBe(400);
  });
  it("bounds writes, body size and database lock failures", async () => {
    const f = await fixture(),
      a = await f.login();
    for (let i = 0; i < 60; i++)
      expect(
        (await f.call("createItem", { body: itemBody }, a)).statusCode,
      ).toBe(201);
    expect((await f.call("createItem", { body: itemBody }, a)).statusCode).toBe(
      429,
    );
    f.setNow(NOW + 60000);
    expect((await f.call("createItem", { body: itemBody }, a)).statusCode).toBe(
      201,
    );
    expect(
      (
        await f.app.inject({
          method: "POST",
          url: "/api/v1/items",
          cookies: { neighborhood_session: a },
          payload: { ...itemBody, description: "x".repeat(33000) },
        })
      ).statusCode,
    ).toBe(413);
    const lock = openDatabase(f.filename);
    lock.sqlite.exec("BEGIN IMMEDIATE");
    f.db.sqlite.pragma("busy_timeout=1");
    try {
      const r = await f.call("createItem", { body: itemBody }, a);
      expect(r.statusCode).toBe(503);
      expect(r.json().error.code).toBe("DATABASE_BUSY");
      expect(r.body).not.toMatch(/SQLITE|INSERT/);
    } finally {
      lock.sqlite.exec("ROLLBACK");
      lock.sqlite.close();
    }
    f.db.sqlite.close();
    const health = await f.call("health");
    expect(health.statusCode).toBe(503);
    expect(health.json().error.code).toBe("SERVICE_UNAVAILABLE");
  });
  it("missing frontend build supports independent API startup", async () => {
    const f = await fixture({
      serveWeb: true,
      webRoot: "/does-not-exist/neighborhood-test",
    });
    expect((await f.call("health")).statusCode).toBe(200);
    expect((await f.app.inject("/")).statusCode).toBe(404);
  });
});
