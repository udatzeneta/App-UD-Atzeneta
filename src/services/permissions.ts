import { supabase, isMockMode } from '../lib/supabase';
import { MockDatabase, delay } from './mockData';
import { Permission, RolePermission, UserPermission, Profile } from '../types';

export const permissionsService = {
  // 1. Obtener lista completa de permisos
  async getPermissions(): Promise<Permission[]> {
    if (isMockMode) {
      return MockDatabase.getPermissions();
    } else {
      const { data, error } = await supabase
        .from('permissions')
        .select('*')
        .order('page', { ascending: true })
        .order('id', { ascending: true });
      if (error) throw error;
      return data as Permission[];
    }
  },

  // 2. Obtener mapeo de todos los permisos asignados a roles
  async getRolePermissions(): Promise<RolePermission[]> {
    if (isMockMode) {
      return MockDatabase.getRolePermissions();
    } else {
      const { data, error } = await supabase
        .from('role_permissions')
        .select('*');
      if (error) throw error;
      return data as RolePermission[];
    }
  },

  // 3. Obtener mapeo de permisos de usuarios individuales
  async getUserPermissions(): Promise<UserPermission[]> {
    if (isMockMode) {
      return MockDatabase.getUserPermissions();
    } else {
      const { data, error } = await supabase
        .from('user_permissions')
        .select('*');
      if (error) throw error;
      return data as UserPermission[];
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
      if (grant) {
        const { error } = await supabase
          .from('role_permissions')
          .upsert({ role_id: roleId, permission_id: permissionId });
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('role_permissions')
          .delete()
          .match({ role_id: roleId, permission_id: permissionId });
        if (error) throw error;
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
