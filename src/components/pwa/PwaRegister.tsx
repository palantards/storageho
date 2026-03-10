"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") {
      if (typeof window !== "undefined" && "serviceWorker" in navigator) {
        Promise.all([
          navigator.serviceWorker
            .getRegistrations()
            .then((registrations) =>
              Promise.all(
                registrations.map((registration) => registration.unregister()),
              ),
            )
            .catch(() => null),
          "caches" in window
            ? caches
                .keys()
                .then((keys) =>
                  Promise.all(
                    keys
                      .filter((key) => key.startsWith("stowlio-shell-"))
                      .map((key) => caches.delete(key)),
                  ),
                )
                .catch(() => null)
            : Promise.resolve(),
        ]).catch(() => null);
      }
      return;
    }

    if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
      return;
    }

    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.error("PWA service worker registration failed", error);
    });
  }, []);

  return null;
}
