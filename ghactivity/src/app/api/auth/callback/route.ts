import { NextResponse, type NextRequest } from "next/server";
import { redis } from "@/lib/redis";
import { createSession } from "@/lib/session";
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

  // Upsert user in Redis
  const githubIndexKey = `gha:github:${ghUser.id}`;
  let userId: number;

  const existingUserId = await redis.get<string>(githubIndexKey);

  if (existingUserId) {
    // Update mutable fields on existing user
    userId = Number(existingUserId);
    await redis.hset(`gha:user:${userId}`, {
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      accessToken,
    });
  } else {
    // Insert new user: allocate ID, write hash, write index
    userId = await redis.incr("gha:user:seq");
    await redis.hset(`gha:user:${userId}`, {
      githubId: String(ghUser.id),
      username: ghUser.login,
      avatarUrl: ghUser.avatar_url,
      accessToken,
      createdAt: new Date().toISOString(),
    });
    await redis.set(githubIndexKey, String(userId));
  }

  await createSession(userId);

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  return NextResponse.redirect(`${baseUrl}/${ghUser.login}`);
}
