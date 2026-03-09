import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return (
    <div className={cn("animate-pulse rounded-md bg-muted", className)} />
  );
}

export function PageSkeleton() {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 md:px-6 md:py-5">
      <div className="space-y-6">
        {/* Page heading */}
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Shimmer className="h-7 w-48" />
            <Shimmer className="h-4 w-72" />
          </div>
          <Shimmer className="h-9 w-24" />
        </div>

        {/* Stat cards */}
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Shimmer key={i} className="h-20 rounded-xl" />
          ))}
        </div>

        {/* Section divider */}
        <Shimmer className="h-4 w-full rounded-full" />

        {/* List rows */}
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Shimmer key={i} className="h-16 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

export function ListPageSkeleton() {
  return (
    <div className="rounded-2xl bg-background/90 px-4 py-4 md:px-6 md:py-5">
      <div className="space-y-6">
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-2">
            <Shimmer className="h-7 w-40" />
            <Shimmer className="h-4 w-64" />
          </div>
          <Shimmer className="h-9 w-28" />
        </div>

        <Shimmer className="h-4 w-full rounded-full" />

        <div className="space-y-2">
          {[...Array(8)].map((_, i) => (
            <Shimmer key={i} className="h-14 rounded-md" />
          ))}
        </div>
      </div>
    </div>
  );
}
