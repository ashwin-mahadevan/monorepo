import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  return NextResponse.redirect(baseUrl, { status: 303 });
}
