-- Tabla de lesiones de jugadores
CREATE TABLE IF NOT EXISTS public.player_injuries (
    id UUID DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
    body_zone TEXT NOT NULL,
    body_side TEXT NOT NULL CHECK (body_side IN ('frontal', 'posterior')),
    severity TEXT NOT NULL CHECK (severity IN ('Leve', 'Moderada', 'Grave')),
    status TEXT NOT NULL CHECK (status IN ('Activa', 'En tratamiento', 'Recuperado', 'Baja')),
    diagnosis TEXT NOT NULL,
    treatment TEXT,
    injury_date DATE NOT NULL,
    estimated_return DATE,
    actual_return DATE,
    follow_up_notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Políticas de RLS
ALTER TABLE public.player_injuries ENABLE ROW LEVEL SECURITY;

-- Política de lectura: cualquier usuario logueado puede ver las lesiones
CREATE POLICY "Enable read access for authenticated users on player_injuries" 
ON public.player_injuries 
FOR SELECT 
TO authenticated 
USING (true);

-- Política de inserción
CREATE POLICY "Enable insert for authenticated users on player_injuries" 
ON public.player_injuries 
FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Política de actualización
CREATE POLICY "Enable update for authenticated users on player_injuries" 
ON public.player_injuries 
FOR UPDATE 
TO authenticated 
USING (true);

-- Política de borrado
CREATE POLICY "Enable delete for authenticated users on player_injuries" 
ON public.player_injuries 
FOR DELETE 
TO authenticated 
USING (true);
