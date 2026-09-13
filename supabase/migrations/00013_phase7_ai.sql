-- Phase 7 — AI Manager + AI Employees persistence.
--
-- Adds the storage the AI workforce needs:
--   ai_audit_logs     — every AI action/Guardian decision, append-only.
--   ai_conversations  — chat threads for the admin AI Workplace and the
--                       storefront AI Salesman (per user).
--   ai_messages       — messages inside a conversation, used to rebuild
--                       Agents SDK input history across requests.
--
-- Audit logs are written through the service-role/admin client (server only);
-- only admins can read them. Chat rows are owned by the authenticated user
-- and are RLS-scoped so users can only ever see their own conversations.

-- ---------------------------------------------------------------------------
-- ai_audit_logs
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_audit_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  actor_role  text NOT NULL DEFAULT 'guest'
              CHECK (actor_role IN ('admin', 'customer', 'guest')),
  agent_name  text NOT NULL,
  tool_name   text,
  action_type text NOT NULL,
  risk        text NOT NULL CHECK (risk IN ('low', 'medium', 'high')),
  status      text NOT NULL CHECK (status IN ('granted', 'denied', 'error')),
  entity_type text,
  entity_id   text,
  detail      jsonb NOT NULL DEFAULT '{}',
  created_at  timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_audit_logs IS
  'Append-only audit trail for AI actions. Written only via the server-side service/admin client; readable by administrators. Never contains secrets or sensitive payloads.';

CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_created_at
  ON public.ai_audit_logs (created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_user_id
  ON public.ai_audit_logs (user_id);

CREATE INDEX IF NOT EXISTS idx_ai_audit_logs_agent_name
  ON public.ai_audit_logs (agent_name);

ALTER TABLE public.ai_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins can read AI audit logs"
  ON public.ai_audit_logs;

CREATE POLICY "Admins can read AI audit logs"
  ON public.ai_audit_logs
  FOR SELECT
  USING (public.is_admin(auth.uid()));

ALTER TABLE public.ai_audit_logs FORCE ROW LEVEL SECURITY;

GRANT SELECT ON public.ai_audit_logs TO authenticated;

-- ---------------------------------------------------------------------------
-- ai_conversations
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_conversations (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES auth.users (id) ON DELETE CASCADE,
  channel    text NOT NULL CHECK (channel IN ('admin', 'salesman')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_conversations IS
  'Chat threads for the AI Workplace (admin) and AI Salesman (customer).';

CREATE INDEX IF NOT EXISTS idx_ai_conversations_user_updated
  ON public.ai_conversations (user_id, updated_at DESC);

ALTER TABLE public.ai_conversations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read their own AI conversations"
  ON public.ai_conversations;

CREATE POLICY "Users can read their own AI conversations"
  ON public.ai_conversations
  FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can create their own AI conversations"
  ON public.ai_conversations;

CREATE POLICY "Users can create their own AI conversations"
  ON public.ai_conversations
  FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users can update their own AI conversations"
  ON public.ai_conversations;

CREATE POLICY "Users can update their own AI conversations"
  ON public.ai_conversations
  FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

GRANT SELECT, INSERT, UPDATE ON public.ai_conversations TO authenticated;

-- ---------------------------------------------------------------------------
-- ai_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS public.ai_messages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id uuid NOT NULL REFERENCES public.ai_conversations (id)
                  ON DELETE CASCADE,
  role            text NOT NULL CHECK (role IN ('user', 'assistant')),
  content         text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.ai_messages IS
  'Messages in an AI conversation. Used to rebuild SDK input history.';

CREATE INDEX IF NOT EXISTS idx_ai_messages_conversation_created
  ON public.ai_messages (conversation_id, created_at ASC);

ALTER TABLE public.ai_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can read messages in their own AI conversations"
  ON public.ai_messages;

CREATE POLICY "Users can read messages in their own AI conversations"
  ON public.ai_messages
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can add messages to their own AI conversations"
  ON public.ai_messages;

CREATE POLICY "Users can add messages to their own AI conversations"
  ON public.ai_messages
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.ai_conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
    )
  );

GRANT SELECT, INSERT ON public.ai_messages TO authenticated;