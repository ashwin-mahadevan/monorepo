import { NextRequest, NextResponse } from "next/server";
import { Client } from "@upstash/workflow";
import { getSessionUser } from "@/lib/session";

const client = new Client({
  baseUrl: process.env.QSTASH_URL!,
  token: process.env.QSTASH_TOKEN!,
});

export async function POST(req: NextRequest) {
  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json();
  const pattern: unknown = body?.pattern;

  if (
    !Array.isArray(pattern) ||
    pattern.length !== 7 ||
    !pattern.every(
      (row) =>
        Array.isArray(row) &&
        row.length === 52 &&
        row.every((v) => typeof v === "boolean"),
    )
  ) {
    return NextResponse.json(
      { error: "Invalid pattern: expected boolean[7][52]" },
      { status: 400 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_URL ?? "http://localhost:3000";
  const { workflowRunId } = await client.trigger({
    url: `${baseUrl}/api/workflows/apply`,
    body: { accessToken: user.accessToken, pattern },
  });

  return NextResponse.json({ ok: true, workflowRunId });
}
