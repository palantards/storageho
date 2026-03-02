"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Props = {
  itemId: string;
  containerItemId: string;
  name: string;
  quantity: number;
  onRename: (formData: FormData) => Promise<void> | void;
  onUpdateQuantity: (formData: FormData) => Promise<void> | void;
  rightSlot?: React.ReactNode;
};

export function ContainerItemRow({
  itemId,
  containerItemId,
  name,
  quantity,
  onRename,
  onUpdateQuantity,
  rightSlot,
}: Props) {
  const [editingName, setEditingName] = useState(false);
  const [editingQty, setEditingQty] = useState(false);

  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2 md:flex-1">
        {editingName ? (
          <form action={onRename} className="flex items-center gap-2">
            <input type="hidden" name="itemId" value={itemId} />
            <Input
              name="name"
              defaultValue={name}
              className="h-9 w-56 text-sm"
              autoFocus
            />
            <Button type="submit" size="sm" variant="outline" onClick={() => setEditingName(false)}>
              Save
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditingName(false)}
              className="text-xs"
            >
              Cancel
            </Button>
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setEditingName(true)}
            className="text-left text-sm font-semibold hover:text-primary cursor-pointer"
          >
            {name}
          </button>
        )}

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Qty: {quantity}</span>
          {editingQty ? (
            <form action={onUpdateQuantity} className="flex items-center gap-2">
              <input type="hidden" name="containerItemId" value={containerItemId} />
              <Input
                name="quantity"
                type="number"
                min={1}
                defaultValue={quantity}
                className="h-8 w-20 text-sm"
              />
              <Button
                type="submit"
                size="sm"
                variant="outline"
                onClick={() => setEditingQty(false)}
              >
                Update
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => setEditingQty(false)}
                className="text-[11px]"
              >
                Cancel
              </Button>
            </form>
          ) : (
            <button
              type="button"
              className="text-xs font-medium text-primary hover:underline cursor-pointer"
              onClick={() => setEditingQty(true)}
            >
              Edit quantity
            </button>
          )}
        </div>
      </div>
      {rightSlot ? <div className="md:ml-4">{rightSlot}</div> : null}
    </div>
  );
}
