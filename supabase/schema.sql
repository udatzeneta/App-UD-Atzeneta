-- =====================================================================
-- ESQUEMA DE BASE DE DATOS DE UD ATZENETA ERP
-- =====================================================================

-- 1. TABLA DE ROLES
CREATE TABLE IF NOT EXISTS public.roles (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE
);

-- Insertar roles por defecto
INSERT INTO public.roles (id, name, slug) VALUES
(1, 'Administrador', 'admin'),
(2, 'Entrenador', 'trainer'),
(3, 'Jugador', 'player'),
(4, 'Directivo', 'board')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, slug = EXCLUDED.slug;

-- 2. TABLA DE PERFILES
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY, -- Se vincula a auth.users.id
    email TEXT,
    full_name TEXT NOT NULL,
    role_id INT REFERENCES public.roles(id) DEFAULT 3,
    avatar_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE PERMISOS (Página + Acción)
CREATE TABLE IF NOT EXISTS public.permissions (
    id SERIAL PRIMARY KEY,
    page TEXT NOT NULL,
    action TEXT NOT NULL,
    description TEXT,
    UNIQUE (page, action)
);

-- Insertar todos los permisos posibles para las páginas principales
-- Acciones: 'ver', 'crear', 'editar', 'eliminar', 'exportar'
DO $$
DECLARE
    pages TEXT[] := ARRAY['dashboard', 'calendar', 'trainings', 'matches', 'fines', 'points', 'scouting', 'opponent_analysis', 'settings', 'permissions', 'attendance'];
    actions TEXT[] := ARRAY['ver', 'crear', 'editar', 'eliminar', 'exportar'];
    p TEXT;
    a TEXT;
BEGIN
    FOREACH p IN ARRAY pages LOOP
        FOREACH a IN ARRAY actions LOOP
            INSERT INTO public.permissions (page, action, description)
            VALUES (p, a, 'Permiso para ' || a || ' en la página ' || p)
            ON CONFLICT (page, action) DO NOTHING;
        END LOOP;
    END LOOP;
END $$;

-- 4. TABLA DE RELACIÓN ROL-PERMISOS (Permisos por defecto de cada rol)
CREATE TABLE IF NOT EXISTS public.role_permissions (
    role_id INT REFERENCES public.roles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES public.permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- 5. TABLA DE PERMISOS INDIVIDUALES DE USUARIO (Prioridad sobre el Rol)
CREATE TABLE IF NOT EXISTS public.user_permissions (
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    permission_id INT REFERENCES public.permissions(id) ON DELETE CASCADE,
    allowed BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (user_id, permission_id)
);

-- Semillar permisos de roles por defecto
DO $$
DECLARE
    admin_id INT := 1;
    trainer_id INT := 2;
    player_id INT := 3;
    board_id INT := 4;
    perm RECORD;
BEGIN
    -- Limpiar mapeos previos para evitar duplicados
    DELETE FROM public.role_permissions;

    -- A) El Administrador tiene acceso total a TODO
    FOR perm IN SELECT id FROM public.permissions LOOP
        INSERT INTO public.role_permissions (role_id, permission_id) VALUES (admin_id, perm.id);
    END LOOP;

    -- B) Entrenador (Acceso total excepto a la gestión de permisos individuales)
    FOR perm IN SELECT id, page, action FROM public.permissions 
        WHERE page != 'permissions' LOOP
        INSERT INTO public.role_permissions (role_id, permission_id) VALUES (trainer_id, perm.id);
    END LOOP;

    -- C) Jugador (Acceso limitado a solo lectura en entrenamientos/partidos, multas/puntos propios, sin scouting, etc.)
    FOR perm IN SELECT id FROM public.permissions 
        WHERE (page = 'dashboard' AND action = 'ver')
           OR (page = 'calendar' AND action = 'ver')
           OR (page = 'trainings' AND action = 'ver')
           OR (page = 'matches' AND action = 'ver')
           OR (page = 'fines' AND action = 'ver')
           OR (page = 'points' AND action = 'ver')
           OR (page = 'attendance' AND action = 'ver') LOOP
        INSERT INTO public.role_permissions (role_id, permission_id) VALUES (player_id, perm.id);
    END LOOP;

    -- D) Directivo (Solo lectura general en todo, incluido scouting y análisis de rival, pero sin permisos de escritura ni settings)
    FOR perm IN SELECT id FROM public.permissions 
        WHERE (action = 'ver' OR action = 'exportar') 
          AND page NOT IN ('permissions', 'settings') LOOP
        INSERT INTO public.role_permissions (role_id, permission_id) VALUES (board_id, perm.id);
    END LOOP;
END $$;

-- 6. FUNCIÓN DE COMPROBACIÓN DE PERMISOS DINÁMICOS
CREATE OR REPLACE FUNCTION public.has_user_permission(user_uuid uuid, page_name text, action_name text)
RETURNS boolean AS $$
DECLARE
    is_allowed boolean;
    user_role_id int;
