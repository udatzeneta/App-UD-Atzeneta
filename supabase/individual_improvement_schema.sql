-- =====================================================================
-- MÓDULO "MEJORA INDIVIDUAL" (Individual Improvement)
-- Autoevaluación del jugador por partido + análisis de jugadas,
-- chat con el entrenador, objetivos, notificaciones e historial.
--
-- Convenciones seguidas del proyecto:
--   * Roles: admin(1), trainer(2), player(3), board(4)
--   * players.profile_id -> profiles.id (= auth.uid())
--   * RLS: el jugador solo ve/edita LO SUYO; staff (admin/trainer) ve todo
--   * Página/permiso: pageKey = 'individual_improvement'
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. HELPERS DE SEGURIDAD (reutilizables en las policies)
-- ---------------------------------------------------------------------

-- Devuelve el player.id ligado al usuario autenticado (o NULL si no es jugador)
CREATE OR REPLACE FUNCTION public.current_player_id()
RETURNS uuid AS $$
    SELECT p.id
    FROM public.players p
    WHERE p.profile_id = auth.uid()
    LIMIT 1;
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- TRUE si el usuario autenticado es cuerpo técnico (admin o entrenador)
CREATE OR REPLACE FUNCTION public.is_ii_staff()
RETURNS boolean AS $$
    SELECT EXISTS (
        SELECT 1 FROM public.profiles pr
        WHERE pr.id = auth.uid() AND pr.role_id IN (1, 2)
    );
$$ LANGUAGE sql STABLE SECURITY DEFINER;


-- ---------------------------------------------------------------------
-- 1. ANÁLISIS POR PARTIDO (cabecera + cuestionario de autoevaluación)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.improvement_analyses (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id     UUID NOT NULL REFERENCES public.players(id)  ON DELETE CASCADE,
    match_id      UUID NOT NULL REFERENCES public.matches(id)  ON DELETE CASCADE,
    season        TEXT,                    -- Ej: '2026/27' (derivado de la fecha del partido)

    -- Estado del flujo del análisis
    status        TEXT NOT NULL DEFAULT 'Borrador'
                  CHECK (status IN ('Borrador','Enviado','Revisado','Comentado','Finalizado')),

    -- Cuestionario de autoevaluación (1-10)
    rating_match         INT CHECK (rating_match         BETWEEN 1 AND 10),
    rating_physical      INT CHECK (rating_physical      BETWEEN 1 AND 10),
    rating_mental        INT CHECK (rating_mental        BETWEEN 1 AND 10),
    rating_concentration INT CHECK (rating_concentration BETWEEN 1 AND 10),
    rating_communication INT CHECK (rating_communication BETWEEN 1 AND 10),

    -- Texto libre del cuestionario
    did_well      TEXT,   -- ¿Qué crees que hiciste mejor?
    to_improve    TEXT,   -- ¿Qué crees que debes mejorar?
    next_goal     TEXT,   -- Objetivo para el siguiente partido

    -- Valoración del entrenador (para comparar percepción jugador vs. técnico)
    coach_rating  INT CHECK (coach_rating BETWEEN 1 AND 10),

    -- Métricas de uso
    time_spent_seconds INT NOT NULL DEFAULT 0,   -- tiempo medio empleado (estadísticas)
    submitted_at  TIMESTAMPTZ,                   -- cuándo pasó a 'Enviado'
    reviewed_at   TIMESTAMPTZ,                   -- cuándo el entrenador lo revisó

    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Un jugador solo puede tener un análisis por partido
    UNIQUE (player_id, match_id)
);

CREATE INDEX IF NOT EXISTS idx_ii_analyses_player ON public.improvement_analyses(player_id);
CREATE INDEX IF NOT EXISTS idx_ii_analyses_match  ON public.improvement_analyses(match_id);
CREATE INDEX IF NOT EXISTS idx_ii_analyses_status ON public.improvement_analyses(status);


