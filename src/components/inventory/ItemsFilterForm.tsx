"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Tag = { id: string; name: string };

export function ItemsFilterForm({ tags }: { tags: Tag[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Derive committed values from the URL — always in sync after navigation
  const committedQ = searchParams.get("q") ?? "";
  const committedTag = searchParams.get("tag") ?? "all";

  // Local state only for the text input (needed for debounce)
  const [inputQ, setInputQ] = useState(committedQ);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When the URL-committed q changes externally (e.g. reset), sync input
  useEffect(() => {
    setInputQ(committedQ);
  }, [committedQ]);

  function buildUrl(nextQ: string, nextTag: string) {
    const params = new URLSearchParams();
    if (nextQ) params.set("q", nextQ);
    if (nextTag && nextTag !== "all") params.set("tag", nextTag);
    return params.size ? `${pathname}?${params.toString()}` : pathname;
  }

  // Debounce text search — 300 ms after last keystroke
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      router.replace(buildUrl(inputQ, committedTag), { scroll: false });
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inputQ]);

  function handleTagChange(value: string) {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(buildUrl(inputQ, value), { scroll: false });
  }

  function handleReset() {
    setInputQ("");
    if (debounceRef.current) clearTimeout(debounceRef.current);
    router.replace(pathname, { scroll: false });
  }

  const isDirty = inputQ !== "" || committedTag !== "all";

  return (
    <div className="grid gap-2 md:grid-cols-[2fr_1fr]">
      <div className="relative">
        <Input
          value={inputQ}
          onChange={(e) => setInputQ(e.target.value)}
          placeholder="Search items…"
          className="w-full pr-8"
        />
        {inputQ ? (
          <button
            type="button"
            onClick={() => {
              setInputQ("");
              if (debounceRef.current) clearTimeout(debounceRef.current);
              router.replace(buildUrl("", committedTag), { scroll: false });
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
      </div>
      <Select value={committedTag} onValueChange={handleTagChange}>
        <SelectTrigger>
          <SelectValue placeholder="All tags" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All tags</SelectItem>
          {tags.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isDirty ? (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleReset}
          className="w-fit text-muted-foreground md:col-span-2"
        >
          Clear filters
        </Button>
      ) : null}
    </div>
  );
}
