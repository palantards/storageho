import { describe, expect, it } from "vitest";

import {
  buildReadOnlyMapGroups,
  canSelectSetupMapRoom,
} from "@/lib/inventory/household-setup-map";

describe("household setup read-only map grouping", () => {
  it("sorts non-system rooms first and keeps deterministic container order", () => {
    const groups = buildReadOnlyMapGroups({
      locationId: "loc-1",
      rooms: [
        { id: "room-z", name: "Zulu", locationId: "loc-1", isSystem: false },
        { id: "room-a", name: "Alpha", locationId: "loc-1", isSystem: false },
        { id: "room-u", name: "Unassigned", locationId: "loc-1", isSystem: true },
      ],
      containers: [
        { id: "c2", name: "Box B", code: null, roomId: "room-a", locationId: "loc-1" },
        { id: "c1", name: "Box A", code: null, roomId: "room-a", locationId: "loc-1" },
        { id: "c9", name: "Loose", code: null, roomId: "room-u", locationId: "loc-1" },
      ],
    });

    expect(groups.map((group) => group.roomName)).toEqual(["Alpha", "Zulu", "Unassigned"]);
    expect(groups[0]?.containers.map((container) => container.name)).toEqual(["Box A", "Box B"]);
  });

  it("creates fallback unassigned group when container room mapping is missing", () => {
    const groups = buildReadOnlyMapGroups({
      locationId: "loc-1",
      rooms: [{ id: "room-a", name: "Room A", locationId: "loc-1", isSystem: false }],
      containers: [
        { id: "c1", name: "Mapped", code: null, roomId: "room-a", locationId: "loc-1" },
        { id: "c2", name: "Orphan", code: null, roomId: "missing", locationId: "loc-1" },
      ],
      unassignedLabel: "Unassigned",
    });

    const fallback = groups.find((group) => group.roomId === "__unassigned__");
    expect(fallback).toBeTruthy();
    expect(fallback?.containers.map((container) => container.name)).toEqual(["Orphan"]);
  });

  it("marks synthetic fallback group as non-selectable", () => {
    expect(canSelectSetupMapRoom("__unassigned__")).toBe(false);
    expect(canSelectSetupMapRoom("room-real")).toBe(true);
  });
});
