"use client";

import { InlineNameEditor } from "@/components/inventory/InlineNameEditor";
import { InlineQuantityEditor } from "@/components/inventory/InlineQuantityEditor";

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
  return (
    <div className="flex flex-col gap-2 rounded-md border p-3 transition hover:bg-muted/60 md:flex-row md:items-center md:justify-between">
      <div className="space-y-2 md:flex-1">
        <InlineNameEditor name={name} itemId={itemId} onSubmit={onRename} />

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span>Qty: {quantity}</span>
          <InlineQuantityEditor
            quantity={quantity}
            containerItemId={containerItemId}
            onSubmit={onUpdateQuantity}
          />
        </div>
      </div>
      {rightSlot ? <div className="md:ml-4">{rightSlot}</div> : null}
    </div>
  );
}
