import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isMockMode, supabase } from '../lib/supabase';
import { MockDatabase } from '../services/mockData';
import { Lock, Mail, User, ShieldCheck, UserPlus } from 'lucide-react';

export const Register: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const { showToast } = useToast();

  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState<number>(3); // Por defecto: Jugador
  const [isRoleLocked, setIsRoleLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  // Mapeo de slugs de roles a IDs y nombres
  const rolesMap: Record<string, { id: number; name: string }> = {
    trainer: { id: 2, name: 'Entrenador (Míster)' },
    player: { id: 3, name: 'Jugador' },
    board: { id: 4, name: 'Directivo / Comisión' },
  };

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && rolesMap[roleParam]) {
      setRoleId(rolesMap[roleParam].id);
      setIsRoleLocked(true);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('error', 'Validación', 'Por favor introduce tu nombre completo.');
      return;
    }
    if (!email.trim()) {
      showToast('error', 'Validación', 'Por favor introduce un correo electrónico.');
      return;
    }
    if (password.length < 6) {
      showToast('error', 'Validación', 'La contraseña debe tener al menos 6 caracteres.');
      return;
    }

    setLoading(true);
    try {
      if (isMockMode) {
        // --- MODO DEMO (LOCALSTORAGE) ---
        const profiles = MockDatabase.getProfiles();
        const emailExists = profiles.some(p => p.email === email.trim().toLowerCase());
        if (emailExists) {
          throw new Error('El correo electrónico ya está registrado en la demo.');
        }

        const newProfileId = `mock-uuid-user-${Math.random().toString(36).substring(2, 11)}`;
        const newProfile = {
          id: newProfileId,
          email: email.trim().toLowerCase(),
          full_name: fullName.trim(),
          role_id: roleId,
          avatar_url: `https://images.unsplash.com/photo-${roleId === 2 ? '1507003211169-0a1dd7228f2d' : roleId === 4 ? '1472099645785-5658abf4ff4e' : '1500648767791-00dcc994a43e'}?auto=format&fit=crop&w=100&q=80`,
          created_at: new Date().toISOString()
        };

        MockDatabase.setProfiles([...profiles, newProfile]);
        MockDatabase.setSessionUser(newProfile.id);

        showToast('success', 'Registro Exitoso (Demo)', 'Tu perfil de pruebas se ha creado correctamente.');
        // Forzar recarga rápida de sesión
        window.location.href = '/dashboard';
      } else {
        // --- MODO SUPABASE REAL ---
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: {
            data: {
              full_name: fullName.trim(),
              role_id: roleId
            }
          }
        });

        if (error) throw error;
        if (!data.user) throw new Error('No se pudo completar el registro en Supabase.');

        // Intentamos insertar perfil en la base de datos (si las políticas RLS lo permiten)
        try {
          await supabase.from('profiles').insert({
            id: data.user.id,
            email: email.trim().toLowerCase(),
            full_name: fullName.trim(),
            role_id: roleId
          });
        } catch (dbErr) {
          console.warn('Inserción directa de perfil no disponible. Se usará el trigger o el fallback.', dbErr);
        }

        showToast('success', 'Cuenta Creada', 'Registrado con éxito. Iniciando sesión...');
        
        // Loguearse directamente para inicializar la sesión en el React context
        await login(email.trim(), password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error en el Registro', err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-brand-black-bg flex flex-col justify-center items-center p-4 relative overflow-hidden">
      {/* Luces de fondo decorativas */}
      <div className="absolute top-[-20%] left-[-10%] w-[500px] h-[500px] bg-brand-red-600/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-20%] right-[-10%] w-[500px] h-[500px] bg-brand-red-600/5 rounded-full blur-[120px] pointer-events-none" />

      <div className="w-full max-w-md bg-brand-black border border-brand-black-border rounded-2xl shadow-premium overflow-hidden p-8 relative z-10">
        
        {/* Cabecera */}
        <div className="text-center mb-8">
          <div className="w-14 h-14 rounded-2xl bg-brand-red-600 flex items-center justify-center font-bold text-2xl text-white mx-auto shadow-glow-red mb-4">
            UA
          </div>
          <h2 className="text-xl font-bold tracking-tight text-brand-gray-light uppercase">Registro del Club</h2>
          <p className="text-xs text-brand-gray-muted mt-1.5">Únete al portal interno de la UD Atzeneta</p>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} className="space-y-4">
          
          {/* Campo Nombre Completo */}
          <div>
            <label className="form-label" htmlFor="fullName">Nombre y Apellidos</label>
            <div className="relative">
              <User className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="fullName"
                type="text"
                className="form-input pl-10"
                placeholder="Ej. Juan Pérez"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Campo Correo */}
          <div>
            <label className="form-label" htmlFor="email">Correo Electrónico</label>
            <div className="relative">
              <Mail className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="email"
                type="email"
                className="form-input pl-10"
                placeholder="nombre@atzeneta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Campo Contraseña */}
          <div>
            <label className="form-label" htmlFor="password">Contraseña</label>
            <div className="relative">
              <Lock className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                id="password"
                type="password"
                className="form-input pl-10"
                placeholder="Mínimo 6 caracteres"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          {/* Campo Rol */}
          <div>
            <label className="form-label" htmlFor="role">Rol asignado</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <select
                id="role"
                className="form-input pl-10 bg-brand-black cursor-pointer disabled:opacity-75 disabled:cursor-not-allowed text-brand-gray-light"
                value={roleId}
                onChange={(e) => setRoleId(parseInt(e.target.value))}
                disabled={isRoleLocked || loading}
              >
                <option value={3} className="bg-brand-black-card">Jugador</option>
                <option value={2} className="bg-brand-black-card">Entrenador (Míster)</option>
                <option value={4} className="bg-brand-black-card">Directivo</option>
              </select>
            </div>
            {isRoleLocked && (
              <p className="text-[10px] text-brand-red-500 font-semibold mt-1">
                * Tu rol ha sido pre-establecido de forma segura mediante el enlace de invitación.
              </p>
            )}
          </div>

          <button
            type="submit"
            className="btn-primary w-full mt-6 py-2.5 font-semibold"
            disabled={loading}
          >
            {loading ? 'Creando cuenta...' : 'Completar Registro'}
            {!loading && <UserPlus className="w-4 h-4" />}
          </button>
        </form>

        {/* Footer */}
        <div className="text-center mt-6 pt-4 border-t border-brand-black-border">
          <p className="text-xs text-brand-gray-muted">
            ¿Ya tienes una cuenta?{' '}
            <Link to="/login" className="text-brand-red-600 hover:text-brand-red-500 font-semibold underline">
              Inicia Sesión
            </Link>
          </p>
        </div>

      </div>
    </div>
  );
};
