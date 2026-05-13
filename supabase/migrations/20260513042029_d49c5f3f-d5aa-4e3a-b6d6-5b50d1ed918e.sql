CREATE TABLE public.admin_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  password text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read admin credentials"
ON public.admin_credentials FOR SELECT
USING (true);

INSERT INTO public.admin_credentials (username, password) VALUES ('administrator', 'Tony95');