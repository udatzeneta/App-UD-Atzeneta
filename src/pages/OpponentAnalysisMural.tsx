import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { OpponentAnalysis, OpponentLibraryVideo, OpponentSubSection, OpponentFormation, OpponentPresentation, OpponentRosterPlayer } from '../types';
import {
  ArrowLeft, ShieldAlert, Award, FileText, Settings as TacticalIcon,
  Edit2, Save, X, Users, Film, Swords, Shield, Flag, Presentation, Plus, Trash2, Star, Trophy,
  AlertTriangle, AlertOctagon, Flame, CheckCircle2, User
} from 'lucide-react';
import { OpponentRosterManager } from '../components/opponent_analysis/OpponentRosterManager';
import { OpponentVideoLibrary } from '../components/opponent_analysis/OpponentVideoLibrary';
import { PhaseSection } from '../components/opponent_analysis/PhaseSection';
import { FormationPitch } from '../components/opponent_analysis/FormationPitch';
import { OpponentPresentationBuilder } from '../components/opponent_analysis/OpponentPresentationBuilder';
import { FFCVOpponentSyncPanel } from '../components/opponent_analysis/FFCVOpponentSyncPanel';
import { detectVideoProvider } from '../utils/opponentVideo';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { isSameTeam, isSamePlayer, normalizePlayerName, formatPositionAbbr } from '../utils/teamUtils';
import { FORMATIONS_SLOTS, createFormationWithPlayers } from '../utils/formations';

// Navegación por anclas del mural.
const NAV = [
  { id: 'generales', label: 'Generales', icon: TacticalIcon },
  { id: 'ffcv_sync', label: 'Estadísticas FFCV', icon: Trophy },
  { id: 'jugadores', label: 'Jugadores', icon: Users },
  { id: 'con_balon', label: 'Con Balón', icon: Swords },
  { id: 'sin_balon', label: 'Sin Balón', icon: Shield },
  { id: 'abp', label: 'ABP', icon: Flag },
  { id: 'presentacion', label: 'Presentación', icon: Presentation },
  { id: 'videoteca', label: 'Videoteca', icon: Film },
];

