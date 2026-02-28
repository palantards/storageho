import "server-only";

import { cookies } from "next/headers";
import { and, count, desc, eq, ilike, isNull, or, sql } from "drizzle-orm";

import { db, schema } from "@/server/db";
import type { HouseholdRole } from "@/lib/inventory/roles";
import {
  canManageHousehold,
  canManageMembers,
  canWriteInventory,
} from "@/lib/inventory/roles";

const ACTIVE_HOUSEHOLD_COOKIE = "active_household_id";

type Membership = typeof schema.householdMembers.$inferSelect;
type Queryable = {
  userId: string;
  householdId: string;
};

export type MembershipWithHousehold = {
  membership: Membership;
  household: typeof schema.households.$inferSelect;
};

function clean(v: string | null | undefined) {
  const value = v?.trim();
  return value ? value : null;
}

async function assertMembership(input: Queryable) {
  const membership = await db.query.householdMembers.findFirst({
    where: and(
      eq(schema.householdMembers.userId, input.userId),
      eq(schema.householdMembers.householdId, input.householdId),
      eq(schema.householdMembers.status, "active"),
    ),
  });

  if (!membership) {
    throw new Error("Forbidden");
  }

  return membership;
}

async function assertRole(
  input: Queryable,
  predicate: (role: HouseholdRole) => boolean,
) {
  const membership = await assertMembership(input);
  if (!predicate(membership.role)) {
    throw new Error("Forbidden");
  }
  return membership;
}

export async function listMembershipsForUser(userId: string) {
  return db
    .select({
      membership: schema.householdMembers,
      household: schema.households,
    })
    .from(schema.householdMembers)
    .innerJoin(
      schema.households,
      eq(schema.households.id, schema.householdMembers.householdId),
    )
    .where(
      and(
        eq(schema.householdMembers.userId, userId),
        eq(schema.householdMembers.status, "active"),
      ),
    )
    .orderBy(desc(schema.householdMembers.createdAt));
}

export async function getActiveMembershipContext(userId: string): Promise<{
  memberships: MembershipWithHousehold[];
  active: MembershipWithHousehold | null;
}> {
  const [store, memberships] = await Promise.all([
    cookies(),
    listMembershipsForUser(userId),
  ]);

  if (memberships.length === 0) {
    return { memberships, active: null };
  }

  const cookieId = store.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const active =
    memberships.find((m) => m.household.id === cookieId) || memberships[0];

  return { memberships, active };
}

export async function setActiveHousehold(userId: string, householdId: string) {
  await assertMembership({ userId, householdId });

  const store = await cookies();
  store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function createHousehold(input: { userId: string; name: string }) {
  const name = input.name.trim();
  if (!name) throw new Error("Name required");

  return db.transaction(async (tx) => {
    const [household] = await tx
      .insert(schema.households)
      .values({
        name,
        createdBy: input.userId,
      })
      .returning();

    await tx
      .insert(schema.householdMembers)
      .values({
        householdId: household.id,
        userId: input.userId,
        role: "owner",
        status: "active",
        invitedBy: input.userId,
      })
      .onConflictDoNothing();

    await tx.insert(schema.activityLog).values({
      householdId: household.id,
      actorUserId: input.userId,
      actionType: "created",
      entityType: "household",
      entityId: household.id,
      metadata: { name },
    });

    return household;
  });
}

export async function claimPendingInvitesForUser(input: {
  userId: string;
  email: string;
}) {
  const normalized = input.email.trim().toLowerCase();
  if (!normalized) return;

  await db
    .update(schema.householdMembers)
    .set({
      userId: input.userId,
      status: "active",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.householdMembers.status, "invited"),
        eq(schema.householdMembers.invitedEmail, normalized),
      ),
    );
}

