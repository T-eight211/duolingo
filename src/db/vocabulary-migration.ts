// Additive, repeatable setup for existing installations; never resets course data.
export const vocabularyMigration = `
CREATE TABLE IF NOT EXISTS public.user_vocabulary (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id text NOT NULL REFERENCES public.user_progress(user_id) ON DELETE CASCADE,
  course_id integer NOT NULL REFERENCES public.courses(id) ON DELETE CASCADE,
  kind text NOT NULL,
  arabic text NOT NULL,
  arabic_diacritized text NOT NULL,
  english text NOT NULL,
  original_arabic text,
  original_english text,
  corrections jsonb NOT NULL DEFAULT '[]'::jsonb,
  needs_review boolean NOT NULL DEFAULT false,
  review_reason text,
  normalized_key text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT user_vocabulary_pair_unique UNIQUE (user_id, course_id, kind, normalized_key),
  CONSTRAINT user_vocabulary_owner_id_unique UNIQUE (id, user_id, course_id),
  CONSTRAINT user_vocabulary_kind_check CHECK (kind IN ('word', 'phrase', 'sentence')),
  CONSTRAINT user_vocabulary_text_check CHECK (length(trim(arabic)) > 0 AND length(trim(arabic_diacritized)) > 0 AND length(trim(english)) > 0)
);
CREATE INDEX IF NOT EXISTS user_vocabulary_course_idx ON public.user_vocabulary(course_id);
ALTER TABLE public.user_vocabulary ADD COLUMN IF NOT EXISTS part_of_speech text;
ALTER TABLE public.user_vocabulary ADD COLUMN IF NOT EXISTS grammar jsonb;
CREATE INDEX IF NOT EXISTS user_vocabulary_pos_idx ON public.user_vocabulary(course_id, part_of_speech);
CREATE TABLE IF NOT EXISTS public.user_vocabulary_links (
  user_id text NOT NULL,
  course_id integer NOT NULL,
  source_id uuid NOT NULL,
  word_id uuid NOT NULL,
  CONSTRAINT user_vocabulary_links_pk PRIMARY KEY (user_id, course_id, source_id, word_id),
  CONSTRAINT user_vocabulary_links_source_fk FOREIGN KEY (source_id, user_id, course_id)
    REFERENCES public.user_vocabulary(id, user_id, course_id) ON DELETE CASCADE,
  CONSTRAINT user_vocabulary_links_word_fk FOREIGN KEY (word_id, user_id, course_id)
    REFERENCES public.user_vocabulary(id, user_id, course_id) ON DELETE CASCADE,
  CONSTRAINT user_vocabulary_links_distinct_check CHECK (source_id <> word_id)
);
CREATE INDEX IF NOT EXISTS user_vocabulary_links_word_idx ON public.user_vocabulary_links(user_id, course_id, word_id);
ALTER TABLE public.user_vocabulary ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_vocabulary_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.user_vocabulary, public.user_vocabulary_links FROM PUBLIC;
DO $$
DECLARE api_role text;
BEGIN
  FOREACH api_role IN ARRAY ARRAY['anon', 'authenticated'] LOOP
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = api_role) THEN
      EXECUTE format('REVOKE ALL ON public.user_vocabulary, public.user_vocabulary_links FROM %I', api_role);
    END IF;
  END LOOP;
END $$;
`;
