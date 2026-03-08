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
  insertPhotoRecord,
  listContainerPhotos,
} from "@/lib/inventory/service";
import { requireHouseholdWriteAccess } from "@/lib/inventory/guards";
import {
  applyRateLimitHeaders,
  consumeRateLimit,
} from "@/lib/security/rate-limit";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";
import { withRlsUserContext } from "@/server/db/tenant";

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

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const rateLimit = await consumeRateLimit({
    scope: "photo_upload_user",
    identifier: session.user.id,
    windowSec: Math.floor(WINDOW_MS / 1000),
    limit: MAX_UPLOADS_PER_WINDOW,
  });

  if (!rateLimit.allowed) {
    const response = NextResponse.json(
      { error: "Upload rate limit exceeded. Try again in a minute." },
      { status: 429 },
    );
    applyRateLimitHeaders(response.headers, rateLimit);
    return response;
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

    const existingPhotoCount = await withRlsUserContext(
      session.user.id,
      async () => {
        await requireHouseholdWriteAccess(session.user.id, householdId);
        if (entityType !== "container") {
          return -1;
        }

        const existingPhotos = await listContainerPhotos({
          userId: session.user.id,
          householdId,
          containerId: entityId,
        });

        return existingPhotos.length;
      },
    ).catch(() => null);

    if (existingPhotoCount === null) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (
      existingPhotoCount >= 0 &&
      existingPhotoCount >= MAX_IMAGES_PER_CONTAINER
    ) {
      return NextResponse.json(
        {
          error: `Image limit reached for this container (${MAX_IMAGES_PER_CONTAINER})`,
        },
        { status: 400 },
      );
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

    const photo = await withRlsUserContext(session.user.id, async () => {
      return insertPhotoRecord({
        userId: session.user.id,
        householdId,
        entityType,
        entityId,
        originalPath,
        thumbPath,
      });
    });

    const response = NextResponse.json({ photo });
    applyRateLimitHeaders(response.headers, rateLimit);
    return response;
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
