-- Añadir los permisos de 'training_editor' (Editor Sesión) a la base de datos si no existen
INSERT INTO public.permissions (page, action, description)
VALUES
    ('training_editor', 'ver', 'Permiso para ver Editor Sesión'),
    ('training_editor', 'crear', 'Permiso para crear Editor Sesión'),
    ('training_editor', 'editar', 'Permiso para editar Editor Sesión'),
    ('training_editor', 'eliminar', 'Permiso para eliminar Editor Sesión'),
    ('training_editor', 'exportar', 'Permiso para exportar Editor Sesión')
ON CONFLICT (page, action) DO NOTHING;

-- Asignar estos permisos automáticamente al rol de Administrador y al de Entrenador
DO $$
DECLARE
    admin_role_id INT;
    trainer_role_id INT;
    perm_id INT;
BEGIN
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Administrador' LIMIT 1;
    SELECT id INTO trainer_role_id FROM public.roles WHERE name = 'Entrenador' LIMIT 1;

    FOR perm_id IN SELECT id FROM public.permissions WHERE page = 'training_editor' LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (admin_role_id, perm_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;

        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (trainer_role_id, perm_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
END $$;
