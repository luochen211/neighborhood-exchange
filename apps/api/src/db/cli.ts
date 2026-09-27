import { openDatabase, migrate } from "./index.js";
import { seed } from "./seed.js";
import { readConfig } from "../plugins/config.js";
const command = process.argv[2];
if (!["migrate", "seed"].includes(command ?? ""))
  throw new Error("Expected migrate or seed");
const config = readConfig();
if (command === "seed" && !config.demoMode)
  throw new Error("Set DEMO_MODE=true to seed synthetic demonstration data");
const db = openDatabase(config.databaseUrl);
try {
  migrate(db);
  if (command === "seed") seed(db);
  console.log(`${command} completed`);
} finally {
  db.sqlite.close();
}
