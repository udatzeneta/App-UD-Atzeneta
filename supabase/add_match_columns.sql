-- Migración para añadir nuevas columnas al Acta del Partido

ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS tactical_with_ball text,
ADD COLUMN IF NOT EXISTS tactical_without_ball text,
ADD COLUMN IF NOT EXISTS tactical_set_pieces text,
ADD COLUMN IF NOT EXISTS tactical_general text,
ADD COLUMN IF NOT EXISTS opponent_events jsonb DEFAULT '{"goals": [], "yellow_cards": []}'::jsonb;

-- Notificar a la API de Supabase para que recargue el esquema y detecte las columnas
NOTIFY pgrst, 'reload schema';
