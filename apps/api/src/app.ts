import Fastify, { type FastifyServerOptions } from "fastify";
import cookie from "@fastify/cookie";
import fastifyStatic from "@fastify/static";
import { fileURLToPath } from "node:url";
import { join } from "node:path";
import { access } from "node:fs/promises";
import { openDatabase, migrate, type Db } from "./db/index.js";
import { readConfig, type Config } from "./plugins/config.js";
import { createContext, fail } from "./context.js";
import { ApiError, installErrorHandlers } from "./plugins/errors.js";
import { authRoutes } from "./auth/index.js";
import { itemsRoutes } from "./modules/items/index.js";
import { commentsRoutes } from "./modules/comments/index.js";
import { interestsRoutes } from "./modules/interests/index.js";
import { tradesRoutes } from "./modules/trades/index.js";
import { dashboardRoutes } from "./modules/dashboard/index.js";
import { aiRoutes } from "./modules/ai/index.js";
import { timingSafeEqual, createHash } from "node:crypto";

export interface AppOptions {
  logger?: FastifyServerOptions["logger"];
  serveWeb?: boolean;
  webRoot?: string;
  database?: Db;
  config?: Config;
  now?: () => number;
  fetcher?: typeof fetch;
}

/** Opens/migrates the configured database; never seeds or resets it on startup. */
export async function buildApp(options: AppOptions = {}) {
  const app = Fastify({
    logger: options.logger ?? false,
    bodyLimit: 32 * 1024,
  });
  const config = options.config ?? readConfig();
  // Optional deployment gate; the health probe reveals no community data.
  if (config.demoAccessPassword) {
    const digest = (value: string) => createHash("sha256").update(value).digest();
    const expected = digest(`Basic ${Buffer.from(`${config.demoAccessUser}:${config.demoAccessPassword}`).toString("base64")}`);
    app.addHook("onRequest", async (request, reply) => {
      if (["GET", "HEAD"].includes(request.method) && request.url === "/api/v1/health") return;
      if (!timingSafeEqual(digest(request.headers.authorization ?? ""), expected)) {
        reply.header("www-authenticate", 'Basic realm="Neighborhood demo", charset="UTF-8"');
        reply.header("cache-control", "no-store");
        return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请输入演示站访问凭据" } });
      }
    });
  }
  const db = options.database ?? openDatabase(config.databaseUrl);
  try {
    migrate(db);
  } catch (error) {
    if (!options.database) db.sqlite.close();
    throw error;
  }
  app.addHook("onClose", async () => {
    if (!options.database) db.sqlite.close();
  });
  const c = createContext(db, config, options.now ?? Date.now, options.fetcher);
  installErrorHandlers(app);
  await app.register(cookie);
  app.addHook("onRequest", async (request) => {
    if (
      !["GET", "HEAD", "OPTIONS"].includes(request.method) &&
      request.headers.origin !== undefined &&
      request.headers.origin !== config.appOrigin
    )
      fail(403, "请求来源不被允许");
  });
  await app.register(
    async (api) => {
      c.route(api, "health", () => {
        try {
          db.sqlite.prepare("SELECT count(*) FROM users").get();
        } catch {
          throw new ApiError(503, "SERVICE_UNAVAILABLE", "数据库暂时不可用");
        }
        return { data: { status: "ok", database: "ok" } };
      });
      api.get("/status", async () => ({ data: { status: "ok" } }));
      authRoutes(api, c);
      itemsRoutes(api, c);
      commentsRoutes(api, c);
      interestsRoutes(api, c);
      tradesRoutes(api, c);
      dashboardRoutes(api, c);
      aiRoutes(api, c);
    },
    { prefix: "/api/v1" },
  );

  if (options.serveWeb) {
    const root =
      options.webRoot ??
      fileURLToPath(new URL("../../web/dist/", import.meta.url));
    let hasWeb = true;
    try {
      await access(join(root, "index.html"));
    } catch {
      hasWeb = false;
    }
    if (!hasWeb) {
      app.log.warn(
        "Frontend build not found; running API only. Build apps/web to enable pages.",
      );
      app.setNotFoundHandler(() => {
        throw new ApiError(404, "NOT_FOUND", "页面尚未构建，API 可独立使用");
      });
      return app;
    }
    await app.register(fastifyStatic, { root, wildcard: false });
    app.setNotFoundHandler((request, reply) => {
      const pathname = new URL(request.url, "http://localhost").pathname;
      const isApi = pathname === "/api" || pathname.startsWith("/api/");
      const isPage = !pathname.split("/").at(-1)?.includes(".");
      if (
        !isApi &&
        isPage &&
        (request.method === "GET" || request.method === "HEAD") &&
        request.headers.accept?.includes("text/html")
      ) {
        return reply
          .type("text/html")
          .sendFile("index.html", { maxAge: 0, cacheControl: false });
      }
      throw new ApiError(404, "NOT_FOUND", "请求的内容不存在");
    });
  } else {
    app.setNotFoundHandler(() => {
      throw new ApiError(404, "NOT_FOUND", "请求的内容不存在");
    });
  }
  return app;
}
