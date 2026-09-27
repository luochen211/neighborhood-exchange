import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
export function readConfig(env: NodeJS.ProcessEnv = process.env) {
  const port = Number(env.PORT ?? 3000);
  if (!Number.isInteger(port) || port < 1 || port > 65535)
    throw new Error("PORT must be an integer from 1 to 65535");
  const host = env.HOST ?? "127.0.0.1";
  const appOrigin = env.APP_ORIGIN ?? `http://127.0.0.1:${port}`;
  const url = new URL(appOrigin);
  if (!["http:", "https:"].includes(url.protocol) || url.origin !== appOrigin)
    throw new Error(
      "APP_ORIGIN must be an HTTP origin without a trailing slash",
    );
  if (env.DEMO_MODE && !["true", "false"].includes(env.DEMO_MODE))
    throw new Error("DEMO_MODE must be true or false");
  const llmBaseUrl = env.LLM_BASE_URL ?? "";
  if (llmBaseUrl && !["https:", "http:"].includes(new URL(llmBaseUrl).protocol))
    throw new Error("LLM_BASE_URL must be HTTP(S)");
  return {
    host,
    port,
    appOrigin,
    demoMode: env.DEMO_MODE === "true",
    databaseUrl:
      env.DATABASE_URL === ":memory:"
        ? ":memory:"
        : resolve(
            fileURLToPath(new URL("../../../../", import.meta.url)),
            env.DATABASE_URL ?? "data/neighborhood.db",
          ),
    llmBaseUrl,
    llmApiKey: env.LLM_API_KEY ?? "",
    llmModel: env.LLM_MODEL ?? "",
  };
}
export type Config = ReturnType<typeof readConfig>;
