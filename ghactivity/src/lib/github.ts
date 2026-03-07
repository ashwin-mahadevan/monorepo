import { execFile } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const API = "https://api.github.com";

/** Commits per filled cell — enough to dominate real activity. */
const COMMITS_PER_CELL = 30;

interface GitHubUser {
  id: number;
  login: string;
  avatar_url: string;
}

export async function getUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${API}/user`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`GitHub user fetch failed: ${res.status}`);
  return res.json();
}

async function ghFetch(
  token: string,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "Content-Type": "application/json",
      ...options.headers,
    },
  });
}

// GitHub contribution level → intensity index (0-4)
export type ContributionLevel =
  | "NONE"
  | "FIRST_QUARTILE"
  | "SECOND_QUARTILE"
  | "THIRD_QUARTILE"
  | "FOURTH_QUARTILE";

/** 7 rows (Sun–Sat) × 52 cols (weeks), each cell is 0–4 intensity. */
export type ContributionGrid = number[][];

export interface GitHubPublicUser {
  login: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  created_at: string;
}

export async function getPublicUser(
  username: string,
): Promise<GitHubPublicUser | null> {
  const res = await fetch(`${API}/users/${username}`, {
    headers: { Accept: "application/vnd.github+json" },
    next: { revalidate: 300 },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub public user fetch failed: ${res.status}`);
  return res.json();
}

export async function getContributionGraph(
  token: string,
  username: string,
  year?: number,
): Promise<ContributionGrid> {
  const hasYear = year !== undefined;
  const query = `query($login: String!${hasYear ? ", $from: DateTime!, $to: DateTime!" : ""}) {
    user(login: $login) {
      contributionsCollection${hasYear ? "(from: $from, to: $to)" : ""} {
        contributionCalendar {
          weeks {
            contributionDays {
              contributionLevel
              date
            }
          }
        }
      }
    }
  }`;

  const variables: Record<string, string> = { login: username };
  if (hasYear) {
    variables.from = `${year}-01-01T00:00:00Z`;
    variables.to = `${year}-12-31T23:59:59Z`;
  }

  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`GraphQL request failed: ${res.status}`);

  const json = await res.json();
  const weeks =
    json.data.user.contributionsCollection.contributionCalendar.weeks;

  const levelMap: Record<ContributionLevel, number> = {
    NONE: 0,
    FIRST_QUARTILE: 1,
    SECOND_QUARTILE: 2,
    THIRD_QUARTILE: 3,
    FOURTH_QUARTILE: 4,
  };

  // Build 7×52 grid (pad/trim to exactly 52 weeks)
  const grid: number[][] = Array.from({ length: 7 }, () =>
    Array<number>(52).fill(0),
  );

  const startWeek = Math.max(0, weeks.length - 52);
  for (let wi = startWeek; wi < weeks.length; wi++) {
    const col = wi - startWeek;
    const days = weeks[wi].contributionDays;
    for (const day of days) {
      const d = new Date(day.date + "T00:00:00Z");
      const row = d.getUTCDay();
      grid[row][col] = levelMap[day.contributionLevel as ContributionLevel];
    }
  }

  return grid;
}

export async function getOrCreateRepo(
  token: string,
  repoName: string,
): Promise<{ owner: string; repo: string }> {
  const user = await getUser(token);
  const owner = user.login;

  const check = await ghFetch(token, `/repos/${owner}/${repoName}`);
  if (check.ok) return { owner, repo: repoName };

  const create = await ghFetch(token, "/user/repos", {
    method: "POST",
    body: JSON.stringify({
      name: repoName,
      auto_init: true,
      private: true,
      description: "GitHub contribution graph art by ghactivity",
    }),
  });
  if (!create.ok) {
    const body = await create.text();
    throw new Error(`Failed to create repo: ${create.status} ${body}`);
  }

  return { owner, repo: repoName };
}

export async function repoExists(
  token: string,
  owner: string,
  repo: string,
): Promise<boolean> {
  const res = await ghFetch(token, `/repos/${owner}/${repo}`);
  return res.ok;
}

export async function deleteRepo(
  token: string,
  owner: string,
  repo: string,
): Promise<void> {
  const res = await ghFetch(token, `/repos/${owner}/${repo}`, {
    method: "DELETE",
  });
  if (!res.ok && res.status !== 404) {
    const body = await res.text();
    throw new Error(`Failed to delete repo: ${res.status} ${body}`);
  }
}

async function git(
  cwd: string,
  args: string[],
  env?: Record<string, string>,
): Promise<string> {
  const { stdout } = await execFileAsync("git", args, {
    cwd,
    env: { ...process.env, ...env },
  });
  return stdout.trim();
}

export async function applyArt(
  token: string,
  owner: string,
  repo: string,
  dates: Date[],
): Promise<void> {
  const tmpDir = await mkdtemp(join(tmpdir(), "ghactivity-"));

  try {
    const remoteUrl = `https://x-access-token:${token}@github.com/${owner}/${repo}.git`;
    const email = `${owner}@users.noreply.github.com`;

    await git(tmpDir, ["init"]);
    await git(tmpDir, ["remote", "add", "origin", remoteUrl]);
    await git(tmpDir, ["config", "user.name", owner]);
    await git(tmpDir, ["config", "user.email", email]);

    // Sort dates chronologically
    const sorted = [...dates].sort((a, b) => a.getTime() - b.getTime());

    // Create initial file so we have something to commit against
    const artFile = join(tmpDir, "art.txt");
    let counter = 0;

    for (const date of sorted) {
      const isoDate = date.toISOString();
      const dateEnv = {
        GIT_AUTHOR_DATE: isoDate,
        GIT_COMMITTER_DATE: isoDate,
      };

      for (let i = 0; i < COMMITS_PER_CELL; i++) {
        await writeFile(artFile, `ghactivity ${counter++}\n`);
        await git(tmpDir, ["add", "art.txt"]);
        await git(tmpDir, ["commit", "-m", `art ${isoDate} #${i}`], dateEnv);
      }
    }

    await git(tmpDir, ["push", "--force", "origin", "HEAD:main"]);
  } finally {
    await rm(tmpDir, { recursive: true, force: true });
  }
}
