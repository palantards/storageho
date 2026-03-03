"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

import { HouseholdMapPreview } from "@/components/inventory/household-canvas/HouseholdMapPreview";
import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Floor = {
  id: string;
  name: string;
  locationId: string | null;
  sortOrder: number;
};

type RoomOption = {
  id: string;
  name: string;
  locationId: string;
  locationName: string;
  isSystem: boolean;
};

type ContainerOption = {
  id: string;
  name: string;
  code: string | null;
  roomId: string;
  roomName: string;
  locationId: string;
  locationName: string;
};

type Suggestion = {
  id: string;
  suggestedName: string;
  suggestedQty: number | null;
  suggestedTags: string[] | null;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
};

type CreatedContainerSummary = {
  id: string;
  name: string;
  code: string | null;
  roomId: string;
  roomName: string;
  locationId: string;
  locationName: string;
};

function sortFloors(floors: Floor[]) {
  return [...floors].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

export function HouseholdSetupFlow({
  locale,
  householdId,
  householdName,
  floors: initialFloors,
  rooms: initialRooms,
  containers: initialContainers,
}: {
  locale: string;
  householdId: string;
  householdName: string;
  floors: Floor[];
  rooms: RoomOption[];
  containers: ContainerOption[];
}) {
  const router = useRouter();
  const { t } = useI18n();

  const [floors, setFloors] = useState(sortFloors(initialFloors));
  const [rooms, setRooms] = useState(initialRooms);
  const [containers, setContainers] = useState(initialContainers);
  const NONE = "__none__";
  const [selectedFloorId, setSelectedFloorId] = useState<string>(initialFloors[0]?.id || NONE);
  const [selectedRoomId, setSelectedRoomId] = useState<string>(NONE);
  const [floorName, setFloorName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [containerName, setContainerName] = useState("");
  const [containerCode, setContainerCode] = useState("");
  const [containerDescription, setContainerDescription] = useState("");
  const [quickAddText, setQuickAddText] = useState("");
  const [busyAction, setBusyAction] = useState<null | "floor" | "room" | "container" | "quick-add">(
    null,
  );
  const [message, setMessage] = useState("");
  const [createdContainer, setCreatedContainer] = useState<CreatedContainerSummary | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);

  const tt = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  const selectedFloor =
    selectedFloorId === NONE
      ? null
      : floors.find((floor) => floor.id === selectedFloorId) || null;
  const selectedLocationId = selectedFloor?.locationId ?? null;

  const selectableRooms = useMemo(
    () =>
      rooms
        .filter((room) => room.locationId === selectedLocationId && !room.isSystem)
        .sort((left, right) => left.name.localeCompare(right.name)),
    [rooms, selectedLocationId],
  );

  useEffect(() => {
    if ((selectedFloorId === NONE || !selectedFloorId) && floors[0]?.id) {
      setSelectedFloorId(floors[0].id);
    }
  }, [floors, selectedFloorId, NONE]);

  useEffect(() => {
    setSelectedRoomId(NONE);
  }, [selectedFloorId, NONE]);

  async function callJson(path: string, method: string, body?: Record<string, unknown>) {
    const response = await fetch(path, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Request failed");
    }
    return data;
  }

  async function syncActivePreference(input: { locationId?: string | null; roomId?: string | null }) {
    try {
      await callJson("/api/preferences/active", "POST", {
        householdId,
        ...input,
      });
    } catch {
      // Non-blocking preference updates.
    }
  }

  async function loadSuggestions(containerId: string) {
    const params = new URLSearchParams({
      householdId,
      containerId,
    });
    const response = await fetch(`/api/suggestions?${params.toString()}`, {
      method: "GET",
      cache: "no-store",
    });
    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new Error(data?.error || "Unable to load suggestions");
    }
    const nextSuggestions = ((data?.suggestions || []) as Suggestion[]).sort(
      (left, right) =>
        Number(right.confidence ?? 0) - Number(left.confidence ?? 0) ||
        left.suggestedName.localeCompare(right.suggestedName),
    );
    setSuggestions(nextSuggestions);
  }

  async function createFloor() {
    if (!floorName.trim()) return;
    try {
      setBusyAction("floor");
      setMessage("");
      const data = await callJson("/api/household-canvas/layers", "POST", {
        householdId,
        name: floorName.trim(),
      });
      const nextFloor = data.layer as Floor;
      setFloors((prev) => sortFloors([...prev, nextFloor]));
      setSelectedFloorId(nextFloor.id);
      setFloorName("");
      if (nextFloor.locationId) {
        await syncActivePreference({ locationId: nextFloor.locationId, roomId: null });
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create floor");
    } finally {
      setBusyAction(null);
    }
  }

  async function createRoomForFloor() {
    if (!selectedFloor) {
      setMessage(tt("app.canvasSetup.messages.selectFloorFirst", "Select a floor first."));
      return;
    }
    if (!roomName.trim()) {
      setMessage(tt("app.canvasSetup.messages.roomNameRequired", "Room name is required."));
      return;
    }

    try {
      setBusyAction("room");
      setMessage("");
      const data = await callJson("/api/household-setup/room", "POST", {
        householdId,
        layerId: selectedFloor.id,
        name: roomName.trim(),
        description: roomDescription.trim() || undefined,
      });

      const room = data.room as {
        id: string;
        name: string;
        locationId: string;
        isSystem?: boolean;
      };
      const location = data.location as { id: string; name: string };

      setRooms((prev) => {
        if (prev.some((entry) => entry.id === room.id)) return prev;
        return [
          ...prev,
          {
            id: room.id,
            name: room.name,
            locationId: room.locationId,
            locationName: location.name,
            isSystem: Boolean(room.isSystem),
          },
        ];
      });
      setSelectedRoomId(room.id);
      setRoomName("");
      setRoomDescription("");
      await syncActivePreference({ roomId: room.id });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create room");
    } finally {
      setBusyAction(null);
    }
  }

  async function createContainerFromFlow() {
    if (!selectedFloor) {
      setMessage(tt("app.canvasSetup.messages.selectFloorFirst", "Select a floor first."));
      return;
    }
    if (!containerName.trim()) {
      setMessage(tt("app.canvasSetup.messages.containerNameRequired", "Container name is required."));
      return;
    }

    try {
      setBusyAction("container");
      setMessage("");
      const data = await callJson("/api/household-setup/container", "POST", {
        householdId,
        layerId: selectedFloor.id,
        roomId: selectedRoomId === NONE ? undefined : selectedRoomId,
        name: containerName.trim(),
        code: containerCode.trim() || undefined,
        description: containerDescription.trim() || undefined,
      });

      const container = data.container as CreatedContainerSummary;
      const room = data.room as { id: string; name: string; locationId: string };
      const location = data.location as { id: string; name: string };

      setContainers((prev) => [
        ...prev,
        {
          id: container.id,
          name: container.name,
          code: container.code,
          roomId: room.id,
          roomName: room.name,
          locationId: location.id,
          locationName: location.name,
        },
      ]);
      setCreatedContainer({
        id: container.id,
        name: container.name,
        code: container.code,
        roomId: room.id,
        roomName: room.name,
        locationId: location.id,
        locationName: location.name,
      });
      setContainerName("");
      setContainerCode("");
      setContainerDescription("");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to create container");
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSuggestion(id: string, action: "accept" | "reject") {
    try {
      setSuggestionBusyId(id);
      await callJson("/api/suggestions", "POST", {
        householdId,
        suggestionId: id,
        action,
      });
      setSuggestions((prev) =>
        prev.map((s) => (s.id === id ? { ...s, status: action === "accept" ? "accepted" : "rejected" } : s)),
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to update suggestion");
    } finally {
      setSuggestionBusyId(null);
    }
  }

  async function submitQuickAdd() {
    if (!createdContainer) return;
    try {
      setBusyAction("quick-add");
      await callJson("/api/scan/quick-add", "POST", {
        householdId,
        containerId: createdContainer.id,
        text: quickAddText,
      });
      setQuickAddText("");
      await loadSuggestions(createdContainer.id);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Quick add failed");
    } finally {
      setBusyAction(null);
    }
  }

  const mapRooms = rooms.filter((room) => room.locationId === selectedLocationId);
  const mapContainers = containers.filter((container) => container.locationId === selectedLocationId);

  return (
    <div className="space-y-6">
      <SectionDivider title="Floors" description="Select or create a floor." />
      <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
        <Select value={selectedFloorId} onValueChange={setSelectedFloorId}>
          <SelectTrigger className="h-9 w-full">
            <SelectValue placeholder={tt("app.canvasSetup.selectFloor", "Select floor")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>{tt("app.canvasSetup.selectFloor", "Select floor")}</SelectItem>
            {floors.map((floor) => (
              <SelectItem key={floor.id} value={floor.id}>
                {floor.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex gap-2">
          <Input
            value={floorName}
            onChange={(event) => setFloorName(event.target.value)}
            placeholder={tt("app.canvasSetup.newFloorName", "New floor name")}
          />
          <Button type="button" disabled={busyAction !== null} onClick={createFloor}>
            {busyAction === "floor" ? tt("app.canvasSetup.adding", "Adding...") : tt("app.canvasSetup.addFloor", "+ Floor")}
          </Button>
        </div>
      </div>

      <SectionDivider title="Rooms (optional)" />
      <div className="space-y-2">
        <Select
          value={selectedRoomId}
          onValueChange={async (nextRoomId) => {
            setSelectedRoomId(nextRoomId);
            if (nextRoomId !== NONE) {
              await syncActivePreference({ roomId: nextRoomId });
            } else if (selectedLocationId) {
              await syncActivePreference({ locationId: selectedLocationId, roomId: null });
            }
          }}
          disabled={!selectedFloorId || selectedFloorId === NONE}
        >
          <SelectTrigger className="h-9 w-full" disabled={!selectedFloorId || selectedFloorId === NONE}>
            <SelectValue placeholder={tt("app.canvasSetup.noRoomOption", "No room (use Unassigned)")} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={NONE}>
              {tt("app.canvasSetup.noRoomOption", "No room (use Unassigned)")}
            </SelectItem>
            {selectableRooms.map((room) => (
              <SelectItem key={room.id} value={room.id}>
                {room.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="grid gap-2 md:grid-cols-[1fr_1fr_auto]">
          <Input
            value={roomName}
            onChange={(event) => setRoomName(event.target.value)}
            placeholder={tt("app.canvasSetup.createRoom", "Create room")}
            disabled={!selectedFloorId}
          />
          <Input
            value={roomDescription}
            onChange={(event) => setRoomDescription(event.target.value)}
            placeholder={tt("app.canvasSetup.descriptionOptional", "Description (optional)")}
            disabled={!selectedFloorId}
          />
          <Button type="button" disabled={!selectedFloorId || busyAction !== null} onClick={createRoomForFloor}>
            {busyAction === "room"
              ? tt("app.canvasSetup.adding", "Adding...")
              : tt("app.canvasSetup.addRoom", "Add room")}
          </Button>
        </div>
      </div>

      <SectionDivider title="Create container" />
      <div className="grid gap-2 md:grid-cols-[1fr_130px_1fr_auto]">
        <Input
          value={containerName}
          onChange={(event) => setContainerName(event.target.value)}
          placeholder={tt("app.canvasSetup.containerName", "Container name")}
          disabled={!selectedFloorId}
        />
        <Input
          value={containerCode}
          onChange={(event) => setContainerCode(event.target.value)}
          placeholder={tt("app.canvasSetup.code", "Code")}
          disabled={!selectedFloorId}
        />
        <Input
          value={containerDescription}
          onChange={(event) => setContainerDescription(event.target.value)}
          placeholder={tt("app.canvasSetup.descriptionOptional", "Description (optional)")}
          disabled={!selectedFloorId}
        />
        <Button
          type="button"
          disabled={!selectedFloorId || busyAction !== null}
          onClick={createContainerFromFlow}
          data-testid="setup-create-container"
        >
          {busyAction === "container"
            ? tt("app.canvasSetup.creating", "Creating...")
            : tt("app.canvasSetup.createContainer", "Create container")}
        </Button>
      </div>

      {message ? <div className="text-xs text-muted-foreground">{message}</div> : null}

      {createdContainer ? (
        <div className="space-y-3 rounded-md border p-4" data-testid="setup-post-create-panel">
          <div className="text-sm font-semibold">
            {tt("app.canvasSetup.createdTitle", "Container created: {name}").replace(
              "{name}",
              createdContainer.name,
            )}
          </div>
          <div className="text-xs text-muted-foreground">
            {createdContainer.locationName} / {createdContainer.roomName}
            {createdContainer.code ? ` | ${createdContainer.code}` : ""}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tt("app.canvasSetup.optionalPhotos", "Optional: Add photos for AI capture")}
            </div>
            <PhotoUploader
              householdId={householdId}
              entityType="container"
              entityId={createdContainer.id}
              analyzeBatchOnComplete
              onUploaded={() => {
                loadSuggestions(createdContainer.id).catch(() => null);
              }}
            />
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tt("app.canvasSetup.aiSuggestions", "AI suggestions")}
            </div>
            {suggestions.length === 0 ? (
              <div className="text-xs text-muted-foreground">
                {tt(
                  "app.canvasSetup.noSuggestions",
                  "No suggestions yet. Upload photos to trigger analysis.",
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <div key={suggestion.id} className="rounded-md border p-2">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <div className="font-medium">{suggestion.suggestedName}</div>
                      <div className="text-xs text-muted-foreground">
                        {Math.round(Number(suggestion.confidence ?? 0) * 100)}%
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {tt("app.canvasSetup.qty", "Qty")}: {suggestion.suggestedQty ?? 1} |{" "}
                      {tt("app.canvasSetup.tags", "Tags")}: {(suggestion.suggestedTags || []).join(", ") || "-"} |{" "}
                      {tt("app.canvasSetup.status", "Status")}: {suggestion.status}
                    </div>
                    {suggestion.status === "pending" ? (
                      <div className="mt-2 flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          disabled={suggestionBusyId === suggestion.id}
                          onClick={() => updateSuggestion(suggestion.id, "accept")}
                        >
                          {tt("app.canvasSetup.accept", "Accept")}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          disabled={suggestionBusyId === suggestion.id}
                          onClick={() => updateSuggestion(suggestion.id, "reject")}
                        >
                          {tt("app.canvasSetup.reject", "Reject")}
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="space-y-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tt("app.canvasSetup.optionalQuickAdd", "Optional: Quick add items now")}
            </div>
            <Textarea
              value={quickAddText}
              onChange={(event) => setQuickAddText(event.target.value)}
              placeholder={tt("app.canvasSetup.quickAddPlaceholder", "2 HDMI cables, 1 powerbank")}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={busyAction !== null || !quickAddText.trim()}
                onClick={submitQuickAdd}
              >
                {busyAction === "quick-add"
                  ? tt("app.canvasSetup.adding", "Adding...")
                  : tt("app.canvasSetup.addItems", "Add items")}
              </Button>
              <Button asChild type="button" variant="outline">
                <Link href={`/${locale}/boxes/${createdContainer.id}`}>
                  {tt("app.canvasSetup.openBox", "Open box")}
                </Link>
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setCreatedContainer(null);
                  setSuggestions([]);
                  setQuickAddText("");
                }}
              >
                {tt("app.canvasSetup.createAnother", "Create another")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setCreatedContainer(null);
                  setSuggestions([]);
                  setQuickAddText("");
                }}
              >
                {tt("app.canvasSetup.doneNow", "Done for now")}
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <SectionDivider title={tt("app.canvasSetup.readOnlyMapTitle", "Read-only map")} />
      <HouseholdMapPreview
        floorName={selectedFloor?.name || tt("app.canvasSetup.noFloorSelected", "No floor selected")}
        locationId={selectedLocationId}
        rooms={mapRooms}
        containers={mapContainers}
        onOpenBox={(containerId) => {
          router.push(`/${locale}/boxes/${containerId}`);
        }}
      />

      <div className="text-xs text-muted-foreground">
        {tt("app.canvasSetup.householdLabel", "Household")}: {householdName}
      </div>
    </div>
  );
}
