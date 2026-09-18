-- Phase 7+ — AI conversation pending-draft state.
--
-- A "pending draft" is a server-side object attached to a single conversation.
-- It is used whenever an agent is mid-way through collecting several pieces of
-- information across turns for ONE task (product create/edit, customer
-- checkout). It survives interruptions, lets the agent resume exactly where it
-- stopped instead of re-deriving state from raw history, and is cleared when
-- the task completes or the user explicitly cancels it ("chhod do" / "cancel").
--
-- RLS: the existing "Users can update their own AI conversations" policy and
-- the authenticated UPDATE grant already cover this column — only the row owner
-- can read or write their own conversation draft.

ALTER TABLE public.ai_conversations
  ADD COLUMN IF NOT EXISTS draft jsonb;

COMMENT ON COLUMN public.ai_conversations.draft IS
  'Server-side pending-draft object for in-progress multi-step tasks (product create/edit, customer checkout). Stored per conversation; cleared when the task completes or is cancelled.';