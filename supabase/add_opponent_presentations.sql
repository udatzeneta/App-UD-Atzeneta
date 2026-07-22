-- Sistemas de juego alternativos + presentaciones para el Análisis del Rival.
-- alternative_formations: campogramas alternativos al sistema principal (con label).
-- presentations: diapositivas ordenadas por bloques para reproducir a pantalla completa.
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS alternative_formations jsonb DEFAULT '[]'::jsonb;
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS presentations jsonb DEFAULT '[]'::jsonb;
