import type { Locale } from "@/i18n/config";

export function getTitleKey(pathname: string): string {
  // pathname includes /{locale}/...
  const parts = pathname.split("/").filter(Boolean);
  const rest = parts.slice(1).join("/");

  if (rest.startsWith("locations/")) return "page.locations.title";
  if (rest.startsWith("rooms/")) return "page.locations.title";
  if (rest.startsWith("boxes/")) return "page.items.title";
  if (rest.startsWith("households/") && rest.includes("/canvas")) {
    return "page.canvas.title";
  }
  if (rest.startsWith("households/")) return "page.dashboard.title";
  if (rest.startsWith("print/")) return "page.export.title";

  switch (`/${rest}`) {
    case "/dashboard":
      return "page.dashboard.title";
    case "/onboarding":
      return "page.onboarding.title";
    case "/scan":
      return "page.scan.title";
    case "/canvas":
      return "page.canvas.title";
    case "/locations":
      return "page.locations.title";
    case "/items":
      return "page.items.title";
    case "/import":
      return "page.import.title";
    case "/export":
      return "page.export.title";
    case "/profile/account":
      return "page.profile.account.title";
    case "/profile/subscription":
      return "page.profile.subscription.title";
    case "/login":
      return "page.auth.login.title";
    case "/register":
      return "page.auth.register.title";
    case "/forgot-password":
      return "page.auth.forgot.title";
    case "/reset-password":
      return "page.auth.reset.title";
    default:
      return "";
  }
}

export function stripLocale(pathname: string, locale: Locale): string {
  return pathname === `/${locale}` ? "/" : pathname.replace(`/${locale}`, "") || "/";
}
