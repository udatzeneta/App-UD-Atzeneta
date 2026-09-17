import { createClient } from '@supabase/supabase-js';

if (typeof window === 'undefined' && !(globalThis as any).WebSocket) {
  try {
    (globalThis as any).WebSocket = require('ws');
  } catch (e) {}
}

const envVars = (typeof import.meta !== 'undefined' && import.meta.env) ? import.meta.env : (process.env || {});

const supabaseUrl = envVars.VITE_SUPABASE_URL || 'https://your-project-id.supabase.co';
const supabaseAnonKey = envVars.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder-anon-key';

export const isMockMode = 
  !envVars.VITE_SUPABASE_URL || 
  envVars.VITE_SUPABASE_URL === 'https://your-project-id.supabase.co' ||
  !envVars.VITE_SUPABASE_ANON_KEY;

if (isMockMode) {
  console.warn(
    '⚠️ UD Atzeneta ERP: Corriendo en Modo Demostración (Mock Mode). Para conectar con tu base de datos de Supabase real, configura VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY en un archivo .env'
  );
}

export const supabase = createClient(
  supabaseUrl,
  supabaseAnonKey,
  typeof window === 'undefined' ? { auth: { persistSession: false } } : undefined
);


