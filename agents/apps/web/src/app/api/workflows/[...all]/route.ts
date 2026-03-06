import { db } from "@/lib/db";
import { message, delivery, address } from "@/lib/db/schema";
import { serveMany, createWorkflow } from "@upstash/workflow/nextjs";
import { eq, and } from "drizzle-orm";

const reply = createWorkflow<{ messageId: string }, void>(
  async (context) => {
    const { messageId } = context.requestPayload;

    console.info("reply:start", { messageId });

    console.info("reply:run:start", {
      messageId,
      step: "mock-llm-response",
    });
    const reply = await context.run("mock-llm-response", async () => {
      console.info("reply:mock-llm-response:begin", { messageId });
      await new Promise((resolve) => setTimeout(resolve, 5000));
      console.info("reply:mock-llm-response:end", { messageId });
      return "Thanks for the message! (mock LLM reply)";
    });
    console.info("reply:run:end", {
      messageId,
      step: "mock-llm-response",
    });

    console.info("reply:run:start", { messageId, step: "store-reply" });
    await context.run("store-reply", async () => {
      console.info("reply:store-reply:begin", { messageId });
      const messageKey = BigInt(messageId);
      const [originalMessage] = await db
        .select({
          senderId: message.sender,
        })
        .from(message)
        .where(eq(message.id, messageKey))
        .limit(1);

      if (!originalMessage?.senderId) {
        throw new Error(`Message ${messageId} not found`);
      }

      const [agentDelivery] = await db
        .select({
          agentId: delivery.receiver,
        })
        .from(delivery)
        .innerJoin(address, eq(delivery.receiver, address.id))
        .where(and(eq(delivery.message, messageKey), eq(address.type, "agent")))
        .limit(1);

      if (!agentDelivery?.agentId) {
        throw new Error(`Agent receiver not found for message ${messageId}`);
      }

      const [replyMessage] = await db
        .insert(message)
        .values({
          parent: messageKey,
          sender: agentDelivery.agentId,
          content: reply,
        })
        .returning({ id: message.id });

      if (!replyMessage?.id) {
        throw new Error(`Failed to insert reply for message ${messageId}`);
      }

      await db.insert(delivery).values({
        message: replyMessage.id,
        receiver: originalMessage.senderId,
      });
      console.info("reply:store-reply:end", { messageId });
    });
    console.info("reply:run:end", { messageId, step: "store-reply" });

    console.info("reply:done", { messageId });
  },
);

export const { POST } = serveMany({
  reply,
});
