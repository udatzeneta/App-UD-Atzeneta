-- =====================================================================
-- TABLAS Y CONFIGURACIÓN PARA EL MÓDULO DE JUGADORES
-- =====================================================================

-- 1. Crear Tabla de Jugadores
CREATE TABLE IF NOT EXISTS public.players (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    full_name TEXT NOT NULL,
    nickname TEXT, -- Nombre futbolístico / Alias
    photo_url TEXT,
    dorsal INT,
    position TEXT, -- Portero, Lateral Derecho, Lateral Izquierdo, Defensa Central, Pivote Defensivo, Mediocentro, Interior, Extremo Derecho, Extremo Izquierdo, Mediapunta, Delantero Centro
    dominant_foot TEXT CHECK (dominant_foot IN ('Derecho', 'Izquierdo', 'Ambidiestro')),
    height INT, -- Estatura en cm
    weight NUMERIC(5, 2), -- Peso inicial/actual en kg
    birth_date DATE,
    phone TEXT,
    email TEXT,
    physio_notes TEXT,
    physical_status TEXT DEFAULT 'Disponible' CHECK (physical_status IN ('Disponible', 'Lesionado', 'En duda', 'Baja')),
    
    -- Estadísticas
    matches_played INT NOT NULL DEFAULT 0,
    minutes_played INT NOT NULL DEFAULT 0,
    goals INT NOT NULL DEFAULT 0,
    assists INT NOT NULL DEFAULT 0,
    yellow_cards INT NOT NULL DEFAULT 0,
    red_cards INT NOT NULL DEFAULT 0,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Crear Tabla de Historial de Peso
CREATE TABLE IF NOT EXISTS public.player_weights (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    weight NUMERIC(5, 2) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Crear Tabla de Historial de Fisioterapia
CREATE TABLE IF NOT EXISTS public.player_physio_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    status TEXT NOT NULL CHECK (status IN ('Disponible', 'Lesionado', 'En duda', 'Baja')),
    notes TEXT NOT NULL,
    treatment TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================================
-- PERMISOS PARA LA PÁGINA "PLAYERS"
-- =====================================================================

-- Insertar los permisos para 'players'
INSERT INTO public.permissions (page, action, description)
VALUES 
('players', 'ver', 'Permiso para ver la página de jugadores'),
('players', 'crear', 'Permiso para crear fichas de jugadores'),
('players', 'editar', 'Permiso para editar fichas de jugadores'),
('players', 'eliminar', 'Permiso para eliminar fichas de jugadores'),
('players', 'exportar', 'Permiso para exportar fichas de jugadores')
ON CONFLICT (page, action) DO NOTHING;

-- Mapear permisos por defecto a los roles
DO $$
DECLARE
    admin_role_id INT := 1;
    trainer_role_id INT := 2;
    player_role_id INT := 3;
    board_role_id INT := 4;
    perm_ver_id INT;
    perm_crear_id INT;
    perm_editar_id INT;
    perm_eliminar_id INT;
    perm_exportar_id INT;
BEGIN
    -- Obtener IDs de permisos
    SELECT id INTO perm_ver_id FROM public.permissions WHERE page = 'players' AND action = 'ver';
    SELECT id INTO perm_crear_id FROM public.permissions WHERE page = 'players' AND action = 'crear';
    SELECT id INTO perm_editar_id FROM public.permissions WHERE page = 'players' AND action = 'editar';
    SELECT id INTO perm_eliminar_id FROM public.permissions WHERE page = 'players' AND action = 'eliminar';
    SELECT id INTO perm_exportar_id FROM public.permissions WHERE page = 'players' AND action = 'exportar';

    -- A) Administrador: Todo
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES 
    (admin_role_id, perm_ver_id),
    (admin_role_id, perm_crear_id),
    (admin_role_id, perm_editar_id),
    (admin_role_id, perm_eliminar_id),
    (admin_role_id, perm_exportar_id)
    ON CONFLICT DO NOTHING;

    -- B) Entrenador: Todo
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES 
    (trainer_role_id, perm_ver_id),
    (trainer_role_id, perm_crear_id),
    (trainer_role_id, perm_editar_id),
    (trainer_role_id, perm_eliminar_id),
    (trainer_role_id, perm_exportar_id)
    ON CONFLICT DO NOTHING;

    -- C) Jugador: Solo ver
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES 
    (player_role_id, perm_ver_id)
    ON CONFLICT DO NOTHING;

    -- D) Directivo: Ver y exportar
    INSERT INTO public.role_permissions (role_id, permission_id) VALUES 
    (board_role_id, perm_ver_id),
    (board_role_id, perm_exportar_id)
    ON CONFLICT DO NOTHING;
END $$;

-- =====================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- =====================================================================

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_weights ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_physio_records ENABLE ROW LEVEL SECURITY;

-- Políticas para public.players
CREATE POLICY "Ver jugadores" ON public.players
    FOR SELECT USING (public.has_user_permission(auth.uid(), 'players', 'ver'));

CREATE POLICY "Crear jugadores" ON public.players
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'players', 'crear'));

CREATE POLICY "Editar jugadores" ON public.players
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'players', 'editar'));

CREATE POLICY "Eliminar jugadores" ON public.players
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'players', 'eliminar'));

-- Políticas para public.player_weights
-- Cualquier persona con permiso de ver 'players' puede ver los pesos
CREATE POLICY "Ver pesos" ON public.player_weights
    FOR SELECT USING (
        public.has_user_permission(auth.uid(), 'players', 'ver') AND
        (
            -- Si es entrenador o administrador ve todos. Si es jugador, solo ve el suyo.
            (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid())) != 'player'
            OR player_id IN (SELECT id FROM public.players WHERE profile_id = auth.uid())
        )
    );

CREATE POLICY "Gestionar pesos" ON public.player_weights
    FOR ALL USING (
        public.has_user_permission(auth.uid(), 'players', 'editar') OR
        -- Un jugador puede añadir/editar sus propios registros de peso si lo desea
        player_id IN (SELECT id FROM public.players WHERE profile_id = auth.uid())
    );

-- Políticas para public.player_physio_records
-- Los jugadores solo ven sus propias notas del fisio
CREATE POLICY "Ver registros fisio" ON public.player_physio_records
    FOR SELECT USING (
        public.has_user_permission(auth.uid(), 'players', 'ver') AND
        (
            (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid())) != 'player'
            OR player_id IN (SELECT id FROM public.players WHERE profile_id = auth.uid())
        )
    );

CREATE POLICY "Gestionar registros fisio" ON public.player_physio_records
    FOR ALL USING (public.has_user_permission(auth.uid(), 'players', 'editar'));
