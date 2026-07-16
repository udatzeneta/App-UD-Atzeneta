-- Allow players to insert and update their own attendance for trainings
CREATE POLICY "Jugador gestiona su asistencia en entrenamientos"
  ON public.training_attendance
  FOR ALL
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    player_id IN (
      SELECT id FROM public.players WHERE profile_id = auth.uid()
    )
  );

-- Allow players to insert and update their own attendance for matches
CREATE POLICY "Jugador gestiona su asistencia en partidos"
  ON public.player_match_stats
  FOR ALL
  TO authenticated
  USING (
    player_id IN (
      SELECT id FROM public.players WHERE profile_id = auth.uid()
    )
  )
  WITH CHECK (
    player_id IN (
      SELECT id FROM public.players WHERE profile_id = auth.uid()
    )
  );
