"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
}: {
  householdId: string;
  entityType: "container" | "item" | "room_layout";
  entityId: string;
  maxFiles?: number;
  onUploaded?: () => void;
}) {
  const [uploading, setUploading] = useState(false);

  return (
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

            for (const file of files) {
              const originalBlob = await resizeToBlob(file, MAX_ORIGINAL_DIMENSION, 0.82);
              const thumbBlob = await resizeToBlob(file, MAX_THUMB_DIMENSION, 0.76);

              const payload = new FormData();
              payload.append("householdId", householdId);
              payload.append("entityType", entityType);
              payload.append("entityId", entityId);
              payload.append("original", new File([originalBlob], `${file.name}-original.webp`, {
                type: "image/webp",
              }));
              payload.append("thumb", new File([thumbBlob], `${file.name}-thumb.webp`, {
                type: "image/webp",
              }));

              const response = await fetch("/api/photos/upload", {
                method: "POST",
                body: payload,
              });

              if (!response.ok) {
                const data = await response.json().catch(() => null);
                throw new Error(data?.error || "Upload failed");
              }
            }

            onUploaded?.();
            event.target.value = "";
          } catch (error) {
            console.error(error);
            alert(error instanceof Error ? error.message : "Upload failed");
          } finally {
            setUploading(false);
          }
        }}
      />
      <Button type="button" variant="outline" disabled={uploading}>
        {uploading ? "Uploading..." : "Add Photos"}
      </Button>
    </div>
  );
}
