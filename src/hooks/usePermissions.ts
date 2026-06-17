import { useAuth } from '../context/AuthContext';

export const usePermissions = () => {
  const { hasPermission, roleSlug, user, refreshPermissions } = useAuth();
  
  return {
    hasPermission,
    roleSlug,
    user,
    refreshPermissions,
    isAdmin: roleSlug === 'admin',
    isTrainer: roleSlug === 'trainer',
    isPlayer: roleSlug === 'player',
    isBoard: roleSlug === 'board',
  };
};
