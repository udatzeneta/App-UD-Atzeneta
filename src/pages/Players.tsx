import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { useAuth } from '../context/AuthContext';
import { TableSkeleton } from '../components/Skeletons';
import {
  Users, Plus, Edit2, Trash2, AlertTriangle, ChevronRight, Search,
  Download, FileText, ShieldAlert, LayoutGrid, List as ListIcon, BarChart2
} from 'lucide-react';
import { Player, ScoutingPlayer } from '../types';
import { Modal } from '../components/Modal';
import { PhotoCropUpload } from '../components/PhotoCropUpload';
import { useToast } from '../context/ToastContext';
import { exportToCSV, exportSquadToPDF } from '../utils/export';
import { computeSquad, CompetitionFilter, SquadRow, SEASON_LABEL, displayName, formatMatchShort } from '../components/players/squadStats';
import { SquadTable, CardCycle, DisciplineBadge } from '../components/players/SquadTable';
import { SquadAnalytics } from '../components/players/SquadAnalytics';
import { DisciplinePanel } from '../components/players/DisciplinePanel';

type ViewMode = 'list' | 'grid' | 'stats' | 'discipline';

const POSITIONS = [
  'Portero', 'Lateral Derecho', 'Lateral Izquierdo', 'Defensa Central', 'Pivote Defensivo', 'Mediocentro',
  'Interior', 'Extremo Derecho', 'Extremo Izquierdo', 'Mediapunta', 'Delantero Centro'
];

const KpiTile: React.FC<{ label: string; children: React.ReactNode; onClick?: () => void; accent?: string }> = ({ label, children, onClick, accent }) => (
  <div
    onClick={onClick}
    className={`bg-brand-black border border-brand-black-border rounded-xl px-4 py-3 ${onClick ? 'cursor-pointer hover:border-brand-gray-dark/60 transition-colors' : ''} ${accent || ''}`}
  >
    <p className="text-[10px] uppercase tracking-wider font-bold text-brand-gray-muted">{label}</p>
    <div className="mt-1">{children}</div>
  </div>
);

