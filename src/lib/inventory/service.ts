import "server-only";

import { cookies } from "next/headers";
import { and, count, desc, eq, ilike, inArray, isNull, or, sql } from "drizzle-orm";

import { embedTextForSearch } from "@/lib/inventory/ai";
import { db, schema } from "@/server/db";
import { enqueueEmbeddingJob } from "@/lib/inventory/ai-jobs";
import {
  clampContainerRectToRoom,
  isRectInsideRoomShape,
} from "@/lib/inventory/household-canvas-utils";
import {
  normalizeSuggestionQuantity,
  shouldMergeSuggestionWithExisting,
} from "@/lib/inventory/suggestion-utils";
import type { HouseholdRole } from "@/lib/inventory/roles";
import {
  canManageHousehold,
  canManageMembers,
  canWriteInventory,
} from "@/lib/inventory/roles";

const ACTIVE_HOUSEHOLD_COOKIE = "active_household_id";

type Membership = typeof schema.householdMembers.$inferSelect;
type UserPreferencesRecord = typeof schema.userPreferences.$inferSelect;
type Queryable = {
  userId: string;
  householdId: string;
};

export type MembershipWithHousehold = {
  membership: Membership;
  household: typeof schema.households.$inferSelect;
};

export const ROOM_TEMPLATE_PRESETS = {
  apartment: ["Hallway", "Kitchen", "Living Room", "Bedroom", "Storage Closet"],
  storage: ["Main Aisle", "Shelf A", "Shelf B", "Cold Storage", "Tools Corner"],
  garage: ["Workbench", "Wall Rack", "Ceiling Shelf", "Sports Zone", "Cabinet"],
} as const;

export type RoomTemplateKey = keyof typeof ROOM_TEMPLATE_PRESETS;

function clean(v: string | null | undefined) {
  const value = v?.trim();
  return value ? value : null;
}

function parsePathSegments(path: string) {
  return path
    .split(/>|→/g)
    .map((segment) => segment.trim())
    .filter(Boolean)
    .slice(0, 12);
}

function getPgCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const withCause = error as { cause?: { code?: string }; code?: string };
  return withCause.cause?.code ?? withCause.code;
}

function isMissingRelation(error: unknown) {
  return getPgCode(error) === "42P01";
}

async function buildUniqueLocationName(input: {
  householdId: string;
  baseName: string;
  excludeLocationId?: string;
}) {
  const normalizedBase = clean(input.baseName) || "Floor";
  const rows = await db
    .select({ id: schema.locations.id, name: schema.locations.name })
    .from(schema.locations)
    .where(eq(schema.locations.householdId, input.householdId));

  const used = new Set(
    rows
      .filter((row) => row.id !== input.excludeLocationId)
      .map((row) => row.name.trim().toLowerCase()),
  );

  if (!used.has(normalizedBase.toLowerCase())) {
    return normalizedBase;
  }

  let candidateNumber = 2;
  while (used.has(`${normalizedBase} ${candidateNumber}`.toLowerCase())) {
    candidateNumber += 1;
  }
  return `${normalizedBase} ${candidateNumber}`;
}

async function createFloorLocation(input: Queryable & { name: string }) {
  const locationName = await buildUniqueLocationName({
    householdId: input.householdId,
    baseName: input.name,
  });
  return createLocation({
    userId: input.userId,
    householdId: input.householdId,
    name: locationName,
    description: "Auto-managed floor location for household canvas",
  });
}

