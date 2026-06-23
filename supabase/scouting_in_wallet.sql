-- Añade columna in_wallet a la tabla scouting
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.scouting
  ADD COLUMN IF NOT EXISTS in_wallet BOOLEAN DEFAULT FALSE;
