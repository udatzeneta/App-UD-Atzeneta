-- =====================================================================
-- FIX RLS POLICIES FOR TRAINING ATTENDANCE AND MATCH STATS (INTENT)
-- =====================================================================

-- 1. Limpieza de políticas anteriores
DROP POLICY IF EXISTS "Jugador ve su asistencia" ON public.training_attendance;
DROP POLICY IF EXISTS "Jugador gestiona su asistencia en entrenamientos" ON public.training_attendance;
DROP POLICY IF EXISTS "Jugador gestiona su asistencia en partidos" ON public.player_match_stats;

-- 2. Permitir a los jugadores ver y gestionar su propia asistencia a entrenamientos
-- Usamos public.current_player_id() (SECURITY DEFINER) para evitar problemas de permisos sobre la tabla players
CREATE POLICY "Jugador gestiona su asistencia en entrenamientos"
  ON public.training_attendance
  FOR ALL
  TO authenticated
  USING (player_id = public.current_player_id())
  WITH CHECK (player_id = public.current_player_id());

-- 3. Permitir a los jugadores gestionar sus propias estadísticas e intenciones en partidos
CREATE POLICY "Jugador gestiona su asistencia en partidos"
  ON public.player_match_stats
  FOR ALL
  TO authenticated
  USING (player_id = public.current_player_id())
  WITH CHECK (player_id = public.current_player_id());
