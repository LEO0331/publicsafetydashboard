import Database from "better-sqlite3";

const dbPath = process.env.SQLITE_PATH ?? "./drizzle/dev.db";

const globalForSqlite = globalThis as unknown as { sqlite?: Database.Database };

export const sqlite = globalForSqlite.sqlite ?? new Database(dbPath);
sqlite.pragma("foreign_keys = ON");

if (process.env.NODE_ENV !== "production") {
  globalForSqlite.sqlite = sqlite;
}
