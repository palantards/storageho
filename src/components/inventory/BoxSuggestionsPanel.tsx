"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  analyzeContainerPhotosAction,
  updateSuggestionAction,
} from "@/lib/actions/suggestions";

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
}: {
  householdId: string;
  containerId?: string;
  suggestions: BoxSuggestionRow[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingAnalyze, setPendingAnalyze] = useState(false);
  const [draftNames, setDraftNames] = useState<Record<string, string>>({});
  const [draftQty, setDraftQty] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");

  const pendingSuggestions = useMemo(
    () => suggestions.filter((suggestion) => suggestion.status === "pending"),
    [suggestions],
  );

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

  return (
    <div className="space-y-3">
      <div className="text-xs text-muted-foreground">
        Suggestions are generated automatically after upload (single-photo +
        batch pass). If they still do not appear, use Refresh or run the AI job
        runner endpoint.
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.refresh()}
        >
          Refresh suggestions
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={!containerId || pendingAnalyze}
          onClick={async () => {
            if (!containerId) {
              setMessage("Select a container first.");
              return;
            }

            try {
              setPendingAnalyze(true);
              setMessage("");
              const result = await analyzeContainerPhotosAction({
                householdId,
                containerId,
                maxPhotos: 4,
                maxSuggestions: 12,
                replacePending: true,
              });
              if (!result.ok) {
                throw new Error(result.error);
              }
              const count = Number(result.suggestionsCount ?? 0);
              setMessage(
                `Re-analyzed latest photos. ${count} suggestion(s) generated.`,
              );
              router.refresh();
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Re-analyze failed",
              );
            } finally {
              setPendingAnalyze(false);
            }
          }}
        >
          {pendingAnalyze ? "Analyzing..." : "Re-analyze latest photos"}
        </Button>

        {pendingSuggestions.length > 0 ? (
          <Button
            type="button"
            variant="outline"
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
        <div className="text-xs text-muted-foreground">{message}</div>
      ) : null}

      {suggestions.length === 0 ? (
        <div className="text-sm text-muted-foreground">
          No suggestions yet. Upload photos to trigger AI capture suggestions.
        </div>
      ) : (
        suggestions.map((suggestion) => (
          <div key={suggestion.id} className="rounded-md border p-3">
            <div className="flex items-center justify-between gap-2">
              <div className="font-medium">{suggestion.suggestedName}</div>
              <div className="text-xs text-muted-foreground">
                {Math.round(suggestion.confidence * 100)}% confidence
              </div>
            </div>
            <div className="mt-1 text-xs text-muted-foreground">
              Qty: {suggestion.suggestedQty ?? 1} | Tags:{" "}
              {(suggestion.suggestedTags || []).join(", ") || "-"} | Status:{" "}
              {suggestion.status}
            </div>

            {suggestion.status === "pending" ? (
              <div className="mt-3 grid gap-2 md:grid-cols-[1fr_120px_auto_auto]">
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
