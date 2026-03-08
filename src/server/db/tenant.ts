import "server-only";

import { AsyncLocalStorage } from "node:async_hooks";

import { sql } from "drizzle-orm";
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import * as schema from "./schema";

const connectionString =
  process.env.DATABASE_URL_RLS || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL_RLS or DATABASE_URL is not set");
}

const globalForDbTenant = globalThis as unknown as {
  dbTenantRls?: NodePgDatabase<typeof schema>;
  poolTenantRls?: Pool;
  tenantTxStorage?: AsyncLocalStorage<TenantTx>;
};

export const poolTenantRls =
  globalForDbTenant.poolTenantRls ?? new Pool({ connectionString });
export const dbTenantRls =
  globalForDbTenant.dbTenantRls ?? drizzle(poolTenantRls, { schema });

export type TenantTx = Parameters<
  Parameters<typeof dbTenantRls.transaction>[0]
>[0];

const tenantTxStorage =
  globalForDbTenant.tenantTxStorage ?? new AsyncLocalStorage<TenantTx>();

if (process.env.NODE_ENV !== "production") {
  globalForDbTenant.poolTenantRls = poolTenantRls;
  globalForDbTenant.dbTenantRls = dbTenantRls;
  globalForDbTenant.tenantTxStorage = tenantTxStorage;
}

const uuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function getRlsTenantTx() {
  return tenantTxStorage.getStore();
}

export async function withRlsUserContext<T>(
  userId: string,
  fn: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  if (!uuidRegex.test(userId)) {
    throw new Error("Invalid user id for tenant RLS context");
  }

  return dbTenantRls.transaction(async (tx) => {
    await tx.execute(
      sql`select set_config('request.jwt.claim.sub', ${userId}, true)`,
    );
    await tx.execute(
      sql`select set_config('request.jwt.claim.role', 'authenticated', true)`,
    );

    return tenantTxStorage.run(tx, async () => fn(tx));
  });
}
