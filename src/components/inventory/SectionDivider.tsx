import { cn } from "@/lib/utils";

type Props = {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  id?: string;
  className?: string;
};

export function SectionDivider({ title, description, actions, id, className }: Props) {
  return (
    <div className={cn("space-y-1", className)} id={id}>
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 rounded-full bg-muted" />
        <div className="text-sm font-semibold text-foreground whitespace-nowrap">{title}</div>
        <div className="h-px flex-1 rounded-full bg-muted" />
        {actions ? <div className="shrink-0">{actions}</div> : null}
      </div>
      {description ? (
        <div className="text-xs text-muted-foreground text-center md:text-left">{description}</div>
      ) : null}
    </div>
  );
}
