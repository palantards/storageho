import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { createRoomFromSetupFlow } from "@/lib/inventory/service";
import { createRoomFromSetupSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createRoomFromSetupSchema.parse(await request.json());
    const result = await createRoomFromSetupFlow({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
      name: body.name,
      description: body.description,
    });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error ? error.message : "Unable to create room from setup flow",
      },
      { status: 400 },
    );
  }
}

