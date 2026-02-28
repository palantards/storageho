"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { brand } from "@/config/brand";
import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";
import { useI18n } from "@/components/i18n/I18nProvider";
import { cn } from "@/lib/utils";
import { icons, type IconKey } from "@/lib/icons";
import { Separator } from "@/components/ui/separator";
import { isActiveRoute } from "@/lib/navigation";

export function SidebarNav({
  locale,
  collapsed = false,
  isAdmin = false,
}: {
  locale: Locale;
  collapsed?: boolean;
  isAdmin?: boolean;
}) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <div className="flex h-full flex-col">
      <div className={cn("px-2", collapsed && "px-1")}>
        {brand.nav.app.map((group, gi) => (
          <div key={gi} className="py-2">
            {group.labelKey ? (
              <div
                className={cn(
                  "px-2 pb-2 text-xs font-medium text-muted-foreground",
                  collapsed && "sr-only",
                )}
              >
                {t(group.labelKey)}
              </div>
            ) : null}
            <div className="grid gap-1">
              {group.items.map((item, ii) => {
                const href = localizedHref(locale, item.href);
                const active = isActiveRoute(pathname, href, locale);
                const Icon = item.icon ? icons[item.icon as IconKey] : null;
                if (item.adminOnly && !isAdmin) {
                  return null;
                }
                return (
                  <Link
                    key={ii}
                    href={href}
                    className={cn(
                      "flex items-center gap-2 rounded-[var(--radius-md)] px-3 py-2 text-sm transition-colors",
                      active
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                      collapsed && "justify-center px-2",
                    )}
                    title={t(item.labelKey)}
                  >
                    {Icon ? <Icon className="h-4 w-4" /> : null}
                    <span className={cn(collapsed && "sr-only")}>
                      {t(item.labelKey)}
                    </span>
                  </Link>
                );
              })}
            </div>
            {gi !== brand.nav.app.length - 1 ? (
              <Separator className="mt-3" />
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}
