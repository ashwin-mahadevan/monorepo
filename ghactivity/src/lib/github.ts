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
      private: false,
      description: "GitHub contribution graph art by ghactivity",
    }),
  });
  if (!create.ok) {
    const body = await create.text();
    throw new Error(`Failed to create repo: ${create.status} ${body}`);
  }

  return { owner, repo: repoName };
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
