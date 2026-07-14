import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { useAuth } from '../context/AuthContext';
import { TableSkeleton } from '../components/Skeletons';
import { 
  Users, Plus, Edit2, Trash2, Scale, HeartPulse, Trophy, Activity, Calendar,
  TrendingUp, Ruler, UserCheck, AlertTriangle, ShieldCheck, ChevronRight, Phone, Mail, Search,
  Download, FileText, ChevronDown, Check, X, ShieldAlert, LayoutGrid, List as ListIcon, Map,
  PlayCircle, Target, Navigation, BarChart2
} from 'lucide-react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { Player, PlayerWeight, PlayerPhysioRecord, TrainingAttendance, ScoutingPlayer } from '../types';
import { Modal } from '../components/Modal';
import { PhotoCropUpload } from '../components/PhotoCropUpload';
import { useToast } from '../context/ToastContext';
import { exportToCSV, exportToPDF, exportSquadToPDF } from '../utils/export';

export const Players: React.FC = () => {
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { hasPermission } = useAuth();
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
  type StatKey = 'minutes' | 'called' | 'starter' | 'goals' | 'assists' | 'conceded' | 'yellow' | 'red';
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [detailTab, setDetailTab] = useState<'ficha' | 'stats' | 'peso' | 'fisio'>('ficha');
  const [viewMode, setViewMode] = useState<'grid' | 'list' | 'stats'>('list');
  const [filterCompetition, setFilterCompetition] = useState('Liga');
  
  // Controles de gráficas
  const [scatterXAxis, setScatterXAxis] = useState<StatKey>('minutes');
  const [scatterYAxis, setScatterYAxis] = useState<StatKey>('goals');
  const [barMetric, setBarMetric] = useState<StatKey>('goals');

  // Modales
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<Player | null>(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [isPhysioModalOpen, setIsPhysioModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [searchScoutingTerm, setSearchScoutingTerm] = useState('');

  // Campos formulario jugador
  const [fullName, setFullName] = useState('');
  const [nickname, setNickname] = useState('');
  const [photoUrl, setPhotoUrl] = useState('');
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

  // Campos formulario pesaje
  const [newWeight, setNewWeight] = useState('');
  const [weightDate, setWeightDate] = useState(new Date().toISOString().split('T')[0]);

  // Campos formulario fisio
  const [physioStatus, setPhysioStatus] = useState<'Disponible' | 'Lesionado' | 'En duda' | 'Baja'>('Disponible');
  const [physioNotes, setPhysioNotes] = useState('');
  const [physioTreatment, setPhysioTreatment] = useState('');
  const [physioDate, setPhysioDate] = useState(new Date().toISOString().split('T')[0]);

  // React Query - Cargar Jugadores
  const { data: rawPlayers = [], isLoading } = useQuery({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers()
  });

  const { user } = useAuth();
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

  // Rankings
  const rankings = React.useMemo(() => {
    const validMatches = allMatches.filter((m: any) => filterCompetition === 'Todas' || m.competition === filterCompetition);
    const validMatchIds = new Set(validMatches.map((m: any) => m.id));
    const validStats = allPlayerStats.filter((s: any) => validMatchIds.has(s.match_id));

    const playerTotals: Record<string, { minutes: number, called: number, starter: number, goals: number, assists: number, conceded: number, yellow: number, red: number }> = {};
    
    players.forEach((p: any) => {
      playerTotals[p.id] = { minutes: 0, called: 0, starter: 0, goals: 0, assists: 0, conceded: 0, yellow: 0, red: 0 };
    });

    validStats.forEach((s: any) => {
      if (!playerTotals[s.player_id]) return;
      const t = playerTotals[s.player_id];
      if (s.is_called_up) t.called += 1;
      if (s.is_starter) t.starter += 1;
      t.minutes += (s.minutes_played || 0);
      t.goals += (s.goals || 0);
      t.assists += (s.assists || 0);
      t.conceded += (s.conceded_goals || 0);
      t.yellow += (s.yellow_cards || 0);
      if (s.red_card) t.red += 1;
    });

    return players.map((p: any) => ({
      ...p,
      stats: playerTotals[p.id] || { minutes: 0, called: 0, starter: 0, goals: 0, assists: 0, conceded: 0, yellow: 0, red: 0 }
    }));
  }, [players, allMatches, allPlayerStats, filterCompetition]);

  const topPlayers = (key: keyof typeof rankings[0]['stats'], ascending = false) => {
    return [...rankings]
      .filter((p: any) => ascending ? true : (key === 'conceded' || p.stats[key] > 0))
      .filter((p: any) => key === 'conceded' ? p.stats.minutes > 0 : true)
      .sort((a: any, b: any) => ascending ? a.stats[key] - b.stats[key] : b.stats[key] - a.stats[key])
      .slice(0, 5);
  };

  // React Query - Cargar Jugadores de Scouting para Importar
  const { data: scoutingPlayers = [] } = useQuery({
    queryKey: ['scoutingForImport'],
    queryFn: () => dataService.getScouting(),
    enabled: isImportModalOpen
  });

  // React Query - Cargar Pesos del jugador seleccionado
  const { data: weights = [], isLoading: isLoadingWeights } = useQuery({
    queryKey: ['playerWeights', selectedPlayer?.id],
    queryFn: () => selectedPlayer ? dataService.getPlayerWeights(selectedPlayer.id) : Promise.resolve([]),
    enabled: !!selectedPlayer && detailTab === 'peso'
  });

  // React Query - Cargar Fisio del jugador seleccionado
  const { data: physioRecords = [], isLoading: isLoadingPhysio } = useQuery({
    queryKey: ['playerPhysio', selectedPlayer?.id],
    queryFn: () => selectedPlayer ? dataService.getPlayerPhysioRecords(selectedPlayer.id) : Promise.resolve([]),
    enabled: !!selectedPlayer && detailTab === 'fisio'
  });

  // React Query - Cargar Asistencia del jugador seleccionado
  const { data: attendanceRecords = [], isLoading: isLoadingAttendance } = useQuery<TrainingAttendance[]>({
    queryKey: ['playerAttendance', selectedPlayer?.id],
    queryFn: async () => {
      if (!selectedPlayer) return [];
      const allAtt = await dataService.getTrainingAttendance();
      return allAtt.filter((a: TrainingAttendance) => a.player_id === selectedPlayer.id);
    },
    enabled: !!selectedPlayer
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
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ['players'] });
      if (selectedPlayer && selectedPlayer.id === updated.id) {
        setSelectedPlayer(updated);
      }
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
      setSelectedPlayer(null);
      showToast('success', 'Jugador Eliminado', 'Ficha eliminada de la base de datos.');
    },
    onError: (err: any) => {
      showToast('error', 'Error al eliminar', err.message || 'No se pudo eliminar el jugador.');
    }
  });

  const addWeightMutation = useMutation({
    mutationFn: (weightRecord: Omit<PlayerWeight, 'id'>) => dataService.createPlayerWeight(weightRecord),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerWeights', selectedPlayer?.id] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Peso Registrado', 'Nuevo control de peso añadido.');
      setIsWeightModalOpen(false);
      setNewWeight('');
    },
    onError: (err: any) => {
      showToast('error', 'Error al registrar', err.message || 'No se pudo registrar el peso.');
    }
  });

  const addPhysioMutation = useMutation({
    mutationFn: (physioRecord: Omit<PlayerPhysioRecord, 'id'>) => dataService.createPlayerPhysioRecord(physioRecord),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['playerPhysio', selectedPlayer?.id] });
      queryClient.invalidateQueries({ queryKey: ['players'] });
      showToast('success', 'Parte Fisio Registrado', 'Nueva nota de fisioterapia añadida.');
      setIsPhysioModalOpen(false);
      setPhysioNotes('');
      setPhysioTreatment('');
    },
    onError: (err: any) => {
      showToast('error', 'Error al registrar', err.message || 'No se pudo registrar la nota de fisioterapia.');
    }
  });

  // Filtros
  const filteredPlayers = React.useMemo(() => {
    return rankings.filter((p: any) => {
      const matchesSearch = p.full_name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        (p.position && p.position.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesPosition = filterPosition === 'Todos' || p.position === filterPosition;
      const matchesStatus = filterStatus === 'Todos' || p.physical_status === filterStatus;
      return matchesSearch && matchesPosition && matchesStatus;
    });
  }, [rankings, searchTerm, filterPosition, filterStatus]);

  // Reset del formulario de jugador
  const handleOpenCreateModal = () => {
    setEditingPlayer(null);
    setFullName('');
    setNickname('');
    setPhotoUrl('');
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

  const handleAddWeightSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newWeight || !selectedPlayer) return;
    
    addWeightMutation.mutate({
      player_id: selectedPlayer.id,
      weight: parseFloat(newWeight),
      date: weightDate
    });
  };

  const handleAddPhysioSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!physioNotes.trim() || !selectedPlayer) return;

    addPhysioMutation.mutate({
      player_id: selectedPlayer.id,
      status: physioStatus,
      notes: physioNotes,
      treatment: physioTreatment || undefined,
      date: physioDate
    });
  };

  const handleExportPlayerReport = async (player: Player) => {
    if (!player) return;
    showToast('info', 'Generando Reporte', 'Preparando el informe PDF de la ficha del jugador...');
    
    try {
      const { jsPDF } = await import('jspdf');
      const html2canvas = (await import('html2canvas')).default;

      // Crear contenedor temporal
      const reportEl = document.createElement('div');
      reportEl.style.position = 'fixed';
      reportEl.style.left = '-9999px';
      reportEl.style.top = '-9999px';
      reportEl.style.width = '700px';
      reportEl.style.padding = '35px';
      reportEl.style.background = '#ffffff';
      reportEl.style.color = '#1f2937';
      reportEl.style.fontFamily = 'system-ui, sans-serif';
      
      const totalSessions = attendanceRecords.length;
      const sessionsTrained = attendanceRecords.filter((a: TrainingAttendance) => a.status === 'Entrena').length;
      const attendanceRate = totalSessions > 0 ? ((sessionsTrained / totalSessions) * 100).toFixed(0) : '0';

      reportEl.innerHTML = `
        <div style="border: 2px solid #C1121F; padding: 25px; border-radius: 12px; background: #ffffff;">
          <!-- Cabecera con Escudo y Título -->
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #e5e7eb; padding-bottom: 15px; margin-bottom: 20px;">
            <div style="display: flex; align-items: center; gap: 15px;">
              <img src="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png" style="width: 55px; height: 55px; object-fit: contain;" crossorigin="anonymous" />
              <div>
                <h1 style="margin: 0; font-size: 20px; font-weight: 800; color: #C1121F; letter-spacing: 0.5px;">U.D. ATZENETA DE CASTELLÓN</h1>
                <span style="font-size: 10px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Informe de Rendimiento y Ficha Técnica</span>
              </div>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 10px; color: #9ca3af; font-weight: bold;">TEMPORADA 2025/2026</span>
              <p style="margin: 3px 0 0 0; font-size: 9px; color: #6b7280;">Generado: ${new Date().toLocaleDateString('es-ES')}</p>
            </div>
          </div>

          <!-- Perfil Principal del Jugador -->
          <div style="display: flex; gap: 25px; background: #f9fafb; border: 1px solid #e5e7eb; padding: 20px; border-radius: 8px; margin-bottom: 20px;">
            <div style="width: 100px; height: 100px; border-radius: 50%; overflow: hidden; border: 2px solid #C1121F; background: #ffffff; display: flex; align-items: center; justify-content: center; shrink-0;">
              ${player.photo_url 
                ? `<img src="${player.photo_url}" style="width: 100%; height: 100%; object-fit: cover;" crossorigin="anonymous" />`
                : `<div style="font-size: 32px; color: #9ca3af; font-weight: bold; width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: #e5e7eb;">${player.nickname ? player.nickname[0] : player.full_name[0]}</div>`
              }
            </div>
            
            <div style="flex: 1; display: grid; grid-template-columns: 1fr 1fr; gap: 10px; text-align: left;">
              <div style="grid-column: span 2;">
                <h2 style="margin: 0; font-size: 18px; font-weight: 800; color: #111827;">
                  ${player.nickname || player.full_name} ${player.dorsal ? `<span style="color: #C1121F; font-size: 13px; background: rgba(193, 18, 31, 0.1); padding: 2px 6px; border-radius: 4px; margin-left: 5px; font-weight: bold;">#${player.dorsal}</span>` : ''}
                </h2>
                ${player.nickname ? `<p style="margin: 3px 0 0 0; font-size: 11px; color: #6b7280;">Nombre Completo: <strong>${player.full_name}</strong></p>` : ''}
              </div>
              
              <div style="margin-top: 5px;">
                <span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Posición Táctica</span>
                <strong style="font-size: 11px; color: #1f2937;">${player.position || 'No definida'}</strong>
              </div>
              <div style="margin-top: 5px;">
                <span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Pie Dominante</span>
                <strong style="font-size: 11px; color: #1f2937;">${player.dominant_foot || 'No definido'}</strong>
              </div>
              <div>
                <span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Estatura / Peso</span>
                <strong style="font-size: 11px; color: #1f2937;">${player.height ? `${player.height} cm` : '-'} / ${player.weight ? `${player.weight} kg` : '-'}</strong>
              </div>
              <div>
                <span style="font-size: 8px; color: #9ca3af; font-weight: bold; text-transform: uppercase; display: block;">Estado Físico</span>
                <strong style="font-size: 11px; color: ${player.physical_status === 'Disponible' ? '#10b981' : player.physical_status === 'Lesionado' ? '#ef4444' : '#f59e0b'};">${player.physical_status || 'Disponible'}</strong>
              </div>
            </div>
          </div>

          <!-- Grid de Métricas de Rendimiento -->
          <div style="margin-bottom: 20px; text-align: left;">
            <h3 style="margin: 0 0 10px 0; font-size: 12px; font-weight: 700; color: #C1121F; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 5px;">Rendimiento Deportivo y Asistencia</h3>
            <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 10px;">
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Partidos</span>
                <strong style="font-size: 15px; color: #111827; display: block; margin-top: 3px;">${player.matches_played}</strong>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Minutos</span>
                <strong style="font-size: 15px; color: #111827; display: block; margin-top: 3px;">${player.minutes_played}'</strong>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Goles / Asistencias</span>
                <strong style="font-size: 15px; color: #10b981; display: block; margin-top: 3px;">${player.goals} / ${player.assists}</strong>
              </div>
              <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 10px; border-radius: 6px; text-align: center;">
                <span style="font-size: 8px; color: #6b7280; font-weight: bold; text-transform: uppercase; display: block;">Asistencia</span>
                <strong style="font-size: 15px; color: #3b82f6; display: block; margin-top: 3px;">${attendanceRate}%</strong>
                <span style="font-size: 8px; color: #6b7280;">(${sessionsTrained}/${totalSessions} ses.)</span>
              </div>
            </div>
          </div>

          <!-- Historial de Peso y Fisioterapia -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; text-align: left;">
            <!-- Columna Peso -->
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #C1121F; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Evolución de Peso</h3>
              ${weights.length === 0 
                ? '<p style="font-size: 10px; color: #9ca3af; font-style: italic;">Sin registros de peso.</p>'
                : `
                  <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
                    <thead>
                      <tr style="border-bottom: 1px solid #e5e7eb; text-align: left; color: #6b7280;">
                        <th style="padding: 4px 0;">Fecha</th>
                        <th style="padding: 4px 0; text-align: right;">Peso (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${weights.slice(-5).map(w => `
                        <tr style="border-bottom: 1px solid #f3f4f6;">
                          <td style="padding: 4px 0; color: #374151;">${w.date}</td>
                          <td style="padding: 4px 0; text-align: right; font-weight: bold; color: #111827;">${w.weight} kg</td>
                        </tr>
                      `).join('')}
                    </tbody>
                  </table>
                `
              }
            </div>
            
            <!-- Columna Fisioterapia -->
            <div>
              <h3 style="margin: 0 0 8px 0; font-size: 11px; font-weight: 700; color: #C1121F; text-transform: uppercase; border-bottom: 1px solid #e5e7eb; padding-bottom: 4px;">Fisioterapia y Observaciones</h3>
              ${physioRecords.length === 0 
                ? '<p style="font-size: 10px; color: #9ca3af; font-style: italic;">Sin partes médicos.</p>'
                : `
                  <div style="display: flex; flex-direction: column; gap: 6px;">
                    ${physioRecords.slice(0, 2).map(r => `
                      <div style="background: #f9fafb; border: 1px solid #e5e7eb; padding: 6px 8px; border-radius: 4px;">
                        <div style="display: flex; justify-content: space-between; font-size: 8px; color: #6b7280; font-weight: bold; margin-bottom: 2px;">
                          <span>${r.date}</span>
                          <span style="color: ${r.status === 'Disponible' ? '#10b981' : '#ef4444'}">${r.status.toUpperCase()}</span>
                        </div>
                        <p style="margin: 0; font-size: 9px; color: #374151; line-height: 1.2;">${r.notes}</p>
                        ${r.treatment ? `<p style="margin: 3px 0 0 0; font-size: 8px; color: #10b981; font-weight: bold;">Fisio: <span style="font-weight: normal; color: #4b5563;">${r.treatment}</span></p>` : ''}
                      </div>
                    `).join('')}
                  </div>
                `
              }
            </div>
          </div>
        </div>
      `;

      document.body.appendChild(reportEl);

      const canvas = await html2canvas(reportEl, {
        useCORS: true,
        allowTaint: false,
        scale: 2
      });

      const imgData = canvas.toDataURL('image/png');
      
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const pdfW = pdf.internal.pageSize.getWidth();
      const margin = 10;
      const imgW = pdfW - 2 * margin;
      const imgH = (canvas.height * imgW) / canvas.width;

      pdf.addImage(imgData, 'PNG', margin, margin, imgW, imgH);
      pdf.save(`ficha_${player.nickname || player.full_name.replace(/\s+/g, '_')}.pdf`);

      document.body.removeChild(reportEl);
      showToast('success', 'PDF Generado', 'La ficha e informes de rendimiento se han descargado.');
    } catch (err: any) {
      console.error(err);
      showToast('error', 'Error al exportar', 'No se pudo generar el informe en PDF.');
    }
  };

  // Exportar datos
  const handleExportCSV = () => {
    if (filteredPlayers.length === 0) return;
    const headers = ['Nombre', 'Dorsal', 'Posición', 'Pie Dominante', 'Estatura', 'Peso', 'PJ', 'Goles', 'Asistencias', 'Estado Físico'];
    const rows = filteredPlayers.map(p => [
      p.full_name,
      p.dorsal || '-',
      p.position || '-',
      p.dominant_foot || '-',
      p.height ? `${p.height} cm` : '-',
      p.weight ? `${p.weight} kg` : '-',
      p.matches_played,
      p.goals,
      p.assists,
      p.physical_status || 'Disponible'
    ]);
    exportToCSV(`jugadores_ud_atzeneta`, headers, rows);
  };

  const handleExportPDF = async () => {
    if (filteredPlayers.length === 0) return;
    await exportSquadToPDF(filteredPlayers);
  };

  // Render SVG para la gráfica evolutiva de peso
  const renderWeightChart = () => {
    if (weights.length === 0) {
      return (
        <div className="text-center py-8 text-brand-gray-muted italic text-xs">
          No hay registros de peso suficientes para dibujar la gráfica.
        </div>
      );
    }

    const svgW = 500;
    const svgH = 180;
    const padX = 40;
    const padY = 20;
    const chartW = svgW - 2 * padX;
    const chartH = svgH - 2 * padY;

    const values = weights.map(w => w.weight);
    const minWeight = Math.min(...values) - 2;
    const maxWeight = Math.max(...values) + 2;
    const range = maxWeight - minWeight || 4;

    const points = weights.map((w, idx) => {
      const x = padX + (idx / (weights.length - 1 || 1)) * chartW;
      const y = padY + chartH - ((w.weight - minWeight) / range) * chartH;
      return { x, y, weight: w.weight, date: w.date };
    });

    const pathData = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

    return (
      <div className="space-y-2">
        <div className="bg-brand-black border border-brand-black-border p-3 rounded-lg overflow-x-auto">
          <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="min-w-[400px] overflow-visible">
            {/* Gridlines */}
            {[0, 0.5, 1].map((ratio, i) => {
              const y = padY + chartH * ratio;
              const wVal = (maxWeight - ratio * range).toFixed(1);
              return (
                <g key={i} className="opacity-20">
                  <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#4b5563" strokeDasharray="3,3" />
                  <text x={padX - 8} y={y + 3} fill="#9ca3af" fontSize="8" textAnchor="end">{wVal} kg</text>
                </g>
              );
            })}

            {/* Línea del gráfico */}
            {points.length > 1 && (
              <path
                d={pathData}
                fill="none"
                stroke="#10b981"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}

            {/* Puntos interactivos */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle
                  cx={p.x}
                  cy={p.y}
                  r="4"
                  fill="#1f2937"
                  stroke="#10b981"
                  strokeWidth="2"
                  className="cursor-pointer hover:r-6 hover:fill-emerald-500 transition-all"
                />
                <text
                  x={p.x}
                  y={p.y - 8}
                  fill="#e5e7eb"
                  fontSize="8"
                  textAnchor="middle"
                  fontWeight="bold"
                >
                  {p.weight}
                </text>
                {/* Fecha en el eje X */}
                <text
                  x={p.x}
                  y={padY + chartH + 12}
                  fill="#9ca3af"
                  fontSize="7"
                  textAnchor="middle"
                >
                  {p.date.split('-').slice(1).join('/')}
                </text>
              </g>
            ))}
          </svg>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light flex items-center gap-2">
            <Users className="w-6 h-6 text-brand-red-600" /> Plantilla y Fichas de Jugadores
          </h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Historial de pesajes periódicos, observaciones de fisioterapia y estadísticas deportivas.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center bg-brand-black border border-brand-black-border rounded-lg p-0.5 mr-2">
            <button
              onClick={() => setViewMode('grid')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'grid' ? 'bg-brand-black-hover text-brand-gray-light' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
              title="Vista de Fichas"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'list' ? 'bg-brand-black-hover text-brand-gray-light' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
              title="Vista de Listado"
            >
              <ListIcon className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode('stats')}
              className={`p-1.5 rounded-md transition-colors ${viewMode === 'stats' ? 'bg-brand-black-hover text-brand-gray-light' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
              title="Vista de Estadísticas"
            >
              <BarChart2 className="w-4 h-4" />
            </button>
          </div>
          {canExport && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs" title="Exportar CSV">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs" title="Exportar PDF">
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

      {/* Buscador y Filtros */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-brand-black border border-brand-black-border p-4 rounded-xl">
        <div className="relative">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-brand-gray-dark" />
          <input
            type="text"
            className="form-input pl-10 w-full bg-brand-black-bg"
            placeholder="Buscar jugador..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            className="form-input w-full bg-brand-black-bg"
          >
            <option value="Todos">Todas las Posiciones</option>
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

        <div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-input w-full bg-brand-black-bg"
          >
            <option value="Todos">Todos los Estados Físicos</option>
            <option value="Disponible">Disponible</option>
            <option value="En duda">En duda</option>
            <option value="Lesionado">Lesionado</option>
            <option value="Baja">Baja</option>
          </select>
        </div>

        <div>
          <select
            value={filterCompetition}
            onChange={(e) => setFilterCompetition(e.target.value)}
            className="form-input w-full bg-brand-black-bg text-brand-red-600 font-bold border-brand-red-600/30 focus:border-brand-red-600 focus:ring-brand-red-600/20"
          >
            <option value="Todas">Todas las Competiciones</option>
            <option value="Liga">Liga</option>
            <option value="Copa">Copa</option>
            <option value="Amistoso">Amistoso</option>
          </select>
        </div>
      </div>

      {/* Layout Grid - Jugadores a la izquierda, detalle a la derecha si hay seleccionado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Listado de Jugadores */}
        <div className={`${selectedPlayer ? 'lg:col-span-5' : 'lg:col-span-8'} space-y-4`}>
          {isLoading ? (
            <TableSkeleton />
          ) : filteredPlayers.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No se encontraron fichas de jugadores.</p>
            </div>
          ) : viewMode === 'stats' ? (
            <div className="space-y-6">
              {/* Gráfica de Dispersión */}
              <div className="bg-brand-black border border-brand-black-border rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-brand-red-600" /> Comparativa de Dispersión
                  </h3>
                  <div className="flex gap-4">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-gray-muted">Eje X:</span>
                      <select value={scatterXAxis} onChange={e => setScatterXAxis(e.target.value as StatKey)} className="form-input py-1 text-xs min-w-[120px] bg-brand-black-bg">
                        <option value="minutes">Minutos</option>
                        <option value="goals">Goles</option>
                        <option value="assists">Asistencias</option>
                        <option value="starter">Partidos Titular</option>
                        <option value="called">Convocatorias</option>
                        <option value="conceded">Goles Encajados</option>
                      </select>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-brand-gray-muted">Eje Y:</span>
                      <select value={scatterYAxis} onChange={e => setScatterYAxis(e.target.value as StatKey)} className="form-input py-1 text-xs min-w-[120px] bg-brand-black-bg">
                        <option value="goals">Goles</option>
                        <option value="assists">Asistencias</option>
                        <option value="minutes">Minutos</option>
                        <option value="starter">Partidos Titular</option>
                        <option value="called">Convocatorias</option>
                        <option value="conceded">Goles Encajados</option>
                      </select>
                    </div>
                  </div>
                </div>
                <div className="h-80 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis type="number" dataKey={`stats.${scatterXAxis}`} name={scatterXAxis} stroke="#9ca3af" tick={{ fontSize: 12 }} />
                      <YAxis type="number" dataKey={`stats.${scatterYAxis}`} name={scatterYAxis} stroke="#9ca3af" tick={{ fontSize: 12 }} />
                      <RechartsTooltip cursor={{ strokeDasharray: '3 3' }} content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          const valX = data.stats[scatterXAxis];
                          const valY = data.stats[scatterYAxis];
                          
                          const matchingPlayers = rankings.filter((p: any) => p.stats[scatterXAxis] === valX && p.stats[scatterYAxis] === valY);

                          return (
                            <div className="bg-brand-black border border-brand-black-border p-3 rounded-lg shadow-xl max-w-[200px]">
                              <div className="text-[10px] mb-2 pb-2 border-b border-brand-black-border flex justify-between gap-2">
                                <p><span className="font-bold text-brand-red-400 capitalize">{scatterXAxis}:</span> {valX}</p>
                                <p><span className="font-bold text-brand-red-400 capitalize">{scatterYAxis}:</span> {valY}</p>
                              </div>
                              <div className="space-y-2 max-h-40 overflow-y-auto no-scrollbar pr-1">
                                {matchingPlayers.map((p: any) => (
                                  <div key={p.id} className="flex items-center gap-2">
                                    <div className="w-6 h-6 rounded-full overflow-hidden bg-brand-black-bg border border-brand-black-border shrink-0 flex items-center justify-center">
                                      {p.photo_url ? (
                                        <img src={p.photo_url} alt={p.nickname || p.full_name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-[8px] font-bold text-brand-gray-light">{p.dorsal || '?'}</span>
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <p className="font-bold text-white text-[11px] truncate leading-tight">{p.nickname || p.full_name}</p>
                                      <p className="text-brand-gray-muted text-[9px] leading-tight truncate">{p.position || 'Sin demarc.'}</p>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Scatter name="Jugadores" data={rankings} shape={(props: any) => {
                        const { cx, cy, payload } = props;
                        const displayName = payload.nickname || payload.full_name.split(' ')[0];
                        const dorsalStr = payload.dorsal ? `${payload.dorsal}` : '?';
                        const size = 32;
                        
                        return (
                          <g transform={`translate(${cx},${cy})`} className="cursor-pointer hover:scale-125 transition-transform" style={{ transformOrigin: 'center' }}>
                            {payload.photo_url ? (
                              <foreignObject x={-size/2} y={-size/2} width={size} height={size} style={{ overflow: 'visible' }}>
                                <div className="w-full h-full rounded-full overflow-hidden border-2 border-brand-red-600 shadow-lg bg-brand-black flex items-center justify-center relative">
                                  <img src={payload.photo_url} alt={displayName} className="w-full h-full object-cover" />
                                </div>
                              </foreignObject>
                            ) : (
                              <foreignObject x={-size/2} y={-size/2} width={size} height={size} style={{ overflow: 'visible' }}>
                                <div className="w-full h-full rounded-full overflow-hidden border-2 border-brand-red-600 shadow-lg bg-brand-black flex items-center justify-center">
                                  <span className="text-[11px] font-black text-brand-gray-light leading-none">{dorsalStr}</span>
                                </div>
                              </foreignObject>
                            )}
                          </g>
                        );
                      }} />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* Gráfica de Barras */}
              <div className="bg-brand-black border border-brand-black-border rounded-xl p-6">
                <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4 mb-6">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <BarChart2 className="w-5 h-5 text-brand-red-600" /> Clasificación de Jugadores
                  </h3>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-brand-gray-muted">Métrica:</span>
                    <select value={barMetric} onChange={e => setBarMetric(e.target.value as StatKey)} className="form-input py-1 text-xs min-w-[160px] bg-brand-black-bg">
                      <option value="goals">Goles</option>
                      <option value="assists">Asistencias</option>
                      <option value="minutes">Minutos Jugados</option>
                      <option value="starter">Partidos Titular</option>
                      <option value="called">Convocatorias</option>
                      <option value="yellow">Tarjetas Amarillas</option>
                      <option value="red">Tarjetas Rojas</option>
                      <option value="conceded">Goles Encajados</option>
                    </select>
                  </div>
                </div>
                <div className="h-[400px] w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={[...rankings].sort((a, b) => b.stats[barMetric] - a.stats[barMetric])} margin={{ top: 20, right: 30, left: 0, bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                      <XAxis dataKey="nickname" stroke="#9ca3af" tick={{ fontSize: 10 }} interval={0} angle={-45} textAnchor="end" />
                      <YAxis stroke="#9ca3af" tick={{ fontSize: 12 }} />
                      <RechartsTooltip cursor={{ fill: '#374151', opacity: 0.4 }} content={({ active, payload }) => {
                        if (active && payload && payload.length) {
                          const data = payload[0].payload;
                          return (
                            <div className="bg-brand-black border border-brand-black-border p-3 rounded-lg shadow-xl">
                              <p className="font-bold text-white text-sm">{data.nickname}</p>
                              <p className="mt-1 text-xs"><span className="font-bold text-brand-red-400 capitalize">{barMetric}:</span> {data.stats[barMetric]}</p>
                            </div>
                          );
                        }
                        return null;
                      }} />
                      <Bar dataKey={`stats.${barMetric}`} fill="#dc2626" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          ) : viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-2 gap-4">
              {filteredPlayers.map((player) => {
                const isSelected = selectedPlayer?.id === player.id;
                const statusColor = 
                  player.physical_status === 'Disponible' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' :
                  player.physical_status === 'En duda' ? 'bg-amber-950/20 text-amber-500 border border-amber-900/30' :
                  'bg-red-950/20 text-red-400 border border-red-900/30';
                
                return (
                  <div 
                    key={player.id} 
                    onClick={() => {
                      navigate(`/players/${player.id}`);
                    }}
                    className={`dashboard-card p-4 flex flex-col justify-between cursor-pointer border hover:border-brand-red-600/35 transition-all group border-brand-black-border`}
                  >
                    <div className="flex gap-3">
                      {/* Foto */}
                      <div className="w-12 h-12 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                        {player.photo_url ? (
                          <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                        ) : (
                          <Users className="w-6 h-6 text-brand-gray-dark" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          {player.dorsal && (
                            <span className="text-xs font-black text-brand-red-600 bg-brand-red-600/10 px-1.5 py-0.5 rounded leading-none shrink-0">
                              {player.dorsal}
                            </span>
                          )}
                          <h4 className="text-sm font-bold text-brand-gray-light truncate leading-tight group-hover:text-white transition-colors">
                            {player.nickname || player.full_name}
                          </h4>
                        </div>
                        {player.nickname && (
                          <span className="text-[10px] text-brand-gray-muted truncate block mt-0.5">
                            {player.full_name}
                          </span>
                        )}
                        <span className="text-[10px] text-brand-gray-muted block mt-1 uppercase font-semibold">
                          {player.position || 'Sin Demarcación'}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-4 border-t border-brand-black-border/40 pt-3">
                      {/* Estado */}
                      <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
                        {player.physical_status || 'Disponible'}
                      </span>

                      {/* Métricas breves */}
                      <span className="text-[10px] text-brand-gray-muted">
                        <span className="font-bold text-brand-gray-light">{player.stats?.goals || 0}</span> G / <span className="font-bold text-brand-gray-light">{player.stats?.assists || 0}</span> A
                      </span>
                    </div>

                    {/* Botones de Acción Rápida */}
                    {(canEdit || canDelete) && (
                      <div className="flex gap-1.5 mt-3 border-t border-brand-black-border/40 pt-3">
                        {canEdit && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenEditModal(player);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 p-1.5 text-xs text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-card border border-brand-black-border rounded transition-all"
                            title="Editar"
                          >
                            <Edit2 className="w-3 h-3" /> Editar
                          </button>
                        )}
                        {canDelete && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePlayer(player.id, player.full_name);
                            }}
                            className="flex-1 flex items-center justify-center gap-1.5 p-1.5 text-xs text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/5 border border-brand-black-border hover:border-brand-red-600/30 rounded transition-all"
                            title="Eliminar"
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
            <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-x-auto">
              <table className="w-full text-left text-sm text-brand-gray-light min-w-[800px]">
                <thead className="bg-brand-black-bg border-b border-brand-black-border text-xs uppercase text-brand-gray-muted">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Jugador</th>
                    <th className="px-4 py-3 font-semibold">Posición</th>
                    <th className="px-4 py-3 font-semibold text-center">Goles / Asist.</th>
                    <th className="px-4 py-3 font-semibold text-center">Estado</th>
                    {(canEdit || canDelete) && <th className="px-4 py-3 font-semibold text-right">Acciones</th>}
                  </tr>
                </thead>
                <tbody>
                  {filteredPlayers.map((player) => {
                    const isSelected = selectedPlayer?.id === player.id;
                    const statusColor = 
                      player.physical_status === 'Disponible' ? 'bg-emerald-950/20 text-emerald-400 border border-emerald-900/30' :
                      player.physical_status === 'En duda' ? 'bg-amber-950/20 text-amber-500 border border-amber-900/30' :
                      'bg-red-950/20 text-red-400 border border-red-900/30';

                    return (
                      <tr 
                        key={player.id}
                        onClick={() => navigate(`/players/${player.id}`)}
                        className="border-b border-brand-black-border/50 hover:bg-brand-black-hover transition-colors cursor-pointer group"
                      >
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                              {player.photo_url ? (
                                <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                              ) : (
                                <Users className="w-4 h-4 text-brand-gray-dark" />
                              )}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                {player.dorsal && (
                                  <span className="text-[10px] font-black text-brand-red-600 bg-brand-red-600/10 px-1 py-0.5 rounded leading-none">
                                    {player.dorsal}
                                  </span>
                                )}
                                <span className="font-bold text-sm text-brand-gray-light group-hover:text-white transition-colors">
                                  {player.nickname || player.full_name}
                                </span>
                              </div>
                              {player.nickname && (
                                <span className="text-[10px] text-brand-gray-muted block mt-0.5">
                                  {player.full_name}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs">
                          <span className="text-brand-gray-muted uppercase font-semibold text-[10px]">
                            {player.position || 'Sin Demarcación'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-xs text-center">
                          <span className="font-bold text-brand-gray-light">{player.stats?.goals || 0}</span> G / <span className="font-bold text-brand-gray-light">{player.stats?.assists || 0}</span> A
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full ${statusColor}`}>
                            {player.physical_status || 'Disponible'}
                          </span>
                        </td>
                        {(canEdit || canDelete) && (
                          <td className="px-4 py-3 text-right">
                            <div className="flex justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
                              {canEdit && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleOpenEditModal(player);
                                  }}
                                  className="p-1.5 text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-card border border-brand-black-border rounded transition-all"
                                  title="Editar"
                                >
                                  <Edit2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {canDelete && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeletePlayer(player.id, player.full_name);
                                  }}
                                  className="p-1.5 text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/5 border border-brand-black-border hover:border-brand-red-600/30 rounded transition-all"
                                  title="Eliminar"
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
          )}
        </div>

        {/* Panel de Rankings */}
        {!selectedPlayer && (
          <div className="lg:col-span-4 space-y-4">
            <div className="dashboard-card p-5 border-brand-red-600/20">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-brand-red-600" /> Rankings ({filterCompetition})
              </h3>
              
              <div className="space-y-6">
                {[
                  { title: 'Minutos Jugados', key: 'minutes', icon: Activity, asc: false, suffix: "'" },
                  { title: 'Partidos Titular', key: 'starter', icon: PlayCircle, asc: false },
                  { title: 'Convocatorias', key: 'called', icon: ListIcon, asc: false },
                  { title: 'Goles Marcados', key: 'goals', icon: Target, asc: false },
                  { title: 'Asistencias', key: 'assists', icon: Navigation, asc: false },
                  { title: 'Goles Encajados', key: 'conceded', icon: ShieldAlert, asc: true },
                  { title: 'Tarjetas Amarillas', key: 'yellow', icon: AlertTriangle, asc: true },
                  { title: 'Tarjetas Rojas', key: 'red', icon: ShieldAlert, asc: true },
                ].map(category => (
                  <div key={category.key}>
                    <h4 className="text-xs font-bold text-brand-gray-muted uppercase mb-2 flex items-center gap-1.5 border-b border-brand-black-border pb-1">
                      <category.icon className="w-3.5 h-3.5 text-brand-red-600" /> {category.title}
                    </h4>
                    <ul className="space-y-2">
                      {topPlayers(category.key as any, category.asc).map((p: any, idx) => (
                        <li key={p.id} className="flex items-center justify-between group">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-[10px] font-black text-brand-gray-dark w-3 text-right">{idx + 1}.</span>
                            {p.photo_url ? (
                              <img src={p.photo_url} alt={p.full_name} className="w-5 h-5 rounded-full object-cover shrink-0 border border-brand-black-border" />
                            ) : (
                              <div className="w-5 h-5 rounded-full bg-brand-black border border-brand-black-border flex items-center justify-center shrink-0">
                                <span className="text-[8px] text-brand-gray-muted font-bold">{p.nickname?.[0] || p.full_name[0]}</span>
                              </div>
                            )}
                            <span className="text-xs text-brand-gray-light font-medium truncate group-hover:text-brand-red-400 transition-colors cursor-pointer" onClick={(e) => { e.stopPropagation(); navigate(`/players/${p.id}`); }}>
                              {p.nickname || p.full_name.split(' ')[0]}
                            </span>
                          </div>
                          <span className="text-xs font-black text-white shrink-0 ml-2">
                            {p.stats[category.key]}{category.suffix || ''}
                          </span>
                        </li>
                      ))}
                      {topPlayers(category.key as any, category.asc).length === 0 && (
                        <li className="text-[10px] text-brand-gray-dark italic">No hay datos suficientes</li>
                      )}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Panel de Detalles del Jugador */}
        {selectedPlayer && (
          <div className="lg:col-span-7 dashboard-card p-6 border border-brand-red-600/20 flex flex-col justify-between space-y-6">
            
            {/* Header del Detalle */}
            <div className="flex justify-between items-start border-b border-brand-black-border pb-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 rounded-xl border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                  {selectedPlayer.photo_url ? (
                    <img src={selectedPlayer.photo_url} alt={selectedPlayer.full_name} className="w-full h-full object-cover" />
                  ) : (
                    <Users className="w-8 h-8 text-brand-gray-dark" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    {selectedPlayer.dorsal && (
                      <span className="text-sm font-black text-brand-red-600 bg-brand-red-600/10 px-2 py-0.5 rounded">
                        {selectedPlayer.dorsal}
                      </span>
                    )}
                    <h3 className="text-lg font-bold text-brand-gray-light">
                      {selectedPlayer.nickname || selectedPlayer.full_name}
                    </h3>
                  </div>
                  {selectedPlayer.nickname && (
                    <p className="text-xs text-brand-gray-muted mt-0.5">
                      Nombre completo: <span className="text-brand-gray-light font-medium">{selectedPlayer.full_name}</span>
                    </p>
                  )}
                  <p className="text-xs text-brand-gray-muted mt-1 uppercase font-semibold">
                    {selectedPlayer.position || 'Sin Demarcación'}
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <button 
                  onClick={() => handleExportPlayerReport(selectedPlayer)}
                  className="px-2.5 py-1.5 bg-brand-red-600/10 hover:bg-brand-red-600 text-brand-gray-light hover:text-white border border-brand-red-600/25 hover:border-brand-red-600 rounded transition-all flex items-center gap-1.5 text-xs font-semibold"
                  title="Exportar PDF de Ficha"
                >
                  <FileText className="w-3.5 h-3.5" /> PDF Ficha
                </button>
                {canEdit && (
                  <button 
                    onClick={() => handleOpenEditModal(selectedPlayer)}
                    className="p-1.5 hover:bg-brand-black-hover border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light rounded transition-all"
                    title="Editar Ficha"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                )}
                {canDelete && (
                  <button 
                    onClick={() => handleDeletePlayer(selectedPlayer.id, selectedPlayer.full_name)}
                    className="p-1.5 hover:bg-brand-red-600/10 border border-brand-black-border hover:border-brand-red-600/30 text-brand-gray-muted hover:text-brand-red-600 rounded transition-all"
                    title="Borrar Ficha"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button 
                  onClick={() => setSelectedPlayer(null)}
                  className="p-1.5 hover:bg-brand-black-hover border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light rounded transition-all"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Pestañas internas */}
            <div className="flex border-b border-brand-black-border/60">
              <button
                onClick={() => setDetailTab('ficha')}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all ${
                  detailTab === 'ficha' ? 'border-brand-red-600 text-brand-gray-light' : 'border-transparent text-brand-gray-muted'
                }`}
              >
                Ficha Técnica
              </button>
              <button
                onClick={() => setDetailTab('stats')}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all ${
                  detailTab === 'stats' ? 'border-brand-red-600 text-brand-gray-light' : 'border-transparent text-brand-gray-muted'
                }`}
              >
                Estadísticas
              </button>
              <button
                onClick={() => setDetailTab('peso')}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all ${
                  detailTab === 'peso' ? 'border-brand-red-600 text-brand-gray-light' : 'border-transparent text-brand-gray-muted'
                }`}
              >
                Control de Peso
              </button>
              <button
                onClick={() => setDetailTab('fisio')}
                className={`py-2 px-3 text-xs font-bold border-b-2 transition-all ${
                  detailTab === 'fisio' ? 'border-brand-red-600 text-brand-gray-light' : 'border-transparent text-brand-gray-muted'
                }`}
              >
                Fisioterapia / Control Físico
              </button>
            </div>

            {/* Contenido Pestañas */}
            <div className="flex-1 py-2">
              
              {/* FICHA TÉCNICA */}
              {detailTab === 'ficha' && (
                <div className="grid grid-cols-2 gap-4 text-left">
                  <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg">
                    <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Pie Dominante</span>
                    <span className="text-sm font-semibold text-brand-gray-light mt-1 block flex items-center gap-1.5">
                      <Activity className="w-3.5 h-3.5 text-brand-red-600" /> {selectedPlayer.dominant_foot || 'No definido'}
                    </span>
                  </div>
                  <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg">
                    <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Estatura</span>
                    <span className="text-sm font-semibold text-brand-gray-light mt-1 block flex items-center gap-1.5">
                      <Ruler className="w-3.5 h-3.5 text-brand-red-600" /> {selectedPlayer.height ? `${selectedPlayer.height} cm` : 'No definido'}
                    </span>
                  </div>
                  <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg">
                    <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Peso Actual</span>
                    <span className="text-sm font-semibold text-brand-gray-light mt-1 block flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-brand-red-600" /> {selectedPlayer.weight ? `${selectedPlayer.weight} kg` : 'No definido'}
                    </span>
                  </div>
                  <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg">
                    <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Fecha Nacimiento</span>
                    <span className="text-sm font-semibold text-brand-gray-light mt-1 block flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-brand-red-600" /> {selectedPlayer.birth_date || 'No definido'}
                    </span>
                  </div>
                  <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg">
                    <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Teléfono de Contacto</span>
                    <span className="text-sm font-semibold text-brand-gray-light mt-1 block flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-brand-red-600" /> {selectedPlayer.phone || 'No definido'}
                    </span>
                  </div>
                  <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg">
                    <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Correo Electrónico</span>
                    <span className="text-sm font-semibold text-brand-gray-light mt-1 block flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-brand-red-600" /> {selectedPlayer.email || 'No definido'}
                    </span>
                  </div>
                </div>
              )}

              {/* ESTADÍSTICAS */}
              {detailTab === 'stats' && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-left">
                    <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg text-center">
                      <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Partidos Jugados</span>
                      <span className="text-xl font-extrabold text-brand-gray-light mt-1 block">{selectedPlayer.matches_played}</span>
                    </div>
                    <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg text-center">
                      <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Minutos Jugados</span>
                      <span className="text-xl font-extrabold text-brand-gray-light mt-1 block">{selectedPlayer.minutes_played}'</span>
                    </div>
                    <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg text-center">
                      <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Goles Anotados</span>
                      <span className="text-xl font-extrabold text-emerald-500 mt-1 block">+{selectedPlayer.goals}</span>
                    </div>
                    <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg text-center">
                      <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Asistencias Clave</span>
                      <span className="text-xl font-extrabold text-indigo-400 mt-1 block">+{selectedPlayer.assists}</span>
                    </div>
                    <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg text-center">
                      <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Tarjetas Amarillas</span>
                      <span className="text-xl font-extrabold text-yellow-500 mt-1 block">{selectedPlayer.yellow_cards}</span>
                    </div>
                    <div className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg text-center">
                      <span className="text-[9px] text-brand-gray-muted uppercase font-bold block">Tarjetas Rojas</span>
                      <span className="text-xl font-extrabold text-brand-red-600 mt-1 block">{selectedPlayer.red_cards}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* CONTROL DE PESO */}
              {detailTab === 'peso' && (
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-gray-light">Histórico y Evolución del Peso</span>
                    {canEdit && (
                      <button 
                        onClick={() => setIsWeightModalOpen(true)}
                        className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1"
                      >
                        <Scale className="w-3.5 h-3.5" /> Registrar Control
                      </button>
                    )}
                  </div>
                  {isLoadingWeights ? (
                    <div className="text-center py-8 text-brand-gray-muted text-xs">Cargando historial de peso...</div>
                  ) : (
                    renderWeightChart()
                  )}
                </div>
              )}

              {/* FISIOTERAPIA */}
              {detailTab === 'fisio' && (
                <div className="space-y-4 text-left">
                  <div className="flex justify-between items-center">
                    <span className="text-xs font-bold text-brand-gray-light">Historial de Partes Médicos</span>
                    {canEdit && (
                      <button 
                        onClick={() => setIsPhysioModalOpen(true)}
                        className="btn-primary py-1 px-2.5 text-[10px] flex items-center gap-1"
                      >
                        <HeartPulse className="w-3.5 h-3.5" /> Nuevo Parte Fisio
                      </button>
                    )}
                  </div>
                  
                  {isLoadingPhysio ? (
                    <div className="text-center py-8 text-brand-gray-muted text-xs">Cargando historial médico...</div>
                  ) : physioRecords.length === 0 ? (
                    <div className="bg-brand-black/20 border border-dashed border-brand-black-border p-6 rounded-lg text-center text-xs text-brand-gray-muted italic">
                      No hay registros ni partes de fisioterapia cargados para este jugador.
                    </div>
                  ) : (
                    <div className="space-y-3 max-h-[220px] overflow-y-auto pr-1 no-scrollbar">
                      {physioRecords.map((rec) => {
                        const statusBadge = 
                          rec.status === 'Disponible' ? 'bg-emerald-950/20 text-emerald-400' :
                          rec.status === 'En duda' ? 'bg-amber-950/20 text-amber-500' :
                          'bg-red-950/20 text-red-400';
                        return (
                          <div key={rec.id} className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg space-y-1">
                            <div className="flex justify-between items-center border-b border-brand-black-border/30 pb-1.5 mb-1.5">
                              <span className="text-[10px] text-brand-gray-muted font-bold flex items-center gap-1">
                                <Calendar className="w-3 h-3" /> {rec.date}
                              </span>
                              <span className={`text-[8px] font-black uppercase px-2 py-0.5 rounded-full ${statusBadge}`}>
                                {rec.status}
                              </span>
                            </div>
                            <p className="text-xs text-brand-gray-light leading-normal">{rec.notes}</p>
                            {rec.treatment && (
                              <p className="text-[10px] text-emerald-400 mt-1 leading-normal italic">
                                🩺 Tratamiento: <span className="text-brand-gray-muted not-italic">{rec.treatment}</span>
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

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
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
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

      {/* =====================================================================
          MODAL AGREGAR PESO
          ===================================================================== */}
      <Modal
        isOpen={isWeightModalOpen}
        onClose={() => setIsWeightModalOpen(false)}
        title="Registrar Control de Peso"
      >
        <form onSubmit={handleAddWeightSubmit} className="space-y-4 text-left">
          <div>
            <label className="form-label">Fecha del Control</label>
            <input
              type="date"
              required
              className="form-input"
              value={weightDate}
              onChange={(e) => setWeightDate(e.target.value)}
            />
          </div>
          <div>
            <label className="form-label">Peso Registrado (kg)</label>
            <input
              type="number"
              step="0.1"
              required
              min="30"
              max="150"
              className="form-input"
              placeholder="72.5"
              value={newWeight}
              onChange={(e) => setNewWeight(e.target.value)}
            />
          </div>
          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={() => setIsWeightModalOpen(false)} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Registrar Control
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL AGREGAR PARTE FISIO
          ===================================================================== */}
      <Modal
        isOpen={isPhysioModalOpen}
        onClose={() => setIsPhysioModalOpen(false)}
        title="Nuevo Parte / Diagnóstico de Fisioterapia"
      >
        <form onSubmit={handleAddPhysioSubmit} className="space-y-4 text-left">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha del Parte</label>
              <input
                type="date"
                required
                className="form-input"
                value={physioDate}
                onChange={(e) => setPhysioDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Estado Físico del Jugador</label>
              <select
                className="form-input bg-brand-black"
                value={physioStatus}
                onChange={(e) => setPhysioStatus(e.target.value as any)}
              >
                <option value="Disponible">Disponible</option>
                <option value="En duda">En duda</option>
                <option value="Lesionado">Lesionado</option>
                <option value="Baja">Baja</option>
              </select>
            </div>
          </div>

          <div>
            <label className="form-label">Observaciones / Diagnóstico</label>
            <textarea
              required
              rows={3}
              className="form-input"
              placeholder="Ej. Sobrecarga muscular en el sóleo, dolor al tacto..."
              value={physioNotes}
              onChange={(e) => setPhysioNotes(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Tratamiento Planificado</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Terapia manual, crioterapia, readaptación..."
              value={physioTreatment}
              onChange={(e) => setPhysioTreatment(e.target.value)}
            />
          </div>

          <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
            <button type="button" onClick={() => setIsPhysioModalOpen(false)} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Parte
            </button>
          </div>
        </form>
      </Modal>

    </div>
  );
};
