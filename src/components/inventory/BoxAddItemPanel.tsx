"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { HelpCircle } from "lucide-react";
import { toast } from "sonner";

import { ItemAutocomplete } from "@/components/inventory/ItemAutocomplete";
import { Button } from "@/components/ui/button";
import { FormFieldError, FormSubmitError } from "@/components/ui/form-feedback";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { quickAddAction } from "@/lib/actions/scan";

type Item = { id: string; name: string };

type Props = {
  householdId: string;
  containerId: string;
  itemLibrary: Item[];
  addAction: (formData: FormData) => Promise<void> | void;
};

export function BoxAddItemPanel({
  householdId,
  containerId,
  itemLibrary,
  addAction,
}: Props) {
  const router = useRouter();
  const [mode, setMode] = useState<"form" | "quickadd">("form");
  const [quickText, setQuickText] = useState("");
  const [quickTextError, setQuickTextError] = useState<string | null>(null);
  const [quickAddError, setQuickAddError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => setMode("form")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            mode === "form"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Form
        </button>
        <button
          type="button"
          onClick={() => setMode("quickadd")}
          className={`rounded-md px-3 py-1 text-xs font-medium transition ${
            mode === "quickadd"
              ? "bg-primary text-primary-foreground"
              : "bg-muted text-muted-foreground hover:bg-muted/80"
          }`}
        >
          Quick-add
        </button>
      </div>

      {mode === "form" ? (
        <form action={addAction} className="grid gap-3">
          <div className="grid gap-1">
            <div className="flex items-center gap-2">
              <Label htmlFor="item-name" className="text-xs font-medium text-muted-foreground">
                Name
              </Label>
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      className="inline-flex h-5 w-5 items-center justify-center text-muted-foreground hover:text-foreground"
                      aria-label="Add item help"
                    >
                      <HelpCircle className="h-4 w-4" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="top" className="max-w-xs text-xs">
                    Choose from suggestions or type. If the name doesn&apos;t match an existing item,
                    a new one will be created.
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </div>
            <ItemAutocomplete
              name="item"
              items={itemLibrary}
              placeholder="e.g. Power bank"
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="grid gap-1">
              <Label htmlFor="item-qty" className="text-xs font-medium text-muted-foreground">
                Quantity
              </Label>
              <Input id="item-qty" type="number" min={1} defaultValue={1} name="quantity" />
            </div>
            <div className="grid gap-1">
              <Label htmlFor="item-note" className="text-xs font-medium text-muted-foreground">
                Note
              </Label>
              <Input id="item-note" name="note" placeholder="Optional note" />
            </div>
          </div>

          <Button type="submit" className="w-fit">
            Add to box
          </Button>
        </form>
      ) : (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Type items separated by commas or new lines. Include quantity like{" "}
            <span className="font-mono">2 HDMI cables, 1 powerbank</span>.
          </div>
          <Textarea
            placeholder="2 HDMI cables, 1 powerbank, 3 USB-C adapters"
            value={quickText}
            onChange={(e) => {
              setQuickText(e.target.value);
              if (quickTextError) setQuickTextError(null);
            }}
            className="min-h-[80px]"
            aria-invalid={quickTextError ? true : undefined}
          />
          <FormFieldError error={quickTextError} />
          <Button
            type="button"
            loading={pending}
            loadingText="Adding..."
            disabled={pending || !quickText.trim()}
            onClick={async () => {
              const text = quickText.trim();
              if (!text) {
                setQuickTextError("Enter at least one item.");
                return;
              }
              try {
                setPending(true);
                setQuickAddError(null);
                const result = await quickAddAction({ householdId, containerId, text });
                if (!result.ok) {
                  if (result.fieldErrors?.text) {
                    setQuickTextError(result.fieldErrors.text);
                  } else {
                    setQuickAddError(result.error ?? null);
                  }
                  return;
                }
                const added = result.processed || 0;
                toast.success(`Added ${added} ${added === 1 ? "item" : "items"} to box`);
                setQuickText("");
                router.refresh();
              } catch (error) {
                setQuickAddError(error instanceof Error ? error.message : "Quick add failed");
              } finally {
                setPending(false);
              }
            }}
          >
            Add to box
          </Button>
          <FormSubmitError error={quickAddError} title="Quick add failed" />
        </div>
      )}
    </div>
  );
}
