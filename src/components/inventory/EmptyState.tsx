import { ReactNode } from "react";

import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
  variant?: "default" | "dashed";
};

export function EmptyState({
  title,
  description,
  action,
  icon,
  variant = "default",
}: Props) {
  if (variant === "dashed" || icon) {
    return (
      <div className="rounded-lg border border-dashed bg-muted/20 p-8 text-center">
        {icon ? (
          <div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {icon}
          </div>
        ) : null}
        <div className="text-sm font-medium text-foreground">{title}</div>
        {description ? (
          <div className="mt-1 text-xs text-muted-foreground">{description}</div>
        ) : null}
        {action ? <div className="mt-3">{action}</div> : null}
      </div>
    );
  }

  return (
    <div className={cn("rounded-md border p-4 text-sm text-muted-foreground")}>
      <div className="font-medium text-foreground">{title}</div>
      {description ? <div className="mt-1 text-xs">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
