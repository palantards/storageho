import { NextRequest, NextResponse } from "next/server";

import { getSession } from "@/lib/auth";
import { createContainerFromSetupFlow } from "@/lib/inventory/service";
import { createContainerFromSetupSchema } from "@/lib/inventory/validation";

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = createContainerFromSetupSchema.parse(await request.json());
    const result = await createContainerFromSetupFlow({
      userId: session.user.id,
      householdId: body.householdId,
      layerId: body.layerId,
      roomId: body.roomId ?? null,
      name: body.name,
      code: body.code,
      description: body.description,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Unable to create container from setup flow",
      },
      { status: 400 },
    );
  }
}

