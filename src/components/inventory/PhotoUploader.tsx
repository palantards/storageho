"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { analyzeContainerPhotosAction } from "@/lib/actions/suggestions";

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
  analyzeBatchOnComplete = false,
  maxAnalyzePhotos = 4,
}: {
  householdId: string;
  entityType: "container" | "item" | "room_layout";
  entityId: string;
  maxFiles?: number;
  onUploaded?: () => void | Promise<void>;
  refreshOnComplete?: boolean;
  analyzeBatchOnComplete?: boolean;
  maxAnalyzePhotos?: number;
}) {
  const router = useRouter();
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          multiple
          disabled={uploading}
          onChange={async (event) => {
            const rawFiles = Array.from(event.target.files || []);
            const files =
              typeof maxFiles === "number" && maxFiles > 0
                ? rawFiles.slice(0, maxFiles)
                : rawFiles;
            if (files.length === 0) return;

            try {
              setUploading(true);
              setMessage("");
              let aiSucceeded = 0;
              let aiFailed = 0;
              let aiSkipped = 0;

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

                const aiStatus = data?.ai?.status as string | undefined;
                if (aiStatus === "succeeded") aiSucceeded += 1;
                else if (aiStatus === "failed") aiFailed += 1;
                else if (aiStatus === "skipped") aiSkipped += 1;
              }

              let batchSuggestionsCount = 0;
              if (analyzeBatchOnComplete && entityType === "container") {
                const result = await analyzeContainerPhotosAction({
                  householdId,
                  containerId: entityId,
                  maxPhotos: maxAnalyzePhotos,
                  maxSuggestions: 12,
                  replacePending: true,
                });
                if (result.ok) {
                  batchSuggestionsCount = Number(result.suggestionsCount ?? 0);
                } else {
                  console.error("Batch suggestion analyze failed", result.error);
                }
              }

              await onUploaded?.();
              if (refreshOnComplete) {
                router.refresh();
              }

              if (batchSuggestionsCount > 0) {
                setMessage(
                  `Upload complete. Batch AI produced ${batchSuggestionsCount} suggestion(s) from multiple photos.`,
                );
              } else if (aiSucceeded > 0) {
                setMessage(`Upload complete. AI generated suggestions for ${aiSucceeded} photo(s).`);
              } else if (aiFailed > 0) {
                setMessage("Upload complete, but AI analysis failed. Check API key/model permissions.");
              } else if (aiSkipped > 0) {
                setMessage("Upload complete. AI job queued and will be picked by background runner.");
              } else {
                setMessage("Upload complete.");
              }
              event.target.value = "";
            } catch (error) {
              console.error(error);
              const errorMessage = error instanceof Error ? error.message : "Upload failed";
              setMessage(errorMessage);
              alert(errorMessage);
            } finally {
              setUploading(false);
            }
          }}
        />
        <Button type="button" variant="outline" disabled={uploading}>
          {uploading ? "Uploading..." : "Add Photos"}
        </Button>
      </div>
      {message ? <div className="text-xs text-muted-foreground">{message}</div> : null}
    </div>
  );
}

