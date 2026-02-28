import { NextResponse } from "next/server";
import { db, schema } from "@/server/db";

export async function POST(req: Request) {
  let payload: { email: string; subject: string; message: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  // Basic validation
  const { email, subject, message } = payload;
  if (!email || !subject || !message) {
    return NextResponse.json(
      { error: "Email, subject and message are required." },
      { status: 400 },
    );
  }

  try {
    await db
      .insert(schema.supportRequests)
      .values({ email, subject, message })
      .execute();

    return NextResponse.json({ ok: true }, { status: 200 });
  } catch (e: any) {
    console.error(e);
    return NextResponse.json(
      { error: "Could not create support request." },
      { status: 500 },
    );
  }
}
