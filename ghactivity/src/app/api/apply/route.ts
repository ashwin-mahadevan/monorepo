import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { getSession } from "@/lib/session";
import { getDb } from "@/lib/db";
import { users } from "@/db/schema";
import { applyArt, getOrCreateRepo } from "@/lib/github";
import { getCommitDates, PRESET_PATTERN } from "@/lib/art";

const REPO_NAME = "ghactivity-art";

export async function POST() {
  const session = await getSession();
  if (!session.userId) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const user = await getDb().query.users.findFirst({
    where: eq(users.id, session.userId),
  });
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const dates = getCommitDates(PRESET_PATTERN);
  if (dates.length === 0) {
    return NextResponse.json({ error: "No dates to commit" }, { status: 400 });
  }

  const { owner, repo } = await getOrCreateRepo(user.accessToken, REPO_NAME);
  await applyArt(user.accessToken, owner, repo, dates);

  return NextResponse.json({
    ok: true,
    commitsCreated: dates.length,
    repo: `https://github.com/${owner}/${repo}`,
  });
}