export async function logActivity(input: {
  householdId: string;
  actorUserId?: string | null;
  actionType: (typeof schema.activityLog.$inferInsert)["actionType"];
  entityType: (typeof schema.activityLog.$inferInsert)["entityType"];
  entityId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  await db.insert(schema.activityLog).values({
    householdId: input.householdId,
    actorUserId: input.actorUserId ?? null,
    actionType: input.actionType,
    entityType: input.entityType,
    entityId: input.entityId ?? null,
    metadata: input.metadata ?? {},
  });
}
export async function listLocations(input: Queryable & { q?: string }) {
  await assertMembership(input);

  const q = clean(input.q);
  const where = and(
    eq(schema.locations.householdId, input.householdId),
    q
      ? or(
          ilike(schema.locations.name, `%${q}%`),
          ilike(schema.locations.description, `%${q}%`),
        )
      : undefined,
  );

  return db
    .select({
      location: schema.locations,
      roomCount: count(schema.rooms.id),
    })
    .from(schema.locations)
    .leftJoin(schema.rooms, eq(schema.rooms.locationId, schema.locations.id))
    .where(where)
    .groupBy(schema.locations.id)
    .orderBy(schema.locations.name);
}

export async function createLocation(
  input: Queryable & { name: string; description?: string },
) {
  await assertRole(input, canWriteInventory);

  const [location] = await db
    .insert(schema.locations)
    .values({
      householdId: input.householdId,
      name: input.name.trim(),
      description: clean(input.description),
      createdBy: input.userId,
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "created",
    entityType: "location",
    entityId: location.id,
    metadata: { name: location.name },
  });

  return location;
}

export async function getLocationById(input: Queryable & { locationId: string }) {
  await assertMembership(input);
  return db.query.locations.findFirst({
    where: and(
      eq(schema.locations.id, input.locationId),
      eq(schema.locations.householdId, input.householdId),
    ),
  });
}

export async function listRoomsForLocation(
  input: Queryable & { locationId: string },
) {
  await assertMembership(input);
  return db
    .select({
      room: schema.rooms,
      containerCount: count(schema.containers.id),
    })
    .from(schema.rooms)
    .leftJoin(schema.containers, eq(schema.containers.roomId, schema.rooms.id))
    .where(
      and(
        eq(schema.rooms.locationId, input.locationId),
        eq(schema.rooms.householdId, input.householdId),
      ),
    )
    .groupBy(schema.rooms.id)
    .orderBy(schema.rooms.name);
}

export async function createRoom(
  input: Queryable & { locationId: string; name: string; description?: string },
) {
  await assertRole(input, canWriteInventory);

  const [room] = await db
    .insert(schema.rooms)
    .values({
      householdId: input.householdId,
      locationId: input.locationId,
      name: input.name.trim(),
      description: clean(input.description),
      createdBy: input.userId,
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "created",
    entityType: "room",
    entityId: room.id,
    metadata: { name: room.name, locationId: room.locationId },
  });

  return room;
}

export async function getRoomById(input: Queryable & { roomId: string }) {
  await assertMembership(input);
  return db.query.rooms.findFirst({
    where: and(
      eq(schema.rooms.id, input.roomId),
      eq(schema.rooms.householdId, input.householdId),
    ),
  });
}

export async function listContainersForRoom(
  input: Queryable & { roomId: string; includeArchived?: boolean; tagId?: string },
) {
  await assertMembership(input);

  const where = and(
    eq(schema.containers.householdId, input.householdId),
    eq(schema.containers.roomId, input.roomId),
    input.includeArchived ? undefined : isNull(schema.containers.archivedAt),
    input.tagId ? eq(schema.containerTags.tagId, input.tagId) : undefined,
  );

  return db
    .select({
      container: schema.containers,
      itemCount: count(schema.containerItems.id),
      photoCount: count(schema.photos.id),
    })
    .from(schema.containers)
    .leftJoin(
      schema.containerTags,
      eq(schema.containerTags.containerId, schema.containers.id),
    )
    .leftJoin(
      schema.containerItems,
      eq(schema.containerItems.containerId, schema.containers.id),
    )
    .leftJoin(
      schema.photos,
      and(
        eq(schema.photos.entityType, "container"),
        eq(schema.photos.entityId, schema.containers.id),
      ),
    )
    .where(where)
    .groupBy(schema.containers.id)
    .orderBy(schema.containers.name);
}

export async function createContainer(
  input: Queryable & {
    roomId: string;
    parentContainerId?: string | null;
    name: string;
    code?: string;
    description?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const [container] = await db
    .insert(schema.containers)
    .values({
      householdId: input.householdId,
      roomId: input.roomId,
      parentContainerId: input.parentContainerId ?? null,
      name: input.name.trim(),
      code: clean(input.code),
      description: clean(input.description),
      createdBy: input.userId,
      qrDeepLink: "",
    })
    .returning();

  await db
    .update(schema.containers)
    .set({ qrDeepLink: `/app/boxes/${container.id}` })
    .where(eq(schema.containers.id, container.id));

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "created",
    entityType: "container",
    entityId: container.id,
    metadata: {
      name: container.name,
      roomId: container.roomId,
      parentContainerId: container.parentContainerId,
    },
  });

  return container;
}

