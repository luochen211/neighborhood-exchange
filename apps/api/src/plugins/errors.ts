import type { FastifyInstance } from "fastify";

/** Explicit public failures only. Never expose arbitrary Error.message to clients. */
export class ApiError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public fieldErrors?: Record<string, string[]>,
  ) {
    super(message);
  }
}

export function installErrorHandlers(app: FastifyInstance) {
  app.setErrorHandler((error, request, reply) => {
    let cause: unknown = error;
    for (
      let depth = 0;
      depth < 4 && cause && typeof cause === "object";
      depth++
    ) {
      if ("code" in cause && typeof cause.code === "string") {
        if (
          cause.code.startsWith("SQLITE_BUSY") ||
          cause.code.startsWith("SQLITE_LOCKED")
        ) {
          error = new ApiError(503, "DATABASE_BUSY", "数据库繁忙，请稍后重试");
          break;
        }
        if (cause.code.startsWith("SQLITE_CONSTRAINT")) {
          error = new ApiError(409, "CONFLICT", "状态已变化，请刷新");
          break;
        }
      }
      cause = "cause" in cause ? cause.cause : undefined;
    }
    const explicit = error instanceof ApiError ? error : undefined;
    const status =
      error &&
      typeof error === "object" &&
      "statusCode" in error &&
      typeof error.statusCode === "number"
        ? error.statusCode
        : 500;
    const statusCode =
      status === 415 ? 400 : status >= 400 && status <= 599 ? status : 500;
    const messages: Record<number, string> = {
      400: "请求参数无效",
      401: "请先选择演示身份",
      403: "没有操作权限",
      404: "请求的内容不存在",
      409: "状态已变化，请刷新",
      413: "请求内容过大",
      429: "操作过于频繁，请稍后重试",
      503: "服务暂时不可用",
    };
    const codes: Record<number, string> = {
      400: "BAD_REQUEST",
      401: "UNAUTHORIZED",
      403: "FORBIDDEN",
      404: "NOT_FOUND",
      409: "CONFLICT",
      413: "PAYLOAD_TOO_LARGE",
      429: "RATE_LIMITED",
      503: "SERVICE_UNAVAILABLE",
    };
    // Log metadata only; upstream messages may include prompts, SQL or credentials.
    if (statusCode >= 500)
      request.log.error(
        { statusCode, requestId: request.id },
        "Request failed",
      );
    return reply.code(statusCode).send({
      error: {
        code: explicit
          ? explicit.code
          : (codes[statusCode] ?? "INTERNAL_ERROR"),
        message: explicit
          ? explicit.message
          : (messages[statusCode] ?? "服务暂时无法处理请求"),
        ...(explicit?.fieldErrors ? { fieldErrors: explicit.fieldErrors } : {}),
        requestId: request.id,
      },
    });
  });
}