BEGIN
    -- 1. Comprobar si hay un override específico para el usuario
    SELECT up.allowed INTO is_allowed
    FROM public.user_permissions up
    JOIN public.permissions p ON up.permission_id = p.id
    WHERE up.user_id = user_uuid AND p.page = page_name AND p.action = action_name;

    IF is_allowed IS NOT NULL THEN
        RETURN is_allowed;
    END IF;

    -- 2. Si no hay override, obtener el rol del perfil del usuario
    SELECT role_id INTO user_role_id FROM public.profiles WHERE id = user_uuid;
    
    IF user_role_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- 3. Comprobar si el rol del usuario tiene el permiso asignado
    SELECT EXISTS (
        SELECT 1 
        FROM public.role_permissions rp
        JOIN public.permissions p ON rp.permission_id = p.id
        WHERE rp.role_id = user_role_id AND p.page = page_name AND p.action = action_name
    ) INTO is_allowed;

    RETURN COALESCE(is_allowed, false);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. TABLA DE ENTRENAMIENTOS
CREATE TABLE IF NOT EXISTS public.trainings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    time TIME NOT NULL,
    location TEXT NOT NULL,
    duration INT NOT NULL, -- en minutos
    objective TEXT,
    observations TEXT,
    status TEXT NOT NULL DEFAULT 'Programado' CHECK (status IN ('Programado', 'Realizado', 'Cancelado')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. TABLA DE PARTIDOS
CREATE TABLE IF NOT EXISTS public.matches (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    rival TEXT NOT NULL,
    is_local BOOLEAN NOT NULL DEFAULT TRUE,
    competition TEXT NOT NULL DEFAULT 'Liga' CHECK (competition IN ('Liga', 'Copa', 'Amistoso', 'Promoción')),
    score_us INT,
    score_them INT,
    status TEXT NOT NULL DEFAULT 'Programado' CHECK (status IN ('Programado', 'Jugado', 'Suspendido')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. TABLA DE MULTAS
CREATE TABLE IF NOT EXISTS public.fines (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT NOT NULL,
    amount NUMERIC(10, 2) NOT NULL,
    status TEXT NOT NULL DEFAULT 'Pendiente' CHECK (status IN ('Pendiente', 'Pagado')),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. TABLA DE PUNTOS
CREATE TABLE IF NOT EXISTS public.points (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    reason TEXT NOT NULL,
    points INT NOT NULL, -- Puede ser positivo o negativo
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. TABLA DE SCOUTING (JUGADORES OBSERVADOS)
CREATE TABLE IF NOT EXISTS public.scouting (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_name TEXT NOT NULL,
    team TEXT NOT NULL,
    age INT,
    position TEXT NOT NULL,
    rating INT NOT NULL CHECK (rating >= 1 AND rating <= 5),
    notes TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. TABLA DE ANÁLISIS DE RIVALES
CREATE TABLE IF NOT EXISTS public.opponent_analysis (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    opponent TEXT NOT NULL UNIQUE,
    tactical_system TEXT NOT NULL,
    strengths TEXT[] DEFAULT '{}',
    weaknesses TEXT[] DEFAULT '{}',
    key_players TEXT[] DEFAULT '{}',
    observations TEXT,
    created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. TABLA DE CONFIGURACIÓN DEL CLUB
CREATE TABLE IF NOT EXISTS public.settings (
    id INT PRIMARY KEY DEFAULT 1 CHECK (id = 1),
    club_name TEXT NOT NULL DEFAULT 'UD Atzeneta',
    logo_url TEXT,
    season TEXT NOT NULL DEFAULT '2025/2026',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insertar configuración inicial
INSERT INTO public.settings (id, club_name, season)
VALUES (1, 'UD Atzeneta', '2025/2026')
ON CONFLICT (id) DO NOTHING;

-- 13b. TABLA DE ASISTENCIA A ENTRENAMIENTOS
CREATE TABLE IF NOT EXISTS public.training_attendance (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    training_id UUID NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    status TEXT NOT NULL CHECK (status IN ('Entrena', 'A', 'ED', 'L', 'E', 'P', 'LJ', 'V', 'AA', 'AO', 'D')),
    observations TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (training_id, user_id)
);


-- 14. TRIGGER PARA CREACIÓN AUTOMÁTICA DE PERFIL
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
    INSERT INTO public.profiles (id, email, full_name, role_id)
    VALUES (
        new.id,
        new.email,
        COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
        3 -- Rol por defecto: Jugador (ID 3)
    );
    RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comprobar si el trigger ya existe antes de crearlo
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
-- Nota: En un entorno de Supabase real, este trigger se asocia a auth.users. 
-- Descomentar la siguiente línea en la consola de Supabase:
-- CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();


-- =====================================================================
-- POLÍTICAS DE SEGURIDAD RLS (ROW LEVEL SECURITY)
-- =====================================================================

-- Habilitar RLS en todas las tablas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.trainings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scouting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.opponent_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- A) POLÍTICAS PARA PROFILES
CREATE POLICY "Permitir lectura general de perfiles" ON public.profiles
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Permitir actualización de perfil propio" ON public.profiles
    FOR UPDATE USING (auth.uid() = id);

-- B) POLÍTICAS PARA TRAININGS
CREATE POLICY "Ver entrenamientos" ON public.trainings
    FOR SELECT USING (public.has_user_permission(auth.uid(), 'trainings', 'ver'));

CREATE POLICY "Crear entrenamientos" ON public.trainings
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'trainings', 'crear'));

CREATE POLICY "Editar entrenamientos" ON public.trainings
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'trainings', 'editar'));

CREATE POLICY "Eliminar entrenamientos" ON public.trainings
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'trainings', 'eliminar'));

