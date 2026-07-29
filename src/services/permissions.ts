import { supabase, isMockMode } from '../lib/supabase';
import { MockDatabase, delay } from './mockData';
import { Permission, RolePermission, UserPermission, Profile } from '../types';

export const permissionsService = {
  // 1. Obtener lista completa de permisos
  async getPermissions(): Promise<Permission[]> {
    if (isMockMode) {
      return MockDatabase.getPermissions();
    } else {
      try {
        const { data, error } = await supabase
          .from('permissions')
          .select('*')
          .order('page', { ascending: true })
          .order('id', { ascending: true });
        if (error) throw error;
        if (!data || data.length === 0) {
          console.warn('⚠️ [Supabase] La tabla de permisos está vacía. Usando datos Mock de respaldo.');
          return MockDatabase.getPermissions();
        }
        return data as Permission[];
      } catch (err) {
        console.warn('⚠️ [Supabase] Error al cargar permisos. Usando datos Mock de respaldo:', err);
        return MockDatabase.getPermissions();
      }
    }
  },

  // 2. Obtener mapeo de todos los permisos asignados a roles
  async getRolePermissions(): Promise<RolePermission[]> {
    if (isMockMode) {
      return MockDatabase.getRolePermissions();
    } else {
      try {
        const { data, error } = await supabase
          .from('role_permissions')
          .select('*');
        if (error) throw error;
        if (!data || data.length === 0) {
          console.warn('⚠️ [Supabase] La tabla de permisos por rol está vacía. Usando datos Mock de respaldo.');
          return MockDatabase.getRolePermissions();
        }
        return data as RolePermission[];
      } catch (err) {
        console.warn('⚠️ [Supabase] Error al cargar permisos de rol. Usando datos Mock de respaldo:', err);
        return MockDatabase.getRolePermissions();
      }
    }
  },

  // 3. Obtener mapeo de permisos de usuarios individuales
  async getUserPermissions(): Promise<UserPermission[]> {
    if (isMockMode) {
      return MockDatabase.getUserPermissions();
    } else {
      try {
        const { data, error } = await supabase
          .from('user_permissions')
          .select('*');
        if (error) throw error;
        // user_permissions puede estar legítimamente vacía, pero si falla o queremos ser tolerantes:
        return (data || []) as UserPermission[];
      } catch (err) {
        console.warn('⚠️ [Supabase] Error al cargar permisos de usuario. Usando vacío:', err);
        return [];
      }
    }
  },

  // 4. Actualizar permiso de un rol (Guardado dinámico)
  async updateRolePermission(roleId: number, permissionId: number, grant: boolean): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let current = MockDatabase.getRolePermissions();
      if (grant) {
        if (!current.some(x => x.role_id === roleId && x.permission_id === permissionId)) {
          current.push({ role_id: roleId, permission_id: permissionId });
        }
      } else {
        current = current.filter(x => !(x.role_id === roleId && x.permission_id === permissionId));
      }
      MockDatabase.setRolePermissions(current);
    } else {
      const { error } = await supabase.rpc('admin_update_role_permission', {
        p_role_id: roleId,
        p_permission_id: permissionId,
        p_grant: grant
      });
      
      // Si la RPC no existe (fallback a upsert directo)
      if (error && error.message && error.message.includes('Could not find the function')) {
        console.warn('RPC admin_update_role_permission no encontrada. Usando modo directo.');
        if (grant) {
          const { error: upsertError } = await supabase
            .from('role_permissions')
            .upsert({ role_id: roleId, permission_id: permissionId });
          if (upsertError) throw upsertError;
        } else {
          const { error: delError } = await supabase
            .from('role_permissions')
            .delete()
            .match({ role_id: roleId, permission_id: permissionId });
          if (delError) throw delError;
        }
      } else if (error) {
        throw error;
      }
    }
  },

  // 5. Actualizar override individual de usuario (Guardado dinámico)
  // allowed = null indica eliminar el override y heredar del rol
  async updateUserPermissionOverride(userId: string, permissionId: number, allowed: boolean | null): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let current = MockDatabase.getUserPermissions();
      // Limpiar previo si existe
      current = current.filter(x => !(x.user_id === userId && x.permission_id === permissionId));
      if (allowed !== null) {
        current.push({ user_id: userId, permission_id: permissionId, allowed });
      }
      MockDatabase.setUserPermissions(current);
    } else {
      if (allowed === null) {
        const { error } = await supabase
          .from('user_permissions')
          .delete()
          .match({ user_id: userId, permission_id: permissionId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_permissions')
          .upsert({ user_id: userId, permission_id: permissionId, allowed })
          .match({ user_id: userId, permission_id: permissionId });
        if (error) throw error;
      }
    }
  },

  // 6. Verificar permiso de forma local instantánea en el frontend
  // Esta función calcula el permiso basado en el perfil y las tablas cargadas
  evaluatePermission(
    profile: Profile | null,
    page: string,
    action: 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar',
    allPermissions: Permission[],
    rolePermissions: RolePermission[],
    userPermissions: UserPermission[]
  ): boolean {
    if (!profile) return false;

    // Administrador (role_id === 1) tiene bypass de seguridad y acceso completo a todo siempre
    if (profile.role_id === 1) return true;

    // Directivo (role_id === 4) tiene acceso completo a todo excepto ajustes
    if (profile.role_id === 4 && page !== 'settings') return true;

    // Buscar el id del permiso
    const perm = allPermissions.find(p => p.page === page && p.action === action);
    if (!perm) return false;

    // A) Comprobar override de usuario primero (Tiene prioridad total)
    const userOverride = userPermissions.find(up => up.user_id === profile.id && up.permission_id === perm.id);
    if (userOverride !== undefined) {
      return userOverride.allowed;
    }

    // B) Si no hay override de usuario, comprobar rol
    const hasRoleAccess = rolePermissions.some(rp => rp.role_id === profile.role_id && rp.permission_id === perm.id);
    return hasRoleAccess;
  }
};
