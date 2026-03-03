"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";
import { useI18n } from "@/components/i18n/I18nProvider";
import { getTitleKey } from "@/lib/pageTitles";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/brand/Logo";
import { ProductName } from "@/components/brand/ProductName";
import { SidebarNav } from "@/components/nav/SidebarNav";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { UserMenu } from "@/components/nav/UserMenu";
import { Button } from "@/components/ui/button";
import { GlobalSearchBar } from "@/components/inventory/GlobalSearchBar";
import { HouseholdSwitcher } from "@/components/inventory/HouseholdSwitcher";
import {
  Sheet,
  SheetContent,
  SheetTrigger,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { icons } from "@/lib/icons";
import { SessionUser } from "@/lib/auth";

export interface AppUser extends SessionUser {
  name: string;
}

export function AppShell({
  locale,
  user,
  activeHouseholdId,
  householdMemberships,
  children,
}: {
  locale: Locale;
  user: AppUser;
  activeHouseholdId?: string;
  householdMemberships: Array<{
    householdId: string;
    householdName: string;
    role: string;
  }>;
  children: React.ReactNode;
}) {
  const { t } = useI18n();
  const pathname = usePathname();
  const titleKey = getTitleKey(pathname);
  const MenuIcon = icons.Menu;
  const ScanIcon = icons.ScanLine;
  const CollapseIcon = icons.PanelLeftClose;
  const ExpandIcon = icons.PanelLeftOpen;

  const [sidebarCollapsed, setSidebarCollapsed] = React.useState(false);

  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem("sidebarCollapsed");
    setSidebarCollapsed(stored === "true");
  }, []);

  const toggleSidebar = React.useCallback(() => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem("sidebarCollapsed", String(next));
      }
      return next;
    });
  }, []);

  return (
    <div className="min-h-dvh bg-background">
      <div className="flex min-h-dvh w-full">
        {/* Desktop sidebar */}
        <aside
          className={cn(
            "group hidden shrink-0 border-r border-border bg-card md:flex md:flex-col md:transition-[width] md:duration-200 h-full min-h-dvh overflow-hidden",
            sidebarCollapsed ? "w-16" : "w-60",
          )}
        >
          <div className="flex items-center gap-2 px-3 py-3">
            <Link
              href={localizedHref(locale, "/dashboard")}
              className="flex items-center gap-3"
            >
              <Logo variant="icon" size={28} className="rounded-[var(--radius-md)]" />
              <span className={cn("text-sm font-semibold", sidebarCollapsed && "sr-only")}>
                <ProductName />
              </span>
            </Link>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Toggle sidebar"
              className={cn(
                "ml-auto hidden md:inline-flex transition-opacity",
                sidebarCollapsed ? "opacity-0 group-hover:opacity-100" : "opacity-100",
              )}
              onClick={toggleSidebar}
              aria-expanded={!sidebarCollapsed}
            >
              {sidebarCollapsed ? <ExpandIcon className="h-4 w-4" /> : <CollapseIcon className="h-4 w-4" />}
            </Button>
          </div>
          <div className="flex-1 overflow-y-auto px-2 pb-3">
            <SidebarNav locale={locale} isAdmin={user.isAdmin} collapsed={sidebarCollapsed} />
          </div>
          <div className="mt-auto space-y-2 border-t border-border px-2 pb-3 pt-2">
            {!sidebarCollapsed ? (
              <HouseholdSwitcher
                activeHouseholdId={activeHouseholdId}
                memberships={householdMemberships}
              />
            ) : null}
            <div
              className={cn(
                "flex items-center justify-between gap-2 rounded-md border px-2 py-1",
                sidebarCollapsed && "flex-col border-none px-0 py-0",
              )}
            >
              <ThemeToggle />
              <UserMenu locale={locale} user={user} />
            </div>
          </div>
        </aside>

        {/* Main area */}
        <main className="flex min-w-0 flex-1 flex-col min-h-0">
          <header className="sticky top-0 z-10 border-b border-border bg-background/80 backdrop-blur">
            <div className="flex items-center justify-between gap-2 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                {/* Mobile menu */}
                <div className="md:hidden">
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Open navigation"
                      >
                        <MenuIcon className="h-5 w-5" />
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="w-80 p-0">
                      <SheetHeader className="border-b border-border p-4">
                        <SheetTitle className="flex items-center gap-3">
                          <Logo
                            variant="icon"
                            size={28}
                            className="rounded-[var(--radius-md)]"
                          />
                          <span className="truncate">
                            <ProductName />
                          </span>
                        </SheetTitle>
                      </SheetHeader>
                      <div className="p-3">
                        <SidebarNav locale={locale} isAdmin={user.isAdmin} />
                      </div>
                      <div className="mt-auto space-y-3 border-t border-border p-3">
                        <HouseholdSwitcher
                          activeHouseholdId={activeHouseholdId}
                          memberships={householdMemberships}
                        />
                        <div className="flex items-center justify-between gap-2 rounded-md border px-2 py-1">
                          <ThemeToggle />
                          <UserMenu locale={locale} user={user} />
                        </div>
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                <div className="min-w-0">
                  <h1 className="truncate text-sm font-semibold">
                    {titleKey ? t(titleKey) : ""}
                  </h1>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <GlobalSearchBar householdId={activeHouseholdId} />
                <Button asChild variant="outline" size="sm" className="md:hidden">
                  <Link href={localizedHref(locale, "/scan")} className="inline-flex items-center gap-1">
                    <ScanIcon className="h-4 w-4" />
                    Scan
                  </Link>
                </Button>
              </div>
            </div>
          </header>

          <div className={cn("flex-1 overflow-y-auto p-4 md:p-6")}>{children}</div>
        </main>
      </div>
    </div>
  );
}

