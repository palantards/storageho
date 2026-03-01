"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export type CanvasMode =
  | "select"
  | "draw-rectangle"
  | "draw-square"
  | "draw-triangle"
  | "place-box";

function modeButtonLabel(mode: CanvasMode) {
  switch (mode) {
    case "select":
      return "Select";
    case "draw-rectangle":
      return "Rectangle room";
    case "draw-square":
      return "Square room";
    case "draw-triangle":
      return "Triangle room";
    case "place-box":
      return "Tap to add box";
    default:
      return mode;
  }
}

const MODES: CanvasMode[] = [
  "select",
  "draw-rectangle",
  "draw-square",
  "draw-triangle",
  "place-box",
];

export function HouseholdCanvasToolbar({
  mode,
  onModeChange,
  roomName,
  onRoomNameChange,
  zoom,
  onZoomIn,
  onZoomOut,
  onZoomReset,
}: {
  mode: CanvasMode;
  onModeChange: (mode: CanvasMode) => void;
  roomName: string;
  onRoomNameChange: (value: string) => void;
  zoom: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onZoomReset: () => void;
}) {
  return (
    <div className="space-y-2 rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-sm font-medium">Map builder</div>
        <div className="flex items-center gap-1">
          <Button type="button" size="sm" variant="outline" onClick={onZoomOut}>
            -
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onZoomReset}>
            <span data-testid="canvas-zoom-value">{Math.round(zoom * 100)}%</span>
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={onZoomIn}>
            +
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((entry) => (
          <Button
            key={entry}
            type="button"
            size="sm"
            variant={mode === entry ? "default" : "outline"}
            onClick={() => onModeChange(entry)}
          >
            {modeButtonLabel(entry)}
          </Button>
        ))}
      </div>

      {mode.startsWith("draw-") ? (
        <Input
          value={roomName}
          onChange={(event) => onRoomNameChange(event.target.value)}
          placeholder="Room name (optional)"
        />
      ) : null}

      <div className="text-xs text-muted-foreground">
        Wheel/pinch zooms only this map. Drag background to pan. Draw a room, then tap to add/place boxes.
      </div>
    </div>
  );
}
