CREATE TABLE public.datasets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  tag TEXT NOT NULL DEFAULT 'Uncategorized',
  row_count INTEGER NOT NULL DEFAULT 0,
  columns JSONB NOT NULL DEFAULT '[]'::jsonb,
  original_path TEXT,
  working_path TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.datasets TO authenticated;
GRANT ALL ON public.datasets TO service_role;
ALTER TABLE public.datasets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own datasets" ON public.datasets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.basket_items (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  dataset_id UUID NOT NULL REFERENCES public.datasets(id) ON DELETE CASCADE,
  row_key TEXT NOT NULL,
  row_data JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (dataset_id, row_key)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.basket_items TO authenticated;
GRANT ALL ON public.basket_items TO service_role;
ALTER TABLE public.basket_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own basket" ON public.basket_items FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.export_presets (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  name TEXT NOT NULL,
  config JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.export_presets TO authenticated;
GRANT ALL ON public.export_presets TO service_role;
ALTER TABLE public.export_presets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own presets" ON public.export_presets FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.touch_updated_at() RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$ LANGUAGE plpgsql SET search_path = public;
CREATE TRIGGER datasets_touch BEFORE UPDATE ON public.datasets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE POLICY "own files read" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files update" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "own files delete" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'datasets' AND (storage.foldername(name))[1] = auth.uid()::text);