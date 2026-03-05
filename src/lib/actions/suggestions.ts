"use server";

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";

import { requireSessionUser } from "@/lib/inventory/auth";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import { STORAGE_BUCKET } from "@/lib/inventory/constants";
import { analyzeContainerPhotosWithAi } from "@/lib/inventory/ai";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { db, schema } from "@/server/db";
import {
  acceptPhotoSuggestion,
  rejectPhotoSuggestion,
} from "@/lib/inventory/service";

const analyzeSchema = z.object({
  householdId: z.string().uuid(),
  containerId: z.string().uuid(),
  maxPhotos: z.number().int().min(1).max(10).optional().default(10),
  maxSuggestions: z.number().int().min(1).optional(),
  replacePending: z.boolean().optional().default(true),
  language: z.string().trim().min(2).max(10).optional(),
});

export async function analyzeContainerPhotosAction(
  input: unknown,
): Promise<
  | {
      ok: true;
      photosAnalyzed: number;
      suggestionsCount: number;
      suggestions: typeof schema.photoSuggestions.$inferSelect[];
    }
  | { ok: false; error: string }
> {
  const parsed = analyzeSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid analyze payload" };
  }

  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);
    console.info("[analyzeContainerPhotosAction] start", {
      householdId: parsed.data.householdId,
      containerId: parsed.data.containerId,
      requestedMaxPhotos: parsed.data.maxPhotos,
      maxSuggestions: parsed.data.maxSuggestions,
      replacePending: parsed.data.replacePending,
      userId: user.id,
    });

    const photos = await db.query.photos.findMany({
      where: and(
        eq(schema.photos.householdId, parsed.data.householdId),
        eq(schema.photos.entityType, "container"),
        eq(schema.photos.entityId, parsed.data.containerId),
      ),
      orderBy: [desc(schema.photos.createdAt)],
      limit: parsed.data.maxPhotos,
    });
    console.info("[analyzeContainerPhotosAction] selected photos", {
      householdId: parsed.data.householdId,
      containerId: parsed.data.containerId,
      fetchedPhotos: photos.length,
      photos: photos.map((photo) => ({
        id: photo.id,
        createdAt: photo.createdAt.toISOString(),
      })),
    });

    if (!photos.length) {
      console.warn("[analyzeContainerPhotosAction] no photos found", {
        householdId: parsed.data.householdId,
        containerId: parsed.data.containerId,
      });
      return { ok: false, error: "No photos available for this container" };
    }

    const supabase = createSupabaseAdminClient();
    const signedUrls: string[] = [];
    const signedPhotoIds: string[] = [];
    const signFailedPhotoIds: string[] = [];
    for (const photo of photos) {
      const signed = await supabase.storage
        .from(STORAGE_BUCKET)
        .createSignedUrl(photo.storagePathOriginal, 60 * 10);
      if (signed.data?.signedUrl) {
        signedUrls.push(signed.data.signedUrl);
        signedPhotoIds.push(photo.id);
      } else {
        signFailedPhotoIds.push(photo.id);
      }
    }
    console.info("[analyzeContainerPhotosAction] sign result", {
      householdId: parsed.data.householdId,
      containerId: parsed.data.containerId,
      requestedMaxPhotos: parsed.data.maxPhotos,
      fetchedPhotos: photos.length,
      signedPhotos: signedUrls.length,
      signedPhotoIds,
      signFailedPhotoIds,
    });

    if (!signedUrls.length) {
      console.warn("[analyzeContainerPhotosAction] no signed urls", {
        householdId: parsed.data.householdId,
        containerId: parsed.data.containerId,
      });
      return { ok: false, error: "Could not sign photo URLs for analysis" };
    }

    const household = await db.query.households.findFirst({
      where: eq(schema.households.id, parsed.data.householdId),
      columns: { language: true },
    });

    const analysis = await analyzeContainerPhotosWithAi({
      signedUrls,
      maxSuggestions: parsed.data.maxSuggestions,
      language: parsed.data.language || household?.language || "en",
    });

    if (parsed.data.replacePending) {
      await db
        .delete(schema.photoSuggestions)
        .where(
          and(
            eq(schema.photoSuggestions.householdId, parsed.data.householdId),
            eq(schema.photoSuggestions.containerId, parsed.data.containerId),
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
                householdId: parsed.data.householdId,
                photoId: anchorPhotoId,
                containerId: parsed.data.containerId,
                suggestedName: suggestion.name,
                suggestedQty: suggestion.qty ?? null,
                suggestedTags: suggestion.tags ?? [],
                confidence: suggestion.confidence,
                status: "pending" as const,
                createdBy: user.id,
              })),
            )
            .returning()
        : [];
    console.info("[analyzeContainerPhotosAction] completed", {
      householdId: parsed.data.householdId,
      containerId: parsed.data.containerId,
      photosAnalyzed: signedUrls.length,
      aiSuggestionsCount: analysis.suggestions.length,
      savedSuggestionsCount: inserted.length,
      replacePending: parsed.data.replacePending,
    });

    return {
      ok: true,
      photosAnalyzed: signedUrls.length,
      suggestionsCount: inserted.length,
      suggestions: inserted,
    };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Batch analyze failed" };
  }
}

const updateSuggestionSchema = z.object({
  householdId: z.string().uuid(),
  suggestionId: z.string().uuid(),
  action: z.enum(["accept", "reject"]),
  name: z.string().trim().min(1).max(160).optional(),
  quantity: z.number().int().min(1).max(100000).optional(),
  tags: z.array(z.string().trim().min(1).max(40)).max(12).optional(),
});

export async function updateSuggestionAction(
  input: unknown,
): Promise<
  | { ok: true; suggestion: Awaited<ReturnType<typeof acceptPhotoSuggestion>> }
  | { ok: false; error: string }
> {
  const parsed = updateSuggestionSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid suggestion payload" };
  }

  try {
    const user = await requireSessionUser();
    await requireHouseholdWriteAccess(user.id, parsed.data.householdId);

    if (parsed.data.action === "accept") {
      const suggestion = await acceptPhotoSuggestion({
        userId: user.id,
        householdId: parsed.data.householdId,
        suggestionId: parsed.data.suggestionId,
        name: parsed.data.name,
        quantity: parsed.data.quantity,
        tags: parsed.data.tags,
      });
      return { ok: true, suggestion };
    }

    const suggestion = await rejectPhotoSuggestion({
      userId: user.id,
      householdId: parsed.data.householdId,
      suggestionId: parsed.data.suggestionId,
    });
    return { ok: true, suggestion };
  } catch (error) {
    console.error(error);
    return { ok: false, error: "Unable to update suggestion" };
  }
}
