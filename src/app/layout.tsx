import type { Metadata, Viewport } from "next";
import "./globals.css";

import { brand } from "@/config/brand";

export const metadata: Metadata = {
  title: brand.name,
  description:
    "Stowlio helps households organize floors, rooms, boxes, items, photos, and QR labels in one private inventory app.",
};

export const viewport: Viewport = {
  themeColor: "#1f7a6b",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning data-scroll-behavior="smooth">
      <body className="min-h-dvh bg-background text-foreground antialiased">
        {children}
      </body>
    </html>
  );
}
