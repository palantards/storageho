import { formatDistanceToNow } from "date-fns";

type Activity = {
  id: string;
  actionType: string;
  entityType: string;
  metadata: Record<string, unknown>;
  createdAt: Date;
  actorName?: string | null;
};

export function ActivityFeed({
  items,
}: {
  items: Activity[];
}) {
  if (items.length === 0) {
    return <div className="rounded-md border p-4 text-sm text-muted-foreground">No activity yet.</div>;
  }

  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item.id} className="rounded-md border p-3 text-sm">
          <div className="font-medium">
            {item.actorName || "Someone"} · {item.actionType} {item.entityType}
          </div>
          <div className="text-xs text-muted-foreground">
            {formatDistanceToNow(item.createdAt, { addSuffix: true })}
          </div>
          {Object.keys(item.metadata || {}).length ? (
            <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
              {JSON.stringify(item.metadata, null, 2)}
            </pre>
          ) : null}
        </div>
      ))}
    </div>
  );
}