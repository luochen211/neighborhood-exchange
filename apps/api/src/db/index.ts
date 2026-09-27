import Database from "better-sqlite3";
import {
  drizzle,
  type BetterSQLite3Database,
} from "drizzle-orm/better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import * as schema from "./schema.js";
import { migration002 } from "./migrations/002.js";
import { migration001 } from "./migrations/001.js";
export interface Db {
  sqlite: Database.Database;
  orm: BetterSQLite3Database<typeof schema>;
}
export function openDatabase(filename: string): Db {
  if (filename !== ":memory:")
    mkdirSync(dirname(resolve(filename)), { recursive: true });
  const sqlite = new Database(filename);
  sqlite.pragma("foreign_keys = ON");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("busy_timeout = 1500");
  return { sqlite, orm: drizzle(sqlite, { schema }) };
}
export function migrate(db: Db) {
  db.sqlite.pragma("foreign_keys = OFF");
  try {
    db.sqlite.transaction(() => {
      const version = db.sqlite.pragma("user_version", { simple: true }) as number;
      if (version > 2) throw new Error("Database schema is newer than this application");
      if (version < 1) db.sqlite.exec(migration001);
      if (version < 2) db.sqlite.exec(migration002);
      if ((db.sqlite.pragma("foreign_key_check") as unknown[]).length) throw new Error("Database foreign key check failed");
      db.sqlite.pragma("user_version = 2");
    }).immediate();
  } finally { db.sqlite.pragma("foreign_keys = ON"); }
}
