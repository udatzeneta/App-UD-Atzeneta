import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { TrainingAttendance, Player } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  ClipboardCheck, Download, FileText, Calendar,
  TrendingUp, Info, Award, UserCheck, MessageSquare,
  BarChart2, User, Activity, Zap, Trash2
} from 'lucide-react';

// ─── Constantes ────────────────────────────────────────────────────────────────
const STATUS_OPTIONS = [
  { value: 'ENT', label: 'Presente',             short: 'ENT', desc: 'Presente y entrena normal' },
  { value: 'A',   label: 'Ausente',              short: 'A',   desc: 'Ausente sin justificar' },
  { value: 'ED',  label: 'Entrenó Diferenciado', short: 'ED',  desc: 'Entrenamiento adaptado' },
  { value: 'L',   label: 'Lesionado',            short: 'L',   desc: 'Baja por lesión deportiva' },
  { value: 'E',   label: 'Enfermo',              short: 'E',   desc: 'Enfermedad o indisposición' },
  { value: 'P',   label: 'Partido',              short: 'P',   desc: 'Ausencia por convocatoria' },
  { value: 'LJ',  label: 'Libre, Jugó',          short: 'LJ',  desc: 'Día libre pero jugó' },
  { value: 'V',   label: 'Viaje',                short: 'V',   desc: 'Ausencia por viaje' },
  { value: 'AA',  label: 'Aus. con Aviso',       short: 'AA',  desc: 'Ausencia reportada' },
  { value: 'AO',  label: 'Aus. Otros',           short: 'AO',  desc: 'Otros motivos' },
  { value: 'D',   label: 'Descanso',             short: 'D',   desc: 'Día libre programado' },
];

const CAUSE_COLS = [
  { key: 'ed',    label: 'Difer.',  full: 'Entrenó Diferenciado (ED)', color: 'text-amber-400',  barCl: 'bg-amber-400',   cellBg: (v: number) => v >= 20 ? 'bg-amber-500/25' : v >= 10 ? 'bg-amber-500/15' : v >= 5 ? 'bg-amber-500/8' : '' },
  { key: 'les',   label: 'Lesión',  full: 'Baja por lesión (L)',        color: 'text-red-400',    barCl: 'bg-red-400',     cellBg: (v: number) => v >= 20 ? 'bg-red-500/25'   : v >= 10 ? 'bg-red-500/15'   : v >= 5 ? 'bg-red-500/8'   : '' },
  { key: 'enf',   label: 'Enferm.', full: 'Enfermedad (E)',              color: 'text-yellow-400', barCl: 'bg-yellow-400',  cellBg: (v: number) => v >= 20 ? 'bg-yellow-500/25': v >= 10 ? 'bg-yellow-500/15': v >= 5 ? 'bg-yellow-500/8': '' },
  { key: 'aus',   label: 'Ausente', full: 'Ausente sin justificar (A)', color: 'text-rose-400',   barCl: 'bg-rose-400',    cellBg: (v: number) => v >= 20 ? 'bg-rose-500/30'  : v >= 10 ? 'bg-rose-500/20'  : v >= 5 ? 'bg-rose-500/10' : '' },
  { key: 'aa',    label: 'Aus+Av',  full: 'Ausente con aviso (AA)',     color: 'text-slate-400',  barCl: 'bg-slate-400',   cellBg: (v: number) => v >= 20 ? 'bg-slate-500/25' : v >= 10 ? 'bg-slate-500/15' : v >= 5 ? 'bg-slate-500/8': '' },
  { key: 'ao',    label: 'Aus+Ot',  full: 'Ausente, otros (AO)',        color: 'text-pink-400',   barCl: 'bg-pink-400',    cellBg: (v: number) => v >= 20 ? 'bg-pink-500/25'  : v >= 10 ? 'bg-pink-500/15'  : v >= 5 ? 'bg-pink-500/8' : '' },
  { key: 'part',  label: 'Partido', full: 'Partido / convocatoria (P)', color: 'text-blue-400',   barCl: 'bg-blue-400',    cellBg: (v: number) => v >= 20 ? 'bg-blue-500/25'  : v >= 10 ? 'bg-blue-500/15'  : v >= 5 ? 'bg-blue-500/8' : '' },
  { key: 'viaje', label: 'Viaje',   full: 'Viaje (V)',                  color: 'text-teal-400',   barCl: 'bg-teal-400',    cellBg: (v: number) => v >= 20 ? 'bg-teal-500/25'  : v >= 10 ? 'bg-teal-500/15'  : v >= 5 ? 'bg-teal-500/8' : '' },
  { key: 'lj',    label: 'Lib+Jug', full: 'Libre, jugó (LJ)',           color: 'text-indigo-400', barCl: 'bg-indigo-400',  cellBg: (v: number) => v >= 20 ? 'bg-indigo-500/25': v >= 10 ? 'bg-indigo-500/15': v >= 5 ? 'bg-indigo-500/8': '' },
  { key: 'desc',  label: 'Descans', full: 'Descanso programado (D)',    color: 'text-gray-400',   barCl: 'bg-gray-400',    cellBg: (_: number) => '' },
];