export async function getContainerById(
  input: Queryable & { containerId: string },
) {
  await assertMembership(input);
  return db
    .select({
      container: schema.containers,
      room: schema.rooms,
      location: schema.locations,
    })
    .from(schema.containers)
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.containers.roomId))
    .innerJoin(
      schema.locations,
      eq(schema.locations.id, schema.rooms.locationId),
    )
    .where(
      and(
        eq(schema.containers.id, input.containerId),
        eq(schema.containers.householdId, input.householdId),
      ),
    )
    .limit(1)
    .then((rows) => rows[0] ?? null);
}

export async function listContainerItems(
  input: Queryable & { containerId: string },
) {
  await assertMembership(input);
  return db
    .select({
      containerItem: schema.containerItems,
      item: schema.items,
    })
    .from(schema.containerItems)
    .innerJoin(schema.items, eq(schema.items.id, schema.containerItems.itemId))
    .where(
      and(
        eq(schema.containerItems.containerId, input.containerId),
        eq(schema.containerItems.householdId, input.householdId),
      ),
    )
    .orderBy(schema.items.name);
}

export async function createItem(
  input: Queryable & {
    name: string;
    description?: string;
    barcode?: string;
    serialNumber?: string;
    aliases?: string[];
    tagIds?: string[];
  },
) {
  await assertRole(input, canWriteInventory);

  return db.transaction(async (tx) => {
    const [item] = await tx
      .insert(schema.items)
      .values({
        householdId: input.householdId,
        name: input.name.trim(),
        description: clean(input.description),
        barcode: clean(input.barcode),
        serialNumber: clean(input.serialNumber),
        createdBy: input.userId,
      })
      .returning();

    const aliases =
      input.aliases?.map((a) => a.trim()).filter(Boolean).slice(0, 30) ?? [];
    if (aliases.length) {
      await tx.insert(schema.itemAliases).values(
        aliases.map((aliasText) => ({
          householdId: input.householdId,
          itemId: item.id,
          aliasText,
        })),
      );
    }

    if (input.tagIds?.length) {
      await tx.insert(schema.itemTags).values(
        input.tagIds.map((tagId) => ({
          householdId: input.householdId,
          itemId: item.id,
          tagId,
        })),
      );
    }

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "created",
      entityType: "item",
      entityId: item.id,
      metadata: { name: item.name },
    });

    return item;
  });
}

