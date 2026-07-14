import { supabase, isMockMode } from '../lib/supabase';
import { MockDatabase, delay } from './mockData';
import { Profile } from '../types';

export const authService = {
  // Iniciar sesión
  async login(email: string, password?: string): Promise<Profile> {
    if (isMockMode) {
      await delay(600);
      const profiles = MockDatabase.getProfiles();
      const profile = profiles.find(p => p.email === email.trim().toLowerCase());
      if (!profile) {
        throw new Error('Usuario no encontrado. Prueba con mister@atzeneta.com, admin@atzeneta.com o paco@atzeneta.com');
      }
      MockDatabase.setSessionUser(profile.id);
      const linkedPlayer = MockDatabase.getPlayers().find((p: any) => p.profile_id === profile.id);
      if (linkedPlayer) {
        profile.full_name = linkedPlayer.full_name;
        if (linkedPlayer.photo_url) profile.avatar_url = linkedPlayer.photo_url;
      }
      return profile;
    } else {
      if (!password) throw new Error('Se requiere contraseña para iniciar sesión.');
      const { data, error } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw error;
      if (!data.user) throw new Error('No se pudo recuperar el usuario.');

      // Obtener perfil vinculado en Supabase
      try {
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.user.id)
          .single();

        if (profileError || !profile) {
          console.warn('Perfil no encontrado en la base de datos de Supabase, usando perfil temporal de administrador:', profileError);
          return {
            id: data.user.id,
            email: data.user.email || email.trim(),
            full_name: 'Entrenes UD Atzeneta',
            role_id: 1, // Admin
            created_at: new Date().toISOString()
          };
        }

        // Obtener datos del jugador vinculado si existe para sobreescribir nombre y foto
        const { data: linkedPlayers } = await supabase
          .from('players')
          .select('full_name, photo_url')
          .eq('profile_id', profile.id);

        if (linkedPlayers && linkedPlayers.length > 0) {
          profile.full_name = linkedPlayers[0].full_name;
          if (linkedPlayers[0].photo_url) {
            profile.avatar_url = linkedPlayers[0].photo_url;
          }
        }
        return profile as Profile;
      } catch (err) {
        console.warn('Error al recuperar perfil de Supabase, usando perfil temporal de administrador:', err);
        return {
          id: data.user.id,
          email: data.user.email || email.trim(),
          full_name: 'Entrenes UD Atzeneta',
          role_id: 1, // Admin
          created_at: new Date().toISOString()
        };
      }
    }
  },

  // Iniciar sesión rápido en modo demo
  async loginAsMock(userId: string): Promise<Profile> {
    await delay(300);
    const profiles = MockDatabase.getProfiles();
    const profile = profiles.find(p => p.id === userId);
    if (!profile) throw new Error('Perfil no encontrado.');
    MockDatabase.setSessionUser(profile.id);
    const linkedPlayer = MockDatabase.getPlayers().find((p: any) => p.profile_id === profile.id);
    if (linkedPlayer) {
      profile.full_name = linkedPlayer.full_name;
      if (linkedPlayer.photo_url) profile.avatar_url = linkedPlayer.photo_url;
    }
    return profile;
  },

  // Cerrar sesión
  async logout(): Promise<void> {
    if (isMockMode) {
      await delay(300);
      MockDatabase.setSessionUser(null);
    } else {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    }
  },

  // Resetear contraseña
  async resetPassword(email: string): Promise<void> {
    if (isMockMode) {
      await delay(500);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: `${window.location.origin}/update-password`,
    });
    if (error) throw error;
  },

  // Actualizar contraseña del usuario actual
  async updatePassword(newPassword: string): Promise<void> {
    if (isMockMode) {
      await delay(500);
      return;
    }
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) throw error;
  },

  // Obtener sesión actual
  async getCurrentSession(): Promise<Profile | null> {
    if (isMockMode) {
      const profile = MockDatabase.getSessionUser();
      if (profile) {
        const linkedPlayer = MockDatabase.getPlayers().find((p: any) => p.profile_id === profile.id);
        if (linkedPlayer) {
          profile.full_name = linkedPlayer.full_name;
          if (linkedPlayer.photo_url) profile.avatar_url = linkedPlayer.photo_url;
        }
      }
      return profile;
    } else {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return null;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profile) {
          // Obtener datos del jugador vinculado si existe para sobreescribir nombre y foto
          const { data: linkedPlayers } = await supabase
            .from('players')
            .select('full_name, photo_url')
            .eq('profile_id', profile.id);
            
          if (linkedPlayers && linkedPlayers.length > 0) {
            profile.full_name = linkedPlayers[0].full_name;
            if (linkedPlayers[0].photo_url) {
              profile.avatar_url = linkedPlayers[0].photo_url;
            }
          }
          return profile as Profile;
        }
      } catch (err) {
        console.warn('Error al recuperar perfil de la base de datos, usando fallback de metadatos:', err);
      }

      // Fallback a metadatos de usuario si no existe en la tabla profiles
      const metaRole = data.session.user.user_metadata?.role_id ? parseInt(data.session.user.user_metadata.role_id) : 3;
      const metaName = data.session.user.user_metadata?.full_name || data.session.user.email?.split('@')[0] || 'Usuario';
      
      return {
        id: data.session.user.id,
        email: (data.session.user.email || '') as string,
        full_name: metaName,
        role_id: metaRole,
        created_at: new Date().toISOString()
      };
    }
  },

  // Consultar todos los perfiles registrados (para vincular multas, puntos, etc.)
  async getProfiles(): Promise<Profile[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getProfiles();
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('full_name', { ascending: true });
      if (error) throw error;
      return data as Profile[];
    }
  },

  // Solo para administrador: Obtiene usuarios reales vinculados con auth.users
  async getAdminUsers(): Promise<Profile[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getProfiles();
    } else {
      const { data, error } = await supabase.rpc('admin_get_users');
      if (error) throw error;
      return data as Profile[];
    }
  },

  async adminUpdateUser(id: string, newEmail: string, newName: string, newRole: number): Promise<void> {
    if (isMockMode) {
      await delay(300);
      const profiles = MockDatabase.getProfiles();
      const idx = profiles.findIndex(p => p.id === id);
      if (idx !== -1) {
        profiles[idx] = { ...profiles[idx], email: newEmail, full_name: newName, role_id: newRole };
        MockDatabase.setProfiles(profiles);
      }
    } else {
      const { error } = await supabase.rpc('admin_update_user', {
        target_id: id,
        new_email: newEmail,
        new_full_name: newName,
        new_role_id: newRole
      });
      if (error) throw error;
    }
  },

  async adminDeleteUser(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let profiles = MockDatabase.getProfiles();
      profiles = profiles.filter(p => p.id !== id);
      MockDatabase.setProfiles(profiles);
    } else {
      const { error } = await supabase.rpc('admin_delete_user', {
        target_id: id
      });
      if (error) throw error;
    }
  },

  async createProfile(item: Omit<Profile, 'id'>): Promise<Profile> {
    if (isMockMode) {
      await delay(300);
      const profiles = MockDatabase.getProfiles();
      const newProfile: Profile = {
        ...item,
        id: `mock-uuid-user-${Math.random().toString(36).substring(2, 11)}`,
        created_at: new Date().toISOString()
      };
      MockDatabase.setProfiles([...profiles, newProfile]);
      return newProfile;
    } else {
      const tempId = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'temp-' + Math.random().toString(36).substring(2, 15);
      const { data, error } = await supabase
        .from('profiles')
        .insert({ ...item, id: tempId })
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    }
  },

  async updateProfile(id: string, item: Partial<Profile>): Promise<Profile> {
    if (isMockMode) {
      await delay(300);
      const profiles = MockDatabase.getProfiles();
      const idx = profiles.findIndex(p => p.id === id);
      if (idx === -1) throw new Error('Jugador no encontrado');
      profiles[idx] = { ...profiles[idx], ...item };
      MockDatabase.setProfiles(profiles);
      return profiles[idx];
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Profile;
    }
  },

  async deleteProfile(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let profiles = MockDatabase.getProfiles();
      profiles = profiles.filter(p => p.id !== id);
      MockDatabase.setProfiles(profiles);
    } else {
      const { error } = await supabase
        .from('profiles')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  }
};
