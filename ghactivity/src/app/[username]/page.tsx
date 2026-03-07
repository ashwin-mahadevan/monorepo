import { getSessionUser } from "@/lib/session";
import { getContributionGraph, getPublicUser, repoExists } from "@/lib/github";
import { Dashboard, LogoutButton, YearSelect } from "./client";
import { notFound } from "next/navigation";

export default async function UserPage({
  params,
  searchParams,
}: {
  params: Promise<{ username: string }>;
  searchParams: Promise<{ year?: string }>;
}) {
  const { username } = await params;
  const { year: yearStr } = await searchParams;
  const year = yearStr ? parseInt(yearStr) : undefined;

  const [sessionUser, ghProfile] = await Promise.all([
    getSessionUser(),
    getPublicUser(username),
  ]);

  if (!ghProfile) notFound();

  const isOwner = sessionUser?.username === username;

  let contributions: number[][] | undefined;
  let artApplied: boolean | undefined;

  if (isOwner && sessionUser) {
    [contributions, artApplied] = await Promise.all([
      getContributionGraph(sessionUser.accessToken, username, year).catch(
        () => undefined,
      ),
      repoExists(sessionUser.accessToken, username, "ghactivity"),
    ]);
  } else if (sessionUser) {
    contributions = await getContributionGraph(
      sessionUser.accessToken,
      username,
      year,
    ).catch(() => undefined);
  }

  const createdYear = new Date(ghProfile.created_at).getFullYear();
  const currentYear = new Date().getFullYear();
  const availableYears: number[] = [];
  for (let y = currentYear; y >= createdYear; y--) {
    availableYears.push(y);
  }

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="flex items-start gap-5">
        <a
          href={`https://github.com/${username}`}
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={ghProfile.avatar_url}
            alt={username}
            className="h-20 w-20 rounded-full"
          />
        </a>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-4">
            <div>
              {ghProfile.name && (
                <h1 className="text-xl font-bold">{ghProfile.name}</h1>
              )}
              <a
                href={`https://github.com/${username}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gray-500 hover:underline dark:text-gray-400"
              >
                {username}
              </a>
            </div>
            {isOwner && <LogoutButton />}
          </div>
          {ghProfile.bio && (
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-300">
              {ghProfile.bio}
            </p>
          )}
          {!isOwner && !sessionUser && (
            <p className="mt-3 text-sm text-gray-500 dark:text-gray-400">
              <a
                href="/api/auth/github"
                className="font-medium text-gray-900 underline hover:no-underline dark:text-gray-100"
              >
                Sign in with GitHub
              </a>{" "}
              to draw art on your own profile.
            </p>
          )}
        </div>
      </div>

      {/* Contribution graph section */}
      <div>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">
            {isOwner ? "Preview" : "Contribution Graph"}
          </h2>
          <YearSelect
            username={username}
            availableYears={availableYears}
            selectedYear={year}
          />
        </div>
        <Dashboard
          contributions={contributions}
          artApplied={artApplied}
          isOwner={isOwner}
        />
      </div>
    </div>
  );
}
