import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { supabase, isMockMode } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { PointLog, Profile } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  Award, Search, Download, FileText, Plus, Trash2, Edit2,
  TrendingUp, TrendingDown, Calendar, User, Trophy, Users, Check
} from 'lucide-react';

// Valores de puntuación predefinidos
const POINT_OPTIONS = [-5, -4, -3, -2, -1, 1, 2, 3, 4, 5];

export const Points: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission, roleSlug, user } = usePermissions();
  const { showToast } = useToast();

  const isPlayer = user?.role_id === 3;

  const [filterTeam, setFilterTeam] = useState(user?.team_category || 'Primer Equipo');

  React.useEffect(() => {
    if (user?.team_category) {
      setFilterTeam(user.team_category);
    }
  }, [user?.team_category]);

  const canCreate = hasPermission('points', 'crear');
  const canEdit = hasPermission('points', 'editar');
  const canDelete = hasPermission('points', 'eliminar');
  const canExport = hasPermission('points', 'exportar');

  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PointLog | null>(null);

  // Campos formulario
  const [targetUserId, setTargetUserId] = useState('');
  const [selectedUserIds, setSelectedUserIds] = useState<string[]>([]);
  const [modalPlayerSearch, setModalPlayerSearch] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [pointsAmount, setPointsAmount] = useState('2');

  // Queries
  const { data: pointsLogs = [], isLoading: loadingPoints } = useQuery({
    queryKey: ['points'],
    queryFn: () => dataService.getPoints()
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      // 1. Obtener solo entrenadores (rol 2) de la tabla profiles
      const staffProfiles = await dataService.getProfilesByRoles([2]);
      
      // 2. Obtener todos los jugadores directamente de la tabla players
      const { data: players } = await supabase.from('players').select('*');
      
      // 3. Crear perfiles "ficticios" para los jugadores basándonos en sus datos reales de la plantilla
      const playerProfiles = (players || []).map(player => ({
        id: player.profile_id || player.id, // Usar profile_id si lo tiene, sino el ID del jugador
        role_id: 3,
        full_name: player.full_name,
        nickname: player.nickname,
        dorsal: player.dorsal,
        avatar_url: player.photo_url,
        team_category: player.team_category,
        email: ''
      }));
      
      return [...staffProfiles, ...playerProfiles];
    },
    enabled: canCreate || canEdit
  });

  // Perfiles filtrados para la selección en el modal
  const modalProfiles = profiles.filter(p => {
    const pTeam = p.team_category || 'Primer Equipo';
    const matchesTeam = pTeam === filterTeam;
    const name = p.role_id === 3 ? (p.nickname || p.full_name) : p.full_name;
    const searchMatch = !modalPlayerSearch.trim() || 
      name.toLowerCase().includes(modalPlayerSearch.toLowerCase()) || 
      (p.dorsal && String(p.dorsal).includes(modalPlayerSearch));
    return matchesTeam && searchMatch;
  });

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: (item: Omit<PointLog, 'id'>) => dataService.createPoint(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      showToast('success', 'Puntos asignados', 'Se han registrado los puntos al jugador.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const createBulkMutation = useMutation({
    mutationFn: (items: Omit<PointLog, 'id'>[]) => dataService.createPointsBulk(items),
    onSuccess: (_, items) => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      showToast(
        'success',
        'Puntos asignados',
        items.length === 1
          ? 'Se han registrado los puntos al jugador.'
          : `Se han registrado los puntos a ${items.length} jugadores.`
      );
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<PointLog> }) => dataService.updatePoint(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      showToast('success', 'Registro editado', 'Se ha actualizado la bitácora de puntos.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deletePoint(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points'] });
      showToast('success', 'Registro eliminado', 'Se han cancelado los puntos asignados.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleOpenCreateModal = () => {
    setEditingPoint(null);
    setSelectedUserIds([]);
    setTargetUserId('');
    setDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setPointsAmount('2');
    setModalPlayerSearch('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: PointLog) => {
    setEditingPoint(p);
    setTargetUserId(p.user_id);
    setSelectedUserIds([p.user_id]);
    setDate(p.date);
    setReason(p.reason);
    setPointsAmount(String(p.points));
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPoint(null);
  };

  const toggleSelectPlayer = (id: string) => {
    setSelectedUserIds(prev => 
      prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
    );
  };

  const handleSelectAllModal = () => {
    const visibleIds = modalProfiles.map(p => p.id);
    const newSelected = Array.from(new Set([...selectedUserIds, ...visibleIds]));
    setSelectedUserIds(newSelected);
  };

  const handleDeselectAllModal = () => {
    const visibleIds = new Set(modalProfiles.map(p => p.id));
    setSelectedUserIds(prev => prev.filter(id => !visibleIds.has(id)));
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPoint && selectedUserIds.length === 0) {
      showToast('error', 'Validación', 'Por favor selecciona al menos un jugador.');
      return;
    }
    if (editingPoint && !targetUserId) {
      showToast('error', 'Validación', 'Por favor selecciona un jugador.');
      return;
    }
    if (!reason.trim()) {
      showToast('error', 'Validación', 'El motivo es obligatorio.');
      return;
    }
    if (Number(pointsAmount) === 0) {
      showToast('error', 'Validación', 'Los puntos asignados no pueden ser cero.');
      return;
    }

    if (editingPoint) {
      const payload = {
        user_id: targetUserId,
        date,
        reason: reason.trim(),
        points: Number(pointsAmount)
      };
      updateMutation.mutate({ id: editingPoint.id, item: payload });
    } else {
      const items = selectedUserIds.map(userId => ({
        user_id: userId,
        date,
        reason: reason.trim(),
        points: Number(pointsAmount)
      }));
      createBulkMutation.mutate(items);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Confirmas que deseas eliminar este registro de puntos?')) {
      deleteMutation.mutate(id);
    }
  };

  // 1. Filtrar bitácora según visibilidad (Jugador solo ve las suyas)
  const visibleLogs = pointsLogs.filter(p => {
    if (isPlayer && p.user_id !== user?.id) return false;
    // Filtrar por equipo
    const pProfile = profiles.find(prof => prof.id === p.user_id);
    if (pProfile) {
      return (pProfile.team_category || 'Primer Equipo') === filterTeam;
    }
    return true;
  });

  // 2. Filtrado final en pantalla (búsqueda)
  const filteredLogs = visibleLogs.filter(p => {
    const pName = p.profiles ? (p.profiles.role_id === 3 ? (p.profiles.nickname || p.profiles.full_name) : p.profiles.full_name) : '';
    const matchSearch = 
      pName.toLowerCase().includes(search.toLowerCase()) ||
      p.reason.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  });

  // 3. Tabla de clasificación (Leaderboard) - Abierta para todo el vestuario
  const getLeaderboard = () => {
    // Agrupar por jugador
    const playerPointsMap: { [userId: string]: { name: string; avatar: string; points: number; email: string } } = {};
    
    // Inicializar con todos los perfiles de la base de datos (o los que tienen logs)
    // Para modo Demo o Supabase real, usaremos los perfiles vinculados en los logs y los profiles disponibles
    const allProfiles = (profiles.length > 0 ? profiles : pointsLogs.map(p => p.profiles).filter(Boolean) as Profile[]).filter(p => (p.team_category || 'Primer Equipo') === filterTeam);

    allProfiles.forEach(p => {
      // Solo jugadores en la tabla de posiciones
      if (p.role_id === 3) {
        playerPointsMap[p.id] = {
          name: p.nickname || p.full_name,
          email: p.email,
          avatar: p.avatar_url || '',
          points: 0
        };
      }
    });

    // Sumar puntos de los logs
    pointsLogs.forEach(log => {
      if (playerPointsMap[log.user_id]) {
        playerPointsMap[log.user_id].points += log.points;
      }
    });

    // Convertir a array y ordenar desc
    return Object.keys(playerPointsMap)
      .map(id => ({ id, ...playerPointsMap[id] }))
      .sort((a, b) => b.points - a.points);
  };

  const leaderboard = getLeaderboard();

  // Estadísticas globales del usuario (o acumuladas si es técnico)
  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  const totalPoints = visibleLogs.reduce((acc, p) => acc + p.points, 0);
  const monthlyPoints = visibleLogs.filter(p => filterByDate(p.date)).reduce((acc, p) => acc + p.points, 0);

  // Datos de exportación (definidos una sola vez, reutilizados por CSV y PDF)
  const exportHeaders = ['Fecha', 'Jugador', 'Motivo', 'Puntos'];
  const buildExportRows = (): ExportCell[][] =>
    filteredLogs.map(p => [
      p.date,
      p.profiles ? (p.profiles.role_id === 3 ? (p.profiles.nickname || p.profiles.full_name) : p.profiles.full_name) : 'Desconocido',
      p.reason,
      p.points,
    ]);

  const handleExportCSV = () => {
    if (filteredLogs.length === 0) {
      showToast('info', 'Exportar', 'No hay registros en la lista para exportar.');
      return;
    }
    exportToCSV(`puntos_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Histórico de puntos exportado.');
  };

  const handleExportPDF = async () => {
    if (filteredLogs.length === 0) {
      showToast('info', 'Exportar', 'No hay registros en la lista para exportar.');
      return;
    }
    await exportToPDF('Puntos UD Atzeneta', `puntos_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Histórico de puntos exportado en PDF.');
  };

  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  const isLoading = loadingPoints || (loadingProfiles && (canCreate || canEdit));

  return (
    <div className="space-y-6">
      {/* Pestañas de Equipo */}
      {(user?.role_id === 1 || user?.role_id === 4 || (user?.role_id === 2 && user?.team_category === 'Primer Equipo')) && (
        <div className="flex bg-brand-black-card border-b border-brand-black-border mb-2">
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${filterTeam === 'Primer Equipo' ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
            onClick={() => setFilterTeam('Primer Equipo')}
          >
            Primer Equipo
          </button>
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${filterTeam === 'Juvenil' ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
            onClick={() => setFilterTeam('Juvenil')}
          >
            Juvenil
          </button>
        </div>
      )}

      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Casillero de Rendimiento (+/- Puntos)</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Tabla clasificatoria y registros de motivación por goles, esfuerzo o penalizaciones.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canExport && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canCreate && (
            <button onClick={handleOpenCreateModal} className="btn-primary py-2 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Asignar Puntos
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          BLOQUES DE ESTADÍSTICAS
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Acumulado General */}
        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">
              {isPlayer ? 'Mi Puntuación Acumulada' : 'Total Puntos Asignados'}
            </span>
            <h3 className={`text-2xl font-bold mt-2 ${totalPoints >= 0 ? 'text-emerald-500' : 'text-brand-red-600'}`}>
              {totalPoints > 0 ? '+' : ''}{totalPoints} pts
            </h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Histórico de rendimiento</span>
          </div>
          <div className="p-3 bg-emerald-950/20 text-emerald-500 rounded-xl">
            <Trophy className="w-6 h-6" />
          </div>
        </div>

        {/* Acumulado Mensual */}
        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">
              Balance Mensual
            </span>
            <h3 className={`text-2xl font-bold mt-2 ${monthlyPoints >= 0 ? 'text-emerald-500' : 'text-brand-red-600'}`}>
              {monthlyPoints > 0 ? '+' : ''}{monthlyPoints} pts
            </h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Puntos generados en el mes activo</span>
          </div>
          <div className="flex gap-1 bg-brand-black border border-brand-black-border px-2 py-0.5 rounded shrink-0">
            <select 
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-[10px] text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
            >
              {months.map(m => <option key={m.value} value={m.value} className="bg-brand-black-card text-brand-gray-light">{m.label}</option>)}
            </select>
            <select 
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-[10px] text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
            >
              <option value={2026} className="bg-brand-black-card text-brand-gray-light">2026</option>
              <option value={2025} className="bg-brand-black-card text-brand-gray-light">2025</option>
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================================
          CONTENEDOR A DOS COLUMNAS: LEADERBOARD VS BITÁCORA
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* LEADERBOARD (5 cols) */}
        <div className="dashboard-card lg:col-span-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-brand-black-border pb-4 mb-4">
              <h3 className="text-sm font-semibold text-brand-gray-light">Clasificación del Vestuario</h3>
              <Award className="w-4 h-4 text-emerald-500" />
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-brand-gray-muted">No se registran jugadores en la clasificación.</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
                {leaderboard.map((item, index) => {
                  const rank = index + 1;
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-3 rounded-lg border transition-all ${
                        item.id === user?.id 
                          ? 'bg-brand-red-600/10 border-brand-red-600/30' 
                          : 'bg-brand-black-hover/40 border-brand-black-border'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {/* Puesto del ranking */}
                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center ${
                          rank === 1 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/30' :
                          rank === 2 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/30' :
                          rank === 3 ? 'bg-amber-700/20 text-amber-700 border border-amber-700/30' :
                          'bg-brand-black text-brand-gray-muted'
                        }`}>
                          {rank}
                        </span>

                        <img 
                          src={item.avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} 
                          alt={item.name} 
                          className="w-7 h-7 rounded-full border border-brand-black-border object-cover"
                        />
                        <span className="text-xs font-semibold text-brand-gray-light truncate max-w-[120px]">
                          {item.name}
                        </span>
                      </div>

                      <span className={`text-xs font-bold px-2 py-0.5 rounded bg-brand-black border border-brand-black-border ${
                        item.points >= 0 ? 'text-emerald-500' : 'text-brand-red-600'
                      }`}>
                        {item.points} pts
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* BITÁCORA DE TRANSACCIONES (7 cols) */}
        <div className="dashboard-card lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-brand-black-border pb-4 mb-4">
              <h3 className="text-sm font-semibold text-brand-gray-light">
                {isPlayer ? 'Mi Historial de Rendimiento' : 'Historial del Vestuario'}
              </h3>
              <div className="relative w-48">
                <Search className="absolute left-2.5 top-1.5 w-3 h-3 text-brand-gray-dark" />
                <input
                  type="text"
                  className="form-input pl-8 py-1 text-xs w-full bg-brand-black-bg"
                  placeholder="Buscar motivo..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>

            {isLoading ? (
              <TableSkeleton rows={4} />
            ) : filteredLogs.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-brand-gray-muted">No hay movimientos registrados.</p>
              </div>
            ) : (
              <div className="space-y-3.5 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
                {filteredLogs.map((log) => {
                  const isPositive = log.points > 0;
                  return (
                    <div 
                      key={log.id} 
                      className="p-3 bg-brand-black-hover/20 border border-brand-black-border rounded-xl flex gap-3.5 items-start justify-between"
                    >
                      <div className="flex gap-3 items-start min-w-0">
                        <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${
                          isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-red-600/10 text-brand-red-600'
                        }`}>
                          {isPositive ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <h4 className="text-xs font-semibold text-brand-gray-light leading-snug truncate">
                            {log.reason}
                          </h4>
                          <span className="text-[10px] text-brand-gray-muted flex items-center gap-1.5 mt-1.5">
                            <Calendar className="w-3 h-3" /> {log.date}
                            {!isPlayer && (
                              <>
                                <span>•</span>
                                <User className="w-3 h-3" /> {log.profiles ? (log.profiles.role_id === 3 ? (log.profiles.nickname || log.profiles.full_name) : log.profiles.full_name) : ''}
                              </>
                            )}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                          isPositive ? 'bg-emerald-500/10 text-emerald-400' : 'bg-brand-red-600/10 text-brand-red-600'
                        }`}>
                          {isPositive ? '+' : ''}{log.points} pts
                        </span>

                        {(canEdit || canDelete) && (
                          <div className="flex gap-1">
                            {canEdit && (
                              <button 
                                onClick={() => handleOpenEditModal(log)}
                                className="text-brand-gray-muted hover:text-brand-gray-light p-1 rounded bg-brand-black-hover border border-brand-black-border"
                              >
                                <Edit2 className="w-3 h-3" />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={() => handleDelete(log.id)}
                                className="text-brand-gray-muted hover:text-brand-red-600 p-1 rounded bg-brand-black-hover border border-brand-black-border hover:border-brand-red-600/10"
                              >
                                <Trash2 className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* =====================================================================
          MODAL CREAR / EDITAR
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPoint ? 'Modificar Registro de Puntos' : 'Asignar Puntos a Jugadores'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          {editingPoint ? (
            <div>
              <label className="form-label">Jugador Destinatario</label>
              <select
                value={targetUserId}
                onChange={(e) => setTargetUserId(e.target.value)}
                className="form-input bg-brand-black-bg"
              >
                <option value="">-- Seleccionar Jugador --</option>
                {profiles.map(p => (
                  <option key={p.id} value={p.id} className="bg-brand-black-card text-brand-gray-light">
                    {p.dorsal ? `#${p.dorsal} ` : ''}{p.role_id === 3 ? (p.nickname || p.full_name) : p.full_name}
                  </option>
                ))}
              </select>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="form-label flex items-center gap-1.5 mb-0">
                  <Users className="w-4 h-4 text-brand-red-600" />
                  Jugadores Destinatarios
                  <span className="text-xs font-normal text-brand-gray-muted ml-1">
                    ({selectedUserIds.length} seleccionados)
                  </span>
                </label>
                <div className="flex gap-2 text-xs">
                  <button
                    type="button"
                    onClick={handleSelectAllModal}
                    className="text-brand-red-500 hover:text-brand-red-400 font-semibold"
                  >
                    Seleccionar Todos
                  </button>
                  <span className="text-brand-gray-dark">|</span>
                  <button
                    type="button"
                    onClick={handleDeselectAllModal}
                    className="text-brand-gray-muted hover:text-brand-gray-light"
                  >
                    Desmarcar
                  </button>
                </div>
              </div>

              {/* Buscador dentro del modal */}
              <div className="relative">
                <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-brand-gray-dark" />
                <input
                  type="text"
                  className="form-input pl-8 py-1.5 text-xs w-full bg-brand-black-bg"
                  placeholder="Buscar por nombre o dorsal..."
                  value={modalPlayerSearch}
                  onChange={(e) => setModalPlayerSearch(e.target.value)}
                />
              </div>

              {/* Lista de selección de jugadores */}
              <div className="max-h-48 overflow-y-auto space-y-1.5 pr-1 border border-brand-black-border rounded-lg p-2 bg-brand-black-bg/50">
                {modalProfiles.length === 0 ? (
                  <p className="text-xs text-brand-gray-muted text-center py-4">
                    No se encontraron jugadores para esta búsqueda.
                  </p>
                ) : (
                  modalProfiles.map((p) => {
                    const isSelected = selectedUserIds.includes(p.id);
                    const playerName = p.role_id === 3 ? (p.nickname || p.full_name) : p.full_name;
                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleSelectPlayer(p.id)}
                        className={`flex items-center justify-between p-2 rounded-md cursor-pointer transition-all border ${
                          isSelected
                            ? 'bg-brand-red-600/15 border-brand-red-600/40 text-brand-gray-light'
                            : 'bg-brand-black-hover/30 border-transparent hover:bg-brand-black-hover text-brand-gray-muted hover:text-brand-gray-light'
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => {}}
                            className="form-checkbox rounded text-brand-red-600 focus:ring-brand-red-600 bg-brand-black-bg border-brand-black-border cursor-pointer"
                          />
                          <img
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                            alt={playerName}
                            className="w-6 h-6 rounded-full object-cover border border-brand-black-border shrink-0"
                          />
                          <span className="text-xs font-medium truncate">
                            {p.dorsal ? <strong className="text-brand-red-500 mr-1.5">#{p.dorsal}</strong> : null}
                            {playerName}
                          </span>
                        </div>
                        {isSelected && <Check className="w-3.5 h-3.5 text-brand-red-500 shrink-0" />}
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha del Suceso</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Puntos (+ / -)</label>
              <input
                type="number"
                className="form-input"
                placeholder="2"
                value={pointsAmount}
                onChange={(e) => setPointsAmount(e.target.value)}
              />
            </div>
          </div>

          {/* Puntuaciones rápidas */}
          <div>
            <label className="form-label">Puntuación Rápida</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {POINT_OPTIONS.map((pt) => {
                const isPos = pt > 0;
                const isSelected = pointsAmount === String(pt);
                return (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => setPointsAmount(String(pt))}
                    className={`text-[11px] font-bold px-3 py-1 rounded-full border transition-all ${
                      isSelected
                        ? isPos
                          ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                          : 'bg-brand-red-600/20 text-brand-red-600 border-brand-red-600/50'
                        : isPos
                          ? 'bg-brand-black-hover text-brand-gray-muted border-brand-black-border hover:text-emerald-400 hover:border-emerald-500/40'
                          : 'bg-brand-black-hover text-brand-gray-muted border-brand-black-border hover:text-brand-red-600 hover:border-brand-red-600/40'
                    }`}
                  >
                    {isPos ? '+' : ''}{pt}
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="form-label">Concepto o Razón</label>
            <input
              type="text"
              className="form-input"
              placeholder="Goleador del partido, esfuerzo físico, llegar tarde..."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button
              type="submit"
              disabled={createBulkMutation.isPending || createMutation.isPending}
              className="btn-primary py-2 text-xs font-semibold disabled:opacity-50"
            >
              {!editingPoint && selectedUserIds.length > 1
                ? `Registrar Puntos (${selectedUserIds.length} jugadores)`
                : 'Registrar Puntos'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
