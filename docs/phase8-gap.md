# PHASE 8 GAP REPORT — Guardians & WhatsApp

Evidence-based audit of the existing repository (`D:\ai_business_ecommerce`, branch `main`, commit `49de0a7`) before Phase 8 implementation.

---

## 1. Existing

What Phase 8 functionality already exists and is production-ready / partially usable:

- **Guardian foundation interfaces** — `lib/security/guardians.ts` defines `RiskLevel` (`low|medium|high`), `GuardianContext`, `GuardianDecision`, `Guardian`, and `evaluateGuardians` (chain evaluation, highest risk + most restrictive approval wins). Covered by `tests/unit/services.test.ts`.
- **SDK-level role guardrails** — `guardians/authorization.ts` defines `checkRole`, `isAdmin`, and `toolRoleGuardrail(...)` (rejects a tool before it executes for unauthorized roles and stamps `agentName` into context). Used by all admin tools; covered by `tests/unit/ai/authorization.test.ts`.
- **Prompt-injection defense** — `guardians/prompt-injection.ts` (`classifyPromptInjection` + `rejectPromptInjectionGuardrail`) wired on both entry agents (manager + salesman). Covered by `tests/unit/ai/prompt-injection.test.ts`.
- **AI audit trail** — `services/ai/audit-service.ts` (`writeAiAuditLog`, `listAiAuditLogs`) + `ai_audit_logs` table (migration `00013`) + admin viewer (`components/chat/ai-audit-log-viewer.tsx`, `app/api/ai/audit-logs/route.ts`).
- **Tool audit wrapper** — `tools/shared/audit.ts` (`withToolAudit`, `auditToolResult`).
- **Server-side service-layer authorization** — `services/base.ts` (`assertRole`), per-service admin actor checks (`AdminActor`), role-based RLS (`public.is_admin(uid)`) across tables.
- **Notification system** — `services/notifications/notification-service.ts` with customer + admin notifications, `notifications` table + RLS (migration `00009`), admin bell + notifications page.
- **AI workforce** — Manager agent (`agents/manager.ts`), Salesman agent (`agents/salesman.ts`), employee agents (`agents/employees.ts`), conversation persistence (`00013`, `00018`), focus tracking, pending drafts.
- **Environment placeholders** — `.env.example` already lists `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (commented).

## 2. Partial

- `lib/security/guardians.ts` is only an interface foundation — **no concrete Guardian implementations, no risk-per-action policy, no permission/policy registry, no action evaluation, no approval control, and no fail-closed behavior** exist yet.
- AI audit logs (`ai_audit_logs`) record tool outcomes post-execution with status `granted|denied|error`; there is **no pre-execution decision record with ALLOW / DENY / REQUIRE_APPROVAL semantics** and no approval linkage.
- No `Guardian` layer sits between AI reasoning and privileged actions beyond the SDK role guardrail; mutation tools rely on role guardra corresponding + service `assertRole` but do **not** run a Guardian decision or approval flow.

## 3. Missing

- **Concrete Guardian engine** (risk classification per action/tool, permission policy registry, `ALLOW | DENY | REQUIRE_APPROVAL`, fail-closed on missing policy/context).
- **Approval system** — search found **zero** `approval` references in server code and **zero** approval tables/migrations. Phase 7 marketing/approval integration does not exist.
- **Guardian-decision persistence + admin visibility** (table, service, viewer).
- **WhatsApp Cloud API** — search (`whatsapp|graph.facebook|meta|facebook|instagram`) found **no** WhatsApp/Meta code anywhere outside env placeholders and marketing-copy strings.
  - Outbound service, provider config, retry policy, idempotency (message dedupe).
  - Webhook (GET verification + POST ingest), signature verification, duplicate-event prevention.
  - Approved-recipient configuration; sender/recipient identity resolution from trusted app data.
  - WhatsApp → AI (owner control channel) flow.
  - AI tool(s) `send_whatsapp_message` / report tool.
- **Notification types** for approval requests and WhatsApp failures.
- **UI**: WhatsApp connection/settings page, Guardian-decision viewer, pending-approvals surface in the AI Workplace.
- **Environment** entries for `WHATSAPP_APP_SECRET`, `WHATSAPP_API_VERSION`; test-env placeholders.
- **Tests** for the Guardian test matrix, WhatsApp test matrix, security matrix, Phase 8 regression.

## 4. Risks discovered during audit

- No pre-execution Guardian decision layer on privileged mutations; a denied/wrong action is only recorded after the fact by `ai_audit_logs`.
- No approval gating for high-risk operations (deletes, refunds, external messaging) exists anywhere.
- The system is **single-business** (no `business_id` columns / no multi-tenant tables). "Business isolation" therefore means: one owned business, admin-vs-customer role isolation, and per-user RLS — not cross-tenant columns. This must not be fabricated.
- `lib/supabase/types.ts` is not regenerated after every migration (e.g. `ai_conversations.draft` is absent from types and accessed via narrowed casts in `draft-service.ts`). New Phase 8 types must be added consistently.
- Lint baseline is **not clean before Phase 8**: 22 pre-existing errors + 46 pre-existing warnings (mostly `no-explicit-any` in old tests/files). Phase 8 must not add new lint errors.
- No real WhatsApp/Meta credentials exist in the environment; real end-to-end delivery verification is impossible (`NOT AVAILABLE`). This must not be faked.

## 5. Proposed changes (files that must be created/modified)

### New

- `supabase/migrations/00019_phase8_guardians_whatsapp.sql`
- `guardians/engine.ts` — action policies, risk classification, decision evaluation (pure, fail-closed)
- `services/ai/guardian-service.ts` — `guardian_decisions` persistence + list
- `services/ai/approval-service.ts` — approval request lifecycle + validity
- `tools/shared/guarded.ts` — Guardian + approval wrapper for AI tools
- `services/whatsapp/config.ts` — env-driven provider config + status
- `services/whatsapp/whatsapp-service.ts` — outbound send, normalize, retry classification, idempotency
- `services/whatsapp/webhook-service.ts` — payload parse, signature verify, event-id/dupe logic, business-scope check
- `services/whatsapp/whatsapp-ai-service.ts` — inbound WhatsApp → AI (authorization + manager run + reply)
- `services/whatsapp/whatsapp-reports.ts` — real business-report builders (daily sales, low stock, order summary)
- `services/whatsapp/whatsapp-recipients.ts` — approved-recipient resolution (trusted config only)
- `tools/whatsapp.ts` — `send_whatsapp_message` + `send_whatsapp_report` AI tools (guarded + approval)
- `app/api/whatsapp/webhook/route.ts` — GET verification + POST ingest
- `app/api/ai/guardian-decisions/route.ts` — admin-only Guardian decisions API
- `app/admin/integrations/page.tsx` + `actions.ts` — WhatsApp status + recipients settings
- `components/chat/guardian-decision-viewer.tsx`
- `components/chat/pending-approvals-viewer.tsx` + `app/admin/ai/approval-actions.ts` (approve/reject)
- Docs: `docs/phase8.md`, `docs/phase8-gap.md`, updated `.env.example`, `.env.test.example`
- Tests: `tests/unit/guardian/engine.test.ts`, `tests/unit/guardian/approval.test.ts`, `tests/unit/whatsapp/service.test.ts`, `tests/unit/whatsapp/webhook.test.ts`, `tests/unit/whatsapp/recipients.test.ts`, `tests/unit/ai/phase8-integration.test.ts`

### Modified

- `lib/supabase/types.ts` — add Phase 8 tables
- `agents/manager.ts` — add WhatsApp tools + instructions
- `services/notifications/notification-service.ts` — new notification types + approval/failure helpers
- `app/admin/admin-shell.tsx` — add "Integrations" nav entry
- `app/admin/ai/page.tsx` — Guardian decisions + pending approvals surfaces

### Not changed (intentionally)

- `guardians/authorization.ts`, `guardians/prompt-injection.ts`, `lib/security/guardians.ts` — reused/extended, not replaced
- Existing employee agents' tools and behavior, storefront, checkout, RLS model
- Chatbot visual language, storefront design

## 6. Migration impact

A new migration is required:

- **Why:** Phase 8 needs durable storage for Guardian decisions, approval requests, WhatsApp provider connection settings, approved recipients, outbound message status, and webhook idempotency. No equivalent tables exist.
- **Tables:** `guardian_decisions`, `approval_requests`, `whatsapp_settings`, `whatsapp_recipients`, `whatsapp_messages`, `whatsapp_webhook_events`.
- **Columns/indexes/policies:** each table gets PK, timestamps, FKs where meaningful, indexes, RLS (admins read/write via `public.is_admin(auth.uid())` policies; no anon grants; service-role used server-side), grants confined to `authenticated` + admin policy.
- **Idempotency:** webhook events use a unique `provider_event_id`; messages use a unique `idempotency_key`.
- **Secrets:** none stored in DB — only env-based provider config; `whatsapp_settings` stores display/safe identity fields only.

## 7. Environment variables

Required (placeholders only, already partly listed in `.env.example`):

- `WHATSAPP_ACCESS_TOKEN` *(server-only)*
- `WHATSAPP_PHONE_NUMBER_ID` *(server-only)*
- `WHATSAPP_WEBHOOK_VERIFY_TOKEN` *(server-only)*
- `WHATSAPP_APP_SECRET` *(server-only, enables webhook signature verification)*
- `WHATSAPP_API_VERSION` *(optional, default `v21.0`)*

No `NEXT_PUBLIC_` exposure. No values invented.