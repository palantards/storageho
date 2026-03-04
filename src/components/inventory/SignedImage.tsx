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
  const [fetchedUrl, setFetchedUrl] = useState<string | null>(() =>
    cachedEntry && cachedEntry.expiresAt > Date.now() ? cachedEntry.url : null,
  );
  const url = fetchedUrl || cachedEntry?.url || null;

  useEffect(() => {
    if (cachedEntry && cachedEntry.expiresAt > Date.now()) return undefined;
    let active = true;
    fetch(`/api/storage/signed-url`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ path }),
    })
      .then((response) => response.json())
      .then((data) => {
        if (!active) return;
        if (data?.url) {
          cache.set(path, { url: data.url, expiresAt: Date.now() + 14 * 60 * 1000 });
          setFetchedUrl(data.url);
        } else if (data?.error) {
          console.error(data.error);
        }
      })
      .catch((error) => {
        console.error(error);
      });

    return () => {
      active = false;
    };
  }, [path, cachedEntry]);

  if (!url) {
    return <div className={`animate-pulse bg-muted ${className || ""}`} />;
  }

  // eslint-disable-next-line @next/next/no-img-element
  return <img src={url} alt={alt} className={className} loading="lazy" />;
}