-- C) POLÍTICAS PARA MATCHES
CREATE POLICY "Ver partidos" ON public.matches
    FOR SELECT USING (public.has_user_permission(auth.uid(), 'matches', 'ver'));

CREATE POLICY "Crear partidos" ON public.matches
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'matches', 'crear'));

CREATE POLICY "Editar partidos" ON public.matches
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'matches', 'editar'));

CREATE POLICY "Eliminar partidos" ON public.matches
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'matches', 'eliminar'));

-- D) POLÍTICAS PARA FINES (MULTAS)
-- Los jugadores solo pueden ver sus propias multas, los demás roles ven todas según permiso
CREATE POLICY "Ver multas" ON public.fines
    FOR SELECT USING (
        public.has_user_permission(auth.uid(), 'fines', 'ver') AND 
        (
            -- Si es jugador, solo ve las suyas
            (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid())) != 'player'
            OR user_id = auth.uid()
        )
    );

CREATE POLICY "Crear multas" ON public.fines
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'fines', 'crear'));

CREATE POLICY "Editar multas" ON public.fines
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'fines', 'editar'));

CREATE POLICY "Eliminar multas" ON public.fines
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'fines', 'eliminar'));

-- E) POLÍTICAS PARA POINTS (PUNTOS)
-- Similar a multas
CREATE POLICY "Ver puntos" ON public.points
    FOR SELECT USING (
        public.has_user_permission(auth.uid(), 'points', 'ver') AND 
        (
            (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid())) != 'player'
            OR user_id = auth.uid()
        )
    );

CREATE POLICY "Crear puntos" ON public.points
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'points', 'crear'));

CREATE POLICY "Editar puntos" ON public.points
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'points', 'editar'));

CREATE POLICY "Eliminar puntos" ON public.points
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'points', 'eliminar'));

-- F) POLÍTICAS PARA SCOUTING
CREATE POLICY "Ver scouting" ON public.scouting
    FOR SELECT USING (public.has_user_permission(auth.uid(), 'scouting', 'ver'));

CREATE POLICY "Crear scouting" ON public.scouting
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'scouting', 'crear'));

CREATE POLICY "Editar scouting" ON public.scouting
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'scouting', 'editar'));

CREATE POLICY "Eliminar scouting" ON public.scouting
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'scouting', 'eliminar'));

-- G) POLÍTICAS PARA OPPONENT ANALYSIS
CREATE POLICY "Ver análisis rivales" ON public.opponent_analysis
    FOR SELECT USING (public.has_user_permission(auth.uid(), 'opponent_analysis', 'ver'));

CREATE POLICY "Crear análisis rivales" ON public.opponent_analysis
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'opponent_analysis', 'crear'));

CREATE POLICY "Editar análisis rivales" ON public.opponent_analysis
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'opponent_analysis', 'editar'));

CREATE POLICY "Eliminar análisis rivales" ON public.opponent_analysis
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'opponent_analysis', 'eliminar'));

-- H) POLÍTICAS PARA SETTINGS, ROLE_PERMISSIONS Y USER_PERMISSIONS
CREATE POLICY "Ver configuracion" ON public.settings
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editar configuracion" ON public.settings
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'settings', 'editar'));

CREATE POLICY "Ver permisos de roles" ON public.role_permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editar permisos de roles" ON public.role_permissions
    FOR ALL USING (public.has_user_permission(auth.uid(), 'permissions', 'editar'));

CREATE POLICY "Ver permisos individuales" ON public.user_permissions
    FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "Editar permisos individuales" ON public.user_permissions
    FOR ALL USING (public.has_user_permission(auth.uid(), 'permissions', 'editar'));

-- I) POLÍTICAS PARA TRAINING_ATTENDANCE
CREATE POLICY "Ver asistencia" ON public.training_attendance
    FOR SELECT USING (
        public.has_user_permission(auth.uid(), 'attendance', 'ver') AND 
        (
            (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid())) != 'player'
            OR user_id = auth.uid()
        )
    );

CREATE POLICY "Crear asistencia" ON public.training_attendance
    FOR INSERT WITH CHECK (public.has_user_permission(auth.uid(), 'attendance', 'crear'));

CREATE POLICY "Editar asistencia" ON public.training_attendance
    FOR UPDATE USING (public.has_user_permission(auth.uid(), 'attendance', 'editar'));

CREATE POLICY "Eliminar asistencia" ON public.training_attendance
    FOR DELETE USING (public.has_user_permission(auth.uid(), 'attendance', 'eliminar'));
