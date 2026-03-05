"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { PhotoUploader } from "@/components/inventory/PhotoUploader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  analyzeContainerPhotosAction,
  updateSuggestionAction,
} from "@/lib/actions/suggestions";
import { cn } from "@/lib/utils";

export type BoxSuggestionRow = {
  id: string;
  suggestedName: string;
  suggestedQty: number | null;
  suggestedTags: string[] | null;
  confidence: number;
  status: "pending" | "accepted" | "rejected";
  resolvedItemId: string | null;
  createdAt: string;
};

export function BoxSuggestionsPanel({
  householdId,
  containerId,
  suggestions,
  photosCount = 0,
}: {
  householdId: string;
  containerId?: string;
  suggestions: BoxSuggestionRow[];
  photosCount?: number;
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAnalyze, setPendingAnalyze] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [optimisticallyHiddenPendingIds, setOptimisticallyHiddenPendingIds] =
    useState<string[]>([]);

  const hasPhotos = photosCount > 0;
  const visibleSuggestions = useMemo(
    () =>
      suggestions.filter(
        (suggestion) =>
          !optimisticallyHiddenPendingIds.includes(suggestion.id),
      ),
    [suggestions, optimisticallyHiddenPendingIds],
  );
  const pendingSuggestions = useMemo(
    () =>
      visibleSuggestions.filter((suggestion) => suggestion.status === "pending"),
    [visibleSuggestions],
  );

  useEffect(() => {
    if (optimisticallyHiddenPendingIds.length === 0) return;
    const stillPresent = suggestions.some((suggestion) =>
      optimisticallyHiddenPendingIds.includes(suggestion.id),
    );
    if (!stillPresent) {
      setOptimisticallyHiddenPendingIds([]);
    }
  }, [suggestions, optimisticallyHiddenPendingIds]);

  async function submitAction(
    input: {
      suggestionId: string;
      action: "accept" | "reject";
    },
    refresh = true,
  ) {
    try {
      setPendingId(input.suggestionId);
      setMessage("");

      const result = await updateSuggestionAction({
        householdId,
        suggestionId: input.suggestionId,
        action: input.action,
        name: draftNames[input.suggestionId] || undefined,
        quantity: draftQty[input.suggestionId]
          ? Number(draftQty[input.suggestionId])
          : undefined,
      });

      if (!result.ok) {
        throw new Error(result.error);
      }

      setMessage(
        input.action === "accept"
          ? "Suggestion accepted."
          : "Suggestion rejected.",
      );
      if (refresh) {
        router.refresh();
      }
      return true;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action failed.");
      return false;
    } finally {
      setPendingId(null);
    }
  }

  async function analyzePhotos() {
    if (!containerId) {
      setMessage("Select a container first.");
      return;
    }

    try {
      setPendingAnalyze(true);
      setMessage("");
      const pendingIds = suggestions
        .filter((suggestion) => suggestion.status === "pending")
        .map((suggestion) => suggestion.id);
      setOptimisticallyHiddenPendingIds(pendingIds);
      const result = await analyzeContainerPhotosAction({
        householdId,
        containerId,
        maxPhotos: 10,
        replacePending: true,
      });
      if (!result.ok) {
        throw new Error(result.error);
      }
      const count = Number(result.suggestionsCount ?? 0);
      const photosAnalyzed = Number(result.photosAnalyzed ?? 0);
      setMessage(
        `Analyzed ${photosAnalyzed} photo(s). ${count} suggestion(s) generated.`,
      );
      router.refresh();
    } catch (error) {
      setOptimisticallyHiddenPendingIds([]);
      setMessage(error instanceof Error ? error.message : "Analyze failed");
    } finally {
      setPendingAnalyze(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" onClick={() => router.refresh()}>
          Refresh suggestions
        </Button>
        <Button
          type="button"
          variant="outline"
          loading={pendingAnalyze}
          loadingText="Analyzing..."
          disabled={!containerId || !hasPhotos || pendingAnalyze}
          onClick={analyzePhotos}
        >
          Analyze photos
        </Button>
        {pendingSuggestions.length > 0 ? (
          <Button
            type="button"
            variant="outline"
            disabled={pendingAnalyze}
            onClick={async () => {
              const highConfidence = pendingSuggestions.filter(
                (suggestion) => suggestion.confidence >= 0.82,
              );
              if (highConfidence.length === 0) {
                setMessage("No high-confidence suggestions to accept.");
                return;
              }

              for (const suggestion of highConfidence) {
                await submitAction(
                  {
                    suggestionId: suggestion.id,
                    action: "accept",
                  },
                  false,
                );
              }

              router.refresh();
              setMessage(
                `Accepted ${highConfidence.length} high-confidence suggestions.`,
              );
            }}
          >
            Accept all high confidence
          </Button>
        ) : null}
      </div>

      {message ? (
        <div className="rounded-md border bg-background px-3 py-2 text-xs text-muted-foreground">
          {message}
        </div>
      ) : null}

      <SectionDivider title="Suggestions" />

      {!hasPhotos ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4">
          <div className="mb-3 text-sm font-medium">No photos yet</div>
          {containerId ? (
            <PhotoUploader
              householdId={householdId}
              entityType="container"
              entityId={containerId}
              refreshOnComplete
            />
          ) : (
            <div className="text-xs text-muted-foreground">
              Select a container first.
            </div>
          )}
        </div>
      ) : visibleSuggestions.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-muted/20 p-4 text-sm text-muted-foreground">
          No suggestions yet. Click Analyze photos to generate AI suggestions.
        </div>
      ) : (
        visibleSuggestions.map((suggestion) => (
          <div key={suggestion.id} className="py-4 first:pt-0">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{suggestion.suggestedName}</div>
              <div
                className={cn(
                  "rounded-full px-2 py-0.5 text-[11px] font-medium",
                  suggestion.status === "accepted" &&
                    "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
                  suggestion.status === "rejected" &&
                    "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300",
                  suggestion.status === "pending" &&
                    "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
                )}
              >
                {suggestion.status}
              </div>
            </div>

            <div className="mt-2 text-xs text-muted-foreground">
              Confidence: {Math.round(suggestion.confidence * 100)}% | Qty:{" "}
              {suggestion.suggestedQty ?? 1} | Tags:{" "}
              {(suggestion.suggestedTags || []).join(", ") || "-"}
            </div>

            {suggestion.status === "pending" ? (
              <div className="mt-3 grid gap-2 lg:grid-cols-[minmax(0,1fr)_120px_auto_auto]">
                <Input
                  value={draftNames[suggestion.id] ?? suggestion.suggestedName}
                  onChange={(event) =>
                    setDraftNames((prev) => ({
                      ...prev,
                      [suggestion.id]: event.target.value,
                    }))
                  }
                />
                <Input
                  type="number"
                  min={1}
                  value={
                    draftQty[suggestion.id] ??
                    String(suggestion.suggestedQty ?? 1)
                  }
                  onChange={(event) =>
                    setDraftQty((prev) => ({
                      ...prev,
                      [suggestion.id]: event.target.value,
                    }))
                  }
                />
                <Button
                  type="button"
                  disabled={pendingId === suggestion.id}
                  onClick={() =>
                    submitAction({
                      suggestionId: suggestion.id,
                      action: "accept",
                    })
                  }
                >
                  Accept
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  disabled={pendingId === suggestion.id}
                  onClick={() =>
                    submitAction({
                      suggestionId: suggestion.id,
                      action: "reject",
                    })
                  }
                >
                  Reject
                </Button>
              </div>
            ) : null}
          </div>
        ))
      )}
    </div>
  );
}