async function assertLocationAvailableForLayer(input: Queryable & {
  locationId: string;
  excludeLayerId?: string;
}) {
  const [location] = await db
    .select({ id: schema.locations.id })
    .from(schema.locations)
    .where(
      and(
        eq(schema.locations.id, input.locationId),
        eq(schema.locations.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!location) {
    throw new Error("Location not found");
  }

  const [conflictingLayer] = await db
    .select({ id: schema.householdCanvasLayers.id })
    .from(schema.householdCanvasLayers)
    .where(
      and(
        eq(schema.householdCanvasLayers.householdId, input.householdId),
        eq(schema.householdCanvasLayers.locationId, input.locationId),
        input.excludeLayerId
          ? sql`${schema.householdCanvasLayers.id} <> ${input.excludeLayerId}`
          : undefined,
      ),
    )
    .limit(1);

  if (conflictingLayer) {
    throw new Error("Location is already linked to another floor");
  }
}

export async function getUserPreferences(userId: string) {
  try {
    const rows = await db
      .select()
      .from(schema.userPreferences)
      .where(eq(schema.userPreferences.userId, userId))
      .limit(1);
    return rows[0] ?? null;
  } catch (error) {
    if (isMissingRelation(error)) {
      return null;
    }
    throw error;
  }
}

export async function upsertUserPreferences(input: {
  userId: string;
  activeHouseholdId?: string | null;
  activeLocationId?: string | null;
  activeRoomId?: string | null;
}) {
  try {
    const existing = await getUserPreferences(input.userId);

    const nextHouseholdId =
      "activeHouseholdId" in input
        ? input.activeHouseholdId ?? null
        : existing?.activeHouseholdId ?? null;
    const nextLocationId =
      "activeLocationId" in input
        ? input.activeLocationId ?? null
        : existing?.activeLocationId ?? null;
    const nextRoomId =
      "activeRoomId" in input
        ? input.activeRoomId ?? null
        : existing?.activeRoomId ?? null;

    const [preferences] = await db
      .insert(schema.userPreferences)
      .values({
        userId: input.userId,
        activeHouseholdId: nextHouseholdId,
        activeLocationId: nextLocationId,
        activeRoomId: nextRoomId,
      })
      .onConflictDoUpdate({
        target: schema.userPreferences.userId,
        set: {
          activeHouseholdId: nextHouseholdId,
          activeLocationId: nextLocationId,
          activeRoomId: nextRoomId,
          updatedAt: new Date(),
        },
      })
      .returning();

    return preferences ?? null;
  } catch (error) {
    if (isMissingRelation(error)) {
      return null;
    }
    throw error;
  }
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
  preferences: UserPreferencesRecord | null;
}> {
  const [store, memberships, preferences] = await Promise.all([
    cookies(),
    listMembershipsForUser(userId),
    getUserPreferences(userId),
  ]);

  if (memberships.length === 0) {
    return { memberships, active: null, preferences: preferences ?? null };
  }

  const cookieId = store.get(ACTIVE_HOUSEHOLD_COOKIE)?.value;
  const preferredId = preferences?.activeHouseholdId || undefined;
  const active =
    memberships.find((m) => m.household.id === cookieId) ||
    memberships.find((m) => m.household.id === preferredId) ||
    memberships[0];

  return { memberships, active, preferences: preferences ?? null };
}

export async function setActiveHousehold(userId: string, householdId: string) {
  await assertMembership({ userId, householdId });

  const existing = await getUserPreferences(userId);
  const sameHousehold = existing?.activeHouseholdId === householdId;

  await upsertUserPreferences({
    userId,
    activeHouseholdId: householdId,
    activeLocationId: sameHousehold ? existing?.activeLocationId : null,
    activeRoomId: sameHousehold ? existing?.activeRoomId : null,
  });

  const store = await cookies();
  store.set(ACTIVE_HOUSEHOLD_COOKIE, householdId, {
    path: "/",
    sameSite: "lax",
    httpOnly: true,
    maxAge: 60 * 60 * 24 * 365,
  });
}

export async function setActiveLocationPreference(
  input: Queryable & { locationId: string | null },
) {
  await assertMembership(input);

  if (input.locationId) {
    const location = await db.query.locations.findFirst({
      where: and(
        eq(schema.locations.id, input.locationId),
        eq(schema.locations.householdId, input.householdId),
      ),
      columns: { id: true },
    });

    if (!location) {
      throw new Error("Location not found");
    }
  }

  await upsertUserPreferences({
    userId: input.userId,
    activeHouseholdId: input.householdId,
    activeLocationId: input.locationId,
    activeRoomId: null,
  });
}

export async function setActiveRoomPreference(
  input: Queryable & { roomId: string | null },
) {
  await assertMembership(input);

  let locationId: string | null = null;
  if (input.roomId) {
    const room = await db.query.rooms.findFirst({
      where: and(
        eq(schema.rooms.id, input.roomId),
        eq(schema.rooms.householdId, input.householdId),
      ),
      columns: { id: true, locationId: true },
    });

    if (!room) {
      throw new Error("Room not found");
    }
    locationId = room.locationId;
  }

  await upsertUserPreferences({
    userId: input.userId,
    activeHouseholdId: input.householdId,
    activeLocationId: locationId ?? undefined,
    activeRoomId: input.roomId,
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "location",
    entityId: location.id,
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

export async function listRooms(
  input: Queryable & { locationId?: string; limit?: number },
) {
  await assertMembership(input);
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));

  return db.query.rooms.findMany({
    where: and(
      eq(schema.rooms.householdId, input.householdId),
      input.locationId ? eq(schema.rooms.locationId, input.locationId) : undefined,
    ),
    orderBy: [schema.rooms.name],
    limit,
  });
}

export async function listRoomsWithLocation(
  input: Queryable & { limit?: number },
) {
  await assertMembership(input);
  const limit = Math.min(300, Math.max(1, input.limit ?? 150));

  return db
    .select({
      room: schema.rooms,
      location: schema.locations,
    })
    .from(schema.rooms)
    .innerJoin(
      schema.locations,
      eq(schema.locations.id, schema.rooms.locationId),
    )
    .where(eq(schema.rooms.householdId, input.householdId))
    .orderBy(schema.locations.name, schema.rooms.name)
    .limit(limit);
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "room",
    entityId: room.id,
  });

  return room;
}

export async function createContainerPathInRoom(
  input: Queryable & {
    roomId: string;
    path: string;
    rootParentContainerId?: string | null;
    code?: string;
    description?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const room = await db.query.rooms.findFirst({
    where: and(
      eq(schema.rooms.id, input.roomId),
      eq(schema.rooms.householdId, input.householdId),
    ),
    columns: { id: true },
  });

  if (!room) {
    throw new Error("Room not found");
  }

  const segments = parsePathSegments(input.path);
  if (!segments.length) {
    throw new Error("Path is required");
  }

  let parentContainerId = input.rootParentContainerId ?? null;
  let leafContainer: typeof schema.containers.$inferSelect | null = null;
  let createdCount = 0;

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (!segment) continue;

    const existing = await db.query.containers.findFirst({
      where: and(
        eq(schema.containers.householdId, input.householdId),
        eq(schema.containers.roomId, input.roomId),
        parentContainerId
          ? eq(schema.containers.parentContainerId, parentContainerId)
          : isNull(schema.containers.parentContainerId),
        isNull(schema.containers.archivedAt),
        sql`lower(${schema.containers.name}) = lower(${segment})`,
      ),
    });

    if (existing) {
      parentContainerId = existing.id;
      leafContainer = existing;
      continue;
    }

    const isLeaf = index === segments.length - 1;
    const created = await createContainer({
      userId: input.userId,
      householdId: input.householdId,
      roomId: input.roomId,
      parentContainerId,
      name: segment,
      code: isLeaf ? input.code : undefined,
      description: isLeaf ? input.description : undefined,
    });

    createdCount += 1;
    parentContainerId = created.id;
    leafContainer = created;
  }

  return {
    container: leafContainer,
    createdCount,
    segments,
  };
}

export async function quickCreatePathInLocation(
  input: Queryable & {
    locationId: string;
    path: string;
    code?: string;
    description?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const segments = parsePathSegments(input.path);
  if (segments.length < 2) {
    throw new Error("Path must include room and box, e.g. Basement > Shelf A > Box 12");
  }

  const [roomName, ...containerSegments] = segments;
  if (!roomName || !containerSegments.length) {
    throw new Error("Invalid path");
  }

  let room = await db.query.rooms.findFirst({
    where: and(
      eq(schema.rooms.householdId, input.householdId),
      eq(schema.rooms.locationId, input.locationId),
      sql`lower(${schema.rooms.name}) = lower(${roomName})`,
    ),
  });

  let createdRoom = false;
  if (!room) {
    room = await createRoom({
      userId: input.userId,
      householdId: input.householdId,
      locationId: input.locationId,
      name: roomName,
    });
    createdRoom = true;
  }

  const pathResult = await createContainerPathInRoom({
    userId: input.userId,
    householdId: input.householdId,
    roomId: room.id,
    path: containerSegments.join(" > "),
    code: input.code,
    description: input.description,
  });

  return {
    room,
    container: pathResult.container,
    createdRoom,
    createdContainers: pathResult.createdCount,
  };
}

export async function applyRoomTemplate(
  input: Queryable & { locationId: string; template: RoomTemplateKey },
) {
  await assertRole(input, canWriteInventory);

  const templateRooms = ROOM_TEMPLATE_PRESETS[input.template];
  if (!templateRooms) {
    throw new Error("Invalid room template");
  }

  const existing = await db.query.rooms.findMany({
    where: and(
      eq(schema.rooms.householdId, input.householdId),
      eq(schema.rooms.locationId, input.locationId),
    ),
    columns: { id: true, name: true },
  });

  const existingNames = new Set(
    existing.map((room) => room.name.trim().toLowerCase()),
  );

  const created: Array<typeof schema.rooms.$inferSelect> = [];
  for (const roomName of templateRooms) {
    const normalized = roomName.trim().toLowerCase();
    if (!normalized || existingNames.has(normalized)) {
      continue;
    }

    const [room] = await db
      .insert(schema.rooms)
      .values({
        householdId: input.householdId,
        locationId: input.locationId,
        name: roomName,
        createdBy: input.userId,
      })
      .returning();

    created.push(room);
    existingNames.add(normalized);

    await logActivity({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "created",
      entityType: "room",
      entityId: room.id,
      metadata: { name: room.name, locationId: room.locationId, template: input.template },
    });
  }

  return {
    created,
    totalTemplateRooms: templateRooms.length,
  };
}

export async function deleteLocation(
  input: Queryable & { locationId: string },
) {
  await assertRole(input, canWriteInventory);

  const location = await db.query.locations.findFirst({
    where: and(
      eq(schema.locations.id, input.locationId),
      eq(schema.locations.householdId, input.householdId),
    ),
  });

  if (!location) {
    return null;
  }

  const roomIdRows = await db
    .select({ id: schema.rooms.id })
    .from(schema.rooms)
    .where(
      and(
        eq(schema.rooms.householdId, input.householdId),
        eq(schema.rooms.locationId, input.locationId),
      ),
    );
  const roomIds = roomIdRows.map((row) => row.id);

  const containerIds = roomIds.length
    ? (
        await db
          .select({ id: schema.containers.id })
          .from(schema.containers)
          .where(
            and(
              eq(schema.containers.householdId, input.householdId),
              inArray(schema.containers.roomId, roomIds),
            ),
          )
      ).map((row) => row.id)
    : [];

  await db.transaction(async (tx) => {
    if (containerIds.length) {
      await tx
        .delete(schema.householdCanvasPlacements)
        .where(
          and(
            eq(schema.householdCanvasPlacements.householdId, input.householdId),
            eq(schema.householdCanvasPlacements.entityType, "container"),
            inArray(schema.householdCanvasPlacements.entityId, containerIds),
          ),
        );

      await tx
        .delete(schema.photos)
        .where(
          and(
            eq(schema.photos.householdId, input.householdId),
            eq(schema.photos.entityType, "container"),
            inArray(schema.photos.entityId, containerIds),
          ),
        );

      await tx
        .delete(schema.searchDocuments)
        .where(
          and(
            eq(schema.searchDocuments.householdId, input.householdId),
            eq(schema.searchDocuments.entityType, "container"),
            inArray(schema.searchDocuments.entityId, containerIds),
          ),
        );
    }

    if (roomIds.length) {
      await tx
        .delete(schema.householdCanvasPlacements)
        .where(
          and(
            eq(schema.householdCanvasPlacements.householdId, input.householdId),
            eq(schema.householdCanvasPlacements.entityType, "room"),
            inArray(schema.householdCanvasPlacements.entityId, roomIds),
          ),
        );

      await tx
        .delete(schema.photos)
        .where(
          and(
            eq(schema.photos.householdId, input.householdId),
            eq(schema.photos.entityType, "room_layout"),
            inArray(schema.photos.entityId, roomIds),
          ),
        );

      await tx
        .delete(schema.searchDocuments)
        .where(
          and(
            eq(schema.searchDocuments.householdId, input.householdId),
            eq(schema.searchDocuments.entityType, "room"),
            inArray(schema.searchDocuments.entityId, roomIds),
          ),
        );
    }

    await tx
      .delete(schema.searchDocuments)
      .where(
        and(
          eq(schema.searchDocuments.householdId, input.householdId),
          eq(schema.searchDocuments.entityType, "location"),
          eq(schema.searchDocuments.entityId, input.locationId),
        ),
      );

    await tx
      .delete(schema.locations)
      .where(
        and(
          eq(schema.locations.id, input.locationId),
          eq(schema.locations.householdId, input.householdId),
        ),
      );

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "updated",
      entityType: "location",
      entityId: location.id,
      metadata: {
        deleted: true,
        name: location.name,
        roomCount: roomIds.length,
        containerCount: containerIds.length,
      },
    });
  });

  return {
    location,
    roomCount: roomIds.length,
    containerCount: containerIds.length,
  };
}

