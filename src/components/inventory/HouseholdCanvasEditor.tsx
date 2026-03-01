"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type SetStateAction,
} from "react";
import { useRouter } from "next/navigation";

import { HouseholdCanvasSurface } from "@/components/inventory/household-canvas/HouseholdCanvasSurface";
import {
  HouseholdCanvasToolbar,
  type CanvasMode,
} from "@/components/inventory/household-canvas/HouseholdCanvasToolbar";
import { HouseholdFloorStack } from "@/components/inventory/household-canvas/HouseholdFloorStack";
import type {
  ContainerOption,
  Layer,
  LayoutState,
  LocationOption,
  Placement,
  RoomOption,
} from "@/components/inventory/household-canvas/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  applyRoomMoveWithChildren,
  clampContainerRectToRoom,
  isRectInsideRoomShape,
  normalizePlacementRect,
  rotateContainerSetWithRoom,
  snapRectToGrid,
  snapRoomEdges,
  snapToGrid,
  type ShapeType,
} from "@/lib/inventory/household-canvas-utils";

type ResizeCorner = "nw" | "ne" | "sw" | "se";
const GRID_STEP = 0.5;
const EDGE_SNAP_TOLERANCE = 0.35;

type MapTapDialog = {
  x: number;
  y: number;
  roomId: string | null;
  left: number;
  top: number;
};

