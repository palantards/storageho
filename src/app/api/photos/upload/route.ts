import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { getSession } from "@/lib/auth";
import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGES_PER_CONTAINER,
  MAX_UPLOAD_BYTES,
  STORAGE_BUCKET,
} from "@/lib/inventory/constants";
import {
  enqueueAiJob,
  insertPhotoRecord,
  listContainerPhotos,
} from "@/lib/inventory/service";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import { runAiJobNow } from "@/lib/inventory/ai-jobs";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 40;

const uploadSchema = z.object({
  householdId: z.string().uuid(),
  entityType: z.enum(["container", "item", "room_layout"]),
  entityId: z.string().uuid(),
});

const extensionByMime: Record<
  (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
  string
> = {
  "image/webp": "webp",
  "image/jpeg": "jpg",
  "image/png": "png",
};

function checkRateLimit(userId: string) {
  const now = Date.now();
  const current = uploadRateLimit.get(userId);

  if (!current || current.resetAt < now) {
    uploadRateLimit.set(userId, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }

  if (current.count >= MAX_UPLOADS_PER_WINDOW) {
    return false;
  }

  current.count += 1;
  uploadRateLimit.set(userId, current);
  return true;
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!checkRateLimit(session.user.id)) {
    return NextResponse.json(
      { error: "Upload rate limit exceeded. Try again in a minute." },
      { status: 429 },
    );
  }

  try {
    const formData = await request.formData();
    const parseResult = uploadSchema.safeParse({
      householdId: formData.get("householdId"),
      entityType: formData.get("entityType"),
      entityId: formData.get("entityId"),
    });
    if (!parseResult.success) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }
    const { householdId, entityType, entityId } = parseResult.data;
    const original = formData.get("original");
    const thumb = formData.get("thumb");

    if (!householdId || !entityType || !entityId || !original || !thumb) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 },
      );
    }

    if (!(original instanceof File) || !(thumb instanceof File)) {
      return NextResponse.json(
        { error: "Invalid file payload" },
        { status: 400 },
      );
    }

    if (original.size > MAX_UPLOAD_BYTES || thumb.size > MAX_UPLOAD_BYTES) {
      return NextResponse.json(
        { error: `File too large. Max ${MAX_UPLOAD_BYTES} bytes.` },
        { status: 400 },
      );
    }

    if (
      !ALLOWED_IMAGE_MIME_TYPES.includes(
        original.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
      ) ||
      !ALLOWED_IMAGE_MIME_TYPES.includes(
        thumb.type as (typeof ALLOWED_IMAGE_MIME_TYPES)[number],
      )
    ) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    try {
      await requireHouseholdWriteAccess(session.user.id, householdId);
    } catch {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (entityType === "container") {
      const existingPhotos = await listContainerPhotos({
        userId: session.user.id,
        householdId,
        containerId: entityId,
      });

      if (existingPhotos.length >= MAX_IMAGES_PER_CONTAINER) {
        return NextResponse.json(
          {
            error: `Image limit reached for this container (${MAX_IMAGES_PER_CONTAINER})`,
          },
          { status: 400 },
        );
      }
    }

    const originalExt =
      extensionByMime[original.type as keyof typeof extensionByMime];
    const thumbExt =
      extensionByMime[thumb.type as keyof typeof extensionByMime];

    if (!originalExt || !thumbExt) {
      return NextResponse.json(
        { error: "Unsupported file type" },
        { status: 400 },
      );
    }

    const base = `household/${householdId}/${entityType}/${entityId}/${Date.now()}-${crypto.randomUUID()}`;
    const originalPath = `${base}-original.${originalExt}`;
    const thumbPath = `${base}-thumb.${thumbExt}`;

    const supabase = createSupabaseAdminClient();
    const buffers = await Promise.all([
      original.arrayBuffer(),
      thumb.arrayBuffer(),
    ]);

    const originalResult = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(originalPath, Buffer.from(buffers[0]), {
        contentType: original.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (originalResult.error) {
      console.error(originalResult.error);
      return NextResponse.json(
        { error: "Failed to upload original image" },
        { status: 400 },
      );
    }

    const thumbResult = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(thumbPath, Buffer.from(buffers[1]), {
        contentType: thumb.type,
        upsert: false,
        cacheControl: "3600",
      });

    if (thumbResult.error) {
      console.error(thumbResult.error);
      await supabase.storage.from(STORAGE_BUCKET).remove([originalPath]);
      return NextResponse.json(
        { error: "Failed to upload thumbnail" },
        { status: 400 },
      );
    }

    const photo = await insertPhotoRecord({
      userId: session.user.id,
      householdId,
      entityType,
      entityId,
      originalPath,
      thumbPath,
    });

    const runNow = process.env.AI_RUN_ON_UPLOAD !== "0";
    let aiResult: Awaited<ReturnType<typeof runAiJobNow>> | null = null;

    try {
      const aiJob = await enqueueAiJob({
        userId: session.user.id,
        householdId,
        jobType: "photo_analyze",
        payload: {
          photoId: photo.id,
          householdId,
          entityType,
          entityId,
          originalPath,
          thumbPath,
        },
      });

      if (runNow) {
        aiResult = await runAiJobNow({
          jobId: aiJob.id,
          workerId: `upload-${session.user.id}-${crypto.randomUUID()}`,
        });
      }
    } catch (error) {
      console.error("AI enqueue failed", error);
    }

    return NextResponse.json({ photo, ai: aiResult });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
