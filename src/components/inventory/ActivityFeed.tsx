import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import {
  BadgeCheck,
  Box,
  Camera,
  CheckCircle2,
  ClipboardList,
  FolderPlus,
  ImageIcon,
  MapPin,
  Package,
  Sparkles,
  Trash2,
  Users,
} from "lucide-react";
import { JSX } from "react";

type Activity = {
  id: string;
  actionType: string;
  entityType: string;
  entityId?: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  actorName?: string | null;
};

export type ActivityRow =
  | Activity
  | {
      activity: Activity;
      profile?: { displayName?: string | null; name?: string | null } | null;
    };

const ACTION_LABELS: Record<string, string> = {
  created: "created",
  updated: "updated",
  deleted: "deleted",
  moved: "moved",
  photo_added: "added photo",
  photo_removed: "removed photo",
  membership_updated: "updated membership",
};

const ENTITY_LABELS: Record<string, string> = {
  container: "container",
  container_item: "container item",
  item: "item",
  room: "room",
  household: "household",
  membership: "member",
  photo: "photo",
  suggestion: "AI suggestion",
};

const ENTITY_ICONS: Record<string, JSX.Element> = {
  container: <Box className="h-4 w-4" />,
  container_item: <ClipboardList className="h-4 w-4" />,
  item: <Package className="h-4 w-4" />,
  room: <MapPin className="h-4 w-4" />,
  household: <FolderPlus className="h-4 w-4" />,
  membership: <Users className="h-4 w-4" />,
  photo: <ImageIcon className="h-4 w-4" />,
  suggestion: <Sparkles className="h-4 w-4" />,
};

function formatActor(actor?: string | null) {
  return actor?.trim() || "Someone";
}

function formatTitle(item: Activity) {
  const action = ACTION_LABELS[item.actionType] ?? item.actionType ?? "updated";
  const entity =
    ENTITY_LABELS[item.entityType] ?? item.entityType ?? "activity";
  return `${formatActor(item.actorName)} ${action} ${entity}`;
}

function renderIcon(entityType: string) {
  return ENTITY_ICONS[entityType] ?? <ClipboardList className="h-4 w-4" />;
}

function linkFor(params: {
  locale: string;
  entityType?: string;
  entityId?: string | null;
  metadataKey?: string;
  metadataValue?: string;
}) {
  const { locale, entityType, entityId, metadataKey, metadataValue } = params;
  const candidateId = metadataValue || entityId || "";
  if (!candidateId) return undefined;

  const key = metadataKey?.toLowerCase();
  if (entityType === "container") return `/${locale}/boxes/${candidateId}`;
  if (entityType === "room") return `/${locale}/rooms/${candidateId}`;
  if (key === "containerid" || key === "container_id")
    return `/${locale}/boxes/${candidateId}`;
  if (key === "roomid" || key === "room_id")
    return `/${locale}/rooms/${candidateId}`;
  return undefined;
}

function renderMetadataPills(
  metadata: Record<string, unknown>,
  locale: string,
  entityType?: string,
  entityId?: string | null,
) {
  const entries = Object.entries(metadata || {}).filter(
    ([, v]) => v !== null && v !== undefined && v !== "",
  );
  if (!entries.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {entries.slice(0, 10).map(([key, value]) => {
        const valueStr =
          typeof value === "string" ||
          typeof value === "number" ||
          typeof value === "boolean"
            ? String(value)
            : Array.isArray(value)
              ? value.join(", ")
              : typeof value === "object"
                ? Object.keys(value as Record<string, unknown>)
                    .slice(0, 3)
                    .join(", ")
                : "";
        if (!valueStr) return null;

        const href = linkFor({
          locale,
          entityType,
          entityId,
          metadataKey: key,
          metadataValue: valueStr,
        });

        const pill = (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs font-medium text-muted-foreground"
          >
            <span className="text-foreground/70">{key}:</span>
            <span className="text-foreground">{valueStr}</span>
          </span>
        );

        return href ? (
          <Link
            key={key}
            href={href}
            className="transition hover:-translate-y-0.5 hover:shadow-sm"
          >
            {pill}
          </Link>
        ) : (
          pill
        );
      })}
    </div>
  );
}

function renderBadge(actionType: string) {
  switch (actionType) {
    case "created":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-200">
          <CheckCircle2 className="h-3 w-3" />
          Created
        </span>
      );
    case "deleted":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-700 dark:bg-rose-900/40 dark:text-rose-200">
          <Trash2 className="h-3 w-3" />
          Deleted
        </span>
      );
    case "photo_added":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-900/40 dark:text-blue-200">
          <Camera className="h-3 w-3" />
          Photo
        </span>
      );
    case "membership_updated":
      return (
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-900/40 dark:text-amber-200">
          <BadgeCheck className="h-3 w-3" />
          Membership
        </span>
      );
    default:
      return null;
  }
}

export function ActivityFeed({
  items,
  locale = "en",
}: {
  items: ActivityRow[];
  locale?: string;
}) {
  const normalized = (items || []).map((raw) => {
    const base: Activity = "activity" in raw ? raw.activity : (raw as Activity);
    const actorFromProfile =
      "activity" in raw
        ? raw.profile?.displayName || raw.profile?.name || undefined
        : undefined;

    const date =
      base.createdAt instanceof Date
        ? base.createdAt
        : new Date(base.createdAt as unknown as string);
    const validDate = Number.isNaN(date.getTime()) ? null : date;

    return {
      ...base,
      actorName: base.actorName || actorFromProfile || "Someone",
      createdAt: validDate,
    } as Activity;
  });

  if (normalized.length === 0) {
    return (
      <div className="rounded-md border bg-muted/40 p-4 text-sm text-muted-foreground">
        No activity yet.
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {normalized.map((item) => (
        <div
          key={item.id}
          className="rounded-lg border bg-card p-4 shadow-sm transition hover:border-foreground/20"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-muted text-foreground/80">
                {renderIcon(item.entityType)}
              </div>
              <div>
                <div className="flex items-center gap-2 text-sm font-semibold leading-tight">
                  <span>{formatTitle(item)}</span>
                  {item.actionType ? renderBadge(item.actionType) : null}
                </div>
                <div className="text-xs text-muted-foreground">
                  {item.createdAt
                    ? (() => {
                        try {
                          return formatDistanceToNow(item.createdAt, {
                            addSuffix: true,
                          });
                        } catch {
                          return "Time unknown";
                        }
                      })()
                    : "Time unknown"}
                </div>
              </div>
            </div>
          </div>

          {renderMetadataPills(
            item.metadata,
            locale,
            item.entityType,
            item.entityId,
          )}
        </div>
      ))}
    </div>
  );
}
