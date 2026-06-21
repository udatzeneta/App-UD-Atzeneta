-- Añadir campos de convocatoria y equipación a la tabla matches si no existen
ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS callup_time TEXT,
  ADD COLUMN IF NOT EXISTS callup_location TEXT,
  ADD COLUMN IF NOT EXISTS kit_shirt_color TEXT,
  ADD COLUMN IF NOT EXISTS kit_shorts_color TEXT,
  ADD COLUMN IF NOT EXISTS kit_socks_color TEXT,
  ADD COLUMN IF NOT EXISTS tactical_system TEXT;

-- Crear la tabla de convocatorias y estadísticas de jugadores por partido (player_match_stats)
CREATE TABLE IF NOT EXISTS public.player_match_stats (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
    is_called_up BOOLEAN DEFAULT false,
    position TEXT,
    is_starter BOOLEAN DEFAULT true,
    substituted_for UUID REFERENCES public.players(id),
    substituted_minute INTEGER,
    minutes_played INTEGER DEFAULT 0,
    goals INTEGER DEFAULT 0,
    assists INTEGER DEFAULT 0,
    yellow_cards INTEGER DEFAULT 0,
    red_card BOOLEAN DEFAULT false,
    rating INTEGER DEFAULT 0,
    comments TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()),
    UNIQUE(player_id, match_id)
);

-- Habilitar RLS en player_match_stats
ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

-- Políticas de lectura/escritura (por defecto permitir lectura autenticada y escritura completa a roles admin)
CREATE POLICY "Permitir lectura a todos los usuarios autenticados"
    ON public.player_match_stats FOR SELECT
    TO authenticated
    USING (true);

CREATE POLICY "Permitir gestión a administradores y entrenadores"
    ON public.player_match_stats FOR ALL
    TO authenticated
    USING (
        EXISTS (
            SELECT 1 FROM public.profiles 
            WHERE profiles.id = auth.uid() 
            AND profiles.role_id IN (1, 2)
        )
    );