export async function listItems(input: Queryable & { q?: string; tagId?: string }) {
  await assertMembership(input);

  const q = clean(input.q);
  const where = and(
    eq(schema.items.householdId, input.householdId),
    q
      ? or(
          ilike(schema.items.name, `%${q}%`),
          ilike(schema.items.description, `%${q}%`),
          ilike(schema.items.barcode, `%${q}%`),
          ilike(schema.items.serialNumber, `%${q}%`),
        )
      : undefined,
    input.tagId ? eq(schema.itemTags.tagId, input.tagId) : undefined,
  );

  return db
    .select({
      item: schema.items,
      quantityTotal: sql<number>`coalesce(sum(${schema.containerItems.quantity}), 0)`,
      placements: sql<number>`count(distinct ${schema.containerItems.containerId})`,
    })
    .from(schema.items)
    .leftJoin(
      schema.containerItems,
      eq(schema.containerItems.itemId, schema.items.id),
    )
    .leftJoin(schema.itemTags, eq(schema.itemTags.itemId, schema.items.id))
    .where(where)
    .groupBy(schema.items.id)
    .orderBy(schema.items.name);
}

export async function listItemPlacements(
  input: Queryable & { itemId: string },
) {
  await assertMembership(input);
  return db
    .select({
      containerItem: schema.containerItems,
      container: schema.containers,
      room: schema.rooms,
      location: schema.locations,
    })
    .from(schema.containerItems)
    .innerJoin(
      schema.containers,
      eq(schema.containers.id, schema.containerItems.containerId),
    )
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.containers.roomId))
    .innerJoin(
      schema.locations,
      eq(schema.locations.id, schema.rooms.locationId),
    )
    .where(
      and(
        eq(schema.containerItems.itemId, input.itemId),
        eq(schema.containerItems.householdId, input.householdId),
      ),
    )
    .orderBy(schema.locations.name, schema.rooms.name, schema.containers.name);
}

export async function listItemsForHousehold(input: Queryable) {
  await assertMembership(input);
  return db.query.items.findMany({
    where: eq(schema.items.householdId, input.householdId),
    orderBy: [schema.items.name],
    limit: 1000,
  });
}

export async function upsertContainerItem(
  input: Queryable & {
    containerId: string;
    itemId: string;
    quantity: number;
    note?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const [row] = await db
    .insert(schema.containerItems)
    .values({
      householdId: input.householdId,
      containerId: input.containerId,
      itemId: input.itemId,
      quantity: input.quantity,
      note: clean(input.note),
    })
    .onConflictDoUpdate({
      target: [schema.containerItems.containerId, schema.containerItems.itemId],
      set: {
        quantity: input.quantity,
        note: clean(input.note),
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "quantity_changed",
    entityType: "container_item",
    entityId: row.id,
    metadata: {
      itemId: input.itemId,
      containerId: input.containerId,
      quantity: input.quantity,
    },
  });

  return row;
}

export async function moveItemBetweenContainers(
  input: Queryable & {
    itemId: string;
    fromContainerId: string;
    toContainerId: string;
    quantity: number;
  },
) {
  await assertRole(input, canWriteInventory);

  if (input.fromContainerId === input.toContainerId) {
    throw new Error("Containers must be different");
  }

  return db.transaction(async (tx) => {
    const source = await tx.query.containerItems.findFirst({
      where: and(
        eq(schema.containerItems.householdId, input.householdId),
        eq(schema.containerItems.containerId, input.fromContainerId),
        eq(schema.containerItems.itemId, input.itemId),
      ),
    });

    if (!source) {
      throw new Error("Source item not found");
    }
    if (source.quantity < input.quantity) {
      throw new Error("Not enough quantity in source");
    }

    if (source.quantity === input.quantity) {
      await tx
        .delete(schema.containerItems)
        .where(eq(schema.containerItems.id, source.id));
    } else {
      await tx
        .update(schema.containerItems)
        .set({ quantity: source.quantity - input.quantity })
        .where(eq(schema.containerItems.id, source.id));
    }

    await tx
      .insert(schema.containerItems)
      .values({
        householdId: input.householdId,
        containerId: input.toContainerId,
        itemId: input.itemId,
        quantity: input.quantity,
      })
      .onConflictDoUpdate({
        target: [schema.containerItems.containerId, schema.containerItems.itemId],
        set: {
          quantity:
            sql`${schema.containerItems.quantity} + ${Math.max(1, input.quantity)}`,
          updatedAt: new Date(),
        },
      });

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "moved",
      entityType: "container_item",
      entityId: source.id,
      metadata: {
        itemId: input.itemId,
        fromContainerId: input.fromContainerId,
        toContainerId: input.toContainerId,
        quantity: input.quantity,
      },
    });
  });
}

