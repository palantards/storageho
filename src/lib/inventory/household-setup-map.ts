export type SetupMapRoom = {
  id: string;
  name: string;
  locationId: string;
  isSystem: boolean;
};

export type SetupMapContainer = {
  id: string;
  name: string;
  code: string | null;
  roomId: string;
  locationId: string;
};

export type SetupMapGroup = {
  roomId: string;
  roomName: string;
  isSystem: boolean;
  containers: SetupMapContainer[];
};

function compareByNameAndId<T extends { id: string; name: string }>(a: T, b: T) {
  const nameDiff = a.name.localeCompare(b.name, undefined, { sensitivity: "base" });
  if (nameDiff !== 0) return nameDiff;
  return a.id.localeCompare(b.id);
}

export function buildReadOnlyMapGroups(input: {
  locationId: string;
  rooms: SetupMapRoom[];
  containers: SetupMapContainer[];
  unassignedLabel?: string;
}) {
  const unassignedLabel = input.unassignedLabel || "Unassigned";
  const floorRooms = input.rooms
    .filter((room) => room.locationId === input.locationId)
    .sort((left, right) => {
      if (left.isSystem !== right.isSystem) {
        return left.isSystem ? 1 : -1;
      }
      return compareByNameAndId(left, right);
    });

  const roomById = new Map(floorRooms.map((room) => [room.id, room]));
  const containers = input.containers
    .filter((container) => container.locationId === input.locationId)
    .sort(compareByNameAndId);

  const groups = new Map<string, SetupMapGroup>();
  for (const room of floorRooms) {
    groups.set(room.id, {
      roomId: room.id,
      roomName: room.name,
      isSystem: room.isSystem,
      containers: [],
    });
  }

  let fallbackGroup: SetupMapGroup | null = null;
  for (const container of containers) {
    const room = roomById.get(container.roomId);
    if (room) {
      groups.get(room.id)?.containers.push(container);
      continue;
    }

    if (!fallbackGroup) {
      fallbackGroup = {
        roomId: "__unassigned__",
        roomName: unassignedLabel,
        isSystem: true,
        containers: [],
      };
    }
    fallbackGroup.containers.push(container);
  }

  const output = Array.from(groups.values()).filter(
    (group) => group.containers.length > 0 || !group.isSystem,
  );
  if (fallbackGroup) {
    output.push(fallbackGroup);
  }
  return output;
}

