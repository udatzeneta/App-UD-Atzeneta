-- Tabla para almacenar las resoluciones y sanciones del Comité de Competición de la FFCV
CREATE TABLE IF NOT EXISTS ffcv_sanctions (
  id TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  player_name TEXT NOT NULL,
  photo_url TEXT,
  category TEXT DEFAULT 'Jugadores',
  article TEXT,
  sanction_text TEXT NOT NULL,
  matches_count INTEGER DEFAULT 1,
  resolution_date DATE NOT NULL,
  cod_licencia TEXT,
  cod_competicion TEXT,
  cod_grupo TEXT,
  season TEXT DEFAULT '2026-2027',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now())
);

-- Habilitar RLS y permitir lectura pública / autenticada
ALTER TABLE ffcv_sanctions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura de sanciones FFCV a todos" ON ffcv_sanctions;
CREATE POLICY "Permitir lectura de sanciones FFCV a todos"
  ON ffcv_sanctions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Permitir insercion y actualizacion de sanciones FFCV" ON ffcv_sanctions;
CREATE POLICY "Permitir insercion y actualizacion de sanciones FFCV"
  ON ffcv_sanctions FOR ALL
  USING (true)
  WITH CHECK (true);
