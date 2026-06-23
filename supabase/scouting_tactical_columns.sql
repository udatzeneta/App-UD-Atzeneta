-- Añade columnas tácticas a la tabla scouting
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.scouting
  ADD COLUMN IF NOT EXISTS x INT,
  ADD COLUMN IF NOT EXISTS y INT,
  ADD COLUMN IF NOT EXISTS alternative_positions TEXT,
  ADD COLUMN IF NOT EXISTS comment TEXT,
  ADD COLUMN IF NOT EXISTS in_wallet BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS phone TEXT;
