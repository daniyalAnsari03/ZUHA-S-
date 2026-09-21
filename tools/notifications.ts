import { tool, type RunContext } from "@openai/agents";
import { z } from "zod";

import type { AgentContext } from "@/agents/context";
import { toolRoleGuardrail, ADMIN_ROLE } from "@/guardians/authorization";
import {
  getUnreadCount,
  listNotifications,
} from "@/services/notifications/notification-service";
import { withToolAudit } from "@/tools/shared/audit";
import { fail, ok, type ToolResult } from "@/tools/shared/result";

type AdminNotificationReadData = {
  unreadCount: number;
  totalCount: number;
  notifications: {
    id: string;
    type: string;
    title: string;
    message: string;
    isRead: boolean;
    createdAt: string;
  }[];
};

/**
 * Admin-only read of the notification centre: the real unread count plus the
 * latest notifications (new orders, low-stock alerts). Read-only — it never
 * marks anything read.
 */
export const getAdminNotificationsTool = tool({
  name: "get_admin_notifications",
  description:
    "Read the admin notification centre: unread count plus the latest notifications (new orders, low-stock alerts). Use it to answer notification questions for the owner (e.g. 'notification koi unread hai?', 'kitni unread notifications hain?'). Read-only.",
  parameters: z.object({
    unreadOnly: z.boolean().optional(),
    limit: z.number().int().min(1).max(20).optional(),
  }),
  strict: true,
  inputGuardrails: [toolRoleGuardrail("get_admin_notifications", [ADMIN_ROLE])],
  async execute(
    { unreadOnly, limit }: { unreadOnly?: boolean; limit?: number },
    runContext?: RunContext<AgentContext>,
  ) {
    const ctx = runContext?.context;
    if (!ctx || !ctx.userId) {
      return {
        ok: false,
        reason: "error",
        message: "Missing execution context.",
      } as const;
    }

    const userId = ctx.userId;

    const run = async (): Promise<ToolResult<AdminNotificationReadData>> => {
      const [unreadCount, notifications] = await Promise.all([
        getUnreadCount(userId).catch(() => -1),
        listNotifications(userId, {
          unreadOnly: unreadOnly ?? false,
          limit: limit ?? 10,
        }).catch(() => null),
      ]);

      if (unreadCount === -1 || notifications === null) {
        return fail(
          "error",
          "Failed to read notifications right now. Try again in a moment.",
        );
      }

      return ok({
        unreadCount,
        totalCount: notifications.length,
        notifications: notifications.map((n) => ({
          id: n.id,
          type: n.type,
          title: n.title,
          message: n.message,
          isRead: n.is_read,
          createdAt: n.created_at,
        })),
      });
    };

    return withToolAudit(
      {
        context: ctx,
        agentName: ctx.agentName ?? "ai",
        toolName: "get_admin_notifications",
        actionType: "notifications.admin.read",
        risk: "low",
        summary: "Read admin notifications",
      },
      run,
    );
  },
});