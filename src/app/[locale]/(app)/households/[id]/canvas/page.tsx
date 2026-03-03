import Link from "next/link";

import { HouseholdSetupFlow } from "@/components/inventory/HouseholdSetupFlow";
import { PageFrame } from "@/components/inventory/PageFrame";
import { SectionDivider } from "@/components/inventory/SectionDivider";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  ensureHouseholdCanvasInitialized,
  getHouseholdById,
  listContainersWithRoomFloor,
  listHouseholdCanvasLayers,
  listRoomsWithFloor,
} from "@/lib/inventory/service";

export default async function HouseholdCanvasPage({
  params,
}: {
  params: Promise<{ locale: Locale; id: string }>;
}) {
  const { locale, id: householdId } = await params;
  const messages = await getMessages(locale);
  const t = (key: string, fallback: string) => {
    const value = tt(messages, key);
    return value === key ? fallback : value;
  };
  const context = await getInventoryContext(locale);

  const household = await getHouseholdById({
    userId: context.user.id,
    householdId,
  });

  if (!household) {
    return <div className="text-sm text-muted-foreground">Household not found.</div>;
  }

  await ensureHouseholdCanvasInitialized({
    userId: context.user.id,
    householdId,
  });

  const [layers, rooms, containers] = await Promise.all([
    listHouseholdCanvasLayers({
      userId: context.user.id,
      householdId,
    }),
    listRoomsWithFloor({
      userId: context.user.id,
      householdId,
      includeSystem: true,
      limit: 5000,
    }),
    listContainersWithRoomFloor({
      userId: context.user.id,
      householdId,
      includeArchived: false,
      limit: 5000,
    }),
  ]);

  return (
    <PageFrame className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="text-2xl font-semibold">
            {t("app.canvasSetup.pageTitle", "Set up your storage workflow")}
          </div>
          <div className="text-sm text-muted-foreground">
            {t(
              "app.canvasSetup.pageDescription",
              "Create floors and rooms, add containers, then review the read-only map preview.",
            )}
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link href={`/${locale}/dashboard`}>
            {t("app.canvasSetup.backToDashboard", "Back to dashboard")}
          </Link>
        </Button>
      </div>

      <SectionDivider
        title={t("app.canvasSetup.householdLabel", "Household")}
        description={household.name}
      />

      <HouseholdSetupFlow
        locale={locale}
        householdId={householdId}
        householdName={household.name}
        floors={layers.map((layer) => ({
          id: layer.id,
          name: layer.name,
          locationId: layer.id,
          sortOrder: Number(layer.sortOrder ?? 0),
        }))}
        rooms={rooms.map((row) => ({
          id: row.room.id,
          name: row.room.name,
          locationId: row.location.id,
          locationName: row.location.name,
          isSystem: Boolean(row.room.isSystem),
        }))}
        containers={containers.map((row) => ({
          id: row.container.id,
          name: row.container.name,
          code: row.container.code,
          roomId: row.room.id,
          roomName: row.room.name,
          locationId: row.location.id,
          locationName: row.location.name,
        }))}
      />
    </PageFrame>
  );
}
