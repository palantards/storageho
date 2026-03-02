import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { upsertHouseholdCanvasLayout } from "@/lib/inventory/service";
import { householdCanvasLayoutSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = householdCanvasLayoutSchema.parse(await request.json());
    const layout = await upsertHouseholdCanvasLayout({
      userId: session.user.id,
      householdId: body.householdId,
      width: body.width,
      height: body.height,
    });
    return NextResponse.json({ ok: true, layout });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unable to save household canvas layout" },
      { status: 400 },
    );
  }
}

