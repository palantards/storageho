import { and, eq, isNull } from "drizzle-orm";

import { enqueueEmbeddingJob } from "@/lib/inventory/ai-jobs";
import { db, schema } from "@/server/db";
import { logActivity } from "@/lib/inventory/service";
import {
  type InventoryCsvRow,
  exportRowsToCsv,
  parseInventoryCsv,
  parsePipeList,
  type ImportDryRun,
} from "@/lib/inventory/csv-shared";

export { exportRowsToCsv, parseInventoryCsv };
export type { InventoryCsvRow, ImportDryRun };

export async function commitInventoryCsv(input: {
  userId: string;
  householdId: string;
  rows: InventoryCsvRow[];
}) {
  const locationCache = new Map<string, string>();
  const roomCache = new Map<string, string>();
  const containerCache = new Map<string, string>();
  const itemCache = new Map<string, string>();
  const tagCache = new Map<string, string>();
  const touchedLocations = new Set<string>();
  const touchedRooms = new Set<string>();
  const touchedContainers = new Set<string>();
  const touchedItems = new Set<string>();
  const touchedTags = new Set<string>();

  for (const row of input.rows) {
    let locationId = locationCache.get(row.location);
    if (!locationId) {
      const existing = await db.query.householdCanvasLayers.findFirst({
        where: and(
          eq(schema.householdCanvasLayers.householdId, input.householdId),
          eq(schema.householdCanvasLayers.name, row.location),
        ),
      });
      if (existing) {
        locationId = existing.id;
      } else {
        const floorId = crypto.randomUUID();
        const [created] = await db
          .insert(schema.householdCanvasLayers)
          .values({
            id: floorId,
            householdId: input.householdId,
            name: row.location,
            locationId: floorId,
            createdBy: input.userId,
          })
          .returning({ id: schema.householdCanvasLayers.id });
        locationId = created.id;
      }
      locationCache.set(row.location, locationId);
    }
    touchedLocations.add(locationId);

    const roomKey = `${locationId}::${row.room}`;
    let roomId = roomCache.get(roomKey);
    if (!roomId) {
      const existing = await db.query.rooms.findFirst({
        where: and(eq(schema.rooms.locationId, locationId), eq(schema.rooms.name, row.room)),
      });
      if (existing) {
        roomId = existing.id;
      } else {
        const [created] = await db
          .insert(schema.rooms)
          .values({
            householdId: input.householdId,
            locationId,
            name: row.room,
            createdBy: input.userId,
          })
          .returning({ id: schema.rooms.id });
        roomId = created.id;
      }
      roomCache.set(roomKey, roomId);
    }
    touchedRooms.add(roomId);

    const pathParts = row.containerPath
      .split("/")
      .map((part) => part.trim())
      .filter(Boolean);

    let parentContainerId: string | null = null;
    let currentContainerId = "";

    for (const [index, part] of pathParts.entries()) {
      const containerKey = `${roomId}::${parentContainerId ?? "root"}::${part}`;
      currentContainerId = containerCache.get(containerKey) || "";

      if (!currentContainerId) {
        const existing = await db.query.containers.findFirst({
          where: and(
            eq(schema.containers.householdId, input.householdId),
            eq(schema.containers.roomId, roomId),
            parentContainerId
              ? eq(schema.containers.parentContainerId, parentContainerId)
              : isNull(schema.containers.parentContainerId),
            eq(schema.containers.name, part),
          ),
        });

        if (existing) {
          currentContainerId = existing.id;
        } else {
          const [created] = await db
            .insert(schema.containers)
            .values({
              householdId: input.householdId,
              roomId,
              parentContainerId,
              name: part,
              code:
                index === pathParts.length - 1
                  ? row.containerCode || null
                  : null,
              createdBy: input.userId,
              qrDeepLink: "",
            })
            .returning({ id: schema.containers.id });

          currentContainerId = created.id;

          await db
            .update(schema.containers)
            .set({ qrDeepLink: `/app/boxes/${currentContainerId}` })
            .where(eq(schema.containers.id, currentContainerId));
        }

        containerCache.set(containerKey, currentContainerId);
      }

      parentContainerId = currentContainerId;
      touchedContainers.add(currentContainerId);
    }

    const itemKey = row.itemName.toLowerCase();
    let itemId = itemCache.get(itemKey);
    if (!itemId) {
      const existing = await db.query.items.findFirst({
        where: and(
          eq(schema.items.householdId, input.householdId),
          eq(schema.items.name, row.itemName),
        ),
      });

      if (existing) {
        itemId = existing.id;
      } else {
        const [created] = await db
          .insert(schema.items)
          .values({
            householdId: input.householdId,
            name: row.itemName,
            createdBy: input.userId,
          })
          .returning({ id: schema.items.id });
        itemId = created.id;
      }

      itemCache.set(itemKey, itemId);

      const aliases = parsePipeList(row.itemAliases);
      if (aliases.length) {
        for (const aliasText of aliases) {
          await db
            .insert(schema.itemAliases)
            .values({
              householdId: input.householdId,
              itemId,
              aliasText,
            })
            .onConflictDoNothing();
        }
      }
    }
    touchedItems.add(itemId);

    const tags = parsePipeList(row.tags);
    for (const tagName of tags) {
      const tagKey = tagName.toLowerCase();
      let tagId = tagCache.get(tagKey);

      if (!tagId) {
        const existing = await db.query.tags.findFirst({
          where: and(
            eq(schema.tags.householdId, input.householdId),
            eq(schema.tags.name, tagName),
          ),
        });

        if (existing) {
          tagId = existing.id;
        } else {
          const [created] = await db
            .insert(schema.tags)
            .values({
              householdId: input.householdId,
              name: tagName,
            })
            .returning({ id: schema.tags.id });
          tagId = created.id;
        }

        tagCache.set(tagKey, tagId);
      }
      touchedTags.add(tagId);

      await db
        .insert(schema.itemTags)
        .values({
          householdId: input.householdId,
          itemId,
          tagId,
        })
        .onConflictDoNothing();

      await db
        .insert(schema.containerTags)
        .values({
          householdId: input.householdId,
          containerId: currentContainerId,
          tagId,
        })
        .onConflictDoNothing();
    }

    await db
      .insert(schema.containerItems)
      .values({
        householdId: input.householdId,
        containerId: currentContainerId,
        itemId,
        quantity: row.quantity,
        note: row.note || null,
      })
      .onConflictDoUpdate({
        target: [schema.containerItems.containerId, schema.containerItems.itemId],
        set: {
          quantity: row.quantity,
          note: row.note || null,
          updatedAt: new Date(),
        },
      });
  }

  await logActivity({
    householdId: input.householdId,
    actorUserId: input.userId,
    actionType: "imported",
    entityType: "household",
    entityId: input.householdId,
    metadata: { rows: input.rows.length },
  });

  for (const locationId of touchedLocations) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "location",
      entityId: locationId,
    });
  }
  for (const roomId of touchedRooms) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "room",
      entityId: roomId,
    });
  }
  for (const containerId of touchedContainers) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "container",
      entityId: containerId,
    });
  }
  for (const itemId of touchedItems) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "item",
      entityId: itemId,
    });
  }
  for (const tagId of touchedTags) {
    await enqueueEmbeddingJob({
      householdId: input.householdId,
      entityType: "tag",
      entityId: tagId,
    });
  }

  return {
    importedRows: input.rows.length,
  };
}


