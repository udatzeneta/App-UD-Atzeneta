import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { Match, Team, Player } from '../types';
import { exportToCSV, exportToPDF, ExportCell, exportCallupToPDF } from '../utils/export';
import {
  Trophy, Search, Download, FileText, Plus, Edit2, Trash2,
  Calendar, CheckCircle, HelpCircle, XCircle, RefreshCw,
  Check, Users, Clock, Upload, Star
} from 'lucide-react';
import logos from '../assets/logos.json';

const getTeamLogo = (teamName: string): string => {
  const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const target = normalize(teamName);
  
  const matchKey = Object.keys(logos).find(key => normalize(key) === target);
  if (matchKey) {
    return (logos as Record<string, string>)[matchKey];
  }
  return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
};

const TACTICAL_SYSTEMS = [
  '1-4-4-2', '1-4-3-3', '1-4-2-3-1', '1-4-1-4-1', '1-3-5-2', 
  '1-3-4-3', '1-5-3-2', '1-5-4-1', '1-4-5-1', '1-4-4-2 (Rombo)', 
  '1-3-4-2-1', '1-4-3-2-1', '1-3-3-1-3'
];

const POSITIONS = [
  'POR', 'DFD', 'DFC', 'DFI', 'LD', 'LI', 'CA', 
  'MCD', 'MC', 'MCO', 'MI', 'MD', 'ED', 'EI', 'SD', 'DC'
];

