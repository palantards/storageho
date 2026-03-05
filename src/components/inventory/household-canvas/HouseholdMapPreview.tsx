"use client";

import {
  buildReadOnlyMapGroups,
  canSelectSetupMapRoom,
} from "@/lib/inventory/household-setup-map";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { useI18n } from "@/components/i18n/I18nProvider";
import { Button } from "@/components/ui/button";

type PreviewRoom = {
  id: string;
  name: string;
  locationId: string;
  isSystem: boolean;
};

type PreviewContainer = {
  id: string;
  name: string;
  code: string | null;
  roomId: string;
  locationId: string;
};

export function HouseholdMapPreview({
  floorName,
  locationId,
  rooms,
  containers,
  selectedRoomId,
  onSelectRoom,
  onOpenBox,
}: {
  floorName: string;
  locationId: string | null;
  rooms: PreviewRoom[];
  containers: PreviewContainer[];
  selectedRoomId?: string | null;
  onSelectRoom?: (roomId: string) => void;
  onOpenBox?: (containerId: string) => void;
}) {
  const { t } = useI18n();
  const tt = (key: string, fallback: string) => {
    const value = t(key);
    return value === key ? fallback : value;
  };

  if (!locationId) {
    return (
      <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
        {tt("app.canvasSetup.noLinkedLocation", "Select a floor to preview its rooms and boxes.")}
      </div>
    );
  }

  const groups = buildReadOnlyMapGroups({
    locationId,
    rooms,
    containers,
    unassignedLabel: tt("app.canvasSetup.unassigned", "Unassigned"),
  });

  return (
    <div
      className="space-y-3"
      data-testid="household-readonly-map"
    >
      <SectionDivider
        title={tt("app.canvasSetup.previewTitle", "Overview")}
        actions={<span className="text-xs text-muted-foreground">{floorName}</span>}
      />

      {groups.length === 0 ? (
        <div className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
          {tt("app.canvasSetup.noRoomsOrContainers", "No rooms or containers on this floor yet.")}
        </div>
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {groups.map((group) => (
            <section
              key={group.roomId}
              className={`rounded-md border bg-background p-3 ${
                selectedRoomId === group.roomId
                  ? "border-primary ring-1 ring-primary/50"
                  : ""
              }`}
              data-testid="household-map-room-group"
              onClick={() => {
                if (canSelectSetupMapRoom(group.roomId)) {
                  onSelectRoom?.(group.roomId);
                }
              }}
              onKeyDown={(event) => {
                if (
                  canSelectSetupMapRoom(group.roomId) &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault();
                  onSelectRoom?.(group.roomId);
                }
              }}
              role={canSelectSetupMapRoom(group.roomId) ? "button" : undefined}
              tabIndex={canSelectSetupMapRoom(group.roomId) ? 0 : undefined}
            >
              <div className="mb-2 flex items-center justify-between">
                <h3 className="text-sm font-medium">{group.roomName}</h3>
                <span className="text-xs text-muted-foreground">
                  {group.containers.length} {tt("app.canvasSetup.boxesLabel", "boxes")}
                </span>
              </div>

              {group.containers.length === 0 ? (
                <div className="text-xs text-muted-foreground">
                  {tt("app.canvasSetup.noBoxesYet", "No boxes yet.")}
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-2 xl:grid-cols-3">
                  {group.containers.map((container) => (
                    <button
                      key={container.id}
                      type="button"
                      className="rounded border px-2 py-2 text-left text-xs hover:border-primary/60"
                      onClick={(event) => {
                        event.stopPropagation();
                        onOpenBox?.(container.id);
                      }}
                    >
                      <div className="truncate font-medium">{container.name}</div>
                      <div className="truncate text-muted-foreground">
                        {container.code || tt("app.canvasSetup.noCode", "No code")}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {onOpenBox ? (
        <div className="flex justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              const first = groups.flatMap((group) => group.containers)[0];
              if (first) onOpenBox(first.id);
            }}
            disabled={groups.flatMap((group) => group.containers).length === 0}
          >
            {tt("app.canvasSetup.openFirstBox", "Open first box")}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

