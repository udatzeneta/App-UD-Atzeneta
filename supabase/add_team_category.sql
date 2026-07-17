-- Migración para añadir soporte al equipo Juvenil (Filial)

-- 1. Añadir team_category a profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS team_category TEXT DEFAULT 'Primer Equipo' 
CHECK (team_category IN ('Primer Equipo', 'Juvenil'));

-- 2. Añadir team_category a players
ALTER TABLE public.players 
ADD COLUMN IF NOT EXISTS team_category TEXT DEFAULT 'Primer Equipo' 
CHECK (team_category IN ('Primer Equipo', 'Juvenil'));

-- 3. Añadir team_category a trainings
ALTER TABLE public.trainings 
ADD COLUMN IF NOT EXISTS team_category TEXT DEFAULT 'Primer Equipo' 
CHECK (team_category IN ('Primer Equipo', 'Juvenil'));

-- 4. Añadir team_category a matches
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS team_category TEXT DEFAULT 'Primer Equipo' 
CHECK (team_category IN ('Primer Equipo', 'Juvenil'));

-- Crear índices para mejorar el filtrado
CREATE INDEX IF NOT EXISTS idx_profiles_team ON public.profiles(team_category);
CREATE INDEX IF NOT EXISTS idx_players_team ON public.players(team_category);
CREATE INDEX IF NOT EXISTS idx_trainings_team ON public.trainings(team_category);
CREATE INDEX IF NOT EXISTS idx_matches_team ON public.matches(team_category);
