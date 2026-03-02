import "server-only";

import { eq, sql } from "drizzle-orm";

import { ensureUserRecord } from "@/lib/user-sync";
import { db, schema } from "@/server/db";
import {
  fetchSupabaseUser,
  getStoredTokens,
  persistSession,
  refreshSupabaseSession,
  signInWithPassword,
  signUpWithSupabase,
  supabaseSignOut,
  SupabaseUser,
} from "./supabase";
import { ensureStripeCustomer } from "./stripe";

export interface SessionUser {
  id: string;
  dbUserId?: string;
  email: string;
  name?: string;
  company?: string;
  stripeCustomerId?: string;
  isAdmin?: boolean;
}

export type Session = {
  user: SessionUser;
};

function deriveUserName({
  email,
  metadata,
}: {
  email: string;
  metadata?: Record<string, unknown>;
}) {
  const maybeName =
    typeof metadata?.name === "string"
      ? metadata.name
      : typeof metadata?.full_name === "string"
        ? metadata.full_name
        : null;
  return maybeName && maybeName.trim()
    ? maybeName
    : email.split("@")[0] || "User";
}

function getPgCode(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const withCause = error as { cause?: { code?: string }; code?: string };
  return withCause.cause?.code ?? withCause.code;
}

function isMissingRelation(error: unknown): boolean {
  return getPgCode(error) === "42P01";
}

function isCookieMutationError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return message.includes(
    "Cookies can only be modified in a Server Action or Route Handler",
  );
}

const globalForLegacyUsers = globalThis as unknown as {
  __legacyUsersTableAvailable?: boolean;
};

export async function getSession(): Promise<Session | null> {
  const tokens = await getStoredTokens();
  if (!tokens) return null;

  const now = Math.floor(Date.now() / 1000);
  let accessToken = tokens.accessToken;
  let expiresAt = tokens.expiresAt;

  if (expiresAt <= now && tokens.refreshToken) {
    try {
      const refreshed = await refreshSupabaseSession(tokens.refreshToken);
      try {
        await persistSession(refreshed);
      } catch (error) {
        if (!isCookieMutationError(error)) {
          throw error;
        }
      }
      accessToken = refreshed.access_token;
      expiresAt = refreshed.expires_at || expiresAt;
    } catch (error) {
      console.error("Failed to refresh Supabase session", error);
      return null;
    }
  }

  try {
    const user = await fetchSupabaseUser(accessToken);
    if (!user.email) return null;

    const metadata = user.user_metadata;
    const metadataCompany =
      typeof metadata?.company === "string" ? metadata.company : undefined;
    const metadataStripeCustomerId =
      typeof metadata?.stripe_customer_id === "string"
        ? metadata.stripe_customer_id
        : undefined;

    let dbUser: Awaited<ReturnType<typeof ensureUserRecord>> | null = null;
    const legacyUsersAvailable =
      globalForLegacyUsers.__legacyUsersTableAvailable ?? true;

    if (legacyUsersAvailable) {
      try {
        const existingUser = await db.query.users.findFirst({
          where: eq(schema.users.supabaseUserId, user.id),
        });

        dbUser = await ensureUserRecord({
          id: user.id,
          email: user.email,
          stripeCustomerId:
            existingUser?.stripeCustomerId ?? metadataStripeCustomerId,
          isAdmin: existingUser?.isAdmin,
        });

        if (dbUser.isBlocked) {
          console.log(`Blocked user ${dbUser.email} attempted login.`);
          return null; // no session returned
        }

        if (process.env.STRIPE_SECRET_KEY && !dbUser.stripeCustomerId) {
          try {
            const newCustomerId = await ensureStripeCustomer({
              email: user.email,
              name: (metadata?.name as string | undefined) ?? undefined,
              company: metadataCompany,
            });
            await db
              .update(schema.users)
              .set({ stripeCustomerId: newCustomerId })
              .where(eq(schema.users.id, dbUser.id));
            dbUser.stripeCustomerId = newCustomerId;
          } catch (error) {
            console.error(
              "Failed to create Stripe customer for user",
              user.id,
              error,
            );
          }
        }
      } catch (error) {
        if (isMissingRelation(error)) {
          // Supabase-first installs may not have the legacy `users` table.
          globalForLegacyUsers.__legacyUsersTableAvailable = false;
          dbUser = null;
        } else {
          throw error;
        }
      }
    }

    const fallbackName = deriveUserName({ email: user.email, metadata });
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, user.id),
      columns: {
        userId: true,
        displayName: true,
      },
    });

    if (!existingProfile) {
      await db.execute(sql`
        insert into public.profiles (user_id, display_name)
        values (${user.id}, ${fallbackName})
        on conflict (user_id) do update
        set
          display_name = coalesce(public.profiles.display_name, excluded.display_name),
          updated_at = now()
      `);
    }

    return {
      user: {
        id: user.id,
        dbUserId: dbUser?.id,
        email: dbUser?.email ?? user.email,
        name: (existingProfile?.displayName || fallbackName).trim(),
        company: metadataCompany,
        stripeCustomerId: dbUser?.stripeCustomerId ?? metadataStripeCustomerId,
        isAdmin: !!dbUser?.isAdmin,
      },
    };
  } catch (error) {
    console.error("Unable to fetch Supabase user", error);
    return null;
  }
}

function mapSupabaseError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error ?? "");
  const lower = message.toLowerCase();
  if (lower.includes("invalid login credentials")) return "invalidCredentials";
  if (lower.includes("user already registered")) return "userExists";
  if (lower.includes("password should be at least")) return "weakPassword";
  if (
    lower.includes("email not confirmed") ||
    lower.includes("confirm your email")
  )
    return "emailNotConfirmed";
  return "generic";
}

export async function loginWithSupabase({
  email,
  password,
  rememberMe = true,
}: {
  email: string;
  password: string;
  rememberMe?: boolean;
}): Promise<{ ok: boolean; errorKey?: string }> {
  try {
    const session = await signInWithPassword({ email, password });
    await persistSession(session, { rememberMe });
    return { ok: true };
  } catch (error) {
    console.error("Login failed", error);
    return { ok: false, errorKey: mapSupabaseError(error) };
  }
}

export async function registerWithSupabase({
  email,
  password,
  metadata,
}: {
  email: string;
  password: string;
  metadata?: Record<string, unknown>;
}): Promise<{ user: SupabaseUser | null; errorKey?: string }> {
  try {
    const result = await signUpWithSupabase({
      email,
      password,
      data: { ...metadata, email_confirm: false },
    });

    if (result.session) {
      await persistSession(result.session);
    }

    return { user: result.user ?? null };
  } catch (error) {
    console.error("Registration failed", error);
    return { user: null, errorKey: mapSupabaseError(error) };
  }
}

export async function signOutSupabase(accessToken?: string) {
  if (accessToken) {
    try {
      await supabaseSignOut(accessToken);
    } catch (error) {
      console.error("Failed to revoke Supabase session", error);
    }
  }
}

