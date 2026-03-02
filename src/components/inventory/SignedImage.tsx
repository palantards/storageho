"use client";

import { useEffect, useState } from "react";

const cache = new Map<string, { url: string; expiresAt: number }>();

export function SignedImage({
  path,
  alt,
  className,
}: {
  path: string;
  alt: string;
  className?: string;
}) {
  const cachedEntry = cache.get(path);
  const cachedUrl =
    cachedEntry && cachedEntry.expiresAt > Date.now() ? cachedEntry.url : null;
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(null);
  const url = cachedUrl || fetchedUrl;

  useEffect(() => {
    if (cachedUrl) {
      return;
    }

    let active = true;
    fetch(`/api/storage/signed-url?path=${encodeURIComponent(path)}`)
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        if (data?.url) {
          cache.set(path, { url: data.url, expiresAt: Date.now() + 14 * 60 * 1000 });
          setFetchedUrl(data.url);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      active = false;
    };
  }, [path, cachedUrl]);

  if (!url) {
    return <div className={`animate-pulse bg-muted ${className || ""}`} />;
  }

  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