-- ---------------------------------------------------------------------
-- 2. ACCIONES / JUGADAS ANALIZADAS
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.improvement_actions (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    analysis_id   UUID NOT NULL REFERENCES public.improvement_analyses(id) ON DELETE CASCADE,

    minute        INT,
    half          TEXT CHECK (half IN ('Primera parte','Segunda parte','Prórroga')),
    action_type   TEXT CHECK (action_type IN
                  ('Ataque','Defensa','Transición','ABP','Duelo','Pase',
                   'Finalización','Presión','Cobertura','Otro')),
    result        TEXT CHECK (result IN ('Positivo','Negativo','Mejorable')),

    description   TEXT,   -- Qué ocurrió

    -- Reflexión guiada
    reflection_why        TEXT,  -- ¿Por qué tomaste esa decisión?
    reflection_options    TEXT,  -- ¿Qué opciones tenías?
    reflection_keep_same  TEXT,  -- ¿Qué volverías a hacer igual?
    reflection_change     TEXT,  -- ¿Qué cambiarías?
    reflection_learning   TEXT,  -- ¿Qué aprendizaje sacas?

    emotional_state TEXT,  -- '😀 Seguro', '😐 Normal', '😟 Nervioso', '😤 Frustrado', '😎 Muy confiado'
    importance      TEXT CHECK (importance IN ('Alta','Media','Baja')) DEFAULT 'Media',

    -- Enlace a clip de vídeo (stub, listo para el futuro módulo de vídeo)
    video_url        TEXT,
    video_timestamp  NUMERIC,   -- segundo dentro del clip

    sort_order    INT NOT NULL DEFAULT 0,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ii_actions_analysis ON public.improvement_actions(analysis_id);


-- ---------------------------------------------------------------------
-- 3. EVIDENCIAS (imágenes / capturas / anotaciones por acción)
--    Los archivos se suben a Supabase Storage; aquí guardamos la URL.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.improvement_evidence (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id   UUID NOT NULL REFERENCES public.improvement_actions(id) ON DELETE CASCADE,
    type        TEXT NOT NULL CHECK (type IN ('image','screenshot','annotation','video')),
    url         TEXT NOT NULL,
    caption     TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ii_evidence_action ON public.improvement_evidence(action_id);


-- ---------------------------------------------------------------------
-- 4. CHAT POR ACCIÓN (jugador <-> entrenador, en tiempo real vía Realtime)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.improvement_messages (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_id   UUID NOT NULL REFERENCES public.improvement_actions(id) ON DELETE CASCADE,
    sender_id   UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    body        TEXT NOT NULL,
    read_at     TIMESTAMPTZ,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ii_messages_action ON public.improvement_messages(action_id);


-- ---------------------------------------------------------------------
-- 5. OBJETIVOS DE MEJORA (los asigna el entrenador al jugador)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.improvement_objectives (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id   UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    created_by  UUID REFERENCES public.profiles(id) ON DELETE SET NULL,  -- entrenador
    title       TEXT NOT NULL,             -- "Escanear antes de recibir"
    description TEXT,
    target_date DATE,
    progress    INT NOT NULL DEFAULT 0 CHECK (progress BETWEEN 0 AND 100),
    status      TEXT NOT NULL DEFAULT 'Activo'
                CHECK (status IN ('Activo','En progreso','Cumplido','Descartado')),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ii_objectives_player ON public.improvement_objectives(player_id);


-- ---------------------------------------------------------------------
-- 6. NOTIFICACIONES (jugador <-> entrenador)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.improvement_notifications (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    actor_id     UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    type         TEXT NOT NULL CHECK (type IN
                 ('analysis_submitted','coach_replied','objective_assigned','analysis_reviewed')),
    analysis_id  UUID REFERENCES public.improvement_analyses(id) ON DELETE CASCADE,
    action_id    UUID REFERENCES public.improvement_actions(id) ON DELETE CASCADE,
    message      TEXT,
    read_at      TIMESTAMPTZ,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ii_notifs_recipient ON public.improvement_notifications(recipient_id, read_at);


-- =====================================================================
-- 7. ROW LEVEL SECURITY
--    Jugador: solo SUS filas.  Staff (admin/trainer): todo.
-- =====================================================================
ALTER TABLE public.improvement_analyses      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_actions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_evidence      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_messages      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_objectives    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.improvement_notifications ENABLE ROW LEVEL SECURITY;

-- ---- 7.1 improvement_analyses ----
DROP POLICY IF EXISTS ii_analyses_select ON public.improvement_analyses;
CREATE POLICY ii_analyses_select ON public.improvement_analyses FOR SELECT
    USING (public.is_ii_staff() OR player_id = public.current_player_id());

DROP POLICY IF EXISTS ii_analyses_write ON public.improvement_analyses;
CREATE POLICY ii_analyses_write ON public.improvement_analyses FOR ALL
    USING (public.is_ii_staff() OR player_id = public.current_player_id())
    WITH CHECK (public.is_ii_staff() OR player_id = public.current_player_id());

-- ---- 7.2 improvement_actions (heredan del análisis dueño) ----
DROP POLICY IF EXISTS ii_actions_all ON public.improvement_actions;
CREATE POLICY ii_actions_all ON public.improvement_actions FOR ALL
    USING (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_analyses a
            WHERE a.id = analysis_id AND a.player_id = public.current_player_id()
        )
    )
    WITH CHECK (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_analyses a
            WHERE a.id = analysis_id AND a.player_id = public.current_player_id()
        )
    );

-- ---- 7.3 improvement_evidence (heredan de la acción -> análisis) ----
DROP POLICY IF EXISTS ii_evidence_all ON public.improvement_evidence;
CREATE POLICY ii_evidence_all ON public.improvement_evidence FOR ALL
    USING (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_actions ac
            JOIN public.improvement_analyses a ON a.id = ac.analysis_id
            WHERE ac.id = action_id AND a.player_id = public.current_player_id()
        )
    )
    WITH CHECK (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_actions ac
            JOIN public.improvement_analyses a ON a.id = ac.analysis_id
            WHERE ac.id = action_id AND a.player_id = public.current_player_id()
        )
    );

-- ---- 7.4 improvement_messages ----
-- Leer: staff, o el jugador dueño de la acción. Escribir: staff o el jugador dueño,
-- y siempre como uno mismo (sender_id = auth.uid()).
DROP POLICY IF EXISTS ii_messages_select ON public.improvement_messages;
CREATE POLICY ii_messages_select ON public.improvement_messages FOR SELECT
    USING (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_actions ac
            JOIN public.improvement_analyses a ON a.id = ac.analysis_id
            WHERE ac.id = action_id AND a.player_id = public.current_player_id()
        )
    );

