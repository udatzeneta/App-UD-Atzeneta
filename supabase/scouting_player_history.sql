-- Tabla de historial de clubes por jugador scrapeado de FFCV
-- Ejecutar en Supabase SQL Editor DESPUÉS de scouting_player_columns.sql

CREATE TABLE IF NOT EXISTS public.scouting_player_history (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scouting_id  UUID NOT NULL REFERENCES public.scouting(id) ON DELETE CASCADE,
    temporada    TEXT NOT NULL,
    equipo       TEXT NOT NULL,
    shield_url   TEXT,
    categoria    TEXT,
    created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Índice para búsquedas por jugador
CREATE INDEX IF NOT EXISTS idx_scouting_player_history_scouting_id
    ON public.scouting_player_history(scouting_id);

-- RLS: mismos permisos que scouting
ALTER TABLE public.scouting_player_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver historial scouting" ON public.scouting_player_history
    FOR SELECT USING (public.has_user_permission(auth.uid(), 'scouting', 'ver'));

CREATE POLICY "Crear historial scouting" ON public.scouting_player_history
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'scouting', 'crear'));

CREATE POLICY "Editar historial scouting" ON public.scouting_player_history
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'scouting', 'editar'));

CREATE POLICY "Eliminar historial scouting" ON public.scouting_player_history
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'scouting', 'eliminar'));
