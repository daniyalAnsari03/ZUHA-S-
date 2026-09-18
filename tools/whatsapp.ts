import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import { runGuardedTool } from "@/tools/shared/guarded";
import { invalid, asResult } from "@/tools/shared/result";
import type { ToolResult } from "@/tools/shared/result";
import {
  listApprovedRecipients,
} from "@/services/whatsapp/whatsapp-recipients";
import { sendWhatsAppText } from "@/services/whatsapp/whatsapp-service";
import { getWhatsappSettings } from "@/services/whatsapp/whatsapp-settings";
import {
  buildDailySalesReport,
  buildLowStockReport,
  buildOrdersReport,
  reportToText,
} from "@/services/whatsapp/whatsapp-reports";

type ReportKind = "daily_sales" | "low_stock" | "orders";

/** Map a sendWhatsAppText outcome to the tool's ToolResult shape. */
function sendResult(
  send: Awaited<ReturnType<typeof sendWhatsAppText>>,
): ToolResult<{ sent: true; alreadySent: boolean }> {
  if (!send.ok) {
    return {
      ok: false,
      reason: "error",
      message: send.message,
    };
  }
  return {
    ok: true,
    data: { sent: true, alreadySent: send.alreadySent },
  };
}

async function resolveRecipientLabel(
  ctx: AgentContext,
  recipientLabel: string,
) {
  const label = recipientLabel?.trim();
  if (!label) {
    return {
      ok: false as const,
      result: invalid("Please specify which recipient should receive the WhatsApp message."),
    };
  }

  const rows = await asResult(() =>
    listApprovedRecipients({ onlyActive: true, type: "admin" }),
  );
  if (!rows.ok) return { ok: false as const, result: rows };

  const match = rows.data.find(
    (recipient) => recipient.label.toLowerCase() === label.toLowerCase(),
  );
  if (!match) {
    const labels = rows.data.map((r) => r.label).join(", ");
    return {
      ok: false as const,
      result: invalid(
        `No approved WhatsApp recipient named "${label}". Approved admins: ${
          labels || "(none configured)"
        }.`,
      ),
    };
  }
  return { ok: true as const, recipient: match };
}

function settingsApprovalRequired(input: {
  settingsOf: { require_approval_for_send: boolean } | null;
}): boolean {
  return input.settingsOf?.require_approval_for_send ?? true;
}

/**
 * Send a text WhatsApp message to an approved admin recipient.
 * Guardian-guarded: medium risk, and required-approval-by-exception per store
 * settings. The recipient must exist in whatsapp_recipients — arbitrary
 * numbers are always rejected.
 */
