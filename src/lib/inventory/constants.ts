export const STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || "inventory-private";

export const MAX_UPLOAD_BYTES = Number(process.env.MAX_UPLOAD_BYTES || 8 * 1024 * 1024);
export const MAX_IMAGES_PER_CONTAINER = Number(
  process.env.MAX_IMAGES_PER_CONTAINER || process.env.NEXT_PUBLIC_MAX_IMAGES_PER_CONTAINER || 20,
);

export const ALLOWED_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export const SEARCH_DEBOUNCE_MS = 250;
export const DEFAULT_PAGE_SIZE = 50;