export async function listTags(input: Queryable) {
  await assertMembership(input);
  return db.query.tags.findMany({
    where: eq(schema.tags.householdId, input.householdId),
    orderBy: [schema.tags.name],
  });
}

export async function createTag(
  input: Queryable & { name: string; color?: string },
) {
  await assertRole(input, canWriteInventory);

  const [tag] = await db
    .insert(schema.tags)
    .values({
      householdId: input.householdId,
      name: input.name.trim(),
      color: clean(input.color),
    })
    .onConflictDoUpdate({
      target: [schema.tags.householdId, schema.tags.name],
      set: { color: clean(input.color) },
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "created",
    entityType: "tag",
    entityId: tag.id,
    metadata: { name: tag.name },
  });

  return tag;
}

export async function setContainerTags(
  input: Queryable & { containerId: string; tagIds: string[] },
) {
  await assertRole(input, canWriteInventory);
  return db.transaction(async (tx) => {
    await tx
      .delete(schema.containerTags)
      .where(
        and(
          eq(schema.containerTags.householdId, input.householdId),
          eq(schema.containerTags.containerId, input.containerId),
        ),
      );

    if (input.tagIds.length) {
      await tx.insert(schema.containerTags).values(
        input.tagIds.map((tagId) => ({
          householdId: input.householdId,
          containerId: input.containerId,
          tagId,
        })),
      );
    }
  });
}

export async function listContainerTags(
  input: Queryable & { containerId: string },
) {
  await assertMembership(input);
  return db
    .select({ tag: schema.tags })
    .from(schema.containerTags)
    .innerJoin(schema.tags, eq(schema.tags.id, schema.containerTags.tagId))
    .where(
      and(
        eq(schema.containerTags.householdId, input.householdId),
        eq(schema.containerTags.containerId, input.containerId),
      ),
    )
    .orderBy(schema.tags.name);
}

export async function listContainerPhotos(
  input: Queryable & { containerId: string },
) {
  await assertMembership(input);
  return db.query.photos.findMany({
    where: and(
      eq(schema.photos.householdId, input.householdId),
      eq(schema.photos.entityType, "container"),
      eq(schema.photos.entityId, input.containerId),
    ),
    orderBy: [desc(schema.photos.createdAt)],
  });
}

export async function insertPhotoRecord(
  input: Queryable & {
    entityType: "container" | "item";
    entityId: string;
    originalPath: string;
    thumbPath: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const [photo] = await db
    .insert(schema.photos)
    .values({
      householdId: input.householdId,
      entityType: input.entityType,
      entityId: input.entityId,
      storagePathOriginal: input.originalPath,
      storagePathThumb: input.thumbPath,
      createdBy: input.userId,
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "photo_added",
    entityType: "photo",
    entityId: photo.id,
    metadata: {
      subjectEntityType: input.entityType,
      subjectEntityId: input.entityId,
    },
  });

  return photo;
}

export async function deletePhotoRecord(input: Queryable & { photoId: string }) {
  await assertRole(input, canWriteInventory);

  const [photo] = await db
    .delete(schema.photos)
    .where(
      and(
        eq(schema.photos.id, input.photoId),
        eq(schema.photos.householdId, input.householdId),
      ),
    )
    .returning();

  if (!photo) return null;

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "photo_removed",
    entityType: "photo",
    entityId: photo.id,
    metadata: {
      subjectEntityType: photo.entityType,
      subjectEntityId: photo.entityId,
    },
  });

  return photo;
}

