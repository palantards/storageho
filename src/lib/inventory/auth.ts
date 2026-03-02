import "server-only";

import { redirect } from "next/navigation";

import { getSession } from "@/lib/auth";

export async function requireSessionUser(locale?: string) {
  const session = await getSession();
  if (!session?.user) {
    if (locale) {
      redirect(`/${locale}/login`);
    }
    throw new Error("Unauthorized");
  }

  return session.user;
}
