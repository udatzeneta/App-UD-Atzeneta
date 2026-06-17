import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { TrainingAttendance, AttendanceStatus, Profile } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  ClipboardCheck, Download, FileText, Calendar, 
  TrendingUp, Users, Info, Award, UserCheck, MessageSquare
} from 'lucide-react';

// Opciones de asistencia con etiquetas, colores e información
const STATUS_OPTIONS = [
  { value: 'Entrena', label: 'Presente', short: 'ENT', color: 'emerald', desc: 'Presente y entrena normal' },
  { value: 'A', label: 'Ausente', short: 'A', color: 'rose', desc: 'Ausente sin justificar' },
  { value: 'ED', label: 'Entrenó Diferenciado', short: 'ED', color: 'amber', desc: 'Entrenamiento adaptado o físico aparte' },
  { value: 'L', label: 'Lesionado', short: 'L', color: 'red', desc: 'Baja por lesión deportiva' },
  { value: 'E', label: 'Enfermo', short: 'E', color: 'yellow', desc: 'Indisposición médica o enfermedad' },
  { value: 'P', label: 'Partido', short: 'P', color: 'blue', desc: 'Ausencia por convocatoria o partido' },
  { value: 'LJ', label: 'Libre, Jugó', short: 'LJ', color: 'indigo', desc: 'Día libre pero jugó con filial/otro' },
  { value: 'V', label: 'Viaje', short: 'V', color: 'teal', desc: 'Ausencia justificada por viaje' },
  { value: 'AA', label: 'Ausente con Aviso', short: 'AA', color: 'slate', desc: 'Ausencia reportada previamente' },
  { value: 'AO', label: 'Ausente, Otros', short: 'AO', color: 'pink', desc: 'Otros motivos particulares' },
  { value: 'D', label: 'Descanso', short: 'D', color: 'gray', desc: 'Día libre programado o descanso' }
] as const;

