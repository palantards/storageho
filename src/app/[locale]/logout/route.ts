import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { clearSupabaseCookies, supabaseSignOut } from "@/lib/supabase";
import { getStoredTokens } from "@/lib/supabase";
import { localizedHref } from "@/i18n/routing";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  let { locale } = await params;
  if (!locale) {
    locale = "en";
  }

  const safeLocale = locale === "sv" ? "sv" : "en";
  const tokens = await getStoredTokens();
  if (tokens?.accessToken) {
    try {
      await supabaseSignOut(tokens.accessToken);
    } catch (err) {
      console.error("Failed to revoke Supabase session", err);
    }
  }

  await clearSupabaseCookies();

  const path = localizedHref(safeLocale, "/");
  return NextResponse.redirect(new URL(path, req.url));
}
