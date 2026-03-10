import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

export function PageSkeleton() {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 md:px-6 md:py-5 space-y-6">
      {/* Page heading */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <Shimmer className="h-8 w-32" />
          <Shimmer className="h-4 w-64" />
        </div>
        <Shimmer className="h-9 w-36" />
      </div>

      {/* Stat cards */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-card p-4 space-y-2">
            <Shimmer className="h-4 w-20" />
            <Shimmer className="h-8 w-12" />
          </div>
        ))}
      </div>

      {/* Quick-access cards */}
      <div className="space-y-3">
        <Shimmer className="h-5 w-28" />
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="rounded-xl border bg-card p-4 space-y-3">
              <Shimmer className="h-9 w-9 rounded-lg" />
              <div className="space-y-1.5">
                <Shimmer className="h-4 w-32" />
                <Shimmer className="h-3 w-40" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Activity feed */}
      <div className="space-y-3">
        <Shimmer className="h-5 w-32" />
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-md border p-3">
              <Shimmer className="h-7 w-7 shrink-0 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <Shimmer className="h-3.5 w-3/4" />
                <Shimmer className="h-3 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 md:px-6 md:py-5 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div className="space-y-2">
          <Shimmer className="h-7 w-40" />
          <Shimmer className="h-4 w-64" />
        </div>
        <Shimmer className="h-9 w-28" />
      </div>

      <Shimmer className="h-9 w-full rounded-lg" />

      <div className="space-y-2">
        {[...Array(8)].map((_, i) => (
          <Shimmer key={i} className="h-14 rounded-md" />
        ))}
      </div>
    </div>
  );
}

export function BoxPageSkeleton() {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 md:px-6 md:py-5 space-y-5">
      {/* Box header */}
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Shimmer className="h-8 w-40" />
            <Shimmer className="h-5 w-14 rounded-full" />
          </div>
          <Shimmer className="h-4 w-48" />
          <div className="flex gap-1.5">
            <Shimmer className="h-5 w-16 rounded-full" />
            <Shimmer className="h-5 w-20 rounded-full" />
          </div>
        </div>
        <Shimmer className="h-20 w-20 shrink-0 rounded-lg" />
      </div>

      {/* Tab bar */}
      <div className="grid grid-cols-2 gap-1 sm:grid-cols-3 md:grid-cols-5 rounded-md bg-muted p-1">
        {[...Array(5)].map((_, i) => (
          <Shimmer key={i} className="h-8 rounded-sm" />
        ))}
      </div>

      {/* Contents area */}
      <div className="space-y-4">
        <div className="space-y-1">
          <Shimmer className="h-5 w-20" />
          <Shimmer className="h-4 w-72" />
        </div>
        <Shimmer className="h-24 rounded-lg" />
        <div className="space-y-1 pt-2">
          <Shimmer className="h-5 w-36" />
          <Shimmer className="h-4 w-56" />
        </div>
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border p-3">
            <Shimmer className="h-4 w-40" />
            <div className="flex gap-2">
              <Shimmer className="h-7 w-14 rounded" />
              <Shimmer className="h-7 w-16 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export function RoomPageSkeleton() {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 md:px-6 md:py-5 space-y-6">
      {/* Room header */}
      <div className="space-y-3">
        <div className="space-y-1.5">
          <Shimmer className="h-8 w-44" />
          <Shimmer className="h-4 w-36" />
        </div>
        {/* Filter chips */}
        <div className="flex flex-wrap gap-2">
          {[...Array(5)].map((_, i) => (
            <Shimmer key={i} className="h-6 w-20 rounded" />
          ))}
        </div>
      </div>

      {/* Quick add form */}
      <div className="space-y-2">
        <Shimmer className="h-5 w-40" />
        <div className="grid gap-2 md:grid-cols-5">
          {[...Array(4)].map((_, i) => (
            <Shimmer key={i} className="h-9 rounded-md" />
          ))}
          <Shimmer className="h-9 w-32 rounded-md" />
        </div>
      </div>

      {/* Container list */}
      <div className="space-y-3">
        <Shimmer className="h-5 w-28" />
        {[...Array(6)].map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-md border p-3">
            <div className="space-y-1.5">
              <Shimmer className="h-4 w-36" />
              <Shimmer className="h-3 w-24" />
            </div>
            <div className="flex gap-2">
              <Shimmer className="h-8 w-20 rounded" />
              <Shimmer className="h-8 w-8 rounded" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
