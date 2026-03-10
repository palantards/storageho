import Link from "next/link";

import { ErrorState } from "@/components/inventory/ErrorState";
import { HouseholdSetupFlow } from "@/components/inventory/HouseholdSetupFlow";
import { PageFrame } from "@/components/inventory/PageFrame";
import { PageHeader } from "@/components/inventory/PageHeader";
import { Button } from "@/components/ui/button";
import type { Locale } from "@/i18n/config";
import { getMessages } from "@/i18n/getMessages";
import { t as tt } from "@/i18n/translate";
import { getInventoryContext } from "@/lib/inventory/page-context";
import {
  ensureHouseholdFloorsInitialized,
  getHouseholdById,
  listContainersWithRoomFloor,
  listHouseholdFloors,
  listRoomsWithFloor,
} from "@/lib/inventory/service";
import { withRlsUserContext } from "@/server/db/tenant";

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
  const userId = context.user.id;

  const household = await withRlsUserContext(userId, async () =>
    getHouseholdById({
      userId,
      householdId,
    }),
  );

  if (!household) {
    return <ErrorState title="Household not found." />;
  }

  await withRlsUserContext(userId, async () =>
    ensureHouseholdFloorsInitialized({
      userId,
      householdId,
    }),
  );

  const [floors, rooms, containers] = await withRlsUserContext(
    userId,
    async () =>
      Promise.all([
        listHouseholdFloors({
          userId,
          householdId,
        }),
        listRoomsWithFloor({
          userId,
          householdId,
          includeSystem: true,
          limit: 5000,
        }),
        listContainersWithRoomFloor({
          userId,
          householdId,
          includeArchived: false,
          limit: 5000,
        }),
      ]),
  );

  return (
    <PageFrame className="space-y-6">
      <PageHeader
        title={`${t("nav.canvas", "Canvas")}: ${household.name}`}
        description={t(
          "app.canvasSetup.pageDescription",
          "Map-first setup: pick a floor, create rooms and containers from tools, and review the live read-only preview.",
        )}
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/${locale}/dashboard`}>
              {t("app.canvasSetup.backToDashboard", "Back to dashboard")}
            </Link>
          </Button>
        }
      />

      <HouseholdSetupFlow
        locale={locale}
        householdId={householdId}
        floors={floors.map((floor) => ({
          id: floor.id,
          name: floor.name,
          locationId: floor.id,
          sortOrder: Number(floor.sortOrder ?? 0),
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

