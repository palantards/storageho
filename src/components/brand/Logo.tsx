"use client";
import Image from "next/image";
import { brand } from "@/config/brand";
import { cn } from "@/lib/utils";

export function Logo({
  variant = "icon",
  size = 28,
  className,
}: {
  variant?: "full" | "icon";
  size?: number;
  className?: string;
}) {
  const src = variant === "icon" ? brand.logo.icon : brand.logo.full;
  const alt = brand.name;

  if (variant === "icon") {
    return (
      <span
        className={cn(
          "inline-flex shrink-0 items-center justify-center rounded-[var(--radius-md)]",
          className,
        )}
        style={{ width: size, height: size }}
      >
        <Image
          src={src}
          alt={alt}
          width={size}
          height={size}
          style={{ width: size, height: size }}
          priority
        />
      </span>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={size * 6}
      height={size}
      className={cn("block shrink-0 w-auto", className)}
      style={{ height: size, width: "auto" }}
      priority
    />
  );
}
