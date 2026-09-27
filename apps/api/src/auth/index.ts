import type { FastifyInstance } from "fastify";
import { SESSION_COOKIE_NAME } from "@neighborhood/contracts";
import { randomBytes } from "node:crypto";
import { eq } from "drizzle-orm";
import { sessions, users } from "../db/schema.js";
import { fail, hash, type Context } from "../context.js";
export function authRoutes(app: FastifyInstance, c: Context) {
  const cookieOptions = {
    path: "/",
    httpOnly: true,
    sameSite: "lax" as const,
    secure: c.config.appOrigin.startsWith("https:"),
  };
  c.route(app, "demoUsers", () => ({
    data: c.orm
      .select()
      .from(users)
      .all()
      .map((u) => c.user(u.id)),
    page: { nextCursor: null },
  }));
  c.route(app, "demoLogin", ({ body }, _user, req, reply) =>
    c.tx(() => {
      const who = c.orm
        .select()
        .from(users)
        .where(eq(users.id, body.userId))
        .get();
      if (!who) fail(404);
      c.limiter.take(`login:${req.ip}`, 60, c.now());
      const old = req.cookies[SESSION_COOKIE_NAME];
      if (old)
        c.orm
          .delete(sessions)
          .where(eq(sessions.tokenHash, hash(old)))
          .run();
      const token = randomBytes(32).toString("base64url");
      const now = c.now();
      c.orm
        .insert(sessions)
        .values({
          id: c.id(),
          tokenHash: hash(token),
          userId: who.id,
          createdAt: now,
          expiresAt: now + 86400000,
        })
        .run();
      reply.setCookie(SESSION_COOKIE_NAME, token, {
        ...cookieOptions,
        maxAge: 86400,
      });
      return { data: c.user(who.id) };
    }),
  );
  c.route(app, "logout", (_input, _user, req, reply) => {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (token)
      c.orm
        .delete(sessions)
        .where(eq(sessions.tokenHash, hash(token)))
        .run();
    reply.clearCookie(SESSION_COOKIE_NAME, cookieOptions);
    return { data: { loggedOut: true } };
  });
  c.route(app, "me", (_input, user) => ({ data: user }));
}
