import { createClient } from '@supabase/supabase-js';

// Si no existen credenciales de Supabase en el .env, usamos URLs de placeholder y activamos el modo Mock
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key';

export const isMockMode = 
  !import.meta.env.VITE_SUPABASE_URL || 
  import.meta.env.VITE_SUPABASE_URL === 'https://your-project-id.supabase.co' ||
  !import.meta.env.VITE_SUPABASE_ANON_KEY;

if (isMockMode) {
  console.warn(
    '⚠️ UD Atzeneta ERP: Corriendo en Modo Demostración (Mock Mode). Para conectar con tu base de datos de Supabase real, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en un archivo .env'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
