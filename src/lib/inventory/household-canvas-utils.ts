export type CanvasDrawMode =
  | "draw-rectangle"
  | "draw-square"
  | "draw-triangle"
  | "select"
  | "place-box";

export type ShapeType = "rectangle" | "square" | "triangle";

export type RectLike = {
  x: number;
  y: number;
  width: number;
  height: number;
};

export type RoomLike = RectLike & {
  shapeType: ShapeType;
  rotation?: number;
};

export type ZoomAnchorInput = {
  prevZoom: number;
  nextZoom: number;
  viewportX: number;
  viewportY: number;
  contentX: number;
  contentY: number;
};

export type ZoomScrollResult = {
  scrollLeft: number;
  scrollTop: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function snapToGrid(value: number, step = 0.5) {
  if (step <= 0) return value;
  return Math.round(value / step) * step;
}

export function snapRectToGrid<T extends RectLike>(rect: T, step = 0.5): T {
  return {
    ...rect,
    x: snapToGrid(rect.x, step),
    y: snapToGrid(rect.y, step),
    width: Math.max(step, snapToGrid(rect.width, step)),
    height: Math.max(step, snapToGrid(rect.height, step)),
  };
}

type RectEdges = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

function getRectEdges(rect: RectLike): RectEdges {
  return {
    left: rect.x,
    right: rect.x + rect.width,
    top: rect.y,
    bottom: rect.y + rect.height,
  };
}

function rotateAroundOrigin(point: { x: number; y: number }, angleDeg: number) {
  const radians = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

export function rotatePointAroundCenter(
  point: { x: number; y: number },
  center: { x: number; y: number },
  angleDeg: number,
) {
  const relative = { x: point.x - center.x, y: point.y - center.y };
  const rotated = rotateAroundOrigin(relative, angleDeg);
  return {
    x: rotated.x + center.x,
    y: rotated.y + center.y,
  };
}

function roomCenter(room: RectLike) {
  return { x: room.x + room.width / 2, y: room.y + room.height / 2 };
}

function pointToRoomLocal(point: { x: number; y: number }, room: RoomLike) {
  const center = roomCenter(room);
  return rotatePointAroundCenter(point, center, -(room.rotation ?? 0));
}

export function normalizePlacementRect(input: {
  x: number;
  y: number;
  width: number;
  height: number;
  canvasWidth: number;
  canvasHeight: number;
}) {
  const normalizedWidth = clamp(input.width, 0.5, Math.max(0.5, input.canvasWidth));
  const normalizedHeight = clamp(input.height, 0.5, Math.max(0.5, input.canvasHeight));
  const normalizedX = clamp(input.x, 0, Math.max(0, input.canvasWidth - normalizedWidth));
  const normalizedY = clamp(input.y, 0, Math.max(0, input.canvasHeight - normalizedHeight));
  return {
    x: normalizedX,
    y: normalizedY,
    width: normalizedWidth,
    height: normalizedHeight,
  };
}

export function draftRectForMode(input: {
  mode: CanvasDrawMode;
  start: { x: number; y: number };
  end: { x: number; y: number };
}) {
  const dx = input.end.x - input.start.x;
  const dy = input.end.y - input.start.y;
  const baseRect = {
    x: Math.min(input.start.x, input.end.x),
    y: Math.min(input.start.y, input.end.y),
    width: Math.abs(dx),
    height: Math.abs(dy),
  };

  if (input.mode !== "draw-square") {
    return baseRect;
  }

  const side = Math.max(Math.abs(dx), Math.abs(dy));
  const signedDx = dx < 0 ? -side : side;
  const signedDy = dy < 0 ? -side : side;

  return {
    x: Math.min(input.start.x, input.start.x + signedDx),
    y: Math.min(input.start.y, input.start.y + signedDy),
    width: Math.abs(signedDx),
    height: Math.abs(signedDy),
  };
}

export function modeToShapeType(mode: CanvasDrawMode): ShapeType {
  switch (mode) {
    case "draw-square":
      return "square";
    case "draw-triangle":
      return "triangle";
    default:
      return "rectangle";
  }
}

export function triangleVerticesFromRect(rect: RectLike) {
  return [
    { x: rect.x + rect.width / 2, y: rect.y },
    { x: rect.x + rect.width, y: rect.y + rect.height },
    { x: rect.x, y: rect.y + rect.height },
  ];
}

export function isPointInTriangle(
  point: { x: number; y: number },
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
) {
  const denominator = (b.y - c.y) * (a.x - c.x) + (c.x - b.x) * (a.y - c.y);
  if (Math.abs(denominator) < 1e-9) return false;

  const alpha =
    ((b.y - c.y) * (point.x - c.x) + (c.x - b.x) * (point.y - c.y)) / denominator;
  const beta =
    ((c.y - a.y) * (point.x - c.x) + (a.x - c.x) * (point.y - c.y)) / denominator;
  const gamma = 1 - alpha - beta;

  return alpha >= 0 && beta >= 0 && gamma >= 0;
}

export function isPointInRoomShape(point: { x: number; y: number }, room: RoomLike) {
  const localPoint = pointToRoomLocal(point, room);
  if (room.shapeType === "triangle") {
    const [a, b, c] = triangleVerticesFromRect(room);
    return isPointInTriangle(localPoint, a, b, c);
  }

  return (
    localPoint.x >= room.x &&
    localPoint.y >= room.y &&
    localPoint.x <= room.x + room.width &&
    localPoint.y <= room.y + room.height
  );
}

export function isRectInsideRoomShape(rect: RectLike, room: RoomLike) {
  const corners = [
    { x: rect.x, y: rect.y },
    { x: rect.x + rect.width, y: rect.y },
    { x: rect.x, y: rect.y + rect.height },
    { x: rect.x + rect.width, y: rect.y + rect.height },
  ];
  return corners.every((corner) => isPointInRoomShape(corner, room));
}

function nearestRoomCandidateForTriangle(
  rect: RectLike,
  room: RoomLike,
  step = 0.25,
): RectLike | null {
  const maxX = room.x + room.width - rect.width;
  const maxY = room.y + room.height - rect.height;
  if (maxX < room.x || maxY < room.y) {
    return null;
  }

  let best: RectLike | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let x = room.x; x <= maxX + 1e-9; x += step) {
    for (let y = room.y; y <= maxY + 1e-9; y += step) {
      const candidate = { ...rect, x, y };
      if (!isRectInsideRoomShape(candidate, room)) continue;
      const distanceToTarget = Math.hypot(rect.x - x, rect.y - y);
      if (distanceToTarget < bestDistance) {
        best = candidate;
        bestDistance = distanceToTarget;
      }
    }
  }
  return best;
}

export function clampContainerRectToRoom(rect: RectLike, room: RoomLike): RectLike {
  const localRoom = { ...room, rotation: 0 };
  const center = roomCenter(room);
  const desiredCenterLocal = rotatePointAroundCenter(
    {
      x: rect.x + rect.width / 2,
      y: rect.y + rect.height / 2,
    },
    center,
    -(room.rotation ?? 0),
  );
  const localRect = {
    ...rect,
    x: desiredCenterLocal.x - rect.width / 2,
    y: desiredCenterLocal.y - rect.height / 2,
  };

  let clampedLocal: RectLike;
  if (room.shapeType === "triangle") {
    const bounded = {
      ...localRect,
      x: clamp(localRect.x, room.x, room.x + room.width - localRect.width),
      y: clamp(localRect.y, room.y, room.y + room.height - localRect.height),
    };
    if (isRectInsideRoomShape(bounded, localRoom)) {
      clampedLocal = bounded;
    } else {
      const nearest = nearestRoomCandidateForTriangle(bounded, localRoom);
      clampedLocal = nearest ?? bounded;
    }
  } else {
    clampedLocal = {
      ...localRect,
      x: clamp(localRect.x, room.x, room.x + room.width - localRect.width),
      y: clamp(localRect.y, room.y, room.y + room.height - localRect.height),
    };
  }

  const localCenter = {
    x: clampedLocal.x + clampedLocal.width / 2,
    y: clampedLocal.y + clampedLocal.height / 2,
  };
  const rotatedCenter = rotatePointAroundCenter(localCenter, center, room.rotation ?? 0);
  return {
    ...rect,
    x: rotatedCenter.x - rect.width / 2,
    y: rotatedCenter.y - rect.height / 2,
  };
}

export function snapRoomEdges(
  rect: RectLike,
  otherRooms: RectLike[],
  tolerance = 0.35,
): RectLike {
  if (otherRooms.length === 0) return rect;

  const ownEdges = getRectEdges(rect);

  let bestDx = 0;
  let bestDy = 0;
  let bestAbsDx = Number.POSITIVE_INFINITY;
  let bestAbsDy = Number.POSITIVE_INFINITY;

  for (const other of otherRooms) {
    const otherEdges = getRectEdges(other);
    const xCandidates = [
      otherEdges.left - ownEdges.left,
      otherEdges.right - ownEdges.left,
      otherEdges.left - ownEdges.right,
      otherEdges.right - ownEdges.right,
    ];
    for (const candidate of xCandidates) {
      const abs = Math.abs(candidate);
      if (abs <= tolerance && abs < bestAbsDx) {
        bestAbsDx = abs;
        bestDx = candidate;
      }
    }

    const yCandidates = [
      otherEdges.top - ownEdges.top,
      otherEdges.bottom - ownEdges.top,
      otherEdges.top - ownEdges.bottom,
      otherEdges.bottom - ownEdges.bottom,
    ];
    for (const candidate of yCandidates) {
      const abs = Math.abs(candidate);
      if (abs <= tolerance && abs < bestAbsDy) {
        bestAbsDy = abs;
        bestDy = candidate;
      }
    }
  }

  return {
    ...rect,
    x: rect.x + bestDx,
    y: rect.y + bestDy,
  };
}

export function rotateContainerSetWithRoom<
  TContainer extends RectLike & { id: string; rotation?: number },
>(input: {
  roomBefore: RectLike & { rotation?: number };
  roomAfter: RectLike & { rotation?: number; shapeType: ShapeType };
  containers: TContainer[];
}) {
  const roomBeforeCenter = roomCenter(input.roomBefore);
  const roomAfterCenter = roomCenter(input.roomAfter);
  const deltaRotation = (input.roomAfter.rotation ?? 0) - (input.roomBefore.rotation ?? 0);

  return input.containers.map((container) => {
    const containerCenter = {
      x: container.x + container.width / 2,
      y: container.y + container.height / 2,
    };
    const relativeToRoomBefore = {
      x: containerCenter.x - roomBeforeCenter.x,
      y: containerCenter.y - roomBeforeCenter.y,
    };
    const rotatedRelative = rotateAroundOrigin(relativeToRoomBefore, deltaRotation);
    const nextCenter = {
      x: roomAfterCenter.x + rotatedRelative.x,
      y: roomAfterCenter.y + rotatedRelative.y,
    };

    const raw = {
      ...container,
      x: nextCenter.x - container.width / 2,
      y: nextCenter.y - container.height / 2,
      rotation: (container.rotation ?? 0) + deltaRotation,
    };

    const clamped = clampContainerRectToRoom(raw, input.roomAfter);
    return {
      ...raw,
      x: clamped.x,
      y: clamped.y,
    };
  });
}

export function getNextZoomFromWheel(input: {
  currentZoom: number;
  deltaY: number;
  ctrlKey: boolean;
  minZoom?: number;
  maxZoom?: number;
}) {
  const minZoom = input.minZoom ?? 0.6;
  const maxZoom = input.maxZoom ?? 2.4;
  const intensity = input.ctrlKey ? 0.004 : 0.0018;
  const nextZoom = input.currentZoom * Math.exp(-input.deltaY * intensity);
  return clamp(nextZoom, minZoom, maxZoom);
}

export function resolveZoomScroll(input: ZoomAnchorInput): ZoomScrollResult {
  if (Math.abs(input.prevZoom - input.nextZoom) < 1e-6) {
    return {
      scrollLeft: input.contentX - input.viewportX,
      scrollTop: input.contentY - input.viewportY,
    };
  }
  const scale = input.nextZoom / input.prevZoom;
  return {
    scrollLeft: input.contentX * scale - input.viewportX,
    scrollTop: input.contentY * scale - input.viewportY,
  };
}

export type PlacementWithId = {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
};

export function applyRoomMoveWithChildren<TPlacement extends PlacementWithId>(input: {
  roomPlacement: PlacementWithId;
  normalizedRoomPosition: { x: number; y: number };
  childPlacements: Array<{ id: string; startX: number; startY: number }>;
  placements: TPlacement[];
  canvasWidth: number;
  canvasHeight: number;
}): TPlacement[] {
  const dx = input.normalizedRoomPosition.x - input.roomPlacement.x;
  const dy = input.normalizedRoomPosition.y - input.roomPlacement.y;
  const childStartMap = new Map(input.childPlacements.map((entry) => [entry.id, entry]));

  return input.placements.map((entry) => {
    if (entry.id === input.roomPlacement.id) {
      return {
        ...entry,
        x: input.normalizedRoomPosition.x,
        y: input.normalizedRoomPosition.y,
      };
    }
    const child = childStartMap.get(entry.id);
    if (!child) return entry;
    const normalized = normalizePlacementRect({
      x: child.startX + dx,
      y: child.startY + dy,
      width: entry.width,
      height: entry.height,
      canvasWidth: input.canvasWidth,
      canvasHeight: input.canvasHeight,
    });
    return { ...entry, x: normalized.x, y: normalized.y };
  });
}
