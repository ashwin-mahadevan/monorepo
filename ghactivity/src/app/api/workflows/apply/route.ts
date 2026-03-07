import { serve } from "@upstash/workflow/nextjs";
import { getOrCreateRepo, applyArt } from "@/lib/github";
import { getCommitDates } from "@/lib/art";

interface ApplyPayload {
  accessToken: string;
  pattern: boolean[][];
}

export const { POST } = serve<ApplyPayload>(async (context) => {
  const { accessToken, pattern } = context.requestPayload;

  const { owner, repo } = await context.run("create-repo", () =>
    getOrCreateRepo(accessToken, "ghactivity"),
  );

  const dates = await context.run("compute-dates", () =>
    getCommitDates(pattern).map((d) => d.toISOString()),
  );

  await context.run("apply-art", () =>
    applyArt(accessToken, owner, repo, dates.map((iso) => new Date(iso))),
  );
});
