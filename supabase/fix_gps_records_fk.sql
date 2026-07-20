-- Arreglar Foreign Key de gps_records para que apunte a players en lugar de profiles
ALTER TABLE public.gps_records DROP CONSTRAINT IF EXISTS gps_records_jugador_id_fkey;
ALTER TABLE public.gps_records ADD CONSTRAINT gps_records_jugador_id_fkey FOREIGN KEY (jugador_id) REFERENCES public.players(id) ON DELETE CASCADE;

-- Asegurar políticas RLS para gps_records
DROP POLICY IF EXISTS "Crear PF" ON public.gps_records;
CREATE POLICY "Crear PF" ON public.gps_records 
FOR ALL 
USING (public.has_user_permission(auth.uid(), 'pf', 'editar')) 
WITH CHECK (public.has_user_permission(auth.uid(), 'pf', 'editar'));
