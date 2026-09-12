-- =====================================================================
-- AÑADIR COLUMNAS DE TIEMPO DE DESCUENTO Y DURACIÓN A MATCHES
-- Ejecutar en el SQL Editor de la consola de Supabase
-- =====================================================================

ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS stoppage_first_half INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS stoppage_second_half INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS duration INT DEFAULT 90;