export async function listActivity(
  input: Queryable & {
    entityType?: (typeof schema.activityLog.$inferSelect)["entityType"];
    entityId?: string;
    limit?: number;
  },
) {
  await assertMembership(input);
  const limit = Math.min(200, Math.max(1, input.limit ?? 30));

  return db
    .select({
      activity: schema.activityLog,
      profile: schema.profiles,
    })
    .from(schema.activityLog)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.userId, schema.activityLog.actorUserId),
    )
    .where(
      and(
        eq(schema.activityLog.householdId, input.householdId),
        input.entityType
          ? eq(schema.activityLog.entityType, input.entityType)
          : undefined,
        input.entityId ? eq(schema.activityLog.entityId, input.entityId) : undefined,
      ),
    )
    .orderBy(desc(schema.activityLog.createdAt))
    .limit(limit);
}

export type GlobalSearchResult = {
  entityType: "item" | "container" | "room" | "location";
  entityId: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

export async function globalSearch(
  input: Queryable & { query: string; limit?: number },
): Promise<GlobalSearchResult[]> {
  await assertMembership(input);

  const term = input.query.trim().toLowerCase();
  if (!term) return [];
  const likeTerm = `%${term}%`;
  const limit = Math.min(100, Math.max(1, input.limit ?? 30));

  const rows = await db.execute(sql<{
    entity_type: "item" | "container" | "room" | "location";
    entity_id: string;
    title: string;
    subtitle: string;
    href: string;
    score: number;
  }>`
    with location_hits as (
      select
        'location'::text as entity_type,
        l.id as entity_id,
        l.name as title,
        coalesce(l.description, '') as subtitle,
        ('/locations/' || l.id)::text as href,
        similarity(lower(l.name), ${term}) as score
      from ${schema.locations} l
      where l.household_id = ${input.householdId}
        and (
          lower(l.name) like ${likeTerm}
          or lower(coalesce(l.description, '')) like ${likeTerm}
        )
    ),
    room_hits as (
      select
        'room'::text as entity_type,
        r.id as entity_id,
        r.name as title,
        l.name as subtitle,
        ('/rooms/' || r.id)::text as href,
        greatest(
          similarity(lower(r.name), ${term}),
          similarity(lower(l.name), ${term})
        ) as score
      from ${schema.rooms} r
      inner join ${schema.locations} l on l.id = r.location_id
      where r.household_id = ${input.householdId}
        and (
          lower(r.name) like ${likeTerm}
          or lower(coalesce(r.description, '')) like ${likeTerm}
          or lower(l.name) like ${likeTerm}
        )
    ),
    container_hits as (
      select
        'container'::text as entity_type,
        c.id as entity_id,
        c.name as title,
        concat_ws(' -> ', l.name, r.name) as subtitle,
        ('/boxes/' || c.id)::text as href,
        greatest(
          similarity(lower(c.name), ${term}),
          similarity(lower(coalesce(c.code, '')), ${term}),
          coalesce(max(similarity(lower(coalesce(t.name, '')), ${term})), 0)
        ) as score
      from ${schema.containers} c
      inner join ${schema.rooms} r on r.id = c.room_id
      inner join ${schema.locations} l on l.id = r.location_id
      left join ${schema.containerTags} ct on ct.container_id = c.id
      left join ${schema.tags} t on t.id = ct.tag_id
      where c.household_id = ${input.householdId}
      group by c.id, l.name, r.name
      having (
        lower(c.name) like ${likeTerm}
        or lower(coalesce(c.code, '')) like ${likeTerm}
        or bool_or(lower(coalesce(t.name, '')) like ${likeTerm})
      )
    ),
    item_hits as (
      select
        'item'::text as entity_type,
        i.id as entity_id,
        i.name as title,
        concat_ws(' -> ', l.name, r.name, c.name) as subtitle,
        ('/items?item=' || i.id)::text as href,
        greatest(
          similarity(lower(i.name), ${term}),
          similarity(lower(coalesce(i.description, '')), ${term}),
          coalesce(max(similarity(lower(coalesce(a.alias_text, '')), ${term})), 0),
          coalesce(max(similarity(lower(coalesce(t.name, '')), ${term})), 0)
        ) as score
      from ${schema.items} i
      left join ${schema.containerItems} ci on ci.item_id = i.id
      left join ${schema.containers} c on c.id = ci.container_id
      left join ${schema.rooms} r on r.id = c.room_id
      left join ${schema.locations} l on l.id = r.location_id
      left join ${schema.itemAliases} a on a.item_id = i.id
      left join ${schema.itemTags} it on it.item_id = i.id
      left join ${schema.tags} t on t.id = it.tag_id
      where i.household_id = ${input.householdId}
      group by i.id, l.name, r.name, c.name
      having (
        lower(i.name) like ${likeTerm}
        or lower(coalesce(i.description, '')) like ${likeTerm}
        or bool_or(lower(coalesce(a.alias_text, '')) like ${likeTerm})
        or bool_or(lower(coalesce(t.name, '')) like ${likeTerm})
      )
    )
    select *
    from (
      select * from location_hits
      union all
      select * from room_hits
      union all
      select * from container_hits
      union all
      select * from item_hits
    ) s
    order by score desc, title asc
    limit ${limit};
  `);

  return rows.rows.map((r) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: r.title,
    subtitle: r.subtitle,
    href: r.href,
    score: Number(r.score),
  }));
}

