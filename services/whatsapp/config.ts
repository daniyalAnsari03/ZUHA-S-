/**
 * WhatsApp Cloud API configuration.
 *
 * All provider secrets come from server-only environment variables and are
 * NEVER exposed to the browser or stored in the database. See .env.example.
 */

export type WhatsappConfig = {
  /** Whether all webhook configuration (token, phone id, app secret) is set. */
  isConfigured: boolean;
  /** Whether outbound API calls can be attempted (token + phone id present). */
  isApiConfigured: boolean;
  /** Whether webhook payload signature verification is enabled (app secret). */
  signatureVerificationEnabled: boolean;
  accessToken: string | null;
  phoneNumberId: string | null;
  verifyToken: string | null;
  appSecret: string | null;
  apiVersion: string;
};

const DEFAULT_API_VERSION = "v21.0";

export function env(env: Record<string, string | undefined>): WhatsappConfig {
  const accessToken = env.WHATSAPP_ACCESS_TOKEN ?? null;
  const phoneNumberId = env.WHATSAPP_PHONE_NUMBER_ID ?? null;
  const verifyToken = env.WHATSAPP_WEBHOOK_VERIFY_TOKEN ?? null;
  const appSecret = env.WHATSAPP_APP_SECRET ?? null;
  const apiVersion =
    env.WHATSAPP_API_VERSION?.trim() || DEFAULT_API_VERSION;

  return {
    isConfigured: Boolean(accessToken && phoneNumberId && verifyToken),
    isApiConfigured: Boolean(accessToken && phoneNumberId),
    signatureVerificationEnabled: Boolean(appSecret),
    accessToken,
    phoneNumberId,
    verifyToken,
    appSecret,
    apiVersion,
  };
}

/** WhatsApp configuration from the current server process environment. */
export function getWhatsappConfig(): WhatsappConfig {
  return env(process.env);
}

/** Graph API message endpoint for the configured phone number. */
export function messageEndpoint(config: WhatsappConfig): string | null {
  if (!config.isApiConfigured) return null;
  return `https://graph.facebook.com/${config.apiVersion}/${config.phoneNumberId}/messages`;
}