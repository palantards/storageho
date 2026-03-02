import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { defaultLocale, locales } from "@/i18n/config";

const PUBLIC_FILE = /\.[^/]+$/;
const ACCESS_COOKIE = "supabase_access_token";
const REFRESH_COOKIE = "supabase_refresh_token";
const EXPIRES_COOKIE = "supabase_expires_at";
const REFRESH_LEEWAY_SECONDS = 60;

type SupabaseRefreshResponse = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  return { url, anonKey };
}

function applySessionCookies(
  response: NextResponse,
  session: SupabaseRefreshResponse,
) {
  const expiresAt =
    session.expires_at ??
    Math.floor(Date.now() / 1000) + Math.max(session.expires_in, 1);
  const isSecure =
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://");

  response.cookies.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: Math.max(session.expires_in, 1),
  });
  response.cookies.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 30,
  });
  response.cookies.set(EXPIRES_COOKIE, String(expiresAt), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: isSecure,
    maxAge: 60 * 60 * 24 * 30,
  });
}

function clearSessionCookies(response: NextResponse) {
  response.cookies.delete(ACCESS_COOKIE);
  response.cookies.delete(REFRESH_COOKIE);
  response.cookies.delete(EXPIRES_COOKIE);
}

async function refreshSessionIfNeeded(
  request: NextRequest,
  response: NextResponse,
) {
  const refreshToken = request.cookies.get(REFRESH_COOKIE)?.value;
  const expiresAtRaw = request.cookies.get(EXPIRES_COOKIE)?.value;
  const expiresAt = expiresAtRaw ? Number(expiresAtRaw) : NaN;
  if (!refreshToken || !Number.isFinite(expiresAt)) {
    return;
  }

  const now = Math.floor(Date.now() / 1000);
  if (expiresAt > now + REFRESH_LEEWAY_SECONDS) {
    return;
  }

  const { url, anonKey } = getSupabaseEnv();
  if (!url || !anonKey) {
    return;
  }

  try {
    const refreshResponse = await fetch(
      `${url}/auth/v1/token?grant_type=refresh_token`,
      {
        method: "POST",
        headers: {
          apikey: anonKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ refresh_token: refreshToken }),
        cache: "no-store",
      },
    );

    if (!refreshResponse.ok) {
      clearSessionCookies(response);
      return;
    }

    const payload =
      (await refreshResponse.json()) as Partial<SupabaseRefreshResponse>;
    if (
      !payload.access_token ||
      !payload.refresh_token ||
      !payload.expires_in
    ) {
      clearSessionCookies(response);
      return;
    }

    applySessionCookies(response, payload as SupabaseRefreshResponse);
  } catch {
    // Keep existing cookies on transient network errors; next request can retry.
  }
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Skip next internals and public files
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api") ||
    pathname.startsWith("/favicon") ||
    PUBLIC_FILE.test(pathname)
  ) {
    return NextResponse.next();
  }

  const hasLocalePrefix = locales.some(
    (loc) => pathname === `/${loc}` || pathname.startsWith(`/${loc}/`)
  );

  const response = hasLocalePrefix
    ? NextResponse.next()
    : NextResponse.redirect(
        (() => {
          const url = request.nextUrl.clone();
          url.pathname = `/${defaultLocale}${pathname}`;
          return url;
        })(),
      );

  await refreshSessionIfNeeded(request, response);

  return response;
}

export const config = {
  matcher: ["/((?!_next).*)"],
};
