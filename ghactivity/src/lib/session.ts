import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { redis } from "@/lib/redis";

const COOKIE_NAME = "ghactivity_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days

export async function getSessionUser() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const userId = await redis.get<string>(`gha:session:${token}`);
  if (!userId) return null;

  const user = await redis.hgetall<{
    githubId: string;
    username: string;
    avatarUrl: string;
    accessToken: string;
    createdAt: string;
  }>(`gha:user:${userId}`);
  if (!user) return null;

  return {
    userId: Number(userId),
    username: user.username,
    avatarUrl: user.avatarUrl,
    accessToken: user.accessToken,
  };
}

export async function createSession(userId: number) {
  const token = randomBytes(32).toString("hex");
  await redis.set(`gha:session:${token}`, String(userId), {
    ex: SESSION_TTL_SECONDS,
  });

  const cookieStore = await cookies();
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (token) {
    await redis.del(`gha:session:${token}`);
  }
  cookieStore.delete(COOKIE_NAME);
}
