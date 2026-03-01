"use client";

import { useState } from "react";

import type { Layer } from "@/components/inventory/household-canvas/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function HouseholdFloorStack({
  layers,
  selectedLayerId,
  onSelectLayer,
  onCreateFloor,
  onRenameLayer,
}: {
  layers: Layer[];
  selectedLayerId: string | null;
  onSelectLayer: (layerId: string) => void;
  onCreateFloor: () => void;
  onRenameLayer: (layerId: string, name: string) => Promise<void>;
}) {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [renameError, setRenameError] = useState("");

  async function commitRename() {
    if (!editingLayerId) return;
    const nextName = draftName.trim();
    if (!nextName) {
      setRenameError("Floor name is required.");
      return;
    }
    try {
      await onRenameLayer(editingLayerId, nextName);
      setRenameError("");
      setEditingLayerId(null);
      setDraftName("");
    } catch (error) {
      setRenameError(error instanceof Error ? error.message : "Unable to rename floor");
    }
  }

  return (
    <div className="w-[110px] shrink-0 space-y-2 rounded-md border p-2">
      <div className="text-center text-[11px] font-medium text-muted-foreground">Floors</div>
      {layers.length === 0 ? (
        <div className="rounded border border-dashed p-2 text-center text-[11px] text-muted-foreground">
          No floors yet
        </div>
      ) : null}
      <div className="flex flex-col gap-2">
        {layers.map((layer, index) => {
          const isSelected = selectedLayerId === layer.id;
          const isEditing = editingLayerId === layer.id;

          return (
            <div key={layer.id} className="space-y-1">
              <button
                type="button"
                onClick={() => onSelectLayer(layer.id)}
                className={`w-full rounded-md border p-2 text-left text-xs shadow-sm transition ${
                  isSelected
                    ? "border-primary bg-primary/10 text-foreground"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
                title={layer.name}
              >
                <div className="text-[10px] uppercase opacity-70">Floor {index + 1}</div>
                <div className="truncate font-medium">{layer.name}</div>
              </button>
              {isSelected ? (
                <>
                  {isEditing ? (
                    <div className="space-y-1">
                      <Input
                        value={draftName}
                        onChange={(event) => setDraftName(event.target.value)}
                        className="h-8 text-xs"
                      />
                      <div className="flex gap-1">
                        <Button type="button" size="sm" className="h-7 text-[11px]" onClick={commitRename}>
                          Save
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-7 text-[11px]"
                          onClick={() => {
                            setEditingLayerId(null);
                            setDraftName("");
                            setRenameError("");
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                      {renameError ? (
                        <div className="text-[11px] text-destructive">{renameError}</div>
                      ) : null}
                    </div>
                  ) : (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="h-7 w-full text-[11px]"
                      onClick={() => {
                        setEditingLayerId(layer.id);
                        setDraftName(layer.name);
                        setRenameError("");
                      }}
                    >
                      Rename floor
                    </Button>
                  )}
                </>
              ) : null}
            </div>
          );
        })}
      </div>
      <Button type="button" size="sm" variant="outline" className="w-full" onClick={onCreateFloor}>
        + Floor
      </Button>
    </div>
  );
}
