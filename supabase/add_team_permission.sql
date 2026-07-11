-- SQL Script para añadir los permisos de la nueva página "team"

-- 1. Insertar los permisos para 'team'
INSERT INTO public.permissions (page, action, description)
VALUES 
  ('team', 'ver', 'Permiso para ver en la página team'),
  ('team', 'crear', 'Permiso para crear en la página team'),
  ('team', 'editar', 'Permiso para editar en la página team'),
  ('team', 'eliminar', 'Permiso para eliminar en la página team'),
  ('team', 'exportar', 'Permiso para exportar en la página team')
ON CONFLICT DO NOTHING;

-- 2. Asignar los permisos a los roles correspondientes
-- Suponiendo que Admin (1), Entrenador (2) tienen todos los permisos de team, y Jugador (3), Directivo (4) solo ver

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 1, id FROM public.permissions WHERE page = 'team'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 2, id FROM public.permissions WHERE page = 'team'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 3, id FROM public.permissions WHERE page = 'team' AND action = 'ver'
ON CONFLICT DO NOTHING;

INSERT INTO public.role_permissions (role_id, permission_id)
SELECT 4, id FROM public.permissions WHERE page = 'team' AND action IN ('ver', 'exportar')
ON CONFLICT DO NOTHING;
