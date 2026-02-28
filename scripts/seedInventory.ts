import { sql } from "drizzle-orm";

import { db } from "@/server/db";

async function run() {
  const seedUser = process.env.SEED_USER_ID;
  if (!seedUser) {
    throw new Error("SEED_USER_ID is required");
  }

  const householdResult = await db.execute(sql`
    insert into households (name, created_by)
    values ('Demo Household', ${seedUser}::uuid)
    returning id
  `);
  const householdId = String(householdResult.rows[0]?.id || "");

  await db.execute(sql`
    insert into household_members (household_id, user_id, role, status, invited_by)
    values (${householdId}::uuid, ${seedUser}::uuid, 'owner', 'active', ${seedUser}::uuid)
    on conflict do nothing
  `);

  const locationResult = await db.execute(sql`
    insert into locations (household_id, name, created_by)
    values (${householdId}::uuid, 'Apartment', ${seedUser}::uuid)
    returning id
  `);
  const locationId = String(locationResult.rows[0]?.id || "");

  const roomResult = await db.execute(sql`
    insert into rooms (household_id, location_id, name, created_by)
    values (${householdId}::uuid, ${locationId}::uuid, 'Storage Room', ${seedUser}::uuid)
    returning id
  `);
  const roomId = String(roomResult.rows[0]?.id || "");

  const containerResult = await db.execute(sql`
    insert into containers (household_id, room_id, name, code, created_by, qr_deep_link)
    values (${householdId}::uuid, ${roomId}::uuid, 'Box A', 'A-01', ${seedUser}::uuid, '')
    returning id
  `);
  const containerId = String(containerResult.rows[0]?.id || "");

  await db.execute(sql`
    update containers
    set qr_deep_link = ${`/app/boxes/${containerId}`}
    where id = ${containerId}::uuid
  `);

  const itemResult = await db.execute(sql`
    insert into items (household_id, name, created_by)
    values (${householdId}::uuid, 'Winter Jacket', ${seedUser}::uuid)
    returning id
  `);
  const itemId = String(itemResult.rows[0]?.id || "");

  await db.execute(sql`
    insert into container_items (household_id, container_id, item_id, quantity)
    values (${householdId}::uuid, ${containerId}::uuid, ${itemId}::uuid, 2)
    on conflict (container_id, item_id) do update set quantity = excluded.quantity
  `);

  console.log("Seed complete", { householdId });
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});