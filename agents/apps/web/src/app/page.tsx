import { Client } from "@upstash/workflow";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { and, desc, eq } from "drizzle-orm";

import { db } from "@/lib/db";
import { address, delivery, message } from "@/lib/db/schema";
import { localUser } from "@/lib/user";

const messagePreviewLimit = 96;
const formatInboxTime = (value: Date) =>
  new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(value);

export default async function Home() {
  async function sendEmail(formData: FormData) {
    "use server";

    const content = formData.get("content");
    if (typeof content !== "string" || content.trim().length === 0) {
      return;
    }

    const fromAddress = {
      display: localUser.address.display,
      local: localUser.address.local,
      domain: localUser.address.domain,
    };
    const toAddress = {
      display: "Postbox",
      local: "hello",
      domain: "postbox.dev",
    };
    const toAddressType = "agent" as const;

    const [fromRecord] = await db
      .insert(address)
      .values({ type: "human", ...fromAddress })
      .onConflictDoUpdate({
        target: [address.local, address.domain],
        set: { type: "human", display: fromAddress.display },
      })
      .returning({ id: address.id });

    const [toRecord] = await db
      .insert(address)
      .values({ type: toAddressType, ...toAddress })
      .onConflictDoUpdate({
        target: [address.local, address.domain],
        set: { type: toAddressType, display: toAddress.display },
      })
      .returning({ id: address.id });

    if (!fromRecord?.id || !toRecord?.id) {
      return;
    }

    const [messageRecord] = await db
      .insert(message)
      .values({
        sender: fromRecord.id,
        content: content.trim(),
      })
      .returning({ id: message.id });

    if (!messageRecord?.id) {
      return;
    }

    await db.insert(delivery).values({
      message: messageRecord.id,
      receiver: toRecord.id,
    });

    if (toAddressType === "agent") {
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ??
        (process.env.VERCEL_URL
          ? `https://${process.env.VERCEL_URL}`
          : "http://localhost:3000");

      const client = new Client({
        baseUrl: process.env.QSTASH_URL,
        token: process.env.QSTASH_TOKEN!,
      });

      await client.trigger({
        url: `${baseUrl}/api/workflows/reply`,
        body: { messageId: messageRecord.id.toString() },
      });
    }
  }

  const [localAddress] = await db
    .select({ id: address.id })
    .from(address)
    .where(
      and(
        eq(address.local, localUser.address.local),
        eq(address.domain, localUser.address.domain),
      ),
    )
    .limit(1);

  const inboxRows = localAddress
    ? await db
        .select({
          id: delivery.id,
          deliveredAt: delivery.created,
          content: message.content,
          senderDisplay: address.display,
          senderLocal: address.local,
          senderDomain: address.domain,
          senderType: address.type,
        })
        .from(delivery)
        .innerJoin(message, eq(delivery.message, message.id))
        .innerJoin(address, eq(message.sender, address.id))
        .where(eq(delivery.receiver, localAddress.id))
        .orderBy(desc(delivery.created))
    : [];

  const emails = inboxRows.map((row) => {
    const content = row.content.trim();
    const [subjectLine, ...restLines] = content.split("\n");
    const subject = subjectLine?.trim() || "New message";
    const previewSource = restLines.join(" ").trim() || subjectLine || content;
    const preview = previewSource
      .replace(/\s+/g, " ")
      .slice(0, messagePreviewLimit);
    const sender =
      row.senderDisplay || `${row.senderLocal}@${row.senderDomain}`;

    return {
      id: `inbox-${row.id}`,
      sender,
      subject,
      preview,
      time: formatInboxTime(row.deliveredAt),
      tag: row.senderType === "agent" ? "Agent" : "Human",
    };
  });

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 12)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />
      <SidebarInset>
        <SiteHeader title="Inbox" />
        <div className="flex flex-1 flex-col">
          <div className="@container/main flex flex-1 flex-col gap-2">
            <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center sm:justify-between">
                <Input className="w-full sm:w-64" placeholder="Search inbox" />
                <Button>Compose</Button>
              </div>
              <div className="grid flex-1 gap-4 md:grid-cols-4">
                <Card className="md:col-span-1">
                  <CardHeader className="gap-1">
                    <CardTitle className="text-base">Inbox</CardTitle>
                    <p className="text-sm text-muted-foreground">Today</p>
                  </CardHeader>
                  <CardContent className="flex flex-col gap-3">
                    {emails.map((email, index) => (
                      <div
                        key={email.id}
                        className={`rounded-lg border px-3 py-3 transition ${
                          index === 0
                            ? "border-primary/40 bg-primary/5"
                            : "border-transparent hover:border-border hover:bg-muted/40"
                        }`}
                      >
                        <div className="flex items-center justify-between text-xs text-muted-foreground">
                          <span>{email.sender}</span>
                          <span>{email.time}</span>
                        </div>
                        <div className="mt-2 text-sm font-medium">
                          {email.subject}
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground">
                          {email.preview}
                        </p>
                        <Badge variant="secondary" className="mt-2">
                          {email.tag}
                        </Badge>
                      </div>
                    ))}
                  </CardContent>
                </Card>
                <Card className="md:col-span-3">
                  <CardHeader>
                    <CardTitle className="text-xl">Send email</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <form action={sendEmail} className="space-y-4">
                      <div className="rounded-lg border bg-muted/30 p-3 text-xs text-muted-foreground">
                        From: {localUser.email} · To: hello@postbox.dev
                      </div>
                      <div className="space-y-2">
                        <label
                          htmlFor="content"
                          className="text-sm font-medium"
                        >
                          Message
                        </label>
                        <Textarea
                          id="content"
                          name="content"
                          placeholder="Write your message..."
                          required
                        />
                      </div>
                      <Separator />
                      <div className="flex justify-end">
                        <Button type="submit">Send</Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>
            </div>
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