const months = [
  { value: 1,  label: 'Enero' },     { value: 2,  label: 'Febrero' },
  { value: 3,  label: 'Marzo' },     { value: 4,  label: 'Abril' },
  { value: 5,  label: 'Mayo' },      { value: 6,  label: 'Junio' },
  { value: 7,  label: 'Julio' },     { value: 8,  label: 'Agosto' },
  { value: 9,  label: 'Septiembre' },{ value: 10, label: 'Octubre' },
  { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' },
];

type ActiveTab = 'matrix' | 'cumul' | 'indiv' | 'sessions';

const isPresent = (s: string) => s === 'ENT' || s === 'Entrena' || s === 'ED';
const isMedical = (s: string) => ['L', 'E'].includes(s);
const isAbsent  = (s: string) => ['A', 'AA', 'AO', 'V', 'P', 'LJ', 'D'].includes(s);

// ─── Componente ────────────────────────────────────────────────────────────────
export const Attendance: React.FC = () => {
  const queryClient = useQueryClient();
  const { roleSlug, user, hasPermission } = usePermissions();
  const { showToast } = useToast();

  const isPlayerRole = roleSlug === 'player';
  const canEdit   = hasPermission('attendance', 'editar') || hasPermission('attendance', 'crear');
  const canExport = hasPermission('attendance', 'exportar');

  // ── Estado ─────────────────────────────────────────────────────────────────
  const [activeTab,          setActiveTab]          = useState<ActiveTab>('matrix');
  const [selectedMonth,      setSelectedMonth]      = useState(new Date().getMonth() + 1);
  const [selectedYear,       setSelectedYear]       = useState(new Date().getFullYear());
  const [selectedPlayerId,   setSelectedPlayerId]   = useState('');
  const [selectedTrainingId, setSelectedTrainingId] = useState('');
  const [editingCell, setEditingCell] = useState<{
    trainingId: string; playerId: string; status: string; observations: string;
  } | null>(null);
  const [rollCallList, setRollCallList] = useState<Record<string, { status: string; observations: string }>>({});
  const [rollCallOpen, setRollCallOpen] = useState(false);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: players = [],        isLoading: lPlayers   } = useQuery({ queryKey: ['players'],   queryFn: () => dataService.getPlayers() });
  const { data: trainings = [],      isLoading: lTrainings } = useQuery({ queryKey: ['trainings'], queryFn: () => dataService.getTrainings() });
  const { data: attendanceData = [], isLoading: lAtt }       = useQuery({
    queryKey: ['attendance', selectedYear, selectedMonth],
    queryFn:  () => dataService.getAttendanceByMonth(selectedYear, selectedMonth),
  });
  const { data: allAttendanceData = [], isLoading: lAllAtt } = useQuery({
    queryKey: ['attendance_all'],
    queryFn:  () => dataService.getAllAttendance(),
  });

  const isLoading      = lPlayers || lTrainings || lAtt;
  const isCumulLoading = lPlayers || lTrainings || lAllAtt;

  // ── Datos derivados ────────────────────────────────────────────────────────
  const visiblePlayers: Player[] = isPlayerRole && user
    ? players.filter((p: Player) => p.profile_id === user.id || p.id === user.id)
    : players;

  const monthlyTrainings = trainings
    .filter((t: any) => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const completedTrainings    = monthlyTrainings.filter((t: any) => t.status === 'Realizado');
  const allCompletedTrainings = trainings.filter((t: any) => t.status === 'Realizado');
  const allTrainingsSorted    = [...trainings].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visiblePlayers.length > 0 && !selectedPlayerId)
      setSelectedPlayerId(visiblePlayers[0].id);
  }, [players]);

  useEffect(() => {
    setSelectedTrainingId(monthlyTrainings.length > 0 ? monthlyTrainings[0].id : '');
  }, [selectedMonth, selectedYear, trainings]);

  useEffect(() => {
    if (!selectedTrainingId) return;
    const init: Record<string, { status: string; observations: string }> = {};
    visiblePlayers.forEach(p => {
      const log = attendanceData.find((a: any) => a.training_id === selectedTrainingId && a.player_id === p.id);
      init[p.id] = { status: log?.status || 'ENT', observations: log?.observations || '' };
    });
    setRollCallList(init);
  }, [selectedTrainingId, attendanceData]);

  // ── Mutaciones ─────────────────────────────────────────────────────────────
  const updateMut = useMutation({
    mutationFn: ({ trainingId, playerId, status, observations }: any) =>
      dataService.updateAttendance(trainingId, playerId, status, observations),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_all'] });
      showToast('success', 'Asistencia guardada', '');
      setEditingCell(null);
    },
    onError: (err: any) => showToast('error', 'Error', err.message),
  });

  const rollCallMut = useMutation({
    mutationFn: ({ trainingId, list }: { trainingId: string; list: Omit<TrainingAttendance, 'id'>[] }) =>
      dataService.saveAttendanceList(trainingId, list),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_all'] });
      showToast('success', 'Pase de lista guardado', '');
      setRollCallOpen(false);
    },
    onError: (err: any) => showToast('error', 'Error', err.message),
  });

  // ── Helpers de estilo ──────────────────────────────────────────────────────
  const getStatusStyles = (status: string) => {
    const map: Record<string, string> = {
      ENT: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
      Entrena: 'bg-emerald-950/40 text-emerald-400 border-emerald-900/30',
      A:   'bg-rose-950/40 text-rose-400 border-rose-900/30',
      ED:  'bg-amber-950/40 text-amber-400 border-amber-900/30',
      L:   'bg-red-950/40 text-red-400 border-red-900/30',
      E:   'bg-yellow-950/40 text-yellow-400 border-yellow-900/30',
      P:   'bg-blue-950/40 text-blue-400 border-blue-900/30',
      LJ:  'bg-indigo-950/40 text-indigo-400 border-indigo-900/30',
      V:   'bg-teal-950/40 text-teal-400 border-teal-900/30',
      AA:  'bg-slate-800 text-slate-300 border-slate-700/50',
      AO:  'bg-pink-950/40 text-pink-400 border-pink-900/30',
      D:   'bg-brand-black-border text-brand-gray-muted border-brand-black-border/50',
    };
    return map[status] ?? 'bg-brand-black text-brand-gray-dark border-brand-black-border';
  };

  const getLabel = (v: string) => STATUS_OPTIONS.find(o => o.value === v)?.label || v;
  const getShort = (v: string) => STATUS_OPTIONS.find(o => o.value === v)?.short || v;

  // ── Estadísticas por jugador ────────────────────────────────────────────────
  const buildStats = (playerId: string, trainingList: any[], attList: any[]) => {
    const logs  = attList.filter((a: any) => a.player_id === playerId);
    const total = trainingList.length;
    const counts: Record<string, number> = {};
    STATUS_OPTIONS.forEach(o => { counts[o.value] = 0; });
    trainingList.forEach((t: any) => {
      const log = logs.find((a: any) => a.training_id === t.id);
      const st  = log?.status || 'A';
      counts[st] = (counts[st] || 0) + 1;
    });
    const pct  = (n: number) => total > 0 ? Math.round((n / total) * 100) : 0;
    const entN = (counts['ENT'] || 0) + (counts['Entrena'] || 0);
    const edN  = counts['ED']  || 0;
    const ausN = counts['A']   || 0;
    const aaN  = counts['AA']  || 0;
    const aoN  = counts['AO']  || 0;
    const lesN = counts['L']   || 0;
    const enfN = counts['E']   || 0;
    const partN= counts['P']   || 0;
    const viajN= counts['V']   || 0;
    const descN= counts['D']   || 0;
    const ljN  = counts['LJ']  || 0;
    return {
      total,
      ent: entN,   pctEnt:   pct(entN),
      ed:  edN,    pctEd:    pct(edN),
      aus: ausN,   pctAus:   pct(ausN),
      aa:  aaN,    pctAa:    pct(aaN),
      ao:  aoN,    pctAo:    pct(aoN),
      les: lesN,   pctLes:   pct(lesN),
      enf: enfN,   pctEnf:   pct(enfN),
      part:partN,  pctPart:  pct(partN),
      viaje:viajN, pctViaje: pct(viajN),
      desc:descN,  pctDesc:  pct(descN),
      lj:  ljN,    pctLj:    pct(ljN),
    };
  };

  // Mensual (Matriz + Individual) / Temporada completa (Acumulativos)
  const calcPlayerStats      = (id: string) => buildStats(id, completedTrainings,    attendanceData);
  const calcPlayerStatsCumul = (id: string) => buildStats(id, allCompletedTrainings, allAttendanceData);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleCellClick = (trainingId: string, playerId: string) => {
    if (!canEdit) return;
    const log = attendanceData.find((a: any) => a.training_id === trainingId && a.player_id === playerId)
             || allAttendanceData.find((a: any) => a.training_id === trainingId && a.player_id === playerId);
    setEditingCell({ trainingId, playerId, status: log?.status || 'ENT', observations: log?.observations || '' });
  };

  const handleSaveCell = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCell) return;
    updateMut.mutate({
      trainingId:   editingCell.trainingId,
      playerId:     editingCell.playerId,
      status:       editingCell.status,
      observations: editingCell.observations.trim(),
    });
  };

  const handleSaveRollCall = () => {
    if (!selectedTrainingId) return;
    const list = Object.keys(rollCallList).map(playerId => ({
      training_id:  selectedTrainingId,
      player_id:    playerId,
      status:       rollCallList[playerId].status,
      observations: rollCallList[playerId].observations.trim(),
    }));
    rollCallMut.mutate({ trainingId: selectedTrainingId, list });
  };

  // ── Exportación ────────────────────────────────────────────────────────────
  const handleExportCSV = () => {
    if (!players.length) return;
    const headers = ['Jugador', ...monthlyTrainings.map((t: any) => t.date), '% Asist', 'ENT', 'AUS', 'ED', 'L', 'E'];
    const rows: ExportCell[][] = visiblePlayers.map(p => {
      const st = calcPlayerStats(p.id);
      const row: ExportCell[] = [p.nickname || p.full_name];
      monthlyTrainings.forEach((t: any) => {
        const log = attendanceData.find((a: any) => a.training_id === t.id && a.player_id === p.id);
        row.push(log?.status ? getShort(log.status) : '-');
      });
      row.push(`${st.pctEnt}%`, st.ent, st.aus, st.ed, st.les, st.enf);
      return row;
    });
    exportToCSV(`asistencias_${selectedYear}_${selectedMonth}_${Date.now()}`, headers, rows);
    showToast('success', 'CSV descargado', '');
  };

  const handleExportPDF = async () => {
    if (!players.length) return;
    const headers = ['Jugador', ...monthlyTrainings.map((t: any) => t.date), '% Asist', 'ENT', 'AUS', 'ED', 'L', 'E'];
    const rows: ExportCell[][] = visiblePlayers.map(p => {
      const st = calcPlayerStats(p.id);
      const row: ExportCell[] = [p.nickname || p.full_name];
      monthlyTrainings.forEach((t: any) => {
        const log = attendanceData.find((a: any) => a.training_id === t.id && a.player_id === p.id);
        row.push(log?.status ? getShort(log.status) : '-');
      });
      row.push(`${st.pctEnt}%`, st.ent, st.aus, st.ed, st.les, st.enf);
      return row;
    });
    await exportToPDF(
      `Control Asistencia - UD Atzeneta - ${selectedMonth}/${selectedYear}`,
      `asistencias_${selectedYear}_${selectedMonth}_${Date.now()}`,
      headers, rows
    );
    showToast('success', 'PDF descargado', '');
  };

  // ── Datos calculados ───────────────────────────────────────────────────────
  const currentPlayer    = visiblePlayers.find(p => p.id === selectedPlayerId) || null;
  const currentPlayerSt  = selectedPlayerId ? calcPlayerStats(selectedPlayerId) : null;
  const currentMonthName = months.find(m => m.value === selectedMonth)?.label ?? '';

  // Ranking por asistencia (temporada completa)
  const rankedPlayers = [...visiblePlayers]
    .map(p => ({ p, st: calcPlayerStatsCumul(p.id) }))
    .sort((a, b) => b.st.pctEnt - a.st.pctEnt);

  // ─────────────────────────────────────────────────────────────────────────────
  // RENDER
  // ─────────────────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-5">

      {/* ══════ CABECERA ═════════════════════════════════════════════════════ */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Control de Asistencia</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Seguimiento de presencia, estadísticas acumuladas y análisis individual.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <div className="flex gap-1.5 bg-brand-black border border-brand-black-border px-3 py-2 rounded-lg">
            <select value={selectedMonth} onChange={e => setSelectedMonth(Number(e.target.value))}
              className="bg-transparent text-xs text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer">
              {months.map(m => <option key={m.value} value={m.value} className="bg-brand-black-card">{m.label}</option>)}
            </select>
            <select value={selectedYear} onChange={e => setSelectedYear(Number(e.target.value))}
              className="bg-transparent text-xs text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer">
              <option value={2026} className="bg-brand-black-card">2026</option>
              <option value={2025} className="bg-brand-black-card">2025</option>
            </select>
          </div>
          {canExport && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs flex items-center gap-1.5">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canEdit && monthlyTrainings.length > 0 && (
            <button onClick={() => setRollCallOpen(true)} className="btn-primary py-2 text-xs flex items-center gap-1.5">
              <UserCheck className="w-3.5 h-3.5" /> Pase de Lista
            </button>
          )}
        </div>
      </div>

      {/* ══════ TABS ═════════════════════════════════════════════════════════ */}
      <div className="flex flex-wrap items-center gap-1 bg-brand-black border border-brand-black-border p-1 rounded-xl w-fit">
        {([
          { id: 'matrix',   icon: ClipboardCheck, label: 'Matriz'       },
          { id: 'cumul',    icon: BarChart2,      label: 'Acumulativos' },
          { id: 'indiv',    icon: User,           label: 'Individual'   },
          { id: 'sessions', icon: Calendar,       label: 'Asistencias'  },
        ] as { id: ActiveTab; icon: any; label: string }[]).map(({ id, icon: Icon, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-semibold rounded-lg transition-all ${
              activeTab === id
                ? 'bg-brand-red-600 text-white shadow-glow-red'
                : 'text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            {label}
          </button>
        ))}
      </div>

      {/* ══════ TAB 1 — MATRIZ ═══════════════════════════════════════════════ */}
      {activeTab === 'matrix' && (
        <div className="space-y-3">
          {isLoading ? (
            <TableSkeleton />
          ) : visiblePlayers.length === 0 ? (
            <EmptyState text="No hay jugadores en la plantilla." />
          ) : monthlyTrainings.length === 0 ? (
            <EmptyState text="No hay entrenamientos en el mes seleccionado." />
          ) : (
            <>
              <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b border-brand-black-border">
                        <th className="py-2 px-3 text-left text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider sticky left-0 z-10 bg-brand-black border-r border-brand-black-border" style={{ minWidth: 160 }}>
                          Jugador
                        </th>
                        {monthlyTrainings.map((t: any) => (
                          <th key={t.id} className="py-2 text-center" style={{ minWidth: 52 }} title={`${t.date} — ${t.objective}`}>
                            <div className="flex flex-col items-center gap-0.5">
                              <span className="text-[10px] text-brand-gray-muted font-medium">
                                {t.date.split('-').slice(1).reverse().join('/')}
                              </span>
                              <span className={`text-[8px] px-1 py-0.5 rounded font-bold border ${
                                t.status === 'Realizado'  ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' :
                                t.status === 'Cancelado' ? 'bg-red-950/20 text-red-400 border-red-900/30' :
                                'bg-brand-black-border text-brand-gray-muted border-brand-black-border'
                              }`}>
                                {t.status === 'Realizado' ? 'REAL' : t.status === 'Cancelado' ? 'CANC' : 'PROG'}
                              </span>
                            </div>
                          </th>
                        ))}
                        <th className="py-2 px-2 text-center text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider border-l border-brand-black-border bg-brand-black/40 min-w-[52px]">% ENT</th>
                        <th className="py-2 px-2 text-center text-[10px] font-semibold text-emerald-400 uppercase tracking-wider min-w-[36px]">ENT</th>
                        <th className="py-2 px-2 text-center text-[10px] font-semibold text-rose-400 uppercase tracking-wider min-w-[36px]">AUS</th>
                        <th className="py-2 px-2 text-center text-[10px] font-semibold text-amber-400 uppercase tracking-wider min-w-[36px]">ED</th>
                        <th className="py-2 px-2 text-center text-[10px] font-semibold text-orange-400 uppercase tracking-wider min-w-[36px]">MED</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-black-border">
                      {visiblePlayers.map((p: Player) => {
                        const st = calcPlayerStats(p.id);
                        return (
                          <tr key={p.id} className="hover:bg-brand-black-hover/10 transition-colors">
                            <td className="py-1 px-3 sticky left-0 z-10 bg-brand-black-card border-r border-brand-black-border" style={{ minWidth: 160 }}>
                              <div className="flex items-center gap-1.5">
                                <img src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                                  alt={p.full_name} className="w-6 h-6 rounded-full border border-brand-black-border object-cover shrink-0" />
                                <div className="min-w-0 flex items-center gap-1">
                                  {p.dorsal != null && <span className="text-[9px] font-black text-amber-400 shrink-0">#{p.dorsal}</span>}
                                  <span className="text-[11px] font-semibold text-brand-gray-light truncate">{p.nickname || p.full_name}</span>
                                </div>
                              </div>
                            </td>
                            {monthlyTrainings.map((t: any) => {
                              const log    = attendanceData.find((a: any) => a.training_id === t.id && a.player_id === p.id);
                              const status = log?.status || '-';
                              const hasData = status !== '-';
                              let cellBg = 'bg-brand-black/60';
                              let textCl = 'text-brand-gray-dark';
                              if (hasData) {
                                if (isPresent(status)) { cellBg = 'bg-emerald-600/20 hover:bg-emerald-600/30 border-b-2 border-emerald-500/40'; textCl = 'text-emerald-400'; }
                                else if (isMedical(status)) { cellBg = 'bg-orange-600/15 hover:bg-orange-600/25 border-b-2 border-orange-500/30'; textCl = 'text-orange-400'; }
                                else { cellBg = 'bg-rose-600/20 hover:bg-rose-600/30 border-b-2 border-rose-500/40'; textCl = 'text-rose-400'; }
                              }
                              return (
                                <td key={t.id} className="p-0 text-center relative">
                                  <button onClick={() => handleCellClick(t.id, p.id)} disabled={!canEdit}
                                    title={`${t.date} — ${hasData ? getLabel(status) : 'Sin registro'}${log?.observations ? `\nObs: ${log.observations}` : ''}`}
                                    className={`w-full min-h-[32px] flex items-center justify-center transition-all ${cellBg} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                                    <span className={`text-[10px] font-bold ${textCl}`}>{hasData ? getShort(status) : '·'}</span>
                                    {log?.observations && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-brand-red-600" />}
                                  </button>
                                </td>
                              );
                            })}
                            <td className="py-1 px-2 text-center text-xs font-bold border-l border-brand-black-border bg-brand-black/30">
                              <span className={st.pctEnt >= 85 ? 'text-emerald-400' : st.pctEnt >= 70 ? 'text-amber-400' : 'text-rose-400'}>
                                {st.total > 0 ? `${st.pctEnt}%` : '—'}
                              </span>
                            </td>
                            <td className="py-1 px-2 text-center text-xs font-semibold text-emerald-400">{st.ent}</td>
                            <td className="py-1 px-2 text-center text-xs font-semibold text-rose-400">{st.aus}</td>
                            <td className="py-1 px-2 text-center text-xs font-semibold text-amber-400">{st.ed}</td>
                            <td className="py-1 px-2 text-center text-xs font-semibold text-orange-400">{st.les + st.enf}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-4 px-1">
                {[
                  { bg: 'bg-emerald-600/30 border-emerald-500/40', label: 'Entrena (ENT / ED)' },
                  { bg: 'bg-rose-600/30 border-rose-500/40',       label: 'Ausente / No entrena' },
                  { bg: 'bg-orange-600/20 border-orange-500/30',   label: 'Baja médica (L / E)' },
                  { bg: 'bg-brand-black/60 border-brand-black-border', label: 'Sin registro' },
                ].map(i => (
                  <div key={i.label} className="flex items-center gap-1.5">
                    <div className={`w-4 h-4 rounded border ${i.bg}`} />
                    <span className="text-[10px] text-brand-gray-muted font-medium">{i.label}</span>
                  </div>
                ))}
                {canEdit && <span className="text-[10px] text-brand-gray-dark italic ml-auto">Haz clic en una celda para editar</span>}
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ TAB 2 — ACUMULATIVOS ═════════════════════════════════════════ */}
      {activeTab === 'cumul' && (
        <div className="space-y-4">
          {isCumulLoading ? (
            <TableSkeleton />
          ) : visiblePlayers.length === 0 ? (
            <EmptyState text="No hay jugadores en la plantilla." />
          ) : allCompletedTrainings.length === 0 ? (
            <EmptyState text="No hay sesiones completadas registradas." />
          ) : (
            <>
              {/* KPIs globales */}
              {(() => {
                const pcts  = visiblePlayers.map(p => calcPlayerStatsCumul(p.id).pctEnt);
                const avg   = Math.round(pcts.reduce((a, b) => a + b, 0) / pcts.length);
                const total = allCompletedTrainings.length * visiblePlayers.length;
                let inj = 0, abs = 0;
                allAttendanceData.forEach((a: any) => {
                  if (allCompletedTrainings.some((t: any) => t.id === a.training_id)) {
                    if (isMedical(a.status)) inj++;
                    if (isAbsent(a.status))  abs++;
                  }
                });
                const injR = total > 0 ? Math.round((inj / total) * 100) : 0;
                const absR = total > 0 ? Math.round((abs / total) * 100) : 0;
                return (
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {[
                      { label: 'Asistencia media',      val: `${avg}%`,                   color: 'text-emerald-400', icon: TrendingUp, bg: 'bg-emerald-950/20 text-emerald-400' },
                      { label: 'Sesiones realizadas',   val: allCompletedTrainings.length, color: 'text-brand-gray-light', icon: Calendar, bg: 'bg-brand-red-600/10 text-brand-red-600' },
                      { label: 'Tasa de ausencias',     val: `${absR}%`,                   color: 'text-rose-400',    icon: Award,     bg: 'bg-rose-950/20 text-rose-400' },
                      { label: 'Tasa de bajas médicas', val: `${injR}%`,                   color: 'text-orange-400',  icon: Activity,  bg: 'bg-orange-950/20 text-orange-400' },
                    ].map(({ label, val, color, icon: Icon, bg }) => (
                      <div key={label} className="dashboard-card p-4 flex items-center justify-between">
                        <div>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">{label}</span>
                          <span className={`text-2xl font-extrabold block mt-1.5 ${color}`}>{val}</span>
                          <span className="text-[9px] text-brand-gray-muted mt-0.5 block">Temporada completa</span>
                        </div>
                        <div className={`p-3 rounded-xl ${bg}`}><Icon className="w-5 h-5" /></div>
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/* Tabla acumulativa */}
              <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
                <div className="px-4 py-3 border-b border-brand-black-border flex items-center justify-between">
                  <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-2">
                    <BarChart2 className="w-4 h-4 text-brand-red-600" />
                    Estadísticas acumulativas — Temporada completa
                  </h3>
                  <span className="text-[10px] text-brand-gray-muted">{allCompletedTrainings.length} sesiones · ordenado por asistencia</span>
                </div>

                <div className="overflow-x-auto no-scrollbar">
                  <table className="w-full border-collapse text-xs">
                    <thead>
                      <tr className="border-b-2 border-brand-black-border bg-brand-black/70">
                        {/* Jugador */}
                        <th className="py-3 px-3 text-left text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider sticky left-0 z-10 bg-brand-black/80 border-r border-brand-black-border" style={{ minWidth: 210 }}>
                          Jugador
                        </th>
                        {/* Asiste */}
                        <th className="py-3 px-3 text-center border-r border-emerald-800/30 bg-emerald-950/15" style={{ minWidth: 84 }}>
                          <span className="text-[11px] font-extrabold text-emerald-400 uppercase tracking-widest block">Asiste</span>
                          <span className="text-[8px] text-emerald-400/50">ENT + ED</span>
                        </th>
                        {/* No asiste */}
                        <th className="py-3 px-3 text-center border-r border-rose-800/30 bg-rose-950/15" style={{ minWidth: 84 }}>
                          <span className="text-[11px] font-extrabold text-rose-400 uppercase tracking-widest block">No asiste</span>
                          <span className="text-[8px] text-rose-400/50">Total faltas</span>
                        </th>
                        {/* Divisor */}
                        <th className="w-px bg-brand-black-border/80 border-r border-brand-black-border p-0" />
                        {/* Causas */}
                        {CAUSE_COLS.map(col => (
                          <th key={col.key} className="py-3 px-2 text-center" style={{ minWidth: 68 }} title={col.full}>
                            <span className={`text-[10px] font-bold uppercase tracking-wider block ${col.color}`}>{col.label}</span>
                            <span className={`text-[7px] opacity-40 ${col.color}`}>{col.full.split('(')[1]?.replace(')', '') ?? ''}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>

                    <tbody className="divide-y divide-brand-black-border/60">
                      {rankedPlayers.map(({ p, st }, idx) => {
                        const asisteN   = st.ent + st.ed;
                        const asistePct = st.total > 0 ? Math.round((asisteN   / st.total) * 100) : 0;
                        const noN       = st.aus + st.aa + st.ao + st.les + st.enf + st.part + st.viaje + st.lj + st.desc;
                        const noPct     = st.total > 0 ? Math.round((noN / st.total) * 100) : 0;

                        // Color fondo "Asiste" por intensidad
                        const asisteBg =
                          asistePct >= 90 ? 'bg-emerald-500/30' :
                          asistePct >= 75 ? 'bg-emerald-500/20' :
                          asistePct >= 60 ? 'bg-emerald-500/10' :
                          asistePct >= 40 ? 'bg-yellow-500/10'  : 'bg-rose-500/10';
                        const asisteTxt =
                          asistePct >= 90 ? 'text-emerald-300' :
                          asistePct >= 75 ? 'text-emerald-400' :
                          asistePct >= 60 ? 'text-emerald-500' :
                          asistePct >= 40 ? 'text-yellow-400'  : 'text-rose-400';

                        // Color fondo "No asiste" por intensidad
                        const noBg =
                          noPct >= 40 ? 'bg-rose-500/30' :
                          noPct >= 25 ? 'bg-rose-500/20' :
                          noPct >= 15 ? 'bg-rose-500/10' :
                          noPct >= 5  ? 'bg-orange-500/10' : '';
                        const noTxt =
                          noPct >= 40 ? 'text-rose-300' :
                          noPct >= 25 ? 'text-rose-400' :
                          noPct >= 15 ? 'text-rose-500' :
                          noPct >= 5  ? 'text-orange-400' : 'text-brand-gray-muted';

                        const causeVals: Record<string, number> = {
                          ed: st.pctEd, les: st.pctLes, enf: st.pctEnf, aus: st.pctAus,
                          aa: st.pctAa, ao: st.pctAo, part: st.pctPart, viaje: st.pctViaje,
                          lj: st.pctLj, desc: st.pctDesc,
                        };

                        return (
                          <tr key={p.id} className="hover:bg-brand-black-hover/5 transition-colors group">
                            {/* Columna jugador */}
                            <td className="py-2 px-3 sticky left-0 z-10 bg-brand-black-card border-r border-brand-black-border group-hover:bg-brand-black-card" style={{ minWidth: 210 }}>
                              <div className="flex items-center gap-2">
                                <span className={`text-[10px] font-black w-4 text-center shrink-0 ${
                                  idx === 0 ? 'text-amber-400' : idx === 1 ? 'text-slate-400' : idx === 2 ? 'text-orange-600' : 'text-brand-gray-dark'
                                }`}>{idx + 1}</span>
                                <img
                                  src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                                  alt={p.full_name}
                                  className="w-8 h-8 rounded-full border-2 border-brand-black-border object-cover shrink-0"
                                />
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1">
                                    {p.dorsal != null && <span className="text-[9px] font-black text-amber-400 shrink-0">#{p.dorsal}</span>}
                                    <span className="text-[12px] font-semibold text-brand-gray-light truncate">{p.nickname || p.full_name}</span>
                                  </div>
                                  <span className="text-[8px] text-brand-gray-dark">{st.total} sesiones</span>
                                </div>
                              </div>
                            </td>

                            {/* ASISTE */}
                            <td className={`border-r border-emerald-800/20 ${asisteBg}`}>
                              {st.total > 0 ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 py-2 px-1">
                                  <span className={`text-base font-extrabold ${asisteTxt}`}>{asistePct}%</span>
                                  <span className="text-[8px] text-brand-gray-dark">{asisteN}/{st.total}</span>
                                  <div className="w-10 h-1.5 bg-black/20 rounded-full overflow-hidden mt-0.5">
                                    <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${asistePct}%` }} />
                                  </div>
                                </div>
                              ) : <span className="block text-center text-brand-gray-dark py-3">—</span>}
                            </td>

                            {/* NO ASISTE */}
                            <td className={`border-r border-rose-800/20 ${noBg}`}>
                              {st.total > 0 ? (
                                <div className="flex flex-col items-center justify-center gap-0.5 py-2 px-1">
                                  <span className={`text-base font-extrabold ${noTxt}`}>{noPct}%</span>
                                  <span className="text-[8px] text-brand-gray-dark">{noN}/{st.total}</span>
                                  <div className="w-10 h-1.5 bg-black/20 rounded-full overflow-hidden mt-0.5">
                                    <div className="h-full bg-rose-500 rounded-full" style={{ width: `${noPct}%` }} />
                                  </div>
                                </div>
                              ) : <span className="block text-center text-brand-gray-dark py-3">—</span>}
                            </td>

                            {/* Divisor */}
                            <td className="w-px bg-brand-black-border/80 border-r border-brand-black-border p-0" />

                            {/* Causas */}
                            {CAUSE_COLS.map(col => {
                              const v = causeVals[col.key] ?? 0;
                              return (
                                <td key={col.key} className={`text-center py-2 px-1 ${v > 0 ? col.cellBg(v) : ''}`}>
                                  {v > 0 ? (
                                    <div className="flex flex-col items-center gap-0.5">
                                      <span className={`text-[11px] font-bold ${col.color}`}>{v}%</span>
                                      <div className="w-8 h-1 bg-black/20 rounded-full overflow-hidden">
                                        <div className={`h-full rounded-full ${col.barCl}`} style={{ width: `${Math.min(v * 2.5, 100)}%` }} />
                                      </div>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-brand-gray-dark/30">—</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>

                    {/* Media equipo */}
                    <tfoot className="border-t-2 border-brand-black-border bg-brand-black/60">
                      <tr>
                        <td className="py-2 px-3 sticky left-0 z-10 bg-brand-black/80 border-r border-brand-black-border">
                          <span className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider">Media equipo</span>
                        </td>
                        {/* Asiste media */}
                        {(() => {
                          const avg = rankedPlayers.length > 0
                            ? Math.round(rankedPlayers.reduce((a, { st }) => a + st.pctEnt + st.pctEd, 0) / rankedPlayers.length)
                            : 0;
                          return <td className="py-2 text-center border-r border-emerald-800/20 bg-emerald-950/5"><span className="text-xs font-bold text-emerald-400">{avg}%</span></td>;
                        })()}
                        {/* No asiste media */}
                        {(() => {
                          const avg = rankedPlayers.length > 0
                            ? Math.round(rankedPlayers.reduce((a, { st }) => a + st.pctAus + st.pctAa + st.pctAo + st.pctLes + st.pctEnf + st.pctPart + st.pctViaje + st.pctLj + st.pctDesc, 0) / rankedPlayers.length)
                            : 0;
                          return <td className="py-2 text-center border-r border-rose-800/20 bg-rose-950/5"><span className="text-xs font-bold text-rose-400">{avg}%</span></td>;
                        })()}
                        <td className="w-px bg-brand-black-border/80 border-r border-brand-black-border p-0" />
                        {CAUSE_COLS.map(col => {
                          const keyMap: Record<string, string> = {
                            ed: 'pctEd', les: 'pctLes', enf: 'pctEnf', aus: 'pctAus', aa: 'pctAa',
                            ao: 'pctAo', part: 'pctPart', viaje: 'pctViaje', lj: 'pctLj', desc: 'pctDesc',
                          };
                          const k = keyMap[col.key];
                          const avg = rankedPlayers.length > 0
                            ? Math.round(rankedPlayers.reduce((a, { st }) => a + (st as any)[k], 0) / rankedPlayers.length)
                            : 0;
                          return (
                            <td key={col.key} className="py-2 px-2 text-center">
                              {avg > 0
                                ? <span className={`text-[11px] font-bold ${col.color}`}>{avg}%</span>
                                : <span className="text-[10px] text-brand-gray-dark/30">—</span>}
                            </td>
                          );
                        })}
                      </tr>
                    </tfoot>
                  </table>
                </div>

                {/* Leyenda */}
                <div className="px-4 py-3 border-t border-brand-black-border bg-brand-black/30">
                  <div className="flex flex-wrap gap-x-3 gap-y-1.5 text-[9px]">
                    <span className="font-bold text-brand-gray-light text-[10px] mr-1">Causas:</span>
                    {CAUSE_COLS.map(c => (
                      <span key={c.key} title={c.full} className="cursor-help">
                        <span className={`font-bold ${c.color}`}>{c.label}</span>
                        <span className="text-brand-gray-dark"> = {c.full}</span>
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* ══════ TAB 3 — ANÁLISIS INDIVIDUAL ══════════════════════════════════ */}
      {activeTab === 'indiv' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <div className="flex-1">
              <label className="form-label">Jugador a analizar</label>
              <select value={selectedPlayerId} onChange={e => setSelectedPlayerId(e.target.value)}
                disabled={isPlayerRole} className="form-input bg-brand-black-bg mt-1">
                {visiblePlayers.map(p => (
                  <option key={p.id} value={p.id} className="bg-brand-black-card">
                    {p.dorsal != null ? `#${p.dorsal} — ` : ''}{p.nickname || p.full_name}
                  </option>
                ))}
              </select>
            </div>
            {currentPlayer && (
              <div className="flex items-center gap-3 p-3 bg-brand-black border border-brand-black-border rounded-xl shrink-0">
                <img src={currentPlayer.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                  alt={currentPlayer.full_name} className="w-12 h-12 rounded-full border-2 border-brand-red-600/30 object-cover" />
                <div>
                  <h4 className="text-sm font-bold text-brand-gray-light">{currentPlayer.nickname || currentPlayer.full_name}</h4>
                  {currentPlayer.position && <span className="text-[10px] text-brand-gray-muted block">{currentPlayer.position}</span>}
                  <span className="text-[9px] bg-brand-red-600/10 text-brand-red-600 px-1.5 py-0.5 border border-brand-red-600/20 rounded font-bold uppercase tracking-wider inline-block mt-0.5">
                    Dorsal #{currentPlayer.dorsal ?? '—'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {currentPlayer && currentPlayerSt ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Asistencia', value: currentPlayerSt.total > 0 ? `${currentPlayerSt.pctEnt}%` : '—',
                    color: currentPlayerSt.pctEnt >= 85 ? 'text-emerald-400' : currentPlayerSt.pctEnt >= 70 ? 'text-amber-400' : 'text-rose-400',
                    sub: 'Tasa de presencia' },
                  { label: 'Entrena',    value: currentPlayerSt.ent,  color: 'text-emerald-400', sub: 'Sesiones completadas' },
                  { label: 'Ausencias',  value: currentPlayerSt.aus,  color: 'text-rose-400',    sub: 'Faltas sin justificar' },
                  { label: 'Baja médica',value: currentPlayerSt.les + currentPlayerSt.enf, color: 'text-orange-400', sub: 'Lesiones + enfermedades' },
                ].map(i => (
                  <div key={i.label} className="text-center p-4 bg-brand-black border border-brand-black-border rounded-xl">
                    <span className="text-[9px] text-brand-gray-muted uppercase tracking-wider block font-semibold">{i.label}</span>
                    <span className={`text-3xl font-extrabold block mt-1.5 ${i.color}`}>{i.value}</span>
                    <span className="text-[9px] text-brand-gray-muted mt-1 block">{i.sub}</span>
                  </div>
                ))}
              </div>

              {currentPlayerSt.total > 0 && (
                <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl space-y-2">
                  <div className="flex justify-between text-[9px] text-brand-gray-muted font-semibold uppercase tracking-wider">
                    <span>Distribución de sesiones</span>
                    <span>{currentPlayerSt.total} sesiones realizadas ({currentMonthName} {selectedYear})</span>
                  </div>
                  <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                    {[
                      { n: currentPlayerSt.ent,  cl: 'bg-emerald-500' },
                      { n: currentPlayerSt.ed,   cl: 'bg-amber-500'   },
                      { n: currentPlayerSt.les + currentPlayerSt.enf, cl: 'bg-orange-500' },
                      { n: currentPlayerSt.aus + currentPlayerSt.aa + currentPlayerSt.ao, cl: 'bg-rose-500' },
                      { n: currentPlayerSt.part + currentPlayerSt.viaje + currentPlayerSt.lj + currentPlayerSt.desc, cl: 'bg-brand-gray-dark' },
                    ].filter(s => s.n > 0).map((s, i) => (
                      <div key={i} className={`${s.cl} transition-all`} style={{ width: `${(s.n / currentPlayerSt.total) * 100}%` }} />
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-3 text-[9px] text-brand-gray-muted">
                    {[
                      { cl: 'bg-emerald-500',    label: `ENT (${currentPlayerSt.ent})` },
                      { cl: 'bg-amber-500',      label: `ED (${currentPlayerSt.ed})` },
                      { cl: 'bg-orange-500',     label: `MED (${currentPlayerSt.les + currentPlayerSt.enf})` },
                      { cl: 'bg-rose-500',       label: `AUS (${currentPlayerSt.aus})` },
                      { cl: 'bg-brand-gray-dark',label: `OTROS (${currentPlayerSt.part + currentPlayerSt.viaje + currentPlayerSt.lj + currentPlayerSt.desc})` },
                    ].map(i => (
                      <span key={i.label} className="flex items-center gap-1">
                        <span className={`w-2 h-2 rounded-sm inline-block ${i.cl}`} /> {i.label}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 border-b border-brand-black-border flex items-center gap-2">
                  <Activity className="w-4 h-4 text-brand-red-600" />
                  <h4 className="text-sm font-bold text-brand-gray-light">
                    Historial sesiones — {currentMonthName} {selectedYear}
                  </h4>
                </div>
                {monthlyTrainings.length === 0 ? (
                  <p className="text-xs text-brand-gray-muted italic text-center py-6">No hay entrenamientos en este mes.</p>
                ) : (
                  <div className="divide-y divide-brand-black-border">
                    {monthlyTrainings.map((t: any) => {
                      const log    = attendanceData.find((a: any) => a.training_id === t.id && a.player_id === selectedPlayerId);
                      const status = log?.status || '-';
                      const pres   = isPresent(status);
                      const med    = isMedical(status);
                      return (
                        <div key={t.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-brand-black-hover/10 transition-all ${
                          pres ? 'border-l-2 border-emerald-500/40' : med ? 'border-l-2 border-orange-500/40' : status === '-' ? '' : 'border-l-2 border-rose-500/40'
                        }`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pres ? 'bg-emerald-500' : med ? 'bg-orange-500' : status === '-' ? 'bg-brand-gray-dark' : 'bg-rose-500'}`} />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-brand-gray-light">{t.date}</span>
                                <span className="text-[10px] text-brand-gray-muted">{t.time} hs · {t.location}</span>
                              </div>
                              <p className="text-[10px] text-brand-gray-muted mt-0.5">{t.objective}</p>
                              {log?.observations && (
                                <p className="text-[10px] text-brand-red-600/80 italic flex items-center gap-1 mt-0.5">
                                  <Info className="w-3 h-3 shrink-0" /> {log.observations}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center pl-4 sm:pl-0">
                            {status !== '-' ? (
                              <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider ${getStatusStyles(status)}`}>
                                {getLabel(status)}
                              </span>
                            ) : (
                              <span className="text-[10px] text-brand-gray-dark italic">Sin registro</span>
                            )}
                            {canEdit && (
                              <button onClick={() => handleCellClick(t.id, currentPlayer.id)}
                                className="p-1.5 rounded-lg border border-brand-black-border text-brand-gray-dark hover:text-brand-gray-light hover:border-brand-gray-dark transition-all" title="Editar">
                                <Zap className="w-3 h-3" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <EmptyState text="Selecciona un jugador para ver su análisis." />
          )}
        </div>
      )}

      {/* ══════ TAB 4 — ASISTENCIAS (listado completo) ══════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="space-y-3">
          {isLoading ? (
            <TableSkeleton />
          ) : allTrainingsSorted.length === 0 ? (
            <EmptyState text="No hay entrenamientos registrados." />
          ) : (
            allTrainingsSorted.map((t: any) => {
              const sessionLogs  = allAttendanceData.filter((a: any) => a.training_id === t.id);
              const presentCount = sessionLogs.filter((a: any) => isPresent(a.status)).length;
              const totalLogs    = sessionLogs.length;
              return (
                <div key={t.id} className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-brand-black-card/30 border-b border-brand-black-border">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${t.status === 'Realizado' ? 'bg-emerald-500' : t.status === 'Cancelado' ? 'bg-red-500' : 'bg-brand-gray-dark'}`} />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-brand-gray-light">{t.date}</span>
                          <span className="text-[10px] text-brand-gray-muted">{t.time} hs · {t.location}</span>
                          <span className={`text-[8px] px-1.5 py-0.5 rounded font-bold border ${
                            t.status === 'Realizado' ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' :
                            t.status === 'Cancelado' ? 'bg-red-950/20 text-red-400 border-red-900/30' :
                            'bg-brand-black-border text-brand-gray-muted border-brand-black-border'
                          }`}>{t.status}</span>
                        </div>
                        <p className="text-[11px] text-brand-gray-muted mt-0.5">{t.objective}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="flex items-center gap-1.5 text-xs">
                        <span className="text-emerald-400 font-bold">{presentCount}</span>
                        <span className="text-brand-gray-dark">/</span>
                        <span className="text-brand-gray-muted">{totalLogs} registros</span>
                      </div>
                      {canEdit && (
                        <button onClick={() => { setSelectedTrainingId(t.id); setRollCallOpen(true); }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light hover:border-brand-gray-dark transition-all">
                          <UserCheck className="w-3 h-3" /> Pasar lista
                        </button>
                      )}
                      {canEdit && totalLogs > 0 && (
                        <button
                          onClick={() => {
                            if (confirm(`¿Eliminar todos los registros de asistencia del ${t.date}?`)) {
                              dataService.deleteAllAttendanceForTraining(t.id)
                                .then(() => { queryClient.invalidateQueries({ queryKey: ['attendance_all'] }); queryClient.invalidateQueries({ queryKey: ['attendance'] }); showToast('success', 'Registros eliminados', ''); })
                                .catch((err: any) => showToast('error', 'Error', err.message));
                            }
                          }}
                          className="flex items-center gap-1 px-2.5 py-1.5 text-[10px] font-semibold rounded-lg border border-red-900/30 text-red-400 hover:bg-red-950/20 transition-all">
                          <Trash2 className="w-3 h-3" /> Borrar todo
                        </button>
                      )}
                    </div>
                  </div>

                  {sessionLogs.length === 0 ? (
                    <p className="text-[11px] text-brand-gray-dark italic text-center py-3">Sin registros de asistencia.</p>
                  ) : (
                    <div className="divide-y divide-brand-black-border/50">
                      {sessionLogs
                        .map((log: any) => ({ log, player: visiblePlayers.find(p => p.id === log.player_id) }))
                        .filter(({ player }) => player !== undefined)
                        .sort((a, b) => (a.player?.dorsal ?? 999) - (b.player?.dorsal ?? 999))
                        .map(({ log, player }) => {
                          if (!player) return null;
                          return (
                            <div key={log.player_id} className="flex items-center justify-between gap-3 px-4 py-1.5 hover:bg-brand-black-hover/10 transition-colors">
                              <div className="flex items-center gap-2 min-w-0">
                                <img src={player.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                                  alt={player.full_name} className="w-6 h-6 rounded-full border border-brand-black-border object-cover shrink-0" />
                                <div className="min-w-0 flex items-center gap-1">
                                  {player.dorsal != null && <span className="text-[9px] font-black text-amber-400 shrink-0">#{player.dorsal}</span>}
                                  <span className="text-[11px] font-semibold text-brand-gray-light truncate">{player.nickname || player.full_name}</span>
                                </div>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                {log.observations && (
                                  <span className="text-[9px] text-brand-gray-muted italic max-w-[120px] truncate hidden sm:block" title={log.observations}>{log.observations}</span>
                                )}
                                <span className={`inline-flex px-2 py-0.5 text-[10px] font-bold rounded border uppercase tracking-wider ${getStatusStyles(log.status)}`}>
                                  {getShort(log.status)}
                                </span>
                                {canEdit && (
                                  <button onClick={() => handleCellClick(t.id, player.id)}
                                    className="p-1 rounded border border-brand-black-border text-brand-gray-dark hover:text-brand-gray-light hover:border-brand-gray-dark transition-all" title="Editar registro">
                                    <Zap className="w-3 h-3" />
                                  </button>
                                )}
                                {canEdit && (
                                  <button
                                    onClick={() => {
                                      if (confirm(`¿Eliminar el registro de ${player.nickname || player.full_name} del ${t.date}?`)) {
                                        dataService.deleteAttendanceRecord(t.id, player.id)
                                          .then(() => { queryClient.invalidateQueries({ queryKey: ['attendance_all'] }); queryClient.invalidateQueries({ queryKey: ['attendance'] }); showToast('success', 'Registro eliminado', ''); })
                                          .catch((err: any) => showToast('error', 'Error', err.message));
                                      }
                                    }}
                                    className="p-1 rounded border border-red-900/30 text-red-400/60 hover:text-red-400 hover:bg-red-950/20 transition-all" title="Eliminar este registro">
                                    <Trash2 className="w-3 h-3" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ══════ MODAL — PASE DE LISTA ═════════════════════════════════════════ */}
      <Modal isOpen={rollCallOpen} onClose={() => setRollCallOpen(false)} title="Pase de Lista">
        <div className="space-y-4">
          <div>
            <label className="form-label">Sesión de entrenamiento</label>
            <select value={selectedTrainingId} onChange={e => setSelectedTrainingId(e.target.value)}
              className="form-input bg-brand-black-bg mt-1">
              {allTrainingsSorted.map((t: any) => (
                <option key={t.id} value={t.id} className="bg-brand-black-card">
                  {t.date} — {t.time} hs ({t.location})
                </option>
              ))}
            </select>
          </div>

          <div className="divide-y divide-brand-black-border border border-brand-black-border rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
            {visiblePlayers.map(p => {
              const cur = rollCallList[p.id]?.status || 'ENT';
              const obs = rollCallList[p.id]?.observations || '';
              return (
                <div key={p.id} className="p-3 flex flex-col gap-2 hover:bg-brand-black-hover/10 transition-colors">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <img src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} alt={p.full_name}
                        className="w-8 h-8 rounded-full border border-brand-black-border object-cover shrink-0" />
                      <div>
                        <span className="text-xs font-semibold text-brand-gray-light">{p.nickname || p.full_name}</span>
                        {p.dorsal && <span className="text-[9px] text-amber-400 font-bold block">#{p.dorsal}</span>}
                      </div>
                    </div>
                    <select value={cur}
                      onChange={e => setRollCallList(prev => ({ ...prev, [p.id]: { ...prev[p.id], status: e.target.value } }))}
                      className={`text-[11px] font-bold rounded-lg border px-2 py-1.5 focus:ring-0 focus:outline-none cursor-pointer ${getStatusStyles(cur)} bg-brand-black`}>
                      {STATUS_OPTIONS.map(o => (
                        <option key={o.value} value={o.value} className="bg-brand-black text-brand-gray-light">
                          {o.short} — {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="relative">
                    <MessageSquare className="w-3 h-3 text-brand-gray-dark absolute left-2.5 top-2.5" />
                    <input type="text" placeholder="Observaciones..." value={obs}
                      onChange={e => setRollCallList(prev => ({ ...prev, [p.id]: { ...prev[p.id], observations: e.target.value } }))}
                      className="form-input text-xs pl-7 w-full bg-brand-black/40" />
                  </div>
                </div>
              );
            })}
          </div>

          <div className="flex gap-2 justify-end">
            <button onClick={() => setRollCallOpen(false)} className="btn-secondary py-2 text-xs">Cancelar</button>
            <button onClick={handleSaveRollCall} disabled={rollCallMut.isPending || !selectedTrainingId}
              className="btn-primary py-2 text-xs font-semibold flex items-center gap-1.5">
              <ClipboardCheck className="w-3.5 h-3.5" />
              {rollCallMut.isPending ? 'Guardando...' : 'Guardar Asistencias'}
            </button>
          </div>
        </div>
      </Modal>

      {/* ══════ MODAL — EDICIÓN DE CELDA ══════════════════════════════════════ */}
      <Modal isOpen={editingCell !== null} onClose={() => setEditingCell(null)} title="Modificar Asistencia">
        {editingCell && (
          <form onSubmit={handleSaveCell} className="space-y-4">
            <p className="text-xs text-brand-gray-muted leading-relaxed">
              Modificando{' '}
              <strong className="text-brand-gray-light">
                {visiblePlayers.find(p => p.id === editingCell.playerId)?.nickname ||
                 visiblePlayers.find(p => p.id === editingCell.playerId)?.full_name}
              </strong>{' '}
              — entrenamiento del{' '}
              <strong className="text-brand-gray-light">
                {allTrainingsSorted.find((t: any) => t.id === editingCell.trainingId)?.date}
              </strong>.
            </p>
            <div>
              <label className="form-label">Estado de Asistencia</label>
              <select value={editingCell.status}
                onChange={e => setEditingCell(prev => prev ? { ...prev, status: e.target.value } : null)}
                className="form-input bg-brand-black-bg mt-1">
                {STATUS_OPTIONS.map(o => (
                  <option key={o.value} value={o.value} className="bg-brand-black-card">{o.label} ({o.short})</option>
                ))}
              </select>
            </div>
            <div>
              <label className="form-label">Observaciones</label>
              <input type="text" className="form-input mt-1" placeholder="Molestias, viaje, descanso de carga..."
                value={editingCell.observations}
                onChange={e => setEditingCell(prev => prev ? { ...prev, observations: e.target.value } : null)} />
            </div>
            <div className="flex gap-2 justify-end pt-1">
              <button type="button" onClick={() => setEditingCell(null)} className="btn-secondary py-2 text-xs">Cancelar</button>
              <button type="submit" className="btn-primary py-2 text-xs font-semibold" disabled={updateMut.isPending}>
                {updateMut.isPending ? 'Guardando...' : 'Guardar Cambios'}
              </button>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};

// ── Auxiliar ───────────────────────────────────────────────────────────────────
const EmptyState: React.FC<{ text: string }> = ({ text }) => (
  <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
    <p className="text-sm text-brand-gray-muted">{text}</p>
  </div>
);
