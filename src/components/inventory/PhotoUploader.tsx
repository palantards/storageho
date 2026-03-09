"use client";

import { useEffect, useRef, useState } from "react";
import { ImagePlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { FormSubmitError } from "@/components/ui/form-feedback";
import { useBusyCursor } from "@/hooks/useBusyCursor";

const MAX_ORIGINAL_DIMENSION = 1600;
const MAX_THUMB_DIMENSION = 400;

async function fileToImage(file: File) {
  const src = URL.createObjectURL(file);
  const image = new Image();
  image.src = src;
  await new Promise<void>((resolve, reject) => {
    image.onload = () => resolve();
    image.onerror = () => reject(new Error("Failed to load image"));
  });
  URL.revokeObjectURL(src);
  return image;
}

async function resizeToBlob(file: File, maxDimension: number, quality = 0.82) {
  const image = await fileToImage(file);
  const ratio = Math.min(1, maxDimension / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * ratio));
  const height = Math.max(1, Math.round(image.height * ratio));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas context unavailable");
  context.drawImage(image, 0, 0, width, height);

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", quality);
  });

  if (!blob) throw new Error("Image conversion failed");
  return blob;
}

export function PhotoUploader({
  householdId,
  entityType,
  entityId,
  maxFiles,
  onUploaded,
  refreshOnComplete = false,
}: {
  householdId: string;
  entityType: "container" | "item" | "room_layout";
  entityId: string;
  maxFiles?: number;
  onUploaded?: () => void | Promise<void>;
  refreshOnComplete?: boolean;
}) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  useBusyCursor(uploading);

  useEffect(() => {
    if (!formError) return;
    toast.error(formError);
  }, [formError]);

  return (
    <div className="space-y-3">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        multiple
        className="sr-only"
        disabled={uploading}
        onChange={async (event) => {
          const inputElement = event.currentTarget;
          const rawFiles = Array.from(event.target.files || []);
          const files =
            typeof maxFiles === "number" && maxFiles > 0
              ? rawFiles.slice(0, maxFiles)
              : rawFiles;
          if (files.length === 0) return;

          try {
            setUploading(true);
            setFormError(null);
            setMessage("");

            for (const file of files) {
              const originalBlob = await resizeToBlob(file, MAX_ORIGINAL_DIMENSION, 0.82);
              const thumbBlob = await resizeToBlob(file, MAX_THUMB_DIMENSION, 0.76);

              const payload = new FormData();
              payload.append("householdId", householdId);
              payload.append("entityType", entityType);
              payload.append("entityId", entityId);
              payload.append(
                "original",
                new File([originalBlob], `${file.name}-original.webp`, {
                  type: "image/webp",
                }),
              );
              payload.append(
                "thumb",
                new File([thumbBlob], `${file.name}-thumb.webp`, {
                  type: "image/webp",
                }),
              );

              const response = await fetch("/api/photos/upload", {
                method: "POST",
                body: payload,
              });

              const data = await response.json().catch(() => null);
              if (!response.ok) {
                throw new Error(data?.error || "Upload failed");
              }
            }

            await onUploaded?.();
            if (refreshOnComplete) {
              router.refresh();
            }

            setMessage("Upload complete.");
          } catch (error) {
            console.error(error);
            const errorMessage = error instanceof Error ? error.message : "Upload failed";
            setFormError(errorMessage);
          } finally {
            setUploading(false);
            inputElement.value = "";
          }
        }}
      />

      <div
        role="button"
        tabIndex={0}
        className="cursor-pointer rounded-xl border border-dashed bg-muted/20 p-4 transition hover:border-primary/50 hover:bg-muted/40"
        onClick={() => !uploading && fileInputRef.current?.click()}
        onKeyDown={(e) => {
          if ((e.key === "Enter" || e.key === " ") && !uploading) {
            fileInputRef.current?.click();
          }
        }}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="rounded-lg border bg-background p-2 text-muted-foreground">
              <ImagePlus className="h-4 w-4" />
            </div>
            <div className="space-y-1">
              <div className="text-sm font-medium">Upload photos</div>
              <div className="text-xs text-muted-foreground">
                PNG, JPG, or WEBP. Images are compressed automatically.
              </div>
            </div>
          </div>

          <Button
            type="button"
            variant="outline"
            disabled={uploading}
            loading={uploading}
            loadingText="Uploading..."
            onClick={(e) => {
              e.stopPropagation();
              fileInputRef.current?.click();
            }}
          >
            Add Photos
          </Button>
        </div>
      </div>

      <FormSubmitError error={formError} title="Photo upload failed" />
      {message ? <div className="text-xs text-muted-foreground">{message}</div> : null}
    </div>
  );
}
