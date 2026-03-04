"use client";

import Link from "next/link";

import { brand } from "@/config/brand";
import type { Locale } from "@/i18n/config";
import { localizedHref } from "@/i18n/routing";
import { useI18n } from "@/components/i18n/I18nProvider";
import { icons, type IconKey } from "@/lib/icons";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({
  locale,
  user,
}: {
  locale: Locale;
  user: { name: string; email: string };
}) {
  const { t } = useI18n();
  const initials = user.name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase())
    .join("");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          className="inline-flex items-center gap-2 rounded-[var(--radius-md)] px-2 py-1 hover:bg-muted"
          aria-label="User menu"
        >
          <Avatar>
            <AvatarFallback>{initials || "U"}</AvatarFallback>
          </Avatar>
          <div className="hidden text-left md:block">
            <div className="text-sm font-medium leading-none">{user.name}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </div>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>{t("userMenu.signedInAs")}</DropdownMenuLabel>
        <div className="px-2 pb-2 text-xs text-muted-foreground">
          {user.email}
        </div>
        <DropdownMenuSeparator />
        {brand.nav.userMenu.map((item, idx) => {
          const href = localizedHref(locale, item.href);
          const Icon = item.icon ? icons[item.icon as IconKey] : null;
          const content = (
            <>
              {Icon ? <Icon className="mr-2 h-4 w-4" /> : null}
              <span>{t(item.labelKey)}</span>
            </>
          );
          return item.href === "/logout" ? (
            <DropdownMenuItem key={idx} asChild>
              <form action={href} method="post" className="w-full">
                <button type="submit" className="flex w-full items-center">
                  {content}
                </button>
              </form>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem key={idx} asChild>
              <Link href={href}>{content}</Link>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