export const OpponentAnalysisMural: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const canEdit = hasPermission('opponent_analysis', 'editar');

  const [selectedSeason, setSelectedSeason] = useState<'2026-2027' | '2025-2026'>('2026-2027');

  // Cargar el análisis
  const { data: analysisList = [], isLoading } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis(),
  });

  const analysis = analysisList.find(a => a.id === id);

  // 1. Query para cargar jugadores de scouting de la temporada 2026/2027
  const { data: scoutingPlayers = [], isLoading: loadingScouting } = useQuery({
    queryKey: ['scouting-players'],
    queryFn: () => dataService.getScouting(),
  });

  // 2. Extraer los jugadores de scouting que pertenecen a ESTE equipo rival en la temporada 2026/2027
  const teamScouting2627 = useMemo(() => {
    if (!analysis?.opponent) return [];
    return scoutingPlayers.filter(sp =>
      isSameTeam(sp.team, analysis.opponent) &&
      (sp.season === '2026-2027' || sp.season === '2026/2027')
    );
  }, [scoutingPlayers, analysis?.opponent]);

  // Nombres de los jugadores para buscar sus historiales pasados
  const teamPlayerNames = useMemo(() => {
    const fromScouting = teamScouting2627.map(sp => sp.player_name);
    const fromRoster = (analysis?.roster_comments || []).map((r: OpponentRosterPlayer) => r.name);
    return Array.from(new Set([...fromScouting, ...fromRoster])).filter(Boolean);
  }, [teamScouting2627, analysis?.roster_comments]);

  // 3. Query para cargar los datos de la temporada anterior 2025/2026 SOLO de estos jugadores
  const { data: pastSeasonScouting = [] } = useQuery({
    queryKey: ['scouting-past-season', teamPlayerNames],
    queryFn: () => dataService.getPreviousSeasonScoutingForPlayers(teamPlayerNames),
    enabled: teamPlayerNames.length > 0,
  });

  // 4. Query para cargar sanciones oficiales de la FFCV del Comité de Competición
  const { data: ffcvSanctions = [] } = useQuery({
    queryKey: ['ffcv-sanctions', selectedSeason],
    queryFn: () => dataService.getFFCVSanctions(selectedSeason),
  });

  // 5. Query para cargar el calendario de partidos y calcular fechas de cumplimiento de sanciones
  const { data: allMatches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches(),
  });

  // Partidos del rival ordenados cronológicamente
  const opponentMatches = useMemo(() => {
    if (!analysis?.opponent) return [];
    return allMatches
      .filter(m => isSameTeam(m.rival, analysis.opponent))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [allMatches, analysis?.opponent]);

  // Próximo partido del rival (a partir de hoy o el último registrado)
  const nextMatch = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const future = opponentMatches.find(m => m.date >= todayStr);
    if (future) return future;
    return opponentMatches[opponentMatches.length - 1] || null;
  }, [opponentMatches]);

  // 6. Construir la plantilla final con separación estricta de temporadas
  const displayRoster = useMemo(() => {
    const parseNum = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    // Helper para buscar registro de 2025/2026
    const findPastSeasonRecord = (playerName: string, dorsal?: number | string) => {
      let match = pastSeasonScouting.find(sp =>
        isSamePlayer(sp.player_name, playerName, sp.dorsal, dorsal) &&
        (sp.season === '2025-2026' || sp.season === '2025/2026')
      );
      if (!match) {
        match = scoutingPlayers.find(sp =>
          isSamePlayer(sp.player_name, playerName, sp.dorsal, dorsal) &&
          (sp.season === '2025-2026' || sp.season === '2025/2026')
        );
      }
      return match;
    };

    // Helper para buscar registro de 2026/2027
    const findCurrentSeasonRecord = (playerName: string, dorsal?: number | string) => {
      return scoutingPlayers.find(sp =>
        isSameTeam(sp.team, analysis?.opponent) &&
        isSamePlayer(sp.player_name, playerName, sp.dorsal, dorsal) &&
        (sp.season === '2026-2027' || sp.season === '2026/2027')
      );
    };

    // Base de la plantilla: combinar todos los jugadores de scouting 2026/2027 con cualquier edición/jugador manual del cuerpo técnico
    let combinedRoster: OpponentRosterPlayer[] = [];

    if (teamScouting2627.length > 0) {
      // 1. Convertir todos los jugadores de la FFCV 2026/2027
      const scoutingList: OpponentRosterPlayer[] = teamScouting2627.map(sp => {
        const savedComment = (analysis?.roster_comments || []).find((rc: OpponentRosterPlayer) =>
          isSamePlayer(rc.name, sp.player_name, rc.number, sp.dorsal)
        );
        return {
          id: savedComment?.id || `sp-${sp.id}`,
          name: sp.player_name,
          number: sp.dorsal || savedComment?.number || undefined,
          position: sp.position || savedComment?.position || 'DF',
          comments: savedComment?.comments || sp.notes || '',
          photo_url: sp.photo_url || savedComment?.photo_url,
          matches_played: parseNum(sp.jugados) || parseNum(sp.convocados) || parseNum(sp.matches_played),
          starter_count: parseNum(sp.titular) || parseNum(sp.starter_count) || (parseNum(sp.jugados) || parseNum(sp.convocados) || parseNum(sp.matches_played)),
          minutes_played: parseNum(sp.minutes_played),
          goals: parseNum(sp.goles) || parseNum(sp.goals),
          assists: parseNum(sp.assists),
          yellow_cards: parseNum(sp.amarillas) || parseNum(sp.yellow_cards),
          red_cards: parseNum(sp.rojas) || parseNum(sp.red_cards),
          rating: sp.rating,
          is_featured: savedComment?.is_featured || false
        };
      });

      // 2. Añadir jugadores manuales del coach que no vengan en el scouting FFCV
      const manualPlayers = (analysis?.roster_comments || []).filter((rc: OpponentRosterPlayer) =>
        !teamScouting2627.some(sp => isSamePlayer(sp.player_name, rc.name, sp.dorsal, rc.number))
      );

      combinedRoster = [...scoutingList, ...manualPlayers];
    } else {
      combinedRoster = analysis?.roster_comments || [];
    }

    const is2627Selected = selectedSeason === '2026-2027';

    return combinedRoster.map(p => {
      const sp2627 = findCurrentSeasonRecord(p.name, p.number);
      const sp2526 = findPastSeasonRecord(p.name, p.number);

      // Estadísticas Temporada Actual 2026/2027
      const curMatches = sp2627 ? (parseNum(sp2627.jugados) || parseNum(sp2627.convocados) || parseNum(sp2627.matches_played)) : parseNum(p.matches_played);
      const curStarter = sp2627 ? (parseNum(sp2627.titular) || parseNum(sp2627.starter_count) || curMatches) : parseNum(p.starter_count);
      const curGoals = sp2627 ? (parseNum(sp2627.goles) || parseNum(sp2627.goals)) : parseNum(p.goals);
      const curYellow = sp2627 ? (parseNum(sp2627.amarillas) || parseNum(sp2627.yellow_cards)) : parseNum(p.yellow_cards);
      const curRed = sp2627 ? (parseNum(sp2627.rojas) || parseNum(sp2627.red_cards)) : parseNum(p.red_cards);

      // Estadísticas Temporada Pasada 2025/2026 (procedentes de este club o de su club anterior)
      const pastMatches = sp2526 ? (parseNum(sp2526.jugados) || parseNum(sp2526.convocados) || parseNum(sp2526.matches_played)) : 0;
      const pastStarter = sp2526 ? (parseNum(sp2526.titular) || parseNum(sp2526.starter_count) || pastMatches) : 0;
      const pastGoals = sp2526 ? (parseNum(sp2526.goles) || parseNum(sp2526.goals)) : 0;
      const pastYellow = sp2526 ? (parseNum(sp2526.amarillas) || parseNum(sp2526.yellow_cards)) : 0;
      const pastRed = sp2526 ? (parseNum(sp2526.rojas) || parseNum(sp2526.red_cards)) : 0;
      const pastTeam = sp2526?.team || null;

      return {
        ...p,
        photo_url: p.photo_url || sp2627?.photo_url || sp2526?.photo_url,
        position: p.position || sp2627?.position || sp2526?.position || 'DF',
        number: p.number || sp2627?.dorsal || sp2526?.dorsal || undefined,
        // Estadísticas mostradas según la temporada activa seleccionada
        matches_played: is2627Selected ? curMatches : pastMatches,
        starter_count: is2627Selected ? curStarter : pastStarter,
        goals: is2627Selected ? curGoals : pastGoals,
        yellow_cards: is2627Selected ? curYellow : pastYellow,
        red_cards: is2627Selected ? curRed : pastRed,
        // Objeto con desglose por temporada para badges y comparativas
        stats_2026_2027: {
          matches: curMatches,
          starter: curStarter,
          goals: curGoals,
          yellow_cards: curYellow,
          red_cards: curRed,
        },
        stats_2025_2026: {
          matches: pastMatches,
          starter: pastStarter,
          goals: pastGoals,
          yellow_cards: pastYellow,
          red_cards: pastRed,
          team: pastTeam,
        }
      };
    });
  }, [analysis?.roster_comments, analysis?.opponent, teamScouting2627, scoutingPlayers, pastSeasonScouting, selectedSeason]);

  // Rankings del equipo rival derivados del scraping para la temporada seleccionada
  const rivalRankings = useMemo(() => {
    const list = [...displayRoster];
    // Listado completo de todos los goleadores
    const topScorers = [...list].filter(p => (p.goals || 0) > 0).sort((a, b) => (b.goals || 0) - (a.goals || 0));
    // Los 11 titulares más utilizados
    const topStarters = [...list].filter(p => (p.starter_count || 0) > 0 || (p.matches_played || 0) > 0).sort((a, b) => (b.starter_count || 0) - (a.starter_count || 0)).slice(0, 11);
    // Listado completo de jugadores con amonestaciones / tarjetas
    const topCards = [...list].filter(p => (p.yellow_cards || 0) > 0 || (p.red_cards || 0) > 0).sort((a, b) => (b.yellow_cards || 0) - (a.yellow_cards || 0));
    return { topScorers, topStarters, topCards };
  }, [displayRoster]);

  // Análisis de sanciones activas para el próximo partido (Resoluciones oficiales del Comité FFCV + Tarjetas Rojas + Ciclos de 5 Amarillas)
  const sanctionsInfo = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    const targetMatchDate = nextMatch?.date || todayStr;

    // 1. Sanciones oficiales del Comité de Competición de la FFCV para este equipo rival
    const teamFFCVSanctions = ffcvSanctions.filter(s => isSameTeam(s.team_name, analysis?.opponent));

    const sanctioned: {
      player: typeof displayRoster[0];
      reason: string;
      detail: string;
      type: 'red' | 'cycle' | 'committee';
      isOfficialCommittee?: boolean;
      article?: string;
      resolutionDate?: string;
      matchesCount?: number;
      matchesServed?: number;
      affectedMatches?: {
        id?: string;
        matchday: string;
        date: string;
        dateFormatted: string;
        time: string;
        timeText: string;
        vsTeam: string;
        rival: string;
        location: string;
        isNextMatch: boolean;
      }[];
    }[] = [];

    const warned: {
      player: typeof displayRoster[0];
      yellowCount: number;
    }[] = [];

    const processedPlayerIds = new Set<string>();

    // A. Procesar Sanciones Oficiales del Comité FFCV con control de fechas y horarios de partidos posteriores
    teamFFCVSanctions.forEach(s => {
      let player = displayRoster.find(p => isSamePlayer(p.name, s.player_name));
      if (!player) {
        player = {
          id: `sanc-p-${s.id}`,
          name: s.player_name,
          number: undefined,
          position: 'DF',
          comments: '',
          photo_url: s.photo_url || undefined,
          matches_played: 0,
          starter_count: 0,
          minutes_played: 0,
          goals: 0,
          assists: 0,
          yellow_cards: 0,
          red_cards: 1,
          rating: undefined,
          is_featured: false,
          stats_2026_2027: { matches: 0, starter: 0, goals: 0, yellow_cards: 0, red_cards: 1 },
          stats_2025_2026: { matches: 0, starter: 0, goals: 0, yellow_cards: 0, red_cards: 0, team: null }
        };
      }

      // 1. Partidos registrados en la BD local posteriores a la fecha de reunión del comité
      const matchesAfterResolution = opponentMatches.filter(m => m.date >= s.resolution_date);
      const pastPlayedMatches = matchesAfterResolution.filter(m => m.date < todayStr);

      // 2. Estimar jornadas/fines de semana transcurridos entre la fecha del comité y hoy
      let elapsedWeekends = 0;
      if (s.resolution_date < todayStr) {
        const resDateObj = new Date(s.resolution_date + 'T00:00:00');
        const todayObj = new Date(todayStr + 'T00:00:00');
        const diffDays = Math.floor((todayObj.getTime() - resDateObj.getTime()) / (1000 * 3600 * 24));
        
        // Si han pasado 4 o más días desde el comité (ej. reunión miércoles 09/09 y hoy es sábado 19/09 = 10 días),
        // al menos 1 jornada de fin de semana (12-13/09) ya ha sido disputada.
        if (diffDays >= 4) {
          elapsedWeekends = Math.floor((diffDays + 2) / 7);
          if (elapsedWeekends < 1) elapsedWeekends = 1;
        }
      }

      const totalMatchesServed = Math.max(pastPlayedMatches.length, elapsedWeekends);
      const remainingMatchesToServe = (s.matches_count || 1) - totalMatchesServed;

      // Solo si quedan partidos de sanción pendientes de cumplir a fecha de hoy:
      if (remainingMatchesToServe > 0) {
        // Los próximos partidos donde cumplirá los partidos de sanción pendientes:
        const upcomingSuspendedMatches = matchesAfterResolution.filter(m => m.date >= todayStr).slice(0, remainingMatchesToServe);

        const affectedMatches = upcomingSuspendedMatches.map(m => {
          const isLocal = isSameTeam(m.rival, analysis?.opponent) ? false : true;
          const vsTeam = isLocal ? `vs ${m.rival}` : `@ ${m.rival}`;
          const matchdayText = m.matchday ? (String(m.matchday).toLowerCase().includes('jornada') ? String(m.matchday) : `Jornada ${m.matchday}`) : 'Próxima Jornada';
          
          let dateFormatted = m.date;
          try {
            dateFormatted = new Date(m.date + 'T00:00:00').toLocaleDateString('es-ES', { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' });
          } catch (e) {}

          const timeText = m.time ? `${m.time} h` : 'Horario por confirmar';

          return {
            id: m.id,
            matchday: matchdayText,
            date: m.date,
            dateFormatted,
            time: m.time || '',
            timeText,
            vsTeam,
            rival: m.rival,
            location: m.location || '',
            isNextMatch: nextMatch ? (m.id === nextMatch.id || m.date === nextMatch.date) : true
          };
        });

        processedPlayerIds.add(player.id);
        sanctioned.push({
          player,
          reason: `Comité FFCV (${s.sanction_text || '1 partido'})`,
          detail: `${s.article || 'Resolución del Comité'} · Reunión: ${s.resolution_date}`,
          type: 'committee',
          isOfficialCommittee: true,
          article: s.article || '',
          resolutionDate: s.resolution_date,
          matchesCount: s.matches_count || 1,
          matchesServed: totalMatchesServed,
          affectedMatches
        });
      }
    });

    // B. Procesar apercibidos (a 1 amarilla de cumplir ciclo: 4, 9, 14... amarillas en la temporada)
    displayRoster.forEach(p => {
      if (processedPlayerIds.has(p.id)) return;

      const yellow = p.stats_2026_2027?.yellow_cards ?? p.yellow_cards ?? 0;

      if (yellow > 0 && (yellow + 1) % 5 === 0) {
        warned.push({
          player: p,
          yellowCount: yellow
        });
      }
    });

    return { sanctioned, warned };
  }, [displayRoster, ffcvSanctions, analysis?.opponent, opponentMatches, nextMatch]);

  // Posible 11 Inicial: 11 jugadores más utilizados como titular SIN contar a los sancionados
  const probableEleven = useMemo(() => {
    const sanctionedIds = new Set(sanctionsInfo.sanctioned.map(s => s.player.id));
    const sanctionedNames = new Set(sanctionsInfo.sanctioned.map(s => normalizePlayerName(s.player.name)));
    const availablePlayers = displayRoster.filter(p => !sanctionedIds.has(p.id) && !sanctionedNames.has(normalizePlayerName(p.name)));

    // Ordenar por partidos como titular y partidos jugados
    const sorted = [...availablePlayers].sort((a, b) => {
      const titA = a.starter_count ?? a.stats_2026_2027?.starter ?? 0;
      const titB = b.starter_count ?? b.stats_2026_2027?.starter ?? 0;
      if (titB !== titA) return titB - titA;
      const pjA = a.matches_played ?? a.stats_2026_2027?.matches ?? 0;
      const pjB = b.matches_played ?? b.stats_2026_2027?.matches ?? 0;
      return pjB - pjA;
    });

    return sorted.slice(0, 11);
  }, [displayRoster, sanctionsInfo.sanctioned]);


  // --- Estado local para la videoteca (guardado con debounce) ---
  const [libraryVideos, setLibraryVideos] = useState<OpponentLibraryVideo[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migratedRef = useRef(false);

  // --- Estado local del campograma/sistema de juego (guardado con debounce) ---
  const [formation, setFormation] = useState<OpponentFormation>({ system: 'Libre', players: [] });
  const formationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Sistemas de juego alternativos (guardado con debounce) ---
  const [altFormations, setAltFormations] = useState<OpponentFormation[]>([]);
  const altTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Presentaciones (guardado con debounce) ---
  const [presentations, setPresentations] = useState<OpponentPresentation[]>([]);
  const presTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Estado de edición del bloque General ---
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [editingRoster, setEditingRoster] = useState(false);
  const [editData, setEditData] = useState<Partial<OpponentAnalysis>>({});
  const [strengthsText, setStrengthsText] = useState('');
  const [weaknessesText, setWeaknessesText] = useState('');
  const [keyPlayersText, setKeyPlayersText] = useState('');

  const updateMutation = useMutation({
    mutationFn: (item: Partial<OpponentAnalysis>) => dataService.updateOpponentAnalysis(id!, item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] }),
    onError: (err: any) => showToast('error', 'Error', err.message),
  });

  // --- Filter estado para Jugadores Destacados vs Todos ---
  const [rosterFilter, setRosterFilter] = useState<'all' | 'featured'>('all');

  // --- Modal para añadir nuevo sistema alternativo ---
  const [isAddingAltModalOpen, setIsAddingAltModalOpen] = useState(false);
  const [newAltLabel, setNewAltLabel] = useState('');

  const filteredRoster = useMemo(() => {
    if (rosterFilter === 'featured') {
      const featured = displayRoster.filter(p => p.is_featured);
      return featured.length > 0 ? featured : displayRoster;
    }
    return displayRoster;
  }, [displayRoster, rosterFilter]);

  // Sincroniza el estado local de la videoteca con el servidor y migra
  // Sincroniza el estado local de la videoteca y campograma con el servidor al cargar/cambiar de rival.
  useEffect(() => {
    if (!analysis) return;
    setLibraryVideos(analysis.library_videos || []);
    setFormation(analysis.general_formation || { system: 'Libre', players: [] });
    setAltFormations(analysis.alternative_formations || []);
    setPresentations(analysis.presentations || []);
    setEditingGeneral(false);
    setEditingRoster(false);
    setEditData({});
  }, [analysis?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardado con debounce del campograma.
  const handleFormationChange = (data: OpponentFormation) => {
    setFormation(data);
    if (formationTimer.current) clearTimeout(formationTimer.current);
    formationTimer.current = setTimeout(() => {
      updateMutation.mutate({ general_formation: data });
    }, 700);
  };

  // Guardado con debounce de los sistemas alternativos.
  const handleAltFormationsChange = (data: OpponentFormation[]) => {
    setAltFormations(data);
    if (altTimer.current) clearTimeout(altTimer.current);
    altTimer.current = setTimeout(() => {
      updateMutation.mutate({ alternative_formations: data });
    }, 700);
  };

  const updateAltFormation = (idx: number, updates: Partial<OpponentFormation>) => {
    handleAltFormationsChange(altFormations.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  };
  const openAddAltModal = () => {
    setNewAltLabel('');
    setIsAddingAltModalOpen(true);
  };
  const handleCreateAlt = (selectedSystem: string) => {
    const newFormation = createFormationWithPlayers(selectedSystem, newAltLabel.trim() || undefined);
    handleAltFormationsChange([...altFormations, newFormation]);
    setNewAltLabel('');
    setIsAddingAltModalOpen(false);
  };
  const removeAltFormation = (idx: number) => {
    handleAltFormationsChange(altFormations.filter((_, i) => i !== idx));
  };

  // Guardado con debounce de las presentaciones.
  const handlePresentationsChange = (data: OpponentPresentation[]) => {
    setPresentations(data);
    if (presTimer.current) clearTimeout(presTimer.current);
    presTimer.current = setTimeout(() => {
      updateMutation.mutate({ presentations: data });
    }, 700);
  };

  // Guardado con debounce de la videoteca.
  const handleLibraryChange = (videos: OpponentLibraryVideo[]) => {
    setLibraryVideos(videos);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateMutation.mutate({ library_videos: videos });
    }, 700);
  };

  const totalClips = useMemo(
    () => libraryVideos.reduce((n, v) => n + v.clips.length, 0),
    [libraryVideos]
  );

  const handleSubSectionsChange = (subSections: Record<string, OpponentSubSection>) => {
    updateMutation.mutate({ sub_sections: subSections });
    showToast('success', 'Guardado', 'Subsección actualizada.');
  };

  if (isLoading) {
    return <div className="text-brand-gray-muted p-8 text-center">Cargando mural...</div>;
  }

  if (!analysis) {
    return (
      <div className="text-center p-12">
        <p className="text-brand-gray-light text-lg">Análisis no encontrado.</p>
        <button onClick={() => navigate('/opponent-analysis')} className="btn-secondary mt-4">
          Volver a Análisis de Rivales
        </button>
      </div>
    );
  }

  const subSections = analysis.sub_sections || {};

  const startEditingGeneral = () => {
    setEditData(analysis);
    setStrengthsText((analysis.strengths || []).join('\n'));
    setWeaknessesText((analysis.weaknesses || []).join('\n'));
    setKeyPlayersText((analysis.key_players || []).join('\n'));
    setEditingGeneral(true);
  };

  const saveGeneral = () => {
    updateMutation.mutate(
      {
        general_board: editData.general_board,
        tactical_system: editData.tactical_system,
        observations: editData.observations,
        strengths: strengthsText.includes('\n') ? strengthsText.split('\n').map(s => s.replace(/^[•\-\d.\s]+/, '').trim()).filter(Boolean) : strengthsText.split(',').map(s => s.trim()).filter(Boolean),
        weaknesses: weaknessesText.includes('\n') ? weaknessesText.split('\n').map(s => s.replace(/^[•\-\d.\s]+/, '').trim()).filter(Boolean) : weaknessesText.split(',').map(s => s.trim()).filter(Boolean),
        key_players: keyPlayersText.includes('\n') ? keyPlayersText.split('\n').map(s => s.replace(/^[•\-\d.\s]+/, '').trim()).filter(Boolean) : keyPlayersText.split(',').map(s => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          setEditingGeneral(false);
          showToast('success', 'Guardado', 'Aspectos generales actualizados.');
        },
      }
    );
  };

  const scrollTo = (anchor: string) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const SectionTitle: React.FC<{ title: string; anchor: string; action?: React.ReactNode }> = ({ title, anchor, action }) => (
    <div id={anchor} className="flex justify-between items-end border-b border-brand-red-600/30 pb-3 mb-6 scroll-mt-24">
      <h2 className="text-xl font-bold text-brand-red-500 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  );

  return (
    <div className="max-w-[1700px] mx-auto pb-16">
      {/* Botón Volver */}
      <button
        onClick={() => navigate('/opponent-analysis')}
        className="flex items-center gap-2 text-sm text-brand-gray-muted hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al panel de análisis
      </button>

      {/* Cabecera premium */}
      <div className="bg-gradient-to-r from-brand-black to-brand-black-card border border-brand-black-border rounded-2xl p-6 sm:p-8 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <p className="text-brand-red-500 text-xs font-bold uppercase tracking-widest mb-1">Mural de Análisis Táctico</p>
            <h1 className="text-3xl sm:text-4xl font-black text-white">{analysis.opponent}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-brand-black border border-brand-black-border px-4 py-2 rounded-xl flex items-center gap-3">
              <TacticalIcon className="w-5 h-5 text-brand-red-600" />
              <span className="text-sm font-bold text-brand-gray-light">Sistema: {analysis.tactical_system}</span>
            </div>
            <div className="bg-brand-black border border-brand-black-border px-4 py-2 rounded-xl flex items-center gap-3">
              <Film className="w-5 h-5 text-brand-red-600" />
              <span className="text-sm font-bold text-brand-gray-light">{libraryVideos.length} vídeos · {totalClips} clips</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación sticky */}
      <div className="sticky top-0 z-30 -mx-2 px-2 py-3 mt-4 mb-6 bg-brand-black/80 backdrop-blur-md border-b border-brand-black-border">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {NAV.map(n => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors whitespace-nowrap"
              >
                <Icon className="w-3.5 h-3.5" /> {n.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout 2 columnas: contenido + videoteca */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ===== Columna principal ===== */}
        <div className="min-w-0">
          {/* 1. Aspectos Generales */}
          <div className="mb-14">
            <SectionTitle
              title="Aspectos Generales"
              anchor="generales"
              action={canEdit && (
                editingGeneral ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingGeneral(false)} className="btn-secondary py-1.5 text-xs px-3"><X className="w-3.5 h-3.5 mr-1" /> Cancelar</button>
                    <button onClick={saveGeneral} disabled={updateMutation.isPending} className="btn-primary py-1.5 text-xs px-3"><Save className="w-3.5 h-3.5 mr-1" /> Guardar</button>
                  </div>
                ) : (
                  <button onClick={startEditingGeneral} className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                )
              )}
            />

            {editingGeneral ? (
              <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium space-y-6">
                {/* 1. Fila superior: Campograma Principal (izq) y Sistemas Alternativos (der) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                  {/* Izquierda: Campograma Principal (Grande) */}
                  <div className="lg:col-span-7 bg-brand-black/40 border border-brand-black-border rounded-xl p-4 flex flex-col">
                    <label className="form-label flex items-center justify-between mb-3">
                      <span className="flex items-center gap-2">
                        <TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistema Principal (Arrastra jugadores)
                      </span>
                    </label>
                    <FormationPitch
                      value={formation}
                      onChange={handleFormationChange}
                      opponentName={analysis.opponent}
                      rosterPlayers={analysis.roster_comments || []}
                    />
                  </div>

                  {/* Derecha: Sistemas Alternativos (Pequeños) */}
                  <div className="lg:col-span-5 bg-brand-black/40 border border-brand-black-border rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-2">
                      <label className="form-label flex items-center gap-2 mb-0">
                        <TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistemas Alternativos
                      </label>
                      <button
                        type="button"
                        onClick={openAddAltModal}
                        className="flex items-center gap-1 text-xs font-semibold text-brand-red-500 hover:text-white bg-brand-red-600/10 border border-brand-red-600/20 px-2.5 py-1 rounded-lg hover:bg-brand-red-600 transition-colors"
                      >
                        <Plus className="w-3.5 h-3.5" /> Añadir
                      </button>
                    </div>
                    <p className="text-[11px] text-brand-gray-muted mb-3">Variantes del sistema principal (repliegue, con balón, etc.)</p>
                    
                    <div className="space-y-4 max-h-[550px] overflow-y-auto pr-1">
                      {altFormations.map((f, idx) => (
                        <div key={idx} className="bg-brand-black border border-brand-black-border rounded-xl p-3 space-y-2">
                          <div className="flex items-center gap-2">
                            <input
                              type="text"
                              value={f.label || ''}
                              onChange={e => updateAltFormation(idx, { label: e.target.value })}
                              placeholder="Ej: Repliegue 4-4-2, Ataque 3-4-3"
                              className="flex-1 min-w-0 bg-black border border-brand-black-border rounded-lg px-2.5 py-1.5 text-xs text-brand-gray-light outline-none focus:border-brand-red-600"
                            />
                            <button
                              type="button"
                              onClick={() => removeAltFormation(idx)}
                              className="p-1.5 text-brand-gray-muted hover:text-brand-red-600 rounded-lg hover:bg-brand-black-card transition-colors shrink-0"
                              title="Eliminar alternativa"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                          <FormationPitch
                            compact
                            value={f}
                            onChange={data => updateAltFormation(idx, data)}
                            opponentName={analysis.opponent}
                            rosterPlayers={analysis.roster_comments || []}
                          />
                        </div>
                      ))}
                      {altFormations.length === 0 && (
                        <button
                          type="button"
                          onClick={openAddAltModal}
                          className="w-full flex flex-col items-center justify-center gap-2 p-8 border-2 border-dashed border-brand-black-border rounded-xl text-brand-gray-muted hover:text-white hover:border-brand-red-600 transition-colors"
                        >
                          <Plus className="w-6 h-6" />
                          <span className="text-xs font-semibold">Añadir primera variante alternativa</span>
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* 2. Fila inferior: Campos de texto */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-4 border-t border-brand-black-border">
                  <div>
                    <label className="form-label flex items-center gap-2"><TacticalIcon className="w-4 h-4 text-brand-red-600" /> Nombre del Sistema Táctico</label>
                    <input type="text" className="form-input" value={editData.tactical_system || ''} onChange={e => setEditData({ ...editData, tactical_system: e.target.value })} placeholder="Ej: 4-3-3 / 4-2-3-1" />
                  </div>
                  <div className="flex flex-col">
                    <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas (Una por línea)</label>
                    <textarea className="form-input flex-1 min-h-[100px] resize-none" value={strengthsText} onChange={e => setStrengthsText(e.target.value)} />
                  </div>
                  <div className="flex flex-col">
                    <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades (Una por línea)</label>
                    <textarea className="form-input flex-1 min-h-[100px] resize-none" value={weaknessesText} onChange={e => setWeaknessesText(e.target.value)} />
                  </div>
                </div>

                <div>
                  <label className="form-label flex items-center gap-2"><FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones Generales</label>
                  <textarea className="form-input h-24 resize-none" value={editData.observations || ''} onChange={e => setEditData({ ...editData, observations: e.target.value })} />
                </div>
              </div>
            ) : (
              <>
                {/* 1. Grid de Campogramas: Principal (Izquierda) vs Alternativos (Derecha) */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-6">
                  {/* Izquierda: Campograma Principal (Grande) */}
                  <div className="lg:col-span-7 xl:col-span-7 bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2">
                        <TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistema Principal
                      </h4>
                      {formation.system && formation.system !== 'Libre' && (
                        <span className="text-[11px] font-bold text-brand-red-500 bg-brand-red-600/10 border border-brand-red-600/20 px-2.5 py-1 rounded-full">
                          {formation.system}
                        </span>
                      )}
                    </div>
                    <FormationPitch
                      value={formation}
                      onChange={handleFormationChange}
                      readOnly={!canEdit}
                      opponentName={analysis.opponent}
                      rosterPlayers={analysis.roster_comments || []}
                    />
                  </div>

                  {/* Derecha: Sistemas Alternativos (Campogramas Pequeños) */}
                  <div className="lg:col-span-5 xl:col-span-5 bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2">
                        <TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistemas Alternativos
                      </h4>
                      {altFormations.length > 0 && (
                        <span className="text-[10px] font-bold text-brand-gray-muted bg-brand-black border border-brand-black-border px-2 py-0.5 rounded-full">
                          {altFormations.length} {altFormations.length === 1 ? 'variante' : 'variantes'}
                        </span>
                      )}
                    </div>

                    {altFormations.length === 0 ? (
                      <div className="flex-1 flex flex-col items-center justify-center p-6 border-2 border-dashed border-brand-black-border rounded-xl text-center min-h-[300px]">
                        <TacticalIcon className="w-8 h-8 text-brand-gray-muted/40 mb-2" />
                        <p className="text-xs text-brand-gray-muted font-medium">Sin sistemas alternativos definidos</p>
                        {canEdit && (
                          <button onClick={openAddAltModal} className="mt-3 text-xs text-brand-red-500 font-semibold hover:underline flex items-center gap-1">
                            <Plus className="w-3.5 h-3.5" /> Añadir sistemas alternativos
                          </button>
                        )}
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[550px] pr-1">
                        {altFormations.map((f, idx) => (
                          <div key={idx} className="bg-brand-black border border-brand-black-border rounded-xl p-2.5 flex flex-col items-center gap-2">
                            <span className="text-[11px] font-bold text-white tracking-wide text-center truncate w-full">
                              {f.label || f.system || `Alternativa ${idx + 1}`}
                            </span>
                            <FormationPitch
                              compact
                              readOnly
                              value={f}
                              onChange={() => {}}
                              opponentName={analysis.opponent}
                              rosterPlayers={analysis.roster_comments || []}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {/* 2. Tarjetas inferiores: Fortalezas, Debilidades y Observaciones */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3 shrink-0"><ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas</h4>
                    <div className="flex flex-wrap gap-2">
                      {(!analysis.strengths || analysis.strengths.length === 0) ? <span className="text-xs text-brand-gray-dark">Ninguna especificada</span> : analysis.strengths.map((s: string, i: number) => (
                        <span key={i} className="text-[11px] bg-red-950/20 text-brand-red-500 border border-brand-red-600/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3 shrink-0"><ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {(!analysis.weaknesses || analysis.weaknesses.length === 0) ? <span className="text-xs text-brand-gray-dark">Ninguna especificada</span> : analysis.weaknesses.map((s: string, i: number) => (
                        <span key={i} className="text-[11px] bg-amber-950/20 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3 shrink-0"><FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones</h4>
                    <p className="text-xs text-brand-gray-light whitespace-pre-wrap leading-relaxed">
                      {analysis.observations || 'Sin observaciones adicionales.'}
                    </p>
                  </div>
                </div>
              </>
            )}
          </div>

          {/* FFCV Automatic Sync & Team Statistics Panel */}
          <div id="ffcv_sync" className="mb-14 scroll-mt-24">
            <FFCVOpponentSyncPanel opponentName={analysis.opponent} />
          </div>

          {/* 2. Jugadores Destacados */}
          <div className="mb-14">
            <SectionTitle
              title="Jugadores Destacados"
              anchor="jugadores"
              action={canEdit && (
                editingRoster ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingRoster(false)} className="btn-secondary py-1.5 text-xs px-3"><X className="w-3.5 h-3.5 mr-1" /> Cancelar</button>
                    <button
                      onClick={() => updateMutation.mutate({ roster_comments: editData.roster_comments }, { onSuccess: () => { setEditingRoster(false); showToast('success', 'Guardado', 'Jugadores actualizados.'); } })}
                      disabled={updateMutation.isPending}
                      className="btn-primary py-1.5 text-xs px-3"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" /> Guardar
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setEditData({
                        ...analysis,
                        roster_comments: (analysis?.roster_comments && analysis.roster_comments.length > 0) ? analysis.roster_comments : displayRoster
                      });
                      setEditingRoster(true);
                    }}
                    className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors"
                  >
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                )
              )}
            />

            {!editingRoster && displayRoster.length > 0 && (
              <div className="mb-6 space-y-4">
                {/* Selector de Temporada (Actual vs Pasada) */}
                <div className="flex flex-wrap items-center justify-between gap-3 bg-brand-black-card border border-brand-black-border p-3.5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider">Temporada Análisis:</span>
                    <div className="flex items-center gap-1.5 bg-black p-1 rounded-lg border border-brand-black-border">
                      <button
                        type="button"
                        onClick={() => setSelectedSeason('2026-2027')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          selectedSeason === '2026-2027'
                            ? 'bg-brand-red-600 text-white shadow-sm'
                            : 'text-brand-gray-muted hover:text-white'
                        }`}
                      >
                        🗓️ Temporada 2026/2027 (Actual)
                      </button>
                      <button
                        type="button"
                        onClick={() => setSelectedSeason('2025-2026')}
                        className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${
                          selectedSeason === '2025-2026'
                            ? 'bg-amber-600 text-white shadow-sm'
                            : 'text-brand-gray-muted hover:text-white'
                        }`}
                      >
                        📜 Temporada 2025/2026 (Pasada)
                      </button>
                    </div>
                  </div>
                  <div className="text-[11px] text-brand-gray-dark font-medium italic">
                    Mostrando rankings y datos de: <span className="text-white font-bold">{selectedSeason === '2026-2027' ? '2026/2027 (Actual)' : '2025/2026 (Pasada)'}</span>
                  </div>
                </div>

                {/* Sección de Sancionados & Apercibidos para el Próximo Partido */}
                <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-4 sm:p-5 shadow-premium space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-brand-black-border pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-red-950/60 border border-red-800/40 flex items-center justify-center text-red-500 shadow-sm">
                        <AlertOctagon className="w-4 h-4" />
                      </div>
                      <div>
                        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2">
                          Control Disciplinario · Próximo Partido
                        </h3>
                        <p className="text-[11px] text-brand-gray-muted">
                          Bajas por sanción (tarjeta roja o ciclo de 5 amarillas) y jugadores apercibidos
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {sanctionsInfo.sanctioned.length > 0 && (
                        <span className="text-[11px] font-black text-red-400 bg-red-950/80 border border-red-700/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5 animate-pulse">
                          <AlertOctagon className="w-3.5 h-3.5" />
                          {sanctionsInfo.sanctioned.length} {sanctionsInfo.sanctioned.length === 1 ? 'Sancionado' : 'Sancionados'}
                        </span>
                      )}
                      {sanctionsInfo.warned.length > 0 && (
                        <span className="text-[11px] font-bold text-amber-400 bg-amber-950/80 border border-amber-700/50 px-2.5 py-1 rounded-lg flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          {sanctionsInfo.warned.length} {sanctionsInfo.warned.length === 1 ? 'Apercibido' : 'Apercibidos'}
                        </span>
                      )}
                    </div>
                  </div>

                  {sanctionsInfo.sanctioned.length === 0 && sanctionsInfo.warned.length === 0 ? (
                    <div className="flex items-center gap-3 bg-brand-black/60 border border-emerald-900/30 rounded-xl p-3.5 text-emerald-400 text-xs">
                      <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                      <span><strong>Sin bajas por sanción:</strong> Todo el equipo rival está disponible sin suspensiones por tarjeta roja o ciclo de 5 amarillas.</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                      {/* Sancionados (Bajas confirmadas) */}
                      {sanctionsInfo.sanctioned.length > 0 ? (
                        <div className="bg-red-950/20 border border-red-900/40 rounded-xl p-3.5 space-y-2.5">
                          <span className="text-[11px] font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                            🚫 Sancionados (Bajas confirmadas):
                          </span>
                          <div className="space-y-2.5">
                            {sanctionsInfo.sanctioned.map(({ player: p, reason, detail, type, resolutionDate, matchesCount, affectedMatches }) => (
                              <div key={p.id} className="bg-brand-black/90 border border-red-900/60 rounded-xl p-3 shadow-sm space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="w-10 h-10 rounded-full bg-brand-black-card border border-red-800/60 overflow-hidden flex items-center justify-center shrink-0 relative">
                                      {p.photo_url ? (
                                        <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                      ) : (
                                        <span className="text-xs font-black text-red-400 font-mono">#{p.number || '-'}</span>
                                      )}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        {p.number && (
                                          <span className="text-[10px] font-mono font-black text-red-400 bg-red-950/80 px-1 rounded shrink-0">#{p.number}</span>
                                        )}
                                        <span className="text-xs font-black text-white break-words leading-tight">{p.name}</span>
                                      </div>
                                      <span className="text-[10px] text-brand-gray-muted block break-words mt-0.5">{p.position || 'Sin posición'} · {detail}</span>
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-black px-2 py-1 rounded-lg shrink-0 bg-red-600 text-white shadow-sm">
                                    {reason}
                                  </span>
                                </div>

                                {/* Desglose del horario y partido afectado por la sanción */}
                                <div className="pt-2 border-t border-red-900/40 space-y-1.5">
                                  <span className="text-[10px] font-bold text-red-300 uppercase tracking-wider block">
                                    📌 Partidos afectados por la sanción ({matchesCount || 1} {matchesCount === 1 ? 'partido' : 'partidos'}):
                                  </span>
                                  {affectedMatches && affectedMatches.length > 0 ? (
                                    affectedMatches.map((m: any, idx: number) => (
                                      <div key={idx} className="flex flex-wrap items-center justify-between gap-1.5 bg-red-950/40 border border-red-900/60 p-2 rounded-lg text-[11px]">
                                        <div className="flex items-center gap-2 min-w-0 flex-1 flex-wrap">
                                          <span className="font-mono font-black text-red-400 bg-red-950 px-1.5 py-0.5 rounded text-[10px] shrink-0 border border-red-800/50">
                                            {m.matchday}
                                          </span>
                                          <span className="text-white font-semibold flex items-center gap-1">
                                            🗓️ {m.dateFormatted} <span className="text-amber-400 font-mono font-bold ml-1">⏰ {m.timeText}</span>
                                          </span>
                                          <span className="text-red-300 font-black shrink-0">
                                            ⚔️ {m.vsTeam}
                                          </span>
                                        </div>
                                        {m.isNextMatch && (
                                          <span className="text-[9px] font-black text-white bg-red-600 px-2 py-0.5 rounded-full uppercase tracking-wider shrink-0 shadow-sm animate-pulse">
                                            🚨 Próximo Partido
                                          </span>
                                        )}
                                      </div>
                                    ))
                                  ) : (
                                    <div className="text-[10px] text-red-400/90 italic bg-red-950/30 p-2 rounded-lg border border-red-900/30">
                                      Afecta al primer partido posterior a la reunión del {resolutionDate || 'comité'} (Horario pendiente de publicación oficial por la FFCV).
                                    </div>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-brand-black/40 border border-brand-black-border rounded-xl p-3 flex items-center gap-2.5 text-xs text-brand-gray-muted">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Sin sancionados con tarjeta roja o ciclo de amarillas.</span>
                        </div>
                      )}

                      {/* Apercibidos (A 1 de sanción) */}
                      {sanctionsInfo.warned.length > 0 ? (
                        <div className="bg-amber-950/20 border border-amber-900/40 rounded-xl p-3.5 space-y-2.5">
                          <span className="text-[11px] font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                            ⚠️ Apercibidos (a 1 amarilla de suspensión):
                          </span>
                          <div className="space-y-2">
                            {sanctionsInfo.warned.map(({ player: p, yellowCount }) => (
                              <div key={p.id} className="flex items-center justify-between gap-3 bg-brand-black/80 border border-amber-900/50 rounded-xl p-2.5 shadow-sm">
                                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                  <div className="w-10 h-10 rounded-full bg-brand-black-card border border-amber-800/60 overflow-hidden flex items-center justify-center shrink-0">
                                    {p.photo_url ? (
                                      <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-black text-amber-400 font-mono">#{p.number || '-'}</span>
                                    )}
                                  </div>
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {p.number && (
                                        <span className="text-[10px] font-mono font-black text-amber-400 bg-amber-950/80 px-1 rounded shrink-0">#{p.number}</span>
                                      )}
                                      <span className="text-xs font-bold text-white break-words leading-tight">{p.name}</span>
                                    </div>
                                    <span className="text-[10px] text-brand-gray-muted block break-words mt-0.5">{p.position || 'Sin posición'}</span>
                                  </div>
                                </div>
                                <span className="text-[10px] font-black text-amber-400 bg-amber-950 border border-amber-700/60 px-2 py-1 rounded-lg shrink-0">
                                  {yellowCount} 🟨 (Apercibido)
                                </span>
                              </div>
                            ))}
                          </div>
                        </div>
                      ) : (
                        <div className="bg-brand-black/40 border border-brand-black-border rounded-xl p-3 flex items-center gap-2.5 text-xs text-brand-gray-muted">
                          <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                          <span>Sin jugadores apercibidos de sanción actualmente.</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {/* Widgets de Rankings y Posible 11 con diseño de 2 filas y 2 columnas cada uno */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  {/* 1. Posible 11 Inicial (Sin sancionados) */}
                  <div className="bg-brand-black-card border border-emerald-500/30 rounded-2xl p-4 flex flex-col gap-3 shadow-premium">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2.5">
                      <div>
                        <span className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center gap-1.5">
                          🔮 Posible 11 Inicial
                        </span>
                        <span className="text-[10px] text-brand-gray-muted block mt-0.5">
                          11 más utilizados disponibles · Sin sancionados
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-300 font-black bg-emerald-950/80 border border-emerald-700/60 px-2.5 py-0.5 rounded-full shrink-0">
                        {probableEleven.length} / 11
                      </span>
                    </div>
                    {probableEleven.length === 0 ? (
                      <div className="text-center py-6 text-xs text-brand-gray-dark italic flex flex-col items-center gap-1">
                        <Users className="w-6 h-6 opacity-40 text-emerald-400" />
                        <span>Sin datos de titularidades suficientes</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto no-scrollbar pr-1">
                        {probableEleven.map((p, idx) => (
                          <div key={p.id} className="flex flex-col justify-between gap-1.5 p-2 bg-brand-black border border-emerald-950/70 hover:border-emerald-500/40 rounded-xl transition-all group min-w-0">
                            {/* Fila superior: Index, Foto, Dorsal (sin #, más grande), Posición Abreviada y Estadística */}
                            <div className="flex items-center justify-between gap-2 min-w-0">
                              <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                <span className="text-xs font-black w-4 text-center text-emerald-400/80 shrink-0 group-hover:text-emerald-300">
                                  {idx + 1}.
                                </span>
                                <div className="w-8 h-8 rounded-full bg-brand-black-card border border-brand-black-border overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                  {p.photo_url ? (
                                    <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                  ) : (
                                    <span className="text-xs font-bold text-emerald-400">{p.number || '-'}</span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1 min-w-0 shrink-0">
                                  {p.number && (
                                    <span className="text-xs font-black text-emerald-300 bg-emerald-950/90 border border-emerald-800/60 px-1.5 py-0.5 rounded-md shadow-sm shrink-0 leading-none">
                                      {p.number}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-brand-gray-muted uppercase font-mono tracking-wider shrink-0">
                                    {formatPositionAbbr(p.position)}
                                  </span>
                                </div>
                              </div>
                              <div className="shrink-0 flex items-center">
                                <span className="font-bold text-[10px] text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                                  <strong>{p.starter_count ?? 0}</strong> Tit <span className="text-brand-gray-muted font-normal">({p.matches_played ?? 0} PJ)</span>
                                </span>
                              </div>
                            </div>

                            {/* Fila inferior: Nombre completo del jugador abajo para que se lea entero */}
                            <div className="pt-1 border-t border-white/5 min-w-0">
                              <span className="text-[11px] font-bold text-brand-gray-light group-hover:text-white block leading-tight break-words" title={p.name}>
                                {p.name}
                              </span>
                            </div>
                          </div>
                        ))}

                        {sanctionsInfo.sanctioned.length > 0 && (
                          <div className="col-span-full mt-1 p-2.5 bg-red-950/30 border border-red-900/40 rounded-xl text-[10px] text-red-400 space-y-1">
                            <span className="font-black uppercase tracking-wider block">🚫 Excluidos por sanción para el 11:</span>
                            {sanctionsInfo.sanctioned.map(s => (
                              <div key={s.player.id} className="flex items-center justify-between text-[9px] text-red-300">
                                <span className="font-bold truncate mr-2">{s.player.name}</span>
                                <span className="text-red-400 font-mono shrink-0">({s.reason})</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 2. Top Titulares (Los 11 mejores) */}
                  <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-4 flex flex-col gap-3 shadow-premium">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2.5">
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          👕 Más Titulares
                        </span>
                        <span className="text-[10px] text-brand-gray-muted block mt-0.5">
                          Top 11 Habituales ({selectedSeason === '2026-2027' ? '26/27' : '25/26'})
                        </span>
                      </div>
                      <span className="text-[10px] text-sky-400 font-bold bg-sky-950/80 border border-sky-800/40 px-2.5 py-0.5 rounded-full shrink-0">
                        Top 11
                      </span>
                    </div>
                    {rivalRankings.topStarters.length === 0 ? (
                      <div className="text-center py-6 text-xs text-brand-gray-dark italic flex flex-col items-center gap-1">
                        <Users className="w-6 h-6 opacity-40" />
                        <span>Sin titularidades en esta temporada</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto no-scrollbar pr-1">
                        {rivalRankings.topStarters.map((p, idx) => {
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                          return (
                            <div key={p.id} className="flex flex-col justify-between gap-1.5 p-2 bg-brand-black border border-brand-black-border/70 hover:border-sky-500/40 rounded-xl transition-all group min-w-0">
                              {/* Fila superior: Index, Foto, Dorsal (sin #), Posición Abreviada y Estadística */}
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-xs font-black w-4 text-center text-brand-gray-muted shrink-0 group-hover:text-white">
                                    {medal}
                                  </span>
                                  <div className="w-8 h-8 rounded-full bg-brand-black-card border border-brand-black-border overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                    {p.photo_url ? (
                                      <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-sky-400">{p.number || '-'}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 min-w-0 shrink-0">
                                    {p.number && (
                                      <span className="text-xs font-black text-sky-300 bg-sky-950/90 border border-sky-800/60 px-1.5 py-0.5 rounded-md shadow-sm shrink-0 leading-none">
                                        {p.number}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-brand-gray-muted uppercase font-mono tracking-wider shrink-0">
                                      {formatPositionAbbr(p.position)}
                                    </span>
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center">
                                  <span className="font-bold text-[10px] text-sky-400 bg-sky-950/60 border border-sky-800/40 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                                    <strong>{p.starter_count}</strong> Tit <span className="text-brand-gray-muted font-normal">({p.matches_played} PJ)</span>
                                  </span>
                                </div>
                              </div>

                              {/* Fila inferior: Nombre completo del jugador abajo para que se lea entero */}
                              <div className="pt-1 border-t border-white/5 min-w-0">
                                <span className="text-[11px] font-bold text-brand-gray-light group-hover:text-white block leading-tight break-words" title={p.name}>
                                  {p.name}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 3. Top Goleadores (Listado completo) */}
                  <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-4 flex flex-col gap-3 shadow-premium">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2.5">
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          ⚽ Goleadores
                        </span>
                        <span className="text-[10px] text-brand-gray-muted block mt-0.5">
                          Todos ({selectedSeason === '2026-2027' ? '26/27' : '25/26'})
                        </span>
                      </div>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/80 border border-emerald-800/40 px-2.5 py-0.5 rounded-full shrink-0">
                        {rivalRankings.topScorers.length} goleadores
                      </span>
                    </div>
                    {rivalRankings.topScorers.length === 0 ? (
                      <div className="text-center py-6 text-xs text-brand-gray-dark italic flex flex-col items-center gap-1">
                        <Users className="w-6 h-6 opacity-40" />
                        <span>Sin goles registrados en esta temporada</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto no-scrollbar pr-1">
                        {rivalRankings.topScorers.map((p, idx) => {
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;
                          return (
                            <div key={p.id} className="flex flex-col justify-between gap-1.5 p-2 bg-brand-black border border-brand-black-border/70 hover:border-emerald-500/40 rounded-xl transition-all group min-w-0">
                              {/* Fila superior: Index, Foto, Dorsal (sin #), Posición Abreviada y Goles */}
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-xs font-black w-4 text-center text-brand-gray-muted shrink-0 group-hover:text-white">
                                    {medal}
                                  </span>
                                  <div className="w-8 h-8 rounded-full bg-brand-black-card border border-brand-black-border overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                    {p.photo_url ? (
                                      <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-emerald-400">{p.number || '-'}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 min-w-0 shrink-0">
                                    {p.number && (
                                      <span className="text-xs font-black text-brand-red-300 bg-brand-red-950/90 border border-brand-red-800/60 px-1.5 py-0.5 rounded-md shadow-sm shrink-0 leading-none">
                                        {p.number}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-brand-gray-muted uppercase font-mono tracking-wider shrink-0">
                                      {formatPositionAbbr(p.position)}
                                    </span>
                                  </div>
                                </div>
                                <div className="shrink-0 flex items-center">
                                  <span className="font-black text-xs text-emerald-400 bg-emerald-950/60 border border-emerald-800/40 px-2 py-0.5 rounded-lg shadow-sm whitespace-nowrap">
                                    {p.goals} ⚽
                                  </span>
                                </div>
                              </div>

                              {/* Fila inferior: Nombre completo del jugador abajo para que se lea entero */}
                              <div className="pt-1 border-t border-white/5 min-w-0">
                                <span className="text-[11px] font-bold text-brand-gray-light group-hover:text-white block leading-tight break-words" title={p.name}>
                                  {p.name}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* 4. Disciplina / Tarjetas (Listado completo) */}
                  <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-4 flex flex-col gap-3 shadow-premium">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2.5">
                      <div>
                        <span className="text-xs font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                          🟨 Tarjetas & Bajas
                        </span>
                        <span className="text-[10px] text-brand-gray-muted block mt-0.5">
                          Todos ({selectedSeason === '2026-2027' ? '26/27' : '25/26'})
                        </span>
                      </div>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-950/80 border border-amber-800/40 px-2.5 py-0.5 rounded-full shrink-0">
                        {rivalRankings.topCards.length} amonestados
                      </span>
                    </div>
                    {rivalRankings.topCards.length === 0 ? (
                      <div className="text-center py-6 text-xs text-brand-gray-dark italic flex flex-col items-center gap-1">
                        <CheckCircle2 className="w-6 h-6 opacity-40 text-emerald-400" />
                        <span>Sin tarjetas registradas en esta temporada</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[460px] overflow-y-auto no-scrollbar pr-1">
                        {rivalRankings.topCards.map((p, idx) => {
                          const yellow = p.yellow_cards || 0;
                          const isSanction = yellow > 0 && yellow % 5 === 0;
                          const isWarning = yellow > 0 && (yellow + 1) % 5 === 0;
                          const medal = idx === 0 ? '🥇' : idx === 1 ? '🥈' : idx === 2 ? '🥉' : `${idx + 1}.`;

                          return (
                            <div key={p.id} className="flex flex-col justify-between gap-1.5 p-2 bg-brand-black border border-brand-black-border/70 hover:border-amber-500/40 rounded-xl transition-all group min-w-0">
                              {/* Fila superior: Index, Foto, Dorsal (sin #), Posición Abreviada y Tarjetas */}
                              <div className="flex items-center justify-between gap-2 min-w-0">
                                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                  <span className="text-xs font-black w-4 text-center text-brand-gray-muted shrink-0 group-hover:text-white">
                                    {medal}
                                  </span>
                                  <div className="w-8 h-8 rounded-full bg-brand-black-card border border-brand-black-border overflow-hidden flex items-center justify-center shrink-0 shadow-sm">
                                    {p.photo_url ? (
                                      <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-bold text-amber-400">{p.number || '-'}</span>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-1 min-w-0 shrink-0">
                                    {p.number && (
                                      <span className="text-xs font-black text-amber-300 bg-amber-950/90 border border-amber-800/60 px-1.5 py-0.5 rounded-md shadow-sm shrink-0 leading-none">
                                        {p.number}
                                      </span>
                                    )}
                                    <span className="text-[10px] font-bold text-brand-gray-muted uppercase font-mono tracking-wider shrink-0">
                                      {formatPositionAbbr(p.position)}
                                    </span>
                                    {isSanction && (
                                      <span className="text-[8px] font-black text-red-400 bg-red-950 px-1 rounded uppercase shrink-0">Sanción</span>
                                    )}
                                    {isWarning && (
                                      <span className="text-[8px] font-black text-amber-400 bg-amber-950 px-1 rounded uppercase shrink-0">Apercibido</span>
                                    )}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <span className="font-black text-xs text-amber-400 bg-amber-950/60 border border-amber-800/40 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                                    {yellow} 🟨
                                  </span>
                                  {p.red_cards ? (
                                    <span className="font-black text-xs text-red-500 bg-red-950/60 border border-red-800/40 px-1.5 py-0.5 rounded-lg whitespace-nowrap">
                                      {p.red_cards} 🟥
                                    </span>
                                  ) : null}
                                </div>
                              </div>

                              {/* Fila inferior: Nombre completo del jugador abajo para que se lea entero */}
                              <div className="pt-1 border-t border-white/5 min-w-0">
                                <span className="text-[11px] font-bold text-brand-gray-light group-hover:text-white block leading-tight break-words" title={p.name}>
                                  {p.name}
                                </span>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Filtros Toda la Plantilla vs Destacados */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => setRosterFilter('all')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${rosterFilter === 'all' ? 'bg-brand-red-600 text-white' : 'bg-brand-black-card text-brand-gray-muted hover:text-white border border-brand-black-border'}`}
                  >
                    Toda la Plantilla ({displayRoster.length})
                  </button>
                  <button
                    onClick={() => setRosterFilter('featured')}
                    className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1 ${rosterFilter === 'featured' ? 'bg-yellow-500 text-black font-black' : 'bg-brand-black-card text-brand-gray-muted hover:text-yellow-400 border border-brand-black-border'}`}
                  >
                    <Star className={`w-3 h-3 ${rosterFilter === 'featured' ? 'fill-black text-black' : 'fill-yellow-400 text-yellow-400'}`} />
                    Destacados ⭐ ({displayRoster.filter(p => p.is_featured).length})
                  </button>
                </div>
              </div>
            )}

            {editingRoster ? (
              <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium h-[600px]">
                <OpponentRosterManager players={editData.roster_comments || []} onChange={players => setEditData({ ...editData, roster_comments: players })} opponentName={analysis.opponent} />
              </div>
            ) : loadingScouting ? (
              <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl flex flex-col items-center gap-2">
                <div className="w-6 h-6 border-2 border-brand-red-600 border-t-transparent rounded-full animate-spin mb-1" />
                <p>Cargando plantilla y estadísticas de {analysis.opponent}...</p>
              </div>
            ) : filteredRoster.length === 0 ? (
              <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl flex flex-col items-center gap-2">
                <Users className="w-8 h-8 text-brand-gray-dark mb-1" />
                <p>No hay jugadores registrados ni datos de scouting para {analysis.opponent}.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {filteredRoster.map(player => {
                  const yellow = player.yellow_cards || 0;
                  const isSanction = yellow > 0 && yellow % 5 === 0;
                  const isWarning = yellow > 0 && (yellow + 1) % 5 === 0;

                  const pastStats = player.stats_2025_2026;
                  const curStats = player.stats_2026_2027;

                  return (
                    <div key={player.id} className={`bg-brand-black-card border rounded-xl p-4 flex flex-col justify-between gap-3 shadow-lg transition-all ${player.is_featured ? 'border-yellow-500/50 shadow-yellow-500/5' : 'border-brand-black-border'}`}>
                      <div className="flex items-center gap-3 border-b border-brand-black-border pb-3">
                        <div className="shrink-0 w-12 h-12 rounded-full bg-brand-black border border-brand-black-border flex items-center justify-center overflow-hidden relative">
                          {player.photo_url ? (
                            <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full bg-brand-red-600/10 text-brand-red-500 font-bold flex items-center justify-center text-xs">
                              {player.number ? `#${player.number}` : '-'}
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h5 className="text-sm font-bold text-white break-words leading-snug">{player.name}</h5>
                            {player.number && (
                              <span className="text-[10px] text-brand-red-500 font-bold bg-brand-red-600/10 px-1.5 py-0.5 rounded shrink-0">
                                Nº {player.number}
                              </span>
                            )}
                          </div>
                          <div className="flex flex-wrap gap-1.5 items-center mt-1">
                            <span className="text-[10px] text-brand-gray-muted font-mono uppercase bg-black px-1.5 py-0.5 rounded">
                              {player.position || 'Sin Posición'}
                            </span>
                            {player.is_featured && (
                              <span className="text-[9px] font-black text-yellow-400 bg-yellow-950/60 px-1.5 py-0.5 rounded border border-yellow-800 flex items-center gap-1">
                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400 shrink-0" /> Destacado
                              </span>
                            )}
                            {isSanction && (
                              <span className="text-[9px] font-black text-red-400 bg-red-950/60 px-2 py-0.5 rounded border border-red-800 animate-pulse">
                                🟨 {yellow} Amarillas (Sanción)
                              </span>
                            )}
                            {isWarning && (
                              <span className="text-[9px] font-bold text-amber-400 bg-amber-950/60 px-2 py-0.5 rounded border border-amber-800">
                                ⚠️ {yellow} Amarillas (Apercibido)
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Barra de Estadísticas para la Temporada Seleccionada */}
                      <div className="space-y-1.5">
                        <div className="grid grid-cols-4 gap-1.5 bg-black/50 p-2 rounded-lg text-center border border-brand-black-border/60 text-[11px]">
                          <div>
                            <span className="text-[9px] text-brand-gray-muted block uppercase">Partidos</span>
                            <span className="font-bold text-white">{player.matches_played ?? 0} PJ</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-brand-gray-muted block uppercase">Titular</span>
                            <span className="font-bold text-sky-400">{player.starter_count ?? 0} Tit</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-brand-gray-muted block uppercase">Goles</span>
                            <span className="font-bold text-emerald-400">{player.goals ?? 0}</span>
                          </div>
                          <div>
                            <span className="text-[9px] text-brand-gray-muted block uppercase">Tarjetas</span>
                            <span className="font-bold text-yellow-400">🟨 {player.yellow_cards ?? 0}</span>
                            {player.red_cards ? <span className="font-bold text-red-500 ml-1">🟥 {player.red_cards}</span> : null}
                          </div>
                        </div>

                        {/* Badge con los datos de la otra temporada */}
                        {selectedSeason === '2026-2027' ? (
                          pastStats && pastStats.matches > 0 ? (
                            <div className="px-2.5 py-1.5 bg-amber-950/20 border border-amber-500/20 rounded-md text-[10px] flex flex-wrap items-center justify-between gap-1 text-amber-300 font-medium">
                              <span className="flex items-center gap-1 font-bold text-amber-400 shrink-0">
                                📜 Temp 25/26 (Pasada):
                              </span>
                              <span className="ml-auto text-right">
                                {pastStats.matches} PJ ({pastStats.starter} Tit) • {pastStats.goals} ⚽ • {pastStats.yellow_cards} 🟨
                                {pastStats.team && !isSameTeam(pastStats.team, analysis.opponent) && (
                                  <span className="text-brand-gray-muted text-[9px] ml-1 font-normal">({pastStats.team})</span>
                                )}
                              </span>
                            </div>
                          ) : (
                            <div className="px-2.5 py-1 bg-brand-black border border-brand-black-border/40 rounded-md text-[10px] text-brand-gray-dark italic">
                              Sin partidos en 2025/2026
                            </div>
                          )
                        ) : (
                          <div className="px-2.5 py-1.5 bg-brand-red-950/20 border border-brand-red-600/20 rounded-md text-[10px] flex flex-wrap items-center justify-between gap-1 text-brand-red-300 font-medium">
                            <span className="flex items-center gap-1 font-bold text-brand-red-500 shrink-0">
                              🗓️ Temp 26/27 (Actual):
                            </span>
                            <span className="ml-auto text-right">
                              {curStats.matches} PJ ({curStats.starter} Tit) • {curStats.goals} ⚽ • {curStats.yellow_cards} 🟨
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-brand-gray-light whitespace-pre-wrap leading-relaxed flex-1 pt-1">
                        {player.comments || <span className="italic text-brand-gray-dark">Sin comentarios tácticos adicionales.</span>}
                      </p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 3, 4 y 5. Fases con subcategorías */}
          <div id="con_balon" className="scroll-mt-24">
            <PhaseSection phase="con_balon" subSections={subSections} libraryVideos={libraryVideos} canEdit={canEdit} onChange={handleSubSectionsChange} onUpdateLibraryVideos={handleLibraryChange} />
          </div>
          <div id="sin_balon" className="scroll-mt-24">
            <PhaseSection phase="sin_balon" subSections={subSections} libraryVideos={libraryVideos} canEdit={canEdit} onChange={handleSubSectionsChange} onUpdateLibraryVideos={handleLibraryChange} />
          </div>
          <div id="abp" className="scroll-mt-24">
            <PhaseSection phase="abp" subSections={subSections} libraryVideos={libraryVideos} canEdit={canEdit} onChange={handleSubSectionsChange} onUpdateLibraryVideos={handleLibraryChange} />
          </div>

          {/* 6. Presentación a pantalla completa */}
          <div id="presentacion" className="scroll-mt-24 mb-14">
            <SectionTitle title="Presentación" anchor="presentacion" />
            <OpponentPresentationBuilder
              analysis={analysis}
              presentations={presentations}
              libraryVideos={libraryVideos}
              canEdit={canEdit}
              onChange={handlePresentationsChange}
            />
          </div>
        </div>

        {/* ===== Rail Videoteca ===== */}
        <div id="videoteca" className="xl:sticky xl:top-20 scroll-mt-24">
          <OpponentVideoLibrary videos={libraryVideos} onChange={handleLibraryChange} canEdit={canEdit} />
        </div>
      </div>

      {/* Modal para elegir sistema alternativo al añadir */}
      {isAddingAltModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-6 max-w-xl w-full shadow-2xl space-y-5">
            <div className="flex items-center justify-between border-b border-brand-black-border pb-3">
              <div className="flex items-center gap-2">
                <TacticalIcon className="w-5 h-5 text-brand-red-600" />
                <h3 className="text-base font-bold text-white uppercase tracking-wider">Añadir Sistema Alternativo</h3>
              </div>
              <button
                onClick={() => setIsAddingAltModalOpen(false)}
                className="p-1 text-brand-gray-muted hover:text-white rounded-lg hover:bg-brand-black transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div>
              <label className="form-label mb-1">Nombre o Etiqueta (opcional)</label>
              <input
                type="text"
                value={newAltLabel}
                onChange={e => setNewAltLabel(e.target.value)}
                placeholder="Ej: Repliegue bajo 4-4-2, Presión alta 4-3-3, Balón parado"
                className="form-input text-xs"
              />
            </div>

            <div>
              <label className="form-label mb-2">Selecciona la Formación Táctica o Personalizado</label>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 max-h-60 overflow-y-auto pr-1">
                <button
                  type="button"
                  onClick={() => handleCreateAlt('Libre')}
                  className="flex flex-col items-center justify-center p-3 bg-brand-black border border-brand-red-600/50 rounded-xl hover:border-brand-red-600 hover:bg-brand-red-600/10 transition-colors text-center group"
                >
                  <span className="text-xs font-black text-brand-red-500 group-hover:text-white mb-0.5">Personalizado / Libre</span>
                  <span className="text-[10px] text-brand-gray-muted leading-tight">Posicionar 11 jugadores en cualquier coordenada</span>
                </button>
                
                {Object.keys(FORMATIONS_SLOTS).map(sys => {
                  const val = sys.startsWith('1-') ? sys : `1-${sys}`;
                  return (
                    <button
                      key={sys}
                      type="button"
                      onClick={() => handleCreateAlt(val)}
                      className="flex flex-col items-center justify-center p-3 bg-brand-black border border-brand-black-border rounded-xl hover:border-brand-red-600 hover:bg-brand-black-card transition-colors text-center group"
                    >
                      <span className="text-xs font-bold text-white group-hover:text-brand-red-500 mb-0.5">{val}</span>
                      <span className="text-[10px] text-brand-gray-muted">11 posiciones iniciales</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-brand-black-border">
              <button
                type="button"
                onClick={() => setIsAddingAltModalOpen(false)}
                className="btn-secondary py-1.5 px-4 text-xs"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
