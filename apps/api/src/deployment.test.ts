import { describe, expect, it } from "vitest";
import { fixture } from "./test-support.js";
import { readConfig } from "./plugins/config.js";

describe("protected remote demo", () => {
  it("leaves health public while protecting pages and community APIs", async () => {
    const f = await fixture({ config: readConfig({ DEMO_MODE: "true", DEMO_ACCESS_USER: "demo", DEMO_ACCESS_PASSWORD: "test-password" }) });
    expect((await f.app.inject({ url: "/api/v1/health" })).statusCode).toBe(200);
    for (const url of ["/", "/publish", "/api/v1/items", "/api/v1/auth/demo-users"]) {
      const response = await f.app.inject({ url });
      expect(response.statusCode).toBe(401);
      expect(response.headers["www-authenticate"]).toContain("Basic");
    }
    expect((await f.app.inject({ url: "/api/v1/items", headers: { authorization: "Basic wrong" } })).statusCode).toBe(401);
    expect((await f.app.inject({ url: "/api/v1/items", headers: { authorization: `Basic ${Buffer.from("demo:test-password").toString("base64")}` } })).statusCode).toBe(200);
  });
  it("rejects partial access protection configuration", () => {
    expect(() => readConfig({ DEMO_ACCESS_USER: "demo" })).toThrow();
    expect(() => readConfig({ DEMO_ACCESS_PASSWORD: "test" })).toThrow();
  });
});