export async function listHouseholdMembers(input: Queryable) {
  await assertMembership(input);
  return db
    .select({
      membership: schema.householdMembers,
      profile: schema.profiles,
    })
    .from(schema.householdMembers)
    .leftJoin(
      schema.profiles,
      eq(schema.profiles.userId, schema.householdMembers.userId),
    )
    .where(eq(schema.householdMembers.householdId, input.householdId))
    .orderBy(schema.householdMembers.createdAt);
}

export async function inviteMember(
  input: Queryable & { email: string; role: HouseholdRole },
) {
  await assertRole(input, canManageMembers);

  const [member] = await db
    .insert(schema.householdMembers)
    .values({
      householdId: input.householdId,
      invitedEmail: input.email.trim().toLowerCase(),
      role: input.role,
      status: "invited",
      invitedBy: input.userId,
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "invite_sent",
    entityType: "membership",
    entityId: member.id,
    metadata: { email: member.invitedEmail, role: member.role },
  });

  return member;
}

export async function updateMemberRole(
  input: Queryable & {
    memberId: string;
    role: HouseholdRole;
    status?: "invited" | "active" | "removed";
  },
) {
  const current = await assertRole(input, canManageHousehold);
  if (current.role !== "owner" && input.role === "owner") {
    throw new Error("Only owner can assign owner");
  }

  const [member] = await db
    .update(schema.householdMembers)
    .set({
      role: input.role,
      status: input.status,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.householdMembers.id, input.memberId),
        eq(schema.householdMembers.householdId, input.householdId),
      ),
    )
    .returning();

  if (!member) throw new Error("Member not found");

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "membership_updated",
    entityType: "membership",
    entityId: member.id,
    metadata: { role: member.role, status: member.status },
  });

  return member;
}

