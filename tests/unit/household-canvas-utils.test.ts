import { describe, expect, it } from "vitest";

import {
  applyRoomMoveWithChildren,
  clampContainerRectToRoom,
  draftRectForMode,
  getNextZoomFromWheel,
  isRectInsideRoomShape,
  isPointInRoomShape,
  modeToShapeType,
  rotateContainerSetWithRoom,
  resolveZoomScroll,
  snapRectToGrid,
  snapRoomEdges,
  snapToGrid,
  triangleVerticesFromRect,
} from "@/lib/inventory/household-canvas-utils";

describe("household canvas utils", () => {
  it("normalizes draft rectangle for square mode", () => {
    const square = draftRectForMode({
      mode: "draw-square",
      start: { x: 4, y: 4 },
      end: { x: 7, y: 9 },
    });
    expect(square.width).toBe(5);
    expect(square.height).toBe(5);

    const rectangle = draftRectForMode({
      mode: "draw-rectangle",
      start: { x: 4, y: 4 },
      end: { x: 7, y: 9 },
    });
    expect(rectangle.width).toBe(3);
    expect(rectangle.height).toBe(5);
  });

  it("maps draw mode to room shape type", () => {
    expect(modeToShapeType("draw-rectangle")).toBe("rectangle");
    expect(modeToShapeType("draw-square")).toBe("square");
    expect(modeToShapeType("draw-triangle")).toBe("triangle");
  });

  it("supports triangle hit testing", () => {
    const room = {
      x: 0,
      y: 0,
      width: 6,
      height: 6,
      shapeType: "triangle" as const,
    };
    const [top, right, left] = triangleVerticesFromRect(room);

    expect(top).toEqual({ x: 3, y: 0 });
    expect(right).toEqual({ x: 6, y: 6 });
    expect(left).toEqual({ x: 0, y: 6 });

    expect(isPointInRoomShape({ x: 3, y: 3 }, room)).toBe(true);
    expect(isPointInRoomShape({ x: 0.2, y: 0.2 }, room)).toBe(false);
  });

  it("computes cursor-anchored zoom and scroll", () => {
    const zoomed = getNextZoomFromWheel({
      currentZoom: 1,
      deltaY: -100,
      ctrlKey: false,
    });
    expect(zoomed).toBeGreaterThan(1);

    const scroll = resolveZoomScroll({
      prevZoom: 1,
      nextZoom: 1.2,
      viewportX: 300,
      viewportY: 200,
      contentX: 800,
      contentY: 600,
    });
    expect(scroll.scrollLeft).toBeCloseTo(660);
    expect(scroll.scrollTop).toBeCloseTo(520);
  });

  it("moves child placements together with room drag", () => {
    const next = applyRoomMoveWithChildren({
      roomPlacement: {
        id: "room",
        x: 2,
        y: 2,
        width: 5,
        height: 5,
      },
      normalizedRoomPosition: { x: 4, y: 3 },
      childPlacements: [{ id: "child", startX: 3, startY: 3 }],
      placements: [
        { id: "room", x: 2, y: 2, width: 5, height: 5 },
        { id: "child", x: 3, y: 3, width: 2, height: 2 },
      ],
      canvasWidth: 30,
      canvasHeight: 20,
    });

    expect(next.find((entry) => entry.id === "room")).toMatchObject({ x: 4, y: 3 });
    expect(next.find((entry) => entry.id === "child")).toMatchObject({ x: 5, y: 4 });
  });

  it("snaps values and rects to grid", () => {
    expect(snapToGrid(1.24, 0.5)).toBe(1);
    expect(snapToGrid(1.26, 0.5)).toBe(1.5);
    expect(snapRectToGrid({ x: 1.26, y: 2.24, width: 2.26, height: 1.24 }, 0.5)).toEqual({
      x: 1.5,
      y: 2,
      width: 2.5,
      height: 1,
    });
  });

  it("snaps room edges when nearby", () => {
    const snapped = snapRoomEdges(
      { x: 5.74, y: 1, width: 3, height: 2 },
      [{ x: 2, y: 1, width: 4, height: 2 }],
      0.35,
    );
    expect(snapped.x).toBeCloseTo(6);
  });

  it("clamps container to room and keeps it inside", () => {
    const room = {
      x: 2,
      y: 2,
      width: 6,
      height: 4,
      shapeType: "rectangle" as const,
      rotation: 0,
    };
    const clamped = clampContainerRectToRoom(
      { x: 7.5, y: 5.5, width: 2, height: 2 },
      room,
    );
    expect(isRectInsideRoomShape(clamped, room)).toBe(true);
    expect(clamped.x).toBeCloseTo(6);
    expect(clamped.y).toBeCloseTo(4);
  });

  it("rotates room child containers around room center", () => {
    const next = rotateContainerSetWithRoom({
      roomBefore: { x: 0, y: 0, width: 10, height: 10, rotation: 0 },
      roomAfter: {
        x: 0,
        y: 0,
        width: 10,
        height: 10,
        rotation: 90,
        shapeType: "rectangle",
      },
      containers: [{ id: "c1", x: 6, y: 4, width: 2, height: 2, rotation: 0 }],
    });
    expect(next).toHaveLength(1);
    expect(next[0]?.rotation).toBeCloseTo(90);
    expect(next[0]?.x).toBeCloseTo(4);
    expect(next[0]?.y).toBeCloseTo(6);
  });
});
