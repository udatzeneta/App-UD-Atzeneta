-- =====================================================================
-- RPCs para el flujo de registro de Jugador: buscar y confirmar vínculo
-- con su ficha oficial sin depender de RLS (el usuario aún no tiene
-- permisos sobre la tabla `players` en el momento del registro).
-- =====================================================================

-- Requiere pg_trgm (función similarity()) y unaccent (para tildes)
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 1. Buscar el jugador más parecido por nombre (solo lectura, no vincula nada).
--    Callable por cualquier usuario autenticado (justo tras el signUp).
CREATE OR REPLACE FUNCTION public.find_matching_player(p_full_name TEXT)
RETURNS TABLE (id UUID, full_name TEXT, photo_url TEXT, similarity NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  input_norm TEXT := lower(trim(unaccent(p_full_name)));
BEGIN
  RETURN QUERY
  SELECT
    p.id,
    p.full_name,
    p.photo_url,
    (similarity(input_norm, lower(trim(unaccent(p.full_name)))) * 100)::numeric AS similarity
  FROM public.players p
  WHERE p.profile_id IS NULL
  ORDER BY similarity(input_norm, lower(trim(unaccent(p.full_name)))) DESC
  LIMIT 1;
END;
$$;

GRANT EXECUTE ON FUNCTION public.find_matching_player(TEXT) TO authenticated;

-- 2. Vincular explícitamente un jugador ya confirmado por el propio usuario.
--    Solo permite vincular la propia cuenta (auth.uid()) y solo si la ficha
--    de jugador todavía no está vinculada a nadie más.
CREATE OR REPLACE FUNCTION public.link_player_to_own_profile(p_player_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_player RECORD;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'No autenticado.';
  END IF;

  SELECT id, full_name, photo_url, profile_id INTO v_player
  FROM public.players
  WHERE id = p_player_id;

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF v_player.profile_id IS NOT NULL AND v_player.profile_id <> auth.uid() THEN
    RAISE EXCEPTION 'Esta ficha de jugador ya está vinculada a otra cuenta.';
  END IF;

  UPDATE public.players SET profile_id = auth.uid() WHERE id = p_player_id;

  UPDATE public.profiles
  SET full_name = v_player.full_name,
      avatar_url = COALESCE(v_player.photo_url, avatar_url)
  WHERE id = auth.uid();

  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_player_to_own_profile(UUID) TO authenticated;
