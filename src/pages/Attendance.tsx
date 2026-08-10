import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { TrainingAttendance, Player, Match } from '../types';
import { supabase } from '../lib/supabase';
import { exportToCSV, exportToPDF, exportAttendanceToPDF, ExportCell } from '../utils/export';
import logos from '../assets/logos.json';
import {
  ClipboardCheck, Download, FileText, Calendar,
  TrendingUp, Info, Award, UserCheck, MessageSquare,
  BarChart2, User, Activity, Zap, Trash2, CheckCircle2, X, AlertTriangle
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
  const [filterTeam, setFilterTeam] = useState(user?.team_category || 'Primer Equipo');
  useEffect(() => {
    if (user?.team_category) {
      setFilterTeam(user.team_category);
    }
  }, [user?.team_category]);

  const [activeTab,          setActiveTab]          = useState<ActiveTab>('matrix');
  const [selectedMonth,      setSelectedMonth]      = useState(new Date().getMonth() + 1);
  const [selectedYear,       setSelectedYear]       = useState(new Date().getFullYear());
  const [selectedPlayerId,   setSelectedPlayerId]   = useState('');
  const [selectedTrainingId, setSelectedTrainingId] = useState('');
  const [editingCell, setEditingCell] = useState<{
    trainingId: string; playerId: string; status: string; observations: string;
  } | null>(null);
  const [rollCallList, setRollCallList] = useState<Record<string, { status: string; observations: string; intent?: boolean | null; intentReason?: string }>>({});
  const [rollCallOpen, setRollCallOpen] = useState(false);
  const [rollCallTeamTab, setRollCallTeamTab] = useState<'Primer Equipo' | 'Juvenil'>('Primer Equipo');
  const [exportModalOpen, setExportModalOpen] = useState(false);
  const [exportFormat, setExportFormat]       = useState<'csv' | 'pdf'>('pdf');
  const [exportRange, setExportRange]         = useState<'current' | 'all' | 'custom'>('current');
  const [customMonths, setCustomMonths]       = useState<number[]>([new Date().getMonth() + 1]);

  // ── Queries ────────────────────────────────────────────────────────────────
  const { data: players = [],        isLoading: lPlayers   } = useQuery({ queryKey: ['players'],   queryFn: () => dataService.getPlayers() });
  const { data: trainings = [],      isLoading: lTrainings } = useQuery({ queryKey: ['trainings'], queryFn: () => dataService.getTrainings() });
  const { data: matches = [],        isLoading: lMatches   } = useQuery({ queryKey: ['matches'],   queryFn: () => dataService.getMatches() });
  const { data: allPlayerMatchStats = [], isLoading: lPlayerMatchStats } = useQuery({
    queryKey: ['allPlayerMatchStats'],
    queryFn: async () => {
      const { data, error } = await supabase.from('player_match_stats').select('*');
      if (error) throw error;
      return data || [];
    }
  });
  const { data: rivalTeams = [],     isLoading: lRivalTeams } = useQuery({
    queryKey: ['rivalTeams'],
    queryFn: async () => {
      const { data, error } = await supabase.from('rival_teams').select('*');
      if (error) throw error;
      return data || [];
    }
  });
  const { data: attendanceData = [], isLoading: lAtt }       = useQuery({
    queryKey: ['attendance', selectedYear, selectedMonth],
    queryFn:  () => dataService.getAttendanceByMonth(selectedYear, selectedMonth),
  });
  const { data: allAttendanceData = [], isLoading: lAllAtt } = useQuery({
    queryKey: ['attendance_all'],
    queryFn:  () => dataService.getAllAttendance(),
  });

  const isLoading      = lPlayers || lTrainings || lAtt || lMatches || lPlayerMatchStats || lRivalTeams;
  const isCumulLoading = lPlayers || lTrainings || lAllAtt || lMatches || lPlayerMatchStats || lRivalTeams;

  const getTeamLogo = (teamName: string): string => {
    const opt = rivalTeams.find((rt: any) => rt.name === teamName);
    if (opt?.shield_url) return opt.shield_url;
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const target = normalize(teamName);
    const matchKey = Object.keys(logos).find(key => normalize(key) === target);
    if (matchKey) {
      return (logos as Record<string, string>)[matchKey];
    }
    return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
  };

  // ── Datos derivados ────────────────────────────────────────────────────────
  const visiblePlayers: Player[] = isPlayerRole && user
    ? players.filter((p: Player) => p.profile_id === user.id || p.id === user.id)
    : players.filter((p: Player) => (p.team_category || 'Primer Equipo') === filterTeam);

  const filteredTrainings = trainings.filter((t: any) => (t.team_category || 'Primer Equipo') === filterTeam);

  const monthlyTrainings = filteredTrainings
    .filter((t: any) => {
      const d = new Date(t.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const filteredMatches = matches.filter((m: any) => (m.team_category || 'Primer Equipo') === filterTeam);
  const monthlyMatches = filteredMatches
    .filter((m: any) => {
      const d = new Date(m.date);
      return d.getFullYear() === selectedYear && d.getMonth() + 1 === selectedMonth;
    });

  const monthlySessions = [
    ...monthlyTrainings.map(t => ({ ...t, type: 'entrenamiento' })),
    ...monthlyMatches.map(m => ({ ...m, type: 'partido', objective: `Partido vs ${m.rival}` }))
  ].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

  const completedTrainings    = monthlyTrainings.filter((t: any) => attendanceData.some((a: any) => a.training_id === t.id));
  const allCompletedTrainings = filteredTrainings.filter((t: any) => allAttendanceData.some((a: any) => a.training_id === t.id));
  const allTrainingsSorted    = [...filteredTrainings].sort((a: any, b: any) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // ── Effects ────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (visiblePlayers.length > 0) {
      if (!selectedPlayerId || !visiblePlayers.find(p => p.id === selectedPlayerId)) {
        setSelectedPlayerId(visiblePlayers[0].id);
      }
    } else {
      setSelectedPlayerId('');
    }
  }, [players, filterTeam]);

  useEffect(() => {
    if (rollCallOpen) {
      setRollCallTeamTab(filterTeam === 'Juvenil' ? 'Juvenil' : 'Primer Equipo');
    }
  }, [rollCallOpen, filterTeam]);

  useEffect(() => {
    setSelectedTrainingId(monthlyTrainings.length > 0 ? monthlyTrainings[0].id : '');
  }, [selectedMonth, selectedYear, trainings]);

  useEffect(() => {
    if (!selectedTrainingId) return;
    const currentTraining = trainings.find((t: any) => t.id === selectedTrainingId);
    const trainingTeam = currentTraining?.team_category || 'Primer Equipo';

    const init: Record<string, { status: string; observations: string; intent?: boolean | null; intentReason?: string }> = {};
    players.forEach(p => {
      const log = attendanceData.find((a: any) => a.training_id === selectedTrainingId && a.player_id === p.id) 
               || allAttendanceData.find((a: any) => a.training_id === selectedTrainingId && a.player_id === p.id);
      const isBaja = p.physical_status === 'Baja';
      
      const isSameTeam = (p.team_category || 'Primer Equipo') === trainingTeam;
      let defaultStatus = isSameTeam ? (isBaja ? 'L' : 'ENT') : '-';
      if (isSameTeam && log?.player_intent === false && defaultStatus === 'ENT') defaultStatus = 'AA';
      
      let initialObservations = log?.observations || '';
      if (!initialObservations) {
        if (isSameTeam && isBaja) initialObservations = 'Baja médica';
        else if (isSameTeam && log?.player_intent === false && log?.player_reason) initialObservations = `Motivo: ${log.player_reason}`;
      }

      init[p.id] = { 
        status: log?.status && log.status !== '-' ? log.status : defaultStatus, 
        observations: initialObservations,
        intent: log?.player_intent,
        intentReason: log?.player_reason ?? undefined
      };
    });
    setRollCallList(init);
  }, [selectedTrainingId, attendanceData, allAttendanceData, players, trainings]);

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

  const deleteAttendanceMut = useMutation({
    mutationFn: (trainingId: string) => dataService.deleteAllAttendanceForTraining(trainingId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['attendance'] });
      queryClient.invalidateQueries({ queryKey: ['attendance_all'] });
      showToast('success', 'Asistencia borrada', '');
    },
    onError: (err: any) => showToast('error', 'Error al borrar', err.message),
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

  const handleConfirmExport = async () => {
    if (!players.length) return;
    const monthsToExport = exportRange === 'current' ? [selectedMonth] 
                         : exportRange === 'all' ? months.map(m => m.value) 
                         : customMonths;

    if (monthsToExport.length === 0) {
      showToast('error', 'Selecciona al menos un mes', '');
      return;
    }

    const targetTrainings = allCompletedTrainings
      .filter((t: any) => {
        const d = new Date(t.date);
        return monthsToExport.includes(d.getMonth() + 1);
      })
      .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (exportFormat === 'csv') {
      const headers = ['Jugador', ...targetTrainings.map((t: any) => t.date), '% Asist', 'ENT', 'AUS', 'ED', 'L', 'E'];
      const rows: ExportCell[][] = visiblePlayers.map(p => {
        const st = exportRange === 'current' ? calcPlayerStats(p.id) : calcPlayerStatsCumul(p.id);
        const row: ExportCell[] = [p.nickname || p.full_name];
        targetTrainings.forEach((t: any) => {
          const log = allAttendanceData.find((a: any) => a.training_id === t.id && a.player_id === p.id);
          row.push(log?.status ? getShort(log.status) : '-');
        });
        row.push(`${st.pctEnt}%`, st.ent, st.aus, st.ed, st.les, st.enf);
        return row;
      });
      exportToCSV(`asistencias_multimes_${Date.now()}`, headers, rows);
      showToast('success', 'CSV descargado', '');
      setExportModalOpen(false);
    } else {
      try {
        const playersWithStats = visiblePlayers.map(p => ({
          ...p,
          cumulStats: calcPlayerStatsCumul(p.id)
        }));
        await exportAttendanceToPDF(
          `Control Asistencia - UD Atzeneta`,
          `asistencias_${Date.now()}`,
          monthsToExport,
          months,
          playersWithStats,
          targetTrainings,
          allAttendanceData
        );
        showToast('success', 'PDF descargado', '');
        setExportModalOpen(false);
      } catch (err: any) {
        showToast('error', 'Error al exportar PDF', err.message);
      }
    }
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
              <button onClick={() => { setExportFormat('csv'); setExportModalOpen(true); }} className="btn-secondary py-2 text-xs flex items-center gap-1.5">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={() => { setExportFormat('pdf'); setExportModalOpen(true); }} className="btn-secondary py-2 text-xs flex items-center gap-1.5">
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
          { id: 'sessions', icon: Calendar,       label: 'Editor'  },
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
          ) : monthlySessions.length === 0 ? (
            <EmptyState text="No hay entrenamientos ni partidos en el mes seleccionado." />
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
                        {monthlySessions.map((session: any) => {
                          const isMatch = session.type === 'partido';
                          return (
                            <th key={session.id} className="py-2 text-center" style={{ minWidth: 52 }} title={`${session.date} — ${session.objective}`}>
                              <div className="flex flex-col items-center gap-0.5">
                                <span className={`text-[10px] font-bold ${isMatch ? 'text-brand-red-500' : 'text-brand-gray-muted'}`}>
                                  {session.date.split('-').slice(1).reverse().join('/')}
                                </span>
                                {isMatch ? (
                                  <img 
                                    src={getTeamLogo(session.rival)} 
                                    alt={session.rival} 
                                    className="w-5 h-5 object-contain mt-0.5" 
                                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png'; }}
                                  />
                                ) : (
                                  <span className="text-[8px] font-extrabold px-1 rounded bg-brand-black-border text-brand-gray-muted">
                                    ENT
                                  </span>
                                )}
                              </div>
                            </th>
                          );
                        })}
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
                                  <span className="text-[11px] font-semibold text-brand-gray-light truncate flex items-center gap-1">
                                    {p.nickname || p.full_name}
                                    {p.team_category === 'Juvenil' && <span className="text-[7px] font-black bg-brand-red-600/20 text-brand-red-500 px-1 py-0.5 rounded uppercase">JUV</span>}
                                  </span>
                                </div>
                              </div>
                            </td>
                            {monthlySessions.map((session: any) => {
                              const isMatch = session.type === 'partido';
                              if (isMatch) {
                                const stat = allPlayerMatchStats.find((s: any) => s.match_id === session.id && s.player_id === p.id);
                                const isPresent = stat ? stat.is_called_up : false;
                                const cellBg = isPresent ? 'bg-emerald-600/20 border-b-2 border-emerald-500/40' : 'bg-rose-600/10 border-b-2 border-rose-500/20';
                                const textCl = isPresent ? 'text-emerald-400' : 'text-rose-500';
                                return (
                                  <td key={session.id} className="p-0 text-center relative">
                                    <div className={`w-full min-h-[32px] flex flex-col items-center justify-center transition-all ${cellBg}`} title={`${session.date} — Partido contra ${session.rival}. ${isPresent ? 'Convocado' : 'No convocado'}`}>
                                      <span className={`text-[9px] font-extrabold ${textCl}`}>
                                        {isPresent ? 'CONV' : 'NC'}
                                      </span>
                                    </div>
                                  </td>
                                );
                              } else {
                                const log    = attendanceData.find((a: any) => a.training_id === session.id && a.player_id === p.id);
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
                                  <td key={session.id} className="p-0 text-center relative">
                                    <button onClick={() => handleCellClick(session.id, p.id)} disabled={!canEdit}
                                      title={`${session.date} — ${hasData ? getLabel(status) : 'Sin registro'}${log?.observations ? `\nObs: ${log.observations}` : ''}${log?.player_intent !== undefined && log?.player_intent !== null ? `\nConfirmación Jugador: ${log.player_intent ? 'Sí asiste' : 'No asiste'}${log.player_reason ? ` (${log.player_reason})` : ''}` : ''}`}
                                      className={`w-full min-h-[32px] flex items-center justify-center transition-all ${cellBg} ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}>
                                      <span className={`text-[10px] font-bold ${textCl}`}>{hasData && status !== '-' ? getShort(status) : '·'}</span>
                                      {log?.observations && <span className="absolute top-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-brand-red-600" />}
                                      {log?.player_intent === false && <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-amber-500" title="Confirmó que no asistiría" />}
                                      {log?.player_intent === true && <span className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500" title="Confirmó que asistiría" />}
                                    </button>
                                  </td>
                                );
                              }
                            })}
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
            <EmptyState text="Aún no se ha registrado la asistencia de ningún entrenamiento." />
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
                      <tr className="border-b-2 border-brand-black-border bg-brand-black-card">
                        <th className="py-2 px-3 text-left text-[10px] font-bold text-white uppercase tracking-wider sticky left-0 z-10 bg-[#3e2723] border-r border-brand-black-border" style={{ minWidth: 160 }}>Jugador</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Ausente</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Ent.Dif</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Lesionado</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Enfermo</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Partidos</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Libre, jugó</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Viaje</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Ausente aviso</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Ausente, otros</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Descanso</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723] border-r border-brand-black-border">Entrena</th>
                        <th className="py-2 px-1 text-center text-[9px] font-bold text-white uppercase tracking-wider bg-[#3e2723]"> % Entrena</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-brand-black-border/40 bg-brand-black-bg">
                      {rankedPlayers.map(({ p, st }, idx) => {
                        const causeVals = [
                          { key: 'aus', val: st.aus },
                          { key: 'ed', val: st.ed },
                          { key: 'les', val: st.les },
                          { key: 'enf', val: st.enf },
                          { key: 'part', val: st.part },
                          { key: 'lj', val: st.lj },
                          { key: 'viaje', val: st.viaje },
                          { key: 'aa', val: st.aa },
                          { key: 'ao', val: st.ao },
                          { key: 'desc', val: st.desc },
                          { key: 'ent', val: st.ent },
                          { key: 'pctEnt', val: st.pctEnt }
                        ];

                        const getCellStyles = (key: string, val: number, pctVal: number) => {
                          if (key === 'aus' || key === 'les' || key === 'viaje') {
                            if (val === 0) return 'bg-[#2e7d32] text-white';
                            if (val === 1) return 'bg-[#827717] text-white';
                            if (val === 2) return 'bg-[#afb42b] text-white';
                            if (val === 3) return 'bg-[#fbc02d] text-black';
                            if (val <= 5) return 'bg-[#f57c00] text-white';
                            return 'bg-[#d32f2f] text-white';
                          }
                          if (key === 'ed' || key === 'enf' || key === 'ao') {
                            if (val === 0) return 'bg-[#f39c12] text-black';
                            return 'bg-[#e67e22] text-black';
                          }
                          if (key === 'part') {
                            if (val >= 20) return 'bg-[#2e7d32] text-white';
                            if (val >= 15) return 'bg-[#e67e22] text-white';
                            return 'bg-[#c0392b] text-white';
                          }
                          if (key === 'lj' || key === 'desc') {
                            return 'bg-[#5d4037] text-white';
                          }
                          if (key === 'aa') {
                            return 'bg-[#f2f3f4] text-black';
                          }
                          if (key === 'ent' || key === 'pctEnt') {
                            if (pctVal >= 85) return 'bg-[#27ae60] text-white';
                            if (pctVal >= 75) return 'bg-[#f1c40f] text-black';
                            if (pctVal >= 60) return 'bg-[#e67e22] text-white';
                            return 'bg-[#c0392b] text-white';
                          }
                          return 'bg-brand-black-card text-brand-gray-light';
                        };

                        return (
                          <tr key={p.id} className="hover:opacity-90 transition-opacity">
                            <td className="py-1.5 px-3 sticky left-0 z-10 bg-[#1e293b] border-r border-brand-black-border" style={{ minWidth: 160 }}>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] font-semibold text-white truncate flex items-center gap-1">
                                  {p.dorsal ? `${p.dorsal}. ` : ''}{p.nickname || p.full_name}
                                  {p.team_category === 'Juvenil' && <span className="text-[7px] font-black bg-brand-red-600/20 text-brand-red-500 px-1 py-0.5 rounded uppercase">JUV</span>}
                                </span>
                              </div>
                            </td>
                            {causeVals.map(col => (
                              <td key={col.key} className={`py-1.5 px-1 text-center border-r border-brand-black-border/20 text-[11px] font-bold ${getCellStyles(col.key, col.val, st.pctEnt)}`}>
                                {col.key === 'pctEnt' ? `${col.val} %` : col.val}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </tbody>
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
                    {p.dorsal != null ? `#${p.dorsal} — ` : ''}{p.nickname || p.full_name} {p.team_category === 'Juvenil' ? '(JUV)' : ''}
                  </option>
                ))}
              </select>
            </div>
            {currentPlayer && (
              <div className="flex items-center gap-3 p-3 bg-brand-black border border-brand-black-border rounded-xl shrink-0">
                <img src={currentPlayer.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                  alt={currentPlayer.full_name} className="w-12 h-12 rounded-full border-2 border-brand-red-600/30 object-cover" />
                <div>
                  <h4 className="text-sm font-bold text-brand-gray-light flex items-center gap-1">
                    {currentPlayer.nickname || currentPlayer.full_name}
                    {currentPlayer.team_category === 'Juvenil' && <span className="text-[7px] font-black bg-brand-red-600/20 text-brand-red-500 px-1 py-0.5 rounded uppercase">JUV</span>}
                  </h4>
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
                {monthlySessions.length === 0 ? (
                  <p className="text-xs text-brand-gray-muted italic text-center py-6">No hay entrenamientos ni partidos en este mes.</p>
                ) : (
                  <div className="divide-y divide-brand-black-border">
                    {monthlySessions.map((session: any) => {
                      const isMatch = session.type === 'partido';
                      let pres = false;
                      let med = false;
                      let status = '-';
                      let label = '';
                      let details = '';
                      let obs = '';

                      if (isMatch) {
                        const stat = allPlayerMatchStats.find((s: any) => s.match_id === session.id && s.player_id === selectedPlayerId);
                        const isPresent = stat ? stat.is_called_up : false;
                        pres = isPresent;
                        status = isPresent ? 'CON' : 'NC';
                        label = isPresent ? 'Convocado' : 'No Convocado';
                        details = `Partido vs ${session.rival}`;
                      } else {
                        const log    = attendanceData.find((a: any) => a.training_id === session.id && a.player_id === selectedPlayerId);
                        status = log?.status || '-';
                        pres   = isPresent(status);
                        med    = isMedical(status);
                        label  = log?.status ? getLabel(log.status) : '-';
                        details = `${session.time} hs · ${session.location}`;
                        obs = log?.observations || '';
                      }

                      return (
                        <div key={session.id} className={`flex flex-col sm:flex-row sm:items-center justify-between gap-2 px-4 py-2.5 hover:bg-brand-black-hover/10 transition-all ${
                          pres ? 'border-l-2 border-emerald-500/40' : med ? 'border-l-2 border-orange-500/40' : status === '-' || status === 'NC' ? '' : 'border-l-2 border-rose-500/40'
                        }`}>
                          <div className="flex items-start gap-2">
                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${pres ? 'bg-emerald-500' : med ? 'bg-orange-500' : status === '-' || status === 'NC' ? 'bg-brand-gray-dark' : 'bg-rose-500'}`} />
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-xs font-semibold text-brand-gray-light">{session.date}</span>
                                <span className="text-[10px] text-brand-gray-muted">{details}</span>
                                <span className={`text-[8px] font-extrabold px-1.5 py-0.5 rounded ${isMatch ? 'bg-brand-red-600/20 text-brand-red-500' : 'bg-brand-black-border text-brand-gray-muted'}`}>
                                  {isMatch ? 'PARTIDO' : 'ENTRENO'}
                                </span>
                              </div>
                              <p className="text-[10px] text-brand-gray-muted mt-0.5">{session.objective}</p>
                              {obs && (
                                <p className="text-[10px] text-brand-red-600/80 italic flex items-center gap-1 mt-0.5">
                                  <Info className="w-3 h-3 shrink-0" /> {obs}
                                </p>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-2 shrink-0 self-start sm:self-center pl-4 sm:pl-0">
                            {status !== '-' && status !== 'NC' ? (
                              <span className={`inline-flex px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider ${
                                isMatch
                                  ? (pres ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30' : 'bg-rose-950/25 text-rose-400 border-rose-900/30')
                                  : getStatusStyles(status)
                              }`}>
                                {label}
                              </span>
                            ) : status === 'NC' ? (
                              <span className="inline-flex px-2.5 py-1 text-[10px] font-bold rounded border uppercase tracking-wider bg-rose-950/25 text-rose-400 border-rose-900/30">
                                {label}
                              </span>
                            ) : (
                              <span className="text-[10px] text-brand-gray-dark italic">Sin registro</span>
                            )}
                            {canEdit && !isMatch && (
                              <button onClick={() => handleCellClick(session.id, currentPlayer.id)}
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

      {/* ══════ TAB 4 — EDITOR ═════════════════════════════════════════════ */}
      {activeTab === 'sessions' && (
        <div className="space-y-4">
          {isCumulLoading ? (
            <TableSkeleton />
          ) : allTrainingsSorted.length === 0 ? (
            <EmptyState text="No hay entrenamientos registrados." />
          ) : (
            <div className="space-y-2">
              {allTrainingsSorted.map((t: any) => {
                const sessionLogs  = allAttendanceData.filter((a: any) => a.training_id === t.id);
                const presentCount = sessionLogs.filter((a: any) => isPresent(a.status)).length;
                const totalLogs    = sessionLogs.length;
                return (
                  <div
                    key={t.id}
                    className="group w-full flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-4 py-3 bg-brand-black border border-brand-black-border rounded-xl text-left transition-all hover:bg-brand-black-hover hover:border-brand-gray-dark"
                  >
                    <div 
                      className={`flex items-center gap-3 flex-1 ${canEdit ? 'cursor-pointer' : 'cursor-default'}`}
                      onClick={() => {
                        if (canEdit) {
                          setSelectedTrainingId(t.id);
                          setRollCallOpen(true);
                        }
                      }}
                    >
                      <div className="w-2.5 h-2.5 rounded-full shrink-0 bg-brand-gray-dark" />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-bold text-brand-gray-light">{t.date}</span>
                          <span className="text-[10px] text-brand-gray-muted">{t.time} hs · {t.location}</span>
                        </div>
                        <p className="text-[11px] text-brand-gray-muted mt-0.5">{t.objective}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4 shrink-0">
                      <div className="flex flex-col items-end">
                        <span className="text-[10px] text-brand-gray-muted uppercase font-semibold">Asistencia</span>
                        <div className="flex items-center gap-1.5 text-xs mt-0.5">
                          <span className="text-emerald-400 font-bold">{presentCount}</span>
                          <span className="text-brand-gray-dark">/</span>
                          <span className="text-brand-gray-muted">{totalLogs} registrados</span>
                        </div>
                      </div>
                      {canEdit && (
                        <div className="flex items-center gap-2">
                          {totalLogs > 0 && (
                            <button
                              onClick={() => {
                                if (confirm('¿Estás seguro de que deseas borrar todos los registros de asistencia de este entrenamiento?')) {
                                  deleteAttendanceMut.mutate(t.id);
                                }
                              }}
                              className="p-2 bg-brand-black-card rounded-lg text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-black border border-brand-black-border transition-colors"
                              title="Borrar asistencia de todos"
                              disabled={deleteAttendanceMut.isPending}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setSelectedTrainingId(t.id);
                              setRollCallOpen(true);
                            }}
                            className="p-2 bg-brand-black-card rounded-lg text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black border border-brand-black-border transition-colors"
                            title="Editar asistencia"
                          >
                            <UserCheck className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
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

          <div className="flex bg-brand-black border border-brand-black-border p-1 rounded-xl w-full">
            <button 
              type="button"
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${rollCallTeamTab === 'Primer Equipo' ? 'bg-brand-red-600 text-white shadow-glow-red' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
              onClick={() => setRollCallTeamTab('Primer Equipo')}
            >
              Primer Equipo
            </button>
            <button 
              type="button"
              className={`flex-1 py-1.5 text-xs font-bold rounded-lg transition-all ${rollCallTeamTab === 'Juvenil' ? 'bg-brand-red-600 text-white shadow-glow-red' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
              onClick={() => setRollCallTeamTab('Juvenil')}
            >
              Juveniles
            </button>
          </div>

          <div className="divide-y divide-brand-black-border border border-brand-black-border rounded-xl overflow-hidden max-h-[55vh] overflow-y-auto">
            {players
              .filter((p: Player) => (p.team_category || 'Primer Equipo') === rollCallTeamTab)
              .map(p => {
                const cur = rollCallList[p.id]?.status || 'ENT';
                const obs = rollCallList[p.id]?.observations || '';
                return (
                  <div key={p.id} className="p-3 flex flex-col gap-2 hover:bg-brand-black-hover/10 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <img src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} alt={p.full_name}
                          className="w-8 h-8 rounded-full border border-brand-black-border object-cover shrink-0" />
                        <div>
                          <span className="text-xs font-semibold text-brand-gray-light flex items-center gap-1">
                            {p.nickname || p.full_name}
                            {p.team_category === 'Juvenil' && <span className="text-[7px] font-black bg-brand-red-600/20 text-brand-red-500 px-1 py-0.5 rounded uppercase">JUV</span>}
                          </span>
                          {p.dorsal && <span className="text-[9px] text-amber-400 font-bold ml-1">#{p.dorsal}</span>}
                          {p.physical_status === 'Baja' && (
                            <span className="text-[9px] font-black bg-brand-red-600 text-white px-1.5 py-0.5 rounded uppercase ml-2">Baja</span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {rollCallList[p.id]?.intent === true && <span className="text-[10px] text-emerald-400 font-bold bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1" title="El jugador confirmó que asiste"><CheckCircle2 className="w-3 h-3" /> Voy</span>}
                        {rollCallList[p.id]?.intent === false && <span className="text-[10px] text-brand-red-400 font-bold bg-brand-red-500/10 px-1.5 py-0.5 rounded flex items-center gap-1" title={rollCallList[p.id]?.intentReason || "El jugador confirmó que NO asiste"}><X className="w-3 h-3" /> No voy</span>}
                        {rollCallList[p.id]?.intent === null && <span className="text-[10px] text-brand-gray-dark font-bold bg-brand-black-border/50 px-1.5 py-0.5 rounded flex items-center gap-1" title="El jugador no ha respondido"><AlertTriangle className="w-3 h-3" /> N/R</span>}
                        
                        <select value={cur}
                          disabled={p.physical_status === 'Baja'}
                          onChange={e => setRollCallList(prev => ({ ...prev, [p.id]: { ...prev[p.id], status: e.target.value } }))}
                          className={`text-[11px] font-bold rounded-lg border px-2 py-1.5 focus:ring-0 focus:outline-none cursor-pointer ${getStatusStyles(cur)} ${p.physical_status === 'Baja' ? 'opacity-60 cursor-not-allowed' : 'bg-brand-black'}`}>
                          <option value="-" className="bg-brand-black text-brand-gray-light">- Pendiente -</option>
                          {STATUS_OPTIONS.map(o => (
                            <option key={o.value} value={o.value} className="bg-brand-black text-brand-gray-light">
                              {o.short} — {o.label}
                            </option>
                          ))}
                        </select>
                      </div>
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
                disabled={visiblePlayers.find(p => p.id === editingCell?.playerId)?.physical_status === 'Baja'}
                onChange={e => setEditingCell(prev => prev ? { ...prev, status: e.target.value } : null)}
                className={`form-input mt-1 ${visiblePlayers.find(p => p.id === editingCell?.playerId)?.physical_status === 'Baja' ? 'bg-brand-black-border opacity-60 cursor-not-allowed' : 'bg-brand-black-bg'}`}>
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
      {/* ══════ MODAL — EXPORTACIÓN ════════════════════════════════════════════ */}
      <Modal isOpen={exportModalOpen} onClose={() => setExportModalOpen(false)} title={`Exportar a ${exportFormat.toUpperCase()}`}>
        <div className="space-y-5">
          <div>
            <label className="form-label mb-2">Rango de Exportación</label>
            <div className="space-y-2">
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-gray-light">
                <input type="radio" className="form-radio text-brand-red-600 focus:ring-brand-red-600 bg-brand-black-bg border-brand-black-border"
                  checked={exportRange === 'current'} onChange={() => setExportRange('current')} />
                Mes actual ({currentMonthName})
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-gray-light">
                <input type="radio" className="form-radio text-brand-red-600 focus:ring-brand-red-600 bg-brand-black-bg border-brand-black-border"
                  checked={exportRange === 'all'} onChange={() => setExportRange('all')} />
                Todos los meses (Temporada completa)
              </label>
              <label className="flex items-center gap-2 cursor-pointer text-sm text-brand-gray-light">
                <input type="radio" className="form-radio text-brand-red-600 focus:ring-brand-red-600 bg-brand-black-bg border-brand-black-border"
                  checked={exportRange === 'custom'} onChange={() => setExportRange('custom')} />
                Meses específicos...
              </label>
            </div>
          </div>

          {exportRange === 'custom' && (
            <div className="bg-brand-black-card p-3 rounded-xl border border-brand-black-border">
              <label className="form-label mb-2 block">Selecciona los meses</label>
              <div className="grid grid-cols-3 gap-2">
                {months.map(m => (
                  <label key={m.value} className="flex items-center gap-1.5 cursor-pointer text-xs text-brand-gray-light">
                    <input type="checkbox" className="form-checkbox rounded text-brand-red-600 focus:ring-brand-red-600 bg-brand-black-bg border-brand-black-border"
                      checked={customMonths.includes(m.value)}
                      onChange={(e) => {
                        if (e.target.checked) setCustomMonths(prev => [...prev, m.value].sort((a,b) => a-b));
                        else setCustomMonths(prev => prev.filter(v => v !== m.value));
                      }} />
                    {m.label}
                  </label>
                ))}
              </div>
            </div>
          )}

          <div className="flex gap-2 justify-end pt-2">
            <button onClick={() => setExportModalOpen(false)} className="btn-secondary py-2 text-xs">Cancelar</button>
            <button onClick={handleConfirmExport} className="btn-primary py-2 text-xs font-semibold flex items-center gap-1.5">
              {exportFormat === 'csv' ? <FileText className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
              Descargar {exportFormat.toUpperCase()}
            </button>
          </div>
        </div>
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
