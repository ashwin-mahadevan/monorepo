import { NextResponse } from "next/server";
import { destroySession } from "@/lib/session";

export async function POST() {
  await destroySession();

  const baseUrl = process.env.NEXT_PUBLIC_URL;
  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_URL environment variable is not set");
  }
  return NextResponse.redirect(baseUrl, { status: 303 });
}
