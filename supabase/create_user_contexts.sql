-- Crear tabla de contextos secundarios por usuario
CREATE TABLE IF NOT EXISTS public.user_contexts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES public.profiles(id) ON DELETE CASCADE,
    role_id INT REFERENCES public.roles(id),
    team_category TEXT CHECK (team_category IN ('Primer Equipo', 'Juvenil')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(user_id, role_id, team_category)
);

-- Habilitar RLS (si el resto de tablas lo tienen)
ALTER TABLE public.user_contexts ENABLE ROW LEVEL SECURITY;

-- Por ahora, permitir lectura a todos los usuarios autenticados
CREATE POLICY "user_contexts_select_policy" 
ON public.user_contexts FOR SELECT 
TO authenticated 
USING (true);

-- Permitir escritura solo al admin (role_id = 1) - simplificado para propósitos prácticos
CREATE POLICY "user_contexts_admin_policy"
ON public.user_contexts FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.profiles
    WHERE profiles.id = auth.uid() AND profiles.role_id = 1
  )
);
