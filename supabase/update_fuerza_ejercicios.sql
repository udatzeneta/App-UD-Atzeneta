-- Este script añade los nuevos campos requeridos a la tabla ejercicios_fuerza
-- Puedes ejecutar esto directamente en el SQL Editor de tu proyecto en Supabase.

ALTER TABLE public.ejercicios_fuerza
ADD COLUMN IF NOT EXISTS imagen_url TEXT,
ADD COLUMN IF NOT EXISTS zona TEXT CHECK (zona IN ('anterior', 'posterior', 'ambos')),
ADD COLUMN IF NOT EXISTS tren TEXT CHECK (tren IN ('superior', 'inferior', 'full_body')),
ADD COLUMN IF NOT EXISTS patron TEXT CHECK (patron IN ('empuje', 'tiron', 'mixto', 'ninguno'));

-- Update existing rows with defaults if necessary (optional)
UPDATE public.ejercicios_fuerza
SET 
  zona = 'ambos',
  tren = 'full_body',
  patron = 'ninguno'
WHERE zona IS NULL;
