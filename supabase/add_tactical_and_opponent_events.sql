-- =====================================================================
-- AÑADIR COLUMNAS TÁCTICAS Y DE EVENTOS DEL RIVAL AL ACTA DE PARTIDO
-- Ejecutar en el SQL Editor de tu consola de Supabase
-- =====================================================================

-- Añadir columnas a la tabla matches para el análisis táctico y eventos del rival
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tactical_with_ball TEXT,
  ADD COLUMN IF NOT EXISTS tactical_without_ball TEXT,
  ADD COLUMN IF NOT EXISTS tactical_set_pieces TEXT,
  ADD COLUMN IF NOT EXISTS tactical_general TEXT,
  ADD COLUMN IF NOT EXISTS opponent_events JSONB DEFAULT '{"goals": [], "yellow_cards": [], "red_cards": []}'::jsonb;
