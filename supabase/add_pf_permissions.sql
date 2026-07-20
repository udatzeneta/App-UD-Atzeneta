-- Añadir los permisos de 'pf' a la base de datos si no existen
INSERT INTO public.permissions (page, action, description)
VALUES 
    ('pf', 'ver', 'Permiso para ver PF'),
    ('pf', 'crear', 'Permiso para crear PF'),
    ('pf', 'editar', 'Permiso para editar PF'),
    ('pf', 'eliminar', 'Permiso para eliminar PF'),
    ('pf', 'exportar', 'Permiso para exportar PF')
ON CONFLICT (page, action) DO NOTHING;

-- Asignar estos permisos automáticamente al rol de Administrador
DO $$
DECLARE
    admin_role_id INT;
    perm_id INT;
BEGIN
    -- Obtener el ID del rol Administrador
    SELECT id INTO admin_role_id FROM public.roles WHERE name = 'Administrador' LIMIT 1;
    
    -- Insertar la relación rol-permiso para cada permiso de 'pf'
    FOR perm_id IN SELECT id FROM public.permissions WHERE page = 'pf' LOOP
        INSERT INTO public.role_permissions (role_id, permission_id)
        VALUES (admin_role_id, perm_id)
        ON CONFLICT (role_id, permission_id) DO NOTHING;
    END LOOP;
END $$;