export async function getUsageHints(input: Queryable) {
  await assertMembership(input);
  const [containers, items, photos] = await Promise.all([
    db
      .select({ value: count() })
      .from(schema.containers)
      .where(eq(schema.containers.householdId, input.householdId)),
    db
      .select({ value: count() })
      .from(schema.items)
      .where(eq(schema.items.householdId, input.householdId)),
    db
      .select({ value: count() })
      .from(schema.photos)
      .where(eq(schema.photos.householdId, input.householdId)),
  ]);

  const photoCount = Number(photos[0]?.value ?? 0);
  return {
    containers: Number(containers[0]?.value ?? 0),
    items: Number(items[0]?.value ?? 0),
    photos: photoCount,
    estimatedStorageMb: Number((photoCount * 0.35).toFixed(1)),
  };
}

export type ExportRow = {
  location: string;
  room: string;
  containerPath: string;
  containerCode: string;
  itemName: string;
  itemAliases: string;
  tags: string;
  quantity: number;
  note: string;
};

export async function getExportRows(
  input: Queryable & { locationId?: string | null },
): Promise<ExportRow[]> {
  await assertMembership(input);

  const rows = await db.execute(sql<{
    location_name: string;
    room_name: string;
    container_path: string;
    container_code: string | null;
    item_name: string | null;
    aliases: string | null;
    tags: string | null;
    quantity: number | null;
    note: string | null;
  }>`
    select
      l.name as location_name,
      r.name as room_name,
      concat_ws(' / ', pc.name, c.name) as container_path,
      c.code as container_code,
      i.name as item_name,
      (
        select string_agg(distinct a.alias_text, '|')
        from ${schema.itemAliases} a
        where a.item_id = i.id
      ) as aliases,
      (
        select string_agg(distinct t.name, '|')
        from ${schema.itemTags} it
        inner join ${schema.tags} t on t.id = it.tag_id
        where it.item_id = i.id
      ) as tags,
      ci.quantity,
      ci.note
    from ${schema.containers} c
    inner join ${schema.rooms} r on r.id = c.room_id
    inner join ${schema.locations} l on l.id = r.location_id
    left join ${schema.containers} pc on pc.id = c.parent_container_id
    left join ${schema.containerItems} ci on ci.container_id = c.id
    left join ${schema.items} i on i.id = ci.item_id
    where c.household_id = ${input.householdId}
      and (${input.locationId ?? null}::uuid is null or l.id = ${input.locationId ?? null}::uuid)
    order by l.name, r.name, c.name, i.name;
  `);

  return rows.rows.map((r) => ({
    location: r.location_name,
    room: r.room_name,
    containerPath: r.container_path,
    containerCode: r.container_code ?? "",
    itemName: r.item_name ?? "",
    itemAliases: r.aliases ?? "",
    tags: r.tags ?? "",
    quantity: r.quantity ?? 0,
    note: r.note ?? "",
  }));
}

export async function listAllContainersInLocation(
  input: Queryable & { locationId: string },
) {
  await assertMembership(input);
  return db
    .select({
      container: schema.containers,
      room: schema.rooms,
      location: schema.locations,
    })
    .from(schema.containers)
    .innerJoin(schema.rooms, eq(schema.rooms.id, schema.containers.roomId))
    .innerJoin(
      schema.locations,
      eq(schema.locations.id, schema.rooms.locationId),
    )
    .where(
      and(
        eq(schema.containers.householdId, input.householdId),
        eq(schema.locations.id, input.locationId),
      ),
    )
    .orderBy(schema.rooms.name, schema.containers.name);
}

export async function listContainersForHousehold(
  input: Queryable & { excludeContainerId?: string },
) {
  await assertMembership(input);
  return db.query.containers.findMany({
    where: and(
      eq(schema.containers.householdId, input.householdId),
      input.excludeContainerId
        ? sql`${schema.containers.id} <> ${input.excludeContainerId}`
        : undefined,
    ),
    orderBy: [schema.containers.name],
    limit: 2000,
  });
}

export async function getHouseholdById(input: Queryable) {
  await assertMembership(input);
  return db.query.households.findFirst({
    where: eq(schema.households.id, input.householdId),
  });
}
