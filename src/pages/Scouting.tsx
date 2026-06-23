import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { CardSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { ScoutingPlayer, TacticalPlayer, TacticalBoard, Team } from '../types';
import { FFCV_PLAYERS, FFCVPlayer } from '../services/ffcvPlayers';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  Search, Plus, Star, Edit2, Trash2, Download, FileText,
  MapPin, User, MessageSquare, Users, Layout, Save, RefreshCw,
  PlusCircle, Check, ChevronDown
} from 'lucide-react';
import logos from '../assets/logos.json';

const normalizeStr = (str: string): string => {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/[’‘´`’]/g, "'")
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .trim();
};

const getTeamLogo = (teamName: string): string => {
  const cleanName = teamName.replace('vs ', '').trim();
  const target = normalizeStr(cleanName);
  
  const matchKey = Object.keys(logos).find(key => normalizeStr(key) === target);
  if (matchKey) {
    return (logos as Record<string, string>)[matchKey];
  }
  return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
};

// Formaciones y sus coordenadas tácticas (X, Y en porcentajes 0-100 para campo vertical)
import { FORMATIONS_SLOTS } from '../utils/formations';

export const Scouting: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const pitchRef = useRef<HTMLDivElement>(null);
  const [activeSlotForSelection, setActiveSlotForSelection] = useState<number | null>(null);

  const canCreate = hasPermission('scouting', 'crear');
  const canEdit = hasPermission('scouting', 'editar');
  const canDelete = hasPermission('scouting', 'eliminar');
  const canExport = hasPermission('scouting', 'exportar');

  // Pestañas
  const [activeTab, setActiveTab] = useState<'wallet' | 'league' | 'pitch'>('wallet');

  // Filtros de Cartera
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<ScoutingPlayer | null>(null);

  // Campos formulario Cartera
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('');
  const [age, setAge] = useState('');
  const [position, setPosition] = useState('');
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState('');
  const [alternativePositions, setAlternativePositions] = useState('');
  const [phone, setPhone] = useState('');

  // Filtros de Liga
  const [leagueSearch, setLeagueSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<string>('all');
  const [competitionFilter, setCompetitionFilter] = useState<string>('all');
  const [selectedAcademies, setSelectedAcademies] = useState<string[]>([]);
  const [isAcademyDropdownOpen, setIsAcademyDropdownOpen] = useState(false);
  const [minConsecutiveFilter, setMinConsecutiveFilter] = useState<number>(0);
  const [clubsFilter, setClubsFilter] = useState<string>('all');
  const [minAgeFilter, setMinAgeFilter] = useState<number>(16);
  const [maxAgeFilter, setMaxAgeFilter] = useState<number>(40);
  const [minTitularidadFilter, setMinTitularidadFilter] = useState<number>(0);
  const [maxTitularidadFilter, setMaxTitularidadFilter] = useState<number>(100);
  const [minConvocatoriaFilter, setMinConvocatoriaFilter] = useState<number>(0);
  const [maxConvocatoriaFilter, setMaxConvocatoriaFilter] = useState<number>(100);
  const [minGolesMediaFilter, setMinGolesMediaFilter] = useState<number>(0);
  const [maxGolesMediaFilter, setMaxGolesMediaFilter] = useState<number>(1.5);

  // Estados de control para z-index dinámico de sliders de doble punto
  const [activeAgeSlider, setActiveAgeSlider] = useState<'min' | 'max'>('min');
  const [activeTitularidadSlider, setActiveTitularidadSlider] = useState<'min' | 'max'>('min');
  const [activeConvocatoriaSlider, setActiveConvocatoriaSlider] = useState<'min' | 'max'>('min');
  const [activeGolesSlider, setActiveGolesSlider] = useState<'min' | 'max'>('min');

  // Estados del Tablero Táctico
  const [boardFormation, setBoardFormation] = useState<string>('Libre');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedFieldPlayer, setSelectedFieldPlayer] = useState<TacticalPlayer | null>(null);
  const [isFieldPlayerModalOpen, setIsFieldPlayerModalOpen] = useState(false);
  const [fieldPlayerComment, setFieldPlayerComment] = useState('');
  const [fieldPlayerRating, setFieldPlayerRating] = useState<number>(3);
  const [fieldPlayerAltPos, setFieldPlayerAltPos] = useState<string>('');

  // Estados del Modal de Detalle de Jugador en Base de Datos
  const [selectedDbPlayer, setSelectedDbPlayer] = useState<ScoutingPlayer | null>(null);
  const [isDbPlayerModalOpen, setIsDbPlayerModalOpen] = useState(false);

  // Modales de asignación rápida en Campo
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [placementPlayer, setPlacementPlayer] = useState<{
    id: string;
    nombre: string;
    foto: string;
    team: string;
    posicion: string;
    posicion_abbr: string;
    dorsal: number;
  } | null>(null);
  const [placementComment, setPlacementComment] = useState('');

  // Query Cartera
  const { data: scoutingList = [], isLoading } = useQuery({
    queryKey: ['scouting'],
    queryFn: () => dataService.getScouting()
  });

  // Query Liga con Historial (solo cuando se abre la pestaña)
  const { data: leagueScoutingList = [] } = useQuery({
    queryKey: ['scoutingWithHistory'],
    queryFn: () => dataService.getScoutingWithHistory(),
    enabled: activeTab === 'league'
  });

  // Tablero Táctico
  const { data: tacticalBoard } = useQuery<TacticalBoard>({
    queryKey: ['tacticalBoard'],
    queryFn: () => dataService.getTacticalBoard()
  });

  // Query Equipos
  const { data: dbTeams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: () => dataService.getTeams()
  });

  // Redefinición local de getTeamLogo para usar los escudos de la base de datos
  const getTeamLogo = (teamName: string): string => {
    const cleanName = teamName.replace('vs ', '').trim();
    const target = normalizeStr(cleanName);
    
    // 1. Buscar en los equipos de la base de datos
    const dbTeam = dbTeams.find(t => normalizeStr(t.name) === target);
    if (dbTeam?.shield_url) {
      return dbTeam.shield_url;
    }
    
    // 2. Buscar en logos.json
    const matchKey = Object.keys(logos).find(key => normalizeStr(key) === target);
    if (matchKey) {
      return (logos as Record<string, string>)[matchKey];
    }
    // 3. Fallback
    return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
  };

  // Estado local para los jugadores colocados en el campo táctico (campograma)
  const [boardPlayers, setBoardPlayers] = useState<TacticalPlayer[]>([]);
  const boardPlayersRef = useRef<TacticalPlayer[]>(boardPlayers);
  const hasDraggedRef = useRef<boolean>(false);

  useEffect(() => {
    boardPlayersRef.current = boardPlayers;
  }, [boardPlayers]);

  useEffect(() => {
    if (scoutingList && scoutingList.length > 0) {
      const placed = scoutingList
        .filter(p => p.x !== null && p.x !== undefined && p.y !== null && p.y !== undefined)
        .map(p => ({
          id: p.id,
          nombre: p.player_name,
          foto: p.photo_url || '',
          team: p.team,
          posicion: p.position,
          posicion_abbr: p.position ? p.position.substring(0, 3).toUpperCase() : 'JC',
          dorsal: p.dorsal || 0,
          x: p.x!,
          y: p.y!,
          comment: p.comment || '',
          rating: p.rating,
          alternative_positions: p.alternative_positions || ''
        }));
      setBoardPlayers(placed);
    }
    const savedFormation = localStorage.getItem('ud_atzeneta_tactical_formation');
    if (savedFormation) {
      setBoardFormation(savedFormation);
    }
  }, [scoutingList]);

  // Mutaciones Cartera
  const createMutation = useMutation({
    mutationFn: (item: Omit<ScoutingPlayer, 'id'>) => dataService.createScouting(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Candidato agregado', 'Se ha registrado el perfil de scouting.');
      handleCloseModal();
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<ScoutingPlayer> }) => dataService.updateScouting(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Perfil actualizado', 'Se guardaron las modificaciones del candidato.');
      handleCloseModal();
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteScouting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Perfil eliminado', 'Se ha retirado al jugador de la lista.');
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  // Mutación Tablero Táctico
  const saveBoardMutation = useMutation({
    mutationFn: (board: TacticalBoard) => dataService.saveTacticalBoard(board),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tacticalBoard'] });
      showToast('success', 'Campograma guardado', 'La alineación y los comentarios tácticos se guardaron con éxito.');
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  // Drag and Drop (Mouse / Touch)
  const handleMouseDown = (e: React.MouseEvent, playerId: string) => {
    e.preventDefault();
    hasDraggedRef.current = false;
    setActiveDragId(playerId);
  };

  const handleTouchStart = (_e: React.TouchEvent, playerId: string) => {
    hasDraggedRef.current = false;
    setActiveDragId(playerId);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDragId || !pitchRef.current) return;
      hasDraggedRef.current = true;

      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Mantener dentro del campo
      x = Math.max(3, Math.min(97, x));
      y = Math.max(3, Math.min(97, y));

      setBoardPlayers(prev =>
        prev.map(p => (p.id === activeDragId ? { ...p, x: Math.round(x), y: Math.round(y) } : p))
      );
      setBoardFormation('Libre');
    };

    const handleMouseUp = () => {
      if (activeDragId) {
        const dragged = boardPlayersRef.current.find(p => p.id === activeDragId);
        if (dragged) {
          updateMutation.mutate({
            id: activeDragId,
            item: { x: dragged.x, y: dragged.y }
          });
        }
      }
      setActiveDragId(null);
    };

    if (activeDragId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDragId]);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!activeDragId || !pitchRef.current) return;
      hasDraggedRef.current = true;

      const touch = e.touches[0];
      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((touch.clientX - rect.left) / rect.width) * 100;
      let y = ((touch.clientY - rect.top) / rect.height) * 100;

      x = Math.max(3, Math.min(97, x));
      y = Math.max(3, Math.min(97, y));

      setBoardPlayers(prev =>
        prev.map(p => (p.id === activeDragId ? { ...p, x: Math.round(x), y: Math.round(y) } : p))
      );
      setBoardFormation('Libre');
    };

    const handleTouchEnd = () => {
      if (activeDragId) {
        const dragged = boardPlayersRef.current.find(p => p.id === activeDragId);
        if (dragged) {
          updateMutation.mutate({
            id: activeDragId,
            item: { x: dragged.x, y: dragged.y }
          });
        }
      }
      setActiveDragId(null);
    };

    if (activeDragId) {
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeDragId]);

  // Formulario Cartera
  const handleOpenCreateModal = () => {
    setEditingPlayer(null);
    setPlayerName('');
    setTeam('');
    setAge('22');
    setPosition('Extremo Derecho');
    setRating(3);
    setNotes('');
    setAlternativePositions('');
    setPhone('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: ScoutingPlayer) => {
    setEditingPlayer(p);
    setPlayerName(p.player_name || '');
    setTeam(p.team || '');
    setAge(String(p.age || ''));
    setPosition(p.position || '');
    setRating(p.rating || 3);
    setNotes(p.notes || '');
    setAlternativePositions(p.alternative_positions || '');
    setPhone(p.phone || '');
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName || !playerName.trim()) {
      showToast('error', 'Validación', 'El nombre del jugador es obligatorio.');
      return;
    }
    if (!team || !team.trim()) {
      showToast('error', 'Validación', 'El club de procedencia es obligatorio.');
      return;
    }
    if (!position || !position.trim()) {
      showToast('error', 'Validación', 'La demarcación o posición es obligatoria.');
      return;
    }

    const payload = {
      player_name: playerName.trim(),
      team: team.trim(),
      age: age ? Number(age) : 0,
      position: position.trim(),
      rating,
      notes: (notes || '').trim(),
      alternative_positions: (alternativePositions || '').trim(),
      phone: (phone || '').trim()
    };

    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, item: payload });
    } else {
      createMutation.mutate({ ...payload, in_wallet: true } as Omit<ScoutingPlayer, 'id'>);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este jugador de la lista de scouting?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filtrado Cartera
  const walletList = scoutingList.filter(p => p.in_wallet === true || (!p.season && p.in_wallet !== false));
  const filteredList = walletList.filter(p => {
    const term = normalizeStr(search);
    return (
      normalizeStr(p.player_name).includes(term) ||
      normalizeStr(p.team).includes(term) ||
      normalizeStr(p.position).includes(term)
    );
  });

  // Fuente de datos de la Liga (usa leagueScoutingList con historial cuando está disponible)
  const leagueSource = leagueScoutingList.length > 0 ? leagueScoutingList : scoutingList;

  // Equipos únicos de la liga (todos los equipos con datos de scouting)
  const uniqueTeams = Array.from(
    new Set(
      leagueSource
        .map(p => p.team)
        .filter(Boolean)
    )
  ).sort();

  // Competiciones únicas de la liga
  const uniqueCompetitions = Array.from(
    new Set(
      leagueSource
        .filter(p => p.season || p.competition)
        .map(p => p.competition)
        .filter(Boolean)
    )
  ).sort();

  const cleanPercent = (val: string | number | undefined): string => {
    if (val === undefined || val === null || val === '') return '—';
    const str = String(val).trim();
    if (str.includes('%')) return str;
    if (!isNaN(Number(str))) return `${Math.round(Number(str))}%`;
    return str;
  };

  // Auxiliares para filtrado de historial de clubes
  const getMaxConsecutiveYears = (history: any[] | undefined): number => {
    if (!history || history.length === 0) return 0;
    const sorted = [...history].sort((a, b) => (a.temporada || '').localeCompare(b.temporada || ''));
    let maxStreak = 0;
    let currentStreak = 0;
    let currentTeam = '';
    
    for (const h of sorted) {
      if (!h.equipo) continue;
      const team = h.equipo.trim().toLowerCase();
      if (team === currentTeam) {
        currentStreak++;
      } else {
        if (currentStreak > maxStreak) maxStreak = currentStreak;
        currentTeam = team;
        currentStreak = 1;
      }
    }
    if (currentStreak > maxStreak) maxStreak = currentStreak;
    return maxStreak;
  };

  const getUniqueClubsCount = (history: any[] | undefined): number => {
    if (!history || history.length === 0) return 0;
    const clubs = new Set(history.map(h => h.equipo?.trim().toLowerCase()).filter(Boolean));
    return clubs.size;
  };

  const parsePercent = (val: string | number | undefined): number => {
    if (val === undefined || val === null || val === '') return 0;
    const match = String(val).match(/\d+/);
    return match ? Number(match[0]) : 0;
  };

  // Filtrado de la Liga
  const filteredLeaguePlayers = leagueSource
    .filter(p => p.season || p.competition)
    .filter(p => {
      const term = normalizeStr(leagueSearch);
      const matchesSearch =
        normalizeStr(p.player_name).includes(term) ||
        normalizeStr(p.team).includes(term) ||
        normalizeStr(p.position).includes(term);

      const matchesTeam =
        teamFilter === 'all' || normalizeStr(p.team) === normalizeStr(teamFilter);

      const matchesCompetition =
        competitionFilter === 'all' || normalizeStr(p.competition || '') === normalizeStr(competitionFilter);

      let matchesAcademy = true;
      if (selectedAcademies.length > 0) {
        if (!p.scouting_player_history || p.scouting_player_history.length === 0) {
          matchesAcademy = false;
        } else {
          matchesAcademy = p.scouting_player_history.some(h => {
            if (!h.equipo) return false;
            const name = h.equipo.toLowerCase().trim();
            return selectedAcademies.some(academy => {
              if (academy === 'roda') return name.includes('roda');
              if (academy === 'castellon') {
                const hasCastellon = name.includes('castellon') || name.includes('castellón');
                const isCastellonense = name.includes('castellonense');
                const isCD = name.includes('c.d.') || name.includes('cd ') || name.includes('cd.') || name.includes('c. d.');
                return hasCastellon && !isCastellonense && (isCD || name === 'castellon' || name === 'castellón');
              }
              if (academy === 'primertoque') return name.includes('primer toque');
              if (academy === 'villarreal') return name.includes('villarreal');
              return false;
            });
          });
        }
      }

      const consecutiveYears = getMaxConsecutiveYears(p.scouting_player_history);
      const matchesConsecutive = minConsecutiveFilter === 0 || consecutiveYears >= minConsecutiveFilter;

      // Filter by Age Range
      const matchesAge = !p.age || (p.age >= minAgeFilter && p.age <= maxAgeFilter);

      // Filter by Titularidad Range
      const titularidadVal = parsePercent(p.titularidad);
      const matchesTitularidad = titularidadVal >= minTitularidadFilter && titularidadVal <= maxTitularidadFilter;

      // Filter by Convocatoria Range
      const convocatoriaVal = parsePercent(p.participacion);
      const matchesConvocatoria = convocatoriaVal >= minConvocatoriaFilter && convocatoriaVal <= maxConvocatoriaFilter;

      // Filter by Goals Average Range
      const goalsAvgVal = p.goles_partido ?? p.media_goles ?? 0;
      const matchesGoalsAvg = goalsAvgVal >= minGolesMediaFilter && goalsAvgVal <= maxGolesMediaFilter;

      // Filter by Unique Clubs Count
      const uniqueClubsCount = getUniqueClubsCount(p.scouting_player_history);
      let matchesClubsCount = true;
      if (clubsFilter !== 'all') {
        if (clubsFilter === '1') matchesClubsCount = uniqueClubsCount === 1;
        else if (clubsFilter === 'max2') matchesClubsCount = uniqueClubsCount <= 2;
        else if (clubsFilter === 'max3') matchesClubsCount = uniqueClubsCount <= 3;
        else if (clubsFilter === 'min2') matchesClubsCount = uniqueClubsCount >= 2;
        else if (clubsFilter === 'min3') matchesClubsCount = uniqueClubsCount >= 3;
      }

      return matchesSearch && matchesTeam && matchesCompetition && matchesAcademy && matchesConsecutive && matchesAge && matchesTitularidad && matchesConvocatoria && matchesGoalsAvg && matchesClubsCount;
    });

  // Métodos de asignación al Campograma
  const handleOpenAssignModal = (player: any) => {
    setPlacementPlayer({
      id: player.id,
      nombre: player.nombre || player.player_name,
      foto: player.foto || player.photo_url || '',
      team: player.equipo || player.team,
      posicion: player.posicion || player.position,
      posicion_abbr: player.posicion_abbr || (player.position ? player.position.substring(0, 3).toUpperCase() : 'JC'),
      dorsal: player.dorsal || 0
    });
    setPlacementComment('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmPlacement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placementPlayer) return;

    // Verificar si ya está en el campo
    const exists = boardPlayers.some(p => p.id === placementPlayer.id);
    if (exists) {
      showToast('info', 'Campograma', 'Este jugador ya está en el campograma. Puedes arrastrarlo para cambiar su posición.');
      setIsAssignModalOpen(false);
      return;
    }

    // Posición inicial por defecto según su rol
    let initX = 50;
    let initY = 50;

    const role = placementPlayer.posicion_abbr;
    if (role === 'P') { initX = 50; initY = 88; }
    else if (['DFC', 'DF'].includes(role)) { initX = 50; initY = 70; }
    else if (role === 'LD') { initX = 80; initY = 68; }
    else if (role === 'LI') { initX = 20; initY = 68; }
    else if (['MC', 'MCD', 'MCO'].includes(role)) { initX = 50; initY = 46; }
    else if (role === 'MD') { initX = 80; initY = 44; }
    else if (role === 'MI') { initX = 20; initY = 44; }
    else if (role === 'ED') { initX = 78; initY = 22; }
    else if (role === 'EI') { initX = 22; initY = 22; }
    else if (role === 'DC') { initX = 50; initY = 16; }

    const newTacticalPlayer: TacticalPlayer = {
      ...placementPlayer,
      x: initX,
      y: initY,
      comment: placementComment.trim()
    };

    // Actualizar inmediatamente en el servidor para evitar pérdidas al refrescar consulta
    updateMutation.mutate({
      id: placementPlayer.id,
      item: {
        x: initX,
        y: initY,
        comment: placementComment.trim()
      }
    });

    const updatedPlayers = [...boardPlayers, newTacticalPlayer];
    setBoardPlayers(updatedPlayers);
    setBoardFormation('Libre');
    setIsAssignModalOpen(false);
    showToast('success', 'Añadido al campo', `${placementPlayer.nombre} ha sido posicionado. Ve a la pestaña Tablero Táctico.`);
  };

  // Alternar estado de favorito para un jugador
  const handleToggleFavorite = (lp: ScoutingPlayer) => {
    const nextState = !lp.in_wallet;
    updateMutation.mutate({
      id: lp.id,
      item: { in_wallet: nextState }
    });
    if (selectedDbPlayer && selectedDbPlayer.id === lp.id) {
      setSelectedDbPlayer({ ...selectedDbPlayer, in_wallet: nextState });
    }
  };

  // Modificar formación táctica
  const handleFormationChange = (formation: string) => {
    setBoardFormation(formation);
    if (formation === 'Libre') return;

    const slots = FORMATIONS_SLOTS[formation];
    if (!slots) return;

    // Clasificar jugadores colocados para organizarlos de manera lógica
    const sorted = [...boardPlayers].sort((a, b) => {
      const getScore = (p: TacticalPlayer) => {
        if (p.posicion_abbr === 'P' || p.posicion.includes('Portero')) return 0;
        if (['DFC', 'LD', 'LI', 'DF'].includes(p.posicion_abbr) || p.posicion.includes('Defensa') || p.posicion.includes('Lateral') || p.posicion.includes('Central')) return 1;
        if (['MC', 'MD', 'MI', 'ED', 'EI', 'MCO', 'MCD', 'VOL'].includes(p.posicion_abbr) || p.posicion.includes('Medio') || p.posicion.includes('Extremo') || p.posicion.includes('Volante') || p.posicion.includes('Pivote')) return 2;
        return 3;
      };
      return getScore(a) - getScore(b);
    });

    const repositioned = sorted.map((p, idx) => {
      if (idx < slots.length) {
        return {
          ...p,
          x: slots[idx].x,
          y: slots[idx].y
        };
      }
      return p;
    });

    setBoardPlayers(repositioned);
  };

  // Limpiar tablero táctico
  const handleClearBoard = () => {
    if (window.confirm('¿Deseas retirar a todos los jugadores del campograma?')) {
      setBoardPlayers([]);
      setBoardFormation('Libre');
    }
  };

  // Guardar alineación táctica
  const handleSaveBoard = async () => {
    localStorage.setItem('ud_atzeneta_tactical_formation', boardFormation);

    try {
      for (const player of boardPlayers) {
        await dataService.updateScouting(player.id, {
          x: player.x,
          y: player.y,
          comment: player.comment
        });
      }

      const removedPlayers = scoutingList.filter(p => (p.x !== null && p.x !== undefined) && !boardPlayers.some(bp => bp.id === p.id));
      for (const player of removedPlayers) {
        await dataService.updateScouting(player.id, {
          x: null,
          y: null
        });
      }

      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Campograma guardado', 'La alineación y los comentarios tácticos se guardaron con éxito.');
    } catch (err: any) {
      showToast('error', 'Error', 'No se pudo guardar la alineación: ' + err.message);
    }
  };

  // Editar jugador del campograma
  const handleFieldPlayerClick = (p: TacticalPlayer) => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    const dbPlayer = scoutingList.find(sp => sp.id === p.id) || p;
    setSelectedFieldPlayer(p);
    setFieldPlayerComment(dbPlayer.comment || '');
    setFieldPlayerRating(dbPlayer.rating || 3);
    setFieldPlayerAltPos(dbPlayer.alternative_positions || '');
    setIsFieldPlayerModalOpen(true);
  };

  const handleSaveFieldPlayerComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldPlayer) return;

    const updated = boardPlayers.map(p =>
      p.id === selectedFieldPlayer.id
        ? {
            ...p,
            comment: fieldPlayerComment.trim(),
            rating: fieldPlayerRating,
            alternative_positions: fieldPlayerAltPos.trim()
          }
        : p
    );
    setBoardPlayers(updated);

    updateMutation.mutate({
      id: selectedFieldPlayer.id,
      item: {
        comment: fieldPlayerComment.trim(),
        rating: fieldPlayerRating,
        alternative_positions: fieldPlayerAltPos.trim()
      }
    });
  };

  const handleRemoveFromField = (id: string) => {
    // Actualizar inmediatamente en el servidor para evitar que resurja al refrescar consulta
    updateMutation.mutate({
      id,
      item: {
        x: null,
        y: null
      }
    });

    setBoardPlayers(prev => prev.filter(p => p.id !== id));
    setIsFieldPlayerModalOpen(false);
    showToast('success', 'Retirado', 'Jugador retirado del campograma.');
  };

  const handleOpenDbPlayerModal = (player: ScoutingPlayer) => {
    setSelectedDbPlayer(player);
    setIsDbPlayerModalOpen(true);
  };

  // Exportar Cartera
  const exportHeaders = ['Jugador', 'Equipo', 'Edad', 'Posición', 'Valoración', 'Notas'];
  const buildExportRows = (): ExportCell[][] =>
    filteredList.map(p => [
      p.player_name,
      p.team,
      p.age,
      p.position,
      `${p.rating}/5`,
      p.notes,
    ]);

  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      showToast('info', 'Exportar', 'No hay candidatos en la lista para exportar.');
      return;
    }
    exportToCSV(`scouting_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Exportada la cartera de scouting.');
  };

  const handleExportPDF = async () => {
    if (filteredList.length === 0) {
      showToast('info', 'Exportar', 'No hay candidatos en la lista para exportar.');
      return;
    }
    await exportToPDF('Scouting UD Atzeneta', `scouting_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Exportada la cartera de scouting en PDF.');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Cartera de Scouting y Táctica</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Fichas de candidatos, base de datos de la liga y campograma interactivo para diseño de alineaciones.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canExport && activeTab === 'wallet' && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canCreate && activeTab === 'wallet' && (
            <button onClick={handleOpenCreateModal} className="btn-primary py-2 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Registrar Candidato
            </button>
          )}
          {activeTab === 'pitch' && (
            <button
              onClick={handleSaveBoard}
              disabled={saveBoardMutation.isPending}
              className="btn-primary py-2 text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" /> {saveBoardMutation.isPending ? 'Guardando...' : 'Guardar Alineación'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-black-border flex gap-1">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'wallet'
              ? 'border-brand-red-600 text-brand-gray-light bg-brand-black-card/30'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <User className="w-4 h-4" /> Favoritos
        </button>
        <button
          onClick={() => setActiveTab('league')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'league'
              ? 'border-brand-red-600 text-brand-gray-light bg-brand-black-card/30'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <Users className="w-4 h-4" /> Base de Datos
        </button>
        <button
          onClick={() => setActiveTab('pitch')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'pitch'
              ? 'border-brand-red-600 text-brand-gray-light bg-brand-black-card/30'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <Layout className="w-4 h-4" /> Campograma
        </button>
      </div>

      {/* =====================================================================
          TAB 1: CARTERA DE SCOUTING
          ===================================================================== */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          {/* Buscador */}
          <div className="relative bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <Search className="absolute left-7 top-6.5 w-4 h-4 text-brand-gray-dark" />
            <input
              type="text"
              className="form-input pl-10 w-full"
              placeholder="Buscar por nombre, club o demarcación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Listado de Jugadores */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No se registran candidatos en la base de datos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredList.map((player) => (
                <div
                  key={player.id}
                  className="dashboard-card flex flex-col justify-between hover:scale-[1.005] hover:shadow-glow-red/5 transition-all duration-200"
                >
                  <div className="cursor-pointer" onClick={() => handleOpenDbPlayerModal(player)}>
                    {/* Cabecera Ficha */}
                    <div className="flex justify-between items-start border-b border-brand-black-border pb-3 mb-3">
                      <div className="flex gap-3">
                        <div className="w-12 h-12 bg-brand-black rounded-lg border border-brand-black-border overflow-hidden shrink-0 flex items-center justify-center">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={player.player_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-brand-gray-dark" />
                          )}
                        </div>
                        <div>
                          <h3 className="text-base font-bold text-brand-gray-light">{player.player_name}</h3>
                          <span className="text-[10px] bg-brand-red-600/10 text-brand-red-600 px-2 py-0.5 rounded font-semibold inline-block mt-1">
                            {player.position}
                          </span>
                        </div>
                      </div>

                      {/* Valoración Estrellas */}
                      <div className="flex gap-0.5 text-yellow-500">
                        {Array.from({ length: 5 }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            className={`w-4 h-4 ${sIdx < player.rating ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Info Rápida */}
                    <div className="text-xs text-brand-gray-muted mb-3 bg-brand-black/30 p-2.5 rounded-lg border border-brand-black-border/50 space-y-1.5">
                      <div className="flex items-start gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-brand-red-600 shrink-0 mt-0.5" />
                        <div>
                          <span className="text-brand-gray-light font-medium block">{player.team}</span>
                          {player.competition && <span className="text-[10px] text-brand-gray-dark block leading-tight">{player.competition}</span>}
                        </div>
                      </div>
                      <div className="flex items-center justify-between border-t border-brand-black-border/20 pt-1.5">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-brand-red-600 shrink-0" />
                          <span>{player.age ? `${player.age} años` : 'Edad desconocida'}</span>
                        </div>
                        {player.phone && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cleanNum = player.phone!.replace(/\D/g, '');
                              const formattedNum = cleanNum.startsWith('34') ? cleanNum : `34${cleanNum}`;
                              window.open(`https://wa.me/${formattedNum}`, '_blank');
                            }}
                            className="flex items-center gap-1 text-[10px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-950/20 border border-emerald-900/35 px-2 py-0.5 rounded transition-colors"
                          >
                            💬 WhatsApp
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Estadísticas FFCV (Jugados, Convocatorias y %s limpios) */}
                    <div className="grid grid-cols-5 gap-0.5 text-[9px] text-brand-gray-muted bg-brand-black/20 p-2 rounded mb-3 border border-brand-black-border/40">
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">Jugados</span>
                        <span className="text-brand-gray-light font-bold text-xs">{player.jugados ?? 0}</span>
                      </div>
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">Convoc.</span>
                        <span className="text-brand-gray-light font-bold text-xs">{player.convocados ?? 0}</span>
                      </div>
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">% Conv.</span>
                        <span className="text-brand-gray-light font-bold text-xs">
                          {cleanPercent(player.participacion)}
                        </span>
                      </div>
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">% Tit.</span>
                        <span className="text-brand-gray-light font-bold text-xs">
                          {cleanPercent(player.titularidad)}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">Goles</span>
                        <span className="text-brand-red-600 font-bold text-xs">{player.goles ?? 0}</span>
                      </div>
                    </div>

                    {/* Otras posiciones y comentarios */}
                    {player.alternative_positions && (
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] uppercase font-semibold text-brand-gray-muted flex items-center gap-1">
                          ⚡ Otras posiciones posibles
                        </span>
                        <p className="text-xs text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-2.5 rounded border border-brand-black-border">
                          {player.alternative_positions}
                        </p>
                      </div>
                    )}

                    {player.comment && (
                      <div className="space-y-1.5 mb-3">
                        <span className="text-[10px] uppercase font-semibold text-brand-gray-muted flex items-center gap-1">
                          📋 Comentario táctico (Campo)
                        </span>
                        <p className="text-xs text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-2.5 rounded border border-brand-black-border italic">
                          {player.comment}
                        </p>
                      </div>
                    )}


                    {/* Notas de scouting */}
                    {player.notes && (
                      <div className="space-y-1.5 mb-4">
                        <span className="text-[10px] uppercase font-semibold text-brand-gray-muted flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-brand-red-600" /> Notas de Seguimiento
                        </span>
                        <p className="text-xs text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-2.5 rounded border border-brand-black-border">
                          {player.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones de Tarjeta */}
                  <div className="flex justify-between items-center border-t border-brand-black-border pt-3 mt-4">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenAssignModal(player); }}
                      className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 px-3 py-1.5 rounded-lg hover:bg-emerald-900/30 flex items-center gap-1 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Posicionar en Campo
                    </button>

                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleOpenEditModal(player); }}
                          className="text-xs text-brand-gray-muted bg-brand-black-bg border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-brand-gray-light flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={(e) => { e.stopPropagation(); handleDelete(player.id); }}
                          className="text-xs text-brand-gray-muted bg-brand-black-bg border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-brand-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: BASE DE DATOS DE LA LIGA (FFCV)
          ===================================================================== */}
      {activeTab === 'league' && (
        <div className="space-y-6">
          {/* Panel de Filtros */}
          <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <div className="grid grid-cols-1 md:grid-cols-6 gap-3">
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
                <input
                  type="text"
                  className="form-input pl-9 w-full"
                  placeholder="Buscar por nombre, equipo..."
                  value={leagueSearch}
                  onChange={(e) => setLeagueSearch(e.target.value)}
                />
              </div>

              <div>
                <select
                  className="form-input w-full"
                  value={teamFilter}
                  onChange={(e: any) => setTeamFilter(e.target.value)}
                >
                  <option value="all">Todos los Equipos</option>
                  {uniqueTeams.map(team => (
                    <option key={team} value={team}>{team}</option>
                  ))}
                </select>
              </div>

              <div>
                <select
                  className="form-input w-full"
                  value={competitionFilter}
                  onChange={(e) => setCompetitionFilter(e.target.value)}
                >
                  <option value="all">Todas las Competiciones</option>
                  {uniqueCompetitions.map(comp => (
                    <option key={comp} value={comp}>{comp}</option>
                  ))}
                </select>
              </div>

              <div>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsAcademyDropdownOpen(!isAcademyDropdownOpen)}
                  className="form-input w-full text-left flex justify-between items-center text-xs truncate bg-brand-black border border-brand-black-border hover:bg-brand-black-card/30 text-brand-gray-light"
                >
                  <span className="truncate">
                    {selectedAcademies.length === 0
                      ? 'Todas las Canteras'
                      : [
                          { id: 'villarreal', name: 'Villarreal C.F.' },
                          { id: 'roda', name: 'C.D. Roda' },
                          { id: 'castellon', name: 'C.D. Castellón' },
                          { id: 'primertoque', name: 'Primer Toque C.F.' }
                        ]
                          .filter(o => selectedAcademies.includes(o.id))
                          .map(o => o.name.replace(' C.F.', '').replace(' C.D.', ''))
                          .join(', ')}
                  </span>
                  <ChevronDown className="w-3.5 h-3.5 ml-2 text-brand-gray-dark shrink-0" />
                </button>

                {isAcademyDropdownOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-10"
                      onClick={() => setIsAcademyDropdownOpen(false)}
                    />
                    <div className="absolute left-0 mt-1 w-full bg-brand-black border border-brand-black-border rounded-lg shadow-xl py-1.5 z-20 max-h-60 overflow-y-auto">
                      {[
                        { id: 'villarreal', name: 'Villarreal C.F.' },
                        { id: 'roda', name: 'C.D. Roda' },
                        { id: 'castellon', name: 'C.D. Castellón' },
                        { id: 'primertoque', name: 'Primer Toque C.F.' }
                      ].map(opt => {
                        const isChecked = selectedAcademies.includes(opt.id);
                        return (
                          <label
                            key={opt.id}
                            className="flex items-center gap-2 px-3 py-1.5 hover:bg-brand-black-card/50 cursor-pointer text-xs text-brand-gray-light select-none"
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                if (isChecked) {
                                  setSelectedAcademies(selectedAcademies.filter(id => id !== opt.id));
                                } else {
                                  setSelectedAcademies([...selectedAcademies, opt.id]);
                                }
                              }}
                              className="rounded border-brand-black-border text-brand-red-600 focus:ring-brand-red-600/30 bg-brand-black-bg"
                            />
                            <span>{opt.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              </div>

              <div>
                <select
                  className="form-input w-full"
                  value={minConsecutiveFilter}
                  onChange={(e) => setMinConsecutiveFilter(Number(e.target.value))}
                >
                  <option value={0}>Todos los años seguidos</option>
                  <option value={2}>Mín. 2 años seguidos</option>
                  <option value={3}>Mín. 3 años seguidos</option>
                  <option value={4}>Mín. 4 años seguidos</option>
                  <option value={5}>Mín. 5 años seguidos</option>
                </select>
              </div>

              <div>
                <select
                  className="form-input w-full"
                  value={clubsFilter}
                  onChange={(e) => setClubsFilter(e.target.value)}
                >
                  <option value="all">Cualquier nº de clubes</option>
                  <option value="1">Sólo 1 club (fidelidad)</option>
                  <option value="max2">Máx. 2 clubes pasados</option>
                  <option value="max3">Máx. 3 clubes pasados</option>
                  <option value="min2">Mín. 2 clubes pasados</option>
                  <option value="min3">Mín. 3 clubes pasados</option>
                </select>
              </div>
            </div>

            {/* Fila de Sliders Avanzados (Min/Max en una sola barra) */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 pt-4 border-t border-brand-black-border/40 mt-4 text-[11px] text-brand-gray-light">
              {/* Rango de Edad */}
              <div className="space-y-1.5 bg-brand-black/20 p-2.5 rounded border border-brand-black-border/25">
                <div className="flex justify-between font-semibold">
                  <span className="uppercase text-[9px] text-brand-gray-muted tracking-wider">Edad</span>
                  <span className="text-brand-red-600 font-bold font-mono">{minAgeFilter} - {maxAgeFilter} años</span>
                </div>
                <div className="relative w-full h-5 flex items-center mt-1">
                  <div className="absolute left-0 right-0 h-1 bg-brand-black-border/40 rounded"></div>
                  <div
                    className="absolute h-1 bg-brand-red-600 rounded"
                    style={{
                      left: `${((minAgeFilter - 16) / (40 - 16)) * 100}%`,
                      width: `${((maxAgeFilter - minAgeFilter) / (40 - 16)) * 100}%`
                    }}
                  ></div>
                  <input
                    type="range"
                    min="16"
                    max="40"
                    value={minAgeFilter}
                    onChange={(e) => setMinAgeFilter(Math.min(Number(e.target.value), maxAgeFilter))}
                    onMouseDown={() => setActiveAgeSlider('min')}
                    onTouchStart={() => setActiveAgeSlider('min')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeAgeSlider === 'min' ? 5 : 3 }}
                  />
                  <input
                    type="range"
                    min="16"
                    max="40"
                    value={maxAgeFilter}
                    onChange={(e) => setMaxAgeFilter(Math.max(Number(e.target.value), minAgeFilter))}
                    onMouseDown={() => setActiveAgeSlider('max')}
                    onTouchStart={() => setActiveAgeSlider('max')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeAgeSlider === 'max' ? 5 : 3 }}
                  />
                </div>
              </div>

              {/* Rango de Titularidad */}
              <div className="space-y-1.5 bg-brand-black/20 p-2.5 rounded border border-brand-black-border/25">
                <div className="flex justify-between font-semibold">
                  <span className="uppercase text-[9px] text-brand-gray-muted tracking-wider">Titularidad</span>
                  <span className="text-brand-red-600 font-bold font-mono">{minTitularidadFilter}% - {maxTitularidadFilter}%</span>
                </div>
                <div className="relative w-full h-5 flex items-center mt-1">
                  <div className="absolute left-0 right-0 h-1 bg-brand-black-border/40 rounded"></div>
                  <div
                    className="absolute h-1 bg-brand-red-600 rounded"
                    style={{
                      left: `${(minTitularidadFilter / 100) * 100}%`,
                      width: `${((maxTitularidadFilter - minTitularidadFilter) / 100) * 100}%`
                    }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={minTitularidadFilter}
                    onChange={(e) => setMinTitularidadFilter(Math.min(Number(e.target.value), maxTitularidadFilter))}
                    onMouseDown={() => setActiveTitularidadSlider('min')}
                    onTouchStart={() => setActiveTitularidadSlider('min')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeTitularidadSlider === 'min' ? 5 : 3 }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={maxTitularidadFilter}
                    onChange={(e) => setMaxTitularidadFilter(Math.max(Number(e.target.value), minTitularidadFilter))}
                    onMouseDown={() => setActiveTitularidadSlider('max')}
                    onTouchStart={() => setActiveTitularidadSlider('max')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeTitularidadSlider === 'max' ? 5 : 3 }}
                  />
                </div>
              </div>

              {/* Rango de Convocatoria */}
              <div className="space-y-1.5 bg-brand-black/20 p-2.5 rounded border border-brand-black-border/25">
                <div className="flex justify-between font-semibold">
                  <span className="uppercase text-[9px] text-brand-gray-muted tracking-wider">Convocatoria</span>
                  <span className="text-brand-red-600 font-bold font-mono">{minConvocatoriaFilter}% - {maxConvocatoriaFilter}%</span>
                </div>
                <div className="relative w-full h-5 flex items-center mt-1">
                  <div className="absolute left-0 right-0 h-1 bg-brand-black-border/40 rounded"></div>
                  <div
                    className="absolute h-1 bg-brand-red-600 rounded"
                    style={{
                      left: `${(minConvocatoriaFilter / 100) * 100}%`,
                      width: `${((maxConvocatoriaFilter - minConvocatoriaFilter) / 100) * 100}%`
                    }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={minConvocatoriaFilter}
                    onChange={(e) => setMinConvocatoriaFilter(Math.min(Number(e.target.value), maxConvocatoriaFilter))}
                    onMouseDown={() => setActiveConvocatoriaSlider('min')}
                    onTouchStart={() => setActiveConvocatoriaSlider('min')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeConvocatoriaSlider === 'min' ? 5 : 3 }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="100"
                    step="5"
                    value={maxConvocatoriaFilter}
                    onChange={(e) => setMaxConvocatoriaFilter(Math.max(Number(e.target.value), minConvocatoriaFilter))}
                    onMouseDown={() => setActiveConvocatoriaSlider('max')}
                    onTouchStart={() => setActiveConvocatoriaSlider('max')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeConvocatoriaSlider === 'max' ? 5 : 3 }}
                  />
                </div>
              </div>

              {/* Rango de Media Goles */}
              <div className="space-y-1.5 bg-brand-black/20 p-2.5 rounded border border-brand-black-border/25">
                <div className="flex justify-between font-semibold">
                  <span className="uppercase text-[9px] text-brand-gray-muted tracking-wider">Media Goles/Part</span>
                  <span className="text-brand-red-600 font-bold font-mono">{minGolesMediaFilter.toFixed(1)} - {maxGolesMediaFilter.toFixed(1)}</span>
                </div>
                <div className="relative w-full h-5 flex items-center mt-1">
                  <div className="absolute left-0 right-0 h-1 bg-brand-black-border/40 rounded"></div>
                  <div
                    className="absolute h-1 bg-brand-red-600 rounded"
                    style={{
                      left: `${(minGolesMediaFilter / 1.5) * 100}%`,
                      width: `${((maxGolesMediaFilter - minGolesMediaFilter) / 1.5) * 100}%`
                    }}
                  ></div>
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    value={minGolesMediaFilter}
                    onChange={(e) => setMinGolesMediaFilter(Math.min(Number(e.target.value), maxGolesMediaFilter))}
                    onMouseDown={() => setActiveGolesSlider('min')}
                    onTouchStart={() => setActiveGolesSlider('min')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeGolesSlider === 'min' ? 5 : 3 }}
                  />
                  <input
                    type="range"
                    min="0"
                    max="1.5"
                    step="0.1"
                    value={maxGolesMediaFilter}
                    onChange={(e) => setMaxGolesMediaFilter(Math.max(Number(e.target.value), minGolesMediaFilter))}
                    onMouseDown={() => setActiveGolesSlider('max')}
                    onTouchStart={() => setActiveGolesSlider('max')}
                    className="absolute pointer-events-none w-full appearance-none h-1 bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-red-600 [&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:cursor-pointer [&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:w-3.5 [&::-moz-range-thumb]:h-3.5 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-brand-red-600 [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:cursor-pointer focus:outline-none"
                    style={{ zIndex: activeGolesSlider === 'max' ? 5 : 3 }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Listado Liga */}
          {filteredLeaguePlayers.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No se encontraron jugadores de la liga con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
               {filteredLeaguePlayers.map((player) => (
                <div
                  key={player.id}
                  className="dashboard-card flex flex-col justify-between bg-brand-black-card border border-brand-black-border hover:border-brand-red-600/30 transition-all duration-200"
                >
                  <div className="cursor-pointer" onClick={() => handleOpenDbPlayerModal(player)}>
                    <div className="flex justify-between items-start gap-3 pb-3 mb-3 border-b border-brand-black-border">
                      <div className="flex gap-3">
                        <div className="w-12 h-12 bg-brand-black rounded-lg border border-brand-black-border overflow-hidden shrink-0 flex items-center justify-center">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={player.player_name} className="w-full h-full object-cover" />
                          ) : (
                            <User className="w-6 h-6 text-brand-gray-dark" />
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-brand-gray-light leading-tight">{player.player_name}</h4>
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="text-[10px] bg-brand-black-border text-brand-gray-light px-1.5 py-0.5 rounded font-mono font-bold">
                              #{player.dorsal}
                            </span>
                            <span className="text-[9px] bg-brand-red-600/10 text-brand-red-600 px-1.5 py-0.5 rounded font-semibold">
                              {player.position}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Estrellas de Valoración */}
                      <div className="flex gap-0.5 shrink-0 bg-brand-black/40 px-1.5 py-0.5 rounded border border-brand-black-border/50">
                        {Array.from({ length: 5 }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            className={`w-3.5 h-3.5 ${sIdx < (player.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Datos procedencia */}
                    <div className="text-[11px] text-brand-gray-muted mb-3 bg-brand-black/25 p-2.5 rounded border border-brand-black-border/40 space-y-1">
                      <div>
                        <span className="font-semibold text-brand-gray-dark">Club:</span> <span className="text-brand-gray-light">{player.team}</span>
                      </div>
                      {player.competition && (
                        <div>
                          <span className="font-semibold text-brand-gray-dark">Competición:</span> <span className="text-brand-gray-light">{player.competition}</span>
                        </div>
                      )}
                      {player.phone && (
                        <div className="flex items-center justify-between border-t border-brand-black-border/20 pt-1 mt-1">
                          <span className="font-semibold text-brand-gray-dark">Teléfono:</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              const cleanNum = player.phone!.replace(/\D/g, '');
                              const formattedNum = cleanNum.startsWith('34') ? cleanNum : `34${cleanNum}`;
                              window.open(`https://wa.me/${formattedNum}`, '_blank');
                            }}
                            className="flex items-center gap-1 text-[9px] text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-950/20 border border-emerald-900/35 px-1.5 py-0.5 rounded transition-colors"
                          >
                            💬 {player.phone}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Estadísticas FFCV (Jugados, Convocatorias y %s limpios) */}
                    <div className="grid grid-cols-5 gap-0.5 text-[9px] text-brand-gray-muted bg-brand-black/20 p-2 rounded mb-3 border border-brand-black-border/40">
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">Jugados</span>
                        <span className="text-brand-gray-light font-bold text-xs">{player.jugados ?? 0}</span>
                      </div>
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">Convoc.</span>
                        <span className="text-brand-gray-light font-bold text-xs">{player.convocados ?? 0}</span>
                      </div>
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">% Conv.</span>
                        <span className="text-brand-gray-light font-bold text-xs">
                          {cleanPercent(player.participacion)}
                        </span>
                      </div>
                      <div className="text-center border-r border-brand-black-border/40">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">% Tit.</span>
                        <span className="text-brand-gray-light font-bold text-xs">
                          {cleanPercent(player.titularidad)}
                        </span>
                      </div>
                      <div className="text-center">
                        <span className="block text-brand-gray-dark font-semibold leading-tight">Goles</span>
                        <span className="text-brand-red-600 font-bold text-xs">{player.goles ?? 0}</span>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-[10px] text-brand-gray-muted bg-brand-black/10 p-2 rounded mb-3">
                      <div>
                        <span className="font-semibold text-brand-gray-dark">Tarjetas: </span> 
                        <span className="text-yellow-500 font-bold">🟨 {player.amarillas ?? 0}</span>
                        {(player.rojas ?? 0) > 0 && <span className="text-red-500 font-bold ml-1.5">🟥 {player.rojas}</span>}
                      </div>
                      <div className="text-right">
                        <span className="font-semibold text-brand-gray-dark">Convocado: </span>
                        <span className="text-brand-gray-light font-bold">{player.convocados ?? 0} veces</span>
                      </div>
                    </div>


                    {/* Historial Técnico / Eventos */}
                    {player.notes && (
                      <div className="space-y-1 text-xs mb-4">
                        <span className="text-[9px] uppercase font-bold text-brand-gray-muted flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-brand-red-600" /> Reporte de Actuación
                        </span>
                        <p className="text-[11px] text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-2 rounded border border-brand-black-border/60">
                          {player.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex justify-between items-center pt-3 border-t border-brand-black-border">
                    <button
                      onClick={(e) => { e.stopPropagation(); handleOpenDbPlayerModal(player); }}
                      className="text-[11px] text-brand-gray-light bg-brand-black-bg border border-brand-black-border px-2.5 py-1.5 rounded-lg hover:text-brand-red-600 flex items-center gap-1 transition-all"
                    >
                      <Search className="w-3.5 h-3.5" /> Ver Estadísticas
                    </button>

                    <button
                      onClick={(e) => { e.stopPropagation(); handleToggleFavorite(player); }}
                      className={`text-[11px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${
                        player.in_wallet
                          ? 'text-yellow-400 bg-yellow-950/20 border-yellow-900/40 hover:bg-yellow-900/30'
                          : 'text-brand-red-600 bg-brand-red-600/10 border-brand-red-600/20 hover:bg-brand-red-600/20'
                      }`}
                    >
                      <Star className={`w-3.5 h-3.5 ${player.in_wallet ? 'fill-yellow-400' : ''}`} />
                      {player.in_wallet ? 'Favorito' : 'Añadir Favorito'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: TABLERO TÁCTICO (CAMPOGRAMA)
          ===================================================================== */}
      {activeTab === 'pitch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Lateral: Jugadores Disponibles para ubicar */}
          <div className="lg:col-span-1 bg-brand-black border border-brand-black-border p-4 rounded-xl space-y-4">
            <div>
              <h3 className="font-bold text-brand-gray-light text-base">Jugadores Disponibles</h3>
              <p className="text-xs text-brand-gray-muted mt-1">
                Haz clic en el botón verde de cualquier jugador para posicionarlo en el campograma.
              </p>
            </div>

            {/* Listado en miniatura scrollable */}
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {/* Combinamos ambos listados en la UI lateral para conveniencia */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-brand-red-600 tracking-wider">Favoritos</span>
                {walletList.length === 0 ? (
                  <p className="text-[11px] text-brand-gray-dark italic px-2">No hay favoritos.</p>
                ) : (
                  walletList.map(p => {
                    const isPlaced = boardPlayers.some(bp => bp.id === p.id);
                    return (
                      <div key={p.id} className="flex justify-between items-center bg-brand-black-card border border-brand-black-border p-2 rounded text-xs gap-2">
                        <div className="truncate flex-1">
                          <span className="font-bold text-brand-gray-light block truncate">{p.player_name}</span>
                          <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
                            <span className="text-[10px] text-brand-gray-muted truncate max-w-[120px]">{p.position} ({p.team})</span>
                            <div className="flex shrink-0">
                              {Array.from({ length: 5 }).map((_, sIdx) => (
                                <Star
                                  key={sIdx}
                                  className={`w-2.5 h-2.5 ${sIdx < (p.rating || 0) ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`}
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <button
                          onClick={() => handleOpenAssignModal(p)}
                          disabled={isPlaced}
                          className={`px-2 py-1 rounded text-[10px] flex items-center gap-0.5 transition-all ${
                            isPlaced
                              ? 'bg-brand-black text-brand-gray-dark pointer-events-none'
                              : 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-900/60'
                          }`}
                        >
                          {isPlaced ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {isPlaced ? 'En Campo' : 'Ubicar'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Panel Central y Derecho: Campograma (Campo de Juego) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Controles de Formación */}
            <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-brand-gray-light flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-brand-red-600" /> Esquema / Formación:
                </label>
                <select
                  value={boardFormation}
                  onChange={(e) => handleFormationChange(e.target.value)}
                  className="form-input bg-brand-black-bg border-brand-black-border py-1.5 text-xs w-36"
                >
                  <option value="Libre">Libre (Arrastrar)</option>
                  {Object.keys(FORMATIONS_SLOTS).map(sys => (
                    <option key={sys} value={sys}>{sys}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClearBoard}
                  className="btn-secondary py-1.5 px-3 text-xs text-red-400 hover:text-red-300"
                >
                  Limpiar Campo
                </button>
              </div>
            </div>

            {/* Campograma (Representación del campo) */}
            <div
              ref={pitchRef}
              className="relative w-full max-w-lg mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-800 to-emerald-950 border-4 border-emerald-100/30 rounded-2xl overflow-hidden shadow-2xl select-none"
            >
              {/* Franjas del césped */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
              </div>

              {/* Líneas tácticas del Campo */}
              {/* Línea de medio campo */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-emerald-100/35 -translate-y-1/2"></div>
              {/* Círculo central */}
              <div className="absolute top-1/2 left-1/2 w-[30%] aspect-square border-2 border-emerald-100/35 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-100/40 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

              {/* Área grande arriba */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-b-2 border-x-2 border-emerald-100/35"></div>
              {/* Área pequeña arriba */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-b-2 border-x-2 border-emerald-100/35"></div>
              {/* Semiarco arriba */}
              <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-b-2 border-emerald-100/35 rounded-b-full"></div>
              {/* Punto penal arriba */}
              <div className="absolute top-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/35 rounded-full -translate-x-1/2"></div>

              {/* Área grande abajo */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-t-2 border-x-2 border-emerald-100/35"></div>
              {/* Área pequeña abajo */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-t-2 border-x-2 border-emerald-100/35"></div>
              {/* Semiarco abajo */}
              <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-t-2 border-emerald-100/35 rounded-t-full"></div>
              {/* Punto penal abajo */}
              <div className="absolute bottom-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/35 rounded-full -translate-x-1/2"></div>

              {/* Renderizar jugadores colocados */}
              {boardPlayers.map((player) => (
                <div
                  key={player.id}
                  style={{
                    left: `${player.x}%`,
                    top: `${player.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: activeDragId === player.id ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={(e) => handleMouseDown(e, player.id)}
                  onTouchStart={(e) => handleTouchStart(e, player.id)}
                  onClick={() => handleFieldPlayerClick(player)}
                  className="absolute z-10 group flex flex-col items-center select-none"
                >
                  <div className="relative w-11 h-11 rounded-full bg-brand-black-card border-2 border-brand-red-600 shadow-premium flex items-center justify-center overflow-visible group-hover:scale-110 transition-transform duration-150">
                    {/* Badge de Escudo de Equipo */}
                    <div className="absolute -top-1.5 -left-1.5 w-[20px] h-[20px] rounded-full bg-white flex items-center justify-center p-0.5 border border-brand-black-border/20 shadow-md">
                      <img
                        src={getTeamLogo(player.team || 'Atzeneta')}
                        alt="Escudo equipo"
                        className="w-full h-full object-contain pointer-events-none"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
                        }}
                      />
                    </div>
                    {player.foto ? (
                      <img src={player.foto} alt={player.nombre} className="w-full h-full object-cover rounded-full pointer-events-none" />
                    ) : (
                      <User className="w-5 h-5 text-brand-gray-light pointer-events-none" />
                    )}
                    {/* Badge de Dorsal */}
                    <span className="absolute -bottom-1 -right-1 bg-brand-red-600 text-white font-mono text-[9px] font-black w-4.5 h-4.5 rounded-full border border-emerald-950 flex items-center justify-center">
                      {player.dorsal}
                    </span>
                  </div>

                  {/* Nombre del jugador */}
                  <span className="mt-1 bg-brand-black/90 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow border border-brand-black-border max-w-[85px] truncate text-center leading-none">
                    {player.nombre.includes(',') ? player.nombre.split(',')[0].split(' ')[0] : player.nombre.split(' ')[0]}
                  </span>

                  {/* Equipo del jugador */}
                  <span className="mt-0.5 bg-brand-black/90 text-amber-400 text-[8px] font-semibold px-1 py-0.5 rounded shadow border border-brand-black-border max-w-[85px] truncate text-center leading-none">
                    {(player.team || 'Atzeneta').replace(" C.F. 'A'", "").replace(" C.D. 'A'", "").replace(" C.F.", "").replace(" C.D.", "").replace("S.A.D.", "").trim()}
                  </span>

                  {/* Comentario tooltip miniatura */}
                  {player.comment && (
                    <span className="absolute bottom-12 hidden group-hover:block bg-brand-black-card border border-brand-black-border text-brand-gray-light text-[10px] p-2 rounded shadow-2xl max-w-[150px] text-center z-20">
                      {player.comment}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL CREAR / EDITAR CARTERA
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPlayer ? 'Editar Ficha del Candidato' : 'Registrar Candidato en Cartera'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Futbolista</label>
            <input
              type="text"
              className="form-input"
              placeholder="Marcos Fornés"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Club de Procedencia</label>
              <input
                type="text"
                className="form-input"
                placeholder="Hércules CF B"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Edad</label>
              <input
                type="number"
                min="14"
                max="45"
                className="form-input"
                placeholder="21"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Demarcación / Posición</label>
              <input
                type="text"
                className="form-input"
                placeholder="Delantero Centro"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Valoración Técnica ({rating} estrellas)</label>
              <div className="flex gap-1.5 py-2 text-yellow-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star className={`w-6 h-6 ${s <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Otras posiciones posibles</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. Lateral Derecho, Mediocentro"
              value={alternativePositions}
              onChange={(e) => setAlternativePositions(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Teléfono de Contacto</label>
            <input
              type="text"
              className="form-input"
              placeholder="Ej. +34600112233"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Observaciones y Reporte Físico/Táctico</label>
            <textarea
              className="form-input h-24 resize-none"
              placeholder="Rápido al desmarque, buena potencia de tiro, etc..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Candidato
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL DE ASIGNACIÓN AL TABLERO TÁCTICO
          ===================================================================== */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Posicionar Futbolista en Campo"
      >
        {placementPlayer && (
          <form onSubmit={handleConfirmPlacement} className="space-y-4">
            <div className="flex items-center gap-3 bg-brand-black/35 p-3 rounded border border-brand-black-border">
              <div className="w-10 h-10 bg-brand-black border border-brand-black-border rounded-full overflow-hidden flex items-center justify-center">
                {placementPlayer.foto ? (
                  <img src={placementPlayer.foto} alt={placementPlayer.nombre} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-brand-gray-light" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-gray-light">{placementPlayer.nombre}</h4>
                <p className="text-[11px] text-brand-gray-muted mt-0.5">
                  #{placementPlayer.dorsal} • {placementPlayer.posicion} ({placementPlayer.team})
                </p>
              </div>
            </div>

            <div>
              <label className="form-label">Comentarios o Instrucciones Tácticas</label>
              <textarea
                className="form-input h-20 resize-none"
                placeholder="Ej. 'Realizar coberturas cortas a banda', 'Presión tras pérdida en 3/4'..."
                value={placementComment}
                onChange={(e) => setPlacementComment(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="btn-secondary py-2 text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary py-2 text-xs font-semibold">
                Ubicar en Campo
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL EDICIÓN JUGADOR COLOCADO EN TABLERO
          ===================================================================== */}
      <Modal
        isOpen={isFieldPlayerModalOpen}
        onClose={() => setIsFieldPlayerModalOpen(false)}
        title="Observación de Jugador en Campo"
      >
        {selectedFieldPlayer && (
          <form onSubmit={handleSaveFieldPlayerComment} className="space-y-4">
            <div className="flex gap-3 bg-brand-black/25 p-3 rounded border border-brand-black-border">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-black-border shrink-0 flex items-center justify-center">
                {selectedFieldPlayer.foto ? (
                  <img src={selectedFieldPlayer.foto} alt={selectedFieldPlayer.nombre} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-brand-gray-light" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-gray-light leading-tight">{selectedFieldPlayer.nombre}</h4>
                <p className="text-[11px] text-brand-gray-muted mt-1 font-mono">
                  Dorsal: #{selectedFieldPlayer.dorsal} • Equipo: {selectedFieldPlayer.team}
                </p>
                <p className="text-[10px] text-brand-gray-muted font-semibold mt-0.5">
                  Demarcación: {selectedFieldPlayer.posicion}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="form-label">Valoración Técnica ({fieldPlayerRating} estrellas)</label>
                <div className="flex gap-1 py-1.5 text-yellow-500">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setFieldPlayerRating(s)}
                      className="hover:scale-110 transition-transform"
                    >
                      <Star className={`w-5 h-5 ${s <= fieldPlayerRating ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`} />
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="form-label">Otras posiciones posibles</label>
                <input
                  type="text"
                  className="form-input py-1.5 text-xs"
                  placeholder="Ej. MC, LD"
                  value={fieldPlayerAltPos}
                  onChange={(e) => setFieldPlayerAltPos(e.target.value)}
                />
              </div>
            </div>

            <div>
              <label className="form-label">Instrucciones / Anotaciones Scouting</label>
              <textarea
                className="form-input h-20 resize-none"
                placeholder="Escribe comentarios específicos de este jugador sobre el campo..."
                value={fieldPlayerComment}
                onChange={(e) => setFieldPlayerComment(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-brand-black-border">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleRemoveFromField(selectedFieldPlayer.id)}
                  className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 px-3 py-2 rounded-lg hover:bg-red-900/30 flex items-center gap-1 transition-all"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Retirar de Campo
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const dbPlayer = scoutingList.find(sp => sp.id === selectedFieldPlayer.id);
                    if (dbPlayer) {
                      setIsFieldPlayerModalOpen(false);
                      handleOpenEditModal(dbPlayer);
                    }
                  }}
                  className="text-xs text-brand-gray-light bg-brand-black border border-brand-black-border px-3 py-2 rounded-lg hover:bg-brand-black-card/30 flex items-center gap-1 transition-all"
                >
                  <Edit2 className="w-3.5 h-3.5 text-brand-red-600" /> Editar Ficha
                </button>
              </div>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFieldPlayerModalOpen(false)}
                  className="btn-secondary py-2 text-xs"
                >
                  Cerrar
                </button>
                <button type="submit" className="btn-primary py-2 text-xs font-semibold">
                  Guardar Anotación
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL DETALLE JUGADOR BASE DE DATOS (FFCV)
          ===================================================================== */}
      <Modal
        isOpen={isDbPlayerModalOpen}
        onClose={() => setIsDbPlayerModalOpen(false)}
        title="Ficha Completa de la Liga (FFCV)"
      >
        {selectedDbPlayer && (
          <div className="space-y-6">
            {/* Header del jugador */}
            <div className="flex gap-4 bg-brand-black/25 p-4 rounded-xl border border-brand-black-border">
              <div className="w-20 h-20 bg-brand-black rounded-lg border border-brand-black-border overflow-hidden shrink-0 flex items-center justify-center">
                {selectedDbPlayer.photo_url ? (
                  <img src={selectedDbPlayer.photo_url} alt={selectedDbPlayer.player_name} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-12 h-12 text-brand-gray-dark" />
                )}
              </div>
              <div className="flex-1 space-y-1">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-bold text-brand-gray-light">{selectedDbPlayer.player_name}</h3>
                    <p className="text-xs text-brand-gray-muted mt-0.5">{selectedDbPlayer.team}</p>
                  </div>
                  <button
                    onClick={() => handleToggleFavorite(selectedDbPlayer)}
                    className={`text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1 transition-all ${
                      selectedDbPlayer.in_wallet
                        ? 'text-yellow-400 bg-yellow-950/20 border-yellow-900/40 hover:bg-yellow-900/30'
                        : 'text-brand-red-600 bg-brand-red-600/10 border-brand-red-600/20 hover:bg-brand-red-600/20'
                    }`}
                  >
                    <Star className={`w-3.5 h-3.5 ${selectedDbPlayer.in_wallet ? 'fill-yellow-400' : ''}`} />
                    {selectedDbPlayer.in_wallet ? 'Favorito' : 'Añadir Favorito'}
                  </button>
                </div>

                <div className="flex gap-2 items-center mt-2 flex-wrap">
                  <span className="text-xs bg-brand-black-border text-brand-gray-light px-2 py-0.5 rounded font-mono font-bold">
                    #{selectedDbPlayer.dorsal}
                  </span>
                  <span className="text-xs bg-brand-red-600/10 text-brand-red-600 px-2 py-0.5 rounded font-semibold">
                    {selectedDbPlayer.position}
                  </span>
                  {selectedDbPlayer.age && (
                    <span className="text-xs text-brand-gray-muted ml-2">
                      {selectedDbPlayer.age} años
                    </span>
                  )}
                  {selectedDbPlayer.phone && (
                    <button
                      type="button"
                      onClick={() => {
                        const cleanNum = selectedDbPlayer.phone!.replace(/\D/g, '');
                        const formattedNum = cleanNum.startsWith('34') ? cleanNum : `34${cleanNum}`;
                        window.open(`https://wa.me/${formattedNum}`, '_blank');
                      }}
                      className="ml-2 flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300 font-bold bg-emerald-950/20 border border-emerald-900/35 px-2 py-0.5 rounded transition-colors"
                    >
                      💬 WhatsApp: {selectedDbPlayer.phone}
                    </button>
                  )}
                </div>
              </div>
            </div>

            {/* Grid Estadísticas */}
            <div className="space-y-3">
              <h4 className="text-xs uppercase font-bold text-brand-red-600 tracking-wider">Estadísticas de Temporada</h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-brand-black border border-brand-black-border/40 p-3 rounded-lg text-center">
                  <span className="block text-[10px] text-brand-gray-dark font-semibold">Partidos Convocados</span>
                  <span className="text-lg font-bold text-brand-gray-light">{selectedDbPlayer.convocados ?? 0}</span>
                </div>
                <div className="bg-brand-black border border-brand-black-border/40 p-3 rounded-lg text-center">
                  <span className="block text-[10px] text-brand-gray-dark font-semibold">Partidos Jugados</span>
                  <span className="text-lg font-bold text-brand-gray-light">{selectedDbPlayer.jugados ?? 0}</span>
                </div>
                <div className="bg-brand-black border border-brand-black-border/40 p-3 rounded-lg text-center">
                  <span className="block text-[10px] text-brand-gray-dark font-semibold">Titular / Suplente</span>
                  <span className="text-sm font-bold text-brand-gray-light mt-1 block">
                    {selectedDbPlayer.titular ?? 0}T / {selectedDbPlayer.suplente ?? 0}S
                  </span>
                </div>
                <div className="bg-brand-black border border-brand-black-border/40 p-3 rounded-lg text-center">
                  <span className="block text-[10px] text-brand-gray-dark font-semibold">Goles Marcados</span>
                  <span className="text-lg font-bold text-brand-red-600">{selectedDbPlayer.goles ?? 0}</span>
                </div>
              </div>
            </div>

            {/* Rendimiento Adicional */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-brand-black border border-brand-black-border/40 p-4 rounded-xl space-y-2">
                <h5 className="text-[11px] uppercase font-bold text-brand-gray-light">Rendimiento y Promedios</h5>
                <div className="text-xs space-y-1.5 text-brand-gray-muted">
                  <div className="flex justify-between border-b border-brand-black-border/30 pb-1">
                    <span>Goles por Partido:</span>
                    <span className="text-brand-gray-light font-bold">{selectedDbPlayer.goles_partido ?? '0.00'}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-black-border/30 pb-1">
                    <span>Participación:</span>
                    <span className="text-brand-gray-light font-bold">{selectedDbPlayer.participacion ?? '—'}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Titularidad:</span>
                    <span className="text-brand-gray-light font-bold">{selectedDbPlayer.titularidad ?? '—'}</span>
                  </div>
                </div>
              </div>

              <div className="bg-brand-black border border-brand-black-border/40 p-4 rounded-xl space-y-2">
                <h5 className="text-[11px] uppercase font-bold text-brand-gray-light">Disciplina FFCV</h5>
                <div className="text-xs space-y-1.5 text-brand-gray-muted">
                  <div className="flex justify-between border-b border-brand-black-border/30 pb-1">
                    <span>Tarjetas Amarillas:</span>
                    <span className="text-yellow-500 font-bold">🟨 {selectedDbPlayer.amarillas ?? 0}</span>
                  </div>
                  <div className="flex justify-between border-b border-brand-black-border/30 pb-1">
                    <span>Dobles Amarillas:</span>
                    <span className="text-yellow-600 font-bold">🟨🟨 {selectedDbPlayer.doble_amarilla ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Tarjetas Rojas:</span>
                    <span className="text-red-500 font-bold">🟥 {selectedDbPlayer.rojas ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Historial de Clubes FFCV */}
            {selectedDbPlayer.scouting_player_history && selectedDbPlayer.scouting_player_history.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="text-xs uppercase font-bold text-brand-red-600 tracking-wider">🏆 Historial de Clubes FFCV</h4>
                <div className="text-xs space-y-1 bg-brand-black/35 p-3 rounded-lg border border-brand-black-border max-h-48 overflow-y-auto">
                  {selectedDbPlayer.scouting_player_history.map((hist) => (
                    <div key={hist.id} className="flex justify-between items-center py-1.5 border-b border-brand-black-border/20 last:border-0 last:pb-0">
                      <span className="text-brand-gray-light font-medium">{hist.equipo}</span>
                      <span className="text-brand-gray-dark font-mono text-xs shrink-0">{hist.temporada}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Reporte Histórico / Notas */}
            {selectedDbPlayer.notes && (
              <div className="space-y-1.5">
                <h4 className="text-xs uppercase font-bold text-brand-red-600 tracking-wider">Historial Técnico FFCV</h4>
                <p className="text-xs text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-3 rounded-lg border border-brand-black-border">
                  {selectedDbPlayer.notes}
                </p>
              </div>
            )}

            {/* Otras posiciones y comentarios (si está en favoritos) */}
            {selectedDbPlayer.in_wallet && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-brand-black-border pt-4">
                {selectedDbPlayer.alternative_positions && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-brand-gray-muted flex items-center gap-1">
                      ⚡ Otras posiciones posibles
                    </span>
                    <p className="text-xs text-brand-gray-light bg-brand-black/35 p-2.5 rounded border border-brand-black-border">
                      {selectedDbPlayer.alternative_positions}
                    </p>
                  </div>
                )}
                {selectedDbPlayer.comment && (
                  <div className="space-y-1">
                    <span className="text-[10px] uppercase font-bold text-brand-gray-muted flex items-center gap-1">
                      📋 Anotación del Campograma
                    </span>
                    <p className="text-xs text-brand-gray-light bg-brand-black/35 p-2.5 rounded border border-brand-black-border italic">
                      {selectedDbPlayer.comment}
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* Footer */}
            <div className="flex gap-2 justify-end pt-4 border-t border-brand-black-border">
              <button
                type="button"
                onClick={() => setIsDbPlayerModalOpen(false)}
                className="btn-secondary py-2 px-4 text-xs"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};
