// Explicit opt-in: exactly two real requests; no secrets or provider text in output.
// Supply only the absolute path to the one shared, gitignored server .env.
import { readFile } from "node:fs/promises";
import { parseEnv } from "node:util";
import { isAbsolute } from "node:path";
import { buildApp } from "../dist/app.js";
import { readConfig } from "../dist/plugins/config.js";
import { DEMO_USERS } from "../dist/db/seed.js";
import { openDatabase, migrate } from "../dist/db/index.js";
import { endpoints } from "@neighborhood/contracts";

async function main() {
  const path = process.argv[2];
  if (!path || !isAbsolute(path)) throw new Error("CONFIG_PATH_REQUIRED");
  const env = parseEnv(await readFile(path, "utf8"));
  if (!env.LLM_API_KEY?.trim()) {
    console.log(JSON.stringify({ realLlm: "blocked", reason: "LLM_API_KEY is empty; fill the shared local .env", requests: 0 }));
    process.exitCode = 2;
    return;
  }
  // Restrict this paid acceptance helper to the intended provider. Never send a
  // credential to an accidentally changed URL, or use the user's database.
  if (!["https://api.deepseek.com", "https://api.deepseek.com/", "https://api.deepseek.com/v1", "https://api.deepseek.com/v1/"].includes(env.LLM_BASE_URL) || env.LLM_MODEL !== "deepseek-flash")
    throw new Error("DEEPSEEK_CONFIG_REQUIRED");
  const config = readConfig({
    DEMO_MODE: "true", DATABASE_URL: ":memory:",
    LLM_BASE_URL: env.LLM_BASE_URL, LLM_MODEL: env.LLM_MODEL, LLM_API_KEY: env.LLM_API_KEY,
  });
  const db = openDatabase(":memory:");
  migrate(db);
  db.sqlite.prepare("INSERT INTO users VALUES (?,?,?,?)").run(DEMO_USERS[0].id, DEMO_USERS[0].nickname, DEMO_USERS[0].building, Date.now());
  const app = await buildApp({ database: db, config, logger: false });
  try {
    const base = await app.listen({ host: "127.0.0.1", port: 0 });
    const login = await fetch(`${base}/api/v1/auth/demo-login`, {
      method: "POST", headers: { "content-type": "application/json" },
      body: JSON.stringify({ userId: DEMO_USERS[0].id }),
    });
    if (!login.ok) throw new Error("LOCAL_LOGIN_FAILED");
    const cookie = login.headers.get("set-cookie")?.split(";")[0];
    if (!cookie) throw new Error("LOCAL_LOGIN_FAILED");
    for (const sample of [
      { title: "搬家转让电磁炉", description: "虚构验收物品：使用两年，功能正常，表面有划痕，希望标价转让，品牌和型号待补充。" },
      { title: "免费送木椅", description: "虚构验收物品：一把木椅，椅面有划痕，免费送，在小区公共活动室自取。" },
    ]) {
      const timestamp = new Date().toISOString();
      const start = performance.now();
      const r = await fetch(`${base}/api/v1/ai/listing-assistance`, {
        method: "POST", headers: { "content-type": "application/json", cookie }, body: JSON.stringify(sample),
      });
      const payload = await r.json();
      const result = endpoints.assistListing.output.safeParse(payload);
      const success = r.status === 200 && result.success;
      const errors = ["AI_NOT_CONFIGURED", "AI_UNAVAILABLE", "AI_INVALID_RESPONSE", "AI_TIMEOUT", "RATE_LIMITED"];
      console.log(JSON.stringify({
        realLlm: success ? "passed" : "failed", provider: "DeepSeek", model: config.llmModel, timestamp,
        inputSummary: sample.title, durationMs: Math.round(performance.now() - start), status: r.status,
        ...(success ? { outputSummary: { schemaValid: true, titleLength: result.data.data.title.length, descriptionLength: result.data.data.description.length, tradeMode: result.data.data.suggestedTradeMode, priceRangeCents: result.data.data.suggestedPriceRangeCents, missingInfoCount: result.data.data.missingInfo.length } } : { error: errors.includes(payload.error?.code) ? payload.error.code : "ACCEPTANCE_FAILED" }),
        persistedItems: db.sqlite.prepare("SELECT count(*) n FROM items").get().n,
      }));
      if (!success) { process.exitCode = 1; break; }
    }
  } finally {
    await app.close();
    db.sqlite.close();
  }
}
main().catch(() => {
  // Never print arbitrary errors, upstream content, config objects or headers.
  console.error("LLM acceptance could not complete; verify local configuration and build.");
  process.exitCode = 1;
});
