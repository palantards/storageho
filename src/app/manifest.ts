import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Stowlio Inventory",
    short_name: "Stowlio",
    description:
      "Shared home and storage inventory with boxes, nested containers, tags, QR labels, photos, and fast search.",
    start_url: "/en/dashboard",
    display: "standalone",
    background_color: "#f4f8f6",
    theme_color: "#1f7a6b",
    lang: "en",
    icons: [
      {
        src: "/brand/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
      {
        src: "/brand/logo-kinda-like-it.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
