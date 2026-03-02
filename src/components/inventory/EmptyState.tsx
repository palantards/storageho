import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function EmptyState({ title, description, action }: Props) {
  return (
    <div className="rounded-md border p-4 text-sm text-muted-foreground">
      <div className="font-medium text-foreground">{title}</div>
      {description ? <div className="text-xs mt-1">{description}</div> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
