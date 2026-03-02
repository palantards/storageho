"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  quantity: number;
  onSubmit: (formData: FormData) => Promise<void> | void;
  containerItemId?: string;
  inputName?: string;
  hiddenIdField?: string;
};

export function InlineQuantityEditor({
  quantity,
  onSubmit,
  containerItemId,
  inputName = "quantity",
  hiddenIdField = "containerItemId",
}: Props) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    return (
      <button
        type="button"
        className="text-xs font-medium text-primary hover:underline cursor-pointer"
        onClick={() => setEditing(true)}
      >
        Edit quantity
      </button>
    );
  }

  return (
    <form action={onSubmit} className="flex items-center gap-2">
      {containerItemId ? <input type="hidden" name={hiddenIdField} value={containerItemId} /> : null}
      <Input
        name={inputName}
        type="number"
        min={1}
        defaultValue={quantity}
        className="h-8 w-20 text-sm"
      />
      <Button
        type="submit"
        size="sm"
        variant="outline"
        onClick={() => setEditing(false)}
      >
        Update
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setEditing(false)}
        className="text-[11px]"
      >
        Cancel
      </Button>
    </form>
  );
}
