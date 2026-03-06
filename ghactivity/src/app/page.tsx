import { getSession } from "@/lib/session";
import { ArtPreview } from "@/components/art-preview";
import { ApplyButton, LogoutButton } from "./client";

export default async function Home() {
  const session = await getSession();
  const loggedIn = !!session.userId;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-4xl font-bold">ghactivity</h1>
        <p className="mt-2 text-gray-400">
          Draw pixel art on your GitHub contribution graph
        </p>
      </div>

      {loggedIn ? (
        <div className="space-y-6">
          <div className="flex items-center gap-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={session.avatarUrl}
              alt={session.githubUsername}
              className="h-10 w-10 rounded-full"
            />
            <span className="font-medium">{session.githubUsername}</span>
            <LogoutButton />
          </div>

          <div>
            <h2 className="mb-3 text-lg font-semibold">Preview</h2>
            <ArtPreview />
          </div>

          <ApplyButton />
        </div>
      ) : (
        <a
          href="/api/auth/github"
          className="inline-block rounded-lg bg-gray-800 px-6 py-3 font-medium text-white transition hover:bg-gray-700"
        >
          Sign in with GitHub
        </a>
      )}
    </div>
  );
}