export async function deleteRoom(
  input: Queryable & { roomId: string },
) {
  await assertRole(input, canWriteInventory);

  const room = await db.query.rooms.findFirst({
    where: and(
      eq(schema.rooms.id, input.roomId),
      eq(schema.rooms.householdId, input.householdId),
    ),
  });

  if (!room) {
    return null;
  }

  const containerIds = (
    await db
      .select({ id: schema.containers.id })
      .from(schema.containers)
      .where(
        and(
          eq(schema.containers.householdId, input.householdId),
          eq(schema.containers.roomId, input.roomId),
        ),
      )
  ).map((row) => row.id);

  await db.transaction(async (tx) => {
    if (containerIds.length) {
      await tx
        .delete(schema.householdCanvasPlacements)
        .where(
          and(
            eq(schema.householdCanvasPlacements.householdId, input.householdId),
            eq(schema.householdCanvasPlacements.entityType, "container"),
            inArray(schema.householdCanvasPlacements.entityId, containerIds),
          ),
        );

      await tx
        .delete(schema.photos)
        .where(
          and(
            eq(schema.photos.householdId, input.householdId),
            eq(schema.photos.entityType, "container"),
            inArray(schema.photos.entityId, containerIds),
          ),
        );

      await tx
        .delete(schema.searchDocuments)
        .where(
          and(
            eq(schema.searchDocuments.householdId, input.householdId),
            eq(schema.searchDocuments.entityType, "container"),
            inArray(schema.searchDocuments.entityId, containerIds),
          ),
        );
    }

    await tx
      .delete(schema.householdCanvasPlacements)
      .where(
        and(
          eq(schema.householdCanvasPlacements.householdId, input.householdId),
          eq(schema.householdCanvasPlacements.entityType, "room"),
          eq(schema.householdCanvasPlacements.entityId, input.roomId),
        ),
      );

    await tx
      .delete(schema.photos)
      .where(
        and(
          eq(schema.photos.householdId, input.householdId),
          eq(schema.photos.entityType, "room_layout"),
          eq(schema.photos.entityId, input.roomId),
        ),
      );

    await tx
      .delete(schema.searchDocuments)
      .where(
        and(
          eq(schema.searchDocuments.householdId, input.householdId),
          eq(schema.searchDocuments.entityType, "room"),
          eq(schema.searchDocuments.entityId, input.roomId),
        ),
      );

    await tx
      .delete(schema.rooms)
      .where(
        and(
          eq(schema.rooms.id, input.roomId),
          eq(schema.rooms.householdId, input.householdId),
        ),
      );

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "updated",
      entityType: "room",
      entityId: room.id,
      metadata: {
        deleted: true,
        name: room.name,
        locationId: room.locationId,
        containerCount: containerIds.length,
      },
    });
  });

  return {
    room,
    containerCount: containerIds.length,
  };
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

export async function getRoomLayout(
  input: Queryable & { roomId: string },
) {
  await assertMembership(input);
  return db.query.roomLayouts.findFirst({
    where: and(
      eq(schema.roomLayouts.roomId, input.roomId),
      eq(schema.roomLayouts.householdId, input.householdId),
    ),
  });
}

