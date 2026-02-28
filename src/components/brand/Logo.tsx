"use client";
import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function Logo({
  variant = "icon",
  size = 28, // treat as height
  className,
}: {
  variant?: "full" | "icon";
  size?: number;
  className?: string;
}) {
  const src = variant === "icon" ? brand.logo.icon : brand.logo.full;
  const alt = brand.name;

  const common = cn("block shrink-0 filter invert-0 dark:invert", className);

  if (variant === "icon") {
    return (
      <Image
        src={src}
        alt={alt}
        width={size}
        height={size}
        className={common}
        style={{ width: size, height: size }}
        priority
      />
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size * 6}
      height={size}
      className={cn(common, "w-auto")}
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}