export const Matches: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // Permisos específicos
  const canCreate = hasPermission('matches', 'crear');
  const canEdit = hasPermission('matches', 'editar');
  const canDelete = hasPermission('matches', 'eliminar');
  const canExport = hasPermission('matches', 'exportar');

  // Estados locales
  const [search, setSearch] = useState('');
  const [filterCompetition, setFilterCompetition] = useState('Todas');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Modal de formulario
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingMatch, setEditingMatch] = useState<Match | null>(null);

  // Campos de formulario
  const [rival, setRival] = useState('');
  const [date, setDate] = useState('');
  const [isLocal, setIsLocal] = useState(true);
  const [competition, setCompetition] = useState<'Liga' | 'Copa' | 'Amistoso' | 'Promoción'>('Liga');
  const [scoreUs, setScoreUs] = useState<string>('');
  const [scoreThem, setScoreThem] = useState<string>('');
  const [status, setStatus] = useState<'Programado' | 'Jugado' | 'Suspendido'>('Programado');
  const [time, setTime] = useState('18:00');
  const [matchday, setMatchday] = useState('');
  const [location, setLocation] = useState('');
  const [objective, setObjective] = useState('');
  const [observations, setObservations] = useState('');
  const [isCustomRival, setIsCustomRival] = useState(false);
  const [customShieldUrl, setCustomShieldUrl] = useState('');
  
  const [tacticalSystem, setTacticalSystem] = useState('');

  // Estados para sincronización FFCV
  const [ffcvCompeticion, setFfcvCompeticion] = useState('29509167'); // Primera FFCV por defecto
  const [isSyncing, setIsSyncing] = useState(false);

  // Consultar partidos
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  // Consultar equipos de la base de datos
  const { data: dbTeams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => dataService.getTeams()
  });

  // Consultar plantilla de jugadores
  const { data: dbPlayers = [] } = useQuery<Player[]>({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers()
  });


  // Estados para Convocatoria y Estadísticas por Partido
  const [selectedMatchForActions, setSelectedMatchForActions] = useState<Match | null>(null);
  const [isActionModalOpen, setIsActionModalOpen] = useState(false);
  const [isSquadModalOpen, setIsSquadModalOpen] = useState(false);

  const [selectedSquadPlayerIds, setSelectedSquadPlayerIds] = useState<string[]>([]);


  // Estados para Convocatoria y Ropa de Juego
  const [callupTime, setCallupTime] = useState('');
  const [callupLocation, setCallupLocation] = useState('');
  const [kitShirtColor, setKitShirtColor] = useState('#C1121F'); // Rojo por defecto
  const [kitShortsColor, setKitShortsColor] = useState('#000000'); // Negro por defecto
  const [kitSocksColor, setKitSocksColor] = useState('#000000'); // Negro por defecto

  // Redefinición local de getTeamLogo para usar los escudos de la base de datos
  const getTeamLogo = (teamName: string): string => {
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const target = normalize(teamName);
    
    // 1. Buscar en los equipos de la base de datos
    const dbTeam = dbTeams.find(t => normalize(t.name) === target);
    if (dbTeam?.shield_url) {
      return dbTeam.shield_url;
    }
    
    // 2. Buscar en logos.json
    const matchKey = Object.keys(logos).find(key => normalize(key) === target);
    if (matchKey) {
      return (logos as Record<string, string>)[matchKey];
    }
    return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
  };

  // Handlers para acciones de partido
  const handleMatchClick = (match: Match) => {
    setSelectedMatchForActions(match);
    setIsActionModalOpen(true);
  };

  const openSquadModal = async (match: Match) => {
    setSelectedMatchForActions(match);
    try {
      const currentStats = await dataService.getPlayerMatchStats(match.id);
      let calledUpIds = currentStats.filter(x => x.is_called_up).map(x => x.player_id);
      
      if (calledUpIds.length === 0) {
        calledUpIds = dbPlayers.filter(p => p.physical_status !== 'Baja').map(p => p.id);
      }
      
      setSelectedSquadPlayerIds(calledUpIds);

      // Cargar valores actuales del partido
      setCallupTime(match.callup_time || '');
      setCallupLocation(match.callup_location || '');
      setKitShirtColor(match.kit_shirt_color || '#C1121F');
      setKitShortsColor(match.kit_shorts_color || '#000000');
      setKitSocksColor(match.kit_socks_color || '#000000');

      setIsSquadModalOpen(true);
    } catch (err: any) {
      showToast('error', 'Error', 'No se pudieron cargar las convocatorias.');
    }
  };

  const handleOpenSquadModal = async () => {
    if (!selectedMatchForActions) return;
    setIsActionModalOpen(false);
    await openSquadModal(selectedMatchForActions);
  };

  const handleOpenStatsModal = () => {
    if (!selectedMatchForActions) return;
    setIsActionModalOpen(false);
    navigate(`/matches/${selectedMatchForActions.id}/report`);
  };

  React.useEffect(() => {
    const action = searchParams.get('action');
    const matchId = searchParams.get('matchId');

    if (action === 'convocatoria' && matchId && matches.length > 0) {
      const match = matches.find(m => m.id === matchId);
      if (match) {
        searchParams.delete('action');
        searchParams.delete('matchId');
        setSearchParams(searchParams);
        openSquadModal(match);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, matches, setSearchParams]);

  const saveSquadMutation = useMutation({
    mutationFn: async ({ 
      matchId, 
      playerIds,
      callupTime,
      callupLocation,
      kitShirtColor,
      kitShortsColor,
      kitSocksColor
    }: { 
      matchId: string; 
      playerIds: string[];
      callupTime: string;
      callupLocation: string;
      kitShirtColor: string;
      kitShortsColor: string;
      kitSocksColor: string;
    }) => {
      const payload = dbPlayers.map(p => {
        const isCalledUp = playerIds.includes(p.id);
        return {
          match_id: matchId,
          player_id: p.id,
          is_called_up: isCalledUp,
          minutes_played: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_card: false
        };
      });
      
      // 1. Guardar convocatoria
      await dataService.savePlayerMatchStats(matchId, payload);
      
      // 2. Guardar detalles de la convocatoria en el partido
      await dataService.updateMatch(matchId, {
        callup_time: callupTime || null,
        callup_location: callupLocation || null,
        kit_shirt_color: kitShirtColor,
        kit_shorts_color: kitShortsColor,
        kit_socks_color: kitSocksColor
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Convocatoria guardada', 'La convocatoria y equipación del partido se han guardado correctamente.');
      setIsSquadModalOpen(false);
    },
    onError: (err: any) => showToast('error', 'Error', err.message || 'No se pudo guardar la convocatoria.')
  });

  const handleSaveSquad = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedMatchForActions) return;
    saveSquadMutation.mutate({
      matchId: selectedMatchForActions.id,
      playerIds: selectedSquadPlayerIds,
      callupTime,
      callupLocation,
      kitShirtColor,
      kitShortsColor,
      kitSocksColor
    });
  };

  const deleteSquadMutation = useMutation({
    mutationFn: (matchId: string) => dataService.deleteMatchCallups(matchId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Convocatoria Borrada', 'Se ha eliminado la convocatoria del partido.');
      setIsSquadModalOpen(false);
    },
    onError: (err: any) => showToast('error', 'Error', err.message || 'No se pudo borrar la convocatoria.')
  });

  const handleDeleteSquad = () => {
    if (!selectedMatchForActions) return;
    if (window.confirm('¿Estás seguro de que deseas borrar la convocatoria de este partido? Esta acción no se puede deshacer.')) {
      deleteSquadMutation.mutate(selectedMatchForActions.id);
    }
  };

  const handleExportCallupPDF = async () => {
    if (!selectedMatchForActions) return;
    const calledUpPlayers = dbPlayers.filter(p => selectedSquadPlayerIds.includes(p.id));
    if (calledUpPlayers.length === 0) {
      showToast('info', 'Exportar', 'Debes seleccionar al menos un jugador para exportar la convocatoria.');
      return;
    }
    await exportCallupToPDF(selectedMatchForActions, calledUpPlayers);
    showToast('success', 'PDF Descargado', 'Se ha exportado la convocatoria.');
  };


  const togglePlayerInSquad = (playerId: string) => {
    setSelectedSquadPlayerIds(prev => 
      prev.includes(playerId)
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };


  // Mutaciones
  const createTeamMutation = useMutation({
    mutationFn: (newTeam: Omit<Team, 'id' | 'created_at' | 'updated_at'>) => dataService.createTeam(newTeam),
  });

  const createMutation = useMutation({
    mutationFn: (newMatch: Omit<Match, 'id'>) => dataService.createMatch(newMatch),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido creado', 'El partido se ha programado correctamente.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<Match> }) => dataService.updateMatch(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido actualizado', 'Los datos del partido se han modificado correctamente.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteMatch(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      showToast('success', 'Partido eliminado', 'El partido ha sido eliminado del sistema.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const upsertMatchesMutation = useMutation({
    mutationFn: (items: Omit<Match, 'id'>[]) => dataService.upsertMatches(items),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      showToast('success', 'Sincronización completada', `Se han sincronizado e importado/actualizado ${data.length} partidos desde la FFCV.`);
    },
    onError: (err) => showToast('error', 'Error al sincronizar', err.message)
  });

  const parseSpanishDate = (dateStr: string): string | null => {
    const cleanStr = dateStr.toLowerCase().replace(/de\s+/g, '').replace(/·.*/, '').trim();
    const parts = cleanStr.split(/\s+/);
    let day = '';
    let monthName = '';
    let year = '';
    
    const monthsMap: { [key: string]: string } = {
      'enero': '01', 'febrero': '02', 'marzo': '03', 'abril': '04',
      'mayo': '05', 'junio': '06', 'julio': '07', 'agosto': '08',
      'septiembre': '09', 'octubre': '10', 'noviembre': '11', 'diciembre': '12'
    };

    for (const part of parts) {
      if (/^\d{4}$/.test(part)) {
        year = part;
      } else if (/^\d{1,2}$/.test(part)) {
        day = part.padStart(2, '0');
      } else if (monthsMap[part]) {
        monthName = monthsMap[part];
      }
    }

    if (day && monthName && year) {
      return `${year}-${monthName}-${day}`;
    }
    return null;
  };

  const handleSyncFFCV = async () => {
    setIsSyncing(true);
    try {
      const response = await fetch('/api/sync-matches');
      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.error || 'Error al ejecutar la sincronización.');
      }
      
      const result = await response.json();
      if (result.success) {
        queryClient.invalidateQueries({ queryKey: ['matches'] });
        showToast('success', 'Sincronización completada', 'Los partidos de todas las competiciones se han sincronizado con Supabase.');
      } else {
        throw new Error('No se recibió confirmación de éxito.');
      }
    } catch (error: any) {
      showToast('error', 'Error al sincronizar', error.message || 'Error desconocido.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Manejo del formulario
  const handleOpenCreateModal = () => {
    setEditingMatch(null);
    setRival('');
    setIsCustomRival(false);
    setCustomShieldUrl('');
    setDate(new Date().toISOString().split('T')[0]);
    setIsLocal(true);
    setCompetition('Liga');
    setScoreUs('');
    setScoreThem('');
    setStatus('Programado');
    setTime('18:00');
    setMatchday('');
    setLocation('');
    setObjective('');
    setObservations('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (match: Match) => {
    setEditingMatch(match);
    setRival(match.rival);

    // Comprobar si el rival ya existe en los equipos de la base de datos
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const target = normalize(match.rival);
    const inDb = dbTeams.some(t => normalize(t.name) === target);
    setIsCustomRival(match.rival ? !inDb : false);
    setCustomShieldUrl('');

    setDate(match.date);
    setIsLocal(match.is_local);
    setCompetition(match.competition);
    setScoreUs(match.score_us !== null ? String(match.score_us) : '');
    setScoreThem(match.score_them !== null ? String(match.score_them) : '');
    setStatus(match.status);
    setTime(match.time || '18:00');
    setMatchday(match.matchday || '');
    setLocation(match.location || '');
    setObjective(match.objective || '');
    setObservations(match.observations || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingMatch(null);
    setCustomShieldUrl('');
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rival.trim()) {
      showToast('error', 'Validación', 'El nombre del rival es obligatorio.');
      return;
    }
    if (!date) {
      showToast('error', 'Validación', 'La fecha del partido es obligatoria.');
      return;
    }

    let finalRivalName = rival.trim();

    if (isCustomRival) {
      const exists = dbTeams.some(t => t.name.toLowerCase() === finalRivalName.toLowerCase());
      if (!exists) {
        try {
          await createTeamMutation.mutateAsync({
            ffcv_cod: `CUSTOM-${Date.now()}`,
            name: finalRivalName,
            shield_url: customShieldUrl || null,
            competition: competition,
            cod_grupo: 'CUSTOM',
            season: '2025-2026'
          });
          queryClient.invalidateQueries({ queryKey: ['teams'] });
        } catch (err) {
          console.error("Error creando equipo custom:", err);
        }
      }
    }

    const payload = {
      rival: finalRivalName,
      date,
      is_local: isLocal,
      competition,
      score_us: status === 'Jugado' && scoreUs !== '' ? Number(scoreUs) : null,
      score_them: status === 'Jugado' && scoreThem !== '' ? Number(scoreThem) : null,
      status,
      time,
      matchday: matchday.trim() || null,
      location: location.trim() || (isLocal ? 'Campo Municipal El Porrejat' : 'Visitante'),
      objective: objective.trim(),
      observations: observations.trim()
    };

    if (editingMatch) {
      updateMutation.mutate({ id: editingMatch.id, item: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este partido?')) {
      deleteMutation.mutate(id);
    }
  };

  // Cálculo de estadísticas
  const computeStats = (items: Match[]) => {
    const total = items.length;
    const played = items.filter(m => m.status === 'Jugado');
    const wins = played.filter(m => m.score_us !== null && m.score_them !== null && m.score_us > m.score_them).length;
    const draws = played.filter(m => m.score_us !== null && m.score_them !== null && m.score_us === m.score_them).length;
    const losses = played.filter(m => m.score_us !== null && m.score_them !== null && m.score_us < m.score_them).length;
    
    return { total, wins, draws, losses };
  };

  // 1. Estadísticas acumuladas generales
  const generalStats = computeStats(matches);

  // 2. Estadísticas acumuladas mensuales
  const monthlyMatches = matches.filter(m => {
    const d = new Date(m.date);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  });
  const monthlyStats = computeStats(monthlyMatches);

  // Filtrado de la lista en pantalla
  const filteredMatches = matches.filter(m => {
    const matchesSearch = m.rival.toLowerCase().includes(search.toLowerCase());
    const matchesCompetition = filterCompetition === 'Todas' || m.competition === filterCompetition;
    const matchesStatus = filterStatus === 'Todos' || m.status === filterStatus;
    return matchesSearch && matchesCompetition && matchesStatus;
  });

  // Datos de exportación (definidos una sola vez, reutilizados por CSV y PDF)
  const exportHeaders = ['Jornada', 'Fecha', 'Rival', 'Campo', 'Ubicación', 'Competición', 'Goles Propios', 'Goles Rival', 'Estado'];
  const buildExportRows = (): ExportCell[][] =>
    filteredMatches.map(m => [
      m.matchday ?? '',
      m.date,
      m.rival,
      m.location || (m.is_local ? 'Campo Municipal El Porrejat' : 'Visitante'),
      m.is_local ? 'Local' : 'Visitante',
      m.competition,
      m.score_us ?? '',
      m.score_them ?? '',
      m.status,
    ]);

  const handleExportCSV = () => {
    if (filteredMatches.length === 0) {
      showToast('info', 'Exportar', 'No hay partidos en la lista para exportar.');
      return;
    }
    exportToCSV(`partidos_ud_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Se ha exportado el archivo con los filtros aplicados.');
  };

  const handleExportPDF = async () => {
    if (filteredMatches.length === 0) {
      showToast('info', 'Exportar', 'No hay partidos en la lista para exportar.');
      return;
    }
    await exportToPDF('Partidos UD Atzeneta', `partidos_ud_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Se ha generado el informe con los filtros aplicados.');
  };

  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Gestión de Partidos</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Programación de enfrentamientos y control del récord de la temporada.
          </p>
        </div>

        {/* Botonera de acciones superiores */}
        <div className="flex items-center gap-2 shrink-0">
          <Link to="/matches/stats" className="btn-secondary py-2 text-xs font-semibold flex items-center gap-1.5 hover:bg-brand-black-hover">
            <Trophy className="w-3.5 h-3.5 text-yellow-500" /> Estadísticas
          </Link>
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
              <Plus className="w-3.5 h-3.5" /> Registrar Partido
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          BLOQUES DE ESTADÍSTICAS (General vs Mensual vs Sincronización)
          ===================================================================== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        
        {/* Acumulado General */}
        <div className="dashboard-card flex flex-col justify-between p-5">
          <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Acumulado General</span>
            <Trophy className="w-4 h-4 text-brand-red-600" />
          </div>
          <div className="grid grid-cols-4 gap-2 text-center mt-4">
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{generalStats.total}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Partidos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-500">{generalStats.wins}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Victorias</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{generalStats.draws}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Empates</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-red-600">{generalStats.losses}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Derrotas</div>
            </div>
          </div>
        </div>

        {/* Acumulado Mensual */}
        <div className="dashboard-card flex flex-col justify-between p-5">
          <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Histórico Mensual</span>
            
            {/* Selectores de fecha para el bloque acumulado */}
            <div className="flex gap-1.5 bg-brand-black border border-brand-black-border px-2 py-0.5 rounded">
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
          <div className="grid grid-cols-4 gap-2 text-center mt-4">
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{monthlyStats.total}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Partidos</div>
            </div>
            <div>
              <div className="text-xl font-bold text-emerald-500">{monthlyStats.wins}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Victorias</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-gray-light">{monthlyStats.draws}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Empates</div>
            </div>
            <div>
              <div className="text-xl font-bold text-brand-red-600">{monthlyStats.losses}</div>
              <div className="text-[10px] text-brand-gray-muted mt-1">Derrotas</div>
            </div>
          </div>
        </div>

        {/* Sincronizador FFCV */}
        <div className="dashboard-card flex flex-col justify-between p-5">
          <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
            <span className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted">Sincronización FFCV</span>
            <RefreshCw className={`w-4 h-4 text-brand-red-600 ${isSyncing ? 'animate-spin' : ''}`} />
          </div>
          <div className="flex flex-col gap-3 mt-4 justify-between h-full">
            <button
              onClick={handleSyncFFCV}
              disabled={isSyncing || (!canCreate && !canEdit)}
              className="btn-primary py-2.5 px-4 w-full text-xs font-semibold disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {isSyncing ? 'Ejecutando sync_matches_supabase.cjs...' : 'Sincronizar con FFCV'}
            </button>
            <p className="text-[10px] text-brand-gray-muted leading-tight">
              Ejecuta el script de raspado del servidor para actualizar todos los partidos oficiales en Supabase desde la web de la FFCV.
            </p>
          </div>
        </div>
      </div>

      {/* =====================================================================
          SECCIÓN DE BÚSQUEDA Y FILTROS
          ===================================================================== */}
      <div className="flex flex-col sm:flex-row gap-3 bg-brand-black border border-brand-black-border p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-brand-gray-dark" />
          <input
            type="text"
            className="form-input pl-10 w-full"
            placeholder="Buscar por rival (ej. CD Alcoyano)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="flex gap-2.5 w-full sm:w-auto">
          <div className="flex-1 sm:flex-initial">
            <select
              value={filterCompetition}
              onChange={(e) => setFilterCompetition(e.target.value)}
              className="form-input bg-brand-black-bg"
            >
              <option value="Todas">Todas las Competiciones</option>
              <option value="Liga">Liga</option>
              <option value="Copa">Copa</option>
              <option value="Amistoso">Amistoso</option>
              <option value="Promoción">Promoción</option>
            </select>
          </div>
          <div className="flex-1 sm:flex-initial">
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="form-input bg-brand-black-bg"
            >
              <option value="Todos">Todos los Estados</option>
              <option value="Programado">Programados</option>
              <option value="Jugado">Jugados</option>
              <option value="Suspendido">Suspendidos</option>
            </select>
          </div>
        </div>
      </div>

      {/* =====================================================================
          TABLA / CONTENEDOR DE JUEGOS
          =======================================      {/* =====================================================================
          TABLA / CONTENEDOR DE JUEGOS (VISTA COMPLETA)
          ===================================================================== */}
      {isLoading ? (
        <TableSkeleton />
      ) : filteredMatches.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No se encontraron partidos con los filtros seleccionados.</p>
        </div>
      ) : (
        <>
          {/* Tabla para Escritorio */}
          <div className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Fecha</th>
                  <th className="table-th text-center">Jornada</th>
                  <th className="table-th">Rival</th>
                  <th className="table-th text-center">Ubicación</th>
                  <th className="table-th">Competición</th>
                  <th className="table-th text-center">Resultado</th>
                  <th className="table-th">Estado</th>
                  {(canEdit || canDelete) && <th className="table-th text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-black-border bg-brand-black-card/10">
                {filteredMatches.map((match) => {
                  const hasPlayed = match.status === 'Jugado';
                  return (
                    <tr 
                      key={match.id} 
                      onClick={() => handleMatchClick(match)}
                      className="hover:bg-brand-black-hover/20 transition-colors cursor-pointer"
                    >
                      <td className="table-td">
                        <div className="flex flex-col">
                          <span className="font-semibold text-brand-gray-light">{match.date}</span>
                          {match.time && (
                            <span className="text-[11px] text-brand-gray-muted mt-0.5">
                              {match.time} hs
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="table-td text-center">
                        {match.matchday ? (
                          <span className="font-semibold text-brand-gray-light bg-brand-black-border px-2 py-0.5 rounded text-xs">
                            J. {match.matchday}
                          </span>
                        ) : (
                          <span className="text-brand-gray-dark">-</span>
                        )}
                      </td>
                      <td className="table-td font-semibold text-brand-gray-light">
                        <div className="flex flex-col gap-1.5">
                          <div className="flex items-center gap-2.5">
                            <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center p-1 shrink-0 border border-brand-black-border/10 shadow-sm">
                              <img 
                                src={getTeamLogo(match.rival)} 
                                alt={match.rival} 
                                className="w-full h-full object-contain"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                                }}
                              />
                            </div>
                            <span>{match.rival}</span>
                          </div>
                           <div className="flex items-center gap-2 mt-1">
                             {(match.callup_time || match.callup_location) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSquadModal(match);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-brand-red-600/10 text-brand-red-600 px-1.5 py-0.5 rounded border border-brand-red-600/20 w-fit hover:bg-brand-red-600/20 transition-all cursor-pointer text-left"
                              >
                                <Users className="w-3 h-3" /> Convocatoria
                              </button>
                            )}
                            {match.tactical_system && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/matches/${match.id}/report`);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-600/20 w-fit hover:bg-emerald-600/20 transition-all cursor-pointer"
                              >
                                <CheckCircle className="w-3 h-3" /> Datos subidos
                              </button>
                            )}
                           </div>
                        </div>
                      </td>
                      <td className="table-td text-center">
                        <div className="flex flex-col items-center gap-1">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                            match.is_local ? 'bg-indigo-950/30 text-indigo-300 border border-indigo-900/30' : 'bg-orange-950/30 text-orange-300 border border-orange-900/30'
                          }`}>
                            {match.is_local ? 'Local' : 'Visitante'}
                          </span>
                          {match.location && <span className="text-[11px] text-brand-gray-muted text-center truncate max-w-[150px]" title={match.location}>{match.location}</span>}
                        </div>
                      </td>
                      <td className="table-td text-brand-gray-muted">{match.competition}</td>
                      <td className="table-td text-center font-bold text-base">
                        {hasPlayed ? (
                          <span className={match.score_us! > match.score_them! ? 'text-emerald-500' : match.score_us! < match.score_them! ? 'text-brand-red-600' : 'text-brand-gray-light'}>
                            {match.score_us} - {match.score_them}
                          </span>
                        ) : (
                          <span className="text-brand-gray-dark font-normal text-xs">-</span>
                        )}
                      </td>
                      <td className="table-td">
                        <span className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                          match.status === 'Jugado' 
                            ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' 
                            : match.status === 'Suspendido'
                            ? 'bg-red-950/20 text-red-400 border border-red-900/30'
                            : 'bg-brand-black-border text-brand-gray-muted border border-brand-black-border'
                        }`}>
                          {match.status === 'Jugado' && <CheckCircle className="w-3 h-3" />}
                          {match.status === 'Suspendido' && <XCircle className="w-3 h-3" />}
                          {match.status === 'Programado' && <HelpCircle className="w-3 h-3" />}
                          {match.status}
                        </span>
                      </td>
                      {(canEdit || canDelete) && (
                        <td className="table-td text-right">
                          <div className="flex gap-2 justify-end">
                            {canEdit && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleOpenEditModal(match); }}
                                className="text-brand-gray-muted hover:text-brand-gray-light p-1.5 rounded bg-brand-black-hover hover:bg-brand-black-border border border-brand-black-border transition-all"
                              >
                                <Edit2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                            {canDelete && (
                              <button 
                                onClick={(e) => { e.stopPropagation(); handleDelete(match.id); }}
                                className="text-brand-gray-muted hover:text-brand-red-600 p-1.5 rounded bg-brand-black-hover hover:bg-brand-red-600/10 border border-brand-black-border hover:border-brand-red-600/20 transition-all"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Cards responsivas para móviles */}
          <div className="md:hidden space-y-3.5">
            {filteredMatches.map((match) => {
              const hasPlayed = match.status === 'Jugado';
              return (
                <div 
                  key={match.id} 
                  onClick={() => handleMatchClick(match)}
                  className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 shadow-premium space-y-3 cursor-pointer hover:border-brand-black-border/80 transition-colors"
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0 border border-brand-black-border/10 shadow-sm">
                        <img 
                          src={getTeamLogo(match.rival)} 
                          alt={match.rival} 
                          className="w-full h-full object-contain"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                          }}
                        />
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-brand-gray-light flex flex-col gap-1">
                          {match.rival}
                          <div className="flex flex-wrap items-center gap-2 mt-1 font-normal">
                            {(match.callup_time || match.callup_location) && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openSquadModal(match);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-brand-red-600/10 text-brand-red-600 px-1.5 py-0.5 rounded border border-brand-red-600/20 w-fit hover:bg-brand-red-600/20 transition-all cursor-pointer text-left"
                              >
                                <Users className="w-3 h-3" /> Convocatoria
                              </button>
                            )}
                            {match.tactical_system && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/matches/${match.id}/report`);
                                }}
                                className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-600/10 text-emerald-500 px-1.5 py-0.5 rounded border border-emerald-600/20 w-fit hover:bg-emerald-600/20 transition-all cursor-pointer"
                              >
                                <CheckCircle className="w-3 h-3" /> Datos subidos
                              </button>
                            )}
                          </div>
                        </h4>
                        <span className="text-[11px] text-brand-gray-muted flex flex-wrap items-center gap-1 mt-1">
                          <Calendar className="w-3.5 h-3.5" /> {match.date} {match.time && `| ${match.time} hs`}
                        </span>
                        {match.location && (
                          <span className="text-[11px] text-brand-gray-muted block mt-1">
                            📍 {match.location}
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded ${
                        match.is_local ? 'bg-indigo-950/30 text-indigo-300' : 'bg-orange-950/30 text-orange-300'
                      }`}>
                        {match.is_local ? 'Local' : 'Visitante'}
                      </span>
                      {match.matchday && (
                        <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-400/30 shadow-[0_0_8px_rgba(34,211,238,0.15)]">
                          Jornada {match.matchday}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex justify-between items-center border-t border-brand-black-border pt-3">
                    <div className="text-xs text-brand-gray-muted">
                      Competición: <span className="text-brand-gray-light font-medium">{match.competition}</span>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className="text-[10px] font-medium text-brand-gray-muted">Resultado:</span>
                      <span className="text-sm font-bold bg-brand-black px-2.5 py-1 rounded border border-brand-black-border">
                        {hasPlayed ? `${match.score_us} - ${match.score_them}` : '-'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between border-t border-brand-black-border/50 pt-3">
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                      match.status === 'Jugado' 
                        ? 'bg-emerald-950/20 text-emerald-400' 
                        : match.status === 'Suspendido'
                        ? 'bg-red-950/20 text-red-400'
                        : 'bg-brand-black-border text-brand-gray-muted'
                    }`}>
                      {match.status}
                    </span>

                    <div className="flex gap-2">
                      {canEdit && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(match); }}
                          className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-gray-light flex items-center gap-1"
                        >
                          <Edit2 className="w-3 h-3" /> Editar
                        </button>
                      )}
                      {canDelete && (
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleDelete(match.id); }}
                          className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3 h-3" /> Borrar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* =====================================================================
          MODAL DE CREAR / EDITAR PARTIDO
          ===================================================================== */}
      <Modal 
        isOpen={isModalOpen} 
        onClose={handleCloseModal}
        title={editingMatch ? 'Editar Datos del Partido' : 'Programar Nuevo Partido'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Club Rival</label>
            {!isCustomRival ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  list="teams-list"
                  className="form-input bg-brand-black-bg flex-1"
                  placeholder="-- Buscar y seleccionar un rival --"
                  value={rival}
                  onChange={(e) => setRival(e.target.value)}
                  required
                />
                <datalist id="teams-list">
                  {dbTeams.map(t => (
                    <option key={t.id} value={t.name}>{t.name}</option>
                  ))}
                </datalist>
                <button
                  type="button"
                  onClick={() => {
                    setIsCustomRival(true);
                    setRival("");
                  }}
                  className="btn-secondary px-3.5 py-2 text-xs font-semibold hover:bg-brand-black-hover border border-brand-black-border"
                  title="Añadir rival no existente"
                >
                  Nuevo
                </button>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="form-input flex-1"
                    placeholder="Escribe el nombre del rival"
                    value={rival}
                    onChange={(e) => setRival(e.target.value)}
                    required
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setIsCustomRival(false);
                      setRival("");
                      setCustomShieldUrl("");
                    }}
                    className="btn-secondary px-3.5 py-2 text-xs font-semibold hover:bg-brand-black-hover border border-brand-black-border"
                    title="Volver a la lista de equipos"
                  >
                    Lista
                  </button>
                </div>
                <div>
                   <label className="text-[10px] text-brand-gray-muted block mb-1">Escudo del Rival (Opcional)</label>
                   <div className="flex gap-2">
                     <input 
                       type="text" 
                       className="form-input flex-1 text-xs py-2" 
                       placeholder="URL o subir imagen ➔" 
                       value={customShieldUrl}
                       onChange={(e) => setCustomShieldUrl(e.target.value)}
                     />
                     <label className="btn-secondary px-3 py-2 text-xs font-semibold cursor-pointer flex items-center justify-center hover:bg-brand-black-hover border border-brand-black-border">
                       <Upload className="w-3.5 h-3.5 mr-1" />
                       Subir
                       <input 
                         type="file" 
                         accept="image/*" 
                         className="hidden" 
                         onChange={(e) => {
                           const file = e.target.files?.[0];
                           if (file) {
                             const reader = new FileReader();
                             reader.onload = (ev) => {
                               setCustomShieldUrl(ev.target?.result as string);
                             };
                             reader.readAsDataURL(file);
                           }
                         }} 
                       />
                     </label>
                   </div>
                </div>
              </div>
            )}
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="form-label">Fecha del Encuentro</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Hora</label>
              <input
                type="time"
                className="form-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Jornada</label>
              <input
                type="text"
                className="form-input"
                placeholder="Ej. 1"
                value={matchday}
                onChange={(e) => setMatchday(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Competición</label>
              <select
                value={competition}
                onChange={(e) => setCompetition(e.target.value as any)}
                className="form-input bg-brand-black-bg"
              >
                <option value="Liga">Liga</option>
                <option value="Copa">Copa</option>
                <option value="Amistoso">Amistoso</option>
                <option value="Promoción">Promoción</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estado del Partido</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as any)}
                className="form-input bg-brand-black-bg"
              >
                <option value="Programado">Programado</option>
                <option value="Jugado">Jugado</option>
                <option value="Suspendido">Suspendido</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Ubicación (Tipo)</label>
              <select
                value={isLocal ? 'true' : 'false'}
                onChange={(e) => setIsLocal(e.target.value === 'true')}
                className="form-input bg-brand-black-bg"
              >
                <option value="true">Local (El Porrejat)</option>
                <option value="false">Visitante</option>
              </select>
            </div>
            <div>
              <label className="form-label">Estadio / Lugar</label>
              <input
                type="text"
                className="form-input"
                placeholder={isLocal ? 'Campo Municipal El Porrejat' : 'Lugar / Estadio visitante'}
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Objetivo del Partido (Opcional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Fase defensiva, contragolpes, balón parado..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Observaciones (Opcional)</label>
            <textarea
              className="form-input h-20 resize-none"
              placeholder="Detalles sobre convocatoria, indumentaria, autobús..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          {status === 'Jugado' && (
            <div className="bg-brand-black p-4 rounded-lg border border-brand-black-border space-y-3">
              <span className="text-xs font-semibold text-brand-red-600 block uppercase tracking-wider">Marcador / Resultado</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="form-label">Goles UD Atzeneta</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={scoreUs}
                    onChange={(e) => setScoreUs(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label">Goles Rival</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={scoreThem}
                    onChange={(e) => setScoreThem(e.target.value)}
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Partido
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL DE ACCIONES (ELEGIR ENTRE CONVOCATORIA O PASAR DATOS)
          ===================================================================== */}
      <Modal
        isOpen={isActionModalOpen}
        onClose={() => setIsActionModalOpen(false)}
        title="Acciones de Partido"
      >
        <div className="space-y-4 text-center">
          <p className="text-sm text-brand-gray-light font-medium">
            ¿Qué deseas hacer con el partido contra <span className="text-brand-red-600 font-bold">{selectedMatchForActions?.rival}</span>?
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
            <button
              onClick={handleOpenSquadModal}
              className="flex flex-col items-center justify-center p-5 bg-brand-black/50 border border-brand-black-border hover:border-brand-red-600/50 hover:bg-brand-black-hover rounded-xl group transition-all"
            >
              <Users className="w-8 h-8 text-brand-red-600 group-hover:scale-110 transition-transform mb-2" />
              <span className="text-sm font-bold text-brand-gray-light">Preparar Convocatoria</span>
              <span className="text-xs text-brand-gray-muted mt-1 text-center">
                Selecciona la lista de jugadores convocados.
              </span>
            </button>

            <button
              onClick={handleOpenStatsModal}
              className="flex flex-col items-center justify-center p-5 bg-brand-black/50 border border-brand-black-border hover:border-brand-red-600/50 hover:bg-brand-black-hover rounded-xl group transition-all"
            >
              <Clock className="w-8 h-8 text-brand-red-600 group-hover:scale-110 transition-transform mb-2" />
              <span className="text-sm font-bold text-brand-gray-light">Acta</span>
              <span className="text-xs text-brand-gray-muted mt-1 text-center">
                Introduce las estadísticas de rendimiento de los jugadores.
              </span>
            </button>
          </div>
          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={() => setIsActionModalOpen(false)}
              className="btn-secondary py-2 text-xs"
            >
              Cerrar
            </button>
          </div>
        </div>
      </Modal>

      {/* =====================================================================
          MODAL DE CONVOCATORIA (PREPARAR CONVOCATORIA)
          ===================================================================== */}
      <Modal
        isOpen={isSquadModalOpen}
        onClose={() => setIsSquadModalOpen(false)}
        title={`Convocatoria - vs ${selectedMatchForActions?.rival}`}
      >
        <form onSubmit={handleSaveSquad} className="space-y-4">
          
          {/* Cabecera de Convocatoria con Escudo del Club */}
          <div className="flex flex-col items-center border-b border-brand-black-border pb-4 mb-4 text-center">
            <div className="w-16 h-16 rounded-full bg-white flex items-center justify-center p-1.5 mb-2 shadow-premium">
              <img 
                src="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png" 
                alt="UD Atzeneta" 
                className="w-full h-full object-contain"
              />
            </div>
            <h4 className="text-base font-bold text-brand-gray-light leading-tight">
              {selectedMatchForActions?.is_local 
                ? `UD Atzeneta vs ${selectedMatchForActions?.rival}` 
                : `${selectedMatchForActions?.rival} vs UD Atzeneta`}
            </h4>
            {selectedMatchForActions?.matchday && (
              <span className="text-[10px] font-bold text-cyan-400 bg-cyan-950/40 border border-cyan-800/40 px-2 py-0.5 rounded-full mt-1">
                Jornada {selectedMatchForActions.matchday}
              </span>
            )}
            <span className="text-[11px] text-brand-gray-muted mt-1">
              🗓️ {selectedMatchForActions?.date} {selectedMatchForActions?.time && `| ⏰ ${selectedMatchForActions.time} hs`}
            </span>
          </div>

          {/* Diseño a dos columnas: Izquierda (Detalles y Ropa) / Derecha (Jugadores) */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 pb-2">
            
            {/* --- COLUMNA IZQUIERDA: EQUIPACIÓN Y DETALLES (5 columnas) --- */}
            <div className="lg:col-span-5 space-y-4">
              <div className="bg-brand-black-card/40 p-4 rounded-xl border border-brand-black-border/60">
                {/* Configuración */}
                <div className="flex flex-col gap-3 mb-4">
                  <div>
                    <label className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider block mb-1">Convocatoria (Hora)</label>
                    <input
                      type="time"
                      className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                      value={callupTime}
                      onChange={(e) => setCallupTime(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider block mb-1">Reunión (Lugar / Google Maps)</label>
                    <input
                      type="text"
                      className="form-input text-xs py-1.5 w-full bg-brand-black-bg"
                      placeholder="Ej. Campo de fútbol o enlace de Google Maps"
                      value={callupLocation}
                      onChange={(e) => setCallupLocation(e.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-3 pt-3 border-t border-brand-black-border/40">
                  <span className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider block">Equipación Oficial</span>
                  
                  {/* Maniquí */}
                  <div className="flex flex-col items-center justify-center bg-brand-black/30 rounded-lg p-2.5 border border-brand-black-border/40 mb-3">
                    <svg width="130" height="220" viewBox="0 0 160 240" className="mx-auto drop-shadow-2xl">
                      {/* Definición de filtros y gradientes 3D realistas */}
                      <defs>
                        <filter id="fabric-shadow" x="-20%" y="-20%" width="140%" height="140%">
                          <feDropShadow dx="0" dy="3" stdDeviation="4" floodOpacity="0.3" floodColor="#000" />
                        </filter>
                        
                        {/* Gradiente de Plástico Brillante (Maniquí real) */}
                        <linearGradient id="glossy-plastic" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#9ca3af" /> {/* Sombra izquierda */}
                          <stop offset="15%" stopColor="#f3f4f6" /> {/* Brillo especular fuerte */}
                          <stop offset="35%" stopColor="#d1d5db" />
                          <stop offset="65%" stopColor="#e5e7eb" /> {/* Luz secundaria */}
                          <stop offset="85%" stopColor="#9ca3af" />
                          <stop offset="100%" stopColor="#4b5563" /> {/* Sombra profunda derecha */}
                        </linearGradient>

                        {/* Sombreado de tela (brillos y sombras de la ropa) */}
                        <linearGradient id="shirt-shading" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
                          <stop offset="15%" stopColor="#fff" stopOpacity="0.25" />
                          <stop offset="40%" stopColor="#fff" stopOpacity="0.0" />
                          <stop offset="70%" stopColor="#fff" stopOpacity="0.1" />
                          <stop offset="90%" stopColor="#000" stopOpacity="0.2" />
                          <stop offset="100%" stopColor="#000" stopOpacity="0.6" />
                        </linearGradient>

                        <linearGradient id="leg-gradient" x1="0%" y1="0%" x2="100%" y2="0%">
                          <stop offset="0%" stopColor="#000" stopOpacity="0.4" />
                          <stop offset="20%" stopColor="#fff" stopOpacity="0.2" />
                          <stop offset="80%" stopColor="#000" stopOpacity="0.1" />
                          <stop offset="100%" stopColor="#000" stopOpacity="0.5" />
                        </linearGradient>
                      </defs>

                      {/* MANIQUÍ BASE (Plástico Brillante) */}
                      <g fill="url(#glossy-plastic)">
                        {/* Cabeza */}
                        <ellipse cx="80" cy="22" rx="14" ry="18" />
                        
                        {/* Cuello */}
                        <path d="M 74 38 Q 80 44 86 38 L 84 48 L 76 48 Z" />
                        
                        {/* Torso & Caderas Base */}
                        <path d="M 46 48 Q 80 42 114 48 C 116 60, 110 70, 110 75 C 108 95, 108 115, 110 135 C 100 145, 90 155, 80 155 C 70 155, 60 145, 50 135 C 52 115, 52 95, 50 75 C 50 70, 44 60, 46 48 Z" />

                        {/* Brazo Izquierdo */}
                        <path d="M 46 48 C 30 65, 20 90, 18 125 C 16 135, 24 140, 28 132 C 34 115, 44 85, 50 75 Z" />
                        
                        {/* Brazo Derecho */}
                        <path d="M 114 48 C 130 65, 140 90, 142 125 C 144 135, 136 140, 132 132 C 126 115, 116 85, 110 75 Z" />
                        
                        {/* Piernas (Muslos y Gemelos) */}
                        <path d="M 50 135 C 45 160, 50 195, 52 230 C 62 230, 68 190, 68 150 C 68 145, 75 145, 80 155 Z" />
                        <path d="M 110 135 C 115 160, 110 195, 108 230 C 98 230, 92 190, 92 150 C 92 145, 85 145, 80 155 Z" />
                      </g>

                      {/* CAMISETA */}
                      <g filter="url(#fabric-shadow)">
                        {/* Manga Izquierda */}
                        <path d="M 46 48 C 34 60, 24 75, 22 85 L 36 88 L 50 75 Z" fill={kitShirtColor} />
                        <path d="M 46 48 C 34 60, 24 75, 22 85 L 36 88 L 50 75 Z" fill="url(#shirt-shading)" />
                        
                        {/* Manga Derecha */}
                        <path d="M 114 48 C 126 60, 136 75, 138 85 L 124 88 L 110 75 Z" fill={kitShirtColor} />
                        <path d="M 114 48 C 126 60, 136 75, 138 85 L 124 88 L 110 75 Z" fill="url(#shirt-shading)" />
                        
                        {/* Cuerpo Camiseta */}
                        <path d="M 46 48 Q 80 42 114 48 C 116 60, 110 70, 110 75 C 108 95, 106 115, 106 130 Q 80 136 54 130 C 54 115, 52 95, 50 75 C 50 70, 44 60, 46 48 Z" fill={kitShirtColor} />
                        <path d="M 46 48 Q 80 42 114 48 C 116 60, 110 70, 110 75 C 108 95, 106 115, 106 130 Q 80 136 54 130 C 54 115, 52 95, 50 75 C 50 70, 44 60, 46 48 Z" fill="url(#shirt-shading)" />
                        
                        {/* Arrugas Camiseta */}
                        <path d="M 60 130 C 65 100, 62 80, 58 60" stroke="#000" strokeWidth="2" strokeOpacity="0.15" fill="none" />
                        <path d="M 100 130 C 95 100, 98 80, 102 60" stroke="#000" strokeWidth="2" strokeOpacity="0.15" fill="none" />
                        <path d="M 80 132 L 80 70" stroke="#000" strokeWidth="1.5" strokeOpacity="0.08" fill="none" />
                        <path d="M 54 95 Q 65 110 70 130" stroke="#000" strokeWidth="1.5" strokeOpacity="0.1" fill="none" />
                        <path d="M 106 95 Q 95 110 90 130" stroke="#000" strokeWidth="1.5" strokeOpacity="0.1" fill="none" />
                        
                        {/* Cuello Pico */}
                        <path d="M 70 47 Q 80 60 90 47 Q 80 49 70 47 Z" fill="url(#glossy-plastic)" />
                        <path d="M 68 46 Q 80 62 92 46" stroke={kitShirtColor} strokeWidth="3" fill="none" filter="brightness(0.7)" />
                      </g>

                      {/* ESCUDO */}
                      <image
                        href="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png"
                        x="88"
                        y="58"
                        width="18"
                        height="18"
                        className="drop-shadow-sm"
                      />

                      {/* PANTALÓN */}
                      <g filter="url(#fabric-shadow)">
                        <path d="M 54 130 Q 80 136 106 130 C 108 140, 112 165, 112 170 L 80 155 L 48 170 C 48 165, 52 140, 54 130 Z" fill={kitShortsColor} />
                        <path d="M 54 130 Q 80 136 106 130 C 108 140, 112 165, 112 170 L 80 155 L 48 170 C 48 165, 52 140, 54 130 Z" fill="url(#shirt-shading)" />
                        
                        {/* Arrugas Pantalón */}
                        <path d="M 58 132 Q 60 150 54 167" stroke="#000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                        <path d="M 102 132 Q 100 150 106 167" stroke="#000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                        <path d="M 80 132 L 80 155" stroke="#000" strokeWidth="2" strokeOpacity="0.15" fill="none" />
                        <path d="M 68 132 Q 72 145 68 158" stroke="#000" strokeWidth="1" strokeOpacity="0.1" fill="none" />
                        <path d="M 92 132 Q 88 145 92 158" stroke="#000" strokeWidth="1" strokeOpacity="0.1" fill="none" />
                      </g>

                      {/* MEDIAS / CALZAS (Textura ajustada) */}
                      <g filter="url(#fabric-shadow)">
                        {/* Izquierda */}
                        <path d="M 51 190 C 46 205, 48 225, 50 230 C 62 230, 64 205, 65 190 Q 58 193 51 190 Z" fill={kitSocksColor} />
                        <path d="M 51 190 C 46 205, 48 225, 50 230 C 62 230, 64 205, 65 190 Q 58 193 51 190 Z" fill="url(#leg-gradient)" />
                        
                        {/* Derecha */}
                        <path d="M 109 190 C 114 205, 112 225, 110 230 C 98 230, 96 205, 95 190 Q 102 193 109 190 Z" fill={kitSocksColor} />
                        <path d="M 109 190 C 114 205, 112 225, 110 230 C 98 230, 96 205, 95 190 Q 102 193 109 190 Z" fill="url(#leg-gradient)" />
                        
                        {/* Doblez superior y elásticos */}
                        <path d="M 50 195 Q 58 198 66 195" stroke="#000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                        <path d="M 110 195 Q 102 198 94 195" stroke="#000" strokeWidth="2" strokeOpacity="0.2" fill="none" />
                      </g>

                      {/* BOTAS */}
                      <g filter="url(#fabric-shadow)">
                        <path d="M 50 230 C 42 232, 38 238, 44 242 L 60 242 C 63 242, 64 235, 62 230 Z" fill="#111827" />
                        <path d="M 46 238 L 56 238" stroke="#fff" strokeWidth="1" strokeOpacity="0.4" fill="none" />
                        
                        <path d="M 110 230 C 118 232, 122 238, 116 242 L 100 242 C 97 242, 96 235, 98 230 Z" fill="#111827" />
                        <path d="M 114 238 L 104 238" stroke="#fff" strokeWidth="1" strokeOpacity="0.4" fill="none" />
                      </g>
                    </svg>
                  </div>

                  {/* Camiseta */}
                  <div className="flex items-center justify-between bg-brand-black/25 p-1.5 rounded border border-brand-black-border/30">
                    <span className="text-xs text-brand-gray-light font-medium">Camiseta</span>
                    <div className="flex items-center gap-1.5">
                      {['#C1121F', '#000000', '#FFFFFF', '#1D4ED8', '#F59E0B'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setKitShirtColor(col)}
                          className={`w-4 h-4 rounded-full border transition-all ${
                            kitShirtColor === col ? 'ring-2 ring-brand-red-600 scale-110 border-white' : 'border-brand-black-border'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                      <input
                        type="color"
                        className="w-5 h-5 rounded cursor-pointer border border-brand-black-border bg-transparent p-0"
                        value={kitShirtColor}
                        onChange={(e) => setKitShirtColor(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Pantalón */}
                  <div className="flex items-center justify-between bg-brand-black/25 p-1.5 rounded border border-brand-black-border/30">
                    <span className="text-xs text-brand-gray-light font-medium">Pantalón Corto</span>
                    <div className="flex items-center gap-1.5">
                      {['#000000', '#C1121F', '#FFFFFF', '#1D4ED8', '#F59E0B'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setKitShortsColor(col)}
                          className={`w-4 h-4 rounded-full border transition-all ${
                            kitShortsColor === col ? 'ring-2 ring-brand-red-600 scale-110 border-white' : 'border-brand-black-border'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                      <input
                        type="color"
                        className="w-5 h-5 rounded cursor-pointer border border-brand-black-border bg-transparent p-0"
                        value={kitShortsColor}
                        onChange={(e) => setKitShortsColor(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Medias */}
                  <div className="flex items-center justify-between bg-brand-black/25 p-1.5 rounded border border-brand-black-border/30">
                    <span className="text-xs text-brand-gray-light font-medium">Medias / Calzas</span>
                    <div className="flex items-center gap-1.5">
                      {['#000000', '#C1121F', '#FFFFFF', '#1D4ED8', '#F59E0B'].map((col) => (
                        <button
                          key={col}
                          type="button"
                          onClick={() => setKitSocksColor(col)}
                          className={`w-4 h-4 rounded-full border transition-all ${
                            kitSocksColor === col ? 'ring-2 ring-brand-red-600 scale-110 border-white' : 'border-brand-black-border'
                          }`}
                          style={{ backgroundColor: col }}
                        />
                      ))}
                      <input
                        type="color"
                        className="w-5 h-5 rounded cursor-pointer border border-brand-black-border bg-transparent p-0"
                        value={kitSocksColor}
                        onChange={(e) => setKitSocksColor(e.target.value)}
                      />
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* --- COLUMNA DERECHA: SELECCIÓN DE JUGADORES (7 columnas) --- */}
            <div className="lg:col-span-7 flex flex-col h-full max-h-[500px]">
              <div className="text-xs text-brand-gray-muted flex justify-between items-center mb-0 text-left bg-brand-black-card/40 p-2.5 rounded-t-xl border border-brand-black-border/60 border-b-0">
                <span className="font-bold uppercase tracking-wider">Selección de Jugadores Convocados:</span>
                <span className="font-bold text-brand-red-600 bg-brand-red-600/10 px-2 py-0.5 rounded">
                  {selectedSquadPlayerIds.length} convocados
                </span>
              </div>

              <div className="flex-1 overflow-y-auto pr-1 no-scrollbar border border-brand-black-border/60 p-2 rounded-b-xl bg-brand-black-card/40">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {dbPlayers.length === 0 ? (
                    <div className="col-span-full text-center py-8 text-brand-gray-muted text-xs italic">
                      No hay jugadores en la plantilla.
                    </div>
                  ) : (
                    dbPlayers
                      .map((player) => {
                      const isBaja = player.physical_status === 'Baja';
                      const isSelected = selectedSquadPlayerIds.includes(player.id) && !isBaja;
                      return (
                        <div
                          key={player.id}
                          onClick={() => {
                            if (!isBaja) togglePlayerInSquad(player.id);
                          }}
                          className={`flex items-center justify-between p-1.5 rounded border transition-all ${
                            isBaja ? 'bg-brand-black/20 border-brand-red-900/30 opacity-60 cursor-not-allowed' :
                            isSelected
                              ? 'bg-brand-red-600/10 border-brand-red-600/50 cursor-pointer'
                              : 'bg-brand-black/40 border-brand-black-border hover:border-brand-black-border/80 cursor-pointer'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            {/* Avatar */}
                            <div className="w-6 h-6 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                              {player.photo_url ? (
                                <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-3 h-3 text-brand-gray-dark" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                {player.dorsal && (
                                  <span className="text-[9px] font-black text-brand-red-600 bg-brand-red-600/10 px-1 py-0.5 rounded leading-none">
                                    {player.dorsal}
                                  </span>
                                )}
                                <span className="text-[11px] font-semibold text-brand-gray-light leading-none truncate max-w-[90px]">
                                  {player.nickname || player.full_name}
                                </span>
                                {isBaja && (
                                  <span className="text-[8px] font-black bg-brand-red-600 text-white px-1 py-0.5 rounded uppercase ml-1">
                                    Baja
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center shrink-0 pl-1">
                            <div className={`w-4 h-4 rounded-sm border flex items-center justify-center transition-all ${
                              isSelected
                                ? 'bg-brand-red-600 border-brand-red-600 text-white'
                                : 'border-brand-gray-dark bg-transparent'
                            }`}>
                              {isSelected && <Check className="w-3 h-3" />}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>

          </div>

          <div className="flex flex-col sm:flex-row flex-wrap gap-2 pt-2 sm:justify-end">
            <button
              type="button"
              onClick={handleExportCallupPDF}
              className="btn-secondary py-2 text-xs flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              <FileText className="w-3.5 h-3.5" /> Descargar PDF
            </button>
            <button
              type="button"
              onClick={() => setIsSquadModalOpen(false)}
              className="btn-secondary py-2 text-xs justify-center w-full sm:w-auto"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleDeleteSquad}
              disabled={deleteSquadMutation.isPending}
              className="btn-secondary py-2 text-xs justify-center text-brand-red-600 border-brand-red-600/30 hover:bg-brand-red-600/10 w-full sm:w-auto"
            >
              {deleteSquadMutation.isPending ? 'Borrando...' : 'Borrar Convocatoria'}
            </button>
            <button
              type="submit"
              disabled={saveSquadMutation.isPending}
              className="btn-primary py-2 text-xs font-semibold flex items-center justify-center gap-1 w-full sm:w-auto"
            >
              {saveSquadMutation.isPending ? 'Guardando...' : 'Guardar Convocatoria'}
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
