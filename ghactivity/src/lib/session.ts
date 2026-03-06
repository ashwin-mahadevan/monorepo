import { getIronSession, type IronSession } from "iron-session";
import { cookies } from "next/headers";

interface SessionData {
  userId: number;
  githubUsername: string;
  avatarUrl: string;
  accessToken: string;
}

export type Session = IronSession<SessionData>;

export async function getSession(): Promise<Session> {
  const cookieStore = await cookies();
  return getIronSession<SessionData>(cookieStore, {
    password: process.env.SESSION_SECRET!,
    cookieName: "ghactivity_session",
    cookieOptions: {
      secure: process.env.NODE_ENV === "production",
      httpOnly: true,
      sameSite: "lax",
    },
  });
}
