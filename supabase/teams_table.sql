-- =====================================================================
-- TABLA DE EQUIPOS (teams)
-- Scrapada de FFCV clasificaciones - temporada 2025-2026
-- Ejecutar en la consola SQL de Supabase antes de correr sync_teams_supabase.cjs
-- =====================================================================

CREATE TABLE IF NOT EXISTS public.teams (
    id               UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
    ffcv_cod         TEXT    NOT NULL,            -- código interno FFCV del equipo
    name             TEXT    NOT NULL,            -- nombre completo del equipo
    shield_url       TEXT,                        -- URL del escudo/logo
    competition      TEXT    NOT NULL,            -- nombre de la competición
    cod_competicion  TEXT,                        -- valor del select de competición
    cod_grupo        TEXT    NOT NULL,            -- código del grupo dentro de la competición
    season           TEXT    NOT NULL DEFAULT '2025-2026',
    -- Detalle de la ficha del equipo (scrapeado de equipo.php)
    club             TEXT,                        -- nombre del club
    campo            TEXT,                        -- campo de juego
    web              TEXT,                        -- web del club
    email            TEXT,                        -- email de contacto
    telefono         TEXT,                        -- teléfono de contacto
    horario          TEXT,                        -- horario habitual (ej: "Sábado · 15:00")
    staff_tecnicos   TEXT[]  DEFAULT '{}',        -- lista de técnicos
    staff_auxiliares TEXT[]  DEFAULT '{}',        -- lista de auxiliares
    created_at       TIMESTAMPTZ DEFAULT NOW(),
    updated_at       TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (ffcv_cod, cod_grupo)                  -- un equipo una vez por grupo
);

-- Migración: añadir columnas de detalle si la tabla ya existe
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS club             TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS campo            TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS web              TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS email            TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS telefono         TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS horario          TEXT;
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS staff_tecnicos   TEXT[] DEFAULT '{}';
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS staff_auxiliares TEXT[] DEFAULT '{}';

-- Índices útiles para búsquedas
CREATE INDEX IF NOT EXISTS teams_name_idx        ON public.teams (name);
CREATE INDEX IF NOT EXISTS teams_ffcv_cod_idx    ON public.teams (ffcv_cod);
CREATE INDEX IF NOT EXISTS teams_competition_idx ON public.teams (competition);

-- RLS
ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Ver equipos" ON public.teams;
CREATE POLICY "Ver equipos" ON public.teams
    FOR SELECT USING (auth.uid() IS NOT NULL);
