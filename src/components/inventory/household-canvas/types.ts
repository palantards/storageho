export type LayoutState = { width: number; height: number };

export type Layer = {
  id: string;
  name: string;
  locationId: string | null;
  sortOrder: number;
};

export type Placement = {
  id: string;
  layerId: string;
  entityType: "room" | "container";
  entityId: string;
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
  shapeType: "rectangle" | "square" | "triangle";
  label: string | null;
};

export type LocationOption = { id: string; name: string };

export type RoomOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
};

export type ContainerOption = {
  id: string;
  name: string;
  code: string | null;
  roomId: string;
  roomName: string;
  locationId: string;
  locationName: string;
};
