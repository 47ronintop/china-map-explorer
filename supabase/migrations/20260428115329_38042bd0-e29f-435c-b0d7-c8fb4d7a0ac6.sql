
-- Scenes table
CREATE TABLE public.scenes (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  image_url TEXT NOT NULL,
  panorama_url TEXT,
  lng DOUBLE PRECISION NOT NULL,
  lat DOUBLE PRECISION NOT NULL,
  location_name TEXT NOT NULL,
  year INTEGER NOT NULL,
  era TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.scenes ENABLE ROW LEVEL SECURITY;

-- Public can read
CREATE POLICY "Anyone can view scenes"
  ON public.scenes FOR SELECT
  USING (true);

-- Admin gate handled on client (hardcoded password per user request).
-- Open write policies; acknowledged as demo-level security.
CREATE POLICY "Anyone can insert scenes"
  ON public.scenes FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Anyone can update scenes"
  ON public.scenes FOR UPDATE
  USING (true);

CREATE POLICY "Anyone can delete scenes"
  ON public.scenes FOR DELETE
  USING (true);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER scenes_set_updated_at
  BEFORE UPDATE ON public.scenes
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Storage bucket (public) for scene images + panoramas
INSERT INTO storage.buckets (id, name, public)
VALUES ('scene-assets', 'scene-assets', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public read scene-assets"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'scene-assets');

CREATE POLICY "Anyone can upload scene-assets"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'scene-assets');

CREATE POLICY "Anyone can update scene-assets"
  ON storage.objects FOR UPDATE
  USING (bucket_id = 'scene-assets');

CREATE POLICY "Anyone can delete scene-assets"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'scene-assets');
