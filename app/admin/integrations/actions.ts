"use server";

import { revalidatePath } from "next/cache";

import { getAuthUser } from "@/lib/auth/session";
import {
  createWhatsAppRecipient,
  deleteWhatsAppRecipient,
  setRecipientActive,
} from "@/services/whatsapp/whatsapp-recipients";
import { updateWhatsappSettings } from "@/services/whatsapp/whatsapp-settings";

/**
 * Admin-only server actions for the Integrations page. They follow the
 * existing admin action convention: void-returning, best-effort with logged
 * failures, revalidating the page on success. Privacy-first — no recipients or
 * settings are ever returned to the client from these actions.
 */

async function requireAdminUserId(): Promise<string | null> {
  const user = await getAuthUser();
  if (!user || user.role !== "admin") return null;
  return user.id;
}

/* ---------------------------------------------------------------------------
 * WhatsApp settings (approval toggle + safe identity fields)
 * --------------------------------------------------------------------- */

export async function updateWhatsappSettingsAction(
  formData: FormData,
): Promise<void> {
  const adminId = await requireAdminUserId();
  if (!adminId) return;

  const requireApprovalForSend = formData.get("requireApprovalForSend") === "on";
  const phoneNumberId = formData.get("phoneNumberId");
  const displayPhone = formData.get("displayPhone");
  const businessName = formData.get("businessName");

  try {
    const result = await updateWhatsappSettings({
      phoneNumberId:
        typeof phoneNumberId === "string" && phoneNumberId.trim()
          ? phoneNumberId.trim()
          : null,
      displayPhone:
        typeof displayPhone === "string" && displayPhone.trim()
          ? displayPhone.trim()
          : null,
      businessName:
        typeof businessName === "string" && businessName.trim()
          ? businessName.trim()
          : null,
      requireApprovalForSend,
    });
    if (!result.ok) {
      console.error("[admin] whatsapp settings update failed:", result.error);
    }
  } catch (error) {
    console.error("[admin] whatsapp settings update failed:", error);
    return;
  }

  revalidatePath("/admin/integrations");
}

/* ---------------------------------------------------------------------------
 * Approved recipients
 * --------------------------------------------------------------------- */

export async function addRecipientAction(formData: FormData): Promise<void> {
  const adminId = await requireAdminUserId();
  if (!adminId) return;

  const label = formData.get("label");
  const phone = formData.get("phone");
  const recipientType = formData.get("recipientType");

  try {
    const result = await createWhatsAppRecipient({
      label: typeof label === "string" ? label : "",
      phone: typeof phone === "string" ? phone : "",
      recipientType: recipientType === "customer" ? "customer" : "admin",
      isActive: true,
    });
    if (!result.ok) {
      console.error("[admin] add recipient failed:", result.error);
      return;
    }
  } catch (error) {
    console.error("[admin] add recipient failed:", error);
    return;
  }

  revalidatePath("/admin/integrations");
}

export async function toggleRecipientAction(
  recipientId: string,
  currentlyActive: boolean,
): Promise<void> {
  const adminId = await requireAdminUserId();
  if (!adminId) return;

  const result = await setRecipientActive(recipientId, !currentlyActive);
  if (!result.ok) {
    console.error("[admin] toggle recipient failed:", result.error);
    return;
  }

  revalidatePath("/admin/integrations");
}

export async function deleteRecipientAction(recipientId: string): Promise<void> {
  const adminId = await requireAdminUserId();
  if (!adminId) return;

  const result = await deleteWhatsAppRecipient(recipientId);
  if (!result.ok) {
    console.error("[admin] delete recipient failed:", result.error);
    return;
  }

  revalidatePath("/admin/integrations");
}