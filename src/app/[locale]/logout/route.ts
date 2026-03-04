import { NextRequest, NextResponse } from "next/server";
import { localizedHref } from "@/i18n/routing";
import {
  clearSupabaseCookies,
  getStoredTokens,
  supabaseSignOut,
} from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const { locale: rawLocale } = await params;
  const locale = rawLocale === "sv" ? "sv" : "en";
  const tokens = await getStoredTokens();
  if (tokens?.accessToken) {
    try {
      await supabaseSignOut(tokens.accessToken);
    } catch (err) {
      console.error("Failed to revoke Supabase session", err);
    }
  }

  await clearSupabaseCookies();

  const path = localizedHref(locale, "/");
  const res = NextResponse.redirect(new URL(path, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
