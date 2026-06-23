-- Añade columnas de acta y rendimiento a la tabla matches
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS tactical_system TEXT,
  ADD COLUMN IF NOT EXISTS team_positive_aspects TEXT,
  ADD COLUMN IF NOT EXISTS team_improve_aspects TEXT,
  ADD COLUMN IF NOT EXISTS callup_time TEXT,
  ADD COLUMN IF NOT EXISTS callup_location TEXT,
  ADD COLUMN IF NOT EXISTS kit_shirt_color TEXT,
  ADD COLUMN IF NOT EXISTS kit_shorts_color TEXT,
  ADD COLUMN IF NOT EXISTS kit_socks_color TEXT;
