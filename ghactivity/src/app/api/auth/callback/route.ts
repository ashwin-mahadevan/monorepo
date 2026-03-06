import { NextResponse, type NextRequest } from "next/server";
import { eq } from "drizzle-orm";
import { db } from "@/lib/db";
import { users } from "@/db/schema";
import { getSession } from "@/lib/session";
import { getUser } from "@/lib/github";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (!code) {
    return NextResponse.json({ error: "Missing code" }, { status: 400 });
  }

  // Exchange code for access token
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: process.env.GITHUB_CLIENT_ID!,
      client_secret: process.env.GITHUB_CLIENT_SECRET!,
      code,
    }),
  });

  const tokenData = await tokenRes.json();
  if (tokenData.error) {
    return NextResponse.json(
      { error: tokenData.error_description },
      { status: 400 },
    );
  }

  const accessToken: string = tokenData.access_token;

  // Fetch GitHub user
  const ghUser = await getUser(accessToken);

  // Upsert user in DB
  const existing = await db.query.users.findFirst({
    where: eq(users.githubId, ghUser.id),
  });

  let userId: number;
  if (existing) {
    await db
      .update(users)
      .set({
        username: ghUser.login,
        avatarUrl: ghUser.avatar_url,
        accessToken,
      })
      .where(eq(users.githubId, ghUser.id));
    userId = existing.id;
  } else {
    const result = await db.insert(users).values({
      githubId: ghUser.id,
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      accessToken,
    });
    userId = Number(result.lastInsertRowid);
  }

  // Create session
  const session = await getSession();
  session.userId = userId;
  session.githubUsername = ghUser.login;
  session.avatarUrl = ghUser.avatar_url;
  session.accessToken = accessToken;
  await session.save();

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  return NextResponse.redirect(baseUrl);
}
