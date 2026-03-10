import "server-only";

import { eq, sql } from "drizzle-orm";
import { cookies } from "next/headers";
import { cache } from "react";

import { claimPendingInvitesForUser } from "@/lib/inventory/service";
import { ensureUserRecord } from "@/lib/user-sync";
import { dbAdmin as db, schema } from "@/server/db";
import { withRlsUserContext } from "@/server/db/tenant";
import {
  createSupabaseServerClient,
  hasSupabaseSessionCookie,
  signInWithPassword,
  signUpWithSupabase,
  supabaseSignOut,
  type SupabaseUser,
} from "./supabase";

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


export const getSession = cache(async (): Promise<Session | null> => {
  try {
    const cookieStore = await cookies();
    if (!hasSupabaseSessionCookie(cookieStore)) {
      return null;
    }

    const supabase = await createSupabaseServerClient({
      cookieStore,
    });
    const { data: claimsData, error } = await supabase.auth.getClaims();
    if (error || !claimsData?.claims?.sub) {
      console.error("Unable to fetch Supabase claims", error);
      return null;
    }

    const claims = claimsData.claims;
    const userId = claims.sub;
    const email = typeof claims.email === "string" ? claims.email : null;
    if (!email) return null;

    const metadata =
      claims.user_metadata && typeof claims.user_metadata === "object"
        ? (claims.user_metadata as Record<string, unknown>)
        : undefined;
    const metadataCompany =
      typeof metadata?.company === "string" ? metadata.company : undefined;
    const metadataStripeCustomerId =
      typeof metadata?.stripe_customer_id === "string"
        ? metadata.stripe_customer_id
        : undefined;

    const fallbackName = deriveUserName({ email, metadata });

    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.supabaseUserId, userId),
    });

    let dbUser = existingUser;

    if (!dbUser) {
      dbUser = await ensureUserRecord(
        {
          id: userId,
          email,
          stripeCustomerId: metadataStripeCustomerId,
          isAdmin: existingUser?.isAdmin,
        },
        // Seed profile fields from metadata only when not already stored
        { displayName: fallbackName, company: metadataCompany ?? undefined },
      );
    } else {
      const userUpdate: {
        email?: string;
        stripeCustomerId?: string;
        displayName?: string;
        company?: string;
        updatedAt?: Date;
      } = {};

      if (dbUser.email !== email) {
        userUpdate.email = email;
      }

      if (!dbUser.stripeCustomerId && metadataStripeCustomerId) {
        userUpdate.stripeCustomerId = metadataStripeCustomerId;
      }

      if (!dbUser.displayName && !dbUser.name && fallbackName) {
        userUpdate.displayName = fallbackName;
      }

      if (!dbUser.company && metadataCompany) {
        userUpdate.company = metadataCompany;
      }

      if (Object.keys(userUpdate).length > 0) {
        userUpdate.updatedAt = new Date();
        const [updatedUser] = await db
          .update(schema.users)
          .set(userUpdate)
          .where(eq(schema.users.id, dbUser.id))
          .returning();

        dbUser = updatedUser ?? dbUser;
      }
    }

    if (dbUser.isBlocked) {
      console.log(`Blocked user ${dbUser.email} attempted login.`);
      return null; // no session returned
    }

    let profileDisplayName: string | null = null;

    if (!dbUser.displayName && !dbUser.name) {
      const existingProfile = await db.query.profiles.findFirst({
        where: eq(schema.profiles.userId, userId),
        columns: { userId: true, displayName: true },
      });

      profileDisplayName = existingProfile?.displayName ?? null;

      if (!existingProfile) {
        await db.execute(sql`
          insert into public.profiles (user_id, display_name)
          values (${userId}, ${fallbackName})
          on conflict (user_id) do update
          set
            display_name = coalesce(public.profiles.display_name, excluded.display_name),
            updated_at = now()
        `);
      }
    }

    const resolvedName = (
      dbUser.displayName ??
      dbUser.name ??
      profileDisplayName ??
      fallbackName
    ).trim();

    return {
      user: {
        id: userId,
        dbUserId: dbUser?.id,
        email: dbUser?.email ?? email,
        name: resolvedName,
        company: dbUser.company ?? metadataCompany,
        stripeCustomerId: dbUser?.stripeCustomerId ?? metadataStripeCustomerId,
        isAdmin: !!dbUser?.isAdmin,
      },
    };
  } catch (error) {
    console.error("Unable to fetch Supabase user", error);
    return null;
  }
});

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

async function claimHouseholdInvitesForAuthUser(input: {
  userId: string;
  email: string;
}) {
  try {
    await withRlsUserContext(input.userId, async () => {
      await claimPendingInvitesForUser(input);
    });
  } catch (error) {
    console.error("Failed to claim pending invites", error);
  }
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
    const session = await signInWithPassword({ email, password, rememberMe });
    await claimHouseholdInvitesForAuthUser({
      userId: session.user.id,
      email: session.user.email ?? email,
    });
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
      rememberMe: true,
    });

    if (result.user?.id) {
      await claimHouseholdInvitesForAuthUser({
        userId: result.user.id,
        email: result.user.email ?? email,
      });
    }

    return { user: result.user ?? null };
  } catch (error) {
    console.error("Registration failed", error);
    return { user: null, errorKey: mapSupabaseError(error) };
  }
}

export async function signOutSupabase() {
  try {
    await supabaseSignOut();
  } catch (error) {
    console.error("Failed to revoke Supabase session", error);
  }
}

