import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";
import {
  createSupabaseMiddlewareClient,
  hasSupabaseSessionCookie,
} from "@/lib/supabase";

const PUBLIC_FILE = /\.[^/]+$/;
const CSRF_EXEMPT_API_PATHS = ["/api/stripe/webhook"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isApi = pathname.startsWith("/api");
  const unsafeMethod = !["GET", "HEAD", "OPTIONS"].includes(request.method);

  // CSRF / same-origin protection for cookie-authenticated API mutations
  if (
    isApi &&
    unsafeMethod &&
    hasSupabaseSessionCookie(request.cookies) &&
    !CSRF_EXEMPT_API_PATHS.some((p) => pathname.startsWith(p))
  ) {
    // Strong browser signal. If present and same-site/origin, allow.
    const secFetchSite = request.headers.get("sec-fetch-site");
    if (secFetchSite !== "same-origin" && secFetchSite !== "same-site") {
      const allowedOriginsRaw = [
        request.nextUrl.origin,
        process.env.NEXT_PUBLIC_SITE_URL,
        process.env.NEXT_PUBLIC_APP_URL,
      ].filter(Boolean) as string[];

      // Normalize env values to origins (strip paths)
      const allowedOrigins = allowedOriginsRaw.map((o) => {
        try {
          return new URL(o).origin;
        } catch {
          // If it's not a valid URL, keep as-is (better than crashing)
          return o;
        }
      });

      const originHeader = request.headers.get("origin");
      const refererHeader = request.headers.get("referer");

      let candidateOrigin: string | null = null;

      if (originHeader) {
        try {
          candidateOrigin = new URL(originHeader).origin;
        } catch {
          candidateOrigin = null;
        }
      } else if (refererHeader) {
        try {
          candidateOrigin = new URL(refererHeader).origin;
        } catch {
          candidateOrigin = null;
        }
      }

      if (!candidateOrigin || !allowedOrigins.includes(candidateOrigin)) {
        return NextResponse.json(
          { error: "CSRF check failed" },
          { status: 403 },
        );
      }
    }
  }

  // Skip next internals and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocalePrefix = locales.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`),
  );

  // API routes: never locale-redirect
  const response = isApi
    ? NextResponse.next()
    : hasLocalePrefix
      ? NextResponse.next()
      : NextResponse.redirect(
          (() => {
            const url = request.nextUrl.clone();
            url.pathname = `/${defaultLocale}${pathname}`;
            return url;
          })(),
        );

  const hasSessionCookie = hasSupabaseSessionCookie(request.cookies);
  if (hasSessionCookie) {
    try {
      const supabase = createSupabaseMiddlewareClient(request, response);
      await supabase.auth.getSession();
    } catch (error) {
      console.error("Failed to refresh Supabase SSR session", error);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/api/:path*",
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\..*).*)",
  ],
};
