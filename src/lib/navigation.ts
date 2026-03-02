import type { Locale } from "@/i18n/config";

function stripLocalePrefix(path: string, locale: Locale) {
  const prefix = `/${locale}`;
  if (path === prefix) return "/";
  return path.startsWith(prefix) ? path.slice(prefix.length) || "/" : path;
}

export function isActiveRoute(pathname: string, href: string, locale: Locale) {
  const normalizedPath = stripLocalePrefix(pathname, locale);
  const normalizedHref = stripLocalePrefix(href, locale);

  if (normalizedPath === normalizedHref) return true;
  return normalizedPath.startsWith(`${normalizedHref}/`);
}

