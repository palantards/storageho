"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useBusyCursor } from "@/hooks/useBusyCursor";
import { moveItemAction } from "@/lib/actions/items";

export function MoveItemDialog({
  householdId,
  itemId,
  fromContainerId,
  maxQuantity,
  containers,
  onMoved,
}: {
  householdId: string;
  itemId: string;
  fromContainerId: string;
  maxQuantity: number;
  containers: Array<{ id: string; name: string }>;
  onMoved?: () => void;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [toContainerId, setToContainerId] = useState("");
  const [pending, setPending] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<{
    toContainerId?: string;
    quantity?: string;
  }>({});
  const [formError, setFormError] = useState<string | null>(null);

  useBusyCursor(pending);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          Move
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Move Item</DialogTitle>
          <DialogDescription>
            Split quantity between boxes and keep audit trail.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="toContainer">Destination Box</Label>
            <Select
              value={toContainerId}
              onValueChange={(value) => {
                setToContainerId(value);
                if (!fieldErrors.toContainerId) return;
                setFieldErrors((prev) => ({ ...prev, toContainerId: undefined }));
              }}
            >
              <SelectTrigger id="toContainer">
                <SelectValue placeholder="Select destination" />
              </SelectTrigger>
              <SelectContent>
                {containers.map((container) => (
                  <SelectItem key={container.id} value={container.id}>
                    {container.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <FormFieldError error={fieldErrors.toContainerId} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="moveQty">Quantity</Label>
            <Input
              id="moveQty"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) => {
                setQuantity(Number(event.target.value || 1));
                if (!fieldErrors.quantity) return;
                setFieldErrors((prev) => ({ ...prev, quantity: undefined }));
              }}
            />
            <FormFieldError error={fieldErrors.quantity} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Cancel
          </Button>
          <div className="grid gap-2">
            <FormSubmitError error={formError} title="Unable to move item" />
            <Button
              loading={pending}
              loadingText="Moving..."
              onClick={async () => {
                const nextErrors: { toContainerId?: string; quantity?: string } = {};
                if (!toContainerId) nextErrors.toContainerId = "Select a destination box.";
                if (quantity < 1 || quantity > maxQuantity) {
                  nextErrors.quantity = `Quantity must be between 1 and ${maxQuantity}.`;
                }
                if (Object.keys(nextErrors).length > 0) {
                  setFieldErrors(nextErrors);
                  setFormError(null);
                  return;
                }

                try {
                  setPending(true);
                  setFormError(null);
                  const result = await moveItemAction({
                    householdId,
                    itemId,
                    fromContainerId,
                    toContainerId,
                    quantity,
                  });
                  if (!result.ok) {
                    throw new Error(result.error);
                  }

                  onMoved?.();
                  router.refresh();
                  setOpen(false);
                } catch (error) {
                  setFormError(error instanceof Error ? error.message : "Move failed");
                } finally {
                  setPending(false);
                }
              }}
            >
              Move
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
