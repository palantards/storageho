import { and, eq, sql } from "drizzle-orm";
import { describe, expect, it } from "vitest";

import { dbAdmin } from "@/server/db/admin";
import { schema } from "@/server/db";
import { dbTenantRls, withRlsUserContext } from "@/server/db/tenant";

const hasDbConnection = Boolean(
  process.env.DATABASE_URL_RLS || process.env.DATABASE_URL,
);

const describeIfDb = hasDbConnection ? describe : describe.skip;

describeIfDb("tenant RLS isolation", () => {
  it("blocks cross-household reads and updates when running as authenticated user context", async () => {
    const roleCheck = await dbTenantRls.execute<{
      current_user: string;
      rolbypassrls: boolean;
    }>(sql`
      select current_user, r.rolbypassrls
      from pg_roles r
      where r.rolname = current_user
    `);
    expect(roleCheck.rows[0]?.rolbypassrls).toBe(false);

    const users = await dbAdmin.execute<{ id: string }>(sql`
      select id::text as id
      from auth.users
      order by created_at asc
      limit 1
    `);
    expect(users.rows.length).toBeGreaterThan(0);

    const userId = users.rows[0].id;
    const householdAName = `rls-test-a-${crypto.randomUUID()}`;
    const householdBName = `rls-test-b-${crypto.randomUUID()}`;

    const [householdA] = await dbAdmin
      .insert(schema.households)
      .values({ name: householdAName, createdBy: userId })
      .returning({ id: schema.households.id });

    const [householdB] = await dbAdmin
      .insert(schema.households)
      .values({ name: householdBName, createdBy: userId })
      .returning({ id: schema.households.id });

    try {
      await dbAdmin.insert(schema.householdMembers).values({
        householdId: householdA.id,
        userId,
        role: "owner",
        status: "active",
      });

      const [floor] = await dbAdmin
        .insert(schema.householdFloors)
        .values({
          householdId: householdB.id,
          locationId: crypto.randomUUID(),
          name: "RLS test floor",
          sortOrder: 0,
          createdBy: userId,
        })
        .returning({ id: schema.householdFloors.id });

      const [room] = await dbAdmin
        .insert(schema.rooms)
        .values({
          householdId: householdB.id,
          locationId: floor.id,
          name: "RLS test room",
          createdBy: userId,
        })
        .returning({ id: schema.rooms.id });

      const [itemB] = await dbAdmin
        .insert(schema.items)
        .values({
          householdId: householdB.id,
          name: "RLS cross-tenant item",
          createdBy: userId,
        })
        .returning({ id: schema.items.id, name: schema.items.name });

      const uidCheck = await withRlsUserContext(userId, async (tx) => {
        return tx.execute<{ uid: string | null }>(
          sql`select auth.uid()::text as uid`,
        );
      });
      expect(uidCheck.rows[0]?.uid).toBe(userId);

      const blockedRead = await withRlsUserContext(userId, async (tx) => {
        return tx
          .select({ id: schema.items.id })
          .from(schema.items)
          .where(
            and(
              eq(schema.items.householdId, householdB.id),
              eq(schema.items.id, itemB.id),
            ),
          );
      });
      expect(blockedRead).toHaveLength(0);

      const blockedUpdate = await withRlsUserContext(userId, async (tx) => {
        return tx
          .update(schema.items)
          .set({ name: "should-not-update" })
          .where(
            and(
              eq(schema.items.householdId, householdB.id),
              eq(schema.items.id, itemB.id),
            ),
          )
          .returning({ id: schema.items.id });
      });
      expect(blockedUpdate).toHaveLength(0);

      const verify = await dbAdmin
        .select({ name: schema.items.name })
        .from(schema.items)
        .where(eq(schema.items.id, itemB.id))
        .limit(1);
      expect(verify[0]?.name).toBe(itemB.name);

      void room;
    } finally {
      await dbAdmin
        .delete(schema.households)
        .where(eq(schema.households.id, householdA.id));
      await dbAdmin
        .delete(schema.households)
        .where(eq(schema.households.id, householdB.id));
    }
  });
});

