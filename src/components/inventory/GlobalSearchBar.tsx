"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname, useRouter } from "next/navigation";

import { SEARCH_DEBOUNCE_MS } from "@/lib/inventory/constants";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Button } from "@/components/ui/button";

type SearchResult = {
  entityType: "item" | "container" | "room" | "location";
  entityId: string;
  title: string;
  subtitle: string;
  href: string;
  score: number;
};

export function GlobalSearchBar({ householdId }: { householdId?: string }) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!query.trim()) {
      setResults([]);
      return;
    }

    const handle = window.setTimeout(async () => {
      try {
        setLoading(true);
        const params = new URLSearchParams({ q: query.trim() });
        if (householdId) {
          params.set("householdId", householdId);
        }
        const response = await fetch(`/api/search?${params.toString()}`);
        if (!response.ok) {
          throw new Error("Search failed");
        }
        const data = (await response.json()) as { results: SearchResult[] };
        setResults(data.results || []);
      } catch (error) {
        console.error(error);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => window.clearTimeout(handle);
  }, [query, householdId]);

  const placeholder = useMemo(
    () => (householdId ? "Search items, boxes, rooms..." : "Select a household first"),
    [householdId],
  );

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-8 w-full max-w-xs justify-start text-xs text-muted-foreground"
        onClick={() => setOpen(true)}
      >
        Search... (Cmd/Ctrl+K)
      </Button>

      <CommandDialog open={open} onOpenChange={setOpen}>
        <CommandInput
          value={query}
          onValueChange={setQuery}
          placeholder={placeholder}
          disabled={!householdId}
        />
        <CommandList>
          <CommandEmpty>
            {loading ? "Searching..." : "No results"}
          </CommandEmpty>
          <CommandGroup heading="Results">
            {results.map((result) => (
              <CommandItem
                key={`${result.entityType}:${result.entityId}`}
                onSelect={() => {
                  setOpen(false);
                  const locale = pathname.split("/").filter(Boolean)[0];
                  const href = result.href.startsWith("/")
                    ? `/${locale}${result.href}`
                    : result.href;
                  router.push(href);
                }}
                className="flex flex-col items-start"
              >
                <div className="text-sm font-medium">{result.title}</div>
                <div className="text-xs text-muted-foreground">
                  {result.entityType} · {result.subtitle}
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
