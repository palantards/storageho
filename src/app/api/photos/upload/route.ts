import { NextRequest, NextResponse } from "next/server";

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
  listMembershipsForUser,
} from "@/lib/inventory/service";
import { canWriteInventory } from "@/lib/inventory/roles";
import { createSupabaseAdminClient } from "@/lib/supabaseServer";

const uploadRateLimit = new Map<string, { count: number; resetAt: number }>();
const WINDOW_MS = 60_000;
const MAX_UPLOADS_PER_WINDOW = 40;

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
    const householdId = String(formData.get("householdId") || "");
    const entityType = String(formData.get("entityType") || "") as
      | "container"
      | "item";
    const entityId = String(formData.get("entityId") || "");
    const original = formData.get("original");
    const thumb = formData.get("thumb");

    if (!householdId || !entityType || !entityId || !original || !thumb) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    if (!(original instanceof File) || !(thumb instanceof File)) {
      return NextResponse.json({ error: "Invalid file payload" }, { status: 400 });
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
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    const memberships = await listMembershipsForUser(session.user.id);
    const membership = memberships.find(
      (m) => m.household.id === householdId,
    )?.membership;

    if (!membership || !canWriteInventory(membership.role)) {
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

    const base = `household/${householdId}/${entityType}/${entityId}/${Date.now()}-${crypto.randomUUID()}`;
    const originalPath = `${base}-original.webp`;
    const thumbPath = `${base}-thumb.webp`;

    const supabase = createSupabaseAdminClient();
    const [originalResult, thumbResult] = await Promise.all([
      supabase.storage
        .from(STORAGE_BUCKET)
        .upload(originalPath, Buffer.from(await original.arrayBuffer()), {
          contentType: original.type,
          upsert: false,
          cacheControl: "3600",
        }),
      supabase.storage
        .from(STORAGE_BUCKET)
        .upload(thumbPath, Buffer.from(await thumb.arrayBuffer()), {
          contentType: thumb.type,
          upsert: false,
          cacheControl: "3600",
        }),
    ]);

    if (originalResult.error || thumbResult.error) {
      return NextResponse.json(
        {
          error:
            originalResult.error?.message ||
            thumbResult.error?.message ||
            "Failed to upload to storage",
        },
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

    return NextResponse.json({ photo });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 400 },
    );
  }
}
