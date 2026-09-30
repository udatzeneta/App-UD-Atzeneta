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
import {
  exportToCSV,
  exportToPDF,
  exportPointsLeaderboardToPDF,
  ExportCell,
} from '../utils/export';
import {
  Award, Search, Download, FileText, Plus, Trash2, Edit2,
  TrendingUp, TrendingDown, Calendar, User, Trophy, Users, Check,
  Loader2, Filter, Sparkles
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
  const [leaderboardTab, setLeaderboardTab] = useState<'monthly' | 'general'>('monthly');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPoint, setEditingPoint] = useState<PointLog | null>(null);

  // Modal exportar clasificación PDF con intervalo (Total / Mensual / Semanal / Personalizado)
  const [isExportPdfModalOpen, setIsExportPdfModalOpen] = useState(false);
  const [exportIntervalMode, setExportIntervalMode] = useState<'total' | 'monthly' | 'weekly' | 'custom'>('total');
  const [exportMonthlyMonth, setExportMonthlyMonth] = useState<number>(new Date().getMonth() + 1);
  const [exportMonthlyYear, setExportMonthlyYear] = useState<number>(new Date().getFullYear());
  const [exportWeeklyType, setExportWeeklyType] = useState<'current' | 'last' | 'custom'>('current');
  const [exportWeeklyRefDate, setExportWeeklyRefDate] = useState<string>(new Date().toISOString().split('T')[0]);
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportTeamFilter, setExportTeamFilter] = useState<'Primer Equipo' | 'Juvenil' | 'Todos'>('Primer Equipo');
  const [isExportingPdf, setIsExportingPdf] = useState(false);

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

  // Lista de todos los jugadores de ambos equipos para exportaciones completas
  const { data: allPlayersData = [] } = useQuery({
    queryKey: ['players-all-teams-points'],
    queryFn: async () => {
      try {
        const [p1, p2] = await Promise.all([
          dataService.getPlayers('Primer Equipo'),
          dataService.getPlayers('Juvenil')
        ]);
        return [...p1, ...p2];
      } catch {
        return [];
      }
    }
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles', filterTeam],
    queryFn: async () => {
      // 1. Obtener entrenadores (rol 2) de la tabla profiles
      const staffProfiles = await dataService.getProfilesByRoles([2]);
      
      // 2. Obtener la lista oficial de jugadores de la plantilla a través de dataService.getPlayers(filterTeam)
      const players = await dataService.getPlayers(filterTeam);
      
      // 3. Crear estructuras de perfil unificadas basadas únicamente en la plantilla de jugadores activos
      const playerProfiles = players.map(player => ({
        id: player.profile_id || player.id,
        player_id: player.id,
        profile_id: player.profile_id,
        role_id: 3,
        full_name: player.full_name,
        nickname: player.nickname || player.full_name,
        dorsal: player.dorsal,
        avatar_url: player.photo_url,
        team_category: player.team_category || filterTeam,
        email: player.email || ''
      }));
      
      // Ordenar: Jugadores primero (ordenados por dorsal ascendente) y luego entrenadores/staff
      const sortedPlayerProfiles = playerProfiles.sort((a, b) => (a.dorsal || 999) - (b.dorsal || 999));
      return [...sortedPlayerProfiles, ...staffProfiles];
    }
  });

  const [modalTeamFilter, setModalTeamFilter] = useState<'Primer Equipo' | 'Juvenil' | 'Todos'>('Primer Equipo');

  // Perfiles filtrados para la selección en el modal
  const modalProfiles = profiles.filter(p => {
    const pTeam = p.team_category || 'Primer Equipo';
    const matchesTeam = modalTeamFilter === 'Todos' || pTeam === modalTeamFilter;
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
    setModalTeamFilter(filterTeam as any || 'Primer Equipo');
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

  // Estadísticas globales del usuario (o acumuladas si es técnico)
  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  // 3. Tabla de clasificación (Leaderboard) - Soporta Mensual y General
  const getLeaderboard = (mode: 'general' | 'monthly' = leaderboardTab) => {
    // Agrupar por jugador
    const playerPointsMap: {
      [userId: string]: {
        name: string;
        avatar: string;
        dorsal?: number | string;
        points: number;
        positivePoints: number;
        negativePoints: number;
        eventsCount: number;
        email: string;
      };
    } = {};
    
    const allProfiles = (
      profiles.length > 0
        ? profiles
        : (pointsLogs.map(p => p.profiles).filter(Boolean) as Profile[])
    ).filter(p => (p.team_category || 'Primer Equipo') === filterTeam);

    allProfiles.forEach(p => {
      // Solo jugadores en la tabla de posiciones
      if (p.role_id === 3) {
        playerPointsMap[p.id] = {
          name: p.nickname || p.full_name,
          email: p.email,
          avatar: p.avatar_url || '',
          dorsal: p.dorsal,
          points: 0,
          positivePoints: 0,
          negativePoints: 0,
          eventsCount: 0
        };
      }
    });

    // Sumar puntos de los logs (filtrando por mes si el modo es mensual)
    pointsLogs.forEach(log => {
      if (mode === 'monthly' && !filterByDate(log.date)) return;

      if (playerPointsMap[log.user_id]) {
        playerPointsMap[log.user_id].points += log.points;
        if (log.points > 0) {
          playerPointsMap[log.user_id].positivePoints += log.points;
        } else {
          playerPointsMap[log.user_id].negativePoints += log.points;
        }
        playerPointsMap[log.user_id].eventsCount += 1;
      }
    });

    // Convertir a array y ordenar desc
    return Object.keys(playerPointsMap)
      .map(id => ({ id, ...playerPointsMap[id] }))
      .sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.positivePoints !== a.positivePoints) return b.positivePoints - a.positivePoints;
        return (Number(a.dorsal) || 999) - (Number(b.dorsal) || 999);
      });
  };

  const leaderboard = getLeaderboard(leaderboardTab);

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

  // Helper para calcular las fechas e intervalos según el modo seleccionado (Total, Mensual, Semanal, Personalizado)
  const getIntervalData = () => {
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    if (exportIntervalMode === 'total') {
      return {
        startDate: '',
        endDate: '',
        label: 'Todo el histórico (Acumulado Total)',
        shortLabel: 'Histórico Completo'
      };
    }

    if (exportIntervalMode === 'monthly') {
      const year = exportMonthlyYear;
      const month = exportMonthlyMonth;
      const monthObj = months.find(m => m.value === month);
      const monthName = monthObj ? monthObj.label : `Mes ${month}`;
      const monthStr = String(month).padStart(2, '0');
      const lastDay = new Date(year, month, 0).getDate();
      const lastDayStr = String(lastDay).padStart(2, '0');

      return {
        startDate: `${year}-${monthStr}-01`,
        endDate: `${year}-${monthStr}-${lastDayStr}`,
        label: `Mensual · ${monthName} ${year} (01/${monthStr}/${year} al ${lastDayStr}/${monthStr}/${year})`,
        shortLabel: `${monthName} ${year}`
      };
    }

    if (exportIntervalMode === 'weekly') {
      let targetDate = new Date();
      if (exportWeeklyType === 'last') {
        targetDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      } else if (exportWeeklyType === 'custom' && exportWeeklyRefDate) {
        const [y, m, d] = exportWeeklyRefDate.split('-').map(Number);
        targetDate = new Date(y, m - 1, d);
      }

      // Calcular lunes y domingo
      const day = targetDate.getDay(); // 0 es domingo, 1 es lunes...
      const diffToMonday = (day === 0 ? -6 : 1) - day;
      const monday = new Date(targetDate);
      monday.setDate(targetDate.getDate() + diffToMonday);

      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);

      const fmt = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${dayNum}`;
      };

      const fmtDisplay = (d: Date) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const dayNum = String(d.getDate()).padStart(2, '0');
        return `${dayNum}/${month}/${year}`;
      };

      const start = fmt(monday);
      const end = fmt(sunday);
      const labelPrefix = exportWeeklyType === 'current' ? 'Semana Actual' : exportWeeklyType === 'last' ? 'Semana Pasada' : 'Semana';

      return {
        startDate: start,
        endDate: end,
        label: `${labelPrefix} (Del ${fmtDisplay(monday)} al ${fmtDisplay(sunday)})`,
        shortLabel: `${labelPrefix} (${fmtDisplay(monday)} - ${fmtDisplay(sunday)})`
      };
    }

    // Modo Personalizado
    let label = 'Personalizado';
    let shortLabel = 'Personalizado';
    if (exportStartDate && exportEndDate) {
      const [sy, sm, sd] = exportStartDate.split('-');
      const [ey, em, ed] = exportEndDate.split('-');
      label = `Personalizado (${sd}/${sm}/${sy} al ${ed}/${em}/${ey})`;
      shortLabel = `${sd}/${sm}/${sy} - ${ed}/${em}/${ey}`;
    } else if (exportStartDate) {
      const [sy, sm, sd] = exportStartDate.split('-');
      label = `Desde el ${sd}/${sm}/${sy}`;
      shortLabel = `Desde ${sd}/${sm}/${sy}`;
    } else if (exportEndDate) {
      const [ey, em, ed] = exportEndDate.split('-');
      label = `Hasta el ${ed}/${em}/${ey}`;
      shortLabel = `Hasta ${ed}/${em}/${ey}`;
    }

    return {
      startDate: exportStartDate,
      endDate: exportEndDate,
      label,
      shortLabel
    };
  };

  // Calcula la clasificación agrupada por jugador para el intervalo y equipo seleccionados en el modal
  const getExportLeaderboard = () => {
    const { startDate, endDate } = getIntervalData();
    const playerMap: Record<
      string,
      {
        id: string;
        name: string;
        fullName: string;
        dorsal?: number | string;
        avatarUrl?: string;
        points: number;
        positivePoints: number;
        negativePoints: number;
        eventsCount: number;
        teamCategory?: string;
      }
    > = {};

    // 1. Unificar plantilla de jugadores
    const squadPlayers = allPlayersData.length > 0 ? allPlayersData : profiles.filter(p => p.role_id === 3);

    squadPlayers.forEach((p: any) => {
      const pTeam = p.team_category || 'Primer Equipo';
      const matchesTeam = exportTeamFilter === 'Todos' || pTeam === exportTeamFilter;
      if (matchesTeam) {
        const id = p.profile_id || p.id;
        playerMap[id] = {
          id,
          name: p.nickname || p.full_name,
          fullName: p.full_name,
          dorsal: p.dorsal,
          avatarUrl: p.photo_url || p.avatar_url || '',
          points: 0,
          positivePoints: 0,
          negativePoints: 0,
          eventsCount: 0,
          teamCategory: pTeam
        };
      }
    });

    // 2. Sumar puntos de los logs dentro del intervalo
    let totalPointsInInterval = 0;
    let totalEventsInInterval = 0;

    pointsLogs.forEach(log => {
      // Filtro de fechas
      if (startDate && log.date < startDate) return;
      if (endDate && log.date > endDate) return;

      if (playerMap[log.user_id]) {
        playerMap[log.user_id].points += log.points;
        if (log.points > 0) {
          playerMap[log.user_id].positivePoints += log.points;
        } else {
          playerMap[log.user_id].negativePoints += log.points;
        }
        playerMap[log.user_id].eventsCount += 1;
        totalPointsInInterval += log.points;
        totalEventsInInterval += 1;
      } else if (log.profiles && log.profiles.role_id === 3) {
        const pTeam = log.profiles.team_category || 'Primer Equipo';
        if (exportTeamFilter === 'Todos' || pTeam === exportTeamFilter) {
          playerMap[log.user_id] = {
            id: log.user_id,
            name: log.profiles.nickname || log.profiles.full_name,
            fullName: log.profiles.full_name,
            dorsal: log.profiles.dorsal,
            avatarUrl: log.profiles.avatar_url || '',
            points: log.points,
            positivePoints: log.points > 0 ? log.points : 0,
            negativePoints: log.points < 0 ? log.points : 0,
            eventsCount: 1,
            teamCategory: pTeam
          };
          totalPointsInInterval += log.points;
          totalEventsInInterval += 1;
        }
      }
    });

    // 3. Ordenar: Puntos desc -> Positivos desc -> Dorsal asc
    const sorted = Object.values(playerMap).sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      if (b.positivePoints !== a.positivePoints) return b.positivePoints - a.positivePoints;
      return (Number(a.dorsal) || 999) - (Number(b.dorsal) || 999);
    });

    const leaderboardWithRank = sorted.map((item, idx) => ({
      ...item,
      rank: idx + 1
    }));

    return {
      leaderboard: leaderboardWithRank,
      totalPointsInInterval,
      totalEventsInInterval
    };
  };

  const handleOpenExportPdfModal = () => {
    setExportTeamFilter(filterTeam as any || 'Primer Equipo');
    setExportIntervalMode('total');
    setExportMonthlyMonth(selectedMonth);
    setExportMonthlyYear(selectedYear);
    setExportWeeklyType('current');
    setExportWeeklyRefDate(new Date().toISOString().split('T')[0]);
    setIsExportPdfModalOpen(true);
  };

  const handleGeneratePdf = async () => {
    try {
      setIsExportingPdf(true);
      const { startDate, endDate, label: intervalLabel } = getIntervalData();
      const { leaderboard, totalPointsInInterval, totalEventsInInterval } = getExportLeaderboard();

      if (leaderboard.length === 0) {
        showToast('error', 'Sin datos', 'No hay jugadores en la clasificación para este criterio.');
        setIsExportingPdf(false);
        return;
      }

      await exportPointsLeaderboardToPDF({
        title: 'CLASIFICACIÓN DE RENDIMIENTO (+/- PUNTOS)',
        teamName: exportTeamFilter,
        intervalLabel,
        startDate,
        endDate,
        leaderboard,
        totalPointsInInterval,
        totalEventsInInterval
      });

      showToast('success', 'PDF Generado', 'La clasificación se ha descargado correctamente.');
      setIsExportPdfModalOpen(false);
    } catch (err: any) {
      console.error('Error al generar PDF de puntos:', err);
      showToast('error', 'Error al exportar', err?.message || 'No se pudo generar el documento PDF.');
    } finally {
      setIsExportingPdf(false);
    }
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
      {(user?.role_id === 1 || user?.role_id === 4 || user?.role_id === 2 || (user?.availableContexts && user.availableContexts.length > 0)) && (
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
              <button onClick={handleOpenExportPdfModal} className="btn-secondary py-2 text-xs">
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-brand-black-border pb-3 mb-3 gap-2">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-brand-gray-light">Clasificación del Vestuario</h3>
                <Award className="w-4 h-4 text-emerald-500" />
              </div>

              {/* Selector de Pestaña: Mensual vs General */}
              <div className="flex bg-brand-black p-0.5 rounded-lg border border-brand-black-border gap-0.5 self-start sm:self-auto">
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('monthly')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    leaderboardTab === 'monthly'
                      ? 'bg-brand-red-600 text-white shadow-sm'
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  <Calendar className="w-3 h-3" />
                  {months.find(m => m.value === selectedMonth)?.label || 'Mes'}
                </button>
                <button
                  type="button"
                  onClick={() => setLeaderboardTab('general')}
                  className={`px-2.5 py-1 text-[11px] font-bold rounded-md transition-all flex items-center gap-1 ${
                    leaderboardTab === 'general'
                      ? 'bg-brand-red-600 text-white shadow-sm'
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  <Trophy className="w-3 h-3" />
                  General
                </button>
              </div>
            </div>

            {/* Sub-cabecera con información del ranking activo */}
            <div className="flex items-center justify-between text-[11px] text-brand-gray-muted px-1 mb-3">
              <span>
                {leaderboardTab === 'monthly' ? (
                  <>
                    Ranking de <strong className="text-brand-gray-light">{months.find(m => m.value === selectedMonth)?.label} {selectedYear}</strong>
                  </>
                ) : (
                  <>Acumulado total de la temporada</>
                )}
              </span>
              <span className="font-semibold text-brand-gray-light">
                {leaderboard.length} jugadores
              </span>
            </div>

            {leaderboard.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-brand-gray-muted">No se registran jugadores en la clasificación.</p>
              </div>
            ) : (
              <div className="space-y-2.5 max-h-[450px] overflow-y-auto pr-1 no-scrollbar">
                {leaderboard.map((item, index) => {
                  const rank = index + 1;
                  return (
                    <div 
                      key={item.id} 
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-all ${
                        item.id === user?.id 
                          ? 'bg-brand-red-600/10 border-brand-red-600/30' 
                          : 'bg-brand-black-hover/40 border-brand-black-border'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        {/* Puesto del ranking */}
                        <span className={`text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
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
                          className="w-7 h-7 rounded-full border border-brand-black-border object-cover shrink-0"
                        />
                        
                        <div className="min-w-0">
                          <div className="flex items-center gap-1.5">
                            {item.dorsal ? (
                              <span className="text-[10px] font-bold text-brand-gray-muted">
                                #{item.dorsal}
                              </span>
                            ) : null}
                            <span className="text-xs font-semibold text-brand-gray-light truncate">
                              {item.name}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        {leaderboardTab === 'monthly' && item.eventsCount > 0 ? (
                          <span className="text-[10px] text-brand-gray-muted hidden sm:inline">
                            {item.eventsCount} reg.
                          </span>
                        ) : null}
                        <span className={`text-xs font-bold px-2 py-0.5 rounded bg-brand-black border border-brand-black-border ${
                          item.points > 0 ? 'text-emerald-500' : item.points < 0 ? 'text-brand-red-600' : 'text-brand-gray-muted'
                        }`}>
                          {item.points > 0 ? '+' : ''}{item.points} pts
                        </span>
                      </div>
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
                    {p.dorsal ? `${p.dorsal}. ` : ''}{p.role_id === 3 ? (p.nickname || p.full_name) : p.full_name}
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

              {/* Selector rápido de equipo dentro del modal */}
              <div className="flex bg-brand-black p-1 rounded-lg border border-brand-black-border gap-1">
                <button
                  type="button"
                  onClick={() => setModalTeamFilter('Primer Equipo')}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
                    modalTeamFilter === 'Primer Equipo'
                      ? 'bg-brand-red-600 text-white shadow'
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  Primer Equipo
                </button>
                <button
                  type="button"
                  onClick={() => setModalTeamFilter('Juvenil')}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
                    modalTeamFilter === 'Juvenil'
                      ? 'bg-brand-red-600 text-white shadow'
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  Juvenil
                </button>
                <button
                  type="button"
                  onClick={() => setModalTeamFilter('Todos')}
                  className={`flex-1 py-1 text-xs font-semibold rounded-md transition-colors ${
                    modalTeamFilter === 'Todos'
                      ? 'bg-brand-red-600 text-white shadow'
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  Todos
                </button>
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
              <div className="max-h-72 overflow-y-auto space-y-1.5 pr-1 border border-brand-black-border rounded-lg p-2 bg-brand-black-bg/50">
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
                          {p.dorsal ? (
                            <span className="w-6 h-6 rounded-full bg-brand-red-600/20 border border-brand-red-600/40 text-brand-red-500 font-extrabold text-[11px] flex items-center justify-center shrink-0 shadow-sm">
                              {p.dorsal}
                            </span>
                          ) : null}
                          <img
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                            alt={playerName}
                            className="w-6 h-6 rounded-full object-cover border border-brand-black-border shrink-0"
                          />
                          <span className="text-xs font-medium truncate">
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

      {/* =====================================================================
          MODAL EXPORTAR CLASIFICACIÓN A PDF CON INTERVALO
          ===================================================================== */}
      <Modal
        isOpen={isExportPdfModalOpen}
        onClose={() => !isExportingPdf && setIsExportPdfModalOpen(false)}
        title="Exportar Clasificación a PDF"
        maxWidth="max-w-xl"
      >
        <div className="space-y-5">
          <p className="text-xs text-brand-gray-muted">
            Configura el intervalo a recoger de puntos (total, mensual, semanal o personalizado) y descarga la clasificación oficial con foto, dorsal y balance de puntos.
          </p>

          {/* 1. Selector de Tipo de Intervalo (Total / Mensual / Semanal / Personalizado) */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-gray-light block">Tipo de Intervalo</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-brand-black p-1.5 rounded-xl border border-brand-black-border">
              <button
                type="button"
                onClick={() => setExportIntervalMode('total')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                  exportIntervalMode === 'total'
                    ? 'bg-brand-red-600 text-white shadow-md'
                    : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover/40'
                }`}
              >
                <Trophy className="w-3.5 h-3.5" /> Total
              </button>
              <button
                type="button"
                onClick={() => setExportIntervalMode('monthly')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                  exportIntervalMode === 'monthly'
                    ? 'bg-brand-red-600 text-white shadow-md'
                    : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover/40'
                }`}
              >
                <Calendar className="w-3.5 h-3.5" /> Mensual
              </button>
              <button
                type="button"
                onClick={() => setExportIntervalMode('weekly')}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                  exportIntervalMode === 'weekly'
                    ? 'bg-brand-red-600 text-white shadow-md'
                    : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover/40'
                }`}
              >
                <TrendingUp className="w-3.5 h-3.5" /> Semanal
              </button>
              <button
                type="button"
                onClick={() => {
                  setExportIntervalMode('custom');
                  if (!exportStartDate) {
                    const d = new Date();
                    d.setDate(d.getDate() - 30);
                    setExportStartDate(d.toISOString().split('T')[0]);
                    setExportEndDate(new Date().toISOString().split('T')[0]);
                  }
                }}
                className={`flex items-center justify-center gap-1.5 py-2 px-2 text-xs font-bold rounded-lg transition-all ${
                  exportIntervalMode === 'custom'
                    ? 'bg-brand-red-600 text-white shadow-md'
                    : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover/40'
                }`}
              >
                <Filter className="w-3.5 h-3.5" /> Personalizado
              </button>
            </div>
          </div>

          {/* 2. Controles específicos según el tipo de intervalo */}
          {exportIntervalMode === 'total' && (
            <div className="p-3 bg-brand-black/40 border border-brand-black-border rounded-xl flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 shrink-0">
                <Trophy className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-semibold text-brand-gray-light">Histórico Completo de Puntos</p>
                <p className="text-[11px] text-brand-gray-muted mt-0.5">
                  Se calculará el total acumulado de todos los puntos asignados a la plantilla durante toda la temporada.
                </p>
              </div>
            </div>
          )}

          {exportIntervalMode === 'monthly' && (
            <div className="p-3.5 bg-brand-black/40 border border-brand-black-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-gray-light">Seleccionar Mes y Año</span>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      setExportMonthlyMonth(now.getMonth() + 1);
                      setExportMonthlyYear(now.getFullYear());
                    }}
                    className="text-brand-red-500 hover:text-brand-red-400 font-semibold"
                  >
                    Mes Actual
                  </button>
                  <span className="text-brand-gray-dark">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const prev = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
                      setExportMonthlyMonth(prev.getMonth() + 1);
                      setExportMonthlyYear(prev.getFullYear());
                    }}
                    className="text-brand-gray-muted hover:text-brand-gray-light"
                  >
                    Mes Anterior
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-gray-muted block mb-1">Mes</label>
                  <select
                    value={exportMonthlyMonth}
                    onChange={(e) => setExportMonthlyMonth(Number(e.target.value))}
                    className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                  >
                    {months.map((m) => (
                      <option key={m.value} value={m.value} className="bg-brand-black-card text-brand-gray-light">
                        {m.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-gray-muted block mb-1">Año</label>
                  <select
                    value={exportMonthlyYear}
                    onChange={(e) => setExportMonthlyYear(Number(e.target.value))}
                    className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                  >
                    {[2027, 2026, 2025, 2024].map((y) => (
                      <option key={y} value={y} className="bg-brand-black-card text-brand-gray-light">
                        {y}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="text-[11px] text-brand-gray-muted flex items-center gap-1.5 pt-0.5">
                <Calendar className="w-3.5 h-3.5 text-brand-red-500" />
                <span>
                  Intervalo exacto:{' '}
                  <strong className="text-brand-gray-light">
                    01/{String(exportMonthlyMonth).padStart(2, '0')}/{exportMonthlyYear} al{' '}
                    {new Date(exportMonthlyYear, exportMonthlyMonth, 0).getDate()}/
                    {String(exportMonthlyMonth).padStart(2, '0')}/{exportMonthlyYear}
                  </strong>
                </span>
              </div>
            </div>
          )}

          {exportIntervalMode === 'weekly' && (
            <div className="p-3.5 bg-brand-black/40 border border-brand-black-border rounded-xl space-y-3">
              <span className="text-xs font-semibold text-brand-gray-light block">Seleccionar Semana</span>
              
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => setExportWeeklyType('current')}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                    exportWeeklyType === 'current'
                      ? 'bg-brand-red-600/20 border-brand-red-600/60 text-brand-red-500'
                      : 'bg-brand-black-hover/40 border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  Esta Semana
                </button>
                <button
                  type="button"
                  onClick={() => setExportWeeklyType('last')}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                    exportWeeklyType === 'last'
                      ? 'bg-brand-red-600/20 border-brand-red-600/60 text-brand-red-500'
                      : 'bg-brand-black-hover/40 border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  Semana Pasada
                </button>
                <button
                  type="button"
                  onClick={() => setExportWeeklyType('custom')}
                  className={`py-1.5 px-2 text-xs font-semibold rounded-lg border transition-all ${
                    exportWeeklyType === 'custom'
                      ? 'bg-brand-red-600/20 border-brand-red-600/60 text-brand-red-500'
                      : 'bg-brand-black-hover/40 border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  Otra Fecha
                </button>
              </div>

              {exportWeeklyType === 'custom' && (
                <div>
                  <label className="text-[11px] font-medium text-brand-gray-muted block mb-1">
                    Día dentro de la semana que deseas recoger:
                  </label>
                  <input
                    type="date"
                    className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                    value={exportWeeklyRefDate}
                    onChange={(e) => setExportWeeklyRefDate(e.target.value)}
                  />
                </div>
              )}

              {(() => {
                const { startDate, endDate } = getIntervalData();
                if (!startDate || !endDate) return null;
                const [sy, sm, sd] = startDate.split('-');
                const [ey, em, ed] = endDate.split('-');
                return (
                  <div className="text-[11px] text-brand-gray-muted flex items-center gap-1.5 pt-0.5">
                    <Calendar className="w-3.5 h-3.5 text-brand-red-500" />
                    <span>
                      Semana activa:{' '}
                      <strong className="text-brand-gray-light">
                        Lunes {sd}/{sm}/{sy} al Domingo {ed}/{em}/{ey}
                      </strong>
                    </span>
                  </div>
                );
              })()}
            </div>
          )}

          {exportIntervalMode === 'custom' && (
            <div className="p-3.5 bg-brand-black/40 border border-brand-black-border rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-brand-gray-light">Rango Personalizado de Fechas</span>
                <div className="flex gap-1 text-[11px]">
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const past = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                      setExportStartDate(past.toISOString().split('T')[0]);
                      setExportEndDate(now.toISOString().split('T')[0]);
                    }}
                    className="text-brand-red-500 hover:text-brand-red-400 font-semibold"
                  >
                    Últimos 30 días
                  </button>
                  <span className="text-brand-gray-dark">|</span>
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date();
                      const past = new Date(now.getTime() - 15 * 24 * 60 * 60 * 1000);
                      setExportStartDate(past.toISOString().split('T')[0]);
                      setExportEndDate(now.toISOString().split('T')[0]);
                    }}
                    className="text-brand-gray-muted hover:text-brand-gray-light"
                  >
                    Últimos 15 días
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-gray-muted block mb-1">Fecha Inicio (Desde)</label>
                  <input
                    type="date"
                    className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                    value={exportStartDate}
                    onChange={(e) => setExportStartDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] uppercase font-bold text-brand-gray-muted block mb-1">Fecha Fin (Hasta)</label>
                  <input
                    type="date"
                    className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                    value={exportEndDate}
                    onChange={(e) => setExportEndDate(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          {/* 3. Selector de Equipo */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-brand-gray-light block">Equipo / Categoría</label>
            <div className="flex bg-brand-black p-1 rounded-lg border border-brand-black-border gap-1">
              <button
                type="button"
                onClick={() => setExportTeamFilter('Primer Equipo')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  exportTeamFilter === 'Primer Equipo'
                    ? 'bg-brand-red-600 text-white shadow'
                    : 'text-brand-gray-muted hover:text-brand-gray-light'
                }`}
              >
                Primer Equipo
              </button>
              <button
                type="button"
                onClick={() => setExportTeamFilter('Juvenil')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  exportTeamFilter === 'Juvenil'
                    ? 'bg-brand-red-600 text-white shadow'
                    : 'text-brand-gray-muted hover:text-brand-gray-light'
                }`}
              >
                Juvenil
              </button>
              <button
                type="button"
                onClick={() => setExportTeamFilter('Todos')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                  exportTeamFilter === 'Todos'
                    ? 'bg-brand-red-600 text-white shadow'
                    : 'text-brand-gray-muted hover:text-brand-gray-light'
                }`}
              >
                Todos
              </button>
            </div>
          </div>

          {/* 4. Resumen y Vista Previa en Vivo */}
          {(() => {
            const preview = getExportLeaderboard();
            const top3 = preview.leaderboard.slice(0, 3);
            const { shortLabel } = getIntervalData();
            return (
              <div className="bg-brand-black/60 border border-brand-black-border rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-brand-black-border pb-2.5">
                  <div className="flex items-center gap-2">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                    <span className="text-xs font-semibold text-brand-gray-light">
                      Resumen del Intervalo ({shortLabel})
                    </span>
                  </div>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                    preview.totalPointsInInterval >= 0 ? 'bg-emerald-500/15 text-emerald-400' : 'bg-brand-red-600/15 text-brand-red-500'
                  }`}>
                    {preview.totalPointsInInterval > 0 ? '+' : ''}{preview.totalPointsInInterval} pts totales
                  </span>
                </div>

                <div className="grid grid-cols-3 gap-2 text-center text-xs py-1">
                  <div className="p-2 bg-brand-black-hover/20 rounded-lg">
                    <span className="text-[10px] text-brand-gray-muted block">Jugadores</span>
                    <span className="font-bold text-brand-gray-light">{preview.leaderboard.length}</span>
                  </div>
                  <div className="p-2 bg-brand-black-hover/20 rounded-lg">
                    <span className="text-[10px] text-brand-gray-muted block">Anotaciones</span>
                    <span className="font-bold text-brand-gray-light">{preview.totalEventsInInterval}</span>
                  </div>
                  <div className="p-2 bg-brand-black-hover/20 rounded-lg">
                    <span className="text-[10px] text-brand-gray-muted block">Equipo</span>
                    <span className="font-bold text-brand-gray-light truncate">{exportTeamFilter}</span>
                  </div>
                </div>

                {top3.length > 0 && (
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-semibold text-brand-gray-muted block">Líderes provisionales del intervalo:</span>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      {top3.map((item, idx) => (
                        <div
                          key={item.id}
                          className="flex items-center gap-2 p-2 rounded-lg bg-brand-black-hover/40 border border-brand-black-border"
                        >
                          <span className={`w-5 h-5 rounded-full text-[10px] font-extrabold flex items-center justify-center shrink-0 ${
                            idx === 0 ? 'bg-yellow-500/20 text-yellow-500 border border-yellow-500/40' :
                            idx === 1 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/40' :
                            'bg-amber-700/20 text-amber-700 border border-amber-700/40'
                          }`}>
                            {idx + 1}
                          </span>
                          <img
                            src={item.avatarUrl || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                            alt={item.name}
                            className="w-6 h-6 rounded-full object-cover border border-brand-black-border shrink-0"
                          />
                          <div className="min-w-0 flex-1">
                            <p className="text-xs font-semibold text-brand-gray-light truncate">{item.name}</p>
                            <span className={`text-[10px] font-bold ${item.points >= 0 ? 'text-emerald-400' : 'text-brand-red-500'}`}>
                              {item.points > 0 ? '+' : ''}{item.points} pts
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })()}

          {/* Botones de acción */}
          <div className="flex gap-2 pt-2 justify-end">
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={() => setIsExportPdfModalOpen(false)}
              className="btn-secondary py-2 text-xs"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={isExportingPdf}
              onClick={handleGeneratePdf}
              className="btn-primary py-2 text-xs font-semibold flex items-center gap-1.5 disabled:opacity-50"
            >
              {isExportingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando PDF...
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5" /> Descargar Clasificación (PDF)
                </>
              )}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
