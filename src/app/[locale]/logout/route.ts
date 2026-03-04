import { NextRequest, NextResponse } from "next/server";
import { localizedHref } from "@/i18n/routing";
import { clearSupabaseCookies, getStoredTokens, supabaseSignOut } from "@/lib/supabase";
import { assertSameOriginForCookieAuth } from "@/lib/http/origin";

export async function POST(
  req: NextRequest,
  { params }: { params: { locale: string } },
) {
  const originCheck = assertSameOriginForCookieAuth(req);
  if (originCheck) return originCheck;

  const locale = params?.locale === "sv" ? "sv" : "en";
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