export const Attendance: React.FC = () => {
  const queryClient = useQueryClient();
  const { roleSlug, user, hasPermission } = usePermissions();
  const { showToast } = useToast();

  const isPlayer = roleSlug === 'player';
  const canEdit = hasPermission('attendance', 'editar') || hasPermission('attendance', 'crear');
  const canExport = hasPermission('attendance', 'exportar');

  // Estados de control
  const [activeTab, setActiveTab] = useState<'monthly' | 'session' | 'evolution'>('monthly');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  
  // Para la edición de una celda individual
  const [editingCell, setEditingCell] = useState<{ trainingId: string; userId: string; status: AttendanceStatus; observations: string } | null>(null);

  // Estados temporales del Pase de Lista
  const [rollCallList, setRollCallList] = useState<Record<string, { status: AttendanceStatus; observations: string }>>({});

  // Queries
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => authService.getProfiles()
  });

  const { data: trainings = [], isLoading: loadingTrainings } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings()
  });

  const { data: attendanceData = [], isLoading: loadingAttendance } = useQuery({
    queryKey: ['attendance', selectedYear, selectedMonth],
    queryFn: () => dataService.getAttendanceByMonth(selectedYear, selectedMonth)
  });

  // Filtrar jugadores y entrenamientos para el mes seleccionado
  const players = isPlayer && user 
    ? profiles.filter(p => p.id === user.id) 
    : profiles.filter(p => p.role_id === 3);

  const monthlyTrainings = trainings
    .filter(t => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && (d.getMonth() + 1) === selectedMonth;
    })
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  // Actualizar jugador seleccionado por defecto al cargar perfiles
  useEffect(() => {
    if (players.length > 0 && !selectedPlayerId) {
      setSelectedPlayerId(players[0].id);
    }
  }, [profiles, selectedPlayerId, players]);

  // Actualizar entrenamiento seleccionado al cambiar de mes
  useEffect(() => {
    if (monthlyTrainings.length > 0) {
      setSelectedTrainingId(monthlyTrainings[0].id);
    } else {
      setSelectedTrainingId('');
    }
  }, [selectedMonth, selectedYear, trainings]);

  // Inicializar rollCallList cuando se cambia de entrenamiento
  useEffect(() => {
    if (!selectedTrainingId) return;
    
    const initialRollCall: Record<string, { status: AttendanceStatus; observations: string }> = {};
    players.forEach(p => {
      const log = attendanceData.find(a => a.training_id === selectedTrainingId && a.user_id === p.id);
      initialRollCall[p.id] = {
        status: log?.status || 'Entrena',
        observations: log?.observations || ''
      };
    });
    setRollCallList(initialRollCall);
  }, [selectedTrainingId, attendanceData]);

  // Mutaciones
  const updateAttendanceMutation = useMutation({
    mutationFn: ({ trainingId, userId, status, observations }: { trainingId: string; userId: string; status: AttendanceStatus; observations?: string }) =>
      dataService.updateAttendance(trainingId, userId, status, observations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      showToast('success', 'Asistencia Guardada', 'Se ha guardado el estado de asistencia.');
      setEditingCell(null);
    },
    onError: (err) => showToast('error', 'Error al actualizar', err.message)
  });

  const saveRollCallMutation = useMutation({
    mutationFn: ({ trainingId, list }: { trainingId: string; list: Omit<TrainingAttendance, 'id'>[] }) =>
      dataService.saveAttendanceList(trainingId, list),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      showToast('success', 'Pase de Lista Guardado', 'Se han registrado todas las asistencias de esta sesión.');
    },
    onError: (err) => showToast('error', 'Error al guardar', err.message)
  });

  // Métodos de ayuda
  const getStatusStyles = (status: string) => {
    switch (status) {
      case 'Entrena':
        return 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30';
      case 'A':
        return 'bg-rose-950/40 text-rose-400 border-rose-900/30';
      case 'ED':
        return 'bg-amber-950/40 text-amber-400 border-amber-900/30';
      case 'L':
        return 'bg-red-950/40 text-red-400 border-red-900/30';
      case 'E':
        return 'bg-yellow-950/40 text-yellow-400 border-yellow-900/30';
      case 'P':
        return 'bg-blue-950/40 text-blue-400 border-blue-900/30';
      case 'LJ':
        return 'bg-indigo-950/40 text-indigo-400 border-indigo-900/30';
      case 'V':
        return 'bg-teal-950/40 text-teal-400 border-teal-900/30';
      case 'AA':
        return 'bg-slate-800 text-slate-300 border-slate-700/50';
      case 'AO':
        return 'bg-pink-950/40 text-pink-400 border-pink-900/30';
      case 'D':
        return 'bg-brand-black-border text-brand-gray-muted border-brand-black-border/50';
      default:
        return 'bg-brand-black text-brand-gray-dark border-brand-black-border';
    }
  };

  const getStatusLabel = (status: string) => {
    return STATUS_OPTIONS.find(opt => opt.value === status)?.label || status;
  };

  const getStatusShort = (status: string) => {
    return STATUS_OPTIONS.find(opt => opt.value === status)?.short || status;
  };

  const handleCellClick = (trainingId: string, userId: string) => {
    const log = attendanceData.find(a => a.training_id === trainingId && a.user_id === userId);
    setEditingCell({
      trainingId,
      userId,
      status: log?.status || 'Entrena',
      observations: log?.observations || ''
    });
  };

  const handleSaveCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;
    updateAttendanceMutation.mutate({
      trainingId: editingCell.trainingId,
      userId: editingCell.userId,
      status: editingCell.status,
      observations: editingCell.observations.trim()
    });
  };

  const handleRollCallChange = (playerId: string, status: AttendanceStatus) => {
    setRollCallList(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        status
      }
    }));
  };

  const handleRollCallObservationChange = (playerId: string, obs: string) => {
    setRollCallList(prev => ({
      ...prev,
      [playerId]: {
        ...prev[playerId],
        observations: obs
      }
    }));
  };

  const handleSaveRollCall = () => {
    if (!selectedTrainingId) return;
    const listPayload: Omit<TrainingAttendance, 'id'>[] = Object.keys(rollCallList).map(userId => ({
      training_id: selectedTrainingId,
      user_id: userId,
      status: rollCallList[userId].status,
      observations: rollCallList[userId].observations.trim()
    }));

    saveRollCallMutation.mutate({
      trainingId: selectedTrainingId,
      list: listPayload
    });
  };

  // Cálculo de estadísticas agregadas para el mes
  const calculatePlayerMonthStats = (playerId: string) => {
    const playerLogs = attendanceData.filter(a => a.user_id === playerId);
    const completedMonthTrainings = monthlyTrainings.filter(t => t.status === 'Realizado');
    const totalSessions = completedMonthTrainings.length;

    let entrena = 0;
    let ausente = 0;
    let diferenciado = 0;
    let lesionado = 0;
    let otros = 0;

    completedMonthTrainings.forEach(t => {
      const log = playerLogs.find(a => a.training_id === t.id);
      const status = log?.status || 'Entrena'; // si no está logueado, por defecto entrena

      if (status === 'Entrena') entrena++;
      else if (['A', 'AA', 'AO'].includes(status)) ausente++;
      else if (status === 'ED') diferenciado++;
      else if (['L', 'E'].includes(status)) lesionado++;
      else otros++;
    });

    const activeSessions = totalSessions - otros; // Restar descansos y partidos
    const percent = activeSessions > 0 ? Math.round((entrena / activeSessions) * 100) : 100;

    return { totalSessions, entrena, ausente, diferenciado, lesionado, otros, percent };
  };

  // Promedio mensual de asistencia del vestuario
  const getTeamAverage = () => {
    if (players.length === 0) return 0;
    const totals = players.map(p => calculatePlayerMonthStats(p.id).percent);
    const sum = totals.reduce((acc, v) => acc + v, 0);
    return Math.round(sum / players.length);
  };

  // Jugador más constante del mes
  const getMostConstantPlayer = () => {
    if (players.length === 0) return null;
    let topPlayer: Profile | null = null;
    let topPercent = -1;

    players.forEach(p => {
      const stats = calculatePlayerMonthStats(p.id);
      if (stats.percent > topPercent) {
        topPercent = stats.percent;
        topPlayer = p;
      }
    });

    return topPlayer ? { ...(topPlayer as Profile), percent: topPercent } : null;
  };

  // Tasa de lesiones del mes
  const getTeamInjuryRate = () => {
    const completedSessionsCount = monthlyTrainings.filter(t => t.status === 'Realizado').length;
    if (completedSessionsCount === 0 || players.length === 0) return 0;
    const totalLogs = completedSessionsCount * players.length;

    let countInjuries = 0;
    attendanceData.forEach(a => {
      const isSession = monthlyTrainings.some(t => t.id === a.training_id && t.status === 'Realizado');
      if (isSession && ['L', 'E'].includes(a.status)) {
        countInjuries++;
      }
    });

    return Math.round((countInjuries / totalLogs) * 100);
  };

  // Lógica de exportación
  const exportHeaders = ['Jugador', ...monthlyTrainings.map(t => t.date), '% Asistencia', 'ENT', 'AUS', 'ED', 'LES', 'OTROS'];

  const buildExportRows = (): ExportCell[][] => {
    return players.map(p => {
      const stats = calculatePlayerMonthStats(p.id);
      const playerRow: ExportCell[] = [p.full_name];

      monthlyTrainings.forEach(t => {
        const log = attendanceData.find(a => a.training_id === t.id && a.user_id === p.id);
        playerRow.push(log?.status ? getStatusShort(log.status) : '-');
      });

      playerRow.push(`${stats.percent}%`);
      playerRow.push(stats.entrena);
      playerRow.push(stats.ausente);
      playerRow.push(stats.diferenciado);
      playerRow.push(stats.lesionado);
      playerRow.push(stats.otros);

      return playerRow;
    });
  };

  const handleExportCSV = () => {
    if (players.length === 0) return;
    exportToCSV(`asistencias_atzeneta_${selectedYear}_${selectedMonth}_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Exportado el control de asistencia del mes.');
  };

  const handleExportPDF = async () => {
    if (players.length === 0) return;
    await exportToPDF(
      `Control Asistencia - UD Atzeneta - ${selectedMonth}/${selectedYear}`,
      `asistencias_atzeneta_${selectedYear}_${selectedMonth}_${Date.now()}`,
      exportHeaders,
      buildExportRows()
    );
    showToast('success', 'PDF Descargado', 'Generado informe de asistencia del mes.');
  };

  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  const isLoading = loadingProfiles || loadingTrainings || loadingAttendance;

  // Jugador actualmente seleccionado para estadísticas individuales
  const currentStatPlayer = profiles.find(p => p.id === selectedPlayerId);
  const playerIndividualStats = selectedPlayerId ? calculatePlayerMonthStats(selectedPlayerId) : null;

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Control de Asistencia</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Gestión interna de asistencia y seguimiento de la evolución física y médica del primer equipo.
          </p>
        </div>

        {canExport && (
          <div className="flex items-center gap-2 shrink-0">
            <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs">
              <Download className="w-3.5 h-3.5" /> CSV
            </button>
            <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs">
              <FileText className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        )}
      </div>

      {/* Tarjetas de estadísticas breves (Visibles para todos) */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Asistencia Media</span>
            <h3 className="text-2xl font-bold text-emerald-400 mt-2">{getTeamAverage()}%</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Promedio del mes</span>
          </div>
          <div className="p-3 bg-emerald-950/20 text-emerald-400 rounded-xl">
            <TrendingUp className="w-6 h-6" />
          </div>
        </div>

        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Bajas Médicas</span>
            <h3 className="text-2xl font-bold text-red-500 mt-2">{getTeamInjuryRate()}%</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Tasa de lesiones del mes</span>
          </div>
          <div className="p-3 bg-red-950/20 text-red-500 rounded-xl">
            <Users className="w-6 h-6" />
          </div>
        </div>

        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Sesiones Mes</span>
            <h3 className="text-2xl font-bold text-brand-gray-light mt-2">
              {monthlyTrainings.filter(t => t.status === 'Realizado').length}
            </h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Sesiones completadas en total</span>
          </div>
          <div className="p-3 bg-brand-red-600/10 text-brand-red-600 rounded-xl">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Mayor Constancia</span>
            <h3 className="text-lg font-bold text-brand-gray-light mt-2 truncate max-w-[150px]">
              {getMostConstantPlayer()?.full_name.split(' ')[0] || 'N/A'}
            </h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">
              {getMostConstantPlayer() ? `${getMostConstantPlayer()?.percent}% Asistencia` : 'Sin registros'}
            </span>
          </div>
          <div className="p-3 bg-brand-red-600/10 text-brand-red-600 rounded-xl">
            <Award className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Selectores de Fecha y Filtros de Tabs */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-brand-black border border-brand-black-border p-4 rounded-xl">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveTab('monthly')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'monthly'
                ? 'bg-brand-red-600 text-white shadow-glow-red'
                : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover'
            }`}
          >
            <ClipboardCheck className="w-3.5 h-3.5 inline mr-1.5" /> Matriz de Control
          </button>
          
          {canEdit && (
            <button
              onClick={() => setActiveTab('session')}
              className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
                activeTab === 'session'
                  ? 'bg-brand-red-600 text-white shadow-glow-red'
                  : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover'
              }`}
            >
              <UserCheck className="w-3.5 h-3.5 inline mr-1.5" /> Pase de Lista
            </button>
          )}

          <button
            onClick={() => setActiveTab('evolution')}
            className={`px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === 'evolution'
                ? 'bg-brand-red-600 text-white shadow-glow-red'
                : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 inline mr-1.5" /> Evolución Individual
          </button>
        </div>

        {/* Filtro de Fecha */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex gap-1.5 bg-brand-black border border-brand-black-border px-3 py-1.5 rounded-lg">
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
            >
              {months.map(m => <option key={m.value} value={m.value} className="bg-brand-black-card text-brand-gray-light">{m.label}</option>)}
            </select>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
            >
              <option value={2026} className="bg-brand-black-card text-brand-gray-light">2026</option>
              <option value={2025} className="bg-brand-black-card text-brand-gray-light">2025</option>
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TAB 1: MATRIZ DE CONTROL MENSUAL
          ===================================================================== */}
      {activeTab === 'monthly' && (
        <div className="space-y-4">
          {isLoading ? (
            <TableSkeleton />
          ) : players.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No se registran jugadores en la plantilla.</p>
            </div>
          ) : monthlyTrainings.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No hay sesiones de entrenamiento programadas en el mes seleccionado.</p>
            </div>
          ) : (
            <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
              <div className="overflow-x-auto no-scrollbar">
                <table className="w-full border-collapse">
                  <thead>
                    <tr>
                      <th className="table-th sticky left-0 z-10 bg-brand-black border-r border-brand-black-border" style={{ minWidth: '180px' }}>Jugador</th>
                      
                      {monthlyTrainings.map(t => (
                        <th key={t.id} className="table-th text-center cursor-default min-w-[70px] max-w-[90px]" title={`${t.date} - ${t.objective}`}>
                          <div className="flex flex-col items-center">
                            <span className="text-[10px] text-brand-gray-muted">{t.date.split('-').slice(1).reverse().join('/')}</span>
                            <span className={`text-[8px] mt-0.5 px-1 py-0.2 rounded font-semibold border ${
                              t.status === 'Realizado'
                                ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                                : t.status === 'Cancelado'
                                ? 'bg-red-950/20 text-red-400 border-red-900/30'
                                : 'bg-brand-black-border text-brand-gray-muted border-brand-black-border'
                            }`}>
                              {t.status === 'Realizado' ? 'REAL' : t.status === 'Cancelado' ? 'CANC' : 'PROG'}
                            </span>
                          </div>
                        </th>
                      ))}

                      {/* Resumen */}
                      <th className="table-th text-center bg-brand-black/50 border-l border-brand-black-border">% Asist</th>
                      <th className="table-th text-center text-emerald-400">ENT</th>
                      <th className="table-th text-center text-rose-400">AUS</th>
                      <th className="table-th text-center text-amber-400">ED</th>
                      <th className="table-th text-center text-red-400">LES</th>
                      <th className="table-th text-center text-brand-gray-muted">OTROS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-brand-black-border bg-brand-black-card/10">
                    {players.map(p => {
                      const stats = calculatePlayerMonthStats(p.id);

                      return (
                        <tr key={p.id} className="hover:bg-brand-black-hover/10 transition-colors">
                          <td className="table-td sticky left-0 z-10 bg-brand-black-card border-r border-brand-black-border font-semibold">
                            <div className="flex items-center gap-2">
                              <img 
                                src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} 
                                alt={p.full_name} 
                                className="w-6 h-6 rounded-full border border-brand-black-border object-cover"
                              />
                              <span className="truncate" title={p.full_name}>{p.full_name.split(' ')[0]} {p.full_name.split(' ')[1] || ''}</span>
                            </div>
                          </td>

                          {monthlyTrainings.map(t => {
                            const log = attendanceData.find(a => a.training_id === t.id && a.user_id === p.id);
                            const status = log?.status || 'Entrena';
                            const statusStyles = getStatusStyles(status);

                            return (
                              <td key={t.id} className="table-td p-1.5 text-center">
                                <button
                                  onClick={() => canEdit && handleCellClick(t.id, p.id)}
                                  disabled={!canEdit}
                                  title={`Fecha: ${t.date}\nEstado: ${getStatusLabel(status)}\nObs: ${log?.observations || 'Ninguna'}`}
                                  className={`inline-flex w-10 h-6 items-center justify-center text-[10px] font-bold rounded border transition-all ${statusStyles} ${
                                    canEdit ? 'hover:scale-[1.05] cursor-pointer' : 'cursor-default'
                                  }`}
                                >
                                  {getStatusShort(status)}
                                  {log?.observations && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-brand-red-600 absolute bottom-1 right-1" />
                                  )}
                                </button>
                              </td>
                            );
                          })}

                          {/* Estadísticas de la Matriz */}
                          <td className="table-td text-center font-bold bg-brand-black/20 border-l border-brand-black-border">
                            <span className={stats.percent >= 85 ? 'text-emerald-400' : stats.percent >= 70 ? 'text-amber-400' : 'text-red-400'}>
                              {stats.percent}%
                            </span>
                          </td>
                          <td className="table-td text-center font-semibold text-emerald-400">{stats.entrena}</td>
                          <td className="table-td text-center font-semibold text-rose-400">{stats.ausente}</td>
                          <td className="table-td text-center font-semibold text-amber-400">{stats.diferenciado}</td>
                          <td className="table-td text-center font-semibold text-red-500">{stats.lesionado}</td>
                          <td className="table-td text-center font-semibold text-brand-gray-muted">{stats.otros}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Leyenda explicativa de los códigos */}
          <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl space-y-2.5">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-light">
              <Info className="w-4 h-4 text-brand-red-600" />
              <span>Glosario de Estados de Asistencia</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2">
              {STATUS_OPTIONS.map(opt => (
                <div key={opt.value} className="flex items-center gap-2 p-1.5 rounded bg-brand-black-card/30 border border-brand-black-border/40" title={opt.desc}>
                  <span className={`inline-flex w-7 h-5 items-center justify-center text-[9px] font-bold rounded border ${getStatusStyles(opt.value)}`}>
                    {opt.short}
                  </span>
                  <span className="text-[10px] text-brand-gray-muted truncate font-medium">{opt.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          TAB 2: PASE DE LISTA POR SESIÓN
          ===================================================================== */}
      {activeTab === 'session' && canEdit && (
        <div className="space-y-4">
          {monthlyTrainings.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No hay entrenamientos en este mes para pasar lista.</p>
            </div>
          ) : (
            <div className="bg-brand-black border border-brand-black-border p-5 rounded-xl space-y-5">
              {/* Selector de Entrenamiento del mes */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-black-border pb-4">
                <div className="space-y-1">
                  <label className="form-label font-semibold">Seleccionar Sesión de Entrenamiento</label>
                  <select
                    value={selectedTrainingId}
                    onChange={(e) => setSelectedTrainingId(e.target.value)}
                    className="form-input bg-brand-black-bg max-w-md"
                  >
                    {monthlyTrainings.map(t => (
                      <option key={t.id} value={t.id} className="bg-brand-black-card text-brand-gray-light">
                        {t.date} - {t.time} hs ({t.location}) | {t.objective}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedTrainingId && (
                  <button
                    onClick={handleSaveRollCall}
                    disabled={saveRollCallMutation.isPending}
                    className="btn-primary py-2.5 font-semibold text-xs shrink-0 self-end sm:self-center"
                  >
                    <ClipboardCheck className="w-4 h-4" /> 
                    {saveRollCallMutation.isPending ? 'Guardando...' : 'Guardar Asistencias'}
                  </button>
                )}
              </div>

              {/* Lista de Jugadores */}
              {!selectedTrainingId ? (
                <p className="text-sm text-brand-gray-muted text-center py-6">Por favor, selecciona una sesión de entrenamiento.</p>
              ) : (
                <div className="divide-y divide-brand-black-border bg-brand-black-card/5 border border-brand-black-border rounded-xl overflow-hidden">
                  {players.map(p => {
                    const currentStatus = rollCallList[p.id]?.status || 'Entrena';
                    const currentObs = rollCallList[p.id]?.observations || '';

                    return (
                      <div key={p.id} className="p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-brand-black-hover/10 transition-colors">
                        {/* Perfil del Jugador */}
                        <div className="flex items-center gap-3 min-w-[200px]">
                          <img 
                            src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} 
                            alt={p.full_name} 
                            className="w-10 h-10 rounded-full border border-brand-black-border object-cover"
                          />
                          <div>
                            <h4 className="text-sm font-semibold text-brand-gray-light">{p.full_name}</h4>
                            <span className="text-[10px] text-brand-gray-muted">Jugador Plantilla</span>
                          </div>
                        </div>

                        {/* Botones de Pase de Lista (Alineados Horizontal) */}
                        <div className="flex flex-wrap items-center gap-1.5">
                          {/* Presente */}
                          <button
                            onClick={() => handleRollCallChange(p.id, 'Entrena')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                              currentStatus === 'Entrena'
                                ? 'bg-emerald-950/40 text-emerald-400 border-emerald-500/50 shadow-glow-emerald'
                                : 'bg-brand-black text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                            }`}
                          >
                            Presente (ENT)
                          </button>

                          {/* Ausente */}
                          <button
                            onClick={() => handleRollCallChange(p.id, 'A')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                              currentStatus === 'A'
                                ? 'bg-rose-950/40 text-rose-400 border-rose-500/50 shadow-glow-red'
                                : 'bg-brand-black text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                            }`}
                          >
                            Ausente (A)
                          </button>

                          {/* Diferenciado */}
                          <button
                            onClick={() => handleRollCallChange(p.id, 'ED')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                              currentStatus === 'ED'
                                ? 'bg-amber-950/40 text-amber-400 border-amber-500/50 shadow-glow-amber'
                                : 'bg-brand-black text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                            }`}
                          >
                            Diferenciado (ED)
                          </button>

                          {/* Lesionado */}
                          <button
                            onClick={() => handleRollCallChange(p.id, 'L')}
                            className={`px-3 py-1.5 text-[11px] font-bold rounded-lg border transition-all ${
                              currentStatus === 'L'
                                ? 'bg-red-950/40 text-red-400 border-red-500/50 shadow-glow-red'
                                : 'bg-brand-black text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                            }`}
                          >
                            Lesionado (L)
                          </button>

                          {/* Selector para los demás estados */}
                          <div className="relative">
                            <select
                              value={['Entrena', 'A', 'ED', 'L'].includes(currentStatus) ? '' : currentStatus}
                              onChange={(e) => {
                                if (e.target.value) {
                                  handleRollCallChange(p.id, e.target.value as AttendanceStatus);
                                }
                              }}
                              className={`text-[11px] font-bold rounded-lg border px-2 py-1.5 bg-brand-black focus:ring-0 focus:outline-none cursor-pointer ${
                                !['Entrena', 'A', 'ED', 'L'].includes(currentStatus)
                                  ? getStatusStyles(currentStatus) + ' border-brand-red-600/30'
                                  : 'text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                              }`}
                            >
                              <option value="" className="bg-brand-black text-brand-gray-muted">Otros...</option>
                              {STATUS_OPTIONS.filter(opt => !['Entrena', 'A', 'ED', 'L'].includes(opt.value)).map(opt => (
                                <option key={opt.value} value={opt.value} className="bg-brand-black text-brand-gray-light">
                                  {opt.label} ({opt.short})
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>

                        {/* Campo de Observaciones */}
                        <div className="flex-1 lg:max-w-xs relative">
                          <MessageSquare className="w-3.5 h-3.5 text-brand-gray-dark absolute left-3 top-2.5" />
                          <input
                            type="text"
                            placeholder="Observaciones..."
                            className="form-input text-xs pl-8.5 w-full bg-brand-black/40"
                            value={currentObs}
                            onChange={(e) => handleRollCallObservationChange(p.id, e.target.value)}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: EVOLUCIÓN ESTADÍSTICA INDIVIDUAL
          ===================================================================== */}
      {activeTab === 'evolution' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          
          {/* Panel Lateral: Selector de Jugador */}
          <div className="dashboard-card h-fit space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-brand-gray-muted">Historial del Jugador</h3>
            
            <div className="space-y-3">
              <div>
                <label className="form-label">Jugador a Auditar</label>
                <select
                  value={selectedPlayerId}
                  onChange={(e) => setSelectedPlayerId(e.target.value)}
                  disabled={isPlayer}
                  className="form-input bg-brand-black-bg"
                >
                  {players.map(p => (
                    <option key={p.id} value={p.id} className="bg-brand-black-card text-brand-gray-light">
                      {p.full_name}
                    </option>
                  ))}
                </select>
              </div>

              {currentStatPlayer && (
                <div className="flex items-center gap-3 p-3 bg-brand-black border border-brand-black-border rounded-xl">
                  <img 
                    src={currentStatPlayer.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} 
                    alt="avatar" 
                    className="w-12 h-12 rounded-full border border-brand-black-border object-cover"
                  />
                  <div>
                    <h4 className="text-sm font-bold text-brand-gray-light">{currentStatPlayer.full_name}</h4>
                    <span className="text-[10px] text-brand-gray-muted block mt-0.5">{currentStatPlayer.email}</span>
                    <span className="text-[9px] bg-brand-red-600/10 text-brand-red-600 px-1.5 py-0.5 border border-brand-red-600/20 rounded font-bold uppercase tracking-wider inline-block mt-1">
                      Ficha Jugador
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Panel Principal: Estadísticas y Evolución */}
          <div className="lg:col-span-2 space-y-6">
            {!currentStatPlayer ? (
              <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
                <p className="text-sm text-brand-gray-muted">No se seleccionó ningún jugador.</p>
              </div>
            ) : (
              <>
                {/* Métricas del Jugador */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 text-center">
                    <span className="text-[9px] font-semibold text-brand-gray-muted block uppercase">Asistencia</span>
                    <span className="text-3xl font-extrabold text-emerald-400 block mt-1.5">{playerIndividualStats?.percent}%</span>
                    <span className="text-[9px] text-brand-gray-muted mt-1 block">Rendimiento efectivo</span>
                  </div>

                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 text-center">
                    <span className="text-[9px] font-semibold text-brand-gray-muted block uppercase">Entrena</span>
                    <span className="text-3xl font-extrabold text-brand-gray-light block mt-1.5">{playerIndividualStats?.entrena}</span>
                    <span className="text-[9px] text-brand-gray-muted mt-1 block">Días entrenados</span>
                  </div>

                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 text-center">
                    <span className="text-[9px] font-semibold text-brand-gray-muted block uppercase">Ausencias</span>
                    <span className="text-3xl font-extrabold text-rose-500 block mt-1.5">{playerIndividualStats?.ausente}</span>
                    <span className="text-[9px] text-brand-gray-muted mt-1 block">Faltas (justif/no)</span>
                  </div>

                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 text-center">
                    <span className="text-[9px] font-semibold text-brand-gray-muted block uppercase">Baja Médica</span>
                    <span className="text-3xl font-extrabold text-amber-400 block mt-1.5">{playerIndividualStats?.lesionado}</span>
                    <span className="text-[9px] text-brand-gray-muted mt-1 block">Lesiones o enfermos</span>
                  </div>
                </div>

                {/* Historial de Sesiones del Mes del Jugador */}
                <div className="dashboard-card space-y-4">
                  <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-1.5">
                    <ClipboardCheck className="w-4 h-4 text-brand-red-600" />
                    <span>Bitácora de Asistencia del Mes</span>
                  </h3>

                  {monthlyTrainings.length === 0 ? (
                    <p className="text-xs text-brand-gray-muted italic text-center py-4">No hay entrenamientos en este mes.</p>
                  ) : (
                    <div className="space-y-2.5">
                      {monthlyTrainings.map(t => {
                        const log = attendanceData.find(a => a.training_id === t.id && a.user_id === selectedPlayerId);
                        const status = log?.status || 'Entrena';

                        return (
                          <div key={t.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-brand-black/30 border border-brand-black-border rounded-xl hover:border-brand-gray-dark/30 transition-all">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-semibold text-brand-gray-light">{t.date}</span>
                                <span className="text-[10px] text-brand-gray-muted">{t.time} hs</span>
                                <span className="text-[10px] text-brand-gray-muted">· {t.location}</span>
                              </div>
                              <p className="text-[11px] text-brand-gray-muted font-medium">{t.objective}</p>
                              {log?.observations && (
                                <p className="text-[10px] text-brand-red-600/90 italic flex items-center gap-1 mt-1">
                                  <Info className="w-3 h-3" />
                                  <span>Obs: {log.observations}</span>
                                </p>
                              )}
                            </div>

                            <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded border self-start sm:self-center shrink-0 uppercase tracking-wider ${getStatusStyles(status)}`}>
                              {getStatusLabel(status)}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL DE EDICIÓN DE CELDA INDIVIDUAL (MATRIZ)
          ===================================================================== */}
      <Modal
        isOpen={editingCell !== null}
        onClose={() => setEditingCell(null)}
        title="Modificar Asistencia"
      >
        {editingCell && (
          <form onSubmit={handleSaveCell} className="space-y-4">
            <div>
              <p className="text-xs text-brand-gray-muted leading-relaxed">
                Modificando el registro de asistencia del jugador{' '}
                <strong className="text-brand-gray-light">
                  {profiles.find(p => p.id === editingCell.userId)?.full_name}
                </strong>{' '}
                para el entrenamiento del día{' '}
                <strong className="text-brand-gray-light">
                  {trainings.find(t => t.id === editingCell.trainingId)?.date}
                </strong>.
              </p>
            </div>

            <div>
              <label className="form-label">Estado de Asistencia</label>
              <select
                value={editingCell.status}
                onChange={(e) => setEditingCell(prev => prev ? { ...prev, status: e.target.value as AttendanceStatus } : null)}
                className="form-input bg-brand-black-bg"
              >
                {STATUS_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value} className="bg-brand-black-card text-brand-gray-light">
                    {opt.label} ({opt.short})
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="form-label">Observaciones y Comentarios</label>
              <input
                type="text"
                className="form-input"
                placeholder="Molestias, viaje familiar, descanso de carga..."
                value={editingCell.observations}
                onChange={(e) => setEditingCell(prev => prev ? { ...prev, observations: e.target.value } : null)}
              />
            </div>

            <div className="flex gap-2 justify-end pt-3">
              <button
                type="button"
                onClick={() => setEditingCell(null)}
                className="btn-secondary py-2 text-xs"
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn-primary py-2 text-xs font-semibold"
                disabled={updateAttendanceMutation.isPending}
              >
                {updateAttendanceMutation.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
