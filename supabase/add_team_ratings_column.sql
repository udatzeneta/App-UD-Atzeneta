-- Migración para añadir sistema de valoraciones (1-5 estrellas) al acta de partidos

ALTER TABLE matches
ADD COLUMN IF NOT EXISTS team_ratings JSONB DEFAULT '{}'::jsonb;
