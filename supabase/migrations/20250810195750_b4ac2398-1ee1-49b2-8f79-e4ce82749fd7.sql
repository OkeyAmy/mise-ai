-- Create chat_sessions table for saving chat history per user
CREATE TABLE IF NOT EXISTS public.chat_sessions (
  user_id uuid PRIMARY KEY,
  messages jsonb NOT NULL DEFAULT '[]'::jsonb,
  thought_steps jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.chat_sessions ENABLE ROW LEVEL SECURITY;

-- Conditionally create policies if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'chat_sessions' AND policyname = 'Users can view their own chat session'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can view their own chat session" ON public.chat_sessions FOR SELECT USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'chat_sessions' AND policyname = 'Users can upsert their own chat session'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can upsert their own chat session" ON public.chat_sessions FOR INSERT WITH CHECK (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'chat_sessions' AND policyname = 'Users can update their own chat session'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can update their own chat session" ON public.chat_sessions FOR UPDATE USING (auth.uid() = user_id)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE schemaname = 'public' AND tablename = 'chat_sessions' AND policyname = 'Users can delete their own chat session'
  ) THEN
    EXECUTE 'CREATE POLICY "Users can delete their own chat session" ON public.chat_sessions FOR DELETE USING (auth.uid() = user_id)';
  END IF;
END$$;

-- Trigger to keep updated_at fresh
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'trg_update_chat_sessions_updated_at'
  ) THEN
    CREATE TRIGGER trg_update_chat_sessions_updated_at
    BEFORE UPDATE ON public.chat_sessions
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END $$;