export const sendWhatsAppMessage = tool({
  name: "send_whatsapp_message",
  description:
    "Send a WhatsApp text message to an approved admin recipient. The recipient must be one of the configured approved recipients (matched by label) — a random phone number will be rejected. Use for owner notifications and reports on WhatsApp.",
  parameters: z.object({
    recipientLabel: z.string().min(1).describe("Approved recipient label, e.g. 'Owner'."),
    content: z
      .string()
      .min(1)
      .max(4000)
      .describe("Plain-text message content, max 4000 characters."),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("send_whatsapp_message", [ADMIN_ROLE])],
  async execute(
    { recipientLabel, content }: { recipientLabel: string; content: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) {
      return { ok: false, reason: "error" as const, message: "Missing execution context." };
    }

    const resolved = await resolveRecipientLabel(ctx, recipientLabel);
    if (!resolved.ok) return resolved.result;

    const recipient = resolved.recipient;
    const settings = await getWhatsappSettings().catch(() => null);

    const normalizedContent = content?.trim() || "";
    if (!normalizedContent) {
      return invalid("Please provide the message content.");
    }

    return runGuardedTool({
      context: ctx,
      agentName: ctx.agentName ?? "ai",
      toolName: "send_whatsapp_message",
      actionType: "whatsapp.message.send",
      argsSummary: { recipient: recipient.label },
      summary: `Send a WhatsApp message to ${recipient.label}`,
      exceptionRequired: settingsApprovalRequired({ settingsOf: settings }),
      run: async () => {
        const send = await sendWhatsAppText({
          to: recipient.phone,
          toLabel: recipient.label,
          content: normalizedContent,
          requestedByUserId: ctx.userId,
        });
        const result = sendResult(send);
        if (!result.ok) return result;
        return {
          ok: true,
          data: result.data,
          message: result.data.alreadySent
            ? `Message was already sent to ${recipient.label}.`
            : `Message sent to ${recipient.label} via WhatsApp.`,
        };
      },
      approval: {
        buildExecution: () => ({
          kind: "whatsapp_message",
          toolName: "send_whatsapp_message",
          recipientPhone: recipient.phone,
          recipientLabel: recipient.label,
          content: normalizedContent,
          requestedBy: ctx.userId,
        }),
        execute: async (execution) => {
          const phone = execution.recipientPhone as string;
          const label = (execution.recipientLabel as string) ?? recipient.label;
          const payload = (execution.content as string) ?? normalizedContent;
          const send = await sendWhatsAppText({
            to: phone,
            toLabel: label,
            content: payload,
            requestedByUserId: ctx.userId,
            idempotencyKey: `approved-${globalThis.crypto.randomUUID()}`,
          });
          const result = sendResult(send);
          if (!result.ok) return result;
          return {
            ok: true,
            data: result.data,
            message: `Approved message sent to ${label}.`,
          };
        },
      },
    });
  },
});

/**
 * Send a business report (real data) over WhatsApp to an approved recipient.
 */
export const sendWhatsAppReport = tool({
  name: "send_whatsapp_report",
  description:
    "Send a business report to an approved admin recipient over WhatsApp. Reports are computed from live database data: 'daily_sales' (today revenue/orders), 'low_stock' (products low on stock), or 'orders' (latest orders).",
  parameters: z.object({
    report: z.enum(["daily_sales", "low_stock", "orders"]),
    recipientLabel: z.string().min(1).describe("Approved recipient label, e.g. 'Owner'."),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("send_whatsapp_report", [ADMIN_ROLE])],
  async execute(
    { report, recipientLabel }: { report: ReportKind; recipientLabel: string },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx) {
      return { ok: false, reason: "error" as const, message: "Missing execution context." };
    }

    const resolved = await resolveRecipientLabel(ctx, recipientLabel);
    if (!resolved.ok) return resolved.result;

    const recipient = resolved.recipient;
    const settings = await getWhatsappSettings().catch(() => null);

    const buildReport = async () => {
      switch (report) {
        case "daily_sales":
          return buildDailySalesReport();
        case "low_stock":
          return buildLowStockReport();
        case "orders":
          return buildOrdersReport(5);
      }
    };

    return runGuardedTool({
      context: ctx,
      agentName: ctx.agentName ?? "ai",
      toolName: "send_whatsapp_report",
      actionType: "whatsapp.report.send",
      argsSummary: { report, recipient: recipient.label },
      summary: `Send the ${report.replace("_", " ")} report to ${recipient.label}`,
      exceptionRequired: settingsApprovalRequired({ settingsOf: settings }),
      run: async () => {
        const reportResult = await asResult(buildReport);
        if (!reportResult.ok) return reportResult;
        const text = reportToText(reportResult.data);
        const send = await sendWhatsAppText({
          to: recipient.phone,
          toLabel: recipient.label,
          content: text,
          requestedByUserId: ctx.userId,
        });
        const result = sendResult(send);
        if (!result.ok) return result;
        return {
          ok: true,
          data: { sent: true, report: reportResult.data.title },
          message: `${reportResult.data.title} sent to ${recipient.label} via WhatsApp.`,
        };
      },
      approval: {
        buildExecution: () => ({
          kind: "whatsapp_report",
          toolName: "send_whatsapp_report",
          report,
          recipientPhone: recipient.phone,
          recipientLabel: recipient.label,
          requestedBy: ctx.userId,
        }),
        execute: async (execution) => {
          const phone = execution.recipientPhone as string;
          const label = (execution.recipientLabel as string) ?? recipient.label;
          const reportResult = await asResult(buildReport);
          if (!reportResult.ok) return reportResult;
          const text = reportToText(reportResult.data);
          const send = await sendWhatsAppText({
            to: phone,
            toLabel: label,
            content: text,
            requestedByUserId: ctx.userId,
            idempotencyKey: `report-approved-${globalThis.crypto.randomUUID()}`,
          });
          const result = sendResult(send);
          if (!result.ok) return result;
          return {
            ok: true,
            data: { sent: true, report: reportResult.data.title },
            message: `Approved report sent to ${label}.`,
          };
        },
      },
    });
  },
});