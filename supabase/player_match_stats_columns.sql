-- Añade columnas de rendimiento individual a la tabla player_match_stats
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.player_match_stats
  ADD COLUMN IF NOT EXISTS is_starter BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS position TEXT,
  ADD COLUMN IF NOT EXISTS conceded_goals INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS own_goals INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS positive_aspects TEXT,
  ADD COLUMN IF NOT EXISTS improve_aspects TEXT,
  ADD COLUMN IF NOT EXISTS event_minutes JSONB;
