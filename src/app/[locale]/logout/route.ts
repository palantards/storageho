import { NextRequest, NextResponse } from "next/server";
import { localizedHref } from "@/i18n/routing";
import { assertSameOriginForCookieAuth } from "@/lib/http/origin";
import { supabaseSignOut } from "@/lib/supabase";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ locale: string }> },
) {
  const csrfError = assertSameOriginForCookieAuth(req);
  if (csrfError) {
    return csrfError;
  }

  const { locale: rawLocale } = await params;
  const locale = rawLocale === "sv" ? "sv" : "en";
  try {
    await supabaseSignOut({ scope: "local" });
  } catch (err) {
    console.error("Failed to revoke Supabase session", err);
  }

  const path = localizedHref(locale, "/");
  const res = NextResponse.redirect(new URL(path, req.url), 302);
  res.headers.set("Cache-Control", "no-store");
  return res;
}
