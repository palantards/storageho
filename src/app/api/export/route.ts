import { NextRequest } from "next/server";

import { getSession } from "@/lib/auth";
import { exportRowsToCsv } from "@/lib/inventory/csv";
import { getExportRows } from "@/lib/inventory/service";

export async function GET(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return new Response("Unauthorized", { status: 401 });
  }

  const householdId = request.nextUrl.searchParams.get("householdId");
  const floorParam = request.nextUrl.searchParams.get("floorId");
  const floorId = floorParam && floorParam !== "all" ? floorParam : null;

  if (!householdId) {
    return new Response("householdId is required", { status: 400 });
  }

  try {
    const rows = await getExportRows({
      userId: session.user.id,
      householdId,
      locationId: floorId || undefined,
    });

    const csv = exportRowsToCsv(rows);

    return new Response(csv, {
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": "attachment; filename=inventory-export.csv",
      },
    });
  } catch (error) {
    console.error(error);
    return new Response("Export failed", { status: 400 });
  }
}

