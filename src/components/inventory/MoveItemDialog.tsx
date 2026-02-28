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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

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
            <Select value={toContainerId} onValueChange={setToContainerId}>
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
          </div>

          <div className="space-y-2">
            <Label htmlFor="moveQty">Quantity</Label>
            <Input
              id="moveQty"
              type="number"
              min={1}
              max={maxQuantity}
              value={quantity}
              onChange={(event) => setQuantity(Number(event.target.value || 1))}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={pending}
          >
            Cancel
          </Button>
          <Button
            disabled={
              pending ||
              !toContainerId ||
              quantity < 1 ||
              quantity > maxQuantity
            }
            onClick={async () => {
              try {
                setPending(true);
                const response = await fetch("/api/items/move", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    householdId,
                    itemId,
                    fromContainerId,
                    toContainerId,
                    quantity,
                  }),
                });

                if (!response.ok) {
                  const payload = await response
                    .json()
                    .catch(() => ({ error: "Move failed" }));
                  throw new Error(payload.error || "Move failed");
                }

                onMoved?.();
                router.refresh();
                setOpen(false);
              } catch (error) {
                alert(error instanceof Error ? error.message : "Move failed");
              } finally {
                setPending(false);
              }
            }}
          >
            {pending ? "Moving..." : "Move"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
