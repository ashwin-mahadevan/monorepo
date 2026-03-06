import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";

export async function POST() {
  const session = await getSession();
  session.destroy();

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  return NextResponse.redirect(baseUrl, { status: 303 });
}
