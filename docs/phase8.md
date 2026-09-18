# Phase 8 — Guardians & WhatsApp Control

## Overview

Phase 8 adds two production layers to the AI e-commerce system:

1. **Guardian security layer** — a pure, fail-closed decision core that every
   AI business action must pass through (risk classification,
   ALLOW / DENY / REQUIRE_APPROVAL), plus persisted decision records.
2. **WhatsApp Cloud API integration** — a controlled owner channel: outbound
   messaging to approved recipients, signature-verified + idempotent webhooks,
   an admin-approved recipients list, real-data business reports, and an
   AI-managed inbound workflow for approved admins only.

Nothing here grants the AI unrestricted database access. Every guarded action
goes through `runGuardedTool` → Guardian engine → service layer; and no WhatsApp
action reaches the provider unless the recipient exists in `whatsapp_recipients`.

## Database (`supabase/migrations/00019_phase8_guardians_whatsapp.sql`)

Six new tables, all admin-read only (`public.is_admin()` RLS reads, explicit
`service_role` grants for server-side writes, no anon grants, `FORCE RLS`):

- `guardian_decisions` — persisted verdicts of the Guardian engine, with
  execution lifecycle status (`pending/executed/failed/blocked/approved_pending`).
- `approval_requests` — frozen execution payload + context hash for actions that
  require a human decision. `guardian_decision_id` has an FK to
  `guardian_decisions`; the reverse link (`approval_id`) has NO FK on
  `guardian_decisions` to avoid a circular FK — documented in the migration.
- `whatsapp_settings` — single-row (`id = true` enforced) store config:
  `require_approval_for_send` + safe identity fields (no secrets ever stored).
- `whatsapp_recipients` — the trust boundary for outbound/inbound messaging.
  Unique on normalized phone; `type = admin | customer`; optional auth `user_id`.
- `whatsapp_messages` — outbound message ledger keyed by `idempotency_key`
  (unique), status lifecycle, provider ids, error codes.
- `whatsapp_webhook_events` — inbound event journal with unique
  `provider_event_id` for webhook idempotency.

## Guardian engine (`guardians/engine.ts`)

- `ACTION_POLICIES` — the policy registry. Anything not registered here is
  **DENIED** (fail-closed).
- `evaluateAiAction` — classifies risk + role + approval requirement. Unknown
  tools → DENY (high risk). Role mismatch / guest → DENY. `approval: "always"`
  or store-forced `by_exception` → REQUIRE_APPROVAL.
- WhatsApp outbound tools: `send_whatsapp_message`, `send_whatsapp_report`
  (medium risk, admin-only, approval by-exception → driven by
  `whatsapp_settings.require_approval_for_send`).

## Guarded tool wrapper (`tools/shared/guarded.ts`)

`runGuardedTool` is the keyhole every AI business action passes through:

1. Evaluate the intended action (`toolName`, actor, store flag).
2. Persist the Guardian decision (`guardian-service.ts`).
3. DENY → fail closed, executor never runs.
4. ALLOW → run now, stamp execution status.
5. REQUIRE_APPROVAL → insert a pending `approval_requests` row with a **frozen
   execution payload + context hash**, notify admins, return
   "requires approval" (nothing was executed).

Approval execution (`tools/whatsapp-approval-executor.ts`) re-validates
`validateApprovalForExecution` (approved + unexpired + context-hash match)
before running only the captured payload.

## WhatsApp stack (`services/whatsapp/`)

- `config.ts` — server-only env (`WHATSAPP_ACCESS_TOKEN`,
  `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN`,
  `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION` default `v21.0`).
- `whatsapp-service.ts` — `normalizePhone` (E.164, PK default), `sendWhatsAppText`
  with idempotency (never re-send delivered), bounded 15s timeout, retry
  classification, and **honest failure** (row marked `rejected` when not
  configured — success is never faked). `recordProviderStatus` applies status
  webhooks without downgrading.
- `webhook-service.ts` — `verifyWhatsAppSignature` (HMAC-SHA256,
  constant-time), `parseWebhookPayload` (messages + only `failed` statuses),
  `isOutOfBusinessScope`, journal with unique `provider_event_id`.
- `whatsapp-recipients.ts` — list / resolve / create / toggle / delete approved
  recipients. Resolving an arbitrary number returns null (unauthorized).
- `whatsapp-reports.ts` — `daily_sales`, `low_stock`, `orders` built from real
  service-layer data (never fabricated figures).
- `whatsapp-ai-service.ts` — inbound → AI: only **approved + active admin
  recipients linked to an auth user** are processed. Everyone else is silently
  ignored (identity gateway).
- `app/api/whatsapp/webhook/route.ts` — GET verification handshake + POST ingest
  (signature check, scope check, dedupe). Always returns 200 to Meta.

## AI integration (`agents/manager.ts`, `tools/whatsapp.ts`)

- Manager agent gains `send_whatsapp_message` and `send_whatsapp_report` tools
  and a WhatsApp operating section in `ADMIN_INSTRUCTIONS` describing the
  approval requirement and honest reporting rules.
- Both tools go through `runGuardedTool` with a frozen execution payload for the
  approval path (`approval.buildExecution` / `approval.execute`).

## Admin UI

- **Integrations** page (`app/admin/integrations/`) — approval toggle +
  safe identity settings, approved recipients management (add / toggle /
  delete). Photos/numbers never routed through client state.
- **AI Workplace** (`app/admin/ai/`) — Pending Approvals viewer (Approve &
  send / Reject), Guardian decisions viewer, and the audit log viewer; badge
  now reads "Phase 8 — Guardians + WhatsApp".
- `app/api/ai/guardian-decisions/route.ts` — admin-only read for the viewer.
- Approvals request notification type wired into the existing notification
  service (`admin_approval_requested`, `whatsapp_message_failed`).

## Security properties

- No secrets in the database or browser; env-only credentials.
- WhatsApp recipients are the outbound trust boundary — arbitrary numbers are
  rejected.
- Inbound control channel requires an approved-admin identity (recipient row +
  auth link) — untrusted senders never reach the AI or business actions.
- External content is data, not authority: prompt injection is blocked server-side
  (existing run-turn + role guardrails) and the webhook is signature-verified.
- Approval re-executes a frozen payload, not a future request; context-hash
  mismatches and expiry invalidate stale approvals.
- Fail-closed Guardian: unknown tools can never execute.

## Verification

- `npx tsc --noEmit` — passes.
- `npx vitest run` — **402 tests pass** (346 Phase-1–7 + 56 new).
- New tests: `tests/unit/guardian/engine.test.ts`,
  `tests/unit/guardian/approval.test.ts`,
  `tests/unit/whatsapp/service.test.ts`,
  `tests/unit/whatsapp/webhook.test.ts`,
  `tests/unit/ai/phase8-integration.test.ts`.
- `npx eslint .` — 22 errors / 46 warnings (unchanged pre-existing baseline;
  no new issues from Phase 8).

## Running the WhatsApp channel

Set the `WHATSAPP_*` env vars (see `.env.example`), apply migration `00019`,
add the owner as an approved recipient (Integrations page), point the WhatsApp
webhook at `/api/whatsapp/webhook` with `WHATSAPP_WEBHOOK_VERIFY_TOKEN`, and set
`WHATSAPP_APP_SECRET` to enable signature verification. Outbound messages are
sent to approved admin recipients and appear in `whatsapp_messages` with a real
provider status.