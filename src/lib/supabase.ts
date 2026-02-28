import { cookies } from "next/headers";

const ACCESS_COOKIE = "supabase_access_token";
const REFRESH_COOKIE = "supabase_refresh_token";
const EXPIRES_COOKIE = "supabase_expires_at";

export type SupabaseUser = {
  id: string;
  email?: string;
  user_metadata?: Record<string, unknown> & {
    name?: string;
    full_name?: string;
    company?: string;
    stripe_customer_id?: string;
  };
};

export type SupabaseSession = {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  expires_at?: number;
  token_type: string;
  user?: SupabaseUser;
};

function getSupabaseEnv() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !anonKey) {
    throw new Error("Supabase environment variables are missing");
  }
  return { url, anonKey };
}

async function supabaseRequest<T>(
  path: string,
  init: RequestInit & { accessToken?: string } = {},
): Promise<T> {
  const { url, anonKey } = getSupabaseEnv();
  const headers: HeadersInit = {
    apikey: anonKey,
    "Content-Type": "application/json",
    ...(init.headers || {}),
  };
  if (init.accessToken) headers.Authorization = `Bearer ${init.accessToken}`;

  const response = await fetch(`${url}${path}`, {
    ...init,
    headers,
    cache: "no-store",
  });

  const contentType = response.headers.get("content-type");
  const payload =
    contentType && contentType.includes("application/json")
      ? await response.json()
      : await response.text();

  if (!response.ok) {
    const message =
      typeof payload === "string"
        ? payload
        : (payload &&
            (payload.error_description || payload.error || payload.message)) ||
          "Supabase request failed";
    throw new Error(message);
  }

  return payload as T;
}

export async function signUpWithSupabase({
  email,
  password,
  data,
}: {
  email: string;
  password: string;
  data?: Record<string, unknown>;
}): Promise<{ user?: SupabaseUser; session?: SupabaseSession }> {
  return supabaseRequest<{ user?: SupabaseUser; session?: SupabaseSession }>(
    "/auth/v1/signup",
    {
      method: "POST",
      body: JSON.stringify({ email, password, data }),
    },
  );
}

export async function signInWithPassword({
  email,
  password,
}: {
  email: string;
  password: string;
}): Promise<SupabaseSession> {
  return supabaseRequest<SupabaseSession>(
    "/auth/v1/token?grant_type=password",
    {
      method: "POST",
      body: JSON.stringify({ email, password }),
    },
  );
}

export async function refreshSupabaseSession(
  refreshToken: string,
): Promise<SupabaseSession> {
  return supabaseRequest<SupabaseSession>(
    "/auth/v1/token?grant_type=refresh_token",
    {
      method: "POST",
      body: JSON.stringify({ refresh_token: refreshToken }),
    },
  );
}

export async function fetchSupabaseUser(
  accessToken: string,
): Promise<SupabaseUser> {
  return supabaseRequest<SupabaseUser>("/auth/v1/user", {
    method: "GET",
    accessToken,
  });
}

export async function supabaseSignOut(accessToken: string) {
  await supabaseRequest("/auth/v1/logout", {
    method: "POST",
    accessToken,
  });
}

export function calculateExpiryEpoch(expiresIn: number): number {
  return Math.floor(Date.now() / 1000) + expiresIn;
}

export async function persistSession(session: SupabaseSession) {
  const expiry = session.expires_at || calculateExpiryEpoch(session.expires_in);
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_COOKIE, session.access_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: session.expires_in,
  });
  cookieStore.set(REFRESH_COOKIE, session.refresh_token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  cookieStore.set(EXPIRES_COOKIE, String(expiry), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSupabaseCookies() {
  const store = await cookies();
  store.delete(ACCESS_COOKIE);
  store.delete(REFRESH_COOKIE);
  store.delete(EXPIRES_COOKIE);
}

export async function getStoredTokens() {
  const store = await cookies();
  const accessToken = store.get(ACCESS_COOKIE)?.value;
  const refreshToken = store.get(REFRESH_COOKIE)?.value;
  const expiresRaw = store.get(EXPIRES_COOKIE)?.value;
  const expiresAt = expiresRaw ? Number(expiresRaw) : undefined;

  if (!accessToken || !refreshToken || !expiresAt) return null;
  return { accessToken, refreshToken, expiresAt };
}

export async function sendSupabasePasswordReset({
  email,
  redirectTo,
}: {
  email: string;
  redirectTo: string;
}) {
  return supabaseRequest("/auth/v1/recover", {
    method: "POST",
    body: JSON.stringify({ email, redirect_to: redirectTo }),
  });
}

export async function updateSupabasePassword({
  accessToken,
  password,
}: {
  accessToken: string;
  password: string;
}) {
  return supabaseRequest("/auth/v1/user", {
    method: "PUT",
    accessToken,
    body: JSON.stringify({ password }),
  });
}