export function HouseholdCanvasEditor({
  householdId,
  householdName,
  layout,
  layers: initialLayers,
  placements: initialPlacements,
  locations,
  rooms,
  containers,
  focus,
}: {
  householdId: string;
  householdName: string;
  layout: LayoutState;
  layers: Layer[];
  placements: Placement[];
  locations: LocationOption[];
  rooms: RoomOption[];
  containers: ContainerOption[];
  focus?: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const editorRef = useRef<HTMLDivElement | null>(null);
  const placementsRef = useRef(initialPlacements);

  const dragRef = useRef<{
    id: string;
    offsetX: number;
    offsetY: number;
    startX: number;
    startY: number;
    children: Array<{ id: string; startX: number; startY: number }>;
  } | null>(null);
  const resizeRef = useRef<{
    id: string;
    corner: ResizeCorner;
    startX: number;
    startY: number;
    originX: number;
    originY: number;
    originWidth: number;
    originHeight: number;
  } | null>(null);
  const rotateRef = useRef<{
    id: string;
    startAngleDeg: number;
    startRotation: number;
    roomBefore: Placement;
    children: Placement[];
  } | null>(null);

  const [layers, setLayers] = useState(initialLayers);
  const [locationOptions, setLocationOptions] = useState(locations);
  const [roomOptions, setRoomOptions] = useState(rooms);
  const [containerOptions, setContainerOptions] = useState(containers);
  const [placements, setPlacements] = useState(initialPlacements);
  const [message, setMessage] = useState("");

  const [canvasMode, setCanvasMode] = useState<CanvasMode>("select");
  const [canvasRoomName, setCanvasRoomName] = useState("");
  const [zoom, setZoom] = useState(1);

  const [tapDialog, setTapDialog] = useState<MapTapDialog | null>(null);
  const [dialogRoomId, setDialogRoomId] = useState("");
  const [dialogNewContainerName, setDialogNewContainerName] = useState("");
  const [dialogNewContainerCode, setDialogNewContainerCode] = useState("");
  const [dialogExistingContainerId, setDialogExistingContainerId] = useState("");
  const [dialogBusy, setDialogBusy] = useState<"create" | "place" | null>(null);

  const sortedLayers = useMemo(
    () =>
      [...layers].sort(
        (left, right) => left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
      ),
    [layers],
  );

  const focusPlacement =
    focus && focus.includes(":")
      ? initialPlacements.find(
          (placement) => `${placement.entityType}:${placement.entityId}` === focus,
        )
      : null;

  const [selectedLayerId, setSelectedLayerId] = useState<string | null>(
    focusPlacement?.layerId || sortedLayers[0]?.id || null,
  );
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    focusPlacement?.id || null,
  );

  const effectiveSelectedLayerId = selectedLayerId ?? sortedLayers[0]?.id ?? null;
  const activeLayer =
    sortedLayers.find((layer) => layer.id === effectiveSelectedLayerId) || null;
  const canvasWidth = Math.max(8, Number(layout.width));
  const canvasHeight = Math.max(8, Number(layout.height));

  const roomsForLayer = activeLayer?.locationId
    ? roomOptions.filter((room) => room.locationId === activeLayer.locationId)
    : roomOptions;
  const containersForLayer = activeLayer?.locationId
    ? containerOptions.filter((container) => container.locationId === activeLayer.locationId)
    : containerOptions;
  const layerPlacements = placements.filter(
    (placement) => placement.layerId === effectiveSelectedLayerId,
  );
  const selectedPlacement =
    placements.find((placement) => placement.id === selectedPlacementId) || null;
  const containersById = useMemo(
    () => new Map(containerOptions.map((container) => [container.id, container])),
    [containerOptions],
  );
  const activeLayerLocationName =
    locationOptions.find((location) => location.id === activeLayer?.locationId)?.name ||
    "Auto-managed";

  const dialogContainers = dialogRoomId
    ? containersForLayer.filter((container) => container.roomId === dialogRoomId)
    : containersForLayer;

  const roomPlacementsByRoomId = useMemo(() => {
    const map = new Map<string, Placement>();
    for (const placement of layerPlacements) {
      if (placement.entityType !== "room") continue;
      map.set(placement.entityId, placement);
    }
    return map;
  }, [layerPlacements]);

  function setPlacementsState(updater: SetStateAction<Placement[]>) {
    setPlacements((previous) => {
      const nextValue =
        typeof updater === "function"
          ? (updater as (value: Placement[]) => Placement[])(previous)
          : updater;
      placementsRef.current = nextValue;
      return nextValue;
    });
  }

  function getRoomPlacementForContainerPlacement(placement: Placement) {
    if (placement.entityType !== "container") return null;
    const container = containersById.get(placement.entityId);
    if (!container) return null;
    return roomPlacementsByRoomId.get(container.roomId) ?? null;
  }

  function normalizeRoomPosition(rect: {
    x: number;
    y: number;
    width: number;
    height: number;
    roomId: string;
  }) {
    const gridSnapped = snapRectToGrid(
      {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      GRID_STEP,
    );
    const edgeSnapped = snapRoomEdges(
      gridSnapped,
      layerPlacements
        .filter(
          (placement) =>
            placement.entityType === "room" && placement.entityId !== rect.roomId,
        )
        .map((placement) => ({
          x: placement.x,
          y: placement.y,
          width: placement.width,
          height: placement.height,
        })),
      EDGE_SNAP_TOLERANCE,
    );
    return normalizePlacementRect({
      x: edgeSnapped.x,
      y: edgeSnapped.y,
      width: edgeSnapped.width,
      height: edgeSnapped.height,
      canvasWidth,
      canvasHeight,
    });
  }

  function normalizeContainerPosition(
    placement: Placement,
    rect: { x: number; y: number; width: number; height: number },
  ) {
    const roomPlacement = getRoomPlacementForContainerPlacement(placement);
    if (!roomPlacement) {
      throw new Error("Container room is not mapped on this floor");
    }

    const gridSnapped = snapRectToGrid(
      {
        x: rect.x,
        y: rect.y,
        width: rect.width,
        height: rect.height,
      },
      GRID_STEP,
    );
    const clamped = clampContainerRectToRoom(
      gridSnapped,
      {
        x: roomPlacement.x,
        y: roomPlacement.y,
        width: roomPlacement.width,
        height: roomPlacement.height,
        rotation: roomPlacement.rotation,
        shapeType: roomPlacement.shapeType,
      },
    );
    if (
      !isRectInsideRoomShape(clamped, {
        x: roomPlacement.x,
        y: roomPlacement.y,
        width: roomPlacement.width,
        height: roomPlacement.height,
        rotation: roomPlacement.rotation,
        shapeType: roomPlacement.shapeType,
      })
    ) {
      throw new Error("Container must stay inside room bounds");
    }

    return normalizePlacementRect({
      x: clamped.x,
      y: clamped.y,
      width: clamped.width,
      height: clamped.height,
      canvasWidth,
      canvasHeight,
    });
  }

  useEffect(() => {
    setLayers(initialLayers);
  }, [initialLayers]);

  useEffect(() => {
    setLocationOptions(locations);
  }, [locations]);

  useEffect(() => {
    setRoomOptions(rooms);
  }, [rooms]);

  useEffect(() => {
    setContainerOptions(containers);
  }, [containers]);

  useEffect(() => {
    setPlacementsState(initialPlacements);
  }, [initialPlacements]);

  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  useEffect(() => {
    if (canvasMode !== "place-box") {
      setTapDialog(null);
    }
  }, [canvasMode]);

  useEffect(() => {
    setTapDialog(null);
  }, [effectiveSelectedLayerId]);

  async function callJson(path: string, method: string, body: Record<string, unknown>) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Request failed");
    }
    return data;
  }

  async function createLayerWithValues(name: string) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const data = await callJson("/api/household-canvas/layers", "POST", {
      householdId,
      name: trimmed,
    });
    return data.layer as Layer;
  }

  async function renameLayer(layerId: string, name: string) {
    const trimmed = name.trim();
    if (!trimmed) return;
    const data = await callJson("/api/household-canvas/layers", "PATCH", {
      householdId,
      layerId,
      name: trimmed,
    });
    const updated = data.layer as Layer;
    setLayers((previous) =>
      previous.map((entry) => (entry.id === updated.id ? updated : entry)),
    );
    const updatedLocationId = updated.locationId;
    if (updatedLocationId) {
      setLocationOptions((previous) => {
        const existing = previous.find((entry) => entry.id === updatedLocationId);
        if (existing) {
          return previous.map((entry) =>
            entry.id === updatedLocationId ? { ...entry, name: updated.name } : entry,
          );
        }
        return [...previous, { id: updatedLocationId, name: updated.name }];
      });
    }
    router.refresh();
  }

  async function createFloorQuick() {
    try {
      const usedNames = new Set(sortedLayers.map((entry) => entry.name.trim().toLowerCase()));
      let candidate = sortedLayers.length + 1;
      let layerName = sortedLayers.length === 0 ? "Base floor" : `Floor ${candidate}`;
      while (usedNames.has(layerName.toLowerCase())) {
        candidate += 1;
        layerName = `Floor ${candidate}`;
      }
      const layer = await createLayerWithValues(layerName);
      if (!layer) return;
      setLayers((previous) => [...previous, layer]);
      setSelectedLayerId(layer.id);
      const layerLocationId = layer.locationId;
      if (layerLocationId) {
        setLocationOptions((previous) =>
          previous.some((entry) => entry.id === layerLocationId)
            ? previous
            : [...previous, { id: layerLocationId, name: layer.name }],
        );
      }
      setMessage("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to add floor");
    }
  }

  async function createRoomRect(input: {
    x: number;
    y: number;
    width: number;
    height: number;
    name: string;
    shapeType: ShapeType;
  }) {
    if (!activeLayer) {
      throw new Error("Create a floor first.");
    }

    const normalized = normalizeRoomPosition({
      x: input.x,
      y: input.y,
      width: input.width,
      height: input.height,
      roomId: "__new__",
    });

    const data = await callJson("/api/household-canvas/room", "POST", {
      householdId,
      layerId: activeLayer.id,
      locationId: activeLayer.locationId ?? null,
      name: input.name.trim(),
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      shapeType: input.shapeType,
    });
    const placement = data.placement as Placement;
    const room = data.room as {
      id: string;
      name: string;
      locationId: string;
    };

    setPlacementsState((previous) => [
      ...previous.filter((entry) => entry.id !== placement.id),
      placement,
    ]);
    setRoomOptions((previous) => {
      const existing = previous.find((entry) => entry.id === room.id);
      if (existing) {
        return previous.map((entry) =>
          entry.id === room.id
            ? {
                ...entry,
                name: room.name,
                locationId: room.locationId,
              }
            : entry,
        );
      }
      const locationName =
        locationOptions.find((entry) => entry.id === room.locationId)?.name || "Location";
      return [
        ...previous,
        {
          id: room.id,
          name: room.name,
          locationId: room.locationId,
          locationName,
        },
      ];
    });
    setSelectedPlacementId(placement.id);
    router.refresh();
    return placement;
  }

  async function placeContainerAt(
    centerX: number,
    centerY: number,
    containerId: string,
    roomId: string,
  ) {
    if (!activeLayer) {
      throw new Error("Create a floor first.");
    }
    const draft = {
      x: centerX - 1.5,
      y: centerY - 1,
      width: 3,
      height: 2,
    };
    const roomPlacement = roomPlacementsByRoomId.get(roomId);
    if (!roomPlacement) {
      throw new Error("Select a mapped room first");
    }
    const clamped = clampContainerRectToRoom(draft, {
      x: roomPlacement.x,
      y: roomPlacement.y,
      width: roomPlacement.width,
      height: roomPlacement.height,
      rotation: roomPlacement.rotation,
      shapeType: roomPlacement.shapeType,
    });
    const normalized = normalizePlacementRect({
      x: snapToGrid(clamped.x, GRID_STEP),
      y: snapToGrid(clamped.y, GRID_STEP),
      width: snapToGrid(clamped.width, GRID_STEP),
      height: snapToGrid(clamped.height, GRID_STEP),
      canvasWidth,
      canvasHeight,
    });
    const data = await callJson("/api/household-canvas/placements", "POST", {
      householdId,
      layerId: activeLayer.id,
      entityType: "container",
      entityId: containerId,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
    });
    const placement = data.placement as Placement;
    setPlacementsState((previous) => [
      ...previous.filter((entry) => entry.id !== placement.id),
      placement,
    ]);
    setSelectedPlacementId(placement.id);
    router.refresh();
    return placement;
  }

  async function createContainerAtTap() {
    if (!activeLayer || !tapDialog) return;
    const roomId = dialogRoomId || tapDialog.roomId || "";
    if (!roomId) {
      setMessage("Tap inside a room to add a box.");
      return;
    }
    const name = dialogNewContainerName.trim();
    if (!name) {
      setMessage("Box name is required.");
      return;
    }

    const roomPlacement = roomPlacementsByRoomId.get(roomId);
    if (!roomPlacement) {
      setMessage("Room is not mapped on this floor.");
      return;
    }
    const clamped = clampContainerRectToRoom(
      {
        x: tapDialog.x - 1.5,
        y: tapDialog.y - 1,
        width: 3,
        height: 2,
      },
      {
        x: roomPlacement.x,
        y: roomPlacement.y,
        width: roomPlacement.width,
        height: roomPlacement.height,
        rotation: roomPlacement.rotation,
        shapeType: roomPlacement.shapeType,
      },
    );
    const normalized = normalizePlacementRect({
      x: snapToGrid(clamped.x, GRID_STEP),
      y: snapToGrid(clamped.y, GRID_STEP),
      width: snapToGrid(clamped.width, GRID_STEP),
      height: snapToGrid(clamped.height, GRID_STEP),
      canvasWidth,
      canvasHeight,
    });

    try {
      setDialogBusy("create");
      const data = await callJson("/api/household-canvas/container", "POST", {
        householdId,
        layerId: activeLayer.id,
        roomId,
        name,
        code: dialogNewContainerCode.trim() || undefined,
        x: normalized.x,
        y: normalized.y,
        width: normalized.width,
        height: normalized.height,
      });
      const placement = data.placement as Placement;
      const container = data.container as {
        id: string;
        name: string;
        code: string | null;
        roomId: string;
      };
      const room = roomOptions.find((entry) => entry.id === container.roomId);
      const locationId = room?.locationId || activeLayer.locationId || "";
      const locationName =
        locationOptions.find((entry) => entry.id === locationId)?.name || "Location";
      const roomName = room?.name || "Room";

      setPlacementsState((previous) => [
        ...previous.filter((entry) => entry.id !== placement.id),
        placement,
      ]);
      setContainerOptions((previous) =>
        previous.some((entry) => entry.id === container.id)
          ? previous
          : [
              ...previous,
              {
                id: container.id,
                name: container.name,
                code: container.code,
                roomId: container.roomId,
                roomName,
                locationId,
                locationName,
              },
            ],
      );
      setSelectedPlacementId(placement.id);
      setTapDialog(null);
      setDialogNewContainerName("");
      setDialogNewContainerCode("");
      setMessage("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create box");
    } finally {
      setDialogBusy(null);
    }
  }

  async function placeExistingContainerAtTap() {
    if (!tapDialog) return;
    const containerId = dialogExistingContainerId || dialogContainers[0]?.id;
    const roomId = dialogRoomId || tapDialog.roomId || "";
    if (!containerId) {
      setMessage("No boxes available in this floor.");
      return;
    }
    if (!roomId) {
      setMessage("Tap inside a room to place a box.");
      return;
    }
    const container = containersById.get(containerId);
    if (!container) {
      setMessage("Container not found.");
      return;
    }
    if (container.roomId !== roomId) {
      setMessage("Choose a box that belongs to this room.");
      return;
    }

    try {
      setDialogBusy("place");
      await placeContainerAt(tapDialog.x, tapDialog.y, containerId, roomId);
      setTapDialog(null);
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to place box");
    } finally {
      setDialogBusy(null);
    }
  }

  async function deleteContainerEntity(containerId: string) {
    await callJson("/api/household-canvas/container", "DELETE", {
      householdId,
      containerId,
    });

    setContainerOptions((previous) =>
      previous.filter((entry) => entry.id !== containerId),
    );
    setPlacementsState((previous) =>
      previous.filter(
        (entry) =>
          !(entry.entityType === "container" && entry.entityId === containerId),
      ),
    );
    if (selectedPlacement?.entityType === "container" && selectedPlacement.entityId === containerId) {
      setSelectedPlacementId(null);
    }
  }

  async function handleDeletePlacementEntity(placement: Placement) {
    const name = labelFor(placement);
    const confirmed = window.confirm(
      placement.entityType === "room"
        ? `Delete room "${name}" and all containers inside it?`
        : `Delete container "${name}" permanently?`,
    );
    if (!confirmed) {
      return;
    }

    try {
      if (placement.entityType === "room") {
        const roomId = placement.entityId;
        await callJson("/api/household-canvas/room", "DELETE", {
          householdId,
          roomId,
        });

        const roomContainerIds = containerOptions
          .filter((entry) => entry.roomId === roomId)
          .map((entry) => entry.id);
        const roomContainerIdSet = new Set(roomContainerIds);

        setRoomOptions((previous) => previous.filter((entry) => entry.id !== roomId));
        setContainerOptions((previous) =>
          previous.filter((entry) => entry.roomId !== roomId),
        );
        setPlacementsState((previous) =>
          previous.filter((entry) => {
            if (entry.entityType === "room") {
              return entry.entityId !== roomId;
            }
            if (entry.entityType === "container") {
              return !roomContainerIdSet.has(entry.entityId);
            }
            return true;
          }),
        );
        if (
          selectedPlacement?.entityType === "room" &&
          selectedPlacement.entityId === roomId
        ) {
          setSelectedPlacementId(null);
        }
      } else {
        await deleteContainerEntity(placement.entityId);
      }

      setMessage("");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete entity");
    }
  }

  async function savePlacement(nextPlacement: Placement) {
    const normalized =
      nextPlacement.entityType === "room"
        ? normalizeRoomPosition({
            x: nextPlacement.x,
            y: nextPlacement.y,
            width: nextPlacement.width,
            height: nextPlacement.height,
            roomId: nextPlacement.entityId,
          })
        : normalizeContainerPosition(nextPlacement, {
            x: nextPlacement.x,
            y: nextPlacement.y,
            width: nextPlacement.width,
            height: nextPlacement.height,
          });
    const data = await callJson("/api/household-canvas/placements", "POST", {
      householdId,
      layerId: nextPlacement.layerId,
      entityType: nextPlacement.entityType,
      entityId: nextPlacement.entityId,
      x: normalized.x,
      y: normalized.y,
      width: normalized.width,
      height: normalized.height,
      rotation: nextPlacement.rotation,
      shapeType: nextPlacement.shapeType,
      label: nextPlacement.label || undefined,
    });
    const saved = data.placement as Placement;
    setPlacementsState((previous) =>
      previous.map((entry) => (entry.id === nextPlacement.id ? saved : entry)),
    );
    return saved;
  }

  function updatePlacement(placementId: string, updater: (placement: Placement) => Placement) {
    setPlacementsState((previous) =>
      previous.map((entry) => (entry.id === placementId ? updater(entry) : entry)),
    );
  }

  function startDrag(placement: Placement, event: ReactPointerEvent<HTMLButtonElement>) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    const childPlacements =
      placement.entityType === "room"
        ? placementsRef.current.filter((entry) => {
            if (
              entry.id === placement.id ||
              entry.layerId !== placement.layerId ||
              entry.entityType !== "container"
            ) {
              return false;
            }
            const container = containersById.get(entry.entityId);
            return container?.roomId === placement.entityId;
          })
        : [];

    dragRef.current = {
      id: placement.id,
      offsetX: event.clientX - rect.left - (placement.x / canvasWidth) * rect.width,
      offsetY: event.clientY - rect.top - (placement.y / canvasHeight) * rect.height,
      startX: placement.x,
      startY: placement.y,
      children: childPlacements.map((entry) => ({
        id: entry.id,
        startX: entry.x,
        startY: entry.y,
      })),
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!canvasRef.current || !dragRef.current) return;
      const state = dragRef.current;
      const target = placementsRef.current.find((entry) => entry.id === state.id);
      if (!target) return;

      const canvasRect = canvasRef.current.getBoundingClientRect();
      const x =
        ((moveEvent.clientX - canvasRect.left - state.offsetX) / canvasRect.width) * canvasWidth;
      const y =
        ((moveEvent.clientY - canvasRect.top - state.offsetY) / canvasRect.height) * canvasHeight;
      if (target.entityType === "room") {
        const normalized = normalizeRoomPosition({
          x,
          y,
          width: target.width,
          height: target.height,
          roomId: target.entityId,
        });
        setPlacementsState((previous) =>
          applyRoomMoveWithChildren({
            roomPlacement: {
              id: state.id,
              x: state.startX,
              y: state.startY,
              width: target.width,
              height: target.height,
            },
            normalizedRoomPosition: { x: normalized.x, y: normalized.y },
            childPlacements: state.children,
            placements: previous,
            canvasWidth,
            canvasHeight,
          }),
        );
        return;
      }

      try {
        const normalized = normalizeContainerPosition(target, {
          x,
          y,
          width: target.width,
          height: target.height,
        });
        updatePlacement(state.id, (entry) => ({
          ...entry,
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        }));
      } catch {
        // Keep current client state stable while dragging if constraints are violated.
      }
    };

    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const state = dragRef.current;
      dragRef.current = null;
      if (!state) return;

      const idsToPersist = new Set([state.id, ...state.children.map((entry) => entry.id)]);
      const targets = placementsRef.current.filter((entry) => idsToPersist.has(entry.id));

      try {
        await Promise.all(targets.map((entry) => savePlacement(entry)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to save placement");
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function startResize(
    placement: Placement,
    corner: ResizeCorner,
    event: ReactPointerEvent<HTMLDivElement>,
  ) {
    if (!canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    resizeRef.current = {
      id: placement.id,
      corner,
      startX: event.clientX,
      startY: event.clientY,
      originX: placement.x,
      originY: placement.y,
      originWidth: placement.width,
      originHeight: placement.height,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!resizeRef.current) return;
      const state = resizeRef.current;
      const current = placementsRef.current.find((entry) => entry.id === state.id);
      if (!current) return;
      const dx = ((moveEvent.clientX - state.startX) / rect.width) * canvasWidth;
      const dy = ((moveEvent.clientY - state.startY) / rect.height) * canvasHeight;

      let x = state.originX;
      let y = state.originY;
      let width = state.originWidth;
      let height = state.originHeight;

      switch (state.corner) {
        case "se":
          width = state.originWidth + dx;
          height = state.originHeight + dy;
          break;
        case "nw":
          x = state.originX + dx;
          y = state.originY + dy;
          width = state.originWidth - dx;
          height = state.originHeight - dy;
          break;
        case "ne":
          y = state.originY + dy;
          width = state.originWidth + dx;
          height = state.originHeight - dy;
          break;
        case "sw":
          x = state.originX + dx;
          width = state.originWidth - dx;
          height = state.originHeight + dy;
          break;
      }

      if (current.entityType === "room") {
        const snapped = snapRectToGrid(
          {
            x,
            y,
            width,
            height,
          },
          GRID_STEP,
        );
        const edgeSnapped = snapRoomEdges(
          snapped,
          layerPlacements
            .filter(
              (placement) =>
                placement.entityType === "room" && placement.entityId !== current.entityId,
            )
            .map((placement) => ({
              x: placement.x,
              y: placement.y,
              width: placement.width,
              height: placement.height,
            })),
          EDGE_SNAP_TOLERANCE,
        );
        const normalized = normalizePlacementRect({
          x: edgeSnapped.x,
          y: edgeSnapped.y,
          width: edgeSnapped.width,
          height: edgeSnapped.height,
          canvasWidth,
          canvasHeight,
        });
        updatePlacement(state.id, (entry) => ({
          ...entry,
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        }));
        return;
      }

      try {
        const normalized = normalizeContainerPosition(current, {
          x,
          y,
          width,
          height,
        });
        updatePlacement(state.id, (entry) => ({
          ...entry,
          x: normalized.x,
          y: normalized.y,
          width: normalized.width,
          height: normalized.height,
        }));
      } catch {
        // Ignore invalid intermediate resize drafts for constrained containers.
      }
    };

    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const state = resizeRef.current;
      resizeRef.current = null;
      if (!state) return;
      const target = placementsRef.current.find((entry) => entry.id === state.id);
      if (!target) return;
      try {
        if (target.entityType === "room") {
          const roomShape = {
            x: target.x,
            y: target.y,
            width: target.width,
            height: target.height,
            rotation: target.rotation,
            shapeType: target.shapeType,
          } as const;

          const childPlacements = placementsRef.current.filter((entry) => {
            if (entry.layerId !== target.layerId || entry.entityType !== "container") return false;
            const container = containersById.get(entry.entityId);
            return container?.roomId === target.entityId;
          });

          const childById = new Map(
            childPlacements.map((child) => [
              child.id,
              clampContainerRectToRoom(
                {
                  x: child.x,
                  y: child.y,
                  width: child.width,
                  height: child.height,
                },
                roomShape,
              ),
            ]),
          );

          setPlacementsState((previous) =>
            previous.map((entry) => {
              const next = childById.get(entry.id);
              if (!next) return entry;
              return {
                ...entry,
                x: next.x,
                y: next.y,
              };
            }),
          );

          const idsToPersist = new Set([target.id, ...childPlacements.map((child) => child.id)]);
          await Promise.all(
            placementsRef.current
              .filter((entry) => idsToPersist.has(entry.id))
              .map((entry) => savePlacement(entry)),
          );
        } else {
          await savePlacement(target);
        }
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to resize placement");
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  function startRotate(placement: Placement, event: ReactPointerEvent<HTMLDivElement>) {
    if (!canvasRef.current || placement.entityType !== "room") return;
    const rect = canvasRef.current.getBoundingClientRect();
    const centerX = rect.left + ((placement.x + placement.width / 2) / canvasWidth) * rect.width;
    const centerY =
      rect.top + ((placement.y + placement.height / 2) / canvasHeight) * rect.height;

    const angleAtPointer = (clientX: number, clientY: number) =>
      (Math.atan2(clientY - centerY, clientX - centerX) * 180) / Math.PI;

    const childPlacements = placementsRef.current
      .filter((entry) => {
        if (entry.layerId !== placement.layerId || entry.entityType !== "container") return false;
        const container = containersById.get(entry.entityId);
        return container?.roomId === placement.entityId;
      })
      .map((entry) => ({ ...entry }));

    rotateRef.current = {
      id: placement.id,
      startAngleDeg: angleAtPointer(event.clientX, event.clientY),
      startRotation: placement.rotation,
      roomBefore: { ...placement },
      children: childPlacements,
    };

    const onMove = (moveEvent: PointerEvent) => {
      if (!rotateRef.current) return;
      const state = rotateRef.current;
      const rawRotation =
        state.startRotation + (angleAtPointer(moveEvent.clientX, moveEvent.clientY) - state.startAngleDeg);
      const snappedRotation = moveEvent.shiftKey
        ? rawRotation
        : Math.round(rawRotation / 15) * 15;
      const normalizedRotation =
        ((((snappedRotation % 360) + 360) % 360) > 180
          ? (((snappedRotation % 360) + 360) % 360) - 360
          : ((snappedRotation % 360) + 360) % 360);

      const roomAfter = {
        ...state.roomBefore,
        rotation: normalizedRotation,
      };
      const rotatedChildren = rotateContainerSetWithRoom({
        roomBefore: state.roomBefore,
        roomAfter: {
          ...roomAfter,
          shapeType: roomAfter.shapeType,
        },
        containers: state.children,
      });
      const childById = new Map(rotatedChildren.map((child) => [child.id, child]));

      setPlacementsState((previous) =>
        previous.map((entry) => {
          if (entry.id === state.id) {
            return { ...entry, rotation: normalizedRotation };
          }
          const child = childById.get(entry.id);
          if (!child) return entry;
          return {
            ...entry,
            x: child.x,
            y: child.y,
            rotation: child.rotation ?? entry.rotation,
          };
        }),
      );
    };

    const onUp = async () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      const state = rotateRef.current;
      rotateRef.current = null;
      if (!state) return;

      const idsToPersist = new Set([state.id, ...state.children.map((entry) => entry.id)]);
      const targets = placementsRef.current.filter((entry) => idsToPersist.has(entry.id));
      try {
        await Promise.all(targets.map((entry) => savePlacement(entry)));
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Unable to rotate room");
      }
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
  }

  async function handleRoomDrawComplete(payload: {
    x: number;
    y: number;
    width: number;
    height: number;
    shapeType: ShapeType;
  }) {
    if (!activeLayer) return;
    const roomName = canvasRoomName.trim() || `Room ${roomsForLayer.length + 1}`;
    try {
      await createRoomRect({
        x: payload.x,
        y: payload.y,
        width: payload.width,
        height: payload.height,
        shapeType: payload.shapeType,
        name: roomName,
      });
      setMessage("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create room");
    }
  }

  function handleMapTap(payload: {
    x: number;
    y: number;
    roomId: string | null;
    clientX: number;
    clientY: number;
  }) {
    if (!activeLayer || canvasMode !== "place-box") return;
    if (!payload.roomId) {
      setMessage("Tap inside a room to add or place a box.");
      return;
    }

    const hostRect = editorRef.current?.getBoundingClientRect();
    const panelWidth = 320;
    const panelHeight = 260;
    const hostWidth = hostRect?.width ?? 900;
    const hostHeight = hostRect?.height ?? 700;
    const rawLeft = (hostRect ? payload.clientX - hostRect.left : 20) + 12;
    const rawTop = (hostRect ? payload.clientY - hostRect.top : 20) + 12;

    const roomId = payload.roomId;
    const roomContainers = roomId
      ? containersForLayer.filter((entry) => entry.roomId === roomId)
      : containersForLayer;

    setDialogRoomId(roomId);
    setDialogExistingContainerId(roomContainers[0]?.id || containersForLayer[0]?.id || "");
    setDialogNewContainerName("");
    setDialogNewContainerCode("");
    setTapDialog({
      x: payload.x,
      y: payload.y,
      roomId: payload.roomId,
      left: Math.min(Math.max(rawLeft, 8), Math.max(8, hostWidth - panelWidth - 8)),
      top: Math.min(Math.max(rawTop, 8), Math.max(8, hostHeight - panelHeight - 8)),
    });
  }

  const labelFor = (placement: Placement) => {
    if (placement.label?.trim()) return placement.label.trim();
    if (placement.entityType === "room") {
      return roomOptions.find((room) => room.id === placement.entityId)?.name || "Room";
    }
    return (
      containerOptions.find((container) => container.id === placement.entityId)?.name ||
      "Container"
    );
  };

  const modeLabel =
    canvasMode === "draw-rectangle"
      ? "Draw room: drag on empty map"
      : canvasMode === "draw-square"
        ? "Draw square room: drag on empty map"
        : canvasMode === "draw-triangle"
          ? "Draw triangle room: drag on empty map"
          : canvasMode === "place-box"
            ? "Tap inside a room to add/place a box"
            : "Select, drag, resize, rotate";

  function zoomIn() {
    setZoom((previous) => Math.min(2.4, Number((previous + 0.2).toFixed(2))));
  }

  function zoomOut() {
    setZoom((previous) => Math.max(0.6, Number((previous - 0.2).toFixed(2))));
  }

  function zoomReset() {
    setZoom(1);
  }

  return (
    <div className="grid gap-3 lg:grid-cols-[112px_1fr]">
      <HouseholdFloorStack
        layers={sortedLayers}
        selectedLayerId={effectiveSelectedLayerId}
        onSelectLayer={setSelectedLayerId}
        onCreateFloor={createFloorQuick}
        onRenameLayer={renameLayer}
      />

      <div ref={editorRef} className="relative space-y-3">
        <div className="flex flex-wrap items-center gap-2 rounded-md border p-3 text-sm">
          <div className="font-medium">{householdName}</div>
          <div className="text-muted-foreground">Floor: {activeLayer?.name || "None"}</div>
          <div className="text-muted-foreground">Location: {activeLayerLocationName}</div>
          {message ? <div className="ml-auto text-xs text-muted-foreground">{message}</div> : null}
        </div>

        <HouseholdCanvasToolbar
          mode={canvasMode}
          onModeChange={setCanvasMode}
          roomName={canvasRoomName}
          onRoomNameChange={setCanvasRoomName}
          zoom={zoom}
          onZoomIn={zoomIn}
          onZoomOut={zoomOut}
          onZoomReset={zoomReset}
        />

        <HouseholdCanvasSurface
          canvasRef={canvasRef}
          canvasWidth={canvasWidth}
          canvasHeight={canvasHeight}
          zoom={zoom}
          mode={canvasMode}
          placements={layerPlacements}
          selectedPlacementId={selectedPlacementId}
          hasActiveLayer={Boolean(activeLayer)}
          labelFor={labelFor}
          modeLabel={modeLabel}
          onSelectPlacement={setSelectedPlacementId}
          onPointerDown={startDrag}
          onResizePointerDown={startResize}
          onRotatePointerDown={startRotate}
          onMapTap={handleMapTap}
          onRoomDrawComplete={handleRoomDrawComplete}
          onZoomChange={setZoom}
          onDeletePlacementEntity={handleDeletePlacementEntity}
        />

        {tapDialog ? (
          <div className="pointer-events-none absolute inset-0 z-20">
            <div
              className="pointer-events-auto absolute w-[320px] rounded-md border bg-background p-3 shadow-xl"
              style={{ left: tapDialog.left, top: tapDialog.top }}
            >
              <div className="mb-2 flex items-center justify-between">
                <div className="text-sm font-medium">Box actions</div>
                <Button type="button" size="sm" variant="ghost" onClick={() => setTapDialog(null)}>
                  Close
                </Button>
              </div>

              <div className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  Tap point: {tapDialog.x.toFixed(1)}, {tapDialog.y.toFixed(1)}
                </div>
                <select
                  className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                  value={dialogRoomId}
                  onChange={(event) => {
                    const nextRoomId = event.target.value;
                    setDialogRoomId(nextRoomId);
                    const nextContainers = containersForLayer.filter(
                      (entry) => entry.roomId === nextRoomId,
                    );
                    setDialogExistingContainerId(nextContainers[0]?.id || "");
                  }}
                >
                  <option value="">Select room</option>
                  {roomsForLayer.map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.name}
                    </option>
                  ))}
                </select>

                <div className="grid gap-2 rounded-md border p-2">
                  <div className="text-xs font-medium">Create new box here</div>
                  <Input
                    value={dialogNewContainerName}
                    onChange={(event) => setDialogNewContainerName(event.target.value)}
                    placeholder="Box name"
                  />
                  <Input
                    value={dialogNewContainerCode}
                    onChange={(event) => setDialogNewContainerCode(event.target.value)}
                    placeholder="Code (optional)"
                  />
                  <Button
                    type="button"
                    size="sm"
                    disabled={dialogBusy !== null}
                    onClick={createContainerAtTap}
                  >
                    {dialogBusy === "create" ? "Creating..." : "Create + place"}
                  </Button>
                </div>

                <div className="grid gap-2 rounded-md border p-2">
                  <div className="text-xs font-medium">Place existing box</div>
                  <select
                    className="h-9 w-full rounded-md border bg-background px-3 text-sm"
                    value={dialogExistingContainerId}
                    onChange={(event) => setDialogExistingContainerId(event.target.value)}
                  >
                    <option value="">Select box</option>
                    {dialogContainers.map((container) => (
                      <option key={container.id} value={container.id}>
                        {container.roomName} / {container.name}
                      </option>
                    ))}
                  </select>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={dialogBusy !== null}
                    onClick={placeExistingContainerAtTap}
                  >
                    {dialogBusy === "place" ? "Placing..." : "Place selected box"}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
