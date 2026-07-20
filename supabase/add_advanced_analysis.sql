-- Añadir columnas para el Análisis Rival Avanzado (Versión Modular)
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS roster_comments jsonb DEFAULT '[]'::jsonb;
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS with_ball_blocks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS without_ball_blocks jsonb DEFAULT '[]'::jsonb;
ALTER TABLE opponent_analysis ADD COLUMN IF NOT EXISTS abp_blocks jsonb DEFAULT '[]'::jsonb;

-- Si se ejecutó la versión anterior, eliminar las columnas obsoletas
DO $$
BEGIN
  IF EXISTS(SELECT * FROM information_schema.columns WHERE table_name='opponent_analysis' and column_name='with_ball_board') THEN
    ALTER TABLE opponent_analysis DROP COLUMN with_ball_board;
    ALTER TABLE opponent_analysis DROP COLUMN without_ball_board;
    ALTER TABLE opponent_analysis DROP COLUMN abp_board;
    ALTER TABLE opponent_analysis DROP COLUMN with_ball_videos;
    ALTER TABLE opponent_analysis DROP COLUMN without_ball_videos;
    ALTER TABLE opponent_analysis DROP COLUMN abp_videos;
  END IF;
END $$;
