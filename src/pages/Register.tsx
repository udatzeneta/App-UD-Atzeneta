import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { isMockMode, supabase } from '../lib/supabase';
import { MockDatabase } from '../services/mockData';
import { dataService } from '../services/data';
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
  const [teamCategory, setTeamCategory] = useState<'Primer Equipo' | 'Juvenil'>('Primer Equipo');
  const [isRoleLocked, setIsRoleLocked] = useState(false);
  const [isTeamLocked, setIsTeamLocked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [avatarDataUrl, setAvatarDataUrl] = useState<string>('');
  const [matchCandidate, setMatchCandidate] = useState<{ id: string; full_name: string; photo_url?: string } | null>(null);
  const [showMatchConfirm, setShowMatchConfirm] = useState(false);
  const [showNoMatchNotice, setShowNoMatchNotice] = useState(false);

  // Mapeo de slugs de roles a IDs y nombres
  const rolesMap: Record<string, { id: number; name: string; team?: string; secondary?: { role_id: number; team_category: string } }> = {
    trainer: { id: 2, name: 'Entrenador (Míster)' },
    player: { id: 3, name: 'Jugador' },
    board: { id: 4, name: 'Directivo / Comisión' },
    trainer_both: { 
      id: 2, 
      name: 'Entrenador (Míster)', 
      team: 'Primer Equipo',
      secondary: { role_id: 2, team_category: 'Juvenil' }
    },
    player_trainer: { 
      id: 3, 
      name: 'Jugador', 
      team: 'Primer Equipo',
      secondary: { role_id: 2, team_category: 'Juvenil' }
    }
  };

  const [secondaryContextToCreate, setSecondaryContextToCreate] = useState<{role_id: number, team_category: string} | null>(null);

  useEffect(() => {
    const roleParam = searchParams.get('role');
    if (roleParam && rolesMap[roleParam]) {
      setRoleId(rolesMap[roleParam].id);
      setIsRoleLocked(true);
      if (rolesMap[roleParam].team) {
        setTeamCategory(rolesMap[roleParam].team as any);
        setIsTeamLocked(true);
      }
      if (rolesMap[roleParam].secondary) {
        setSecondaryContextToCreate(rolesMap[roleParam].secondary);
      }
    }
    const teamParam = searchParams.get('team');
    if (teamParam === 'Primer Equipo' || teamParam === 'Juvenil') {
      if (!rolesMap[roleParam || '']?.team) {
        setTeamCategory(teamParam);
        setIsTeamLocked(true);
      }
    }
  }, [searchParams]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 250;
        const MAX_HEIGHT = 250;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        setAvatarDataUrl(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.src = event.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // ID de la cuenta ya creada, a la espera de confirmar (o no) el vínculo con su ficha de jugador
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

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
      const newUserId = isMockMode ? await createMockAccount() : await createRealAccount();

      if (roleId === 3) {
        // Buscamos su ficha más parecida (ya autenticado, para poder consultar `players` vía RPC)
        const candidate = await dataService.findBestMatchingPlayer(fullName.trim());
        setLoading(false);
        if (candidate) {
          setPendingUserId(newUserId);
          setMatchCandidate(candidate);
          setShowMatchConfirm(true);
          return;
        } else {
          setPendingUserId(newUserId);
          setShowNoMatchNotice(true);
          return;
        }
      }

      await finalizeSession(newUserId);
    } catch (err: any) {
      console.error(err);
      setLoading(false);
      showToast('error', 'Error en el Registro', err.message || 'Ocurrió un error inesperado.');
    }
  };

  // Crea la cuenta en modo Demo (localStorage) y devuelve el id del nuevo perfil
  const createMockAccount = async (): Promise<string> => {
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
      team_category: teamCategory,
      avatar_url: avatarDataUrl || `https://images.unsplash.com/photo-${roleId === 2 ? '1507003211169-0a1dd7228f2d' : roleId === 4 ? '1472099645785-5658abf4ff4e' : '1500648767791-00dcc994a43e'}?auto=format&fit=crop&w=100&q=80`,
      created_at: new Date().toISOString()
    };

    MockDatabase.setProfiles([...profiles, newProfile]);
    MockDatabase.setSessionUser(newProfile.id);
    return newProfileId;
  };

  // Crea la cuenta en Supabase real (deja sesión activa) y devuelve el id del usuario
  const createRealAccount = async (): Promise<string> => {
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          role_id: roleId,
          team_category: teamCategory
        }
      }
    });

    if (error) throw error;
    if (!data.user) throw new Error('No se pudo completar el registro en Supabase.');

    // Intentamos insertar perfil en la base de datos (si las políticas RLS lo permiten;
    // si ya existe por un trigger de auth.users, este insert fallará y lo ignoramos)
    try {
      const profilePayload = {
        id: data.user.id,
        email: email.trim().toLowerCase(),
        full_name: fullName.trim(),
        role_id: roleId,
        team_category: teamCategory,
        avatar_url: avatarDataUrl || null
      };

      const { error: insErr } = await supabase.from('profiles').insert(profilePayload);
      
      // Si falla (probablemente porque el trigger antiguo ya lo creó con rol Jugador),
      // forzamos una actualización con los datos correctos para asegurar el rol y avatar.
      if (insErr) {
        await supabase.from('profiles').update(profilePayload).eq('id', data.user.id);
      }
    } catch (dbErr) {
      console.warn('No se pudo establecer el perfil completamente.', dbErr);
    }

    return data.user.id;
  };

  // Vincula (si procede) y finaliza el alta: inicia sesión en la app y navega al dashboard
  const finalizeSession = async (overrideUserId?: string) => {
    setLoading(true);
    try {
      if (isMockMode) {
        showToast('success', 'Registro Exitoso (Demo)', 'Tu perfil de pruebas se ha creado correctamente.');
        window.location.href = '/dashboard';
      } else {
        showToast('success', 'Cuenta Creada', 'Registrado con éxito. Iniciando sesión...');
        const loggedUser = await login(email.trim(), password);
        
        // CREAR CONTEXTO SECUNDARIO SI APLICA (Ahora que estamos autenticados al 100%)
        if (secondaryContextToCreate) {
          try {
            await dataService.addUserContext({
              user_id: overrideUserId || loggedUser.id,
              role_id: secondaryContextToCreate.role_id,
              team_category: secondaryContextToCreate.team_category
            });
            // Refrescar el perfil para cargar los contextos que acabamos de insertar
            await login(email.trim(), password);
          } catch (e) {
            console.warn('Error al crear contexto secundario:', e);
          }
        }
        
        navigate('/dashboard');
      }
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error en el Registro', err.message || 'Ocurrió un error inesperado.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmMatch = async () => {
    if (!pendingUserId || !matchCandidate) return;
    setShowMatchConfirm(false);
    setLoading(true);
    try {
      await dataService.linkPlayerToUserById(pendingUserId, matchCandidate.id);
      showToast('success', 'Jugador Vinculado', 'Tu cuenta se ha vinculado a tu ficha oficial.');
    } catch (err: any) {
      showToast('error', 'Error de Vinculación', err.message || 'No se pudo vincular tu ficha de jugador.');
    }
    await finalizeSession(pendingUserId);
  };

  const handleRejectMatch = () => {
    setShowMatchConfirm(false);
    setShowNoMatchNotice(true);
  };

  const handleCloseNoMatchNotice = async () => {
    setShowNoMatchNotice(false);
    setMatchCandidate(null);
    await finalizeSession(pendingUserId || undefined);
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
                name="fullName"
                type="text"
                autoComplete="name"
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
                name="email"
                type="email"
                autoComplete="email"
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
                name="password"
                type="password"
                autoComplete="new-password"
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

          {/* Campo Equipo */}
          <div>
            <label className="form-label" htmlFor="teamCategory">Equipo</label>
            <div className="relative">
              <ShieldCheck className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <select
                id="teamCategory"
                className="form-input pl-10 bg-brand-black cursor-pointer text-brand-gray-light disabled:opacity-50 disabled:cursor-not-allowed"
                value={teamCategory}
                onChange={(e) => setTeamCategory(e.target.value as 'Primer Equipo' | 'Juvenil')}
                disabled={loading || isTeamLocked}
              >
                <option value="Primer Equipo" className="bg-brand-black-card">Primer Equipo</option>
                <option value="Juvenil" className="bg-brand-black-card">Juvenil</option>
              </select>
            </div>
            {isTeamLocked && (
              <p className="text-[10px] text-brand-red-500 font-semibold mt-1">
                * El equipo ha sido pre-establecido de forma segura mediante el enlace de invitación.
              </p>
            )}
          </div>

          {/* Campo Foto (solo Entrenadores y Directivos) */}
          {(roleId === 2 || roleId === 4) && (
            <div>
              <label className="form-label">Foto de Perfil (Opcional)</label>
              <div className="flex items-center gap-4 bg-brand-black-bg p-3 rounded-xl border border-brand-black-border">
                <div className="w-12 h-12 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                  {avatarDataUrl ? (
                    <img src={avatarDataUrl} alt="Vista previa" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-6 h-6 text-brand-gray-dark" />
                  )}
                </div>
                <div className="flex-1">
                  <input
                    type="file"
                    accept="image/*"
                    capture="user"
                    className="block w-full text-xs text-brand-gray-muted
                      file:mr-3 file:py-1.5 file:px-3
                      file:rounded-md file:border-0
                      file:text-xs file:font-semibold
                      file:bg-brand-red-600/10 file:text-brand-red-600
                      hover:file:bg-brand-red-600/20 cursor-pointer"
                    onChange={handleFileSelect}
                  />
                  <p className="text-[10px] text-brand-gray-dark mt-1">
                    Puedes hacerte un selfie o subir una foto.
                  </p>
                </div>
              </div>
            </div>
          )}

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

      {/* Modal de confirmación de jugador más parecido */}
      {showMatchConfirm && matchCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-brand-black border border-brand-black-border rounded-2xl shadow-premium p-6 text-center">
            <h3 className="text-base font-bold text-brand-gray-light mb-1">¿Eres tú?</h3>
            <p className="text-xs text-brand-gray-muted mb-4">
              Hemos encontrado una ficha de jugador con un nombre muy parecido al tuyo.
            </p>
            <div className="flex flex-col items-center gap-2 mb-5">
              <div className="w-16 h-16 rounded-full border border-brand-black-border bg-brand-black-card overflow-hidden flex items-center justify-center">
                {matchCandidate.photo_url ? (
                  <img src={matchCandidate.photo_url} alt={matchCandidate.full_name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-7 h-7 text-brand-gray-dark" />
                )}
              </div>
              <span className="text-sm font-semibold text-brand-gray-light">{matchCandidate.full_name}</span>
            </div>
            <div className="flex gap-3">
              <button
                type="button"
                className="flex-1 py-2 rounded-lg text-sm font-semibold border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover transition-colors"
                onClick={handleRejectMatch}
                disabled={loading}
              >
                No soy yo
              </button>
              <button
                type="button"
                className="btn-primary flex-1 py-2 font-semibold justify-center"
                onClick={handleConfirmMatch}
                disabled={loading}
              >
                Sí, soy yo
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Aviso cuando no se confirma o no se encuentra ficha coincidente */}
      {showNoMatchNotice && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
          <div className="w-full max-w-sm bg-brand-black border border-brand-black-border rounded-2xl shadow-premium p-6 text-center">
            <h3 className="text-base font-bold text-brand-gray-light mb-2">No hemos podido vincular tu ficha</h3>
            <p className="text-xs text-brand-gray-muted mb-5">
              No hemos podido confirmar tu ficha de jugador automáticamente. Habla con tu entrenador para que revise y solucione tu registro antes de continuar.
            </p>
            <button
              type="button"
              className="btn-primary w-full py-2 font-semibold justify-center"
              onClick={handleCloseNoMatchNotice}
              disabled={loading}
            >
              Entendido
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
