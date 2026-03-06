const API = "https://api.github.com";

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

export async function applyArt(
  token: string,
  owner: string,
  repo: string,
  dates: Date[],
): Promise<void> {
  // Get or create default branch ref
  let ref = await ghFetch(token, `/repos/${owner}/${repo}/git/ref/heads/main`);
  if (!ref.ok) {
    // Try master
    ref = await ghFetch(token, `/repos/${owner}/${repo}/git/ref/heads/master`);
  }
  if (!ref.ok) throw new Error("Could not find default branch ref");

  const refData = await ref.json();
  let currentSha: string = refData.object.sha;
  const refPath: string = refData.ref;

  // Get the tree of the current commit
  const commitRes = await ghFetch(
    token,
    `/repos/${owner}/${repo}/git/commits/${currentSha}`,
  );
  if (!commitRes.ok) throw new Error("Could not get current commit");
  const commitData = await commitRes.json();
  const treeSha: string = commitData.tree.sha;

  // Create chained commits for each date
  for (const date of dates) {
    const isoDate = date.toISOString();
    const message = `ghactivity art commit ${isoDate}`;

    // Create a blob with unique content per commit
    const blobRes = await ghFetch(token, `/repos/${owner}/${repo}/git/blobs`, {
      method: "POST",
      body: JSON.stringify({
        content: `ghactivity ${isoDate}\n`,
        encoding: "utf-8",
      }),
    });
    if (!blobRes.ok) throw new Error("Failed to create blob");
    const blobData = await blobRes.json();

    // Create a tree with the blob
    const treeRes = await ghFetch(token, `/repos/${owner}/${repo}/git/trees`, {
      method: "POST",
      body: JSON.stringify({
        base_tree: treeSha,
        tree: [
          {
            path: `art/${date.getTime()}.txt`,
            mode: "100644",
            type: "blob",
            sha: blobData.sha,
          },
        ],
      }),
    });
    if (!treeRes.ok) throw new Error("Failed to create tree");
    const treeData = await treeRes.json();

    // Create a commit with the backdated author date
    const newCommitRes = await ghFetch(
      token,
      `/repos/${owner}/${repo}/git/commits`,
      {
        method: "POST",
        body: JSON.stringify({
          message,
          tree: treeData.sha,
          parents: [currentSha],
          author: {
            name: owner,
            email: `${owner}@users.noreply.github.com`,
            date: isoDate,
          },
          committer: {
            name: owner,
            email: `${owner}@users.noreply.github.com`,
            date: isoDate,
          },
        }),
      },
    );
    if (!newCommitRes.ok) throw new Error("Failed to create commit");
    const newCommitData = await newCommitRes.json();
    currentSha = newCommitData.sha;
  }

  // Update the ref to point to the last commit
  const updateRef = await ghFetch(
    token,
    `/repos/${owner}/${repo}/git/${refPath}`,
    {
      method: "PATCH",
      body: JSON.stringify({ sha: currentSha }),
    },
  );
  if (!updateRef.ok) throw new Error("Failed to update ref");
}
