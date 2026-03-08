import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

config({ path: ".env.local" });
config();

const connectionString =
  process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_ADMIN or DATABASE_URL is not set");
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/server/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: connectionString,
  },
});
