import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { hasPermission, roleSlug, user, refreshPermissions, switchContext, originalProfile } = useAuth();
  
  return {
    hasPermission,
    roleSlug,
    user,
    originalProfile,
    switchContext,
    refreshPermissions,
    isAdmin: roleSlug === 'admin',
    isTrainer: roleSlug === 'trainer',
    isPlayer: roleSlug === 'player',
    isBoard: roleSlug === 'board',
  };
};
