import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  actions?: ReactNode;
};

export function SectionHeader({ title, description, actions }: Props) {
  return (
    <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between md:gap-3">
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