export async function upsertRoomLayout(
  input: Queryable & {
    roomId: string;
    width: number;
    height: number;
    backgroundPhotoId?: string | null;
  },
) {
  await assertRole(input, canWriteInventory);
  const [layout] = await db
    .insert(schema.roomLayouts)
    .values({
      roomId: input.roomId,
      householdId: input.householdId,
      width: input.width,
      height: input.height,
      backgroundPhotoId: input.backgroundPhotoId ?? null,
    })
    .onConflictDoUpdate({
      target: schema.roomLayouts.roomId,
      set: {
        width: input.width,
        height: input.height,
        backgroundPhotoId: input.backgroundPhotoId ?? null,
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "room_layout",
    entityId: input.roomId,
    metadata: {
      width: input.width,
      height: input.height,
      backgroundPhotoId: input.backgroundPhotoId ?? null,
    },
  });

  return layout;
}

export async function getHouseholdCanvasLayout(input: Queryable) {
  await assertMembership(input);
  try {
    const [layout] = await db
      .select()
      .from(schema.householdCanvasLayouts)
      .where(eq(schema.householdCanvasLayouts.householdId, input.householdId))
      .limit(1);
    return layout ?? null;
  } catch (error) {
    if (isMissingRelation(error)) {
      return null;
    }
    throw error;
  }
}

export async function upsertHouseholdCanvasLayout(
  input: Queryable & { width: number; height: number },
) {
  await assertRole(input, canWriteInventory);

  const [layout] = await db
    .insert(schema.householdCanvasLayouts)
    .values({
      householdId: input.householdId,
      width: Math.max(8, input.width),
      height: Math.max(8, input.height),
    })
    .onConflictDoUpdate({
      target: schema.householdCanvasLayouts.householdId,
      set: {
        width: Math.max(8, input.width),
        height: Math.max(8, input.height),
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "household",
    entityId: input.householdId,
    metadata: {
      householdCanvas: {
        updatedLayout: true,
        width: layout.width,
        height: layout.height,
      },
    },
  });

  return layout;
}

export async function ensureHouseholdCanvasInitialized(input: Queryable) {
  const membership = await assertMembership(input);
  if (!canWriteInventory(membership.role)) {
    return;
  }

  const layout = await getHouseholdCanvasLayout(input);
  if (!layout) {
    await upsertHouseholdCanvasLayout({
      userId: input.userId,
      householdId: input.householdId,
      width: 30,
      height: 20,
    });
  }

  const layers = await listHouseholdCanvasLayers(input);
  if (layers.length === 0) {
    await createHouseholdCanvasLayer({
      userId: input.userId,
      householdId: input.householdId,
      name: "Base floor",
    });
    return;
  }

  const missingLocationLayers = layers.filter((layer) => !layer.locationId);
  if (missingLocationLayers.length === 0) {
    return;
  }

  for (const layer of missingLocationLayers) {
    await updateHouseholdCanvasLayer({
      userId: input.userId,
      householdId: input.householdId,
      layerId: layer.id,
      name: layer.name,
    });
  }
}

export async function listHouseholdCanvasLayers(input: Queryable) {
  await assertMembership(input);
  try {
    return await db
      .select()
      .from(schema.householdCanvasLayers)
      .where(eq(schema.householdCanvasLayers.householdId, input.householdId))
      .orderBy(
        schema.householdCanvasLayers.sortOrder,
        schema.householdCanvasLayers.createdAt,
      );
  } catch (error) {
    if (isMissingRelation(error)) {
      return [];
    }
    throw error;
  }
}

export async function createHouseholdCanvasLayer(
  input: Queryable & {
    name: string;
    locationId?: string | null;
    sortOrder?: number;
  },
) {
  await assertRole(input, canWriteInventory);

  const name = input.name.trim();
  if (!name) {
    throw new Error("Layer name required");
  }

  let locationId = input.locationId ?? null;
  if (locationId) {
    await assertLocationAvailableForLayer({
      userId: input.userId,
      householdId: input.householdId,
      locationId,
    });
  } else {
    const location = await createFloorLocation({
      userId: input.userId,
      householdId: input.householdId,
      name,
    });
    locationId = location.id;
  }

  const maxSortRow = await db
    .select({
      maxSort: sql<number>`coalesce(max(${schema.householdCanvasLayers.sortOrder}), -1)`,
    })
    .from(schema.householdCanvasLayers)
    .where(eq(schema.householdCanvasLayers.householdId, input.householdId))
    .limit(1);
  const nextSort = Math.max(
    0,
    input.sortOrder ?? Number(maxSortRow[0]?.maxSort ?? -1) + 1,
  );

  const [layer] = await db
    .insert(schema.householdCanvasLayers)
    .values({
      householdId: input.householdId,
      locationId,
      name,
      sortOrder: nextSort,
      createdBy: input.userId,
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "created",
    entityType: "household",
    entityId: input.householdId,
    metadata: {
      householdCanvas: {
        createdLayer: true,
        layerId: layer.id,
        name: layer.name,
        locationId: layer.locationId,
      },
    },
  });

  return layer;
}

export async function updateHouseholdCanvasLayer(
  input: Queryable & {
    layerId: string;
    name?: string;
    locationId?: string | null;
    sortOrder?: number;
  },
) {
  await assertRole(input, canWriteInventory);

  const [layer] = await db
    .select()
    .from(schema.householdCanvasLayers)
    .where(
      and(
        eq(schema.householdCanvasLayers.id, input.layerId),
        eq(schema.householdCanvasLayers.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!layer) {
    throw new Error("Layer not found");
  }

  const explicitName = typeof input.name === "string" ? input.name.trim() : undefined;
  const nextName = explicitName && explicitName.length ? explicitName : layer.name;
  let nextLocationId =
    typeof input.locationId !== "undefined" ? input.locationId : layer.locationId;

  if (nextLocationId) {
    await assertLocationAvailableForLayer({
      userId: input.userId,
      householdId: input.householdId,
      locationId: nextLocationId,
      excludeLayerId: layer.id,
    });
  } else {
    const location = await createFloorLocation({
      userId: input.userId,
      householdId: input.householdId,
      name: nextName,
    });
    nextLocationId = location.id;
  }

  if (explicitName && nextLocationId) {
    const renamedLocation = await buildUniqueLocationName({
      householdId: input.householdId,
      baseName: nextName,
      excludeLocationId: nextLocationId,
    });
    await db
      .update(schema.locations)
      .set({ name: renamedLocation })
      .where(
        and(
          eq(schema.locations.id, nextLocationId),
          eq(schema.locations.householdId, input.householdId),
        ),
      );
  }

  const [updated] = await db
    .update(schema.householdCanvasLayers)
    .set({
      name: nextName,
      locationId: nextLocationId,
      sortOrder:
        typeof input.sortOrder === "number"
          ? Math.max(0, input.sortOrder)
          : layer.sortOrder,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.householdCanvasLayers.id, input.layerId),
        eq(schema.householdCanvasLayers.householdId, input.householdId),
      ),
    )
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "household",
    entityId: input.householdId,
    metadata: {
      householdCanvas: {
        updatedLayer: true,
        layerId: updated.id,
        name: updated.name,
        locationId: updated.locationId,
        sortOrder: updated.sortOrder,
      },
    },
  });

  return updated;
}

export async function deleteHouseholdCanvasLayer(
  input: Queryable & { layerId: string },
) {
  await assertRole(input, canWriteInventory);

  const [layer] = await db
    .delete(schema.householdCanvasLayers)
    .where(
      and(
        eq(schema.householdCanvasLayers.id, input.layerId),
        eq(schema.householdCanvasLayers.householdId, input.householdId),
      ),
    )
    .returning();

  if (!layer) {
    return null;
  }

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "household",
    entityId: input.householdId,
    metadata: {
      householdCanvas: {
        deletedLayer: true,
        layerId: layer.id,
        name: layer.name,
      },
    },
  });

  return layer;
}

export async function listHouseholdCanvasPlacements(
  input: Queryable & { layerId?: string },
) {
  await assertMembership(input);
  try {
    return await db
      .select()
      .from(schema.householdCanvasPlacements)
      .where(
        and(
          eq(schema.householdCanvasPlacements.householdId, input.householdId),
          input.layerId
            ? eq(schema.householdCanvasPlacements.layerId, input.layerId)
            : undefined,
        ),
      )
      .orderBy(schema.householdCanvasPlacements.createdAt);
  } catch (error) {
    if (isMissingRelation(error)) {
      return [];
    }
    throw error;
  }
}

