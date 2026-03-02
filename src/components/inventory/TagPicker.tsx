"use client";

import { useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Input } from "@/components/ui/input";

type Tag = {
  id: string;
  name: string;
  color?: string | null;
};

export function TagPicker({
  tags,
  selected,
  onChange,
  onCreate,
}: {
  tags: Tag[];
  selected: string[];
  onChange: (next: string[]) => void;
  onCreate?: (name: string) => Promise<void>;
}) {
  const [value, setValue] = useState("");
  const selectedSet = useMemo(() => new Set(selected), [selected]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" type="button" className="h-8 text-xs">
          Tags ({selected.length})
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-80 space-y-2">
        <div className="max-h-48 space-y-2 overflow-y-auto">
          {tags.map((tag) => (
            <label
              key={tag.id}
              className="flex items-center gap-2 text-sm"
              style={{ color: tag.color || undefined }}
            >
              <Checkbox
                checked={selectedSet.has(tag.id)}
                onCheckedChange={(checked) => {
                  const next = checked
                    ? [...selected, tag.id]
                    : selected.filter((id) => id !== tag.id);
                  onChange(Array.from(new Set(next)));
                }}
              />
              <span>{tag.name}</span>
            </label>
          ))}
        </div>

        {onCreate ? (
          <div className="flex items-center gap-2">
            <Input
              value={value}
              onChange={(event) => setValue(event.target.value)}
              placeholder="Create new tag"
              className="h-8"
            />
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                const name = value.trim();
                if (!name) return;
                await onCreate(name);
                setValue("");
              }}
            >
              Add
            </Button>
          </div>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
