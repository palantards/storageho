import "server-only";

import { eq, sql } from "drizzle-orm";
import { cache } from "react";

import { getOrCreateStripeCustomerId } from "@/lib/billing/customer";
import { ensureUserRecord } from "@/lib/user-sync";
import { dbAdmin as db, schema } from "@/server/db";
import {
  createSupabaseServerClient,
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
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.getUser();
    if (error) {
      console.error("Unable to fetch Supabase user", error);
      return null;
    }

    const user = data.user;
    if (!user.email) return null;

    const metadata = user.user_metadata;
    const metadataCompany =
      typeof metadata?.company === "string" ? metadata.company : undefined;
    const metadataStripeCustomerId =
      typeof metadata?.stripe_customer_id === "string"
        ? metadata.stripe_customer_id
        : undefined;

    const fallbackName = deriveUserName({ email: user.email, metadata });

    const existingUser = await db.query.users.findFirst({
      where: eq(schema.users.supabaseUserId, user.id),
    });

    let dbUser = existingUser;

    if (!dbUser) {
      dbUser = await ensureUserRecord(
        {
          id: user.id,
          email: user.email,
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

      if (dbUser.email !== user.email) {
        userUpdate.email = user.email;
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

    if (process.env.STRIPE_SECRET_KEY && !dbUser.stripeCustomerId) {
      try {
        const newCustomerId = await getOrCreateStripeCustomerId({
          supabaseUserId: user.id,
          email: user.email,
          name: (metadata?.name as string | undefined) ?? undefined,
          company: metadataCompany,
        });
        dbUser.stripeCustomerId = newCustomerId;
      } catch (error) {
        console.error(
          "Failed to create Stripe customer for user",
          user.id,
          error,
        );
      }
    }

    // Keep profiles table in sync for backward compatibility
    const existingProfile = await db.query.profiles.findFirst({
      where: eq(schema.profiles.userId, user.id),
      columns: { userId: true, displayName: true },
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

    const resolvedName = (
      dbUser.displayName ??
      dbUser.name ??
      existingProfile?.displayName ??
      fallbackName
    ).trim();

    return {
      user: {
        id: user.id,
        dbUserId: dbUser?.id,
        email: dbUser?.email ?? user.email,
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
    await signInWithPassword({ email, password, rememberMe });
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

