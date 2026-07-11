-- Añadir campo para vincular una lesión a un partido específico
-- Esto permite que si se elimina el acta o el partido, se elimine también la lesión en cascada

ALTER TABLE public.player_injuries 
ADD COLUMN IF NOT EXISTS match_id UUID REFERENCES public.matches(id) ON DELETE CASCADE;

-- Crear un índice para optimizar las consultas por match_id
CREATE INDEX IF NOT EXISTS idx_player_injuries_match_id ON public.player_injuries(match_id);
