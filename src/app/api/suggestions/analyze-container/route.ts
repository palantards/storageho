import { NextRequest, NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import { analyzeContainerPhotosWithAi } from "@/lib/inventory/ai";
import { canWriteInventory } from "@/lib/inventory/roles";
import { listMembershipsForUser } from "@/lib/inventory/service";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { STORAGE_BUCKET } from "@/lib/inventory/constants";
import { db, schema } from "@/server/db";

const bodySchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
  maxPhotos: z.number().int().min(1).max(6).optional().default(4),
  maxSuggestions: z.number().int().min(1).max(24).optional().default(12),
  replacePending: z.boolean().optional().default(true),
  language: z.string().trim().min(2).max(10).optional(),
});

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = bodySchema.parse(await request.json());

    const memberships = await listMembershipsForUser(session.user.id);
    const membership = memberships.find(
      (entry) => entry.household.id === body.householdId,
    )?.membership;
    if (!membership || !canWriteInventory(membership.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const photos = await db.query.photos.findMany({
      where: and(
        eq(schema.photos.householdId, body.householdId),
        eq(schema.photos.entityType, "container"),
        eq(schema.photos.entityId, body.containerId),
      ),
      orderBy: [desc(schema.photos.createdAt)],
      limit: body.maxPhotos,
    });

    if (!photos.length) {
      return NextResponse.json(
        { error: "No photos available for this container" },
        { status: 400 },
      );
    }

    const supabase = createSupabaseAdminClient();
    const signedUrls: string[] = [];
    for (const photo of photos) {
      const signed = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(photo.storagePathOriginal, 60 * 10);
      if (signed.data?.signedUrl) {
        signedUrls.push(signed.data.signedUrl);
      }
    }

    if (!signedUrls.length) {
      return NextResponse.json(
        { error: "Could not sign photo URLs for analysis" },
        { status: 400 },
      );
    }

    const household = await db.query.households.findFirst({
      where: eq(schema.households.id, body.householdId),
      columns: { language: true },
    });

    const analysis = await analyzeContainerPhotosWithAi({
      signedUrls,
      maxSuggestions: body.maxSuggestions,
      language: body.language || household?.language || "en",
    });

    if (body.replacePending) {
      await db
        .delete(schema.photoSuggestions)
        .where(
          and(
            eq(schema.photoSuggestions.householdId, body.householdId),
            eq(schema.photoSuggestions.containerId, body.containerId),
            eq(schema.photoSuggestions.status, "pending"),
          ),
        );
    }

    const anchorPhotoId = photos[0].id;
    const inserted =
      analysis.suggestions.length > 0
        ? await db
            .insert(schema.photoSuggestions)
            .values(
              analysis.suggestions.map((suggestion) => ({
                householdId: body.householdId,
                photoId: anchorPhotoId,
                containerId: body.containerId,
                suggestedName: suggestion.name,
                suggestedQty: suggestion.qty ?? null,
                suggestedTags: suggestion.tags ?? [],
                confidence: suggestion.confidence,
                status: "pending" as const,
                createdBy: session.user.id,
              })),
            )
            .returning()
        : [];

    return NextResponse.json({
      ok: true,
      photosAnalyzed: signedUrls.length,
      suggestionsCount: inserted.length,
      suggestions: inserted,
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Batch analyze failed" },
      { status: 400 },
    );
  }
}


