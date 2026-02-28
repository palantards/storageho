import { NextRequest, NextResponse } from "next/server";

import { updateSupabasePassword } from "@/lib/supabase";

export async function POST(req: NextRequest) {
  try {
    const { accessToken, password } = (await req.json()) as { accessToken?: string; password?: string };
    if (!accessToken || !password) {
      return NextResponse.json({ error: "Missing token or password" }, { status: 400 });
    }

    await updateSupabasePassword({ accessToken, password });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Password reset failed", error);
    return NextResponse.json({ error: "Password reset failed" }, { status: 500 });
  }
}
