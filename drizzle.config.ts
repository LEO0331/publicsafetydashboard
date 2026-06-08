import { defineConfig } from "drizzle-kit";

const sqliteUrl = process.env.SQLITE_PATH ?? process.env.DATABASE_URL?.replace(/^file:/, "") ?? "./drizzle/dev.db";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle/migrations",
  dialect: "sqlite",
  dbCredentials: {
    url: sqliteUrl
  }
});
