import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
  className?: string;
};

export function SectionHeader({ title, description, actions, className }: Props) {
  return (
    <div
      className={`flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3 ${className || ""}`}
    >
      <div className="space-y-1">
        <div className="text-base font-semibold leading-tight">{title}</div>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
