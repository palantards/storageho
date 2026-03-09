"use client";

import { useState } from "react";
import { Pencil } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  name: string;
  onSubmit: (formData: FormData) => Promise<void> | void;
  itemId?: string;
  inputName?: string;
  hiddenItemField?: string;
};

export function InlineNameEditor({
  name,
  onSubmit,
  itemId,
  inputName = "name",
  hiddenItemField = "itemId",
}: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="group flex items-center gap-1 text-left text-sm font-semibold hover:text-primary cursor-pointer"
      >
        {name}
        <Pencil className="h-3 w-3 opacity-0 group-hover:opacity-50 transition-opacity" />
      </button>
    );
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      {itemId ? <input type="hidden" name={hiddenItemField} value={itemId} /> : null}
      <Input
        name={inputName}
        defaultValue={name}
        className="h-9 w-56 text-sm"
        autoFocus
      />
      <Button type="submit" size="sm" variant="outline" onClick={() => setEditing(false)}>
        Save
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
        className="text-xs"
      >
        Cancel
      </Button>
    </form>
  );
}
