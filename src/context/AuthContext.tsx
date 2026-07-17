import React, { createContext, useContext, useState, useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { authService } from '../services/auth';
import { permissionsService } from '../services/permissions';
import { dataService } from '../services/data';
import { Profile, Permission, RolePermission, UserPermission, UserRoleSlug } from '../types';

interface AuthContextType {
  user: Profile | null;
  roleSlug: UserRoleSlug | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password?: string) => Promise<Profile>;
  loginAsMockUser: (userId: string) => Promise<Profile>;
  logout: () => Promise<void>;
  hasPermission: (page: string, action: 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar') => boolean;
  refreshPermissions: () => Promise<void>;
  // Datos crudos para uso en configuración
  allPermissions: Permission[];
  rolePermissions: RolePermission[];
  userPermissions: UserPermission[];
  
  // Contextos (Multi-rol)
  originalProfile: Profile | null;
  switchContext: (role_id: number, team_category: string) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<Profile | null>(null);
  const [originalProfile, setOriginalProfile] = useState<Profile | null>(null);
  const [roleSlug, setRoleSlug] = useState<UserRoleSlug | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Estados de la matriz de permisos
  const [allPermissions, setAllPermissions] = useState<Permission[]>([]);
  const [rolePermissions, setRolePermissions] = useState<RolePermission[]>([]);
  const [userPermissions, setUserPermissions] = useState<UserPermission[]>([]);

  const setupUserProfile = async (profile: Profile) => {
    try {
      const secondaryContexts = await dataService.getUserContexts(profile.id);
      
      const availableContexts = [
        { role_id: profile.role_id, team_category: profile.team_category || 'Primer Equipo' },
        ...secondaryContexts.map(c => ({ role_id: c.role_id, team_category: c.team_category }))
      ];

      const profileWithContexts = {
        ...profile,
        availableContexts
      };

      setOriginalProfile(profileWithContexts);

      const savedContextStr = localStorage.getItem('ud_atzeneta_active_context');
      let activeProfile = profileWithContexts;

      if (savedContextStr) {
        try {
          const savedContext = JSON.parse(savedContextStr);
          const isValid = availableContexts.some(c => c.role_id === savedContext.role_id && c.team_category === savedContext.team_category);
          if (isValid) {
            activeProfile = { ...profileWithContexts, role_id: savedContext.role_id, team_category: savedContext.team_category };
          }
        } catch (e) {}
      }

      setUser(activeProfile);
      await loadPermissionsData(activeProfile);
      return activeProfile;
    } catch (err) {
      console.error('Error al configurar el perfil del usuario:', err);
      setUser(profile);
      await loadPermissionsData(profile);
      return profile;
    }
  };

  // Cargar sesión al iniciar
  useEffect(() => {
    const initSession = async () => {
      try {
        const currentUser = await authService.getCurrentSession();
        if (currentUser) {
          await setupUserProfile(currentUser);
        } else {
          setLoading(false);
        }
      } catch (err) {
        console.error('Error al inicializar sesión:', err);
        setLoading(false);
      }
    };
    initSession();
  }, []);

  // Cargar matrices de permisos y determinar slug de rol
  const loadPermissionsData = async (profile: Profile) => {
    try {
      console.log('🔐 [DEBUG] Cargando permisos para perfil:', profile);
      
      // Registrar contexto de equipo para el filtrado global de datos
      dataService.setCurrentUserContext(profile.role_id, profile.team_category || 'Primer Equipo');

      // 1. Obtener lista completa de permisos, permisos de rol e individuales
      const [perms, rolePerms, userPerms] = await Promise.all([
        permissionsService.getPermissions(),
        permissionsService.getRolePermissions(),
        permissionsService.getUserPermissions()
      ]);

      console.log('🔐 [DEBUG] permissions cargados:', perms.length, perms);
      console.log('🔐 [DEBUG] role_permissions cargados:', rolePerms.length, rolePerms);
      console.log('🔐 [DEBUG] user_permissions cargados:', userPerms.length, userPerms);

      setAllPermissions(perms);
      setRolePermissions(rolePerms);
      setUserPermissions(userPerms);

      // 2. Resolver slug del rol
      if (profile.role_id === 1) setRoleSlug('admin');
      else if (profile.role_id === 2) setRoleSlug('trainer');
      else if (profile.role_id === 3) setRoleSlug('player');
      else if (profile.role_id === 4) setRoleSlug('board');

      // 3. Comprobar permiso de dashboard como test
      const dashPerm = perms.find(p => p.page === 'dashboard' && p.action === 'ver');
      console.log('🔐 [DEBUG] Permiso dashboard/ver encontrado:', dashPerm);
      if (dashPerm) {
        const hasAccess = rolePerms.some(rp => rp.role_id === profile.role_id && rp.permission_id === dashPerm.id);
        console.log('🔐 [DEBUG] El rol', profile.role_id, 'tiene acceso a dashboard/ver:', hasAccess);
      }

    } catch (err) {
      console.error('🔐 [DEBUG] Error al cargar datos de permisos:', err);
    } finally {
      setLoading(false);
    }
  };

  // Recargar permisos desde la base de datos (por ejemplo, después de editarlos en Ajustes)
  const refreshPermissions = async () => {
    if (!user) return;
    try {
      const [perms, rolePerms, userPerms] = await Promise.all([
        permissionsService.getPermissions(),
        permissionsService.getRolePermissions(),
        permissionsService.getUserPermissions()
      ]);
      setAllPermissions(perms);
      setRolePermissions(rolePerms);
      setUserPermissions(userPerms);
    } catch (err) {
      console.error('Error al recargar permisos:', err);
    }
  };

  // Iniciar sesión tradicional
  const login = async (email: string, password?: string) => {
    setLoading(true);
    try {
      const profile = await authService.login(email, password);
      return await setupUserProfile(profile);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  // Iniciar sesión rápido (Modo Demo)
  const loginAsMockUser = async (userId: string) => {
    setLoading(true);
    try {
      const profile = await authService.loginAsMock(userId);
      return await setupUserProfile(profile);
    } catch (err) {
      setLoading(false);
      throw err;
    }
  };

  // Cambiar el contexto de usuario (Multi-rol)
  const switchContext = async (role_id: number, team_category: string) => {
    if (!originalProfile) return;
    
    localStorage.setItem('ud_atzeneta_active_context', JSON.stringify({ role_id, team_category }));

    const overriddenUser = {
      ...originalProfile,
      role_id,
      team_category
    };
    
    dataService.setCurrentUserContext(role_id, team_category || 'Primer Equipo');
    setUser(overriddenUser);
    await loadPermissionsData(overriddenUser);
    
    // Forzar la recarga de todos los datos al cambiar de contexto
    queryClient.invalidateQueries();
  };

  // Cerrar sesión
  const logout = async () => {
    setLoading(true);
    try {
      await authService.logout();
      dataService.setCurrentUserContext(0, '');
      localStorage.removeItem('ud_atzeneta_active_context');
      setUser(null);
      setOriginalProfile(null);
      setRoleSlug(null);
      setAllPermissions([]);
      setRolePermissions([]);
      setUserPermissions([]);
    } catch (err) {
      console.error('Error al cerrar sesión:', err);
    } finally {
      setLoading(false);
    }
  };

  // Método centralizado para chequear accesos en cualquier componente
  const hasPermission = (
    page: string,
    action: 'ver' | 'crear' | 'editar' | 'eliminar' | 'exportar'
  ): boolean => {
    return permissionsService.evaluatePermission(
      user,
      page,
      action,
      allPermissions,
      rolePermissions,
      userPermissions
    );
  };

  const value: AuthContextType = {
    user,
    roleSlug,
    loading,
    isAuthenticated: !!user,
    login,
    loginAsMockUser,
    logout,
    hasPermission,
    refreshPermissions,
    allPermissions,
    rolePermissions,
    userPermissions,
    originalProfile,
    switchContext
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth debe ser utilizado dentro de un AuthProvider');
  }
  return context;
};
