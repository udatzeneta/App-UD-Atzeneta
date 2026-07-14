-- Función segura para obtener los usuarios (solo Admin)
CREATE OR REPLACE FUNCTION admin_get_users()
RETURNS TABLE (
  id uuid,
  email text,
  full_name text,
  role_id integer,
  created_at timestamptz
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
  user_meta jsonb;
BEGIN
  -- Intentar verificar si es administrador a través de la tabla profiles
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role_id = 1
  ) INTO is_admin;

  -- Si no está en profiles, verificar a través de los metadatos de auth.users
  IF NOT is_admin THEN
    SELECT raw_user_meta_data INTO user_meta FROM auth.users WHERE auth.users.id = auth.uid();
    IF user_meta IS NOT NULL AND user_meta->>'role_id' IS NOT NULL AND user_meta->>'role_id' != '' THEN
      BEGIN
        IF (user_meta->>'role_id')::integer = 1 THEN
          is_admin := true;
        END IF;
      EXCEPTION WHEN OTHERS THEN
        is_admin := false;
      END;
    END IF;
  END IF;

  -- Si después de todo sigue sin ser admin, denegar (o si auth.uid() es nulo)
  IF NOT is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden obtener la lista de usuarios.';
  END IF;

  -- Retornar la lista segura, manejando errores de casteo en metadatos para el resto de usuarios
  RETURN QUERY
  SELECT 
    au.id, 
    au.email::text, 
    COALESCE(p.full_name, au.raw_user_meta_data->>'full_name', 'Usuario Desconocido') as full_name, 
    COALESCE(
      p.role_id, 
      CASE 
        WHEN au.raw_user_meta_data->>'role_id' ~ '^[0-9]+$' THEN (au.raw_user_meta_data->>'role_id')::integer 
        ELSE 3 
      END
    ) as role_id, 
    au.created_at
  FROM auth.users au
  LEFT JOIN public.profiles p ON p.id = au.id
  ORDER BY 3 ASC;
END;
$$;

-- Función para actualizar un usuario (email y datos de perfil)
CREATE OR REPLACE FUNCTION admin_update_user(
  target_id uuid,
  new_email text,
  new_full_name text,
  new_role_id integer
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role_id = 1
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden modificar usuarios.';
  END IF;

  -- Actualizar en auth.users
  UPDATE auth.users
  SET 
    email = new_email, 
    email_confirmed_at = now(),
    raw_user_meta_data = jsonb_set(
      jsonb_set(COALESCE(raw_user_meta_data, '{}'::jsonb), '{full_name}', to_jsonb(new_full_name)),
      '{role_id}', to_jsonb(new_role_id)
    )
  WHERE id = target_id;

  -- Actualizar en public.profiles (si no existe, lo creamos)
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = target_id) THEN
    UPDATE public.profiles
    SET full_name = new_full_name, role_id = new_role_id
    WHERE id = target_id;
  ELSE
    INSERT INTO public.profiles (id, email, full_name, role_id)
    VALUES (target_id, new_email, new_full_name, new_role_id);
  END IF;

  RETURN json_build_object('success', true);
END;
$$;

-- Función para eliminar un usuario completamente
CREATE OR REPLACE FUNCTION admin_delete_user(
  target_id uuid
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean := false;
BEGIN
  SELECT EXISTS(
    SELECT 1 FROM public.profiles WHERE public.profiles.id = auth.uid() AND public.profiles.role_id = 1
  ) INTO is_admin;

  IF NOT is_admin THEN
    RAISE EXCEPTION 'Acceso denegado. Solo administradores pueden eliminar usuarios.';
  END IF;

  -- Eliminar de auth.users (la FK con DELETE SET NULL o CASCADE hará su trabajo, pero borramos de profiles por si acaso)
  DELETE FROM public.profiles WHERE id = target_id;
  DELETE FROM auth.users WHERE id = target_id;

  RETURN json_build_object('success', true);
END;
$$;
