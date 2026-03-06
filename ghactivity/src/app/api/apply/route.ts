import { NextResponse } from "next/server";
import { getSessionUser } from "@/lib/session";
import { applyArt, getOrCreateRepo } from "@/lib/github";
import { getCommitDates, PRESET_PATTERN } from "@/lib/art";

const REPO_NAME = "ghactivity-art";

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const dates = getCommitDates(PRESET_PATTERN);
  if (dates.length === 0) {
    return NextResponse.json({ error: "No dates to commit" }, { status: 400 });
  }

  const { owner, repo } = await getOrCreateRepo(user.accessToken, REPO_NAME);
  await applyArt(user.accessToken, owner, repo, dates);

  return NextResponse.json({
    ok: true,
    commitsCreated: dates.length * 30,
    repo: `https://github.com/${owner}/${repo}`,
  });
}
