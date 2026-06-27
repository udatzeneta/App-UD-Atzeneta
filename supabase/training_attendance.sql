-- ============================================================
-- RECREAR TABLA: training_attendance con player_id
-- Elimina la versión antigua (user_id) y crea la nueva
-- ============================================================

-- 1. Eliminar políticas antiguas que puedan existir
DROP POLICY IF EXISTS "Ver asistencia"     ON public.training_attendance;
DROP POLICY IF EXISTS "Crear asistencia"   ON public.training_attendance;
DROP POLICY IF EXISTS "Editar asistencia"  ON public.training_attendance;
DROP POLICY IF EXISTS "Eliminar asistencia" ON public.training_attendance;
DROP POLICY IF EXISTS "Acceso autenticado a asistencia" ON public.training_attendance;

-- 2. Eliminar tabla antigua (con user_id) y recrear con player_id
DROP TABLE IF EXISTS public.training_attendance CASCADE;

CREATE TABLE public.training_attendance (
  id          uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  training_id uuid        NOT NULL REFERENCES public.trainings(id) ON DELETE CASCADE,
  player_id   uuid        NOT NULL REFERENCES public.players(id)   ON DELETE CASCADE,
  status      text        NOT NULL DEFAULT 'ENT',
  observations text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now(),

  UNIQUE (training_id, player_id)
);

-- 3. Índices
CREATE INDEX IF NOT EXISTS idx_training_attendance_training_id ON public.training_attendance(training_id);
CREATE INDEX IF NOT EXISTS idx_training_attendance_player_id   ON public.training_attendance(player_id);

-- 4. Trigger updated_at
CREATE OR REPLACE FUNCTION update_training_attendance_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_training_attendance_updated_at ON public.training_attendance;
CREATE TRIGGER trg_training_attendance_updated_at
  BEFORE UPDATE ON public.training_attendance
  FOR EACH ROW EXECUTE FUNCTION update_training_attendance_updated_at();

-- 5. RLS
ALTER TABLE public.training_attendance ENABLE ROW LEVEL SECURITY;

-- Admins y entrenadores pueden gestionar todo
CREATE POLICY "Gestionar asistencia (admin/trainer)"
  ON public.training_attendance
  FOR ALL
  TO authenticated
  USING (
    (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid()))
    IN ('admin', 'trainer')
  )
  WITH CHECK (
    (SELECT slug FROM public.roles WHERE id = (SELECT role_id FROM public.profiles WHERE id = auth.uid()))
    IN ('admin', 'trainer')
  );

-- Jugadores pueden ver su propia asistencia
CREATE POLICY "Jugador ve su asistencia"
  ON public.training_attendance
  FOR SELECT
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE profile_id = auth.uid()
    )
  );
