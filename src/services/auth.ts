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

  // Obtener sesión actual
  async getCurrentSession(): Promise<Profile | null> {
    if (isMockMode) {
      return MockDatabase.getSessionUser();
    } else {
      const { data } = await supabase.auth.getSession();
      if (!data.session?.user) return null;

      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', data.session.user.id)
          .single();

        if (profile) return profile as Profile;
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
