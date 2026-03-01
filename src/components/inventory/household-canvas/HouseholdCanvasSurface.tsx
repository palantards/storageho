"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type MutableRefObject,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from "react";

import type { CanvasMode } from "@/components/inventory/household-canvas/HouseholdCanvasToolbar";
import type { Placement } from "@/components/inventory/household-canvas/types";
import {
  clamp,
  draftRectForMode,
  getNextZoomFromWheel,
  isPointInRoomShape,
  modeToShapeType,
  resolveZoomScroll,
} from "@/lib/inventory/household-canvas-utils";

const UNIT_PX = 36;
const MIN_ZOOM = 0.6;
const MAX_ZOOM = 2.4;

type ResizeCorner = "nw" | "ne" | "sw" | "se";
type ZoomAnchor = {
  prevZoom: number;
  viewportX: number;
  viewportY: number;
  contentX: number;
  contentY: number;
};

type TouchPoint = { x: number; y: number };

function distance(a: TouchPoint, b: TouchPoint) {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

export function HouseholdCanvasSurface({
  canvasRef,
  canvasWidth,
  canvasHeight,
  zoom,
  mode,
  placements,
  selectedPlacementId,
  hasActiveLayer,
  labelFor,
  modeLabel,
  onPointerDown,
  onResizePointerDown,
  onRotatePointerDown,
  onSelectPlacement,
  onMapTap,
  onRoomDrawComplete,
  onZoomChange,
  onDeletePlacementEntity,
}: {
  canvasRef: MutableRefObject<HTMLDivElement | null>;
  canvasWidth: number;
  canvasHeight: number;
  zoom: number;
  mode: CanvasMode;
  placements: Placement[];
  selectedPlacementId: string | null;
  hasActiveLayer: boolean;
  labelFor: (placement: Placement) => string;
  modeLabel: string;
  onPointerDown: (
    placement: Placement,
    event: ReactPointerEvent<HTMLButtonElement>,
  ) => void;
  onResizePointerDown: (
    placement: Placement,
    corner: ResizeCorner,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onRotatePointerDown?: (
    placement: Placement,
    event: ReactPointerEvent<HTMLDivElement>,
  ) => void;
  onSelectPlacement: (placementId: string | null) => void;
  onMapTap?: (payload: {
    x: number;
    y: number;
    roomId: string | null;
    clientX: number;
    clientY: number;
  }) => void;
  onRoomDrawComplete?: (payload: {
    x: number;
    y: number;
    width: number;
    height: number;
    shapeType: "rectangle" | "square" | "triangle";
  }) => void;
  onZoomChange: (nextZoom: number) => void;
  onDeletePlacementEntity?: (placement: Placement) => void;
}) {
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const zoomAnchorRef = useRef<ZoomAnchor | null>(null);
  const pinchDistanceRef = useRef<number | null>(null);
  const pinchActiveRef = useRef(false);
  const touchesRef = useRef<Map<number, TouchPoint>>(new Map());
  const drawRef = useRef<{
    pointerId: number;
    start: { x: number; y: number };
  } | null>(null);
  const touchPanRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const panRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    startScrollLeft: number;
    startScrollTop: number;
  } | null>(null);
  const [draftStart, setDraftStart] = useState<{ x: number; y: number } | null>(null);
  const [draftCurrent, setDraftCurrent] = useState<{ x: number; y: number } | null>(null);

  const baseWidthPx = canvasWidth * UNIT_PX;
  const baseHeightPx = canvasHeight * UNIT_PX;
  const widthPx = baseWidthPx * zoom;
  const heightPx = baseHeightPx * zoom;

  const toCanvasUnits = useCallback(
    (clientX: number, clientY: number) => {
      if (!canvasRef.current) return null;
      const rect = canvasRef.current.getBoundingClientRect();
      const x = ((clientX - rect.left) / rect.width) * canvasWidth;
      const y = ((clientY - rect.top) / rect.height) * canvasHeight;
      return {
        x: Math.max(0, Math.min(canvasWidth, x)),
        y: Math.max(0, Math.min(canvasHeight, y)),
      };
    },
    [canvasRef, canvasWidth, canvasHeight],
  );

  const draftRect =
    mode.startsWith("draw-") && draftStart && draftCurrent
      ? draftRectForMode({
          mode,
          start: draftStart,
          end: draftCurrent,
        })
      : null;

  useEffect(() => {
    if (!scrollRef.current || !zoomAnchorRef.current) return;
    const anchor = zoomAnchorRef.current;
    if (Math.abs(anchor.prevZoom - zoom) < 1e-6) return;

    const nextScroll = resolveZoomScroll({
      prevZoom: anchor.prevZoom,
      nextZoom: zoom,
      viewportX: anchor.viewportX,
      viewportY: anchor.viewportY,
      contentX: anchor.contentX,
      contentY: anchor.contentY,
    });
    scrollRef.current.scrollLeft = nextScroll.scrollLeft;
    scrollRef.current.scrollTop = nextScroll.scrollTop;
    zoomAnchorRef.current = null;
  }, [zoom]);

  function queueZoomFromViewportPoint(input: {
    nextZoom: number;
    clientX: number;
    clientY: number;
  }) {
    if (!scrollRef.current) return;
    const clamped = clamp(input.nextZoom, MIN_ZOOM, MAX_ZOOM);
    if (Math.abs(clamped - zoom) < 1e-6) return;

    const rect = scrollRef.current.getBoundingClientRect();
    const viewportX = input.clientX - rect.left;
    const viewportY = input.clientY - rect.top;
    zoomAnchorRef.current = {
      prevZoom: zoom,
      viewportX,
      viewportY,
      contentX: viewportX + scrollRef.current.scrollLeft,
      contentY: viewportY + scrollRef.current.scrollTop,
    };
    onZoomChange(clamped);
  }

  function roomIdAtPoint(point: { x: number; y: number }) {
    const rooms = placements.filter((placement) => placement.entityType === "room");
    for (let index = rooms.length - 1; index >= 0; index -= 1) {
      const room = rooms[index];
      if (isPointInRoomShape(point, room)) {
        return room.entityId;
      }
    }
    return null;
  }

  function handleWheel(event: ReactWheelEvent<HTMLDivElement>) {
    if (!hasActiveLayer) return;
    event.preventDefault();
    const nextZoom = getNextZoomFromWheel({
      currentZoom: zoom,
      deltaY: event.deltaY,
      ctrlKey: event.ctrlKey,
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
    });
    queueZoomFromViewportPoint({
      nextZoom,
      clientX: event.clientX,
      clientY: event.clientY,
    });
  }

  function startPan(pointerId: number, clientX: number, clientY: number) {
    if (!scrollRef.current) return;
    panRef.current = {
      pointerId,
      startX: clientX,
      startY: clientY,
      startScrollLeft: scrollRef.current.scrollLeft,
      startScrollTop: scrollRef.current.scrollTop,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!scrollRef.current || !panRef.current) return;
      if (panRef.current.pointerId !== moveEvent.pointerId) return;
      moveEvent.preventDefault();
      scrollRef.current.scrollLeft =
        panRef.current.startScrollLeft - (moveEvent.clientX - panRef.current.startX);
      scrollRef.current.scrollTop =
        panRef.current.startScrollTop - (moveEvent.clientY - panRef.current.startY);
    };

    const onUp = (upEvent: PointerEvent) => {
      if (panRef.current?.pointerId !== upEvent.pointerId) return;
      panRef.current = null;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
    };

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
  }

  return (
    <div className="space-y-2">
      <div className="text-xs text-muted-foreground">Current mode: {modeLabel}</div>
      <div
        ref={scrollRef}
        data-testid="household-canvas-viewport"
        className="h-[76vh] min-h-[500px] overflow-auto rounded-md border bg-muted/20 p-2"
        onWheel={handleWheel}
        style={{ touchAction: "none", overscrollBehavior: "contain" }}
        onPointerDown={(event) => {
          if (!scrollRef.current) return;

          if (event.pointerType === "touch") {
            touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (touchesRef.current.size === 1) {
              touchPanRef.current = {
                pointerId: event.pointerId,
                startX: event.clientX,
                startY: event.clientY,
                startScrollLeft: scrollRef.current.scrollLeft,
                startScrollTop: scrollRef.current.scrollTop,
              };
            } else if (touchesRef.current.size === 2) {
              const [first, second] = Array.from(touchesRef.current.values());
              pinchDistanceRef.current = distance(first, second);
              pinchActiveRef.current = true;
              touchPanRef.current = null;
            }
            return;
          }

          const forcePan = event.button === 1 || event.altKey;
          if ((mode === "select" || forcePan) && event.target === event.currentTarget) {
            startPan(event.pointerId, event.clientX, event.clientY);
          }
        }}
        onPointerMove={(event) => {
          if (!scrollRef.current) return;

          if (event.pointerType === "touch" && touchesRef.current.has(event.pointerId)) {
            touchesRef.current.set(event.pointerId, { x: event.clientX, y: event.clientY });
            if (pinchActiveRef.current && touchesRef.current.size >= 2) {
              const [first, second] = Array.from(touchesRef.current.values());
              const currentDistance = distance(first, second);
              const previousDistance = pinchDistanceRef.current;
              if (!previousDistance || previousDistance <= 0) {
                pinchDistanceRef.current = currentDistance;
                return;
              }

              const centerX = (first.x + second.x) / 2;
              const centerY = (first.y + second.y) / 2;
              const nextZoom = zoom * (currentDistance / previousDistance);
              queueZoomFromViewportPoint({
                nextZoom,
                clientX: centerX,
                clientY: centerY,
              });
              pinchDistanceRef.current = currentDistance;
              return;
            }

            if (touchPanRef.current && touchPanRef.current.pointerId === event.pointerId) {
              event.preventDefault();
              scrollRef.current.scrollLeft =
                touchPanRef.current.startScrollLeft -
                (event.clientX - touchPanRef.current.startX);
              scrollRef.current.scrollTop =
                touchPanRef.current.startScrollTop -
                (event.clientY - touchPanRef.current.startY);
            }
            return;
          }
        }}
        onPointerUp={(event) => {
          if (event.pointerType === "touch") {
            touchesRef.current.delete(event.pointerId);
            if (touchesRef.current.size < 2) {
              pinchDistanceRef.current = null;
              pinchActiveRef.current = false;
            }
            if (touchPanRef.current?.pointerId === event.pointerId) {
              touchPanRef.current = null;
            }
          }
        }}
        onPointerCancel={(event) => {
          touchesRef.current.delete(event.pointerId);
          if (touchesRef.current.size < 2) {
            pinchDistanceRef.current = null;
            pinchActiveRef.current = false;
          }
          if (touchPanRef.current?.pointerId === event.pointerId) {
            touchPanRef.current = null;
          }
        }}
      >
        <div
          ref={canvasRef}
          data-testid="household-canvas-grid"
          className="relative rounded-md border bg-muted/30"
          style={{
            width: `${widthPx}px`,
            height: `${heightPx}px`,
            backgroundImage:
              "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
            backgroundSize: `${UNIT_PX * zoom}px ${UNIT_PX * zoom}px`,
            touchAction: "none",
          }}
          onPointerDown={(event) => {
            const forcePan = event.button === 1 || event.altKey;
            if ((mode === "select" || forcePan) && event.target === event.currentTarget) {
              onSelectPlacement(null);
              startPan(event.pointerId, event.clientX, event.clientY);
              return;
            }

            if (event.button !== 0) return;
            if (event.target === event.currentTarget) {
              onSelectPlacement(null);
            }
            if (!hasActiveLayer || !mode.startsWith("draw-")) return;
            if (drawRef.current) return;
            const point = toCanvasUnits(event.clientX, event.clientY);
            if (!point) return;
            const startPoint = point;
            drawRef.current = {
              pointerId: event.pointerId,
              start: startPoint,
            };
            setDraftStart(startPoint);
            setDraftCurrent(startPoint);

            const onMove = (moveEvent: PointerEvent) => {
              if (drawRef.current?.pointerId !== moveEvent.pointerId) return;
              const next = toCanvasUnits(moveEvent.clientX, moveEvent.clientY);
              if (!next) return;
              setDraftCurrent(next);
            };

            const finalize = (upEvent: PointerEvent) => {
              if (drawRef.current?.pointerId !== upEvent.pointerId) return;
              window.removeEventListener("pointermove", onMove);
              window.removeEventListener("pointerup", finalize);
              window.removeEventListener("pointercancel", finalize);
              drawRef.current = null;
              const end = toCanvasUnits(upEvent.clientX, upEvent.clientY);
              if (!end) {
                setDraftStart(null);
                setDraftCurrent(null);
                return;
              }

              const rect = draftRectForMode({
                mode,
                start: startPoint,
                end,
              });
              const minSize = 0.8;
              if (rect.width < minSize || rect.height < minSize) {
                setDraftStart(null);
                setDraftCurrent(null);
                return;
              }

              onRoomDrawComplete?.({
                ...rect,
                shapeType: modeToShapeType(mode),
              });
              setDraftStart(null);
              setDraftCurrent(null);
            };

            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", finalize);
            window.addEventListener("pointercancel", finalize);
          }}
          onClick={(event) => {
            if (!hasActiveLayer || mode !== "place-box") return;
            const point = toCanvasUnits(event.clientX, event.clientY);
            if (!point) return;
            onMapTap?.({
              x: point.x,
              y: point.y,
              roomId: roomIdAtPoint(point),
              clientX: event.clientX,
              clientY: event.clientY,
            });
          }}
        >
          {placements.map((placement) => {
            const left = (placement.x / canvasWidth) * widthPx;
            const top = (placement.y / canvasHeight) * heightPx;
            const boxWidth = (placement.width / canvasWidth) * widthPx;
            const boxHeight = (placement.height / canvasHeight) * heightPx;
            const isSelected = selectedPlacementId === placement.id;
            const isTriangleRoom =
              placement.entityType === "room" && placement.shapeType === "triangle";

            return (
              <div
                key={placement.id}
                className="absolute"
                style={{
                  left: `${left}px`,
                  top: `${top}px`,
                  width: `${Math.max(boxWidth, 18)}px`,
                  height: `${Math.max(boxHeight, 18)}px`,
                  transform: `rotate(${placement.rotation}deg)`,
                  transformOrigin: "center center",
                }}
              >
                <button
                  type="button"
                  className={`relative h-full w-full rounded-sm border px-2 py-1 text-left text-xs shadow-sm ${
                    placement.entityType === "room"
                      ? "border-slate-600/70 bg-slate-200/60 text-slate-900"
                      : "border-teal-700/70 bg-teal-200/65 text-teal-950"
                  } ${isSelected ? "ring-2 ring-primary ring-offset-1" : "hover:border-primary/50"}`}
                  style={{
                    clipPath: isTriangleRoom
                      ? "polygon(50% 0%, 100% 100%, 0% 100%)"
                      : undefined,
                  }}
                  onPointerDown={(event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    event.stopPropagation();
                    onSelectPlacement(placement.id);
                    if (mode === "select") {
                      onPointerDown(placement, event);
                    }
                  }}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSelectPlacement(placement.id);
                  }}
                >
                  <div className="truncate font-medium">{labelFor(placement)}</div>
                  <div className="truncate opacity-70">
                    {placement.entityType}{" "}
                    {placement.entityType === "room" ? `(${placement.shapeType})` : null}
                  </div>
                </button>

                {isSelected && mode === "select" ? (
                  <>
                    {placement.entityType === "room" ? (
                      <div
                        className="absolute left-1/2 z-20 h-5 w-5 -translate-x-1/2 rounded-full border border-primary bg-background"
                        style={{ top: "-26px", cursor: "grab" }}
                        title="Rotate room (hold Shift for free rotation)"
                        onPointerDown={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          onRotatePointerDown?.(placement, event);
                        }}
                      />
                    ) : null}

                    <button
                      type="button"
                      aria-label={`Delete ${placement.entityType}`}
                      className="absolute left-1/2 z-20 grid h-5 w-5 -translate-x-1/2 place-items-center rounded-full border bg-background text-xs text-destructive shadow-sm"
                      style={{ top: "-10px" }}
                      onPointerDown={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onClick={(event) => {
                        event.preventDefault();
                        event.stopPropagation();
                        onSelectPlacement(placement.id);
                        onDeletePlacementEntity?.(placement);
                      }}
                    >
                      X
                    </button>

                    {(["nw", "ne", "sw", "se"] as ResizeCorner[]).map((corner) => {
                      const isNorth = corner.includes("n");
                      const isWest = corner.includes("w");
                      return (
                        <div
                          key={`${placement.id}-${corner}`}
                          className="absolute z-20 h-3 w-3 rounded-full border border-primary bg-background"
                          style={{
                            top: isNorth ? "-6px" : "calc(100% - 6px)",
                            left: isWest ? "-6px" : "calc(100% - 6px)",
                            cursor:
                              corner === "nw" || corner === "se"
                                ? "nwse-resize"
                                : "nesw-resize",
                          }}
                          onPointerDown={(event) => {
                            event.preventDefault();
                            event.stopPropagation();
                            onResizePointerDown(placement, corner, event);
                          }}
                        />
                      );
                    })}
                  </>
                ) : null}
              </div>
            );
          })}

          {draftRect ? (
            <div
              className="absolute border-2 border-primary/70 bg-primary/10"
              style={{
                left: `${(draftRect.x / canvasWidth) * widthPx}px`,
                top: `${(draftRect.y / canvasHeight) * heightPx}px`,
                width: `${(draftRect.width / canvasWidth) * widthPx}px`,
                height: `${(draftRect.height / canvasHeight) * heightPx}px`,
                clipPath:
                  mode === "draw-triangle"
                    ? "polygon(50% 0%, 100% 100%, 0% 100%)"
                    : undefined,
              }}
            />
          ) : null}

          {!hasActiveLayer ? (
            <div className="absolute inset-0 grid place-items-center text-sm text-muted-foreground">
              Create a floor to begin.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
