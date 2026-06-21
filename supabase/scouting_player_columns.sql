-- Añade columnas de métricas FFCV a la tabla scouting
-- Ejecutar en Supabase SQL Editor

ALTER TABLE public.scouting
  ADD COLUMN IF NOT EXISTS season         TEXT,
  ADD COLUMN IF NOT EXISTS competition    TEXT,
  ADD COLUMN IF NOT EXISTS dorsal         INT,
  ADD COLUMN IF NOT EXISTS convocados     INT,
  ADD COLUMN IF NOT EXISTS jugados        INT,
  ADD COLUMN IF NOT EXISTS titular        INT,
  ADD COLUMN IF NOT EXISTS suplente       INT,
  ADD COLUMN IF NOT EXISTS goles          INT,
  ADD COLUMN IF NOT EXISTS media_goles    NUMERIC(5,2),
  ADD COLUMN IF NOT EXISTS amarillas      INT,
  ADD COLUMN IF NOT EXISTS doble_amarilla INT,
  ADD COLUMN IF NOT EXISTS rojas          INT,
  ADD COLUMN IF NOT EXISTS tarjeta_verde  INT,
  ADD COLUMN IF NOT EXISTS participacion  TEXT,
  ADD COLUMN IF NOT EXISTS titularidad    TEXT,
  ADD COLUMN IF NOT EXISTS disciplina     TEXT,
  ADD COLUMN IF NOT EXISTS goles_partido  NUMERIC(5,2);

-- Columna para la foto del jugador (URL en Supabase Storage)
ALTER TABLE public.scouting
  ADD COLUMN IF NOT EXISTS photo_url TEXT;
