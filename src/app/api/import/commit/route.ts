import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { commitInventoryCsv } from "@/lib/inventory/csv";
import { getActiveMembershipContext } from "@/lib/inventory/service";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import { withRlsUserContext } from "@/server/db/tenant";

const csvRowSchema = z.object({
  location: z.string().min(1),
  room: z.string().min(1),
  containerPath: z.string().min(1),
  containerCode: z.string().optional().default(""),
  itemName: z.string().min(1),
  itemAliases: z.string().optional().default(""),
  tags: z.string().optional().default(""),
  quantity: z.number().int().min(1),
  note: z.string().optional().default(""),
});

const bodySchema = z.object({
  householdId: z.string().uuid().optional(),
  rows: z.array(csvRowSchema).min(1).max(5000),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const payload = bodySchema.parse(await request.json());
    const result = await withRlsUserContext(session.user.id, async () => {
      const context = await getActiveMembershipContext(session.user.id);
      const householdId = payload.householdId || context.active?.household.id;

      if (!householdId) {
        return NextResponse.json(
          { error: "No active household" },
          { status: 400 },
        );
      }

      const canAccessHousehold = context.memberships.some(
        (entry) => entry.household.id === householdId,
      );
      if (!canAccessHousehold) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      try {
        await requireHouseholdWriteAccess(session.user.id, householdId);
      } catch {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }

      const commitResult = await commitInventoryCsv({
        userId: session.user.id,
        householdId,
        rows: payload.rows,
      });

      return NextResponse.json({ ok: true, result: commitResult });
    });

    return result;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Import failed" },
      { status: 400 },
    );
  }
}

