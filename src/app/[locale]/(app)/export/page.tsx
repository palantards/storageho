import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listFloors } from "@/lib/inventory/service";
import { PageFrame } from "@/components/inventory/PageFrame";
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
  const context = await getInventoryContext(locale);
  const householdId = context.activeMembership?.household.id;

  if (!householdId) {
    return (
      <div className="text-sm text-muted-foreground">No active household.</div>
    );
  }

  const floors = await listFloors({
    userId: context.user.id,
    householdId,
  });

  const selectedFloor = floors[0]?.location.id;

  return (
    <PageFrame className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Export CSV</div>
          <div className="text-sm text-muted-foreground">
            Download household data filtered by floor.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <form action="/api/export" method="POST" className="space-y-3">
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
    </PageFrame>
  );
}
