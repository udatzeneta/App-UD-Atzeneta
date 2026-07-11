-- =====================================================================
-- AÑADIR COLUMNAS PARA ACTA Y RENDIMIENTO DE PARTIDO
-- Ejecutar en el SQL Editor de tu consola de Supabase
-- =====================================================================

-- 1. Campos cualitativos del equipo en la tabla matches
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS team_positive_aspects TEXT,
  ADD COLUMN IF NOT EXISTS team_improve_aspects TEXT;

-- 2. Campos cualitativos del jugador y JSON de minutos de eventos en player_match_stats
ALTER TABLE public.player_match_stats
  ADD COLUMN IF NOT EXISTS positive_aspects TEXT,
  ADD COLUMN IF NOT EXISTS improve_aspects TEXT,
  ADD COLUMN IF NOT EXISTS comments TEXT,
  ADD COLUMN IF NOT EXISTS substituted_for UUID REFERENCES public.players(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS substituted_minute INTEGER,
  ADD COLUMN IF NOT EXISTS event_minutes JSONB DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS conceded_goals INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS own_goals INTEGER DEFAULT 0;

-- Comentario explicativo:
-- 'event_minutes' guardará un objeto JSON con la estructura:
-- {
--   "goals": [31],
--   "assists": [48],
--   "yellow_cards": [62],
--   "red_card": null,
--   "conceded_goals": [75],
--   "own_goals": [89]
-- }
