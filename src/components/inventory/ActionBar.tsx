import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  children: ReactNode;
  className?: string;
};

export function ActionBar({ children, className }: Props) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2",
        className,
      )}
    >
      {children}
    </div>
  );
}
