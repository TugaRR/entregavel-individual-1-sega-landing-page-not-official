CREATE TABLE public.chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  visitor_id uuid NOT NULL,
  message_id text NOT NULL,
  role text NOT NULL,
  parts jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (visitor_id, message_id)
);
CREATE INDEX chat_messages_visitor_idx ON public.chat_messages (visitor_id, created_at);
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;