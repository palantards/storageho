"use server";

import { z } from "zod";

import { updateSupabasePassword } from "@/lib/supabase";

const resetSchema = z.object({
  accessToken: z.string().min(1),
  password: z.string().min(8),
});

export async function resetPasswordAction(
  input: unknown,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const parsed = resetSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: "Invalid reset payload" };
  }

  try {
    await updateSupabasePassword(parsed.data);
    return { ok: true };
  } catch (error) {
    console.error("Password reset failed", error);
    return { ok: false, error: "Reset failed" };
  }
}
