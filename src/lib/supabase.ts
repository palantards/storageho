import "server-only";

import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { Session as SupabaseSession, User as SupabaseUser } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";

import { createSupabaseAnonClient } from "@/lib/supabaseServer";

export type { SupabaseSession, SupabaseUser };

const LEGACY_AUTH_COOKIES = [
  "supabase_access_token",
  "supabase_refresh_token",
  "supabase_expires_at",
] as const;
const REMEMBER_ME_COOKIE = "supabase_remember_me";
const AUTH_COOKIE_MAX_AGE = 60 * 60 * 24 * 30;

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are missing");
  }

  return { url, anonKey };
}

function isSecureCookie() {
  return (
    process.env.NODE_ENV === "production" ||
    process.env.NEXT_PUBLIC_SITE_URL?.startsWith("https://") ||
    process.env.NEXT_PUBLIC_APP_URL?.startsWith("https://") ||
    process.env.APP_URL?.startsWith("https://")
  );
}

function rememberMeToCookieOptions(rememberMe: boolean): CookieOptions {
  return {
    path: "/",
    sameSite: "lax",
    secure: isSecureCookie(),
    httpOnly: true,
    ...(rememberMe ? { maxAge: AUTH_COOKIE_MAX_AGE } : {}),
  };
}

function normalizeCookieOptions(options: CookieOptions | undefined): CookieOptions {
  return {
    path: options?.path ?? "/",
    sameSite: options?.sameSite ?? "lax",
    secure: options?.secure ?? isSecureCookie(),
    httpOnly: options?.httpOnly ?? true,
    ...(typeof options?.maxAge === "number" ? { maxAge: options.maxAge } : {}),
    ...(typeof options?.expires !== "undefined" ? { expires: options.expires } : {}),
    ...(typeof options?.domain === "string" ? { domain: options.domain } : {}),
    ...(typeof options?.priority !== "undefined" ? { priority: options.priority } : {}),
    ...(typeof options?.partitioned !== "undefined"
      ? { partitioned: options.partitioned }
      : {}),
  };
}

function readRememberMeValue(rawValue: string | undefined) {
  return rawValue !== "0";
}

async function resolveRememberMePreference(explicit?: boolean) {
  if (typeof explicit === "boolean") {
    return explicit;
  }

  const store = await cookies();
  return readRememberMeValue(store.get(REMEMBER_ME_COOKIE)?.value);
}

async function setRememberMePreference(rememberMe: boolean) {
  const store = await cookies();
  store.set(
    REMEMBER_ME_COOKIE,
    rememberMe ? "1" : "0",
    rememberMeToCookieOptions(rememberMe),
  );
}

export async function clearLegacySupabaseCookies() {
  const store = await cookies();
  for (const cookieName of LEGACY_AUTH_COOKIES) {
    store.delete(cookieName);
  }
}

async function clearRememberMePreference() {
  const store = await cookies();
  store.delete(REMEMBER_ME_COOKIE);
}

export async function createSupabaseServerClient(options?: {
  rememberMe?: boolean;
}) {
  const store = await cookies();
  const rememberMe = await resolveRememberMePreference(options?.rememberMe);
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookieOptions: rememberMeToCookieOptions(rememberMe),
    cookies: {
      getAll() {
        return store.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        try {
          for (const cookie of cookiesToSet) {
            store.set(
              cookie.name,
              cookie.value,
              normalizeCookieOptions(cookie.options),
            );
          }
        } catch {
          // Server components cannot mutate cookies. Middleware handles refreshes.
        }
      },
    },
  });
}

export function createSupabaseMiddlewareClient(
  request: NextRequest,
  response: NextResponse,
) {
  const rememberMe = readRememberMeValue(
    request.cookies.get(REMEMBER_ME_COOKIE)?.value,
  );
  const { url, anonKey } = getSupabaseEnv();

  return createServerClient(url, anonKey, {
    cookieOptions: rememberMeToCookieOptions(rememberMe),
    cookies: {
      getAll() {
        return request.cookies.getAll().map(({ name, value }) => ({ name, value }));
      },
      setAll(cookiesToSet) {
        for (const cookie of cookiesToSet) {
          request.cookies.set(cookie.name, cookie.value);
          response.cookies.set(
            cookie.name,
            cookie.value,
            normalizeCookieOptions(cookie.options),
          );
        }
      },
    },
  });
}

export async function signUpWithSupabase({
  email,
  password,
  data,
  rememberMe = true,
}: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
  rememberMe?: boolean;
}): Promise<{ user?: SupabaseUser; session?: SupabaseSession | null }> {
  const supabase = await createSupabaseServerClient({ rememberMe });
  const { data: result, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data },
  });

  if (error) {
    throw error;
  }

  await clearLegacySupabaseCookies();
  await setRememberMePreference(rememberMe);

  return { user: result.user ?? undefined, session: result.session };
}

export async function signInWithPassword({
  email,
  password,
  rememberMe = true,
}: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<SupabaseSession> {
  const supabase = await createSupabaseServerClient({ rememberMe });
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error || !data.session) {
    throw error ?? new Error("Supabase sign-in returned no session");
  }

  await clearLegacySupabaseCookies();
  await setRememberMePreference(rememberMe);

  return data.session;
}

export async function supabaseSignOut() {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();
  if (error) {
    throw error;
  }

  await clearLegacySupabaseCookies();
  await clearRememberMePreference();
}

export async function sendSupabasePasswordReset({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  const supabase = createSupabaseAnonClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });

  if (error) {
    throw error;
  }
}

export async function updateSupabasePassword({
  accessToken,
  password,
}: {
  accessToken: string;
  password: string;
}) {
  const { url, anonKey } = getSupabaseEnv();
  const response = await fetch(`${url}/auth/v1/user`, {
    method: "PUT",
    headers: {
      apikey: anonKey,
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ password }),
    cache: "no-store",
  });

  if (!response.ok) {
    const payload = await response.text();
    throw new Error(payload || "Supabase password update failed");
  }
}