export async function upsertHouseholdCanvasPlacement(
  input: Queryable & {
    layerId: string;
    entityType: "room" | "container";
    entityId: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    shapeType?: "rectangle" | "square" | "triangle";
    label?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const [layer] = await db
    .select({ id: schema.householdCanvasLayers.id })
    .from(schema.householdCanvasLayers)
    .where(
      and(
        eq(schema.householdCanvasLayers.id, input.layerId),
        eq(schema.householdCanvasLayers.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!layer) {
    throw new Error("Layer not found");
  }

  if (input.entityType === "room") {
    const room = await db.query.rooms.findFirst({
      where: and(
        eq(schema.rooms.id, input.entityId),
        eq(schema.rooms.householdId, input.householdId),
      ),
      columns: { id: true },
    });
    if (!room) {
      throw new Error("Room not found");
    }
  } else {
    const container = await db.query.containers.findFirst({
      where: and(
        eq(schema.containers.id, input.entityId),
        eq(schema.containers.householdId, input.householdId),
      ),
      columns: {
        id: true,
        roomId: true,
      },
    });
    if (!container) {
      throw new Error("Container not found");
    }

    const [roomPlacement] = await db
      .select({
        id: schema.householdCanvasPlacements.id,
        x: schema.householdCanvasPlacements.x,
        y: schema.householdCanvasPlacements.y,
        width: schema.householdCanvasPlacements.width,
        height: schema.householdCanvasPlacements.height,
        rotation: schema.householdCanvasPlacements.rotation,
        shapeType: schema.householdCanvasPlacements.shapeType,
      })
      .from(schema.householdCanvasPlacements)
      .where(
        and(
          eq(schema.householdCanvasPlacements.householdId, input.householdId),
          eq(schema.householdCanvasPlacements.layerId, input.layerId),
          eq(schema.householdCanvasPlacements.entityType, "room"),
          eq(schema.householdCanvasPlacements.entityId, container.roomId),
        ),
      )
      .limit(1);

    if (!roomPlacement) {
      throw new Error("Container room is not mapped on this floor");
    }

    const candidateRect = {
      x: Math.max(0, input.x),
      y: Math.max(0, input.y),
      width: Math.max(0.5, input.width),
      height: Math.max(0.5, input.height),
    };
    const roomShape = {
      x: Number(roomPlacement.x ?? 0),
      y: Number(roomPlacement.y ?? 0),
      width: Number(roomPlacement.width ?? 0),
      height: Number(roomPlacement.height ?? 0),
      rotation: Number(roomPlacement.rotation ?? 0),
      shapeType: roomPlacement.shapeType ?? "rectangle",
    } as const;

    const clampedCandidate = clampContainerRectToRoom(candidateRect, roomShape);
    if (!isRectInsideRoomShape(clampedCandidate, roomShape)) {
      throw new Error("Container must stay inside its room");
    }

    const epsilon = 0.01;
    if (
      Math.abs(clampedCandidate.x - candidateRect.x) > epsilon ||
      Math.abs(clampedCandidate.y - candidateRect.y) > epsilon
    ) {
      throw new Error("Container must stay inside its room");
    }
  }

  const normalizedShapeType =
    input.entityType === "container" ? "rectangle" : input.shapeType ?? "rectangle";

  const [placement] = await db
    .insert(schema.householdCanvasPlacements)
    .values({
      householdId: input.householdId,
      layerId: input.layerId,
      entityType: input.entityType,
      entityId: input.entityId,
      x: Math.max(0, input.x),
      y: Math.max(0, input.y),
      width: Math.max(0.5, input.width),
      height: Math.max(0.5, input.height),
      rotation: input.rotation ?? 0,
      shapeType: normalizedShapeType,
      label: clean(input.label),
      createdBy: input.userId,
    })
    .onConflictDoUpdate({
      target: [
        schema.householdCanvasPlacements.layerId,
        schema.householdCanvasPlacements.entityType,
        schema.householdCanvasPlacements.entityId,
      ],
      set: {
        x: Math.max(0, input.x),
        y: Math.max(0, input.y),
        width: Math.max(0.5, input.width),
        height: Math.max(0.5, input.height),
        rotation: input.rotation ?? 0,
        shapeType: normalizedShapeType,
        label: clean(input.label),
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "placement",
    entityId: placement.id,
    metadata: {
      householdCanvas: true,
      layerId: input.layerId,
      entityType: input.entityType,
      entityId: input.entityId,
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      rotation: input.rotation ?? 0,
      shapeType: normalizedShapeType,
    },
  });

  return placement;
}

export async function deleteHouseholdCanvasPlacement(
  input: Queryable & { placementId: string },
) {
  await assertRole(input, canWriteInventory);

  const [placement] = await db
    .delete(schema.householdCanvasPlacements)
    .where(
      and(
        eq(schema.householdCanvasPlacements.id, input.placementId),
        eq(schema.householdCanvasPlacements.householdId, input.householdId),
      ),
    )
    .returning();

  if (!placement) {
    return null;
  }

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "placement",
    entityId: placement.id,
    metadata: {
      householdCanvas: true,
      removed: true,
      layerId: placement.layerId,
      entityType: placement.entityType,
      entityId: placement.entityId,
    },
  });

  return placement;
}

export async function createAndPlaceRoomOnHouseholdCanvas(
  input: Queryable & {
    layerId: string;
    locationId?: string | null;
    name: string;
    description?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    shapeType?: "rectangle" | "square" | "triangle";
    label?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const [layer] = await db
    .select()
    .from(schema.householdCanvasLayers)
    .where(
      and(
        eq(schema.householdCanvasLayers.id, input.layerId),
        eq(schema.householdCanvasLayers.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!layer) {
    throw new Error("Layer not found");
  }

  let locationId = input.locationId ?? layer.locationId;
  if (!locationId) {
    const location = await createFloorLocation({
      userId: input.userId,
      householdId: input.householdId,
      name: layer.name,
    });
    locationId = location.id;
    await db
      .update(schema.householdCanvasLayers)
      .set({ locationId, updatedAt: new Date() })
      .where(
        and(
          eq(schema.householdCanvasLayers.id, input.layerId),
          eq(schema.householdCanvasLayers.householdId, input.householdId),
        ),
      );
  }

  const room = await createRoom({
    userId: input.userId,
    householdId: input.householdId,
    locationId,
    name: input.name,
    description: input.description,
  });

  const placement = await upsertHouseholdCanvasPlacement({
    userId: input.userId,
    householdId: input.householdId,
    layerId: input.layerId,
    entityType: "room",
    entityId: room.id,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    shapeType: input.shapeType ?? "rectangle",
    label: input.label,
  });

  return { room, placement };
}

export async function createAndPlaceContainerOnHouseholdCanvas(
  input: Queryable & {
    layerId: string;
    roomId: string;
    parentContainerId?: string | null;
    name: string;
    code?: string;
    description?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    rotation?: number;
    label?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const [layer] = await db
    .select({ id: schema.householdCanvasLayers.id })
    .from(schema.householdCanvasLayers)
    .where(
      and(
        eq(schema.householdCanvasLayers.id, input.layerId),
        eq(schema.householdCanvasLayers.householdId, input.householdId),
      ),
    )
    .limit(1);
  if (!layer) {
    throw new Error("Layer not found");
  }

  const room = await db.query.rooms.findFirst({
    where: and(
      eq(schema.rooms.id, input.roomId),
      eq(schema.rooms.householdId, input.householdId),
    ),
    columns: { id: true },
  });
  if (!room) {
    throw new Error("Room not found");
  }

  const container = await createContainer({
    userId: input.userId,
    householdId: input.householdId,
    roomId: input.roomId,
    parentContainerId: input.parentContainerId ?? null,
    name: input.name,
    code: input.code,
    description: input.description,
  });

  const placement = await upsertHouseholdCanvasPlacement({
    userId: input.userId,
    householdId: input.householdId,
    layerId: input.layerId,
    entityType: "container",
    entityId: container.id,
    x: input.x,
    y: input.y,
    width: input.width,
    height: input.height,
    rotation: input.rotation ?? 0,
    shapeType: "rectangle",
    label: input.label,
  });

  return { container, placement };
}

export async function listPlacementsForRoom(
  input: Queryable & { roomId: string },
) {
  await assertMembership(input);
  return db.query.placements.findMany({
    where: and(
      eq(schema.placements.householdId, input.householdId),
      eq(schema.placements.roomId, input.roomId),
    ),
    orderBy: [schema.placements.createdAt],
  });
}

export async function upsertPlacement(
  input: Queryable & {
    roomId: string;
    entityType: "container" | "item";
    entityId: string;
    x: number;
    y: number;
    rotation?: number;
    label?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  if (input.entityType === "container") {
    const container = await db.query.containers.findFirst({
      where: and(
        eq(schema.containers.householdId, input.householdId),
        eq(schema.containers.id, input.entityId),
      ),
      columns: { id: true, roomId: true },
    });
    if (!container) {
      throw new Error("Container not found");
    }
  } else {
    const item = await db.query.items.findFirst({
      where: and(
        eq(schema.items.householdId, input.householdId),
        eq(schema.items.id, input.entityId),
      ),
      columns: { id: true },
    });
    if (!item) {
      throw new Error("Item not found");
    }
  }

  const [placement] = await db
    .insert(schema.placements)
    .values({
      householdId: input.householdId,
      roomId: input.roomId,
      entityType: input.entityType,
      entityId: input.entityId,
      x: input.x,
      y: input.y,
      rotation: input.rotation ?? 0,
      label: clean(input.label),
      createdBy: input.userId,
    })
    .onConflictDoUpdate({
      target: [
        schema.placements.roomId,
        schema.placements.entityType,
        schema.placements.entityId,
      ],
      set: {
        x: input.x,
        y: input.y,
        rotation: input.rotation ?? 0,
        label: clean(input.label),
        updatedAt: new Date(),
      },
    })
    .returning();

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "placement",
    entityId: placement.id,
    metadata: {
      roomId: input.roomId,
      entityType: input.entityType,
      entityId: input.entityId,
      x: input.x,
      y: input.y,
      rotation: input.rotation ?? 0,
    },
  });

  return placement;
}

export async function deletePlacement(
  input: Queryable & { placementId: string },
) {
  await assertRole(input, canWriteInventory);

  const [placement] = await db
    .delete(schema.placements)
    .where(
      and(
        eq(schema.placements.id, input.placementId),
        eq(schema.placements.householdId, input.householdId),
      ),
    )
    .returning();

  if (!placement) {
    return null;
  }

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "placement",
    entityId: placement.id,
    metadata: {
      roomId: placement.roomId,
      entityType: placement.entityType,
      entityId: placement.entityId,
      removed: true,
    },
  });

  return placement;
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: container.id,
  });

  return container;
}

export async function setContainerArchived(
  input: Queryable & { containerId: string; archived: boolean },
) {
  await assertRole(input, canWriteInventory);

  const [container] = await db
    .update(schema.containers)
    .set({
      status: input.archived ? "archived" : "active",
      archivedAt: input.archived ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.containers.id, input.containerId),
        eq(schema.containers.householdId, input.householdId),
      ),
    )
    .returning();

  if (!container) {
    return null;
  }

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: input.archived ? "archived" : "updated",
    entityType: "container",
    entityId: container.id,
    metadata: {
      archived: input.archived,
      roomId: container.roomId,
      name: container.name,
    },
  });

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: container.id,
  });

  return container;
}

