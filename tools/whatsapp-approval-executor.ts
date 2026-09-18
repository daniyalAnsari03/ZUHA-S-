import { sendWhatsAppText } from "@/services/whatsapp/whatsapp-service";
import {
  buildDailySalesReport,
  buildLowStockReport,
  buildOrdersReport,
  reportToText,
} from "@/services/whatsapp/whatsapp-reports";

/**
 * Human-readable failure for an admin approver. The provider message is kept
 * bounded (no raw secrets) but the provider error code is appended so the owner
 * can diagnose e.g. "(#131030) Recipient phone number not in allowed list".
 */
function providerFailureMessage(
  result: { ok: false; message: string; providerCode?: string },
): string {
  return result.providerCode
    ? `${result.message} (provider code: ${result.providerCode})`
    : result.message;
}

/**
 * Executes the FROZEN execution payload of an approved (or about-to-be
 * approved) WhatsApp action. Only `execution.kind` values registered here can
 * ever run; any unknown payload is rejected. This is the ONLY executor wired
 * into the approval decision flow for WhatsApp tools.
 */
export async function executeApprovedWhatsappAction(
  execution: Record<string, unknown>,
): Promise<{ ok: true; message?: string } | { ok: false; error: string }> {
  const kind = execution.kind;
  const phone = typeof execution.recipientPhone === "string"
    ? execution.recipientPhone
    : null;
  const label =
    typeof execution.recipientLabel === "string"
      ? execution.recipientLabel
      : null;
  const requestedByUserId =
    typeof execution.requestedBy === "string" ? execution.requestedBy : null;

  if (!phone) {
    return { ok: false, error: "The approved action is missing its recipient." };
  }

  if (kind === "whatsapp_message") {
    const content =
      typeof execution.content === "string" ? execution.content.trim() : "";
    if (!content) {
      return { ok: false, error: "The approved action has no message content." };
    }
    const result = await sendWhatsAppText({
      to: phone,
      toLabel: label,
      content,
      requestedByUserId,
      idempotencyKey: `approved-${globalThis.crypto.randomUUID()}`,
    });
    if (!result.ok) {
      return { ok: false, error: providerFailureMessage(result) };
    }
    return { ok: true, message: `Sent to ${label ?? phone}.` };
  }

  if (kind === "whatsapp_report") {
    const report = execution.report;
    let text: string;
    if (report === "low_stock") {
      text = reportToText(await buildLowStockReport());
    } else if (report === "orders") {
      text = reportToText(await buildOrdersReport(5));
    } else {
      text = reportToText(await buildDailySalesReport());
    }
    const result = await sendWhatsAppText({
      to: phone,
      toLabel: label,
      content: text,
      requestedByUserId,
      idempotencyKey: `report-approved-${globalThis.crypto.randomUUID()}`,
    });
    if (!result.ok) {
      return { ok: false, error: providerFailureMessage(result) };
    }
    return { ok: true, message: `Report sent to ${label ?? phone}.` };
  }

  return { ok: false, error: "The approved action is not a supported WhatsApp action." };
}