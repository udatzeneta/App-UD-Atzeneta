-- 1. TABLA GPS RECORDS
CREATE TABLE IF NOT EXISTS public.gps_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    jugador_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
    session_id UUID NOT NULL, -- Puede referenciar a un training_id o match_id
    session_type TEXT NOT NULL CHECK (session_type IN ('entrenamiento', 'partido')),
    distancia_total NUMERIC,
    velocidad_maxima NUMERIC,
    sprints INT,
    hsr NUMERIC,
    distancia_alta_intensidad NUMERIC,
    aceleraciones INT,
    deceleraciones INT,
    distancia_por_minuto NUMERIC,
    equilibrio_pasos NUMERIC,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. TABLA DE SESIONES DE FUERZA
CREATE TABLE IF NOT EXISTS public.fuerza_sesiones (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    plantilla TEXT NOT NULL DEFAULT 'primer_equipo',
    tipo TEXT NOT NULL DEFAULT 'repeticiones' CHECK (tipo IN ('tabata', 'repeticiones')),
    fecha DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. TABLA DE CATÁLOGO DE EJERCICIOS DE FUERZA
CREATE TABLE IF NOT EXISTS public.ejercicios_fuerza (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre TEXT NOT NULL,
    grupos TEXT[] DEFAULT '{}',
    otroTexto TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. TABLA INTERMEDIA SESION -> EJERCICIOS
CREATE TABLE IF NOT EXISTS public.fuerza_sesion_ejercicios (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sesion_id UUID NOT NULL REFERENCES public.fuerza_sesiones(id) ON DELETE CASCADE,
    ejercicio_id UUID NOT NULL REFERENCES public.ejercicios_fuerza(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.gps_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuerza_sesiones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ejercicios_fuerza ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fuerza_sesion_ejercicios ENABLE ROW LEVEL SECURITY;

-- Limpiar políticas anteriores si existían (por si acaso)
DROP POLICY IF EXISTS "Ver PF" ON public.gps_records;
DROP POLICY IF EXISTS "Crear PF" ON public.gps_records;
DROP POLICY IF EXISTS "Ver PF Fuerza" ON public.fuerza_sesiones;
DROP POLICY IF EXISTS "Crear PF Fuerza" ON public.fuerza_sesiones;
DROP POLICY IF EXISTS "Ver PF Ejercicios" ON public.ejercicios_fuerza;
DROP POLICY IF EXISTS "Crear PF Ejercicios" ON public.ejercicios_fuerza;
DROP POLICY IF EXISTS "Ver PF Relacion" ON public.fuerza_sesion_ejercicios;
DROP POLICY IF EXISTS "Crear PF Relacion" ON public.fuerza_sesion_ejercicios;

-- Políticas de lectura (para todos los que tengan permiso de 'pf' 'ver')
CREATE POLICY "Ver PF" ON public.gps_records FOR SELECT USING (public.has_user_permission(auth.uid(), 'pf', 'ver'));
CREATE POLICY "Ver PF Fuerza" ON public.fuerza_sesiones FOR SELECT USING (public.has_user_permission(auth.uid(), 'pf', 'ver'));
CREATE POLICY "Ver PF Ejercicios" ON public.ejercicios_fuerza FOR SELECT USING (public.has_user_permission(auth.uid(), 'pf', 'ver'));
CREATE POLICY "Ver PF Relacion" ON public.fuerza_sesion_ejercicios FOR SELECT USING (public.has_user_permission(auth.uid(), 'pf', 'ver'));

-- Políticas de escritura (para todos los que tengan permiso de 'pf' 'editar')
CREATE POLICY "Crear PF" ON public.gps_records FOR ALL USING (public.has_user_permission(auth.uid(), 'pf', 'editar')) WITH CHECK (public.has_user_permission(auth.uid(), 'pf', 'editar'));
CREATE POLICY "Crear PF Fuerza" ON public.fuerza_sesiones FOR ALL USING (public.has_user_permission(auth.uid(), 'pf', 'editar')) WITH CHECK (public.has_user_permission(auth.uid(), 'pf', 'editar'));
CREATE POLICY "Crear PF Ejercicios" ON public.ejercicios_fuerza FOR ALL USING (public.has_user_permission(auth.uid(), 'pf', 'editar')) WITH CHECK (public.has_user_permission(auth.uid(), 'pf', 'editar'));
CREATE POLICY "Crear PF Relacion" ON public.fuerza_sesion_ejercicios FOR ALL USING (public.has_user_permission(auth.uid(), 'pf', 'editar')) WITH CHECK (public.has_user_permission(auth.uid(), 'pf', 'editar'));