export async function deleteContainer(
  input: Queryable & { containerId: string },
) {
  await assertRole(input, canWriteInventory);

  const container = await db.query.containers.findFirst({
    where: and(
      eq(schema.containers.id, input.containerId),
      eq(schema.containers.householdId, input.householdId),
    ),
  });

  if (!container) {
    return null;
  }

  await db.transaction(async (tx) => {
    await tx
      .delete(schema.placements)
      .where(
        and(
          eq(schema.placements.householdId, input.householdId),
          eq(schema.placements.roomId, container.roomId),
          eq(schema.placements.entityType, "container"),
          eq(schema.placements.entityId, container.id),
        ),
      );

    await tx
      .delete(schema.householdCanvasPlacements)
      .where(
        and(
          eq(schema.householdCanvasPlacements.householdId, input.householdId),
          eq(schema.householdCanvasPlacements.entityType, "container"),
          eq(schema.householdCanvasPlacements.entityId, container.id),
        ),
      );

    await tx
      .delete(schema.photos)
      .where(
        and(
          eq(schema.photos.householdId, input.householdId),
          eq(schema.photos.entityType, "container"),
          eq(schema.photos.entityId, container.id),
        ),
      );

    await tx
      .delete(schema.searchDocuments)
      .where(
        and(
          eq(schema.searchDocuments.householdId, input.householdId),
          eq(schema.searchDocuments.entityType, "container"),
          eq(schema.searchDocuments.entityId, container.id),
        ),
      );

    await tx
      .delete(schema.containers)
      .where(
        and(
          eq(schema.containers.id, container.id),
          eq(schema.containers.householdId, input.householdId),
        ),
      );

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "updated",
      entityType: "container",
      entityId: container.id,
      metadata: {
        deleted: true,
        roomId: container.roomId,
        name: container.name,
      },
    });
  });

  return container;
}

export async function createAndPlaceContainer(
  input: Queryable & {
    roomId: string;
    parentContainerId?: string | null;
    name: string;
    code?: string;
    description?: string;
    x: number;
    y: number;
    rotation?: number;
    label?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  const container = await createContainer({
    userId: input.userId,
    householdId: input.householdId,
    roomId: input.roomId,
    parentContainerId: input.parentContainerId,
    name: input.name,
    code: input.code,
    description: input.description,
  });

  const placement = await upsertPlacement({
    userId: input.userId,
    householdId: input.householdId,
    roomId: input.roomId,
    entityType: "container",
    entityId: container.id,
    x: input.x,
    y: input.y,
    rotation: input.rotation ?? 0,
    label: input.label,
  });

  return { container, placement };
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

  const item = await db.transaction(async (tx) => {
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "item",
    entityId: item.id,
  });

  return item;
}

export async function findOrCreateItemByName(
  input: Queryable & { name: string },
) {
  await assertRole(input, canWriteInventory);
  const normalizedName = input.name.trim();
  if (!normalizedName) {
    throw new Error("Name required");
  }

  const existing = await db.query.items.findFirst({
    where: and(
      eq(schema.items.householdId, input.householdId),
      sql`lower(${schema.items.name}) = lower(${normalizedName})`,
    ),
  });

  if (existing) {
    return existing;
  }

  return createItem({
    userId: input.userId,
    householdId: input.householdId,
    name: normalizedName,
  });
}

export async function mergeItems(
  input: Queryable & {
    sourceItemId: string;
    targetItemId: string;
  },
) {
  await assertRole(input, canWriteInventory);
  if (input.sourceItemId === input.targetItemId) {
    throw new Error("Source and target items must be different");
  }

  await db.transaction(async (tx) => {
    const [sourceItem, targetItem] = await Promise.all([
      tx.query.items.findFirst({
        where: and(
          eq(schema.items.id, input.sourceItemId),
          eq(schema.items.householdId, input.householdId),
        ),
        columns: { id: true },
      }),
      tx.query.items.findFirst({
        where: and(
          eq(schema.items.id, input.targetItemId),
          eq(schema.items.householdId, input.householdId),
        ),
        columns: { id: true },
      }),
    ]);

    if (!sourceItem || !targetItem) {
      throw new Error("Item not found");
    }

    const sourceContainerRows = await tx.query.containerItems.findMany({
      where: and(
        eq(schema.containerItems.householdId, input.householdId),
        eq(schema.containerItems.itemId, sourceItem.id),
      ),
      columns: { containerId: true, quantity: true, note: true },
    });

    for (const row of sourceContainerRows) {
      const containerId = String(row.containerId);
      const quantity = Number(row.quantity);
      await tx
        .insert(schema.containerItems)
        .values({
          householdId: input.householdId,
          containerId,
          itemId: String(targetItem.id),
          quantity,
          note: row.note ? String(row.note) : null,
        })
        .onConflictDoUpdate({
          target: [schema.containerItems.containerId, schema.containerItems.itemId],
          set: {
            quantity: sql`${schema.containerItems.quantity} + ${quantity}`,
            updatedAt: new Date(),
          },
        });
    }

    const sourceTags = await tx.query.itemTags.findMany({
      where: and(
        eq(schema.itemTags.householdId, input.householdId),
        eq(schema.itemTags.itemId, sourceItem.id),
      ),
      columns: { tagId: true },
    });
    if (sourceTags.length) {
      await tx
        .insert(schema.itemTags)
        .values(
          sourceTags.map((row) => ({
            householdId: input.householdId,
            itemId: String(targetItem.id),
            tagId: String(row.tagId),
          })),
        )
        .onConflictDoNothing();
    }

    const sourceAliases = await tx.query.itemAliases.findMany({
      where: and(
        eq(schema.itemAliases.householdId, input.householdId),
        eq(schema.itemAliases.itemId, sourceItem.id),
      ),
      columns: { aliasText: true },
    });
    if (sourceAliases.length) {
      await tx
        .insert(schema.itemAliases)
        .values(
          sourceAliases.map((row) => ({
            householdId: input.householdId,
            itemId: String(targetItem.id),
            aliasText: String(row.aliasText),
          })),
        )
        .onConflictDoNothing();
    }

    await tx
      .update(schema.photoSuggestions)
      .set({
        resolvedItemId: String(targetItem.id),
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(schema.photoSuggestions.householdId, input.householdId),
          eq(schema.photoSuggestions.resolvedItemId, sourceItem.id),
        ),
      );

    await tx.delete(schema.items).where(eq(schema.items.id, sourceItem.id));

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "updated",
      entityType: "item",
      entityId: targetItem.id,
      metadata: {
        mergedFromItemId: sourceItem.id,
      },
    });
  });

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "item",
    entityId: input.targetItemId,
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "item",
    entityId: input.itemId,
  });
  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: input.containerId,
  });

  return row;
}

export async function addItemQuantityToContainer(
  input: Queryable & {
    containerId: string;
    itemId: string;
    quantityDelta: number;
    note?: string;
  },
) {
  await assertRole(input, canWriteInventory);

  if (!Number.isFinite(input.quantityDelta) || input.quantityDelta <= 0) {
    throw new Error("quantityDelta must be positive");
  }

  const [row] = await db
    .insert(schema.containerItems)
    .values({
      householdId: input.householdId,
      containerId: input.containerId,
      itemId: input.itemId,
      quantity: input.quantityDelta,
      note: clean(input.note),
    })
    .onConflictDoUpdate({
      target: [schema.containerItems.containerId, schema.containerItems.itemId],
      set: {
        quantity:
          sql`${schema.containerItems.quantity} + ${Math.max(1, input.quantityDelta)}`,
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
      quantityDelta: input.quantityDelta,
    },
  });

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "item",
    entityId: input.itemId,
  });
  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: input.containerId,
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

  await db.transaction(async (tx) => {
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "item",
    entityId: input.itemId,
  });
  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: input.fromContainerId,
  });
  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: input.toContainerId,
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "tag",
    entityId: tag.id,
  });

  return tag;
}

