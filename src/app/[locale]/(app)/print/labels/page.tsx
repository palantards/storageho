import type { Locale } from "@/i18n/config";
import { getInventoryContext } from "@/lib/inventory/page-context";
import { listAllContainersInFloor, listFloors } from "@/lib/inventory/service";
import { PrintButton } from "@/components/inventory/PrintButton";
import { QRCodeRenderer } from "@/components/inventory/QRCodeRenderer";
import { PageFrame } from "@/components/inventory/PageFrame";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import Link from "next/link";

const APP_URL =
  process.env.NEXT_PUBLIC_APP_URL ||
  process.env.NEXT_PUBLIC_SITE_URL ||
  "http://localhost:3000";

export default async function PrintLabelsPage({
  params,
  searchParams,
}: {
  params: Promise<{ locale: Locale }>;
  searchParams?: Promise<{ floorId?: string }>;
}) {
  const { locale } = await params;
  const search = (await searchParams) || {};
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

  const selectedFloor =
    search.floorId && floors.some((f) => f.id === search.floorId)
      ? search.floorId
      : floors[0]?.id;

  const containers = selectedFloor
    ? await listAllContainersInFloor({
        userId: context.user.id,
        householdId,
        floorId: selectedFloor,
      })
    : [];

  return (
    <PageFrame className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">Print labels</div>
          <div className="text-sm text-muted-foreground">
            Generate QR labels for boxes on a selected floor.
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>Back to dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Floor" />
        <form className="flex flex-wrap items-center gap-3">
          <Select name="floorId" defaultValue={selectedFloor}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select floor" />
            </SelectTrigger>
            <SelectContent>
              {floors.map((floor) => (
                <SelectItem key={floor.id} value={floor.id}>
                  {floor.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline">
            Load boxes
          </Button>
        </form>
      </div>

      <div className="space-y-3">
        <SectionDivider title="Labels" />
        {containers.length === 0 ? (
          <div className="text-sm text-muted-foreground">
            No boxes found on this floor.
          </div>
        ) : (
          <>
            <PrintButton />
            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
              {containers.map((entry) => {
                const url = `${APP_URL}/${locale}/boxes/${entry.container.id}`;
                return (
                  <div
                    key={entry.container.id}
                    className="rounded-md border p-3"
                  >
                    <div className="text-sm font-medium">
                      {entry.container.name}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {entry.location.name} / {entry.room.name}
                      {entry.container.code ? ` · ${entry.container.code}` : ""}
                    </div>
                    <div className="mt-2 flex justify-center">
                      <QRCodeRenderer value={url} size={112} />
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </PageFrame>
  );
}
