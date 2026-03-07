import { getSessionUser } from "@/lib/session";
import { redirect } from "next/navigation";
import { PATTERNS } from "@/lib/art";

function DemoGrid({ pattern }: { pattern: boolean[][] }) {
  const CELL = 10;
  const GAP = 3;
  const S = CELL + GAP;
  const COLORS = ["#161b22", "#0e4429", "#006d32", "#26a641", "#39d353"];

  function hasBg(col: number, row: number) {
    return Math.abs(Math.sin(col * 127.1 + row * 311.7) * 1e5) % 1 < 0.28;
  }

  return (
    <div className="overflow-x-auto">
      <svg width={52 * S} height={7 * S} className="block">
        {Array.from({ length: 52 }, (_, col) =>
          Array.from({ length: 7 }, (_, row) => {
            const art = pattern[row]?.[col];
            const level = art ? 4 : hasBg(col, row) ? 1 : 0;
            return (
              <rect
                key={`${col}-${row}`}
                x={col * S}
                y={row * S}
                width={CELL}
                height={CELL}
                rx={2}
                fill={COLORS[level]}
              />
            );
          }),
        )}
      </svg>
    </div>
  );
}

export default async function Home() {
  const user = await getSessionUser();
  if (user) redirect(`/${user.username}`);

  return (
    <div>
      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="bg-gray-950 text-white">
        {/* Nav */}
        <div className="mx-auto flex max-w-5xl items-center justify-between border-b border-white/5 px-6 py-5">
          <span className="text-xl font-black tracking-tight">ghactivity</span>
          <a
            href="/api/auth/github"
            className="text-sm text-gray-400 transition hover:text-white"
          >
            Sign in →
          </a>
        </div>

        {/* Headline */}
        <div className="mx-auto max-w-5xl space-y-7 px-6 py-20 text-center sm:py-28">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-800 bg-green-950/60 px-3 py-1 text-xs font-medium text-green-400">
            <span className="h-1.5 w-1.5 rounded-full bg-green-400" />
            Real commits · Shows on your actual GitHub profile
          </div>
          <h1 className="text-4xl font-black leading-tight tracking-tight sm:text-6xl">
            Turn your GitHub profile
            <br className="hidden sm:block" />
            into pixel art.
          </h1>
          <p className="mx-auto max-w-xl text-lg leading-relaxed text-gray-400">
            Backdated commits paint your contribution graph — it shows up on
            your real GitHub profile, permanently. No bots, no hacks, just
            commits.
          </p>
          <div className="flex flex-col items-center justify-center gap-4 pt-2 sm:flex-row">
            <a
              href="/api/auth/github"
              className="w-full rounded-lg bg-green-600 px-8 py-3.5 text-center font-semibold text-white transition hover:bg-green-500 sm:w-auto"
            >
              Start for free →
            </a>
            <a
              href="#pricing"
              className="text-sm text-gray-400 transition hover:text-white"
            >
              See pricing ↓
            </a>
          </div>
        </div>

        {/* Demo */}
        <div className="mx-auto max-w-5xl px-6 pb-20">
          <div className="space-y-4 rounded-xl border border-gray-800 bg-gray-900/60 p-4 sm:p-8">
            <div className="flex items-center justify-between">
              <p className="text-xs font-medium uppercase tracking-widest text-gray-500">
                Live preview
              </p>
              <span className="text-xs font-medium text-green-500">
                ♥ Heart pattern
              </span>
            </div>
            <DemoGrid pattern={PATTERNS.heart} />
          </div>
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section className="border-t border-gray-100 bg-white py-20 dark:border-gray-900 dark:bg-gray-950">
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-14 text-center text-3xl font-black">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-10 sm:grid-cols-3">
            {(
              [
                {
                  n: "01",
                  title: "Sign in with GitHub",
                  body: "One-click OAuth. We request only the permissions needed to create commits in a private repo on your account.",
                },
                {
                  n: "02",
                  title: "Pick a pattern",
                  body: "Choose from presets — or upgrade to Pro to draw your own pixel art with the custom editor.",
                },
                {
                  n: "03",
                  title: "Apply",
                  body: "We push backdated commits to a private repo. Your art appears on the contribution graph in minutes.",
                },
              ] as const
            ).map(({ n, title, body }) => (
              <div key={n} className="space-y-3">
                <p className="text-5xl font-black leading-none text-green-500/25">
                  {n}
                </p>
                <h3 className="text-lg font-bold">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                  {body}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ────────────────────────────────────────── */}
      <section
        id="pricing"
        className="border-t border-gray-100 bg-gray-50 py-20 dark:border-gray-800 dark:bg-gray-900"
      >
        <div className="mx-auto max-w-5xl px-6">
          <h2 className="mb-2 text-center text-3xl font-black">Pricing</h2>
          <p className="mb-14 text-center text-sm text-gray-500 dark:text-gray-400">
            Start free. Upgrade anytime.
          </p>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {/* Free */}
            <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-950">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Free
                </p>
                <p className="mt-2 text-4xl font-black">$0</p>
                <p className="text-sm text-gray-400">free forever</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {[
                  "All preset patterns",
                  "Manual apply (one-time)",
                  "ghactivity.com watermark",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-gray-600 dark:text-gray-300"
                  >
                    <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/auth/github"
                className="block rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                Get started
              </a>
            </div>

            {/* Pro */}
            <div className="relative space-y-5 rounded-xl border-2 border-green-500 bg-white p-6 shadow-lg shadow-green-500/10 dark:bg-gray-950">
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <span className="rounded-full bg-green-500 px-3 py-0.5 text-xs font-bold text-white">
                  Most popular
                </span>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Pro
                </p>
                <p className="mt-2 text-4xl font-black">
                  $1
                  <span className="text-base font-normal text-gray-400">
                    /mo
                  </span>
                </p>
                <p className="text-sm text-gray-400">billed monthly</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {[
                  "Everything in Free",
                  "Custom pattern editor",
                  "Auto-updates weekly",
                  "ghactivity.com watermark",
                ].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-gray-600 dark:text-gray-300"
                  >
                    <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/auth/github"
                className="block rounded-lg bg-green-600 px-4 py-2.5 text-center text-sm font-semibold text-white transition hover:bg-green-500"
              >
                Start Pro
              </a>
            </div>

            {/* Studio */}
            <div className="space-y-5 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-950">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                  Studio
                </p>
                <p className="mt-2 text-4xl font-black">
                  $5
                  <span className="text-base font-normal text-gray-400">
                    /mo
                  </span>
                </p>
                <p className="text-sm text-gray-400">billed monthly</p>
              </div>
              <ul className="space-y-2.5 text-sm">
                {["Everything in Pro", "Watermark removed"].map((f) => (
                  <li
                    key={f}
                    className="flex items-start gap-2 text-gray-600 dark:text-gray-300"
                  >
                    <span className="mt-0.5 shrink-0 text-green-500">✓</span>
                    {f}
                  </li>
                ))}
              </ul>
              <a
                href="/api/auth/github"
                className="block rounded-lg border border-gray-200 px-4 py-2.5 text-center text-sm font-semibold text-gray-900 transition hover:bg-gray-50 dark:border-gray-700 dark:text-gray-100 dark:hover:bg-gray-800"
              >
                Start Studio
              </a>
            </div>
          </div>

          <p className="mt-8 text-center text-xs text-gray-400">
            Payment powered by Stripe. Cancel anytime.
          </p>
        </div>
      </section>

      {/* ── Footer ─────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-8 dark:border-gray-800">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 text-sm text-gray-400">
          <span className="font-bold text-gray-900 dark:text-gray-100">
            ghactivity
          </span>
          <span>© {new Date().getFullYear()} ghactivity.com</span>
        </div>
      </footer>
    </div>
  );
}