export async function setContainerTags(
  input: Queryable & { containerId: string; tagIds: string[] },
) {
  await assertRole(input, canWriteInventory);
  await db.transaction(async (tx) => {
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

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: input.containerId,
  });

  for (const tagId of input.tagIds) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "tag",
      entityId: tagId,
    });
  }
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
  return listEntityPhotos({
    userId: input.userId,
    householdId: input.householdId,
    entityType: "container",
    entityId: input.containerId,
  });
}

export async function listEntityPhotos(
  input: Queryable & {
    entityType: "container" | "item" | "room_layout";
    entityId: string;
  },
) {
  await assertMembership(input);
  return db.query.photos.findMany({
    where: and(
      eq(schema.photos.householdId, input.householdId),
      eq(schema.photos.entityType, input.entityType),
      eq(schema.photos.entityId, input.entityId),
    ),
    orderBy: [desc(schema.photos.createdAt)],
  });
}

export async function insertPhotoRecord(
  input: Queryable & {
    entityType: "container" | "item" | "room_layout";
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

export async function enqueueAiJob(
  input: Queryable & {
    jobType: (typeof schema.aiJobs.$inferInsert)["jobType"];
    payload: Record<string, unknown>;
    runAfter?: Date;
  },
) {
  await assertRole(input, canWriteInventory);

  const [job] = await db
    .insert(schema.aiJobs)
    .values({
      householdId: input.householdId,
      jobType: input.jobType,
      status: "queued",
      payload: input.payload,
      runAfter: input.runAfter ?? new Date(),
    })
    .returning();

  return job;
}

export async function listPhotoSuggestions(
  input: Queryable & {
    containerId?: string;
    status?: (typeof schema.photoSuggestions.$inferSelect)["status"];
    limit?: number;
  },
) {
  await assertMembership(input);
  const limit = Math.min(200, Math.max(1, input.limit ?? 100));

  return db.query.photoSuggestions.findMany({
    where: and(
      eq(schema.photoSuggestions.householdId, input.householdId),
      input.containerId
        ? eq(schema.photoSuggestions.containerId, input.containerId)
        : undefined,
      input.status ? eq(schema.photoSuggestions.status, input.status) : undefined,
    ),
    orderBy: [desc(schema.photoSuggestions.createdAt)],
    limit,
  });
}

export async function acceptPhotoSuggestion(
  input: Queryable & {
    suggestionId: string;
    name?: string;
    quantity?: number;
    tags?: string[];
  },
) {
  await assertRole(input, canWriteInventory);

  const acceptedSuggestion = await db.transaction(async (tx) => {
    const suggestion = await tx.query.photoSuggestions.findFirst({
      where: and(
        eq(schema.photoSuggestions.id, input.suggestionId),
        eq(schema.photoSuggestions.householdId, input.householdId),
      ),
    });

    if (!suggestion) {
      throw new Error("Suggestion not found");
    }
    if (suggestion.status !== "pending") {
      throw new Error("Suggestion already resolved");
    }

    const finalName = clean(input.name) || suggestion.suggestedName;
    if (!finalName) {
      throw new Error("Suggestion name is required");
    }
    const quantity = normalizeSuggestionQuantity(
      input.quantity ?? suggestion.suggestedQty ?? 1,
    );

    const bestMatch = await tx.execute(sql<{ id: string; score: number }>`
      select
        i.id,
        similarity(lower(i.name), lower(${finalName})) as score
      from ${schema.items} i
      where i.household_id = ${input.householdId}
      order by score desc
      limit 1
    `);

    const bestRow = bestMatch.rows[0] as { id?: string; score?: number } | undefined;
    const topScore = Number(bestRow?.score ?? 0);
    let resolvedItemId: string | null = shouldMergeSuggestionWithExisting(topScore)
      ? (bestRow?.id ? String(bestRow.id) : null)
      : null;

    if (!resolvedItemId) {
      const [createdItem] = await tx
        .insert(schema.items)
        .values({
          householdId: input.householdId,
          name: finalName,
          createdBy: input.userId,
        })
        .returning({ id: schema.items.id });
      resolvedItemId = String(createdItem.id);
    }

    if (!resolvedItemId) {
      throw new Error("Unable to resolve item for suggestion");
    }

    await tx
      .insert(schema.containerItems)
      .values({
        householdId: input.householdId,
        containerId: suggestion.containerId,
        itemId: resolvedItemId,
        quantity,
      })
      .onConflictDoUpdate({
        target: [schema.containerItems.containerId, schema.containerItems.itemId],
        set: {
          quantity: sql`${schema.containerItems.quantity} + ${quantity}`,
          updatedAt: new Date(),
        },
      });

    const rawTags = input.tags ?? suggestion.suggestedTags ?? [];
    const normalizedTags = rawTags
      .map((tag) => tag.trim())
      .filter(Boolean)
      .slice(0, 8);

    for (const tagName of normalizedTags) {
      const [tag] = await tx
        .insert(schema.tags)
        .values({
          householdId: input.householdId,
          name: tagName,
        })
        .onConflictDoUpdate({
          target: [schema.tags.householdId, schema.tags.name],
          set: { name: tagName },
        })
        .returning({ id: schema.tags.id });
      const tagId = String(tag.id);

      await tx
        .insert(schema.itemTags)
        .values({
          householdId: input.householdId,
          itemId: resolvedItemId,
          tagId,
        })
        .onConflictDoNothing();

      await tx
        .insert(schema.containerTags)
        .values({
          householdId: input.householdId,
          containerId: suggestion.containerId,
          tagId,
        })
        .onConflictDoNothing();
    }

    const [updatedSuggestion] = await tx
      .update(schema.photoSuggestions)
      .set({
        status: "accepted",
        resolvedItemId,
        updatedAt: new Date(),
      })
      .where(eq(schema.photoSuggestions.id, suggestion.id))
      .returning();

    await tx.insert(schema.activityLog).values({
      householdId: input.householdId,
      actorUserId: input.userId,
      actionType: "updated",
      entityType: "suggestion",
      entityId: suggestion.id,
      metadata: {
        photoId: suggestion.photoId,
        containerId: suggestion.containerId,
        resolvedItemId,
        quantity,
      },
    });

    return updatedSuggestion;
  });

  if (acceptedSuggestion?.resolvedItemId) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "item",
      entityId: acceptedSuggestion.resolvedItemId,
    });
  }

  await enqueueEmbeddingJob({
    householdId: input.householdId,
    entityType: "container",
    entityId: acceptedSuggestion.containerId,
  });

  return acceptedSuggestion;
}

export async function rejectPhotoSuggestion(
  input: Queryable & { suggestionId: string },
) {
  await assertRole(input, canWriteInventory);

  const [suggestion] = await db
    .update(schema.photoSuggestions)
    .set({
      status: "rejected",
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(schema.photoSuggestions.id, input.suggestionId),
        eq(schema.photoSuggestions.householdId, input.householdId),
      ),
    )
    .returning();

  if (!suggestion) {
    throw new Error("Suggestion not found");
  }

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "updated",
    entityType: "suggestion",
    entityId: suggestion.id,
    metadata: {
      photoId: suggestion.photoId,
      containerId: suggestion.containerId,
      status: "rejected",
    },
  });

  return suggestion;
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
  entityType: "item" | "container" | "room" | "location" | "tag";
  entityId: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
  matchSource?: "fuzzy" | "semantic" | "hybrid";
  matchFields?: string[];
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

  const fuzzyRows = rows.rows as Array<{
    entity_type: "item" | "container" | "room" | "location";
    entity_id: string;
    title: string;
    subtitle: string;
    href: string;
    score: number;
  }>;

  return fuzzyRows.map((r) => ({
    entityType: r.entity_type,
    entityId: r.entity_id,
    title: r.title,
    subtitle: r.subtitle,
    href: r.href,
    score: Number(r.score),
    matchSource: "fuzzy" as const,
    matchFields: ["name", "tags", "alias"],
  }));
}

