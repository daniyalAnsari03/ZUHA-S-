import { Runner } from "@openai/agents";

import { managerAgent } from "@/agents/manager";
import { AI_MODEL, MAX_AGENT_TURNS } from "@/agents/config";
import type { AgentContext } from "@/agents/context";
import { buildInputItems } from "@/services/ai/chat-service";
import { resolveApprovedRecipient } from "./whatsapp-recipients";
import { sendWhatsAppText } from "./whatsapp-service";
import type { ParsedWebhookEvent } from "./webhook-service";

/**
 * WhatsApp → AI control channel.
 *
 * Only messages from APPROVED ADMIN RECIPIENTS (a `whatsapp_recipients` row of
 * type "admin" that is active AND linked to an auth user) are processed. Every
 * other sender is silently ignored — untrusted input is never forwarded to the
 * AI and never triggers business actions. This is the identity prerequisite of
 * the WhatsApp control channel.
 */
export async function processInboundMessage(
  event: ParsedWebhookEvent,
): Promise<{ handled: "processed" | "ignored" | "failed"; reason?: string }> {
  const message = event.message;
  if (!message) return { handled: "ignored", reason: "no-message" };

  const sender = message.from;
  if (!sender) return { handled: "ignored", reason: "no-sender" };

  // Identity: must be an approved, active admin recipient linked to a user.
  const recipient = await resolveApprovedRecipient(sender, "admin");
  if (!recipient || !recipient.user_id) {
    return { handled: "ignored", reason: "unapproved-sender" };
  }

  const text = message.text?.trim();
  if (!text || text.length > 4000) {
    return { handled: "ignored", reason: "no-text" };
  }

  const requestId = globalThis.crypto.randomUUID();
  const context: AgentContext = {
    userId: recipient.user_id,
    role: "admin",
    channel: "admin",
    requestId,
  };

  let reply: string;
  try {
    const runner = new Runner({
      model: AI_MODEL,
      workflowName: "ai_whatsapp",
      groupId: `wa-${requestId}`,
      traceMetadata: {
        channel: "whatsapp",
        requestId,
        actorRole: "admin",
      },
      traceIncludeSensitiveData: false,
    });
    const result = await runner.run(managerAgent, buildInputItems([], text), {
      context,
      maxTurns: MAX_AGENT_TURNS,
    });
    reply = (result.finalOutput ?? "").trim();
    if (!reply) {
      reply = "Done.";
    }
  } catch (error) {
    console.error("[whatsapp-ai] manager run failed:", error);
    reply =
      "Sorry, I couldn't process that command right now. Please try again shortly.";
    // Still send the failure notice so the owner knows the request was received.
    await sendWhatsAppText({
      to: recipient.phone,
      toLabel: recipient.label,
      content: reply,
      idempotencyKey: `wa-ack-${event.providerEventId}`,
      requestedByUserId: recipient.user_id,
    }).catch(() => {});
    return { handled: "failed", reason: "ai-run-error" };
  }

  const sendResult = await sendWhatsAppText({
    to: recipient.phone,
    toLabel: recipient.label,
    content: reply,
    idempotencyKey: `wa-reply-${event.providerEventId}`,
    requestedByUserId: recipient.user_id,
  });

  return sendResult.ok
    ? { handled: "processed" }
    : { handled: "failed", reason: "reply-send-failed" };
}