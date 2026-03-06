import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(`/${user.username}`);

  return (
    <div className="space-y-12">
      <div className="space-y-4">
        <h1 className="text-5xl font-bold">ghactivity</h1>
        <p className="text-xl text-gray-500 dark:text-gray-400">
          Draw pixel art on your GitHub contribution graph.
        </p>
      </div>

      <div className="space-y-6">
        <div className="space-y-3">
          <h2 className="text-lg font-semibold">How it works</h2>
          <ol className="list-inside list-decimal space-y-2 text-gray-600 dark:text-gray-300">
            <li>Sign in with your GitHub account</li>
            <li>Preview art overlaid on your real contribution graph</li>
            <li>Hit apply &mdash; backdated commits make the art appear</li>
          </ol>
        </div>

        <a
          href="/api/auth/github"
          className="inline-block rounded-lg bg-gray-900 px-6 py-3 font-medium text-white transition hover:bg-gray-700 dark:bg-gray-100 dark:text-gray-900 dark:hover:bg-gray-300"
        >
          Sign in with GitHub
        </a>
      </div>
    </div>
  );
}
