"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Home } from "lucide-react";

import { HouseholdMapPreview } from "@/components/inventory/household-canvas/HouseholdMapPreview";
import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { setActivePreferenceAction } from "@/lib/actions/preferences";
import { quickAddAction } from "@/lib/actions/scan";
import {
  analyzeContainerPhotosAction,
  updateSuggestionAction,
} from "@/lib/actions/suggestions";
import {
  createFloorAction,
  createSetupContainerAction,
  createSetupRoomAction,
} from "@/lib/actions/householdSetup";
import { useBusyCursor } from "@/hooks/useBusyCursor";

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

const NONE = "__none__";

function sortFloors(floors: Floor[]) {
  return [...floors].sort(
    (left, right) =>
      left.sortOrder - right.sortOrder || left.name.localeCompare(right.name),
  );
}

export function HouseholdSetupFlow({
  locale,
  householdId,
  floors: initialFloors,
  rooms: initialRooms,
  containers: initialContainers,
}: {
  locale: string;
  householdId: string;
  floors: Floor[];
  rooms: RoomOption[];
  containers: ContainerOption[];
}) {
  const router = useRouter();
  const { t } = useI18n();

  const [floors, setFloors] = useState(sortFloors(initialFloors));
  const [rooms, setRooms] = useState(initialRooms);
  const [containers, setContainers] = useState(initialContainers);
  const [selectedFloorId, setSelectedFloorId] = useState<string>(
    initialFloors[0]?.id || NONE,
  );
  const [selectedRoomId, setSelectedRoomId] = useState<string>(NONE);
  const [floorName, setFloorName] = useState("");
  const [roomName, setRoomName] = useState("");
  const [roomDescription, setRoomDescription] = useState("");
  const [containerName, setContainerName] = useState("");
  const [containerCode, setContainerCode] = useState("");
  const [containerDescription, setContainerDescription] = useState("");
  const [quickAddText, setQuickAddText] = useState("");
  const [busyAction, setBusyAction] = useState<
    null | "floor" | "room" | "container" | "quick-add"
  >(null);
  const [floorNameError, setFloorNameError] = useState<string | null>(null);
  const [roomNameError, setRoomNameError] = useState<string | null>(null);
  const [containerNameError, setContainerNameError] = useState<string | null>(null);
  const [quickAddTextError, setQuickAddTextError] = useState<string | null>(null);
  const [floorError, setFloorError] = useState<string | null>(null);
  const [roomError, setRoomError] = useState<string | null>(null);
  const [containerError, setContainerError] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [suggestionError, setSuggestionError] = useState<string | null>(null);
  const [createdContainer, setCreatedContainer] =
    useState<CreatedContainerSummary | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionBusyId, setSuggestionBusyId] = useState<string | null>(null);
  const [pendingAnalyze, setPendingAnalyze] = useState(false);
  const [showFloorCreate, setShowFloorCreate] = useState(
    initialFloors.length === 0,
  );
  const [showRoomCreate, setShowRoomCreate] = useState(false);
  const [isToolsOpenMobile, setIsToolsOpenMobile] = useState(false);

  const tt = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  useBusyCursor(busyAction !== null || suggestionBusyId !== null || pendingAnalyze);

  const selectedFloor =
    selectedFloorId === NONE
      ? null
      : floors.find((floor) => floor.id === selectedFloorId) || null;
  const selectedLocationId = selectedFloor
    ? selectedFloor.locationId ?? selectedFloor.id
    : null;

  const selectableRooms = useMemo(
    () =>
      rooms
        .filter(
          (room) => room.locationId === selectedLocationId && !room.isSystem,
        )
        .sort((left, right) => left.name.localeCompare(right.name)),
    [rooms, selectedLocationId],
  );
  const mapRooms = useMemo(
    () => rooms.filter((room) => room.locationId === selectedLocationId),
    [rooms, selectedLocationId],
  );
  const mapContainers = useMemo(
    () =>
      containers.filter((container) => container.locationId === selectedLocationId),
    [containers, selectedLocationId],
  );
  const selectedRoomLabel =
    selectedRoomId === NONE
      ? tt("app.canvasSetup.noRoomOption", "No room (use Unassigned)")
      : selectableRooms.find((room) => room.id === selectedRoomId)?.name ||
        tt("app.canvasSetup.noRoomOption", "No room (use Unassigned)");

  useEffect(() => {
    if (!floors.length) {
      setSelectedFloorId(NONE);
      setSelectedRoomId(NONE);
      return;
    }

    const currentExists = floors.some((floor) => floor.id === selectedFloorId);
    if (!currentExists || selectedFloorId === NONE) {
      const first = floors[0];
      if (!first) return;
      setSelectedFloorId(first.id);
    }
  }, [floors, selectedFloorId]);

  useEffect(() => {
    if (selectedRoomId === NONE || !selectedLocationId) return;
    const exists = rooms.some(
      (room) =>
        room.id === selectedRoomId && room.locationId === selectedLocationId,
    );
    if (!exists) {
      setSelectedRoomId(NONE);
    }
  }, [rooms, selectedRoomId, selectedLocationId]);

  useEffect(() => {
    if (!selectedFloor || selectedRoomId !== NONE) return;
    if (selectableRooms.length === 0) {
      setShowRoomCreate(true);
    }
  }, [selectedFloor, selectedRoomId, selectableRooms.length]);

  async function syncActivePreference(input: {
    locationId?: string | null;
    roomId?: string | null;
  }) {
    try {
      const result = await setActivePreferenceAction({ householdId, ...input });
      if (!result.ok) {
        console.error(result.error);
      }
    } catch {
      // Non-blocking preference updates.
    }
  }

  async function handleFloorChange(nextFloorId: string) {
    setSelectedFloorId(nextFloorId);
    setSelectedRoomId(NONE);

    if (nextFloorId === NONE) {
      return;
    }

    const floor = floors.find((entry) => entry.id === nextFloorId);
    const locationId = floor?.locationId ?? floor?.id ?? null;
    if (locationId) {
      await syncActivePreference({ locationId, roomId: null });
    }
  }

  async function handleRoomChange(nextRoomId: string) {
    setSelectedRoomId(nextRoomId);
    if (nextRoomId !== NONE) {
      await syncActivePreference({ roomId: nextRoomId });
      return;
    }

    if (selectedLocationId) {
      await syncActivePreference({ locationId: selectedLocationId, roomId: null });
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
    if (!floorName.trim()) {
      setFloorNameError(
        tt(
          "app.canvasSetup.messages.floorNameRequired",
          "Floor name is required.",
        ),
      );
      return;
    }
    try {
      setBusyAction("floor");
      setFloorError(null);
      setFloorNameError(null);
      const result = await createFloorAction({
        householdId,
        name: floorName.trim(),
        sortOrder: floors.length,
      });
      if (!result.ok) {
        if (result.fieldErrors?.name) {
          setFloorNameError(result.fieldErrors.name);
        }
        throw new Error(result.error);
      }
      const nextFloor = result.floor as Floor;
      setFloors((prev) => sortFloors([...prev, nextFloor]));
      setSelectedFloorId(nextFloor.id);
      setSelectedRoomId(NONE);
      setFloorName("");
      setShowFloorCreate(false);
      setShowRoomCreate(true);
      const locationId = nextFloor.locationId ?? nextFloor.id;
      await syncActivePreference({
        locationId,
        roomId: null,
      });
    } catch (error) {
      setFloorError(
        error instanceof Error ? error.message : "Unable to create floor",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function createRoomForFloor() {
    if (!selectedFloor) {
      setRoomError(
        tt(
          "app.canvasSetup.messages.selectFloorFirst",
          "Select a floor first.",
        ),
      );
      return;
    }
    if (!roomName.trim()) {
      setRoomNameError(
        tt(
          "app.canvasSetup.messages.roomNameRequired",
          "Room name is required.",
        ),
      );
      return;
    }

    try {
      setBusyAction("room");
      setRoomError(null);
      setRoomNameError(null);
      const result = await createSetupRoomAction({
        householdId,
        floorId: selectedFloor.id,
        name: roomName.trim(),
        description: roomDescription.trim() || undefined,
      });
      if (!result.ok) {
        if (result.fieldErrors?.name) {
          setRoomNameError(result.fieldErrors.name);
        }
        throw new Error(result.error);
      }
      const { room: rawRoom, location: rawLocation } = result;

      const room = rawRoom as {
        id: string;
        name: string;
        locationId: string;
        isSystem?: boolean;
      };
      const location = rawLocation as { id: string; name: string };

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
      setShowRoomCreate(false);
      await syncActivePreference({ roomId: room.id });
    } catch (error) {
      setRoomError(
        error instanceof Error ? error.message : "Unable to create room",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function createContainerFromFlow() {
    if (!selectedFloor) {
      setContainerError(
        tt(
          "app.canvasSetup.messages.selectFloorFirst",
          "Select a floor first.",
        ),
      );
      return;
    }
    if (!containerName.trim()) {
      setContainerNameError(
        tt(
          "app.canvasSetup.messages.containerNameRequired",
          "Container name is required.",
        ),
      );
      return;
    }

    try {
      setBusyAction("container");
      setContainerError(null);
      setContainerNameError(null);
      const result = await createSetupContainerAction({
        householdId,
        floorId: selectedFloor.id,
        roomId: selectedRoomId === NONE ? undefined : selectedRoomId,
        name: containerName.trim(),
        code: containerCode.trim() || undefined,
        description: containerDescription.trim() || undefined,
      });
      if (!result.ok) {
        if (result.fieldErrors?.name) {
          setContainerNameError(result.fieldErrors.name);
        }
        throw new Error(result.error);
      }
      const { container, room, location } = result;

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
      if (window.matchMedia("(max-width: 1023px)").matches) {
        setIsToolsOpenMobile(true);
      }
    } catch (error) {
      setContainerError(
        error instanceof Error ? error.message : "Unable to create container",
      );
    } finally {
      setBusyAction(null);
    }
  }

  async function updateSuggestion(id: string, action: "accept" | "reject") {
    try {
      setSuggestionBusyId(id);
      const res = await updateSuggestionAction({
        householdId,
        suggestionId: id,
        action,
      });
      if (!res.ok) {
        throw new Error(res.error);
      }
      setSuggestions((prev) =>
        prev.map((s) =>
          s.id === id
            ? { ...s, status: action === "accept" ? "accepted" : "rejected" }
            : s,
        ),
      );
    } catch (error) {
      setQuickAddError(
        error instanceof Error ? error.message : "Unable to update suggestion",
      );
    } finally {
      setSuggestionBusyId(null);
    }
  }

  async function submitQuickAdd() {
    if (!createdContainer) return;
    if (!quickAddText.trim()) {
      setQuickAddTextError(
        tt("app.canvasSetup.messages.quickAddRequired", "Enter at least one item."),
      );
      return;
    }
    try {
      setBusyAction("quick-add");
      setQuickAddError(null);
      setQuickAddTextError(null);
      const res = await quickAddAction({
        householdId,
        containerId: createdContainer.id,
        text: quickAddText,
      });
      if (!res.ok) {
        if (res.fieldErrors?.text) {
          setQuickAddTextError(res.fieldErrors.text);
        }
        throw new Error(res.error);
      }
      setQuickAddText("");
      await loadSuggestions(createdContainer.id);
    } catch (error) {
      setQuickAddError(error instanceof Error ? error.message : "Quick add failed");
    } finally {
      setBusyAction(null);
    }
  }

  function resetCreatedPanel() {
    setCreatedContainer(null);
    setSuggestions([]);
    setQuickAddText("");
    setQuickAddError(null);
    setQuickAddTextError(null);
    setSuggestionError(null);
  }

  async function analyzeCreatedContainer() {
    if (!createdContainer) return;

    try {
      setPendingAnalyze(true);
      setSuggestionError(null);
      const result = await analyzeContainerPhotosAction({
        householdId,
        containerId: createdContainer.id,
        maxPhotos: 10,
        replacePending: true,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      console.info("[HouseholdSetupFlow] analyze completed", {
        householdId,
        containerId: createdContainer.id,
        photosAnalyzed: Number(result.photosAnalyzed ?? 0),
        suggestionsCount: Number(result.suggestionsCount ?? 0),
      });
      await loadSuggestions(createdContainer.id);
    } catch (error) {
      setSuggestionError(
        error instanceof Error ? error.message : "Analyze failed",
      );
    } finally {
      setPendingAnalyze(false);
    }
  }

  function handleMapRoomSelect(roomId: string) {
    const room = selectableRooms.find((entry) => entry.id === roomId);
    if (!room) return;
    setSelectedRoomId(room.id);
    void syncActivePreference({ roomId: room.id });
  }

  function renderPostCreatePanel(withTestIds: boolean) {
    if (!createdContainer) {
      return (
        <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
          {tt(
            "app.canvasSetup.postCreateEmpty",
            "Create a container to unlock photo upload, suggestions, and quick add.",
          )}
        </div>
      );
    }

    return (
      <div
        className="space-y-3 rounded-md border p-4"
        data-testid={withTestIds ? "setup-post-create-panel" : undefined}
      >
        <div className="text-sm font-semibold">
          {tt(
            "app.canvasSetup.createdTitle",
            "Container created: {name}",
          ).replace("{name}", createdContainer.name)}
        </div>
        <div className="text-xs text-muted-foreground">
          {createdContainer.locationName} / {createdContainer.roomName}
          {createdContainer.code ? ` | ${createdContainer.code}` : ""}
        </div>

        <div className="space-y-2">
          <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            {tt(
              "app.canvasSetup.optionalPhotos",
              "Optional: Add photos for AI capture",
            )}
          </div>
          <PhotoUploader
            householdId={householdId}
            entityType="container"
            entityId={createdContainer.id}
            onUploaded={() => {
              loadSuggestions(createdContainer.id).catch((error) => {
                setSuggestionError(
                  error instanceof Error
                    ? error.message
                    : "Unable to load suggestions",
                );
              });
            }}
          />
        </div>

        <div className="space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {tt("app.canvasSetup.aiSuggestions", "AI suggestions")}
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              loading={pendingAnalyze}
              loadingText={tt("app.canvasSetup.analyzing", "Analyzing...")}
              disabled={pendingAnalyze}
              onClick={analyzeCreatedContainer}
            >
              {tt("app.canvasSetup.analyzePhotos", "Analyze photos")}
            </Button>
          </div>
          <FormSubmitError error={suggestionError} title="Suggestion analysis failed" />
          {suggestions.length === 0 ? (
            <div className="text-xs text-muted-foreground">
              {tt(
                "app.canvasSetup.noSuggestions",
                "No suggestions yet. Upload photos, then click Analyze photos.",
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
                    {tt("app.canvasSetup.qty", "Qty")}:{" "}
                    {suggestion.suggestedQty ?? 1} |{" "}
                    {tt("app.canvasSetup.tags", "Tags")}:{" "}
                    {(suggestion.suggestedTags || []).join(", ") || "-"} |{" "}
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
            {tt(
              "app.canvasSetup.optionalQuickAdd",
              "Optional: Quick add items now",
            )}
          </div>
          <Textarea
            value={quickAddText}
            onChange={(event) => {
              setQuickAddText(event.target.value);
              if (quickAddTextError) setQuickAddTextError(null);
              if (quickAddError) setQuickAddError(null);
            }}
            placeholder={tt(
              "app.canvasSetup.quickAddPlaceholder",
              "2 HDMI cables, 1 powerbank",
            )}
            aria-invalid={quickAddTextError ? true : undefined}
          />
          <FormFieldError error={quickAddTextError} />
          <FormSubmitError error={quickAddError} title="Quick add failed" />
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              loading={busyAction === "quick-add"}
              loadingText={tt("app.canvasSetup.adding", "Adding...")}
              disabled={busyAction !== null || !quickAddText.trim()}
              onClick={submitQuickAdd}
            >
              {tt("app.canvasSetup.addItems", "Add items")}
            </Button>
            <Button asChild type="button" variant="outline">
              <Link href={`/${locale}/boxes/${createdContainer.id}`}>
                {tt("app.canvasSetup.openBox", "Open box")}
              </Link>
            </Button>
            <Button type="button" variant="outline" onClick={resetCreatedPanel}>
              {tt("app.canvasSetup.createAnother", "Create another")}
            </Button>
            <Button type="button" variant="ghost" onClick={resetCreatedPanel}>
              {tt("app.canvasSetup.doneNow", "Done for now")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  function renderTools(withTestIds: boolean) {
    const step1Done = floors.length > 0 && selectedFloorId !== NONE;
    const step2Done = selectableRooms.length > 0;
    const step3Done = createdContainer !== null;
    const currentStep = !step1Done ? 1 : !step2Done ? 2 : !step3Done ? 3 : 4;

    const progressSteps = [
      { label: tt("app.canvasSetup.step1Short", "Floor"), done: step1Done, active: currentStep === 1 },
      { label: tt("app.canvasSetup.step2Short", "Room"), done: step2Done, active: currentStep === 2 },
      { label: tt("app.canvasSetup.step3Short", "Box"), done: step3Done, active: currentStep === 3 },
      { label: tt("app.canvasSetup.step4Short", "Items"), done: false, active: currentStep === 4 },
    ];

    return (
      <div className="space-y-4">
        <div className="space-y-3">
          <span className="text-sm font-semibold">{tt("app.canvasSetup.toolsTitle", "Setup panel")}</span>
          <div className="flex items-end">
            {progressSteps.map((step, i) => (
              <Fragment key={step.label}>
                <div className="flex flex-col items-center gap-1">
                  <div className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    step.done
                      ? "bg-primary text-primary-foreground"
                      : step.active
                      ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/40"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {step.done ? "✓" : i + 1}
                  </div>
                  <span className={`text-[10px] leading-none ${step.done || step.active ? "text-foreground" : "text-muted-foreground"}`}>
                    {step.label}
                  </span>
                </div>
                {i < progressSteps.length - 1 && (
                  <div className={`mx-1 mb-4 h-px flex-1 transition-colors ${step.done ? "bg-primary" : "bg-border"}`} />
                )}
              </Fragment>
            ))}
          </div>
        </div>

        <div
          className="space-y-3 border-t border-border/60 pt-3"
          aria-label={tt("app.canvasSetup.step2", "Step 2: Rooms")}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              !selectedFloor ? "bg-muted text-muted-foreground" : selectableRooms.length > 0 ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"
            }`}>
              {selectableRooms.length > 0 ? "✓" : "2"}
            </div>
            <span className={`text-sm font-medium ${!selectedFloor ? "text-muted-foreground" : ""}`}>
              {tt("app.canvasSetup.step2", "Step 2: Rooms")}
            </span>
            <div className="flex-1" />
            <Button type="button" variant="ghost" size="sm" onClick={() => setShowRoomCreate((c) => !c)} disabled={!selectedFloor}>
              {showRoomCreate ? tt("app.canvasSetup.hideNewRoom", "Hide add room") : tt("app.canvasSetup.showNewRoom", "Add room")}
            </Button>
          </div>
          {!selectedFloor ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              {tt(
                "app.canvasSetup.messages.selectFloorFirst",
                "Select a floor first.",
              )}
            </div>
          ) : (
            <>
              <Select
                value={selectedRoomId}
                onValueChange={(nextRoomId) => {
                  void handleRoomChange(nextRoomId);
                }}
              >
                <SelectTrigger className="h-9 w-full">
                  <SelectValue
                    placeholder={tt(
                      "app.canvasSetup.noRoomOption",
                      "No room (use Unassigned)",
                    )}
                  />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>
                    {tt(
                      "app.canvasSetup.noRoomOption",
                      "No room (use Unassigned)",
                    )}
                  </SelectItem>
                  {selectableRooms.map((room) => (
                    <SelectItem key={room.id} value={room.id}>
                      {room.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {showRoomCreate ? (
                <>
                  <Input
                    value={roomName}
                    onChange={(event) => {
                      setRoomName(event.target.value);
                      if (roomNameError) setRoomNameError(null);
                      if (roomError) setRoomError(null);
                    }}
                    placeholder={tt("app.canvasSetup.createRoom", "Create room")}
                    disabled={busyAction !== null}
                    aria-invalid={roomNameError ? true : undefined}
                  />
                  <FormFieldError error={roomNameError} />
                  <Input
                    value={roomDescription}
                    onChange={(event) => setRoomDescription(event.target.value)}
                    placeholder={tt(
                      "app.canvasSetup.descriptionOptional",
                      "Description (optional)",
                    )}
                    disabled={busyAction !== null}
                  />
                  <FormSubmitError error={roomError} title="Unable to create room" />
                  <Button
                    type="button"
                    loading={busyAction === "room"}
                    loadingText={tt("app.canvasSetup.adding", "Adding...")}
                    disabled={busyAction !== null}
                    onClick={createRoomForFloor}
                  >
                    {tt("app.canvasSetup.addRoom", "Add room")}
                  </Button>
                </>
              ) : null}
            </>
          )}
        </div>

        <div
          className="space-y-3 border-t border-border/60 pt-3"
          aria-label={tt("app.canvasSetup.step3", "Step 3: Container")}
        >
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              !selectedFloor ? "bg-muted text-muted-foreground" : mapContainers.length > 0 ? "bg-primary text-primary-foreground" : "bg-primary/20 text-primary"
            }`}>
              {mapContainers.length > 0 ? "✓" : "3"}
            </div>
            <span className={`text-sm font-medium ${!selectedFloor ? "text-muted-foreground" : ""}`}>
              {tt("app.canvasSetup.step3", "Step 3: Container")}
            </span>
          </div>
          {!selectedFloor ? (
            <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
              {tt(
                "app.canvasSetup.messages.selectFloorFirst",
                "Select a floor first.",
              )}
            </div>
          ) : (
            <>
              <div className="text-xs text-muted-foreground">
                {tt("app.canvasSetup.tool.room", "Room")}: {selectedRoomLabel}
              </div>
              <Input
                value={containerName}
                onChange={(event) => {
                  setContainerName(event.target.value);
                  if (containerNameError) setContainerNameError(null);
                  if (containerError) setContainerError(null);
                }}
                placeholder={tt("app.canvasSetup.containerName", "Container name")}
                disabled={busyAction !== null}
                aria-invalid={containerNameError ? true : undefined}
              />
              <FormFieldError error={containerNameError} />
              <Input
                value={containerCode}
                onChange={(event) => setContainerCode(event.target.value)}
                placeholder={tt("app.canvasSetup.code", "Code")}
                disabled={busyAction !== null}
              />
              <Input
                value={containerDescription}
                onChange={(event) => setContainerDescription(event.target.value)}
                placeholder={tt(
                  "app.canvasSetup.descriptionOptional",
                  "Description (optional)",
                )}
                disabled={busyAction !== null}
              />
              <FormSubmitError
                error={containerError}
                title="Unable to create container"
              />
              <Button
                type="button"
                loading={busyAction === "container"}
                loadingText={tt("app.canvasSetup.creating", "Creating...")}
                disabled={busyAction !== null}
                onClick={createContainerFromFlow}
                data-testid={withTestIds ? "setup-create-container" : undefined}
              >
                {tt("app.canvasSetup.createContainer", "Create container")}
              </Button>
            </>
          )}
        </div>

        <div className="space-y-3 border-t border-border/60 pt-3">
          <div className="flex items-center gap-2">
            <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
              step3Done ? "bg-primary/15 text-primary ring-1 ring-inset ring-primary/40" : "bg-muted text-muted-foreground"
            }`}>
              4
            </div>
            <span className={`text-sm font-medium ${step3Done ? "" : "text-muted-foreground"}`}>
              {tt("app.canvasSetup.step4", "Step 4: Items")}
            </span>
          </div>
          {renderPostCreatePanel(withTestIds)}
        </div>
      </div>
    );
  }
  return (
    <div className="space-y-4 pb-20 lg:pb-0">
      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        <section className="space-y-4">
          {floors.length === 0 ? (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-dashed bg-muted/20 py-14 px-8 text-center">
              <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                <Home className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <div className="text-base font-semibold">Your canvas is empty</div>
                <div className="mt-1 text-sm text-muted-foreground">Start by naming your first floor — e.g. "Ground floor" or "Garage".</div>
              </div>
              <div className="flex w-full max-w-sm gap-2">
                <Input
                  value={floorName}
                  onChange={(e) => { setFloorName(e.target.value); if (floorNameError) setFloorNameError(null); if (floorError) setFloorError(null); }}
                  placeholder={tt("app.canvasSetup.newFloorName", "New floor name")}
                  aria-invalid={floorNameError ? true : undefined}
                  onKeyDown={(e) => { if (e.key === "Enter") void createFloor(); }}
                />
                <Button
                  type="button"
                  loading={busyAction === "floor"}
                  loadingText={tt("app.canvasSetup.adding", "Adding...")}
                  disabled={busyAction !== null}
                  onClick={createFloor}
                >
                  {tt("app.canvasSetup.addFloor", "Add floor")}
                </Button>
              </div>
              <FormFieldError error={floorNameError} />
              <FormSubmitError error={floorError} title="Unable to create floor" />
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <SectionDivider
                  title={tt("app.canvasSetup.step1", "Step 1: Floors")}
                  description={tt(
                    "app.canvasSetup.step1Hint",
                    "Pick or create a floor before adding rooms and containers.",
                  )}
                  actions={
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowFloorCreate((current) => !current)}
                    >
                      {showFloorCreate
                        ? tt("app.canvasSetup.hideNewFloor", "Hide add floor")
                        : tt("app.canvasSetup.showNewFloor", "Add floor")}
                    </Button>
                  }
                />
                {floors.length > 5 ? (
                  <Select
                    value={selectedFloorId}
                    onValueChange={(value) => {
                      void handleFloorChange(value);
                    }}
                  >
                    <SelectTrigger className="h-9 w-full">
                      <SelectValue
                        placeholder={tt("app.canvasSetup.selectFloor", "Select floor")}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={NONE}>
                        {tt("app.canvasSetup.selectFloor", "Select floor")}
                      </SelectItem>
                      {floors.map((floor) => (
                        <SelectItem key={floor.id} value={floor.id}>
                          {floor.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {floors.map((floor) => (
                      <button
                        key={floor.id}
                        type="button"
                        onClick={() => void handleFloorChange(floor.id)}
                        className={`rounded-full border px-3 py-1 text-sm font-medium transition ${
                          selectedFloorId === floor.id
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-muted text-muted-foreground hover:bg-muted/80"
                        }`}
                      >
                        {floor.name}
                      </button>
                    ))}
                    {floors.length === 0 ? (
                      <span className="text-sm text-muted-foreground">{tt("app.canvasSetup.selectFloor", "Select floor")}</span>
                    ) : null}
                  </div>
                )}
                {showFloorCreate ? (
                  <div className="space-y-2">
                    <div className="flex gap-2">
                      <Input
                        value={floorName}
                        onChange={(event) => {
                          setFloorName(event.target.value);
                          if (floorNameError) setFloorNameError(null);
                          if (floorError) setFloorError(null);
                        }}
                        placeholder={tt("app.canvasSetup.newFloorName", "New floor name")}
                        aria-invalid={floorNameError ? true : undefined}
                      />
                      <Button
                        type="button"
                        loading={busyAction === "floor"}
                        loadingText={tt("app.canvasSetup.adding", "Adding...")}
                        disabled={busyAction !== null}
                        onClick={createFloor}
                      >
                        {tt("app.canvasSetup.addFloor", "+ Floor")}
                      </Button>
                    </div>
                    <FormFieldError error={floorNameError} />
                    <FormSubmitError error={floorError} title="Unable to create floor" />
                  </div>
                ) : null}
              </div>

              <HouseholdMapPreview
                floorName={
                  selectedFloor?.name ||
                  tt("app.canvasSetup.noFloorSelected", "No floor selected")
                }
                locationId={selectedLocationId}
                rooms={mapRooms}
                containers={mapContainers}
                selectedRoomId={selectedRoomId === NONE ? null : selectedRoomId}
                onSelectRoom={handleMapRoomSelect}
                onOpenBox={(containerId) => {
                  router.push(`/${locale}/boxes/${containerId}`);
                }}
              />
            </>
          )}
        </section>

        <aside className="hidden lg:sticky lg:top-20 lg:block lg:border-l lg:border-border/60 lg:pl-4">
          {renderTools(true)}
        </aside>
      </div>

      <div className="fixed bottom-4 right-4 z-40 lg:hidden">
        <Button
          type="button"
          size="sm"
          onClick={() => setIsToolsOpenMobile(true)}
        >
          {!selectedFloor
            ? tt("app.canvasSetup.getStarted", "Get started")
            : selectableRooms.length === 0
            ? tt("app.canvasSetup.showNewRoom", "Add room")
            : tt("app.canvasSetup.openTools", "Add container")}
        </Button>
      </div>

      <Sheet open={isToolsOpenMobile} onOpenChange={setIsToolsOpenMobile}>
        <SheetContent side="bottom" className="max-h-[90vh] overflow-y-auto p-4">
          <SheetHeader className="mb-2 pr-8 text-left">
            <SheetTitle>
              {tt("app.canvasSetup.toolsTitle", "Setup panel")}
            </SheetTitle>
            <SheetDescription>
              {tt(
                "app.canvasSetup.closeTools",
                "Close tools to keep working on the map.",
              )}
            </SheetDescription>
          </SheetHeader>
          {renderTools(false)}
        </SheetContent>
      </Sheet>
    </div>
  );
}
