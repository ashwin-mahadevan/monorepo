import { getSessionUser } from "@/lib/session";
import { getContributionGraph, repoExists } from "@/lib/github";
import { Dashboard, LogoutButton } from "./client";
import { redirect } from "next/navigation";

export default async function UserPage({
  params,
}: {
  params: Promise<{ username: string }>;
}) {
  const { username } = await params;
  const user = await getSessionUser();

  if (!user || user.username !== username) {
    redirect("/");
  }

  const [contributions, artApplied] = await Promise.all([
    getContributionGraph(user.accessToken, user.username).catch(() => undefined),
    repoExists(user.accessToken, user.username, "ghactivity"),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">ghactivity</h1>
        <p className="mt-2 text-gray-500 dark:text-gray-400">
          Draw pixel art on your GitHub contribution graph
        </p>
      </div>

      <div className="space-y-6">
        <div className="flex items-center gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.avatarUrl}
            alt={user.username}
            className="h-10 w-10 rounded-full"
          />
          <span className="font-medium">{user.username}</span>
          <LogoutButton />
        </div>

        <div>
          <h2 className="mb-3 text-lg font-semibold">Preview</h2>
          <Dashboard contributions={contributions} artApplied={artApplied} />
        </div>
      </div>
    </div>
  );
}
