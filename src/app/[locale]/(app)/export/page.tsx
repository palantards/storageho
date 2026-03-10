import type { Locale } from "@/i18n/config";
import { getInventoryShellContext } from "@/lib/inventory/page-context";
import { listFloors } from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";
import { ErrorState } from "@/components/inventory/ErrorState";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PageHeader } from "@/components/inventory/PageHeader";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select";
import Link from "next/link";

export default async function ExportPage({
  params,
}: {
  params: Promise<{ locale: Locale }>;
}) {
  const { locale } = await params;
  const context = await getInventoryShellContext(locale);
  const userId = context.user.id;
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return <ErrorState title="No active household." />;
  }

  const floors = await withRlsUserContext(userId, async () =>
    listFloors({
      userId,
      householdId,
    }),
  );

  const selectedFloor = floors[0]?.location.id;

  return (
    <PageFrame className="space-y-6">
      <PageHeader
        title="Export CSV"
        description="Download household data filtered by floor."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        }
      />

      <form action="/api/export" method="GET" className="space-y-3">
        <SectionDivider title="Choose scope" />
        <input type="hidden" name="householdId" value={householdId} />
        <Select name="floorId" defaultValue={selectedFloor || "all"}>
          <SelectTrigger className="w-64">
            <SelectValue placeholder="All floors" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All floors</SelectItem>
            {floors.map((entry) => (
              <SelectItem key={entry.location.id} value={entry.location.id}>
                {entry.location.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button type="submit" className="w-fit">
          Export CSV
        </Button>
      </form>

      <div className="rounded-lg border bg-muted/30 p-4 text-sm">
        <div className="mb-2 font-medium text-foreground">What&apos;s included</div>
        <div className="grid grid-cols-2 gap-x-6 gap-y-1 text-xs text-muted-foreground sm:grid-cols-3">
          {["Floor", "Room", "Container name", "Container code", "Item name", "Quantity", "Note", "Tags"].map(
            (col) => (
              <div key={col} className="flex items-center gap-1.5">
                <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                {col}
              </div>
            ),
          )}
        </div>
      </div>
    </PageFrame>
  );
}