export async function semanticSearch(
  input: Queryable & { query: string; limit?: number },
): Promise<GlobalSearchResult[]> {
  await assertMembership(input);

  const term = input.query.trim();
  if (!term) return [];
  const limit = Math.min(80, Math.max(1, input.limit ?? 20));

  const embedding = await embedTextForSearch(term);
  const vectorLiteral = `[${embedding.map((value) => Number(value.toFixed(8))).join(",")}]`;

  const hits = await db.execute(sql<{
    entity_type: "item" | "container" | "room" | "location" | "tag";
    entity_id: string;
    score: number;
  }>`
    select
      d.entity_type,
      d.entity_id,
      greatest(0, 1 - (d.embedding <=> ${vectorLiteral}::vector)) as score
    from ${schema.searchDocuments} d
    where d.household_id = ${input.householdId}
      and d.embedding is not null
    order by d.embedding <=> ${vectorLiteral}::vector
    limit ${limit}
  `);

  const semanticHits = hits.rows as Array<{
    entity_type: "item" | "container" | "room" | "location" | "tag";
    entity_id: string;
    score: number;
  }>;

  if (semanticHits.length === 0) {
    return [];
  }

  const itemIds = semanticHits
    .filter((row) => row.entity_type === "item")
    .map((row) => row.entity_id);
  const containerIds = semanticHits
    .filter((row) => row.entity_type === "container")
    .map((row) => row.entity_id);
  const roomIds = semanticHits
    .filter((row) => row.entity_type === "room")
    .map((row) => row.entity_id);
  const locationIds = semanticHits
    .filter((row) => row.entity_type === "location")
    .map((row) => row.entity_id);
  const tagIds = semanticHits
    .filter((row) => row.entity_type === "tag")
    .map((row) => row.entity_id);

  const itemsRows = itemIds.length
    ? (
        await db.execute<{
          id: string;
          name: string;
          subtitle: string;
        }>(sql`
          select
            i.id,
            i.name,
            coalesce((
              select concat_ws(' -> ', l.name, r.name, c.name)
              from ${schema.containerItems} ci
              inner join ${schema.containers} c on c.id = ci.container_id
              inner join ${schema.rooms} r on r.id = c.room_id
              inner join ${schema.locations} l on l.id = r.location_id
              where ci.item_id = i.id
              order by ci.updated_at desc
              limit 1
            ), '') as subtitle
          from ${schema.items} i
          where i.household_id = ${input.householdId}
            and i.id = any(${itemIds}::uuid[])
        `)
      ).rows
    : [];

  const containersRows = containerIds.length
    ? (
        await db.execute<{
          id: string;
          name: string;
          subtitle: string;
        }>(sql`
          select
            c.id,
            c.name,
            concat_ws(' -> ', l.name, r.name) as subtitle
          from ${schema.containers} c
          inner join ${schema.rooms} r on r.id = c.room_id
          inner join ${schema.locations} l on l.id = r.location_id
          where c.household_id = ${input.householdId}
            and c.id = any(${containerIds}::uuid[])
        `)
      ).rows
    : [];

  const roomsRows = roomIds.length
    ? (
        await db.execute<{
          id: string;
          name: string;
          subtitle: string;
        }>(sql`
          select
            r.id,
            r.name,
            l.name as subtitle
          from ${schema.rooms} r
          inner join ${schema.locations} l on l.id = r.location_id
          where r.household_id = ${input.householdId}
            and r.id = any(${roomIds}::uuid[])
        `)
      ).rows
    : [];

  const locationsRows = locationIds.length
    ? (
        await db.execute<{
          id: string;
          name: string;
          subtitle: string;
        }>(sql`
          select
            l.id,
            l.name,
            coalesce(l.description, '') as subtitle
          from ${schema.locations} l
          where l.household_id = ${input.householdId}
            and l.id = any(${locationIds}::uuid[])
        `)
      ).rows
    : [];

  const tagsRows = tagIds.length
    ? (
        await db.execute<{
          id: string;
          name: string;
        }>(sql`
          select
            t.id,
            t.name
          from ${schema.tags} t
          where t.household_id = ${input.householdId}
            and t.id = any(${tagIds}::uuid[])
        `)
      ).rows
    : [];

  const itemsMap = new Map(itemsRows.map((row) => [row.id, row]));
  const containersMap = new Map(containersRows.map((row) => [row.id, row]));
  const roomsMap = new Map(roomsRows.map((row) => [row.id, row]));
  const locationsMap = new Map(locationsRows.map((row) => [row.id, row]));
  const tagsMap = new Map(tagsRows.map((row) => [row.id, row]));

  const results: GlobalSearchResult[] = [];
  for (const hit of semanticHits) {
    if (hit.entity_type === "item") {
      const row = itemsMap.get(hit.entity_id);
      if (!row) continue;
      results.push({
        entityType: "item",
        entityId: row.id,
        title: row.name,
        subtitle: row.subtitle,
        href: `/items?item=${row.id}`,
        score: Number(hit.score ?? 0),
        matchSource: "semantic",
        matchFields: ["semantic"],
      });
      continue;
    }

    if (hit.entity_type === "container") {
      const row = containersMap.get(hit.entity_id);
      if (!row) continue;
      results.push({
        entityType: "container",
        entityId: row.id,
        title: row.name,
        subtitle: row.subtitle,
        href: `/boxes/${row.id}`,
        score: Number(hit.score ?? 0),
        matchSource: "semantic",
        matchFields: ["semantic"],
      });
      continue;
    }

    if (hit.entity_type === "room") {
      const row = roomsMap.get(hit.entity_id);
      if (!row) continue;
      results.push({
        entityType: "room",
        entityId: row.id,
        title: row.name,
        subtitle: row.subtitle,
        href: `/rooms/${row.id}`,
        score: Number(hit.score ?? 0),
        matchSource: "semantic",
        matchFields: ["semantic"],
      });
      continue;
    }

    if (hit.entity_type === "location") {
      const row = locationsMap.get(hit.entity_id);
      if (!row) continue;
      results.push({
        entityType: "location",
        entityId: row.id,
        title: row.name,
        subtitle: row.subtitle,
        href: `/locations/${row.id}`,
        score: Number(hit.score ?? 0),
        matchSource: "semantic",
        matchFields: ["semantic"],
      });
      continue;
    }

    const row = tagsMap.get(hit.entity_id);
    if (!row) continue;
    results.push({
      entityType: "tag",
      entityId: row.id,
      title: row.name,
      subtitle: "Tag",
      href: `/items?tag=${row.id}`,
      score: Number(hit.score ?? 0),
      matchSource: "semantic",
      matchFields: ["semantic"],
    });
  }

  return results;
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

  const exportRows = rows.rows as Array<{
    location_name: string;
    room_name: string;
    container_path: string;
    container_code: string | null;
    item_name: string | null;
    aliases: string | null;
    tags: string | null;
    quantity: number | null;
    note: string | null;
  }>;

  return exportRows.map((r) => ({
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

export async function listRecentContainers(
  input: Queryable & { roomId?: string; limit?: number },
) {
  await assertMembership(input);
  const limit = Math.min(50, Math.max(1, input.limit ?? 12));

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
        isNull(schema.containers.archivedAt),
        input.roomId ? eq(schema.containers.roomId, input.roomId) : undefined,
      ),
    )
    .orderBy(desc(schema.containers.updatedAt), schema.containers.name)
    .limit(limit);
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

export async function listContainersWithRoomLocation(
  input: Queryable & { includeArchived?: boolean; limit?: number },
) {
  await assertMembership(input);
  const limit = Math.min(5000, Math.max(1, input.limit ?? 2000));

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
        input.includeArchived ? undefined : isNull(schema.containers.archivedAt),
      ),
    )
    .orderBy(schema.locations.name, schema.rooms.name, schema.containers.name)
    .limit(limit);
}

export async function getHouseholdById(input: Queryable) {
  await assertMembership(input);
  return db.query.households.findFirst({
    where: eq(schema.households.id, input.householdId),
  });
}
