import "server-only";

import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL_ADMIN || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_ADMIN or DATABASE_URL is not set");
}

const globalForDbAdmin = globalThis as unknown as {
  dbAdmin?: NodePgDatabase<typeof schema>;
  poolAdmin?: Pool;
};

export const poolAdmin =
  globalForDbAdmin.poolAdmin ?? new Pool({ connectionString });
export const dbAdmin =
  globalForDbAdmin.dbAdmin ?? drizzle(poolAdmin, { schema });

if (process.env.NODE_ENV !== "production") {
  globalForDbAdmin.poolAdmin = poolAdmin;
  globalForDbAdmin.dbAdmin = dbAdmin;
}
