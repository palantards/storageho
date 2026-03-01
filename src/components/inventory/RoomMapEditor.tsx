"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

import { normalizePlacement } from "@/lib/inventory/placements-utils";
import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { SignedImage } from "@/components/inventory/SignedImage";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Placement = {
  id: string;
  entityType: "container" | "item";
  entityId: string;
  x: number;
  y: number;
  rotation: number;
  label: string | null;
};

type ContainerOption = {
  id: string;
  name: string;
  code: string | null;
};

type LayoutState = {
  width: number;
  height: number;
  backgroundPhotoId: string | null;
};

type LayoutPhoto = {
  id: string;
  thumbPath: string;
  originalPath: string;
};

export function RoomMapEditor({
  locale,
  householdId,
  roomId,
  layout,
  containers,
  placements: initialPlacements,
  photos,
  focus,
}: {
  locale: string;
  householdId: string;
  roomId: string;
  layout: LayoutState;
  containers: ContainerOption[];
  placements: Placement[];
  photos: LayoutPhoto[];
  focus?: string;
}) {
  const router = useRouter();
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const placementsRef = useRef(initialPlacements);
  const [containerRows, setContainerRows] = useState(containers);
  const [placements, setPlacements] = useState(initialPlacements);
  const [selectedPlacementId, setSelectedPlacementId] = useState<string | null>(
    initialPlacements.find((placement) => `${placement.entityType}:${placement.entityId}` === focus)?.id ||
      initialPlacements[0]?.id ||
      null,
  );
  const [width, setWidth] = useState(String(layout.width));
  const [height, setHeight] = useState(String(layout.height));
  const [backgroundPhotoId, setBackgroundPhotoId] = useState(layout.backgroundPhotoId || "");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [newContainerName, setNewContainerName] = useState("");
  const [newContainerCode, setNewContainerCode] = useState("");
  const [newContainerDescription, setNewContainerDescription] = useState("");
  const [newContainerParentId, setNewContainerParentId] = useState("__root__");
  const [creatingContainer, setCreatingContainer] = useState(false);

  const placedContainerIds = new Set(
    placements
      .filter((placement) => placement.entityType === "container")
      .map((placement) => placement.entityId),
  );

  const backgroundPath = useMemo(
    () => photos.find((photo) => photo.id === backgroundPhotoId)?.originalPath || null,
    [photos, backgroundPhotoId],
  );

  const selectedPlacement = placements.find(
    (placement) => placement.id === selectedPlacementId,
  );

  useEffect(() => {
    placementsRef.current = placements;
  }, [placements]);

  useEffect(() => {
    setContainerRows(containers);
  }, [containers]);

  async function saveLayout(next: {
    width: number;
    height: number;
    backgroundPhotoId?: string | null;
  }) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/placements/layout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          roomId,
          width: next.width,
          height: next.height,
          backgroundPhotoId:
            typeof next.backgroundPhotoId !== "undefined"
              ? next.backgroundPhotoId
              : backgroundPhotoId || null,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to save layout");
      }
      setMessage("Layout saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save layout");
    } finally {
      setSaving(false);
    }
  }

  async function persistPlacement(next: Placement) {
    setSaving(true);
    setMessage("");
    try {
      const response = await fetch("/api/placements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          roomId,
          entityType: next.entityType,
          entityId: next.entityId,
          x: next.x,
          y: next.y,
          rotation: next.rotation,
          label: next.label || undefined,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to save placement");
      }
      setMessage("Placement saved.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to save placement");
    } finally {
      setSaving(false);
    }
  }

  async function deleteSelectedPlacement() {
    if (!selectedPlacement) return;
    try {
      setSaving(true);
      const response = await fetch("/api/placements", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          placementId: selectedPlacement.id,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to delete placement");
      }
      setPlacements((prev) =>
        prev.filter((placement) => placement.id !== selectedPlacement.id),
      );
      setSelectedPlacementId(null);
      setMessage("Placement removed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to delete placement");
    } finally {
      setSaving(false);
    }
  }

  async function createContainerAndPlace() {
    const name = newContainerName.trim();
    if (!name) {
      setMessage("Container name is required.");
      return;
    }

    const widthValue = Math.max(1, Number(width || layout.width));
    const heightValue = Math.max(1, Number(height || layout.height));

    try {
      setCreatingContainer(true);
      setMessage("");
      const response = await fetch("/api/placements/container", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          householdId,
          roomId,
          parentContainerId:
            newContainerParentId === "__root__" ? null : newContainerParentId,
          name,
          code: newContainerCode.trim() || undefined,
          description: newContainerDescription.trim() || undefined,
          x: widthValue / 2,
          y: heightValue / 2,
        }),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.error || "Unable to create container");
      }

      const createdContainer = data?.container as
        | { id: string; name: string; code: string | null }
        | undefined;
      const createdPlacement = data?.placement as
        | {
            id: string;
            entityType: "container" | "item";
            entityId: string;
            x: number;
            y: number;
            rotation: number;
            label: string | null;
          }
        | undefined;

      if (!createdContainer || !createdPlacement) {
        throw new Error("Invalid response from server");
      }

      setContainerRows((prev) => {
        if (prev.some((container) => container.id === createdContainer.id)) {
          return prev;
        }
        return [
          ...prev,
          {
            id: createdContainer.id,
            name: createdContainer.name,
            code: createdContainer.code,
          },
        ];
      });

      setPlacements((prev) => {
        const nextPlacement: Placement = {
          id: createdPlacement.id,
          entityType: createdPlacement.entityType,
          entityId: createdPlacement.entityId,
          x: Number(createdPlacement.x ?? widthValue / 2),
          y: Number(createdPlacement.y ?? heightValue / 2),
          rotation: Number(createdPlacement.rotation ?? 0),
          label: createdPlacement.label ?? null,
        };
        const withoutOld = prev.filter((placement) => placement.id !== nextPlacement.id);
        return [...withoutOld, nextPlacement];
      });

      setSelectedPlacementId(createdPlacement.id);
      setNewContainerName("");
      setNewContainerCode("");
      setNewContainerDescription("");
      setMessage("Container created and placed.");
      router.refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create container");
    } finally {
      setCreatingContainer(false);
    }
  }

  function startDrag(placementId: string) {
    const onPointerMove = (event: PointerEvent) => {
      if (!canvasRef.current) return;
      const rect = canvasRef.current.getBoundingClientRect();
      const px = Math.min(rect.width, Math.max(0, event.clientX - rect.left));
      const py = Math.min(rect.height, Math.max(0, event.clientY - rect.top));
      const normalized = normalizePlacement({
        x: (px / rect.width) * Number(width || layout.width),
        y: (py / rect.height) * Number(height || layout.height),
        width: Number(width || layout.width),
        height: Number(height || layout.height),
      });

      setPlacements((prev) =>
        prev.map((placement) =>
          placement.id === placementId
            ? { ...placement, x: normalized.x, y: normalized.y }
            : placement,
        ),
      );
    };

    const onPointerUp = () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      const moved = placementsRef.current.find(
        (placement) => placement.id === placementId,
      );
      if (moved) {
        persistPlacement(moved).catch(() => null);
      }
    };

    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp, { once: true });
  }

  function placeContainer(containerId: string) {
    const existing = placements.find(
      (placement) =>
        placement.entityType === "container" && placement.entityId === containerId,
    );

    const nextPlacement: Placement = existing || {
      id: `temp-${containerId}`,
      entityType: "container",
      entityId: containerId,
      x: Number(width || layout.width) / 2,
      y: Number(height || layout.height) / 2,
      rotation: 0,
      label: null,
    };

    if (!existing) {
      setPlacements((prev) => [...prev, nextPlacement]);
    }
    setSelectedPlacementId(nextPlacement.id);
    persistPlacement(nextPlacement).catch(() => null);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">Layout size</div>
          <div className="grid gap-2">
            <Input
              type="number"
              min={1}
              value={width}
              onChange={(event) => setWidth(event.target.value)}
              placeholder="Width"
            />
            <Input
              type="number"
              min={1}
              value={height}
              onChange={(event) => setHeight(event.target.value)}
              placeholder="Height"
            />
            <Button
              type="button"
              variant="outline"
              disabled={saving}
              onClick={() =>
                saveLayout({
                  width: Math.max(1, Number(width || layout.width)),
                  height: Math.max(1, Number(height || layout.height)),
                })
              }
            >
              Save dimensions
            </Button>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">Background image</div>
          <PhotoUploader
            householdId={householdId}
            entityType="room_layout"
            entityId={roomId}
            onUploaded={() => router.refresh()}
          />
          {photos.length ? (
            <div className="mt-3 grid grid-cols-3 gap-2">
              {photos.map((photo) => (
                <button
                  key={photo.id}
                  type="button"
                  className={`overflow-hidden rounded border ${
                    backgroundPhotoId === photo.id ? "border-primary" : ""
                  }`}
                  onClick={() => {
                    setBackgroundPhotoId(photo.id);
                    saveLayout({
                      width: Math.max(1, Number(width || layout.width)),
                      height: Math.max(1, Number(height || layout.height)),
                      backgroundPhotoId: photo.id,
                    }).catch(() => null);
                  }}
                >
                  <SignedImage
                    path={photo.thumbPath}
                    alt="Layout background"
                    className="h-14 w-full object-cover"
                  />
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">Quick create + place</div>
          <div className="grid gap-2">
            <Input
              value={newContainerName}
              onChange={(event) => setNewContainerName(event.target.value)}
              placeholder="Container name"
            />
            <Input
              value={newContainerCode}
              onChange={(event) => setNewContainerCode(event.target.value)}
              placeholder="Code (optional)"
            />
            <Input
              value={newContainerDescription}
              onChange={(event) => setNewContainerDescription(event.target.value)}
              placeholder="Description (optional)"
            />
            <select
              className="h-9 rounded-md border bg-background px-3 text-sm"
              value={newContainerParentId}
              onChange={(event) => setNewContainerParentId(event.target.value)}
            >
              <option value="__root__">Top-level box</option>
              {containerRows.map((container) => (
                <option key={`parent-${container.id}`} value={container.id}>
                  Nested in: {container.name}
                </option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              disabled={creatingContainer}
              onClick={createContainerAndPlace}
            >
              {creatingContainer ? "Creating..." : "Create + place center"}
            </Button>
          </div>
        </div>

        <div className="rounded-md border p-3">
          <div className="mb-2 text-sm font-medium">Containers</div>
          <div className="space-y-2">
            {containerRows.map((container) => (
              <div key={container.id} className="flex items-center justify-between rounded border p-2">
                <div className="text-xs">
                  <div className="font-medium">{container.name}</div>
                  <div className="text-muted-foreground">{container.code || "-"}</div>
                </div>
                <Button type="button" size="sm" onClick={() => placeContainer(container.id)}>
                  {placedContainerIds.has(container.id) ? "Move" : "Place"}
                </Button>
              </div>
            ))}
          </div>
        </div>

        {selectedPlacement ? (
          <div className="rounded-md border p-3">
            <div className="mb-2 text-sm font-medium">Selected placement</div>
            <div className="grid gap-2">
              <Input
                value={selectedPlacement.label || ""}
                placeholder="Label override"
                onChange={(event) => {
                  const label = event.target.value;
                  setPlacements((prev) =>
                    prev.map((placement) =>
                      placement.id === selectedPlacement.id
                        ? { ...placement, label }
                        : placement,
                    ),
                  );
                }}
                onBlur={() => {
                  const latest = placements.find(
                    (placement) => placement.id === selectedPlacement.id,
                  );
                  if (latest) {
                    persistPlacement(latest).catch(() => null);
                  }
                }}
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextRotation = selectedPlacement.rotation - 15;
                    const next = { ...selectedPlacement, rotation: nextRotation };
                    setPlacements((prev) =>
                      prev.map((placement) =>
                        placement.id === selectedPlacement.id ? next : placement,
                      ),
                    );
                    persistPlacement(next).catch(() => null);
                  }}
                >
                  Rotate -15
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const nextRotation = selectedPlacement.rotation + 15;
                    const next = { ...selectedPlacement, rotation: nextRotation };
                    setPlacements((prev) =>
                      prev.map((placement) =>
                        placement.id === selectedPlacement.id ? next : placement,
                      ),
                    );
                    persistPlacement(next).catch(() => null);
                  }}
                >
                  Rotate +15
                </Button>
              </div>
              <Button type="button" variant="destructive" size="sm" onClick={deleteSelectedPlacement}>
                Remove placement
              </Button>
            </div>
          </div>
        ) : null}

        {message ? <div className="text-xs text-muted-foreground">{message}</div> : null}
      </div>

      <div className="space-y-2">
        <div className="text-xs text-muted-foreground">
          Drag placed boxes to adjust coordinates. Values are stored in room units.
        </div>
        <div
          ref={canvasRef}
          className="relative h-[70vh] min-h-[420px] overflow-hidden rounded-md border bg-muted/40"
        >
          {backgroundPath ? (
            <SignedImage
              path={backgroundPath}
              alt="Room layout background"
              className="absolute inset-0 h-full w-full object-cover opacity-45"
            />
          ) : null}

          {placements.map((placement) => {
            const container = containerRows.find((entry) => entry.id === placement.entityId);
            const label = placement.label || container?.name || placement.entityId.slice(0, 8);
            const xPercent = (placement.x / Math.max(1, Number(width || layout.width))) * 100;
            const yPercent = (placement.y / Math.max(1, Number(height || layout.height))) * 100;

            return (
              <button
                key={placement.id}
                type="button"
                className={`absolute rounded border bg-background px-2 py-1 text-xs shadow ${
                  selectedPlacementId === placement.id ? "border-primary" : ""
                }`}
                style={{
                  left: `${xPercent}%`,
                  top: `${yPercent}%`,
                  transform: `translate(-50%, -50%) rotate(${placement.rotation}deg)`,
                  transformOrigin: "center center",
                }}
                onPointerDown={(event) => {
                  event.preventDefault();
                  setSelectedPlacementId(placement.id);
                  startDrag(placement.id);
                }}
              >
                {label}
              </button>
            );
          })}
        </div>

        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={() => router.push(`/${locale}/rooms/${roomId}`)}>
            Back to room
          </Button>
        </div>
      </div>
    </div>
  );
}
