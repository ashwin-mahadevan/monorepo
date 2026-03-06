import { NextResponse } from "next/server";
import { Client } from "@upstash/workflow";
import { getSessionUser } from "@/lib/session";

const client = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
});

export async function POST() {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  const { workflowRunId } = await client.trigger({
    url: `${baseUrl}/api/workflows/remove`,
    body: { accessToken: user.accessToken },
  });

  return NextResponse.json({ ok: true, workflowRunId });
}
