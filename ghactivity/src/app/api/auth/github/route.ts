import { NextResponse } from "next/server";

export function GET() {
  const clientId = process.env.GITHUB_CLIENT_ID!;
  const redirectUri = `${process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000"}/api/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
  });

  return NextResponse.redirect(
    `https://github.com/login/oauth/authorize?${params}`,
  );
}
