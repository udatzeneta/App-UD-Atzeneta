import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { permissionsService } from '../services/permissions';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Settings as SettingsType } from '../types';
import { 
  Settings as SettingsIcon, ShieldCheck, UserCog, Users, Edit2, Trash2,
  Save, CheckSquare, Square, QrCode, Copy, Download, Link as LinkIcon 
} from 'lucide-react';
import { Profile } from '../types';

export const SettingsPage: React.FC = () => {
  const queryClient = useQueryClient();
  const { isAdmin, refreshPermissions } = usePermissions();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'general' | 'roles' | 'users' | 'share' | 'members'>('general');
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [editProfileName, setEditProfileName] = useState('');
  const [editProfileEmail, setEditProfileEmail] = useState('');
  const [editProfileRole, setEditProfileRole] = useState(3);
  const [customDomain, setCustomDomain] = useState<string>(
    () => localStorage.getItem('ud_atzeneta_custom_domain') || window.location.origin
  );

  // Estados configuración general
  const [clubName, setClubName] = useState('');
  const [season, setSeason] = useState('');

  // 1. Consultar Configuración
  const { isLoading: loadingSettings } = useQuery({
    queryKey: ['settings'],
    queryFn: async () => {
      const s = await dataService.getSettings();
      setClubName(s.club_name);
      setSeason(s.season);
      return s;
    }
  });

  // 2. Consultar Permisos Globales (Solo para Admin)
  const { data: permissions = [], isLoading: loadingPerms } = useQuery({
    queryKey: ['permissions'],
    queryFn: () => permissionsService.getPermissions(),
    enabled: isAdmin
  });

  const { data: rolePermissions = [], isLoading: loadingRolePerms } = useQuery({
    queryKey: ['role_permissions'],
    queryFn: () => permissionsService.getRolePermissions(),
    enabled: isAdmin
  });

  const { data: userPermissions = [], isLoading: loadingUserPerms } = useQuery({
    queryKey: ['user_permissions'],
    queryFn: () => permissionsService.getUserPermissions(),
    enabled: isAdmin
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => authService.getProfiles(),
    enabled: isAdmin
  });

  // Mutaciones
  const updateSettingsMutation = useMutation({
    mutationFn: (item: Partial<SettingsType>) => dataService.updateSettings(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['settings'] });
      showToast('success', 'Ajustes guardados', 'Configuración del club actualizada correctamente.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateRolePermMutation = useMutation({
    mutationFn: ({ roleId, permissionId, grant }: { roleId: number; permissionId: number; grant: boolean }) =>
      permissionsService.updateRolePermission(roleId, permissionId, grant),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['role_permissions'] });
      await refreshPermissions(); // Refrescar contexto global de inmediato
      showToast('success', 'Permiso de Rol actualizado', 'Los cambios en la matriz se aplicaron al instante.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateUserOverrideMutation = useMutation({
    mutationFn: ({ userId, permissionId, allowed }: { userId: string; permissionId: number; allowed: boolean | null }) =>
      permissionsService.updateUserPermissionOverride(userId, permissionId, allowed),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['user_permissions'] });
      await refreshPermissions();
      showToast('success', 'Override guardado', 'La excepción del usuario se ha configurado correctamente.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateProfileMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<Profile> }) => authService.updateProfile(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      showToast('success', 'Usuario actualizado', 'Los datos del usuario han sido guardados.');
      setEditingProfile(null);
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteProfileMutation = useMutation({
    mutationFn: (id: string) => authService.deleteProfile(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['profiles'] });
      showToast('success', 'Usuario eliminado', 'El usuario ha sido eliminado del sistema.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!clubName.trim()) {
      showToast('error', 'Validación', 'El nombre del club no puede estar vacío.');
      return;
    }
    updateSettingsMutation.mutate({ club_name: clubName.trim(), season });
  };

  // Roles para la matriz (Excluir Administrador id:1 de la edición de checks ya que tiene todo)
  const targetRoles = [
    { id: 2, name: 'Entrenador' },
    { id: 3, name: 'Jugador' },
    { id: 4, name: 'Directivo' }
  ];

  // Comprobar si un rol tiene un permiso asignado
  const hasRolePermission = (roleId: number, permissionId: number) => {
    return rolePermissions.some(rp => rp.role_id === roleId && rp.permission_id === permissionId);
  };

  const handleToggleRolePermission = (roleId: number, permissionId: number) => {
    const isGranted = hasRolePermission(roleId, permissionId);
    updateRolePermMutation.mutate({ roleId, permissionId, grant: !isGranted });
  };

  // Comprobar estado de override de un usuario
  // Devuelve: 'allow' | 'deny' | 'inherit'
  const getUserOverrideState = (userId: string, permissionId: number) => {
    const match = userPermissions.find(up => up.user_id === userId && up.permission_id === permissionId);
    if (!match) return 'inherit';
    return match.allowed ? 'allow' : 'deny';
  };

  const handleUserOverrideChange = (permissionId: number, value: string) => {
    if (!selectedUserId) return;
    
    let allowed: boolean | null = null;
    if (value === 'allow') allowed = true;
    if (value === 'deny') allowed = false;

    updateUserOverrideMutation.mutate({ userId: selectedUserId, permissionId, allowed });
  };

  // Traducir los nombres de las páginas a etiquetas amigables
  const getFriendlyPageName = (page: string) => {
    switch (page) {
      case 'dashboard': return 'Dashboard';
      case 'calendar': return 'Calendario';
      case 'trainings': return 'Entrenamientos';
      case 'matches': return 'Partidos';
      case 'fines': return 'Multas';
      case 'points': return 'Puntos';
      case 'scouting': return 'Scouting';
      case 'opponent_analysis': return 'Análisis Rival';
      case 'settings': return 'Ajustes';
      case 'permissions': return 'Permisos Editor';
      default: return page;
    }
  };

  const handleEditProfile = (profile: Profile) => {
    setEditingProfile(profile);
    setEditProfileName(profile.full_name);
    setEditProfileEmail(profile.email);
    setEditProfileRole(profile.role_id);
  };

  const handleSaveProfile = () => {
    if (editingProfile) {
      updateProfileMutation.mutate({
        id: editingProfile.id,
        item: {
          full_name: editProfileName,
          email: editProfileEmail,
          role_id: editProfileRole
        }
      });
    }
  };

  const handleDeleteProfile = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este usuario permanentemente?')) {
      deleteProfileMutation.mutate(id);
    }
  };

  const isLoading = loadingSettings || (isAdmin && (loadingPerms || loadingRolePerms || loadingUserPerms || loadingProfiles));

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-brand-black-border rounded animate-pulse"></div>
        <TableSkeleton rows={4} />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabecera */}
      <div>
        <h2 className="text-2xl font-bold text-brand-gray-light">Configuración del Sistema</h2>
        <p className="text-sm text-brand-gray-muted mt-1">
          Ajustes generales del club y editor dinámico de permisos para el vestuario.
        </p>
      </div>

      {/* Tabs superiores */}
      <div className="flex border-b border-brand-black-border gap-6">
        <button
          onClick={() => setActiveTab('general')}
          className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
            activeTab === 'general'
              ? 'border-brand-red-600 text-brand-gray-light'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <SettingsIcon className="w-4 h-4" /> Configuración General
        </button>

        {isAdmin && (
          <>
            <button
              onClick={() => setActiveTab('roles')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'roles'
                  ? 'border-brand-red-600 text-brand-gray-light'
                  : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
              }`}
            >
              <ShieldCheck className="w-4 h-4" /> Permisos por Rol
            </button>

            <button
              onClick={() => setActiveTab('members')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'members'
                  ? 'border-brand-red-600 text-brand-gray-light'
                  : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
              }`}
            >
              <Users className="w-4 h-4" /> Gestión de Usuarios
            </button>

            <button
              onClick={() => setActiveTab('users')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'users'
                  ? 'border-brand-red-600 text-brand-gray-light'
                  : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
              }`}
            >
              <UserCog className="w-4 h-4" /> Excepciones por Usuario
            </button>

            <button
              onClick={() => setActiveTab('share')}
              className={`flex items-center gap-2 pb-3 text-sm font-semibold border-b-2 transition-all ${
                activeTab === 'share'
                  ? 'border-brand-red-600 text-brand-gray-light'
                  : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
              }`}
            >
              <QrCode className="w-4 h-4" /> Compartir Registro (QR)
            </button>
          </>
        )}
      </div>

      {/* =====================================================================
          TAB 1: CONFIGURACIÓN GENERAL
          ===================================================================== */}
      {activeTab === 'general' && (
        <div className="dashboard-card max-w-xl">
          <h3 className="text-sm font-bold text-brand-gray-light mb-6 uppercase tracking-wider border-b border-brand-black-border pb-3">
            Datos del Club
          </h3>
          <form onSubmit={handleSaveSettings} className="space-y-4">
            <div>
              <label className="form-label">Nombre Oficial del Club</label>
              <input
                type="text"
                className="form-input"
                value={clubName}
                onChange={(e) => setClubName(e.target.value)}
              />
            </div>

            <div>
              <label className="form-label">Temporada Activa</label>
              <input
                type="text"
                className="form-input"
                placeholder="2025/2026"
                value={season}
                onChange={(e) => setSeason(e.target.value)}
              />
            </div>

            <div className="pt-4 border-t border-brand-black-border flex justify-end">
              <button type="submit" className="btn-primary py-2.5 text-xs font-semibold">
                <Save className="w-4 h-4" /> Guardar Cambios
              </button>
            </div>
          </form>
        </div>
      )}

      {/* =====================================================================
          TAB: GESTIÓN DE USUARIOS
          ===================================================================== */}
      {activeTab === 'members' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-red-600 mb-1">Directorio de Usuarios</h4>
            <p className="text-xs text-brand-gray-muted leading-relaxed">
              Administra los miembros registrados en la plataforma. Puedes modificar su rol, nombre y correo, o eliminarlos del sistema por completo.
            </p>
          </div>

          <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-brand-black-hover/40">
                    <th className="table-th text-left">Usuario</th>
                    <th className="table-th text-left">Email</th>
                    <th className="table-th text-left">Rol</th>
                    <th className="table-th text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-black-border">
                  {profiles.map((p) => {
                    const isEditing = editingProfile?.id === p.id;
                    const isSystemAdmin = p.role_id === 1 && profiles.filter(pf => pf.role_id === 1).length === 1; // No dejar borrar al último admin

                    return (
                      <tr key={p.id} className="hover:bg-brand-black-hover/20 transition-colors">
                        <td className="table-td text-sm font-medium text-brand-gray-light">
                          {isEditing ? (
                            <input
                              type="text"
                              value={editProfileName}
                              onChange={(e) => setEditProfileName(e.target.value)}
                              className="form-input text-xs py-1 px-2"
                            />
                          ) : (
                            p.full_name
                          )}
                        </td>
                        <td className="table-td text-xs text-brand-gray-muted">
                          {isEditing ? (
                            <input
                              type="email"
                              value={editProfileEmail}
                              onChange={(e) => setEditProfileEmail(e.target.value)}
                              className="form-input text-xs py-1 px-2"
                            />
                          ) : (
                            p.email
                          )}
                        </td>
                        <td className="table-td">
                          {isEditing ? (
                            <select
                              value={editProfileRole}
                              onChange={(e) => setEditProfileRole(Number(e.target.value))}
                              className="form-input text-xs py-1 px-2 bg-brand-black-bg"
                              disabled={isSystemAdmin}
                            >
                              <option value={1}>Administrador</option>
                              <option value={2}>Entrenador</option>
                              <option value={3}>Jugador</option>
                              <option value={4}>Directivo</option>
                            </select>
                          ) : (
                            <span className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                              p.role_id === 1 ? 'bg-brand-red-950/30 text-brand-red-500' :
                              p.role_id === 2 ? 'bg-amber-950/30 text-amber-500' :
                              p.role_id === 4 ? 'bg-indigo-950/30 text-indigo-400' :
                              'bg-brand-black-bg text-brand-gray-muted'
                            }`}>
                              {p.role_id === 1 ? 'Admin' : p.role_id === 2 ? 'Míster' : p.role_id === 4 ? 'Directivo' : 'Jugador'}
                            </span>
                          )}
                        </td>
                        <td className="table-td text-right">
                          <div className="flex items-center justify-end gap-2">
                            {isEditing ? (
                              <>
                                <button
                                  onClick={handleSaveProfile}
                                  className="p-1.5 rounded bg-brand-red-600/10 text-brand-red-600 hover:bg-brand-red-600 hover:text-white transition-colors"
                                  title="Guardar"
                                >
                                  <Save className="w-4 h-4" />
                                </button>
                                <button
                                  onClick={() => setEditingProfile(null)}
                                  className="p-1.5 rounded bg-brand-black-hover text-brand-gray-muted hover:text-brand-gray-light transition-colors"
                                  title="Cancelar"
                                >
                                  Cancelar
                                </button>
                              </>
                            ) : (
                              <>
                                <button
                                  onClick={() => handleEditProfile(p)}
                                  className="p-1.5 rounded bg-brand-black-hover text-brand-gray-muted hover:text-brand-gray-light transition-colors"
                                  title="Editar"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                                {!isSystemAdmin && (
                                  <button
                                    onClick={() => handleDeleteProfile(p.id)}
                                    className="p-1.5 rounded bg-brand-black-hover text-brand-gray-muted hover:text-brand-red-500 transition-colors"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB: MATRIZ DE PERMISOS POR ROL
          ===================================================================== */}
      {activeTab === 'roles' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-red-600 mb-1">Editor de Permisos</h4>
            <p className="text-xs text-brand-gray-muted leading-relaxed">
              Marca o desmarca los permisos asignados a nivel de Rol. Recuerda que los Administradores heredan acceso completo de forma implícita. Las modificaciones aplicadas aquí impactarán de inmediato en los menús e interfaces del vestuario.
            </p>
          </div>

          <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="bg-brand-black-hover/40">
                    <th className="table-th">Sección / Página</th>
                    <th className="table-th">Acción</th>
                    {targetRoles.map(r => (
                      <th key={r.id} className="table-th text-center">{r.name}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-brand-black-border">
                  {permissions.map((perm) => (
                    <tr key={perm.id} className="hover:bg-brand-black-hover/20 transition-colors">
                      <td className="table-td font-semibold text-brand-gray-light">
                        {getFriendlyPageName(perm.page)}
                      </td>
                      <td className="table-td text-xs text-brand-gray-muted uppercase tracking-wider">
                        {perm.action}
                      </td>
                      {targetRoles.map(role => {
                        const isChecked = hasRolePermission(role.id, perm.id);
                        return (
                          <td key={role.id} className="table-td text-center">
                            <button
                              type="button"
                              onClick={() => handleToggleRolePermission(role.id, perm.id)}
                              className={`p-1 rounded transition-colors ${
                                isChecked ? 'text-brand-red-600 hover:text-brand-red-700' : 'text-brand-gray-dark hover:text-brand-gray-muted'
                              }`}
                            >
                              {isChecked ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </button>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 3: EXCEPCIONES INDIVIDUALES POR USUARIO
          ===================================================================== */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-6">
          
          {/* Selector de Usuario */}
          <div className="dashboard-card max-w-xl">
            <label className="form-label">Seleccionar Miembro del Club</label>
            <select
              value={selectedUserId}
              onChange={(e) => setSelectedUserId(e.target.value)}
              className="form-input bg-brand-black-bg"
            >
              <option value="">-- Elige un usuario para modificar excepciones --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="bg-brand-black-card text-brand-gray-light">
                  {p.full_name} ({p.email})
                </option>
              ))}
            </select>
          </div>

          {selectedUserId ? (
            <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse">
                  <thead>
                    <tr className="bg-brand-black-hover/40">
                      <th className="table-th">Sección / Página</th>
                      <th className="table-th">Acción</th>
                      <th className="table-th text-center w-64">Estado del Permiso (Override)</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-black-border">
                    {permissions.map((perm) => {
                      const state = getUserOverrideState(selectedUserId, perm.id);
                      return (
                        <tr key={perm.id} className="hover:bg-brand-black-hover/20 transition-colors">
                          <td className="table-td font-semibold text-brand-gray-light">
                            {getFriendlyPageName(perm.page)}
                          </td>
                          <td className="table-td text-xs text-brand-gray-muted uppercase tracking-wider">
                            {perm.action}
                          </td>
                          <td className="table-td text-center">
                            <select
                              value={state}
                              onChange={(e) => handleUserOverrideChange(perm.id, e.target.value)}
                              className={`text-xs px-2.5 py-1 rounded border bg-brand-black focus:ring-1 focus:ring-brand-red-600 transition-colors ${
                                state === 'allow'
                                  ? 'text-emerald-400 border-emerald-950/40 bg-emerald-950/10'
                                  : state === 'deny'
                                  ? 'text-brand-red-600 border-brand-red-950/40 bg-brand-red-950/10'
                                  : 'text-brand-gray-muted border-brand-black-border bg-transparent'
                              }`}
                            >
                              <option value="inherit">Heredar del Rol (Por defecto)</option>
                              <option value="allow">Permitir (Override)</option>
                              <option value="deny">Denegar / Bloquear (Override)</option>
                            </select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">Elige un jugador o técnico arriba para inspeccionar y ajustar sus excepciones de acceso.</p>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 4: COMPARTIR REGISTRO (QR)
          ===================================================================== */}
      {activeTab === 'share' && isAdmin && (
        <div className="space-y-6">
          <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-red-600 mb-1">Enlaces de Registro con Cánones de Seguridad</h4>
            <p className="text-xs text-brand-gray-muted leading-relaxed">
              Comparte estos enlaces o códigos QR con los nuevos integrantes del club. Al registrarse mediante estos códigos QR, el rol del nuevo miembro (Jugador, Entrenador o Directivo) quedará fijado automáticamente según el enlace.
            </p>
            
            <div className="mt-4 pt-4 border-t border-brand-black-border flex items-center gap-3">
              <label className="text-xs font-semibold text-brand-gray-light whitespace-nowrap">Dominio de la App:</label>
              <input
                type="text"
                value={customDomain}
                onChange={(e) => {
                  setCustomDomain(e.target.value);
                  localStorage.setItem('ud_atzeneta_custom_domain', e.target.value);
                }}
                className="form-input text-xs py-1.5 flex-1 max-w-sm"
                placeholder="https://app.atzeneta.com"
              />
              <span className="text-[10px] text-brand-gray-muted">Cámbialo si quieres generar QRs para otra URL (ej. la de producción).</span>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              {
                slug: 'player',
                name: 'Jugador',
                desc: 'Permite el registro de nuevos jugadores del primer equipo. Tendrán acceso de lectura a sus puntos, multas, entrenamientos y convocatorias.',
                color: 'text-brand-gray-light',
                borderColor: 'border-brand-black-border'
              },
              {
                slug: 'trainer',
                name: 'Entrenador (Míster)',
                desc: 'Permite el registro de miembros del cuerpo técnico. Tendrán permisos de edición en entrenamientos, multas, convocatorias y análisis táctico.',
                color: 'text-amber-400',
                borderColor: 'border-amber-950/30'
              },
              {
                slug: 'board',
                name: 'Directivo / Comisión',
                desc: 'Permite el registro de miembros de la comisión directiva del club. Tendrán acceso general de lectura y exportación en todas las áreas de gestión.',
                color: 'text-brand-red-500',
                borderColor: 'border-brand-red-950/20'
              }
            ].map((role) => {
              const baseDomain = customDomain.trim().replace(/\/$/, '') || window.location.origin;
              const registerUrl = `${baseDomain}/register?role=${role.slug}`;
              const qrCodeUrl = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&color=d92828&bgcolor=0b0b0c&qzone=2&data=${encodeURIComponent(registerUrl)}`;

              return (
                <div key={role.slug} className={`bg-brand-black border ${role.borderColor} rounded-2xl p-6 flex flex-col justify-between items-center text-center shadow-premium relative group overflow-hidden`}>
                  {/* Decorative background light */}
                  <div className="absolute top-[-10%] right-[-10%] w-[120px] h-[120px] bg-brand-red-600/5 rounded-full blur-[30px] pointer-events-none group-hover:bg-brand-red-600/10 transition-all duration-300" />
                  
                  <div className="w-full space-y-4">
                    <span className={`text-xs font-semibold uppercase tracking-widest px-2.5 py-1 rounded bg-brand-black-bg border border-brand-black-border ${role.color}`}>
                      {role.name}
                    </span>
                    <h4 className="text-base font-bold text-brand-gray-light">{role.name} UD Atzeneta</h4>
                    <p className="text-xs text-brand-gray-muted leading-relaxed min-h-[60px]">
                      {role.desc}
                    </p>

                    {/* QR Code Container */}
                    <div className="bg-brand-black-bg border border-brand-black-border p-4 rounded-xl flex items-center justify-center mx-auto w-48 h-48 relative overflow-hidden group-hover:border-brand-red-600/30 transition-all duration-300">
                      <img
                        src={qrCodeUrl}
                        alt={`QR Code para ${role.name}`}
                        className="w-full h-full object-contain"
                        loading="lazy"
                      />
                    </div>

                    <div className="text-[10px] font-mono text-brand-gray-dark break-all bg-brand-black-bg p-2 rounded border border-brand-black-border text-left relative flex items-center justify-between">
                      <span className="truncate pr-4">{registerUrl}</span>
                      <LinkIcon className="w-3.5 h-3.5 text-brand-gray-dark flex-shrink-0" />
                    </div>
                  </div>

                  {/* Buttons */}
                  <div className="w-full grid grid-cols-2 gap-2 mt-6">
                    <button
                      onClick={() => {
                        navigator.clipboard.writeText(registerUrl);
                        showToast('success', 'Enlace copiado', `El enlace de registro para ${role.name} ha sido copiado.`);
                      }}
                      className="btn-secondary py-2 text-xs font-semibold flex items-center justify-center gap-1.5 bg-brand-black-card text-brand-gray-light hover:bg-brand-black-hover"
                    >
                      <Copy className="w-3.5 h-3.5" /> Copiar Enlace
                    </button>
                    <a
                      href={qrCodeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn-secondary py-2 text-xs font-semibold flex items-center justify-center gap-1.5 bg-brand-black-card text-brand-gray-light hover:bg-brand-black-hover"
                    >
                      <Download className="w-3.5 h-3.5" /> Ver Grande
                    </a>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
