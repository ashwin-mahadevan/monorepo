import { serve } from "@upstash/workflow/nextjs";
import { getUser, deleteRepo } from "@/lib/github";

interface RemovePayload {
  accessToken: string;
}

export const { POST } = serve<RemovePayload>(async (context) => {
  const { accessToken } = context.requestPayload;

  const owner = await context.run("get-user", async () => {
    const user = await getUser(accessToken);
    return user.login;
  });

  await context.run("delete-repo", () =>
    deleteRepo(accessToken, owner, "ghactivity"),
  );
});