DROP POLICY IF EXISTS ii_messages_insert ON public.improvement_messages;
CREATE POLICY ii_messages_insert ON public.improvement_messages FOR INSERT
    WITH CHECK (
        sender_id = auth.uid() AND (
            public.is_ii_staff() OR EXISTS (
                SELECT 1 FROM public.improvement_actions ac
                JOIN public.improvement_analyses a ON a.id = ac.analysis_id
                WHERE ac.id = action_id AND a.player_id = public.current_player_id()
            )
        )
    );

DROP POLICY IF EXISTS ii_messages_update ON public.improvement_messages;
CREATE POLICY ii_messages_update ON public.improvement_messages FOR UPDATE
    USING (
        public.is_ii_staff() OR EXISTS (
            SELECT 1 FROM public.improvement_actions ac
            JOIN public.improvement_analyses a ON a.id = ac.analysis_id
            WHERE ac.id = action_id AND a.player_id = public.current_player_id()
        )
    );

-- ---- 7.5 improvement_objectives ----
-- Jugador: solo lectura de los suyos. Staff: control total.
DROP POLICY IF EXISTS ii_objectives_select ON public.improvement_objectives;
CREATE POLICY ii_objectives_select ON public.improvement_objectives FOR SELECT
    USING (public.is_ii_staff() OR player_id = public.current_player_id());

DROP POLICY IF EXISTS ii_objectives_write ON public.improvement_objectives;
CREATE POLICY ii_objectives_write ON public.improvement_objectives FOR ALL
    USING (public.is_ii_staff())
    WITH CHECK (public.is_ii_staff());

-- ---- 7.6 improvement_notifications (cada uno ve/gestiona las suyas) ----
DROP POLICY IF EXISTS ii_notifs_select ON public.improvement_notifications;
CREATE POLICY ii_notifs_select ON public.improvement_notifications FOR SELECT
    USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS ii_notifs_update ON public.improvement_notifications;
CREATE POLICY ii_notifs_update ON public.improvement_notifications FOR UPDATE
    USING (recipient_id = auth.uid());

DROP POLICY IF EXISTS ii_notifs_insert ON public.improvement_notifications;
CREATE POLICY ii_notifs_insert ON public.improvement_notifications FOR INSERT
    WITH CHECK (true);  -- las crean triggers/servicio; el SELECT ya restringe la lectura


-- =====================================================================
-- 8. REALTIME (chat + notificaciones sin refrescar)
-- =====================================================================
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.improvement_messages;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.improvement_notifications;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;


-- =====================================================================
-- 9. PERMISOS DE LA PÁGINA 'individual_improvement'
-- =====================================================================
INSERT INTO public.permissions (page, action, description) VALUES
  ('individual_improvement', 'ver',      'Ver el módulo de Mejora Individual'),
  ('individual_improvement', 'crear',    'Crear análisis en Mejora Individual'),
  ('individual_improvement', 'editar',   'Editar análisis en Mejora Individual'),
  ('individual_improvement', 'eliminar', 'Eliminar análisis en Mejora Individual'),
  ('individual_improvement', 'exportar', 'Exportar en Mejora Individual')
ON CONFLICT DO NOTHING;

-- Admin (1) y Entrenador (2): todos los permisos
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 1, id FROM public.permissions WHERE page = 'individual_improvement'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 2, id FROM public.permissions WHERE page = 'individual_improvement'
ON CONFLICT DO NOTHING;

-- Jugador (3): ver + crear + editar (para hacer su propia autoevaluación)
INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 3, id FROM public.permissions
WHERE page = 'individual_improvement' AND action IN ('ver','crear','editar')
ON CONFLICT DO NOTHING;

-- Directivo (4): sin acceso por defecto (módulo privado jugador/técnico)
