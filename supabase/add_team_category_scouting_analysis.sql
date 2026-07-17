-- Añadir team_category a scouting
ALTER TABLE public.scouting
ADD COLUMN IF NOT EXISTS team_category TEXT DEFAULT 'Primer Equipo' 
CHECK (team_category IN ('Primer Equipo', 'Juvenil'));

-- Añadir team_category a opponent_analysis
ALTER TABLE public.opponent_analysis
ADD COLUMN IF NOT EXISTS team_category TEXT DEFAULT 'Primer Equipo' 
CHECK (team_category IN ('Primer Equipo', 'Juvenil'));

-- Opcional: Crear un índice para optimizar búsquedas por equipo
CREATE INDEX IF NOT EXISTS idx_scouting_team ON public.scouting(team_category);
CREATE INDEX IF NOT EXISTS idx_opponent_analysis_team ON public.opponent_analysis(team_category);
