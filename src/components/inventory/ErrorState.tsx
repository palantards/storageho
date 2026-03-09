import { ReactNode } from "react";

type Props = {
  title: string;
  description?: string;
  action?: ReactNode;
};

export function ErrorState({ title, description, action }: Props) {
  return (
    <div className="rounded-md border border-rose-200 bg-rose-50 p-4 text-sm dark:border-rose-900/40 dark:bg-rose-900/10">
      <div className="font-medium text-rose-800 dark:text-rose-200">{title}</div>
      {description ? (
        <div className="mt-1 text-xs text-rose-700 dark:text-rose-300">{description}</div>
      ) : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}