export const Players: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user, hasPermission } = useAuth();
  const queryClient = useQueryClient();

  // Permisos
  const canCreate = hasPermission('players', 'crear');
  const canEdit = hasPermission('players', 'editar');
  const canDelete = hasPermission('players', 'eliminar');
  const canExport = hasPermission('players', 'exportar');

  // Estados de interfaz
  const [searchTerm, setSearchTerm] = useState('');
  const [filterPosition, setFilterPosition] = useState('Todos');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [filterTeam, setFilterTeam] = useState(user?.team_category || 'Primer Equipo');
  
  // Sincronizar el equipo si el user carga asíncronamente
  React.useEffect(() => {
    if (user?.team_category) {
      setFilterTeam(user.team_category);
    }
  }, [user?.team_category]);

  const [viewMode, setViewMode] = useState<ViewMode>('list');
  const [filterCompetition, setFilterCompetition] = useState<CompetitionFilter>('Liga');

  // Modales
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchScoutingTerm, setSearchScoutingTerm] = useState('');

  // Campos formulario jugador
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
  const [teamCategory, setTeamCategory] = useState<'Primer Equipo' | 'Juvenil'>('Primer Equipo');
  const [dorsal, setDorsal] = useState('');
  const [position, setPosition] = useState('Defensa Central');
  const [dominantFoot, setDominantFoot] = useState<'Derecho' | 'Izquierdo' | 'Ambidiestro'>('Derecho');
  const [height, setHeight] = useState('');
  const [weight, setWeight] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  
  // Campos de estadísticas
  const [matchesPlayed, setMatchesPlayed] = useState('0');
  const [minutesPlayed, setMinutesPlayed] = useState('0');
  const [goals, setGoals] = useState('0');
  const [assists, setAssists] = useState('0');
  const [yellowCards, setYellowCards] = useState('0');
  const [redCards, setRedCards] = useState('0');

  // React Query - Cargar Jugadores
  const { data: rawPlayers = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers()
  });

  const players = React.useMemo(() => {
    if (user?.role_id === 3) {
      return rawPlayers.filter(p => p.profile_id === user.id);
    }
    return rawPlayers;
  }, [rawPlayers, user]);

  // React Query - Cargar Todos los Partidos
  const { data: allMatches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  // React Query - Cargar Todas las Estadísticas de Partidos
  const { data: allPlayerStats = [] } = useQuery({
    queryKey: ['allPlayerStats'],
    queryFn: () => dataService.getAllPlayerMatchStats()
  });

  // Estadísticas de la temporada calculadas a partir de player_match_stats (prioridad: Liga)
  const squad = React.useMemo(
    () => computeSquad(players, allMatches, allPlayerStats, filterTeam, filterCompetition),
    [players, allMatches, allPlayerStats, filterTeam, filterCompetition]
  );

  // React Query - Cargar Jugadores de Scouting para Importar
  const { data: scoutingPlayers = [] } = useQuery({
    queryKey: ['scoutingForImport'],
    queryFn: () => dataService.getScouting(),
    enabled: isImportModalOpen
  });

  // Mutaciones
  const createPlayerMutation = useMutation({
    mutationFn: (newPlayer: Omit<Player, 'id'>) => dataService.createPlayer(newPlayer),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Jugador Creado', 'Ficha de jugador registrada correctamente.');
      handleClosePlayerModal();
    },
    onError: (err: any) => {
      showToast('error', 'Error al crear', err.message || 'Hubo un problema al crear la ficha.');
    }
  });

  const updatePlayerMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<Player> }) => dataService.updatePlayer(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Jugador Actualizado', 'Los datos del jugador han sido actualizados.');
      handleClosePlayerModal();
    },
    onError: (err: any) => {
      showToast('error', 'Error al actualizar', err.message || 'Hubo un problema al guardar los cambios.');
    }
  });

  const deletePlayerMutation = useMutation({
    mutationFn: (id: string) => dataService.deletePlayer(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Jugador Eliminado', 'Ficha eliminada de la base de datos.');
    },
    onError: (err: any) => {
      showToast('error', 'Error al eliminar', err.message || 'No se pudo eliminar el jugador.');
    }
  });

  // Filtros globales (buscador, posición, estado físico)
  const filteredPlayers = React.useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return squad.rows.filter(p => {
      const matchesSearch = !q ||
        p.full_name.toLowerCase().includes(q) ||
        (p.nickname || '').toLowerCase().includes(q) ||
        (p.position || '').toLowerCase().includes(q) ||
        String(p.dorsal ?? '') === q;
      const matchesPosition = filterPosition === 'Todos' || p.position === filterPosition;
      const matchesStatus = filterStatus === 'Todos' || (p.physical_status || 'Disponible') === filterStatus;
      return matchesSearch && matchesPosition && matchesStatus;
    });
  }, [squad.rows, searchTerm, filterPosition, filterStatus]);

  // Filas visibles en la tabla (tras filtros por columna y orden), usadas para exportar
  const [tableRows, setTableRows] = useState<SquadRow[]>([]);
  const exportRows = viewMode === 'list' && tableRows.length ? tableRows : filteredPlayers;

  // KPIs del equipo
  const kpis = React.useMemo(() => {
    const s = squad.teamSeries;
    const w = s.filter(x => x.result === 'V').length;
    const d = s.filter(x => x.result === 'E').length;
    const l = s.filter(x => x.result === 'D').length;
    const gf = s.reduce((a, x) => a + x.gf, 0);
    const gc = s.reduce((a, x) => a + x.gc, 0);
    const pts = w * 3 + d;
    const usedPlayers = squad.rows.filter(r => r.stats.minutes > 0).length;
    const sanctioned = squad.rows.filter(r => r.discipline.state === 'sancionado').length;
    const warned = squad.rows.filter(r => r.discipline.state === 'apercibido').length;
    const unavailable = squad.rows.filter(r => !r.isGuest && r.physical_status && r.physical_status !== 'Disponible').length;
    return { played: s.length, w, d, l, gf, gc, pts, usedPlayers, sanctioned, warned, unavailable, form: s.slice(-5) };
  }, [squad]);

  const leaders = React.useMemo(() => {
    const top = (fn: (r: SquadRow) => number) => [...squad.rows].filter(r => fn(r) > 0).sort((a, b) => fn(b) - fn(a))[0];
    return {
      scorer: top(r => r.stats.goals),
      assister: top(r => r.stats.assists),
      minutes: top(r => r.stats.minutes)
    };
  }, [squad.rows]);

  const openPlayer = (p: { id: string }) => navigate(`/players/${p.id}`);

  // Reset del formulario de jugador
  const handleOpenCreateModal = () => {
    setEditingPlayer(null);
    setFullName('');
    setNickname('');
    setPhotoUrl('');
    setTeamCategory('Primer Equipo');
    setDorsal('');
    setPosition('Defensa Central');
    setDominantFoot('Derecho');
    setHeight('');
    setWeight('');
    setBirthDate('');
    setPhone('');
    setEmail('');
    setMatchesPlayed('0');
    setMinutesPlayed('0');
    setGoals('0');
    setAssists('0');
    setYellowCards('0');
    setRedCards('0');
    setIsPlayerModalOpen(true);
  };

  const handleImportFromScouting = (scoutingPlayer: ScoutingPlayer) => {
    const positionMap: Record<string, string> = {
      'Portero': 'Portero',
      'Defensa Central': 'Defensa Central',
      'Lateral Derecho': 'Lateral Derecho',
      'Lateral Izquierdo': 'Lateral Izquierdo',
      'LD': 'Lateral Derecho',
      'LI': 'Lateral Izquierdo',
      'DFC': 'Defensa Central',
      'P': 'Portero',
      'Pivote': 'Pivote Defensivo',
      'Mediocentro': 'Mediocentro',
      'Mediapunta': 'Mediapunta',
      'Extremo Derecho': 'Extremo Derecho',
      'Extremo Izquierdo': 'Extremo Izquierdo',
      'ED': 'Extremo Derecho',
      'EI': 'Extremo Izquierdo',
      'Delantero Centro': 'Delantero Centro',
      'DC': 'Delantero Centro'
    };

    setEditingPlayer(null);
    setFullName(scoutingPlayer.player_name);
    setNickname('');
    setPhotoUrl(scoutingPlayer.photo_url || '');
    setTeamCategory('Primer Equipo');
    setDorsal('');
    setPosition(positionMap[scoutingPlayer.position] || 'Defensa Central');
    setDominantFoot('Derecho');
    setHeight('');
    setWeight('');
    setBirthDate('');
    setPhone(scoutingPlayer.phone || '');
    setEmail('');
    setMatchesPlayed('0');
    setMinutesPlayed('0');
    setGoals('0');
    setAssists('0');
    setYellowCards('0');
    setRedCards('0');
    setIsPlayerModalOpen(true);
    setIsImportModalOpen(false);
    showToast('success', 'Importado de Scouting', `${scoutingPlayer.player_name} cargado en el formulario.`);
  };

  const handleOpenEditModal = (p: Player) => {
    setEditingPlayer(p);
    setFullName(p.full_name);
    setNickname(p.nickname || '');
    setPhotoUrl(p.photo_url || '');
    setTeamCategory((p.team_category as 'Primer Equipo' | 'Juvenil') || 'Primer Equipo');
    setDorsal(p.dorsal?.toString() || '');
    setPosition(p.position || 'Defensa Central');
    setDominantFoot(p.dominant_foot || 'Derecho');
    setHeight(p.height?.toString() || '');
    setWeight(p.weight?.toString() || '');
    setBirthDate(p.birth_date || '');
    setPhone(p.phone || '');
    setEmail(p.email || '');
    setMatchesPlayed(p.matches_played.toString());
    setMinutesPlayed(p.minutes_played.toString());
    setGoals(p.goals.toString());
    setAssists(p.assists.toString());
    setYellowCards(p.yellow_cards.toString());
    setRedCards(p.red_cards.toString());
    setIsPlayerModalOpen(true);
  };

  const handleClosePlayerModal = () => {
    setIsPlayerModalOpen(false);
    setEditingPlayer(null);
  };

  const handleSavePlayer = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      showToast('error', 'Validación', 'El nombre completo es obligatorio.');
      return;
    }

    const payload = {
      full_name: fullName,
      nickname: nickname || undefined,
      photo_url: photoUrl || undefined,
      dorsal: dorsal ? parseInt(dorsal) : undefined,
      position,
      dominant_foot: dominantFoot,
      height: height ? parseInt(height) : undefined,
      weight: weight ? parseFloat(weight) : undefined,
      birth_date: birthDate || undefined,
      phone: phone || undefined,
      email: email || undefined,
      matches_played: parseInt(matchesPlayed) || 0,
      minutes_played: parseInt(minutesPlayed) || 0,
      goals: parseInt(goals) || 0,
      assists: parseInt(assists) || 0,
      yellow_cards: parseInt(yellowCards) || 0,
      red_cards: parseInt(redCards) || 0,
      team_category: teamCategory,
      ...(editingPlayer ? {} : { physical_status: 'Disponible' as const })
    };

    if (editingPlayer) {
      updatePlayerMutation.mutate({ id: editingPlayer.id, data: payload });
    } else {
      createPlayerMutation.mutate(payload);
    }
  };

  const handleDeletePlayer = (id: string, name: string) => {
    if (window.confirm(`¿Estás seguro de que deseas eliminar la ficha de ${name}?`)) {
      deletePlayerMutation.mutate(id);
    }
  };

  // Exportar datos
  const handleExportCSV = () => {
    if (exportRows.length === 0) return;
    const headers = [
      'Dorsal', 'Nombre', 'Apodo', 'Posición', 'Convocatorias', 'PJ', 'Titular', 'Suplente', 'Minutos', '% Minutos', 'Min/PJ',
      'Goles', 'Asistencias', 'G+A', 'Goles encajados', 'Amarillas', 'Rojas', 'Amarillas liga (ciclo)', 'Disciplina', 'Estado físico'
    ];
    const rows = exportRows.map(p => [
      p.dorsal ?? '-',
      p.full_name,
      p.nickname || '-',
      p.position || '-',
      p.stats.called,
      p.stats.played,
      p.stats.starter,
      p.stats.subIn,
      p.stats.minutes,
      p.stats.minutesPct,
      p.stats.minPerMatch,
      p.stats.goals,
      p.stats.assists,
      p.stats.ga,
      p.stats.conceded,
      p.stats.yellow,
      p.stats.red,
      p.discipline.yellowCycle,
      p.discipline.state === 'sancionado' ? 'Sancionado' : p.discipline.state === 'apercibido' ? 'Apercibido' : '-',
      p.physical_status || 'Disponible'
    ]);
    exportToCSV(`estadisticas_${filterTeam.replace(/\s+/g, '_').toLowerCase()}_${filterCompetition.toLowerCase()}`, headers, rows);
  };

  const handleExportPDF = async () => {
    if (exportRows.length === 0) return;
    await exportSquadToPDF(exportRows);
  };

  const viewTabs: { key: ViewMode; label: string; icon: React.ElementType; badge?: number }[] = [
    { key: 'list', label: 'Estadísticas', icon: ListIcon },
    { key: 'stats', label: 'Gráficas', icon: BarChart2 },
    { key: 'discipline', label: 'Tarjetas y sanciones', icon: ShieldAlert, badge: kpis.sanctioned + kpis.warned },
    { key: 'grid', label: 'Fichas', icon: LayoutGrid }
  ];

  return (
    <div className="space-y-4">
      {/* Cabecera */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-red-600" /> Plantilla y Estadísticas
          </h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Temporada {SEASON_LABEL} · datos calculados desde las actas de cada partido · {filterCompetition === 'Todas' ? 'todas las competiciones' : filterCompetition}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canExport && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs" title="Exportar las filas visibles a CSV">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs" title="Exportar plantilla a PDF">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canCreate && (
            <>
              <button onClick={() => setIsImportModalOpen(true)} className="btn-secondary py-2 text-xs font-semibold">
                <Download className="w-3.5 h-3.5" /> Importar de Scouting
              </button>
              <button onClick={handleOpenCreateModal} className="btn-primary py-2 text-xs font-semibold">
                <Plus className="w-3.5 h-3.5" /> Nueva Ficha
              </button>
            </>
          )}
        </div>
      </div>

      {/* Pestañas de Equipo */}
      {(user?.role_id === 1 || user?.role_id === 4 || user?.role_id === 2 || (user?.availableContexts && user.availableContexts.length > 0)) && (
        <div className="flex border-b border-brand-black-border">
          {[{ key: 'Primer Equipo', label: 'Primer Equipo' }, { key: 'Juvenil', label: 'Filial (Juvenil)' }].map(t => (
            <button
              key={t.key}
              className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${filterTeam === t.key ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
              onClick={() => setFilterTeam(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* KPIs del equipo */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3">
        <KpiTile label={`Partidos · ${filterCompetition === 'Todas' ? 'Total' : filterCompetition}`}>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tabular-nums">{kpis.played}</span>
            <span className="text-xs font-bold tabular-nums">
              <span className="text-emerald-400">{kpis.w}V</span> <span className="text-neutral-400">{kpis.d}E</span> <span className="text-red-400">{kpis.l}D</span>
            </span>
          </div>
          <div className="flex gap-1 mt-1.5">
            {kpis.form.map(f => (
              <span
                key={f.match.id}
                title={`${f.label} · ${f.match.rival} ${f.gf}-${f.gc}`}
                className={`w-5 h-5 rounded text-[10px] font-black flex items-center justify-center ${f.result === 'V' ? 'bg-emerald-500/20 text-emerald-400' : f.result === 'E' ? 'bg-neutral-500/20 text-neutral-300' : 'bg-red-500/20 text-red-400'}`}
              >
                {f.result}
              </span>
            ))}
          </div>
        </KpiTile>
        <KpiTile label={filterCompetition === 'Liga' ? 'Puntos' : 'Puntos (equiv.)'}>
          <span className="text-2xl font-black text-white tabular-nums">{kpis.pts}</span>
          <span className="text-xs text-brand-gray-muted ml-1.5">{kpis.played ? (kpis.pts / kpis.played).toFixed(2) : '0.00'} / partido</span>
        </KpiTile>
        <KpiTile label="Goles a favor · en contra">
          <span className="text-2xl font-black tabular-nums"><span className="text-emerald-400">{kpis.gf}</span><span className="text-brand-gray-dark mx-1">:</span><span className="text-red-400">{kpis.gc}</span></span>
          <span className={`text-xs font-bold ml-1.5 ${kpis.gf - kpis.gc >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{kpis.gf - kpis.gc > 0 ? '+' : ''}{kpis.gf - kpis.gc}</span>
        </KpiTile>
        <KpiTile label="Jugadores utilizados">
          <span className="text-2xl font-black text-white tabular-nums">{kpis.usedPlayers}</span>
          <span className="text-xs text-brand-gray-muted ml-1.5">de {squad.rows.length}</span>
          {kpis.unavailable > 0 && <p className="text-[10px] text-amber-400 mt-0.5">{kpis.unavailable} no disponibles (físico)</p>}
        </KpiTile>
        <KpiTile
          label="Disciplina (liga)"
          onClick={() => setViewMode('discipline')}
          accent={kpis.sanctioned ? 'border-red-800/60 bg-red-950/20' : kpis.warned ? 'border-amber-800/50' : ''}
        >
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1"><ShieldAlert className="w-4 h-4 text-red-400" /><span className="text-xl font-black text-white tabular-nums">{kpis.sanctioned}</span></span>
            <span className="flex items-center gap-1"><AlertTriangle className="w-4 h-4 text-amber-400" /><span className="text-xl font-black text-white tabular-nums">{kpis.warned}</span></span>
          </div>
          <p className="text-[10px] text-brand-gray-muted mt-0.5">sancionados · apercibidos</p>
        </KpiTile>
        <KpiTile label="Líderes">
          <div className="space-y-0.5 text-[11px]">
            {[
              { l: 'Goles', p: leaders.scorer, v: leaders.scorer?.stats.goals, c: 'text-emerald-400' },
              { l: 'Asist.', p: leaders.assister, v: leaders.assister?.stats.assists, c: 'text-sky-400' },
              { l: 'Min.', p: leaders.minutes, v: leaders.minutes ? `${leaders.minutes.stats.minutes}'` : undefined, c: 'text-white' }
            ].map(x => (
              <div key={x.l} className="flex items-center justify-between gap-2">
                <span className="text-brand-gray-muted w-9">{x.l}</span>
                <span className="font-semibold text-brand-gray-light truncate flex-1">{x.p ? displayName(x.p) : '—'}</span>
                <span className={`font-black tabular-nums ${x.c}`}>{x.v ?? ''}</span>
              </div>
            ))}
          </div>
        </KpiTile>
      </div>

      {/* Vistas + Filtros */}
      <div className="bg-brand-black border border-brand-black-border rounded-xl p-2.5 space-y-2.5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-2.5">
          <div className="flex items-center gap-1 bg-brand-black-bg border border-brand-black-border rounded-lg p-0.5 overflow-x-auto shrink-0">
            {viewTabs.map(t => (
              <button
                key={t.key}
                onClick={() => setViewMode(t.key)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap transition-colors ${viewMode === t.key ? 'bg-brand-black-hover text-white shadow-border-glow' : 'text-brand-gray-muted hover:text-white'}`}
              >
                <t.icon className="w-3.5 h-3.5" /> {t.label}
                {!!t.badge && <span className="text-[9px] font-black bg-red-600 text-white rounded-full px-1.5 py-px">{t.badge}</span>}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 bg-brand-black-bg border border-brand-black-border rounded-lg p-0.5 shrink-0" title={viewMode === 'discipline' ? 'El control de tarjetas siempre se calcula sobre la Liga' : 'Competición'}>
            {(['Liga', 'Copa', 'Amistoso', 'Todas'] as CompetitionFilter[]).map(c => (
              <button
                key={c}
                onClick={() => setFilterCompetition(c)}
                disabled={viewMode === 'discipline'}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors disabled:opacity-40 ${filterCompetition === c ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
            <input
              type="text"
              className="form-input pl-9 w-full"
              placeholder="Buscar jugador, dorsal o posición…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <select value={filterPosition} onChange={(e) => setFilterPosition(e.target.value)} className="form-input w-full">
            <option value="Todos">Todas las posiciones</option>
            {POSITIONS.map(p => <option key={p} value={p}>{p}</option>)}
          </select>
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="form-input w-full">
            <option value="Todos">Todos los estados físicos</option>
            <option value="Disponible">Disponible</option>
            <option value="En duda">En duda</option>
            <option value="Lesionado">Lesionado</option>
            <option value="Baja">Baja</option>
          </select>
        </div>
      </div>

      {/* Aviso de sancionados */}
      {kpis.sanctioned > 0 && viewMode !== 'discipline' && (
        <div className="flex items-center justify-between gap-3 bg-red-950/30 border border-red-800/50 rounded-lg px-4 py-2.5">
          <p className="text-xs text-red-300 flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 text-red-400 shrink-0" />
            <span>
              <strong>{squad.rows.filter(r => r.discipline.state === 'sancionado').map(r => displayName(r)).join(', ')}</strong>
              {' '}{kpis.sanctioned === 1 ? 'está sancionado' : 'están sancionados'} para {squad.nextLeague ? formatMatchShort(squad.nextLeague) : 'el próximo partido de liga'}.
            </span>
          </p>
          <button onClick={() => setViewMode('discipline')} className="text-[11px] font-bold text-red-300 hover:text-white flex items-center gap-1 shrink-0">
            Ver control <ChevronRight className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Contenido */}
      {isLoading ? (
        <TableSkeleton />
      ) : squad.rows.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No se encontraron fichas de jugadores.</p>
        </div>
      ) : viewMode === 'stats' ? (
        <SquadAnalytics rows={filteredPlayers} teamSeries={squad.teamSeries} competition={filterCompetition} onOpen={openPlayer} />
      ) : viewMode === 'discipline' ? (
        <DisciplinePanel rows={filteredPlayers} nextLeague={squad.nextLeague} leagueCards={squad.leagueCards} onOpen={openPlayer} />
      ) : viewMode === 'grid' ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
          {filteredPlayers.map((player) => {
            const statusColor =
              (player.physical_status || 'Disponible') === 'Disponible' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' :
              player.physical_status === 'En duda' ? 'bg-amber-950/20 text-amber-500 border border-amber-900/30' :
              'bg-red-950/20 text-red-400 border border-red-900/30';
            return (
              <div
                key={player.id}
                onClick={() => openPlayer(player)}
                className="dashboard-card p-4 flex flex-col justify-between cursor-pointer border hover:border-brand-red-600/35 transition-all group border-brand-black-border"
              >
                <div className="flex gap-3">
                  <div className="w-12 h-12 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                    {player.photo_url ? (
                      <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                    ) : (
                      <Users className="w-6 h-6 text-brand-gray-dark" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      {player.dorsal != null && (
                        <span className="text-xs font-black text-brand-red-600 bg-brand-red-600/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                          {player.dorsal}
                        </span>
                      )}
                      <h4 className="text-sm font-bold text-brand-gray-light truncate leading-tight group-hover:text-white transition-colors">
                        {player.nickname || player.full_name}
                      </h4>
                    </div>
                    {player.nickname && (
                      <span className="text-[10px] text-brand-gray-muted truncate block mt-0.5">{player.full_name}</span>
                    )}
                    <span className="text-[10px] text-brand-gray-muted block mt-1 uppercase font-semibold">
                      {player.position || 'Sin Demarcación'}
                    </span>
                  </div>
                </div>

                <div className="grid grid-cols-4 gap-1 mt-4 text-center">
                  {[
                    { l: 'PJ', v: player.stats.played, c: 'text-white' },
                    { l: 'Min', v: `${player.stats.minutes}'`, c: 'text-white' },
                    { l: 'Gol', v: player.stats.goals, c: 'text-emerald-400' },
                    { l: 'Asis', v: player.stats.assists, c: 'text-sky-400' }
                  ].map(x => (
                    <div key={x.l} className="bg-brand-black rounded-md py-1.5 border border-brand-black-border/60">
                      <div className={`text-sm font-black tabular-nums ${x.c}`}>{x.v}</div>
                      <div className="text-[9px] uppercase text-brand-gray-muted font-semibold">{x.l}</div>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between mt-3 border-t border-brand-black-border/40 pt-3">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
                      {player.physical_status || 'Disponible'}
                    </span>
                    <DisciplineBadge row={player} />
                  </div>
                  <CardCycle row={player} compact />
                </div>

                {(canEdit || canDelete) && (
                  <div className="flex gap-1.5 mt-3 border-t border-brand-black-border/40 pt-3">
                    {canEdit && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleOpenEditModal(player); }}
                        className="flex-1 flex items-center justify-center gap-1.5 p-1.5 text-xs text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-card border border-brand-black-border rounded transition-all"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                    )}
                    {canDelete && (
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDeletePlayer(player.id, player.full_name); }}
                        className="flex-1 flex items-center justify-center gap-1.5 p-1.5 text-xs text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/5 border border-brand-black-border hover:border-brand-red-600/30 rounded transition-all"
                      >
                        <Trash2 className="w-3 h-3" /> Eliminar
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <SquadTable
          rows={filteredPlayers}
          canEdit={canEdit}
          canDelete={canDelete}
          onOpen={openPlayer}
          onEdit={handleOpenEditModal}
          onDelete={(p) => handleDeletePlayer(p.id, p.full_name)}
          onVisibleRowsChange={setTableRows}
        />
      )}

      {/* =====================================================================
          MODAL CREAR / EDITAR JUGADOR
          ===================================================================== */}
      <Modal
        isOpen={isPlayerModalOpen}
        onClose={handleClosePlayerModal}
        title={editingPlayer ? 'Editar Datos del Jugador' : 'Registrar Nuevo Jugador'}
      >
        <form onSubmit={handleSavePlayer} className="space-y-4 text-left">
          
          {/* FOTO DE PERFIL (subida + recorte circular) */}
          <PhotoCropUpload value={photoUrl} onChange={setPhotoUrl} />
          <p className="text-[11px] text-brand-gray-muted -mt-2 px-1">
            Sube una imagen y ajusta el recorte circular. También puedes pegar una URL directa manualmente si lo prefieres.
          </p>
          <input
            type="text"
            className="form-input"
            placeholder="O pega una URL de imagen directa..."
            value={photoUrl.startsWith('data:') ? '' : photoUrl}
            onChange={(e) => setPhotoUrl(e.target.value)}
          />

          {/* Nombre y Apellidos y Nombre Futbolístico */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="form-label">Nombre y Apellidos</label>
              <input
                type="text"
                required
                className="form-input"
                placeholder="Francisco Paco Alcácer"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Nombre Futbolístico / Alias</label>
              <input
                type="text"
                className="form-input"
                placeholder="Paco"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Equipo actual</label>
              <select
                className="form-input bg-brand-black"
                value={teamCategory}
                onChange={(e) => setTeamCategory(e.target.value as any)}
              >
                <option value="Primer Equipo">Primer Equipo</option>
                <option value="Juvenil">Filial (Juvenil)</option>
              </select>
            </div>
          </div>

          {/* Dorsal y Demarcación */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Dorsal</label>
              <input
                type="number"
                min="1"
                max="99"
                className="form-input"
                placeholder="9"
                value={dorsal}
                onChange={(e) => setDorsal(e.target.value)}
              />
            </div>
            <div className="col-span-2">
              <label className="form-label">Posición / Demarcación Detallada</label>
              <select
                className="form-input bg-brand-black"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="Portero">Portero</option>
                <option value="Lateral Derecho">Lateral Derecho</option>
                <option value="Lateral Izquierdo">Lateral Izquierdo</option>
                <option value="Defensa Central">Defensa Central</option>
                <option value="Pivote Defensivo">Pivote Defensivo</option>
                <option value="Mediocentro">Mediocentro</option>
                <option value="Interior">Interior</option>
                <option value="Extremo Derecho">Extremo Derecho</option>
                <option value="Extremo Izquierdo">Extremo Izquierdo</option>
                <option value="Mediapunta">Mediapunta</option>
                <option value="Delantero Centro">Delantero Centro</option>
              </select>
            </div>
          </div>

          {/* Pie Dominante, Estatura, Peso */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Pie Dominante</label>
              <select
                className="form-input bg-brand-black"
                value={dominantFoot}
                onChange={(e) => setDominantFoot(e.target.value as any)}
              >
                <option value="Derecho">Derecho</option>
                <option value="Izquierdo">Izquierdo</option>
                <option value="Ambidiestro">Ambidiestro</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estatura (cm)</label>
              <input
                type="number"
                min="100"
                max="220"
                className="form-input"
                placeholder="175"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Peso Inicial (kg)</label>
              <input
                type="number"
                step="0.1"
                className="form-input"
                placeholder="72.5"
                value={weight}
                onChange={(e) => setWeight(e.target.value)}
              />
            </div>
          </div>

          {/* Datos contacto y nacimiento */}
          <div className="grid grid-cols-3 gap-3">
            <div className="col-span-1">
              <label className="form-label">Fecha Nacimiento</label>
              <input
                type="date"
                className="form-input"
                value={birthDate}
                onChange={(e) => setBirthDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Teléfono</label>
              <input
                type="text"
                className="form-input"
                placeholder="600000000"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="jugador@atzeneta.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="border-t border-brand-black-border/60 pt-3">
            <span className="text-[10px] font-bold text-brand-red-600 block mb-2.5 uppercase tracking-wider">
              Estadísticas Acumuladas
            </span>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="text-[10px] text-brand-gray-muted block mb-1">Partidos Jugados</label>
                <input
                  type="number"
                  min="0"
                  className="form-input py-1 text-xs"
                  value={matchesPlayed}
                  onChange={(e) => setMatchesPlayed(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-gray-muted block mb-1">Minutos Jugados</label>
                <input
                  type="number"
                  min="0"
                  className="form-input py-1 text-xs"
                  value={minutesPlayed}
                  onChange={(e) => setMinutesPlayed(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-gray-muted block mb-1">Goles</label>
                <input
                  type="number"
                  min="0"
                  className="form-input py-1 text-xs"
                  value={goals}
                  onChange={(e) => setGoals(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-gray-muted block mb-1">Asistencias</label>
                <input
                  type="number"
                  min="0"
                  className="form-input py-1 text-xs"
                  value={assists}
                  onChange={(e) => setAssists(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-gray-muted block mb-1">Amarillas</label>
                <input
                  type="number"
                  min="0"
                  className="form-input py-1 text-xs"
                  value={yellowCards}
                  onChange={(e) => setYellowCards(e.target.value)}
                />
              </div>
              <div>
                <label className="text-[10px] text-brand-gray-muted block mb-1">Rojas</label>
                <input
                  type="number"
                  min="0"
                  className="form-input py-1 text-xs"
                  value={redCards}
                  onChange={(e) => setRedCards(e.target.value)}
                />
              </div>
            </div>
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={handleClosePlayerModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Ficha
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL IMPORTAR DE SCOUTING
          ===================================================================== */}
      <Modal
        isOpen={isImportModalOpen}
        onClose={() => setIsImportModalOpen(false)}
        title="Importar Jugador desde Scouting"
      >
        <div className="space-y-4 text-left">
          <div className="relative">
            <Search className="absolute left-3.5 top-3 w-4 h-4 text-brand-gray-dark" />
            <input
              type="text"
              className="form-input pl-10 w-full"
              placeholder="Buscar jugador de scouting..."
              value={searchScoutingTerm}
              onChange={(e) => setSearchScoutingTerm(e.target.value)}
            />
          </div>

          <div className="max-h-96 overflow-y-auto space-y-2 border border-brand-black-border rounded-lg p-3 bg-brand-black/30">
            {scoutingPlayers
              .filter(p =>
                p.player_name.toLowerCase().includes(searchScoutingTerm.toLowerCase()) ||
                p.team.toLowerCase().includes(searchScoutingTerm.toLowerCase()) ||
                p.position.toLowerCase().includes(searchScoutingTerm.toLowerCase())
              )
              .map((player) => (
                <button
                  key={player.id}
                  type="button"
                  onClick={() => handleImportFromScouting(player)}
                  className="w-full text-left p-3 bg-brand-black border border-brand-black-border hover:border-brand-red-600/50 hover:bg-brand-red-600/5 rounded transition-all flex items-center justify-between group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-brand-gray-light group-hover:text-white truncate">
                      {player.player_name}
                    </div>
                    <div className="text-xs text-brand-gray-muted">
                      {player.position} • {player.team}
                      {player.age && ` • ${player.age} años`}
                    </div>
                  </div>
                  <Plus className="w-4 h-4 text-brand-gray-dark group-hover:text-brand-red-600 ml-2 shrink-0" />
                </button>
              ))}
            {scoutingPlayers.length === 0 && (
              <p className="text-xs text-brand-gray-muted text-center py-6">
                No hay jugadores de scouting disponibles.
              </p>
            )}
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={() => setIsImportModalOpen(false)} className="btn-secondary py-2 text-xs">
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

    </div>
  );
};
