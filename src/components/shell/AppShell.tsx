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

  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
        {/* Desktop sidebar */}
        <aside className="hidden w-64 shrink-0 border-r border-border bg-card md:flex md:flex-col">
          <Link
            href={localizedHref(locale, "/dashboard")}
            className="flex items-center gap-3 p-4"
          >
            <Logo
              variant="icon"
              size={28}
              className="rounded-[var(--radius-md)]"
            />
            <ProductName />
          </Link>
          <div className="px-3 pb-4">
            <SidebarNav locale={locale} isAdmin={user.isAdmin} />
          </div>
        </aside>

        {/* Main area */}
        <main className="flex min-w-0 flex-1 flex-col">
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
                        <SidebarNav locale={locale} />
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
                <HouseholdSwitcher
                  activeHouseholdId={activeHouseholdId}
                  memberships={householdMemberships}
                />
                <Button asChild variant="outline" size="sm" className="md:hidden">
                  <Link href={localizedHref(locale, "/scan")} className="inline-flex items-center gap-1">
                    <ScanIcon className="h-4 w-4" />
                    Scan
                  </Link>
                </Button>
                <GlobalSearchBar householdId={activeHouseholdId} />
                <ThemeToggle />
                <UserMenu locale={locale} user={user} />
              </div>
            </div>
          </header>

          <div className={cn("flex-1 p-4 md:p-6")}>{children}</div>
        </main>
      </div>
    </div>
  );
}

