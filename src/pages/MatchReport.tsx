import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { CardSkeleton } from '../components/Skeletons';
import { exportMatchReportToPDF } from '../utils/export';
import logos from '../assets/logos.json';
import type { Team } from '../types';
import {
  ArrowLeft, Trophy, Target, Shield, Calendar, Clock,
  PlusCircle, Check, X, ChevronDown, ChevronUp, AlertCircle, Plus,
  FileText, Save, Users, Zap, Edit2
} from 'lucide-react';

import { FORMATIONS_SLOTS } from '../utils/formations';
import { Modal } from '../components/Modal';
import { BodyMap, ZONE_LABELS } from '../components/BodyMap';
import { MatchEventWizard, WizardEventPayload } from '../components/MatchEventWizard';

// Formaciones tácticas y coordenadas en porcentaje (x: 0-100, y: 0-100) para campo vertical


interface LocalPlayerStats {
  player_id: string;
  is_called_up: boolean;
  is_starter: boolean;
  position: string;
  minutes_played: number;
  has_manual_minutes?: boolean;
  goals: number;
  conceded_goals: number;
  own_goals: number;
  assists: number;
  yellow_cards: number;
  red_card: boolean;
  positive_aspects: string;
  improve_aspects: string;
  comments?: string;
  substituted_for?: string;
  substituted_minute?: number;
  event_minutes: {
    goals: string[];
    assists: string[];
    yellow_cards: string[];
    red_card: string | null;
    conceded_goals: string[];
    own_goals: string[];
    penalty_goals: string[];
    conceded_penalty_goals: string[];
    injuries: string[];
    sub_out?: { minute: string; playerInId: string }[];
  };
}


const StarRating = ({ label, value, onChange, disabled }: { label: string, value: number, onChange: (v: number) => void, disabled: boolean }) => (
  <div className="flex items-center justify-between text-[11px] py-1 border-t border-brand-black-border/50 mt-1 pt-2">
    <span className="text-brand-gray-light font-medium">{label}</span>
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <button
          key={star}
          type="button"
          onClick={() => !disabled && onChange(star)}
          disabled={disabled}
          className={`w-3.5 h-3.5 focus:outline-none ${disabled ? 'cursor-not-allowed opacity-70' : 'cursor-pointer hover:scale-125 transition-transform'}`}
        >
          <svg viewBox="0 0 24 24" fill={star <= value ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" className={star <= value ? 'text-yellow-400' : 'text-brand-gray-muted'}>
            <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
          </svg>
        </button>
      ))}
    </div>
  </div>
);

export const MatchReport: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission('matches', 'editar');

  const [isEditing, setIsEditing] = useState(true);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [teamPositiveAspects, setTeamPositiveAspects] = useState('');
  const [teamImproveAspects, setTeamImproveAspects] = useState('');
  const [teamRatings, setTeamRatings] = useState({
    with_ball: { salida_balon: 0, posesion: 0, finalizacion: 0, juego_directo: 0, ocupacion_area: 0 },
    without_ball: { presion_alta: 0, bloque_medio: 0, bloque_bajo: 0, defensa_area: 0 },
    set_pieces: { ofensiva: 0, defensiva: 0 }
  });
  const isFirstRender = useRef(true);
  // Bloquea el auto-guardado mientras se está borrando el acta, para que el
  // debounce no vuelva a escribir el estado local en la BBDD tras el reset.
  const isDeletingRef = useRef(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    if (params.get('edit') === 'true' && canEdit) {
      setIsEditing(true);
    }
  }, [location.search, canEdit]);


  // Estados Locales del Partido
  const [scoreUs, setScoreUs] = useState<number>(0);
  const [scoreThem, setScoreThem] = useState<number>(0);
  const [tacticalSystem, setTacticalSystem] = useState<string>('4-3-3');
  const [tacticalWithBall, setTacticalWithBall] = useState<string>('');
  const [tacticalWithoutBall, setTacticalWithoutBall] = useState<string>('');
  const [tacticalSetPieces, setTacticalSetPieces] = useState<string>('');
  const [tacticalGeneral, setTacticalGeneral] = useState<string>('');
  const [opponentEvents, setOpponentEvents] = useState<{
    goals: { minute: string, dorsal?: string, isOwnGoal?: boolean }[],
    yellow_cards: { minute: string, dorsal: string }[],
    own_goals?: { minute: string }[]
  }>({ goals: [], yellow_cards: [], own_goals: [] });

  // Alineación (mapea slot de la formación a ID de jugador)
  const [lineup, setLineup] = useState<Record<number, string>>({});
  const [activeSlotForSelection, setActiveSlotForSelection] = useState<number | null>(null);

  // Estadísticas locales de los jugadores
  const [playerStats, setPlayerStats] = useState<Record<string, LocalPlayerStats>>({});
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // Buscador para añadir jugadores a la convocatoria sobre la marcha
  const [showAddPlayerDropdown, setShowAddPlayerDropdown] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Asistente de eventos
  const [isEventWizardOpen, setIsEventWizardOpen] = useState(false);
  const [matchDuration, setMatchDuration] = useState<number>(90);

  const parseAbsoluteMinute = (minuteStr: any): number => {
    if (!minuteStr) return matchDuration;
    const str = String(minuteStr).trim();
    let minuteNum = matchDuration;
    const parts = str.split(' ');
    if (parts.length > 1) {
      const period = parts[0].toUpperCase();
      const min = parseInt(parts[1].split('+')[0].replace(/\D/g, '')) || 0;
      if (period === '1T') minuteNum = min;
      else if (period === '2T') minuteNum = min + Math.floor(matchDuration / 2);
      else if (period === '1P' || period === 'PR1') minuteNum = min + matchDuration;
      else if (period === '2P' || period === 'PR2') minuteNum = min + matchDuration + 15;
      else minuteNum = min;
    } else {
      minuteNum = parseInt(str.split('+')[0].replace(/\D/g, '')) || matchDuration;
    }
    return minuteNum;
  };

  const recalculateAllMinutes = (stats: Record<string, LocalPlayerStats>, detectManualOverride = false) => {
    const next = { ...stats };
    
    // Build chronological substitution timeline
    const subEvents: { time: number; playerOutId: string; playerInId: string }[] = [];
    
    Object.values(next).forEach(p => {
      // Collect from legacy fields
      if (p.substituted_for && p.substituted_minute) {
        subEvents.push({
          time: p.substituted_minute,
          playerOutId: p.player_id,
          playerInId: p.substituted_for
        });
      }
      
      // Collect from new sub_out array
      if (p.event_minutes?.sub_out) {
        p.event_minutes.sub_out.forEach(sub => {
           subEvents.push({
             time: parseAbsoluteMinute(sub.minute),
             playerOutId: p.player_id,
             playerInId: sub.playerInId
           });
        });
      }
    });

    // Remove exact duplicates
    const uniqueSubs = Array.from(new Set(subEvents.map(e => JSON.stringify(e))))
      .map(e => JSON.parse(e) as { time: number; playerOutId: string; playerInId: string })
      .sort((a, b) => a.time - b.time);

    // Track state of each player
    const playerStints: Record<string, { start: number; end: number | null }[]> = {};
    
    Object.values(next).forEach(p => {
      playerStints[p.player_id] = [];
      if (p.is_starter) {
        playerStints[p.player_id].push({ start: 0, end: null });
      }
    });

    // Process substitutions chronologically
    uniqueSubs.forEach(sub => {
      const outStints = playerStints[sub.playerOutId];
      if (outStints && outStints.length > 0) {
        const lastStint = outStints[outStints.length - 1];
        if (lastStint.end === null) {
          lastStint.end = sub.time;
        }
      }
      
      const inStints = playerStints[sub.playerInId];
      if (inStints) {
        inStints.push({ start: sub.time, end: null });
      }
    });

    // Finalize stints
    Object.values(next).forEach(p => {
      let calculatedMinutes = 0;
      const stints = playerStints[p.player_id];
      if (stints) {
        let finalExit = matchDuration;
        if (p.red_card && p.event_minutes?.red_card) {
           finalExit = parseAbsoluteMinute(p.event_minutes.red_card);
        }
        
        stints.forEach(stint => {
          if (stint.end === null) {
            stint.end = finalExit;
          }
        });
        
        stints.forEach(stint => {
           const start = Math.min(stint.start, matchDuration);
           const end = Math.min(stint.end!, matchDuration);
           if (end > start) {
             calculatedMinutes += (end - start);
           }
        });
      } else {
        calculatedMinutes = 0;
      }

      if (detectManualOverride) {
        const hasStints = stints && stints.length > 0;
        const isDifferent = p.minutes_played !== calculatedMinutes;
        if (!hasStints && isDifferent && p.minutes_played > 0) {
          next[p.player_id].has_manual_minutes = true;
        } else {
          next[p.player_id].minutes_played = calculatedMinutes;
        }
      } else {
        if (p.has_manual_minutes) {
          // Keep manual minutes, don't overwrite!
        } else {
          next[p.player_id].minutes_played = calculatedMinutes;
        }
      }
    });

    return next;
  };

  useEffect(() => {
    if (statsInitializedRef.current && Object.keys(playerStats).length > 0) {
      setPlayerStats(prev => recalculateAllMinutes(prev));
    }
  }, [matchDuration]);

  // Marcar que hay cambios sin guardar
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    if (isEditing) {
      setHasUnsavedChanges(true);
    }
  }, [playerStats, lineup, scoreUs, scoreThem, tacticalSystem, tacticalWithBall, tacticalWithoutBall, tacticalSetPieces, tacticalGeneral, opponentEvents, teamRatings, teamPositiveAspects, teamImproveAspects, isEditing]);

  // Prevenir navegación si hay cambios sin guardar
  useEffect(() => {
    if (!hasUnsavedChanges) return;

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };

    const handleClick = (e: MouseEvent) => {
      const target = (e.target as Element).closest('a');
      if (target && target.href && target.origin === window.location.origin) {
        if (!window.confirm('Tienes cambios guardándose en el acta. ¿Seguro que quieres salir?')) {
          e.preventDefault();
          e.stopPropagation();
        }
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('click', handleClick, { capture: true });

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('click', handleClick, { capture: true });
    };
  }, [hasUnsavedChanges]);

  // Auto-guardado con debounce de 1.5s
  useEffect(() => {
    if (hasUnsavedChanges && isEditing) {
      const timer = setTimeout(() => {
        if (isDeletingRef.current) return;
        saveMutation.mutate();
      }, 1500);
      return () => clearTimeout(timer);
    }
  }, [hasUnsavedChanges, playerStats, lineup, scoreUs, scoreThem, tacticalSystem, tacticalWithBall, tacticalWithoutBall, tacticalSetPieces, tacticalGeneral, opponentEvents, teamRatings, teamPositiveAspects, teamImproveAspects, isEditing]);

  // 1. Cargar Partido
  const { data: matchesList = [], isLoading: isLoadingMatch } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  const matchData = useMemo(() => {
    return matchesList.find(m => m.id === matchId);
  }, [matchesList, matchId]);

  // 2. Cargar Plantilla completa de Jugadores
  const { data: dbPlayers = [], isLoading: isLoadingPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers()
  });

  // 3. Cargar Estadísticas previas de este partido
  const { data: initialStats = [], isLoading: isLoadingStats, isFetching: isFetchingStats } = useQuery({
    queryKey: ['playerMatchStats', matchId],
    queryFn: () => dataService.getPlayerMatchStats(matchId || ''),
    enabled: !!matchId
  });

  const { data: dbTeams = [] } = useQuery<Team[]>({
    queryKey: ['teams'],
    queryFn: dataService.getTeams
  });

  const getTeamLogo = (teamName: string): string => {
    const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
    const target = normalize(teamName);
    
    const dbTeam = dbTeams.find(t => normalize(t.name) === target);
    if (dbTeam?.shield_url) {
      return dbTeam.shield_url;
    }
    
    const matchKey = Object.keys(logos).find(key => normalize(key) === target);
    if (matchKey) {
      return (logos as Record<string, string>)[matchKey];
    }
    return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
  };

  const matchStatus = useMemo<'Programado' | 'Jugado'>(() => {
    return Object.values(playerStats).some(p => p.is_called_up) ? 'Jugado' : 'Programado';
  }, [playerStats]);

  // Inicializar estado del formulario con los datos de BD
  useEffect(() => {
    if (matchData) {
      setScoreUs(matchData.score_us !== null ? matchData.score_us : 0);
      setScoreThem(matchData.score_them !== null ? matchData.score_them : 0);
      setTacticalSystem(matchData.tactical_system || '4-3-3');
      setTacticalWithBall(matchData.tactical_with_ball || '');
      setTacticalWithoutBall(matchData.tactical_without_ball || '');
      setTacticalSetPieces(matchData.tactical_set_pieces || '');
      setTacticalGeneral(matchData.tactical_general || '');
      const oppEvts = (matchData.opponent_events || {}) as any;
      setOpponentEvents({
        goals: oppEvts.goals || [],
        yellow_cards: oppEvts.yellow_cards || [],
        own_goals: oppEvts.own_goals || []
      });
      setTeamPositiveAspects(matchData.team_positive_aspects || '');
      setTeamImproveAspects(matchData.team_improve_aspects || '');
      if (matchData.team_ratings) {
        setTeamRatings(prev => ({
          with_ball: { ...prev.with_ball, ...(matchData.team_ratings!.with_ball || {}) },
          without_ball: { ...prev.without_ball, ...(matchData.team_ratings!.without_ball || {}) },
          set_pieces: { ...prev.set_pieces, ...(matchData.team_ratings!.set_pieces || {}) }
        }));
      }
    }
  }, [matchData]);

  const statsInitializedRef = useRef(false);

  // Inicializar estadísticas e XI Inicial
  useEffect(() => {
    if (statsInitializedRef.current) return;
    if (dbPlayers.length === 0 || isLoadingStats || isFetchingStats || isLoadingPlayers || !matchData) return;
    
    statsInitializedRef.current = true;

    if (initialStats) {
      const hasActa = matchData.status === 'Jugado' || typeof matchData.score_us === 'number' || !!matchData.tactical_system;
      if (hasActa) {
        const params = new URLSearchParams(location.search);
        if (params.get('edit') !== 'true') {
          setIsEditing(false);
        }
      }
      
      const statsMap: Record<string, LocalPlayerStats> = {};
      
      dbPlayers.forEach(p => {
        const init = initialStats.find(s => s.player_id === p.id);
        statsMap[p.id] = {
          player_id: p.id,
          is_called_up: init ? init.is_called_up : false,
          is_starter: init ? !!init.is_starter : false,
          position: init ? init.position || '' : '',
          minutes_played: init ? (init.minutes_played || (init.is_starter ? matchDuration : 0)) : 0,
          goals: init ? init.goals || 0 : 0,
          conceded_goals: init ? init.conceded_goals || 0 : 0,
          own_goals: init ? init.own_goals || 0 : 0,
          assists: init ? init.assists || 0 : 0,
          yellow_cards: init ? init.yellow_cards || 0 : 0,
          red_card: init ? !!init.red_card : false,
          positive_aspects: init ? init.positive_aspects || '' : '',
          improve_aspects: init ? init.improve_aspects || '' : '',
          comments: init ? init.comments || '' : '',
          substituted_for: init ? init.substituted_for || undefined : undefined,
          substituted_minute: init ? init.substituted_minute || undefined : undefined,
          event_minutes: {
            goals: init?.event_minutes?.goals || [],
            assists: init?.event_minutes?.assists || [],
            yellow_cards: init?.event_minutes?.yellow_cards || [],
            red_card: init?.event_minutes?.red_card || null,
            conceded_goals: init?.event_minutes?.conceded_goals || [],
            own_goals: init?.event_minutes?.own_goals || [],
            penalty_goals: init?.event_minutes?.penalty_goals || [],
            conceded_penalty_goals: init?.event_minutes?.conceded_penalty_goals || [],
            injuries: init?.event_minutes?.injuries || [],
            sub_out: init?.event_minutes?.sub_out || [],
          }
        };
      });

      setPlayerStats(recalculateAllMinutes(statsMap, true));

      // Reconstruir el XI Inicial (lineup) asociando los jugadores marcados como titulares
      // a sus posiciones en la formación actual
      const initialTacticalSystem = matchData.tactical_system || '4-3-3';
      const slots = FORMATIONS_SLOTS[initialTacticalSystem] || FORMATIONS_SLOTS['4-3-3'];
      const builtLineup: Record<number, string> = {};
      let needsUpdate = false;
      const updatedStats = { ...statsMap };

      const starterStats = initialStats.filter(s => s.is_starter && s.is_called_up);
      starterStats.forEach(stat => {
        let exactSlotIdx = -1;
        let actualRole = stat.position || '';
        
        // Extract slotIdx if it exists (e.g. "2:Defensa Central")
        const match = actualRole.match(/^(\d+):(.*)$/);
        if (match) {
           exactSlotIdx = parseInt(match[1], 10);
           actualRole = match[2];
        }

        let slotIdx = -1;
        
        // Try to place in the exact slot index first (if it's free and role matches)
        if (exactSlotIdx !== -1 && !builtLineup[exactSlotIdx]) {
           const targetSlot = slots[exactSlotIdx];
           if (targetSlot && (targetSlot.role === actualRole || targetSlot.label === actualRole)) {
             slotIdx = exactSlotIdx;
           }
        }
        
        // Fallback: Find first compatible free slot
        if (slotIdx === -1) {
          slotIdx = slots.findIndex((slot, idx) => 
            (slot.role === actualRole || slot.label === actualRole) && !builtLineup[idx]
          );
        }

        if (slotIdx !== -1) {
          builtLineup[slotIdx] = stat.player_id;
          const expectedPos = `${slotIdx}:${slots[slotIdx].role}`;
          if (updatedStats[stat.player_id] && updatedStats[stat.player_id].position !== expectedPos) {
            updatedStats[stat.player_id] = { ...updatedStats[stat.player_id], position: expectedPos };
            needsUpdate = true;
          }
        } else {
          // Si no coincide el rol exacto, poner en el primer slot vacío
          const firstEmpty = slots.findIndex((_, idx) => !builtLineup[idx]);
          if (firstEmpty !== -1) {
            builtLineup[firstEmpty] = stat.player_id;
            const expectedPos = `${firstEmpty}:${slots[firstEmpty].role}`;
            if (updatedStats[stat.player_id]) {
              updatedStats[stat.player_id] = { ...updatedStats[stat.player_id], position: expectedPos };
              needsUpdate = true;
            }
          }
        }
      });

      // Auto-sanar posiciones de los suplentes basados en a quién sustituyeron
      const subStats = initialStats.filter(s => !s.is_starter && s.is_called_up && s.substituted_for);
      subStats.forEach(stat => {
        const playerOutId = stat.substituted_for;
        if (playerOutId && updatedStats[playerOutId] && updatedStats[playerOutId].position) {
           const outPos = updatedStats[playerOutId].position;
           if (updatedStats[stat.player_id] && updatedStats[stat.player_id].position !== outPos) {
              updatedStats[stat.player_id] = { ...updatedStats[stat.player_id], position: outPos };
              needsUpdate = true;
           }
        }
      });

      setLineup(builtLineup);
      if (needsUpdate) {
        setPlayerStats(recalculateAllMinutes(updatedStats));
        setHasUnsavedChanges(true);
      }
    }
  }, [dbPlayers, initialStats, tacticalSystem, isLoadingStats, isFetchingStats, isLoadingPlayers, matchData]);

  // Slots de la formación táctica elegida
  const currentSlots = useMemo(() => {
    return FORMATIONS_SLOTS[tacticalSystem] || FORMATIONS_SLOTS['4-3-3'];
  }, [tacticalSystem]);

  // Lista de jugadores convocados
  const calledUpPlayers = useMemo(() => {
    return dbPlayers.filter(p => playerStats[p.id]?.is_called_up);
  }, [dbPlayers, playerStats]);

  // Jugadores convocados que no están colocados como titulares
  const availableSubstitutes = useMemo(() => {
    const placedIds = Object.values(lineup);
    return calledUpPlayers.filter(p => !placedIds.includes(p.id));
  }, [calledUpPlayers, lineup]);

  // Asignar jugador a una posición táctica del campo
  const handleAssignPlayer = (slotIdx: number, playerId: string) => {
    const previousPlayerId = lineup[slotIdx];

    setLineup(prev => {
      const next = { ...prev };
      // Quitar al jugador si ya estaba en otra demarcación
      Object.keys(next).forEach(k => {
        const idx = parseInt(k);
        if (next[idx] === playerId) delete next[idx];
      });
      next[slotIdx] = playerId;
      return next;
    });

    setPlayerStats(prev => {
      const next = { ...prev };
      // El jugador previo deja de ser titular
      if (previousPlayerId && previousPlayerId !== playerId && next[previousPlayerId]) {
        next[previousPlayerId] = {
          ...next[previousPlayerId],
          is_starter: false,
          position: ''
        };
      }
      // El nuevo jugador se convierte en titular con el rol del slot
      if (next[playerId]) {
        next[playerId] = {
          ...next[playerId],
          is_starter: true,
          position: `${slotIdx}:${currentSlots[slotIdx].role}`
        };
      }
      return recalculateAllMinutes(next);
    });

    setActiveSlotForSelection(null);
  };

  // Quitar un jugador de la alineación titular (pasa a suplente)
  const handleRemovePlayerFromLineup = (slotIdx: number) => {
    const playerId = lineup[slotIdx];
    if (!playerId) return;

    setLineup(prev => {
      const next = { ...prev };
      delete next[slotIdx];
      return next;
    });

    setPlayerStats(prev => {
      const next = { ...prev };
      if (next[playerId]) {
        next[playerId] = {
          ...next[playerId],
          is_starter: false,
          position: ''
        };
      }
      return recalculateAllMinutes(next);
    });
  };

  // Manejar cambios en estadísticas numéricas y redimensionar los arrays de minutos
  const handleStatChange = (playerId: string, field: keyof LocalPlayerStats, val: any) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      let updated: LocalPlayerStats = { ...player, [field]: val };

      if (field === 'minutes_played') {
        updated.has_manual_minutes = true;
      }

      // Redimensionar el listado de minutos según el número de eventos
      if (field === 'goals') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.goals || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push('90'); // default minute
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, goals: arr };
      } else if (field === 'conceded_goals') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.conceded_goals || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push('90');
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, conceded_goals: arr };
      } else if (field === 'own_goals') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.own_goals || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push('90');
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, own_goals: arr };
      } else if (field === 'assists') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.assists || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push('90');
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, assists: arr };
      } else if (field === 'yellow_cards') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.yellow_cards || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push('90');
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, yellow_cards: arr };
      } else if (field === 'red_card') {
        const hasRed = !!val;
        const updatedMinutes = {
          goals: Array.isArray(player.event_minutes?.goals) ? player.event_minutes.goals : [],
          assists: Array.isArray(player.event_minutes?.assists) ? player.event_minutes.assists : [],
          yellow_cards: Array.isArray(player.event_minutes?.yellow_cards) ? player.event_minutes.yellow_cards : [],
          red_card: hasRed ? (player.event_minutes?.red_card || matchDuration.toString()) : null,
          conceded_goals: Array.isArray(player.event_minutes?.conceded_goals) ? player.event_minutes.conceded_goals : [],
          own_goals: Array.isArray(player.event_minutes?.own_goals) ? player.event_minutes.own_goals : [],
          penalty_goals: Array.isArray(player.event_minutes?.penalty_goals) ? player.event_minutes.penalty_goals : [],
          conceded_penalty_goals: Array.isArray(player.event_minutes?.conceded_penalty_goals) ? player.event_minutes.conceded_penalty_goals : [],
          injuries: Array.isArray(player.event_minutes?.injuries) ? player.event_minutes.injuries : [],
        };

        const updateArrayWithDefaults = (arr: any[], count: number) => {
          if (arr.length > count) return arr.slice(0, count);
          if (arr.length < count) {
            while (arr.length < count) arr.push(matchDuration.toString());
          }
          return arr;
        };

        updatedMinutes.goals = updateArrayWithDefaults(updatedMinutes.goals, player.goals);
        updatedMinutes.assists = updateArrayWithDefaults(updatedMinutes.assists, player.assists);
        updatedMinutes.yellow_cards = updateArrayWithDefaults(updatedMinutes.yellow_cards, player.yellow_cards);
        updatedMinutes.conceded_goals = updateArrayWithDefaults(updatedMinutes.conceded_goals, player.conceded_goals || 0);
        updatedMinutes.own_goals = updateArrayWithDefaults(updatedMinutes.own_goals, player.own_goals || 0);
        updated.event_minutes = updatedMinutes;
      }

      next[playerId] = updated;
      return recalculateAllMinutes(next);
    });
  };

  // Manejar cambios en los minutos específicos de un evento
  const handleEventMinuteChange = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'penalty_goals' | 'conceded_penalty_goals', index: number, value: string) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      const eventMin = { ...player.event_minutes };
      if (type === 'red_card') {
        eventMin.red_card = value;
      } else {
        const arr = [...(eventMin[type] || [])];
        arr[index] = value;
        eventMin[type] = arr;
      }

      next[playerId] = { ...player, event_minutes: eventMin };
      return recalculateAllMinutes(next);
    });
  };

  // Añadir un evento específico desde la cronología
  const handleAddMatchEvent = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals' | 'opponent_goal' | 'opponent_yellow_card' | 'injury' | 'opponent_own_goal' | 'own_goal_team', minuteStr: string, playerInId?: string, positionIn?: string, opponentDorsal?: string) => {
    if (type === 'opponent_goal') {
      setOpponentEvents(prev => ({
        ...prev,
        goals: [...prev.goals, { minute: minuteStr, dorsal: opponentDorsal || '?' }]
      }));
      return;
    }
    
    if (type === 'opponent_yellow_card') {
      setOpponentEvents(prev => ({
        ...prev,
        yellow_cards: [...prev.yellow_cards, { minute: minuteStr, dorsal: opponentDorsal || '?' }]
      }));
      return;
    }

    if (type === 'opponent_own_goal') {
      setOpponentEvents(prev => ({
        ...prev,
        own_goals: [...(prev.own_goals || []), { minute: minuteStr }]
      }));
      return;
    }

    if (type === 'own_goal_team') {
      setOpponentEvents(prev => ({
        ...prev,
        goals: [...prev.goals, { minute: minuteStr, isOwnGoal: true }]
      }));
      return;
    }

    if (type === 'injury') {
      // Lesiones se guardan al hacer saveMatch o podemos simplemente mostrar un toast
      // Para mostrarlo en la cronología, podemos añadirlo temporalmente si tuviéramos un estado local para lesiones,
      // pero como se va a guardar directo a BBDD en saveMutation, lo ideal es guardarlo de forma independiente o en el payload.
      // Por ahora vamos a mostrar un aviso, el usuario debería guardarlo desde otro modal o lo guardaremos en el save.
    }

    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      if (type === 'substitution') {
        // Obtenemos el minuto global para los minutos jugados y el campograma
        const minuteNum = parseAbsoluteMinute(minuteStr);
        
        if (playerInId) {
          const playerIn = next[playerInId];
          if (playerIn) {
            const eventMin = { ...(player.event_minutes || {}) };
            const subOut = [...(eventMin.sub_out || [])];
            subOut.push({ minute: minuteStr, playerInId });
            eventMin.sub_out = subOut;

            next[playerId] = {
              ...player,
              substituted_for: playerInId,
              substituted_minute: minuteNum,
              event_minutes: eventMin
            };
            next[playerInId] = {
              ...playerIn,
              position: positionIn || playerIn.position || ''
            };
          }
        }
        return recalculateAllMinutes(next);
      }

      const eventMin = { ...player.event_minutes };

      if (type === 'red_card') {
        eventMin.red_card = minuteStr;
        next[playerId] = {
          ...player,
          red_card: true,
          event_minutes: eventMin
        };
      } else if (type === 'injury') {
        const arr = [...(eventMin.injuries || []), minuteStr];
        eventMin.injuries = arr;
        next[playerId] = {
          ...player,
          event_minutes: eventMin
        };
      } else {
        const evType = type as 'goals' | 'assists' | 'yellow_cards' | 'conceded_goals' | 'own_goals' | 'penalty_goals' | 'conceded_penalty_goals';
        const arr = [...(eventMin[evType] || []), minuteStr];
        eventMin[evType] = arr;
        
        const countField = evType === 'penalty_goals' ? 'goals' : evType === 'conceded_penalty_goals' ? 'conceded_goals' : evType;
        const total = (eventMin[countField === 'goals' ? 'goals' : countField === 'conceded_goals' ? 'conceded_goals' : evType]?.length || 0) + 
                      (countField === 'goals' ? (eventMin.penalty_goals?.length || 0) : countField === 'conceded_goals' ? (eventMin.conceded_penalty_goals?.length || 0) : 0);
        
        next[playerId] = {
          ...player,
          [countField]: total,
          event_minutes: eventMin
        };
      }

      return recalculateAllMinutes(next);
    });
  };

  const handleSaveWizardEvents = async (events: WizardEventPayload[]) => {
    let injuryAdded = false;
    let successCount = 0;

    for (const evt of events) {
      if (evt.type === 'injury' && evt.injuryData && evt.playerId) {
        try {
          await dataService.createPlayerInjury({
            player_id: evt.playerId,
            injury_date: new Date().toISOString().split('T')[0],
            body_zone: evt.injuryData.zone !== 'No especificada' ? evt.injuryData.zone : 'abdomen',
            body_side: evt.injuryData.side,
            diagnosis: `Lesión registrada en partido`,
            origin: `Jornada ${matchData?.matchday || '?'}, vs ${matchData?.rival || '?'}, Min. ${evt.minuteStr}`,
            match_id: matchData?.id,
            severity: evt.injuryData.severity as 'Leve' | 'Moderada' | 'Grave',
            status: 'Activa',
            competitive_leave: evt.injuryData.severity !== 'Leve'
          });
          handleAddMatchEvent(evt.playerId, 'injury', evt.minuteStr);
          injuryAdded = true;
          successCount++;
        } catch (e) {
          console.error(e);
          showToast('error', 'Error', 'No se pudo guardar la lesión de un jugador.');
        }
      } else {
        handleAddMatchEvent(
          evt.playerId || '', 
          evt.type, 
          evt.minuteStr, 
          evt.playerInId, 
          evt.positionIn, 
          evt.opponentDorsal
        );
        successCount++;
      }
    }

    if (successCount > 0) {
      if (injuryAdded && events.length === 1) {
        showToast('success', 'Lesión registrada', 'La lesión se ha guardado en el historial.');
      } else if (events.length > 1) {
        showToast('success', 'Incidencias añadidas', `Se han registrado ${successCount} eventos.`);
      } else {
        showToast('success', 'Incidencia añadida', 'El evento ha sido registrado.');
      }
    }
  };

  // Quitar un evento específico desde la cronología
  const handleRemoveMatchEvent = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals' | 'opponent_goal' | 'opponent_yellow_card' | 'injury' | 'opponent_own_goal' | 'own_goal_team', minuteStr: string, indexInType?: number) => {
    if (type === 'opponent_goal' || type === 'own_goal_team') {
      setOpponentEvents(prev => {
        const goals = [...prev.goals];
        if (indexInType !== undefined) goals.splice(indexInType, 1);
        return { ...prev, goals };
      });
      return;
    }
    
    if (type === 'opponent_yellow_card') {
      setOpponentEvents(prev => {
        const ycs = [...prev.yellow_cards];
        if (indexInType !== undefined) ycs.splice(indexInType, 1);
        return { ...prev, yellow_cards: ycs };
      });
      return;
    }

    if (type === 'opponent_own_goal') {
      setOpponentEvents(prev => {
        const ogs = [...(prev.own_goals || [])];
        if (indexInType !== undefined) ogs.splice(indexInType, 1);
        return { ...prev, own_goals: ogs };
      });
      return;
    }

    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      if (type === 'substitution') {
        const eventMin = { ...player.event_minutes };
        let playerInId = player.substituted_for;
        
        if (eventMin.sub_out) {
          const subIndex = eventMin.sub_out.findIndex(s => s.minute === minuteStr);
          if (subIndex > -1) {
            playerInId = eventMin.sub_out[subIndex].playerInId;
            const newSubOut = [...eventMin.sub_out];
            newSubOut.splice(subIndex, 1);
            eventMin.sub_out = newSubOut;
          }
        }

        next[playerId] = {
          ...player,
          event_minutes: eventMin
        };

        // Si es el último o único cambio heredado, lo limpiamos también por consistencia
        if (player.substituted_minute === parseAbsoluteMinute(minuteStr)) {
          next[playerId].substituted_for = undefined;
          next[playerId].substituted_minute = undefined;
        }

        if (playerInId && next[playerInId]) {
          next[playerInId] = {
            ...next[playerInId],
            position: ''
          };
        }
        return recalculateAllMinutes(next);
      }

      const eventMin = { ...player.event_minutes };

      if (type === 'red_card') {
        eventMin.red_card = null;
        next[playerId] = {
          ...player,
          red_card: false,
          event_minutes: eventMin
        };
      } else {
        const evType = type as 'goals' | 'assists' | 'yellow_cards' | 'conceded_goals' | 'own_goals' | 'penalty_goals' | 'conceded_penalty_goals';
        if (indexInType !== undefined) {
          const arr = [...(eventMin[evType] || [])];
          arr.splice(indexInType, 1);
          eventMin[evType] = arr;

          const countField = evType === 'penalty_goals' ? 'goals' : evType === 'conceded_penalty_goals' ? 'conceded_goals' : evType;
          const total = (eventMin[countField === 'goals' ? 'goals' : countField === 'conceded_goals' ? 'conceded_goals' : evType]?.length || 0) + 
                        (countField === 'goals' ? (eventMin.penalty_goals?.length || 0) : countField === 'conceded_goals' ? (eventMin.conceded_penalty_goals?.length || 0) : 0);

          next[playerId] = {
            ...player,
            [countField]: total,
            event_minutes: eventMin
          };
        }
      }

      return recalculateAllMinutes(next);
    });
  };

  // Consolidar todos los eventos de forma ordenada para la línea de tiempo
  const matchEvents = useMemo(() => {
    const eventsList: {
      id: string;
      playerId: string;
      playerName: string;
      type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals' | 'opponent_goal' | 'opponent_yellow_card' | 'injury' | 'opponent_own_goal' | 'own_goal_team';
      minute: string;
      indexInType: number;
      extraInfo?: string;
    }[] = [];

    // Añadir eventos del rival
    opponentEvents.goals?.forEach((g, idx) => {
      if (g.isOwnGoal) {
        eventsList.push({ id: `opp-goal-og-${idx}-${g.minute}`, playerId: '', playerName: 'U.D. Atzeneta', type: 'own_goal_team', minute: g.minute, indexInType: idx });
      } else {
        eventsList.push({ id: `opp-goal-${idx}-${g.minute}`, playerId: '', playerName: `Rival #${g.dorsal || '?'}`, type: 'opponent_goal', minute: g.minute, indexInType: idx });
      }
    });
    
    opponentEvents.own_goals?.forEach((og, idx) => {
      eventsList.push({ id: `opp-og-${idx}-${og.minute}`, playerId: '', playerName: 'Rival', type: 'opponent_own_goal', minute: og.minute, indexInType: idx });
    });
    
    opponentEvents.yellow_cards?.forEach((yc, idx) => {
      eventsList.push({ id: `opp-yc-${idx}-${yc.minute}`, playerId: '', playerName: `Rival #${yc.dorsal || '?'}`, type: 'opponent_yellow_card', minute: yc.minute, indexInType: idx });
    });

    Object.values(playerStats).forEach(stat => {
      const playerObj = dbPlayers.find(p => p.id === stat.player_id);
      const playerName = playerObj ? (playerObj.nickname || playerObj.full_name) : 'Jugador';

      stat.event_minutes.goals?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-goals-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'goals', minute: min, indexInType: idx });
      });
      
      stat.event_minutes.penalty_goals?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-penalty_goals-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'penalty_goals', minute: min, indexInType: idx });
      });

      stat.event_minutes.conceded_goals?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-conceded_goals-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'conceded_goals', minute: min, indexInType: idx });
      });
      
      stat.event_minutes.conceded_penalty_goals?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-conceded_penalty_goals-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'conceded_penalty_goals', minute: min, indexInType: idx });
      });

      stat.event_minutes.own_goals?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-own_goals-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'own_goals', minute: min, indexInType: idx });
      });

      stat.event_minutes.assists?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-assists-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'assists', minute: min, indexInType: idx });
      });

      stat.event_minutes.yellow_cards?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-yellow_cards-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'yellow_cards', minute: min, indexInType: idx });
      });

      stat.event_minutes.injuries?.forEach((min, idx) => {
        eventsList.push({ id: `${stat.player_id}-injury-${idx}-${min}`, playerId: stat.player_id, playerName, type: 'injury', minute: min, indexInType: idx });
      });

      if (stat.red_card && stat.event_minutes.red_card !== null && stat.event_minutes.red_card !== undefined) {
        eventsList.push({ id: `${stat.player_id}-red_card-${stat.event_minutes.red_card}`, playerId: stat.player_id, playerName, type: 'red_card', minute: stat.event_minutes.red_card, indexInType: 0 });
      }

      // Collect substitutions for Timeline
      const subsHandled = new Set<string>();
      if (stat.event_minutes.sub_out) {
        stat.event_minutes.sub_out.forEach(sub => {
          const subKey = `${stat.player_id}-${sub.minute}-${sub.playerInId}`;
          if (!subsHandled.has(subKey)) {
            subsHandled.add(subKey);
            const subInObj = dbPlayers.find(p => p.id === sub.playerInId);
            eventsList.push({
              id: `${stat.player_id}-substitution-${sub.minute}-${sub.playerInId}`,
              playerId: stat.player_id,
              playerName,
              type: 'substitution',
              minute: sub.minute,
              indexInType: 0,
              extraInfo: subInObj ? (subInObj.nickname || subInObj.full_name) : 'Jugador'
            });
          }
        });
      }
      if (stat.substituted_minute !== undefined && stat.substituted_for) {
         // Fake minute string for legacy
         const subMinStr = `${stat.substituted_minute}'`;
         const subKey = `${stat.player_id}-${subMinStr}-${stat.substituted_for}`;
         if (!subsHandled.has(subKey)) {
            subsHandled.add(subKey);
            const subInObj = dbPlayers.find(p => p.id === stat.substituted_for);
            eventsList.push({
              id: `${stat.player_id}-substitution-${stat.substituted_minute}`,
              playerId: stat.player_id,
              playerName,
              type: 'substitution',
              minute: subMinStr,
              indexInType: 0,
              extraInfo: subInObj ? (subInObj.nickname || subInObj.full_name) : 'Jugador'
            });
         }
      }
    });

    return eventsList.sort((a, b) => {
      const getMin = (m: string) => {
        const num = parseInt(m.replace(/\D/g, ''));
        return isNaN(num) ? 0 : num;
      };
      return getMin(a.minute) - getMin(b.minute);
    });
  }, [playerStats, dbPlayers]);

  // Actualizar el resultado automáticamente basado en las estadísticas
  useEffect(() => {
    let newScoreUs = 0;
    let newScoreThem = 0;
    
    Object.values(playerStats).forEach(stat => {
      newScoreUs += stat.goals || 0;
      newScoreThem += (stat.conceded_goals || 0) + (stat.own_goals || 0);
    });
    
    if (opponentEvents.own_goals) {
      newScoreUs += opponentEvents.own_goals.length;
    }

    if (opponentEvents.goals) {
      newScoreThem += opponentEvents.goals.length;
    }

    setScoreUs(newScoreUs);
    setScoreThem(newScoreThem);
  }, [playerStats, opponentEvents]);

  // Alternar el estado "convocado" de un jugador
  const handleToggleCallUp = (playerId: string) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      if (next[playerId]) {
        const currentlyCalled = next[playerId].is_called_up;
        next[playerId] = {
          ...next[playerId],
          is_called_up: !currentlyCalled,
          is_starter: false, // reset
          position: ''
        };
      }
      return next;
    });

    // Si deja de estar convocado, quitarlo también del lineup si estaba
    const slotIdx = Object.keys(lineup).find(k => lineup[parseInt(k)] === playerId);
    if (slotIdx !== undefined) {
      setLineup(prev => {
        const next = { ...prev };
        delete next[parseInt(slotIdx)];
        return next;
      });
    }
  };

  // Buscador de jugadores no convocados
  const nonCalledUpDbPlayers = useMemo(() => {
    return dbPlayers.filter(p => !playerStats[p.id]?.is_called_up);
  }, [dbPlayers, playerStats]);

  const searchedPlayers = useMemo(() => {
    if (!playerSearchQuery.trim()) return nonCalledUpDbPlayers;
    const q = playerSearchQuery.toLowerCase();
    return nonCalledUpDbPlayers.filter(p => 
      p.full_name.toLowerCase().includes(q) || 
      (p.nickname && p.nickname.toLowerCase().includes(q))
    );
  }, [nonCalledUpDbPlayers, playerSearchQuery]);

  // Mutación para guardar todos los cambios
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!matchId) return;
      // Si se está borrando el acta, no reescribir el estado local en la BBDD.
      if (isDeletingRef.current) return;

      // 1. Guardar metadatos del partido
      const updatedMatch = {
        score_us: matchStatus === 'Jugado' ? scoreUs : null,
        score_them: matchStatus === 'Jugado' ? scoreThem : null,
        status: matchStatus,
        tactical_system: tacticalSystem,
        tactical_with_ball: tacticalWithBall.trim(),
        tactical_without_ball: tacticalWithoutBall.trim(),
        tactical_set_pieces: tacticalSetPieces.trim(),
        tactical_general: tacticalGeneral.trim(),
        opponent_events: opponentEvents,
        team_positive_aspects: teamPositiveAspects || null,
        team_improve_aspects: teamImproveAspects || null,
        team_ratings: teamRatings
      };
      await dataService.updateMatch(matchId, updatedMatch);

      // 2. Guardar estadísticas de rendimiento de jugadores
      const statsPayload = Object.values(playerStats).map(p => ({
        match_id: matchId,
        player_id: p.player_id,
        is_called_up: p.is_called_up,
        is_starter: p.is_starter,
        position: p.position || undefined,
        minutes_played: p.minutes_played,
        goals: p.goals,
        conceded_goals: p.conceded_goals,
        own_goals: p.own_goals,
        assists: p.assists,
        yellow_cards: p.yellow_cards,
        red_card: p.red_card,
        positive_aspects: p.positive_aspects.trim() || undefined,
        improve_aspects: p.improve_aspects.trim() || undefined,
        comments: p.comments?.trim() || undefined,
        substituted_for: p.substituted_for || undefined,
        substituted_minute: p.substituted_minute || undefined,
        event_minutes: p.event_minutes
      }));

      await dataService.savePlayerMatchStats(matchId, statsPayload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['playerMatchStats', matchId] });
      setHasUnsavedChanges(false);
    },
    onError: (err: any) => {
      showToast('error', 'Error al Guardar', err.message || 'No se pudieron registrar los datos.');
    }
  });

  const handleSaveAll = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate();
  };

  const deleteReportMutation = useMutation({
    mutationFn: async () => {
      if (!matchId) return;
      await dataService.deleteMatchReport(matchId);
    },
    onSuccess: () => {
      // Restablecer el estado local a cero para que el auto-guardado no reescriba
      // los datos y la UI refleje el acta vacía inmediatamente.
      setScoreUs(0);
      setScoreThem(0);
      setTacticalWithBall('');
      setTacticalWithoutBall('');
      setTacticalSetPieces('');
      setTacticalGeneral('');
      setOpponentEvents({ goals: [], yellow_cards: [] });
      setLineup({});
      setPlayerStats({});
      setHasUnsavedChanges(false);
      statsInitializedRef.current = false; // Permitir re-inicialización al recargar o entrar a otro partido

      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['playerMatchStats', matchId] });
      showToast('success', 'Acta Borrada', 'Se han restablecido los datos del acta del partido.');
      navigate('/matches');
    },
    onError: (err: any) => {
      isDeletingRef.current = false;
      showToast('error', 'Error al Borrar', err.message || 'No se pudo borrar el acta.');
    }
  });

  const handleDeleteReport = () => {
    setShowDeleteConfirm(true);
  };

  const confirmDeleteReport = () => {
    // Bloquear el auto-guardado ANTES de mutar y cancelar cualquier cambio
    // pendiente, para que el debounce no restaure los datos borrados.
    isDeletingRef.current = true;
    setHasUnsavedChanges(false);
    setShowDeleteConfirm(false);
    deleteReportMutation.mutate();
  };

  // Exportar el acta completa a PDF
  const handleExportPDF = async () => {
    if (!matchData) return;
    try {
      showToast('info', 'Generando PDF', 'Espere un momento mientras se crea el informe...');
      
      // Capturar el campograma como imagen
      let campogramaImage: string | null = null;
      const campogramaEl = document.getElementById('campograma-capture');
      if (campogramaEl) {
        const html2canvas = (await import('html2canvas')).default;
        // Ocultar elementos de UI que no queremos en el PDF (si los hubiera)
        const canvas = await html2canvas(campogramaEl, {
          backgroundColor: null, // Mantener transparencia si aplica
          scale: 2, // Mejor resolución
          logging: false,
          useCORS: true
        });
        campogramaImage = canvas.toDataURL('image/png');
      }

      const startersList = dbPlayers.filter(p => {
        const stats = playerStats[p.id];
        return stats?.is_called_up && stats?.is_starter;
      });

      const subsList = dbPlayers.filter(p => {
        const stats = playerStats[p.id];
        return stats?.is_called_up && !stats?.is_starter;
      });

      const orderedCalledUp = [...startersList, ...subsList];
      const statsList = orderedCalledUp.map(p => {
        const local = playerStats[p.id];
        return {
          id: '',
          match_id: matchId || '',
          player_id: local.player_id,
          is_called_up: local.is_called_up,
          is_starter: local.is_starter,
          position: local.position || undefined,
          minutes_played: local.minutes_played,
          goals: local.goals,
          conceded_goals: local.conceded_goals,
          own_goals: local.own_goals,
          assists: local.assists,
          yellow_cards: local.yellow_cards,
          red_card: local.red_card,
          positive_aspects: local.positive_aspects || null,
          improve_aspects: local.improve_aspects || null,
          comments: local.comments || null,
          substituted_for: local.substituted_for || null,
          substituted_minute: local.substituted_minute || null,
          event_minutes: local.event_minutes
        } as import('../types').PlayerMatchStats;
      });

      const currentMatch = {
        ...matchData,
        score_us: scoreUs,
        score_them: scoreThem,
        status: matchStatus,
        tactical_system: tacticalSystem,
        tactical_with_ball: tacticalWithBall,
        tactical_without_ball: tacticalWithoutBall,
        tactical_set_pieces: tacticalSetPieces,
        tactical_general: tacticalGeneral,
        opponent_events: opponentEvents
      };

      await exportMatchReportToPDF(currentMatch, orderedCalledUp, statsList, matchEvents, campogramaImage);
      showToast('success', 'PDF Descargado', 'El acta del partido se ha descargado correctamente.');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error de Exportación', 'No se pudo generar el documento PDF.');
    }
  };

  const renderPlayerListTables = (isReadOnly: boolean) => {
    return (
      <div className="dashboard-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-black-border pb-3">
          <div>
            <h3 className="text-sm font-bold text-brand-gray-light">
              {isReadOnly ? 'Estadísticas Individuales de Jugadores' : 'Estadísticas de Rendimiento'}
            </h3>
            <p className="text-[10px] text-brand-gray-muted mt-0.5">
              {isReadOnly ? 'Resumen de minutos, goles y tarjetas del plantel' : 'Controla minutos, goles y tarjetas del plantel'}
            </p>
          </div>

          {!isReadOnly && (
            <div className="relative">
              <button
                type="button"
                onClick={() => setShowAddPlayerDropdown(!showAddPlayerDropdown)}
                className="btn-secondary py-1.5 px-3 text-[11px] font-semibold flex items-center gap-1 w-full sm:w-auto"
              >
                <Users className="w-3.5 h-3.5 text-brand-red-600" /> Convocar Jugador
              </button>

              {showAddPlayerDropdown && (
                <div className="absolute right-0 top-9 w-60 bg-brand-black border border-brand-black-border rounded-xl p-2.5 shadow-premium z-30 space-y-2">
                  <input
                    type="text"
                    className="form-input text-xs py-1 px-2.5 w-full bg-brand-black-bg"
                    placeholder="Buscar futbolista..."
                    value={playerSearchQuery}
                    onChange={(e) => setPlayerSearchQuery(e.target.value)}
                  />
                  <div className="max-h-[180px] overflow-y-auto space-y-1 no-scrollbar pr-1">
                    {searchedPlayers.length === 0 ? (
                      <div className="text-[10px] text-brand-gray-muted text-center py-4 italic">
                        No quedan jugadores disponibles.
                      </div>
                    ) : (
                      searchedPlayers.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            handleToggleCallUp(p.id);
                            setShowAddPlayerDropdown(false);
                            setPlayerSearchQuery('');
                          }}
                          className="w-full text-left p-1.5 rounded hover:bg-brand-black-hover text-[11px] font-semibold text-brand-gray-light flex items-center justify-between transition-colors"
                        >
                          <span>{p.nickname || p.full_name}</span>
                          <span className="text-[9px] font-bold bg-brand-black-border text-brand-red-600 px-1 rounded">
                            {p.dorsal || '-'}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Listado en tabla */}
        <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2 border border-brand-black-border p-2 rounded-xl bg-brand-black/10">
          {calledUpPlayers.length === 0 ? (
            <div className="col-span-1 2xl:col-span-2 text-center py-12 text-brand-gray-muted text-xs italic">
              No hay jugadores en la convocatoria. {!isReadOnly && 'Haz clic en "Convocar Jugador" para agregarlos al acta.'}
            </div>
          ) : (
            ['Titulares (XI Inicial)', 'Suplentes (Banquillo) 🪑'].map(group => {
              const isStarterGroup = group.startsWith('Titulares');
              const list = calledUpPlayers.filter(p => {
                const stats = playerStats[p.id];
                return stats && stats.is_starter === isStarterGroup;
              });

              return (
                <div key={group} className="space-y-2 bg-brand-black/30 p-2.5 rounded-xl border-2 border-brand-black-border relative">
                  {/* Título de la columna */}
                  <div className="flex items-center gap-2 border-b border-brand-black-border/50 pb-1.5">
                    <div className="w-1.5 h-3.5 bg-brand-red-600 rounded-full"></div>
                    <div className="text-[10px] font-bold text-brand-gray-light uppercase tracking-wider">
                      {group} ({list.length})
                    </div>
                  </div>

                  <div className="space-y-1">
                    {list.length === 0 ? (
                      <div className="text-[10px] text-brand-gray-muted text-center py-4 italic border border-dashed border-brand-black-border rounded-xl">
                        Ningún jugador en esta lista.
                      </div>
                    ) : list.map(player => {
                      const stats = playerStats[player.id];
                      if (!stats) return null;
                      const isGK = player.position === 'Portero' || stats.position?.includes('GK');
                      const hasEvents = stats.goals > 0 || (stats.conceded_goals || 0) > 0 || (stats.own_goals || 0) > 0 || stats.assists > 0 || stats.yellow_cards > 0 || stats.red_card;
                      const isExpanded = expandedPlayerId === player.id;

                      return (
                        <div
                          key={player.id}
                          className={`p-1.5 rounded-lg border transition-all ${
                            isExpanded
                              ? 'bg-brand-black/80 border-brand-red-600/50 shadow-md'
                              : 'bg-brand-black-card border-brand-black-border hover:border-brand-gray-dark hover:bg-brand-black-hover'
                          }`}
                        >
                          {/* Row principal (Una sola línea) */}
                          <div className="flex flex-row items-center justify-between gap-1 text-left">
                            {/* Info del Jugador */}
                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                              {/* Avatar */}
                              <div className="w-6 h-6 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                                {player.photo_url ? (
                                  <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                                ) : (
                                  <span className="text-[9px] font-black text-brand-gray-dark">{player.dorsal || '?'}</span>
                                )}
                              </div>
                              <div className="truncate flex-1 min-w-0">
                                <div className="flex items-center gap-1">
                                  {player.dorsal && (
                                    <span className="text-[9px] font-mono font-black text-yellow-400 bg-yellow-400/10 px-1.5 py-0.5 rounded shadow-sm shrink-0 leading-none">
                                      {player.dorsal}
                                    </span>
                                  )}
                                  <span className="text-[10px] font-bold text-brand-gray-light leading-tight whitespace-normal break-words" title={player.nickname || player.full_name}>
                                    {player.nickname || player.full_name}
                                  </span>
                                </div>
                                <div className="text-[8px] text-brand-gray-muted mt-0.5 flex items-center gap-1 overflow-hidden">
                                  {stats.is_starter ? (
                                    <span className="text-yellow-500 font-semibold truncate shrink-0">Titular ({stats.position?.replace(/^\d+:/, '')})</span>
                                  ) : (
                                    <span className="text-brand-gray-muted font-medium truncate shrink-0">Suplente</span>
                                  )}
                                  {hasEvents && (
                                    <span className="flex items-center gap-0.5 bg-brand-black-border/60 px-1 rounded text-brand-gray-light leading-none shrink-0">
                                      {Array.from({ length: stats.goals }).map((_, i) => <span key={i}>⚽</span>)}
                                      {(stats.conceded_goals || 0) > 0 && Array.from({ length: stats.conceded_goals }).map((_, i) => <span key={i}>🥅</span>)}
                                      {(stats.own_goals || 0) > 0 && Array.from({ length: stats.own_goals }).map((_, i) => <span key={i}>💥</span>)}
                                      {Array.from({ length: stats.assists }).map((_, i) => <span key={i}>🥾</span>)}
                                      {Array.from({ length: stats.yellow_cards }).map((_, i) => <span key={i} className="text-yellow-400">🟨</span>)}
                                      {stats.red_card && <span className="text-red-500">🟥</span>}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>

                            {/* Inputs rápidos (alineados horizontalmente) */}
                            <div className="flex items-center gap-0.5 shrink-0">
                              {/* Minutos */}
                              <div className="text-center w-[36px]">
                                <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">Min</span>
                                {isReadOnly ? (
                                  <div className="text-[10px] font-bold text-brand-gray-light py-0.5 w-full bg-brand-black-bg text-center rounded border border-brand-black-border/40">
                                    {stats.minutes_played}
                                  </div>
                                ) : (
                                  <input
                                    type="number"
                                    min="0"
                                    max="120"
                                    className="form-input text-[10px] font-bold text-white py-0.5 px-0.5 text-center w-full bg-brand-black-bg"
                                    value={stats.minutes_played}
                                    onChange={(e) => handleStatChange(player.id, 'minutes_played', Math.max(0, parseInt(e.target.value) || 0))}
                                  />
                                )}
                              </div>

                              {/* Goles */}
                              <div className="text-center w-[24px]">
                                <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">Gol</span>
                                <input
                                  type="number"
                                  disabled
                                  className="form-input text-[10px] font-bold text-brand-gray-muted py-0.5 px-0 text-center w-full bg-brand-black-bg cursor-not-allowed opacity-60"
                                  value={stats.goals}
                                />
                              </div>

                              {/* Asist / G. Enc */}
                              {isGK ? (
                                <div className="text-center w-[24px]">
                                  <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none" title="Goles Encajados">G.E</span>
                                  <input
                                    type="number"
                                    disabled
                                    className="form-input text-[10px] font-bold text-brand-gray-muted py-0.5 px-0 text-center w-full bg-brand-black-bg cursor-not-allowed opacity-60"
                                    value={stats.conceded_goals || 0}
                                  />
                                </div>
                              ) : (
                                <div className="text-center w-[24px]">
                                  <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">Ast</span>
                                  <input
                                    type="number"
                                    disabled
                                    className="form-input text-[10px] font-bold text-brand-gray-muted py-0.5 px-0 text-center w-full bg-brand-black-bg cursor-not-allowed opacity-60"
                                    value={stats.assists}
                                  />
                                </div>
                              )}

                              {/* Gol en propia (P.P.) */}
                              <div className="text-center w-[24px]">
                                <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none" title="Goles en propia puerta">P.P</span>
                                <input
                                  type="number"
                                  disabled
                                  className="form-input text-[10px] font-bold text-brand-gray-muted py-0.5 px-0 text-center w-full bg-brand-black-bg cursor-not-allowed opacity-60"
                                  value={stats.own_goals || 0}
                                />
                              </div>

                              {/* Amarillas */}
                              <div className="text-center w-[26px]">
                                <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">TA</span>
                                <select
                                  disabled
                                  className="form-input text-[10px] font-bold text-brand-gray-muted py-0.5 px-0 w-full bg-brand-black-bg text-center appearance-none cursor-not-allowed opacity-60"
                                  value={stats.yellow_cards}
                                >
                                  <option value={0}>0</option>
                                  <option value={1}>1</option>
                                  <option value={2}>2</option>
                                </select>
                              </div>

                              {/* Roja */}
                              <div className="text-center w-[22px] flex flex-col items-center">
                                <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">TR</span>
                                <button
                                  type="button"
                                  disabled
                                  className={`text-[8px] font-bold w-full h-[20px] flex items-center justify-center rounded border cursor-not-allowed opacity-60 ${
                                    stats.red_card
                                      ? 'bg-red-950/40 text-red-500 border-red-800'
                                      : 'bg-brand-black-bg text-brand-gray-muted border-brand-black-border'
                                  }`}
                                >
                                  {stats.red_card ? 'Sí' : 'No'}
                                </button>
                              </div>
                            </div>

                            {/* Botón Expandir */}
                            <div className="flex items-center shrink-0 border-l border-brand-black-border pl-1 ml-0.5">
                              <button
                                type="button"
                                onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                                className={`p-0.5 rounded transition-all ${
                                  isExpanded
                                    ? 'text-brand-red-600 bg-brand-red-600/10 hover:bg-brand-red-600/20'
                                    : 'text-brand-gray-muted hover:text-brand-gray-light bg-brand-black-bg border border-brand-black-border hover:border-brand-gray-dark'
                                }`}
                                title={isExpanded ? 'Colapsar detalles' : 'Editar detalles del evento'}
                              >
                                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                          </div>

                          {/* Panel Expandido: Minutos de Eventos y Comentarios cualitativos */}
                          {isExpanded && (
                            <div className="mt-4 border-t border-brand-black-border pt-4 space-y-4 animate-fadeIn">
                              {/* Minuto de Eventos */}
                              {hasEvents ? (
                                <div className="bg-brand-black/30 p-3 rounded-lg border border-brand-black-border space-y-2">
                                  <span className="text-[10px] font-bold text-brand-red-600 uppercase tracking-wider block">Minutos de los Eventos</span>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                                    {/* Minutos Goles */}
                                    {stats.event_minutes.goals?.map((min, gIdx) => (
                                      <div key={`g-${gIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-brand-gray-muted truncate">⚽ Gol {gIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Goles Penalti */}
                                    {stats.event_minutes.penalty_goals?.map((min, pIdx) => (
                                      <div key={`p-${pIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-brand-gray-muted truncate">⚽ Penalti {pIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Goles Encajados */}
                                    {isGK && stats.event_minutes.conceded_goals?.map((min, cIdx) => (
                                      <div key={`c-${cIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-cyan-400 font-semibold truncate">🥅 Encajado {cIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Goles Encajados Penalti */}
                                    {isGK && stats.event_minutes.conceded_penalty_goals?.map((min, cpIdx) => (
                                      <div key={`cp-${cpIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-cyan-400 font-semibold truncate">🥅 Pen. Encaj {cpIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Goles en Propia */}
                                    {stats.event_minutes.own_goals?.map((min, oIdx) => (
                                      <div key={`o-${oIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-orange-400 font-semibold truncate">💥 Propia {oIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Asistencias */}
                                    {stats.event_minutes.assists?.map((min, aIdx) => (
                                      <div key={`a-${aIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-brand-gray-muted truncate">🥾 Asist {aIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Amarillas */}
                                    {stats.event_minutes.yellow_cards?.map((min, yIdx) => (
                                      <div key={`y-${yIdx}`} className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-yellow-500 font-semibold truncate">🟨 Tarjeta {yIdx + 1}:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={min || ''}
                                        />
                                      </div>
                                    ))}

                                    {/* Minutos Roja */}
                                    {stats.red_card && (
                                      <div className="flex items-center gap-1.5">
                                        <span className="text-[10px] text-red-500 font-semibold truncate">🟥 Roja:</span>
                                        <input
                                          type="text"
                                          disabled
                                          className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black text-brand-gray-muted cursor-not-allowed opacity-60"
                                          value={stats.event_minutes.red_card || ''}
                                        />
                                      </div>
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <div className="text-[10px] text-brand-gray-muted bg-brand-black/20 p-2 rounded text-center border border-dashed border-brand-black-border w-full">
                                  Sin incidencias cargadas (goles, goles encajados, propia puerta, tarjetas, asistencias) para especificar minutos de eventos.
                                </div>
                              )}

                              {/* Comentarios del Jugador */}
                              <div className="bg-brand-black/30 p-3 rounded-lg border border-brand-black-border space-y-2">
                                <span className="text-[10px] font-bold text-brand-gray-light uppercase tracking-wider block">Comentarios / Observaciones</span>
                                {isReadOnly ? (
                                  <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">
                                    {stats.comments || 'Sin comentarios o anotaciones para este partido.'}
                                  </p>
                                ) : (
                                  <textarea
                                    className="form-input text-xs w-full p-2 bg-brand-black min-h-[60px]"
                                    placeholder="Añade un comentario sobre la actuación del jugador..."
                                    value={stats.comments || ''}
                                    onChange={(e) => handleStatChange(player.id, 'comments', e.target.value)}
                                  />
                                )}
                              </div>

                              {/* Aspectos Cualitativos del Jugador */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                  <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Aspectos Positivos</label>
                                  {isReadOnly ? (
                                    <p className="text-xs text-brand-gray-light bg-brand-black/20 p-2 rounded border border-brand-black-border leading-relaxed whitespace-pre-wrap min-h-[50px]">
                                      {stats.positive_aspects || 'Ninguno anotado.'}
                                    </p>
                                  ) : (
                                    <textarea
                                      className="form-input text-xs h-16 resize-none bg-brand-black"
                                      placeholder="Puntos fuertes de su partido: repliegues, actitud, acierto en pase..."
                                      value={stats.positive_aspects}
                                      onChange={(e) => handleStatChange(player.id, 'positive_aspects', e.target.value)}
                                    />
                                  )}
                                </div>
                                <div>
                                  <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block mb-1">Aspectos a Mejorar</label>
                                  {isReadOnly ? (
                                    <p className="text-xs text-brand-gray-light bg-brand-black/20 p-2 rounded border border-brand-black-border leading-relaxed whitespace-pre-wrap min-h-[50px]">
                                      {stats.improve_aspects || 'Ninguno anotado.'}
                                    </p>
                                  ) : (
                                    <textarea
                                      className="form-input text-xs h-16 resize-none bg-brand-black"
                                      placeholder="Aspectos que debe corregir: pérdidas en zonas de riesgo, perfilación..."
                                      value={stats.improve_aspects}
                                      onChange={(e) => handleStatChange(player.id, 'improve_aspects', e.target.value)}
                                    />
                                  )}
                                </div>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };

  if (isLoadingMatch || isLoadingPlayers || isLoadingStats) {
      return (
      <div className="py-12 flex justify-center">
        <CardSkeleton />
      </div>
    );
  }

  if (!matchData) {
    return (
      <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
        <AlertCircle className="w-12 h-12 text-brand-red-600 mx-auto mb-4" />
        <h3 className="text-lg font-bold text-brand-gray-light">Partido no encontrado</h3>
        <button onClick={() => navigate('/matches')} className="btn-secondary mx-auto mt-4">
          Volver a Partidos
        </button>
      </div>
    );
  }

  const isLocal = matchData.is_local;
  const matchTitle = isLocal 
    ? `UD Atzeneta vs ${matchData.rival}` 
    : `${matchData.rival} vs UD Atzeneta`;

  return (
    <div className="space-y-6">
      {/* Cabecera del Acta */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 border-b border-brand-black-border pb-5">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={async () => {
              if (hasUnsavedChanges) {
                await saveMutation.mutateAsync();
              }
              navigate('/matches');
            }}
            disabled={saveMutation.isPending}
            className={`w-8 h-8 rounded-full bg-brand-black-card border border-brand-black-border flex items-center justify-center text-brand-gray-light hover:text-white hover:border-brand-gray-muted transition-colors hover:shadow-glow-sm ${saveMutation.isPending ? 'opacity-50 cursor-not-allowed' : ''}`}
          >
            {saveMutation.isPending ? (
              <div className="w-3 h-3 rounded-full border-2 border-brand-gray-muted border-t-transparent animate-spin" />
            ) : (
              <ArrowLeft className="w-4 h-4" />
            )}
          </button>
          <div>
            <h2 className="text-2xl font-bold text-brand-gray-light">Acta y Rendimiento del Partido</h2>
            <p className="text-xs text-brand-gray-muted mt-1 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-brand-red-600" /> {matchData.date} {matchData.time && `| ⏰ ${matchData.time} hs`} | {matchData.competition}
            </p>
          </div>
        </div>

        {/* Acciones principales */}
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={handleExportPDF}
            className="btn-secondary py-2.5 text-xs text-brand-gray-light font-bold"
          >
            <FileText className="w-4 h-4" /> Descargar Acta PDF
          </button>

          {canEdit && !isEditing && (
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleDeleteReport}
                disabled={deleteReportMutation.isPending}
                className="btn-secondary py-2 px-3 text-xs text-brand-red-600 border-brand-red-600/30 hover:bg-brand-red-600/10 font-bold"
              >
                Borrar
              </button>
              <button
                onClick={() => setIsEditing(true)}
                className="btn-primary py-2.5 px-4 text-xs font-bold bg-brand-gray-dark border border-brand-gray-muted text-white hover:bg-brand-gray-light"
              >
                <Edit2 className="w-4 h-4" /> Editar Acta
              </button>
            </div>
          )}

          {canEdit && isEditing && (
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-end w-32 mr-2">
                {saveMutation.isPending ? (
                  <span className="text-[11px] text-brand-gray-light animate-pulse flex items-center gap-1.5 font-bold">
                    <div className="w-3 h-3 rounded-full border-2 border-brand-gray-muted border-t-transparent animate-spin" /> Guardando...
                  </span>
                ) : hasUnsavedChanges ? (
                  <span className="text-[11px] text-amber-500 animate-pulse flex items-center gap-1.5 font-bold">
                    <Clock className="w-3 h-3" /> Auto-guardando
                  </span>
                ) : (
                  <span className="text-[11px] text-emerald-500 flex items-center gap-1.5 font-bold">
                    <Check className="w-3 h-3" /> Guardado
                  </span>
                )}
              </div>

              <button
                type="button"
                onClick={handleDeleteReport}
                disabled={deleteReportMutation.isPending}
                className="btn-secondary py-2 px-3 text-xs text-brand-red-600 border-brand-red-600/30 hover:bg-brand-red-600/10 font-bold"
              >
                Borrar
              </button>

              <button
                onClick={async () => {
                  if (hasUnsavedChanges) {
                    await saveMutation.mutateAsync();
                  }
                  setIsEditing(false);
                }}
                disabled={saveMutation.isPending}
                className={`btn-primary py-2 px-4 text-xs font-bold bg-brand-gray-dark border border-brand-gray-muted text-white hover:bg-brand-gray-light ${saveMutation.isPending ? 'opacity-50 cursor-wait' : ''}`}
              >
                {saveMutation.isPending ? 'Guardando...' : 'Terminar Edición'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Grid Principal: Lado Izquierdo vs Lado Derecho */}
      {isEditing ? (
        <>
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LADO IZQUIERDO: Marcador y Campograma */}
        <div className="xl:col-span-5 space-y-4">
          
          {/* Marcador e Información de Estado */}
          <div className="bg-brand-black-card/45 border border-brand-black-border p-5 rounded-2xl space-y-5">
            <div className="space-y-3.5 text-left">
              <span className="text-[10px] font-bold text-brand-red-600 uppercase tracking-wider block">Configuración de Encuentro</span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Estado</label>
                  <div className="form-input bg-brand-black-bg text-xs py-1.5 h-[34px] flex items-center font-bold text-brand-gray-light border-brand-black-border">
                    <span className={matchStatus === 'Jugado' ? 'text-emerald-400' : 'text-brand-gray-muted'}>{matchStatus}</span>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Táctica Base</label>
                  <select
                    value={tacticalSystem}
                    onChange={(e) => setTacticalSystem(e.target.value)}
                    disabled={!isEditing}
                    className="form-input bg-brand-black-bg text-xs py-1.5"
                  >
                    {Object.keys(FORMATIONS_SLOTS).map(sys => (
                      <option key={sys} value={sys}>{sys}</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>

            {/* Marcador Central */}
            <div className="flex items-center justify-between gap-2 pt-5 border-t border-brand-black-border">
              <div className="text-center w-[30%] flex flex-col items-center">
                <div className="w-12 h-12 bg-white/5 rounded-xl border border-brand-black-border flex items-center justify-center mb-1.5">
                  <img 
                    src="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png" 
                    alt="UD Atzeneta" 
                    className="w-8 h-8 object-contain"
                  />
                </div>
                <h4 className="text-[10px] font-bold text-brand-gray-muted leading-tight">UD ATZENETA</h4>
              </div>

              <div className="flex items-center gap-2 justify-center w-[40%]">
                {matchStatus === 'Jugado' ? (
                  <>
                    <input
                      type="number"
                      min="0"
                      value={scoreUs}
                      readOnly
                      className="w-12 h-12 bg-brand-black border border-brand-black-border text-center text-xl font-black rounded-xl text-brand-gray-light focus:outline-none cursor-default"
                    />
                    <span className="text-lg font-black text-brand-gray-dark">-</span>
                    <input
                      type="number"
                      min="0"
                      value={scoreThem}
                      readOnly
                      className="w-12 h-12 bg-brand-black border border-brand-black-border text-center text-xl font-black rounded-xl text-brand-gray-light focus:outline-none cursor-default"
                    />
                  </>
                ) : (
                  <span className="text-[10px] font-semibold text-brand-gray-muted italic bg-brand-black px-2 py-1 rounded-lg border border-brand-black-border text-center">
                    {matchStatus === 'Programado' ? 'Pendiente' : 'Suspendido'}
                  </span>
                )}
              </div>

              <div className="text-center w-[30%] flex flex-col items-center">
                <div className="w-12 h-12 bg-white/5 rounded-xl border border-brand-black-border flex items-center justify-center mb-1.5 p-1 overflow-hidden">
                  <img 
                    src={getTeamLogo(matchData.rival)} 
                    alt="Escudo Rival" 
                    className="w-full h-full object-contain" 
                  />
                </div>
                <h4 className="text-[10px] font-bold text-brand-gray-muted truncate w-full leading-tight">{matchData.rival.toUpperCase()}</h4>
              </div>
            </div>
          </div>
          <div className="dashboard-card p-5 space-y-4">
            <div className="flex justify-between items-center border-b border-brand-black-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-brand-gray-light">XI Inicial - Campograma</h3>
                <p className="text-[10px] text-brand-gray-muted mt-0.5">Posiciona a los 11 jugadores en el sistema {tacticalSystem}</p>
              </div>
              <div className="flex flex-col items-end gap-2">
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setIsEventWizardOpen(true)}
                    className="bg-yellow-500 hover:bg-yellow-400 text-brand-black text-[10px] font-extrabold px-3 py-1 rounded-md flex items-center gap-1.5 transition-all shadow-glow-yellow animate-pulse"
                    title="Registrar Nueva Incidencia"
                  >
                    <Plus className="w-3.5 h-3.5" /> INCIDENCIA
                  </button>
                  <span className="text-[10px] font-mono font-black text-brand-red-600 bg-brand-red-600/10 px-2 py-1 rounded border border-brand-red-600/20 shadow-sm">
                    {Object.keys(lineup).length}/11 Titulares
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-brand-black-card border border-brand-gray-dark/50 px-3 py-1.5 rounded-lg shadow-premium">
                  <span className="text-xs font-bold text-white uppercase tracking-wider">⏱️ Duración Total:</span>
                  <input 
                    type="number"
                    value={matchDuration}
                    min="1"
                    max="150"
                    onChange={(e) => setMatchDuration(Number(e.target.value) || 90)}
                    disabled={!isEditing}
                    className="w-10 bg-transparent text-sm font-black text-white text-center focus:outline-none focus:ring-0 p-0 m-0 border-b border-white/30"
                  />
                  <span className="text-[10px] text-white/70 font-bold uppercase">min</span>
                </div>
              </div>
            </div>

            {/* Representación gráfica del Campo de Fútbol */}
            <div id="campograma-capture" className="relative w-full max-w-sm mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-800 to-emerald-950 border-4 border-emerald-100/20 rounded-2xl shadow-2xl select-none">

              {/* Franjas del césped */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5 rounded-2xl overflow-hidden">
                {Array.from({ length: 10 }).map((_, i) => (
                  <div key={i} className={`h-[10%] w-full ${i % 2 === 0 ? 'bg-white' : 'bg-transparent'}`} />
                ))}
              </div>

              {/* Líneas tácticas */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-emerald-100/20 -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 w-[30%] aspect-square border-2 border-emerald-100/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-100/30 rounded-full -translate-x-1/2 -translate-y-1/2" />
              
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-b-2 border-x-2 border-emerald-100/20" />
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-b-2 border-x-2 border-emerald-100/20" />
              <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-b-2 border-emerald-100/20 rounded-b-full" />
              <div className="absolute top-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/25 rounded-full -translate-x-1/2" />

              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-t-2 border-x-2 border-emerald-100/20" />
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-t-2 border-x-2 border-emerald-100/20" />
              <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-t-2 border-emerald-100/20 rounded-t-full" />
              <div className="absolute bottom-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/25 rounded-full -translate-x-1/2" />

              {/* Render de los slots de la formación */}
              {(() => {
                 const allSubs: { out: string, in: string, min: number }[] = [];
                 Object.values(playerStats).forEach(p => {
                   if (p.substituted_for && p.substituted_minute) {
                     allSubs.push({ out: p.player_id, in: p.substituted_for, min: p.substituted_minute });
                   }
                   if (p.event_minutes?.sub_out) {
                     p.event_minutes.sub_out.forEach(s => {
                       allSubs.push({ out: p.player_id, in: s.playerInId, min: parseAbsoluteMinute(s.minute) });
                     });
                   }
                 });
                 const uniqueSubs = Array.from(new Set(allSubs.map(e => JSON.stringify(e))))
                   .map(e => JSON.parse(e) as { out: string, in: string, min: number })
                   .sort((a,b) => a.min - b.min);

                 return currentSlots.map((slot, idx) => {
                  const starterId = lineup[idx];
                  
                  // Construir la cadena de sustituciones cronológicamente
                  const playerChain: Array<{ id: string, minute: number | null, stats: any }> = [];
                  
                  if (starterId && playerStats) {
                    let currentId = starterId;
                    playerChain.push({ id: currentId, minute: null, stats: playerStats[currentId] });
                    
                    let lastTime = -1;
                    while (true) {
                       const nextSub = uniqueSubs.find(s => s.out === currentId && s.min > lastTime);
                       if (!nextSub) break;
                       currentId = nextSub.in;
                       lastTime = nextSub.min;
                       playerChain.push({ id: currentId, minute: nextSub.min, stats: playerStats[currentId] });
                    }
                  }

                return (
                  <div
                    key={idx}
                    style={{
                      left: `${slot.x}%`,
                      top: `${slot.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                    className={`absolute flex flex-col items-center select-none ${activeSlotForSelection === idx ? 'z-50' : 'z-10'}`}
                  >
                    {playerChain.length > 0 ? (
                      // Slot Ocupado
                      <div className="relative flex flex-col items-center">

                        <div className="relative flex flex-col items-center group bg-black/30 p-1 rounded-2xl backdrop-blur-sm">
                          {(() => {
                            const chainItem = playerChain[0];
                            const pObj = dbPlayers.find(p => p.id === chainItem.id);
                            if (!pObj) return null;
                            const activeStats = chainItem.stats;
                            
                            return (
                              <div key={chainItem.id} className="relative flex flex-col items-center">
                                <button
                                  type="button"
                                  onClick={() => isEditing && setActiveSlotForSelection(activeSlotForSelection === idx ? null : idx)}
                                  disabled={!isEditing}
                                  className={`relative w-11 h-11 rounded-full bg-brand-black-card border-2 border-yellow-500 shadow-premium flex items-center justify-center ${isEditing ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'} transition-all`}
                                >
                                  <div className="w-full h-full rounded-full overflow-hidden">
                                    {pObj.photo_url ? (
                                      <img src={pObj.photo_url} alt={pObj.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <div className="w-full h-full flex items-center justify-center bg-brand-black-card text-[10px] font-black text-brand-gray-light">
                                        {pObj.dorsal || '?'}
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Badges de Eventos sobre el jugador */}
                                  {activeStats && (
                                    <>
                                      {activeStats.goals > 0 && (
                                        <span className="absolute -top-3 -left-3 bg-brand-black/90 text-[10px] rounded-full px-1 shadow border border-brand-black-border z-30">
                                          ⚽{activeStats.goals > 1 ? `x${activeStats.goals}` : ''}
                                        </span>
                                      )}
                                      {activeStats.assists > 0 && (
                                        <span className="absolute -bottom-2 -left-3 bg-brand-black/90 text-[10px] rounded-full px-1 shadow border border-brand-black-border z-30">
                                          🥾{activeStats.assists > 1 ? `x${activeStats.assists}` : ''}
                                        </span>
                                      )}
                                      {(activeStats.yellow_cards > 0 || activeStats.red_card) && (
                                        <div className="absolute -bottom-2 -right-3 flex -space-x-0.5 z-30">
                                          {Array.from({ length: activeStats.yellow_cards }).map((_, i) => (
                                            <span key={i} className="text-[10px] drop-shadow-md">🟨</span>
                                          ))}
                                          {activeStats.red_card && <span className="text-[10px] drop-shadow-md">🟥</span>}
                                        </div>
                                      )}
                                    </>
                                  )}
                                </button>
                                
                                <span className={`mt-0.5 bg-brand-black-card/90 text-brand-gray-light font-bold px-1 py-0.5 rounded shadow border border-brand-black-border text-center leading-none text-[9px] whitespace-nowrap overflow-visible`}>
                                  {pObj.nickname || pObj.full_name.split(' ')[0]}
                                </span>
                              </div>
                            );
                          })()}
                        </div>

                        {/* Suplentes (flotando debajo) */}
                        {playerChain.length > 1 && (
                          <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 flex flex-row items-start gap-1.5 bg-black/50 p-1 rounded-xl backdrop-blur-md z-30 pointer-events-none shadow-md border border-brand-black-border/50">
                            {playerChain.slice(1).map((chainItem) => {
                              const pObj = dbPlayers.find(p => p.id === chainItem.id);
                              if (!pObj) return null;
                              const activeStats = chainItem.stats;
                              
                              return (
                                <div key={chainItem.id} className="relative flex flex-col items-center group pointer-events-auto mt-2">
                                  {chainItem.minute && (
                                    <span className="absolute -top-3.5 bg-brand-black-card text-white border border-brand-red-600/50 text-[7.5px] font-black px-1 rounded whitespace-nowrap z-40 shadow-sm">
                                      {chainItem.minute}'
                                    </span>
                                  )}

                                  <button
                                    type="button"
                                    onClick={() => isEditing && setActiveSlotForSelection(activeSlotForSelection === idx ? null : idx)}
                                    disabled={!isEditing}
                                    className={`relative w-5 h-5 opacity-90 rounded-full bg-brand-black-card border-2 border-brand-gray-light shadow-premium flex items-center justify-center ${isEditing ? 'hover:scale-105 active:scale-95 cursor-pointer' : 'cursor-default'} transition-all`}
                                  >
                                    <div className="w-full h-full rounded-full overflow-hidden">
                                      {pObj.photo_url ? (
                                        <img src={pObj.photo_url} alt={pObj.full_name} className="w-full h-full object-cover" />
                                      ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-brand-black-card text-[10px] font-black text-brand-gray-light">
                                          {pObj.dorsal || '?'}
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Badges de Eventos sobre el suplente */}
                                    {activeStats && (
                                      <>
                                        {activeStats.goals > 0 && (
                                          <span className="absolute -top-2 -left-2 bg-brand-black/90 text-[7px] rounded-full px-0.5 shadow border border-brand-black-border z-30">
                                            ⚽{activeStats.goals > 1 ? `x${activeStats.goals}` : ''}
                                          </span>
                                        )}
                                      </>
                                    )}
                                  </button>
                                  
                                  <span className={`mt-0.5 bg-brand-black-card/90 text-brand-gray-light font-bold px-1 py-0.5 rounded shadow border border-brand-black-border text-center leading-none text-[6px] whitespace-nowrap overflow-visible`}>
                                    {pObj.nickname || pObj.full_name.split(' ')[0]}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    ) : (
                      // Slot Vacío
                      <button
                        type="button"
                        onClick={() => setActiveSlotForSelection(activeSlotForSelection === idx ? null : idx)}
                        className={`w-9 h-9 rounded-full border-2 border-dashed flex flex-col items-center justify-center transition-all ${
                          activeSlotForSelection === idx 
                            ? 'bg-brand-red-600/30 border-brand-red-600 text-white scale-105 shadow-glow-red' 
                            : 'bg-emerald-900/35 border-emerald-100/35 text-emerald-100/60 hover:bg-emerald-900/50 hover:border-emerald-100/50'
                        }`}
                      >
                        <span className="text-[8px] font-black leading-none">{slot.label}</span>
                        <span className="text-[10px] font-bold leading-none mt-0.5">+</span>
                      </button>
                    )}
                  </div>
                );
              })})()}
            </div>

            {activeSlotForSelection !== null && (() => {
              const idx = activeSlotForSelection;
              const slot = (FORMATIONS_SLOTS[tacticalSystem] || FORMATIONS_SLOTS['4-3-3'])[idx];
              if (!slot) return null;
              return (
                <Modal
                  isOpen={activeSlotForSelection !== null}
                  onClose={() => setActiveSlotForSelection(null)}
                  title={`Posición: ${slot.role} (${slot.label})`}
                  maxWidth="max-w-md"
                >
                  <div className="space-y-4 text-left">
                    {lineup[idx] && (
                      <button
                        type="button"
                        onClick={() => {
                          handleRemovePlayerFromLineup(idx);
                          setActiveSlotForSelection(null);
                        }}
                        className="w-full text-center p-3 rounded bg-brand-red-600/20 hover:bg-brand-red-600/40 border border-brand-red-600/30 text-xs font-bold text-brand-red-500 transition-colors"
                      >
                        Quitar Titular
                      </button>
                    )}
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted mb-2">
                        Jugadores Convocados Disponibles
                      </h4>
                      {availableSubstitutes.length === 0 ? (
                        <div className="text-xs text-brand-gray-muted text-center py-6 border border-dashed border-brand-black-border rounded-xl italic">
                          No quedan suplentes en convocatoria.
                        </div>
                      ) : (
                        <div className="space-y-1.5 max-h-[300px] overflow-y-auto pr-1 no-scrollbar">
                          {availableSubstitutes.map(p => (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => {
                                handleAssignPlayer(idx, p.id);
                                setActiveSlotForSelection(null);
                              }}
                              className="w-full text-left p-3 rounded-lg bg-brand-black hover:bg-brand-black-hover border border-brand-black-border hover:border-brand-red-600/50 text-sm font-semibold text-brand-gray-light flex items-center justify-between transition-all"
                            >
                              <div className="flex items-center gap-3">
                                {p.photo_url ? (
                                  <img src={p.photo_url} alt={p.nickname || p.full_name} className="w-8 h-8 rounded-full object-cover border border-brand-black-border" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-brand-black-card border border-brand-black-border flex items-center justify-center text-xs text-brand-gray-muted font-bold">
                                    {p.dorsal || '?'}
                                  </div>
                                )}
                                <span>{p.nickname || p.full_name}</span>
                              </div>
                              {p.dorsal && (
                                <span className="text-xs font-bold bg-brand-black-border text-brand-red-600 px-2.5 py-0.5 rounded">
                                  {p.dorsal}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </Modal>
              );
            })()}
          </div>


        </div>

        {/* LADO DERECHO: Tabla de Estadísticas de Jugadores */}
        <div className="xl:col-span-7 space-y-4">
          {renderPlayerListTables(false)}

          {/* Cronología de Eventos (Movida a la derecha) */}
          <div className="dashboard-card p-5 space-y-4">
            <div className="border-b border-brand-black-border pb-3 text-left">
              <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-red-600" /> Línea de Tiempo de Eventos
              </h3>
              <p className="text-[10px] text-brand-gray-muted mt-0.5">Historial cronológico de todas las incidencias del partido</p>
            </div>
            
            <div className="max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
              {matchEvents.length === 0 ? (
                <div className="text-center py-10 bg-brand-black/20 rounded-xl border border-dashed border-brand-black-border text-brand-gray-muted text-xs italic">
                  No hay incidencias registradas en este partido.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Columna 1ª Parte */}
                  <div>
                    <h4 className="text-[11px] font-bold text-brand-gray-muted uppercase border-b border-brand-black-border pb-2 mb-3 sticky top-0 bg-brand-black-card z-20">1ª Parte</h4>
                    {matchEvents.filter(e => parseAbsoluteMinute(e.minute) <= 45).length === 0 ? (
                      <p className="text-xs text-brand-gray-muted italic">Sin incidencias</p>
                    ) : (
                      <div className="relative border-l-2 border-brand-black-border ml-3 pl-4 space-y-2 py-1">
                        {matchEvents
                          .filter(e => parseAbsoluteMinute(e.minute) <= 45)
                          .sort((a, b) => parseAbsoluteMinute(a.minute) - parseAbsoluteMinute(b.minute))
                          .map(evt => {
                          let icon = '⚽';
                          let typeText = 'Gol';
                          let colorClass = 'text-brand-gray-light';
                          let bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                          
                          if (evt.type === 'penalty_goals') {
                            icon = '⚽ ▭';
                            typeText = 'Gol de Penalti';
                            colorClass = 'text-brand-gray-light';
                            bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                          } else if (evt.type === 'assists') {
                            icon = '🥾';
                            typeText = 'Asistencia';
                            colorClass = 'text-emerald-400';
                            bgIconColor = 'bg-emerald-950 border-emerald-800 text-emerald-400';
                          } else if (evt.type === 'yellow_cards') {
                            icon = '🟨';
                            typeText = 'T. Amarilla';
                            colorClass = 'text-yellow-400';
                            bgIconColor = 'bg-yellow-950 border-yellow-800 text-yellow-400';
                          } else if (evt.type === 'red_card') {
                            icon = '🟥';
                            typeText = 'T. Roja';
                            colorClass = 'text-red-500';
                            bgIconColor = 'bg-red-950 border-red-800 text-red-500';
                          } else if (evt.type === 'conceded_goals') {
                            icon = '🥅';
                            typeText = 'Gol en Contra';
                            colorClass = 'text-cyan-400';
                            bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                          } else if (evt.type === 'conceded_penalty_goals') {
                            icon = '🥅 ▭';
                            typeText = 'Gol Recibido Penalti';
                            colorClass = 'text-cyan-400';
                            bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                          } else if (evt.type === 'own_goals') {
                            icon = '💥';
                            typeText = 'Gol en Propia';
                            colorClass = 'text-orange-400';
                            bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                          } else if (evt.type === 'opponent_own_goal') {
                            icon = '💥';
                            typeText = 'Gol en Propia (Rival)';
                            colorClass = 'text-orange-400';
                            bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                          } else if (evt.type === 'own_goal_team') {
                            icon = '💥';
                            typeText = 'Gol en Propia (U.D. Atzeneta)';
                            colorClass = 'text-orange-400';
                            bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                          } else if (evt.type === 'substitution') {
                            icon = '🔄';
                            typeText = `Cambio (Entra ${evt.extraInfo})`;
                            colorClass = 'text-brand-gray-light';
                            bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                          } else if (evt.type === 'opponent_goal') {
                            icon = '🥅';
                            typeText = 'Gol del Rival';
                            colorClass = 'text-brand-red-500';
                            bgIconColor = 'bg-brand-red-600/10 border-brand-red-600/30 text-brand-red-500';
                          } else if (evt.type === 'opponent_yellow_card') {
                            icon = '🟨';
                            typeText = 'Amarilla del Rival';
                            colorClass = 'text-yellow-500';
                            bgIconColor = 'bg-yellow-950/30 border-yellow-800/30 text-yellow-500';
                          } else if (evt.type === 'injury') {
                            icon = '🚑';
                            typeText = 'Lesión';
                            colorClass = 'text-amber-500';
                            bgIconColor = 'bg-amber-950 border-amber-800 text-amber-500';
                          }

                          return (
                            <div key={evt.id} className="relative group">
                              <div className={`absolute -left-[27px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] z-10 ${bgIconColor}`}>
                                {icon}
                              </div>
                              <div className="flex items-center justify-between py-2 px-3 bg-brand-black-card hover:bg-brand-black-hover rounded-xl border border-brand-black-border transition-all group-hover:border-brand-gray-dark shadow-sm ml-1">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-brand-black/50 border border-brand-black-border shrink-0">
                                    <span className="text-[11px] font-black text-brand-red-600 leading-none">{evt.minute}'</span>
                                    <span className="text-[7px] font-bold text-brand-gray-muted uppercase leading-none mt-0.5">Min</span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-xs text-brand-gray-light block leading-tight">{evt.playerName}</span>
                                    <span className={`text-[9px] font-bold uppercase mt-0.5 block ${colorClass}`}>{typeText}</span>
                                  </div>
                                </div>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`¿Deseas eliminar este evento (${typeText} en min. ${evt.minute})?`)) {
                                        handleRemoveMatchEvent(evt.playerId, evt.type, evt.minute, evt.indexInType);
                                        showToast('success', 'Incidencia eliminada', 'El evento ha sido removido.');
                                      }
                                    }}
                                    className="p-1.5 hover:text-brand-red-600 text-brand-gray-muted bg-brand-black/50 hover:bg-brand-red-600/10 rounded-lg border border-transparent hover:border-brand-red-600/30 transition-all opacity-0 group-hover:opacity-100"
                                    title="Eliminar incidencia"
                                  >
                                    <X className="w-4 h-4" />
                                  </button>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Columna 2ª Parte */}
                  <div>
                    <h4 className="text-[11px] font-bold text-brand-gray-muted uppercase border-b border-brand-black-border pb-2 mb-3 sticky top-0 bg-brand-black-card z-20">2ª Parte</h4>
                    {matchEvents.filter(e => parseAbsoluteMinute(e.minute) > 45).length === 0 ? (
                      <p className="text-xs text-brand-gray-muted italic">Sin incidencias</p>
                    ) : (
                      <div className="relative border-l-2 border-brand-black-border ml-3 pl-4 space-y-2 py-1">
                        {matchEvents
                          .filter(e => parseAbsoluteMinute(e.minute) > 45)
                          .sort((a, b) => parseAbsoluteMinute(a.minute) - parseAbsoluteMinute(b.minute))
                          .map(evt => {
                          let icon = '⚽';
                          let typeText = 'Gol';
                          let colorClass = 'text-brand-gray-light';
                          let bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                          
                          if (evt.type === 'penalty_goals') {
                            icon = '⚽ ▭';
                            typeText = 'Gol de Penalti';
                            colorClass = 'text-brand-gray-light';
                            bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                          } else if (evt.type === 'assists') {
                            icon = '🥾';
                            typeText = 'Asistencia';
                            colorClass = 'text-emerald-400';
                            bgIconColor = 'bg-emerald-950 border-emerald-800 text-emerald-400';
                          } else if (evt.type === 'yellow_cards') {
                            icon = '🟨';
                            typeText = 'T. Amarilla';
                            colorClass = 'text-yellow-400';
                            bgIconColor = 'bg-yellow-950 border-yellow-800 text-yellow-400';
                          } else if (evt.type === 'red_card') {
                            icon = '🟥';
                            typeText = 'T. Roja';
                            colorClass = 'text-red-500';
                            bgIconColor = 'bg-red-950 border-red-800 text-red-500';
                          } else if (evt.type === 'conceded_goals') {
                            icon = '🥅';
                            typeText = 'Gol en Contra';
                            colorClass = 'text-cyan-400';
                            bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                          } else if (evt.type === 'conceded_penalty_goals') {
                            icon = '🥅 ▭';
                            typeText = 'Gol Recibido Penalti';
                            colorClass = 'text-cyan-400';
                            bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                          } else if (evt.type === 'own_goals') {
                            icon = '💥';
                            typeText = 'Gol en Propia';
                            colorClass = 'text-orange-400';
                            bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                          } else if (evt.type === 'opponent_own_goal') {
                            icon = '💥';
                            typeText = 'Gol en Propia (Rival)';
                            colorClass = 'text-orange-400';
                            bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                          } else if (evt.type === 'own_goal_team') {
                            icon = '💥';
                            typeText = 'Gol en Propia (U.D. Atzeneta)';
                            colorClass = 'text-orange-400';
                            bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                          } else if (evt.type === 'substitution') {
                            icon = '🔄';
                            typeText = `Cambio (Entra ${evt.extraInfo})`;
                            colorClass = 'text-brand-gray-light';
                            bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                          } else if (evt.type === 'opponent_goal') {
                            icon = '🥅';
                            typeText = 'Gol del Rival';
                            colorClass = 'text-brand-red-500';
                            bgIconColor = 'bg-brand-red-600/10 border-brand-red-600/30 text-brand-red-500';
                          } else if (evt.type === 'opponent_yellow_card') {
                            icon = '🟨';
                            typeText = 'Amarilla del Rival';
                            colorClass = 'text-yellow-500';
                            bgIconColor = 'bg-yellow-950/30 border-yellow-800/30 text-yellow-500';
                          } else if (evt.type === 'injury') {
                            icon = '🚑';
                            typeText = 'Lesión';
                            colorClass = 'text-amber-500';
                            bgIconColor = 'bg-amber-950 border-amber-800 text-amber-500';
                          }

                          return (
                            <div key={evt.id} className="relative group">
                              <div className={`absolute -left-[27px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] z-10 ${bgIconColor}`}>
                                {icon}
                              </div>
                              <div className="flex items-center justify-between py-2 px-3 bg-brand-black-card hover:bg-brand-black-hover rounded-xl border border-brand-black-border transition-all group-hover:border-brand-gray-dark shadow-sm ml-1">
                                <div className="flex items-center gap-3 text-left">
                                  <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-brand-black/50 border border-brand-black-border shrink-0">
                                    <span className="text-[11px] font-black text-brand-red-600 leading-none">{evt.minute}'</span>
                                    <span className="text-[7px] font-bold text-brand-gray-muted uppercase leading-none mt-0.5">Min</span>
                                  </div>
                                  <div>
                                    <span className="font-bold text-xs text-brand-gray-light block leading-tight">{evt.playerName}</span>
                                    <span className={`text-[9px] font-bold uppercase mt-0.5 block ${colorClass}`}>{typeText}</span>
                                  </div>
                                </div>
                                {isEditing && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`¿Deseas eliminar este evento (${typeText} en min. ${evt.minute})?`)) {
                                        handleRemoveMatchEvent(evt.playerId, evt.type, evt.minute, evt.indexInType);
                                        showToast('success', 'Incidencia eliminada', 'El evento ha sido removido.');
                                      }
                                    }}
                                    className="p-1.5 hover:text-brand-red-600 text-brand-gray-muted bg-brand-black/50 hover:bg-brand-red-600/10 rounded-lg border border-transparent hover:border-brand-red-600/30 transition-all opacity-0 group-hover:opacity-100"
                                    title="Eliminar incidencia"
                                  >
                                    <X className="w-4 h-4" />
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
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ANÁLISIS TÁCTICO DEL EQUIPO (BOTTON SECTION) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 bg-brand-black-card border border-brand-black-border p-5 rounded-2xl">
        <div className="md:col-span-2 lg:col-span-4 border-b border-brand-black-border pb-2.5 mb-2">
          <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-1.5">
            <Zap className="w-4.5 h-4.5 text-brand-red-600 animate-pulse" /> Análisis Táctico
          </h3>
          <p className="text-[10px] text-brand-gray-muted mt-0.5">Analiza el rendimiento táctico de la U.D. Atzeneta en este partido</p>
        </div>

        {/* Momento con Balón */}
        <div className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            Momento con Balón
          </div>
          <textarea
            className="form-input text-xs h-32 bg-brand-black-bg disabled:opacity-75"
            placeholder="Ej: Salida de balón fluida, creación de espacios..."
            value={tacticalWithBall}
            onChange={(e) => setTacticalWithBall(e.target.value)}
            disabled={!isEditing}
          />
          <div className="mt-4 bg-brand-black/50 p-3 rounded-lg border border-brand-black-border">
            <h4 className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider mb-2">Valoración</h4>
            <StarRating label="Salida de balón" value={teamRatings.with_ball.salida_balon} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, with_ball: {...teamRatings.with_ball, salida_balon: v}})} />
            <StarRating label="Posesión" value={teamRatings.with_ball.posesion} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, with_ball: {...teamRatings.with_ball, posesion: v}})} />
            <StarRating label="Finalización" value={teamRatings.with_ball.finalizacion} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, with_ball: {...teamRatings.with_ball, finalizacion: v}})} />
            <StarRating label="Juego Directo" value={teamRatings.with_ball.juego_directo} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, with_ball: {...teamRatings.with_ball, juego_directo: v}})} />
            <StarRating label="Ocupación Área" value={teamRatings.with_ball.ocupacion_area} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, with_ball: {...teamRatings.with_ball, ocupacion_area: v}})} />
          </div>
        </div>

        {/* Momento sin Balón */}
        <div className="bg-orange-950/10 border border-orange-900/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs uppercase tracking-wider">
            Momento sin Balón
          </div>
          <textarea
            className="form-input text-xs h-32 bg-brand-black-bg disabled:opacity-75"
            placeholder="Ej: Presión alta efectiva, repliegue tardío..."
            value={tacticalWithoutBall}
            onChange={(e) => setTacticalWithoutBall(e.target.value)}
            disabled={!isEditing}
          />
          <div className="mt-4 bg-brand-black/50 p-3 rounded-lg border border-brand-black-border">
            <h4 className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider mb-2">Valoración</h4>
            <StarRating label="Presión Alta" value={teamRatings.without_ball.presion_alta} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, without_ball: {...teamRatings.without_ball, presion_alta: v}})} />
            <StarRating label="Bloque Medio" value={teamRatings.without_ball.bloque_medio} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, without_ball: {...teamRatings.without_ball, bloque_medio: v}})} />
            <StarRating label="Bloque Bajo" value={teamRatings.without_ball.bloque_bajo} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, without_ball: {...teamRatings.without_ball, bloque_bajo: v}})} />
            <StarRating label="Defensa Área" value={teamRatings.without_ball.defensa_area} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, without_ball: {...teamRatings.without_ball, defensa_area: v}})} />
          </div>
        </div>

        {/* ABP (Acciones a Balón Parado) */}
        <div className="bg-brand-red-600/10 border border-brand-red-600/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-brand-red-500 font-bold text-xs uppercase tracking-wider">
            ABP
          </div>
          <textarea
            className="form-input text-xs h-32 bg-brand-black-bg disabled:opacity-75"
            placeholder="Ej: Jugadas ensayadas, defensa en zona..."
            value={tacticalSetPieces}
            onChange={(e) => setTacticalSetPieces(e.target.value)}
            disabled={!isEditing}
          />
          <div className="mt-4 bg-brand-black/50 p-3 rounded-lg border border-brand-black-border">
            <h4 className="text-[10px] font-bold text-brand-gray-muted uppercase tracking-wider mb-2">Valoración</h4>
            <StarRating label="Ofensiva" value={teamRatings.set_pieces.ofensiva} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, set_pieces: {...teamRatings.set_pieces, ofensiva: v}})} />
            <StarRating label="Defensiva" value={teamRatings.set_pieces.defensiva} disabled={!isEditing} onChange={(v: number) => setTeamRatings({...teamRatings, set_pieces: {...teamRatings.set_pieces, defensiva: v}})} />
          </div>
        </div>

        {/* Aspectos Generales */}
        <div className="bg-blue-950/10 border border-blue-900/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-blue-400 font-bold text-xs uppercase tracking-wider">
            Aspectos Generales
          </div>
          <textarea
            className="form-input text-xs h-32 bg-brand-black-bg disabled:opacity-75"
            placeholder="Ej: Actitud, intensidad, lectura de partido..."
            value={tacticalGeneral}
            onChange={(e) => setTacticalGeneral(e.target.value)}
            disabled={!isEditing}
          />
        </div>
      </div>
      </>
      ) : (
        <div className="space-y-8 max-w-5xl mx-auto pb-10">
          {/* MARCADO Y DATOS BÁSICOS */}
          <div className="bg-gradient-to-br from-brand-black-card to-brand-black-card/40 border border-brand-black-border p-8 rounded-3xl flex flex-col items-center shadow-xl relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-500 via-indigo-500 to-brand-red-500 opacity-50" />
            <span className="text-xs font-bold text-brand-gray-muted mb-4 uppercase tracking-[0.2em]">Resultado Final</span>
            <div className="flex items-center justify-center gap-6 sm:gap-12 w-full">
               <div className="text-right flex-1">
                  <span className="text-xl sm:text-2xl font-black text-brand-gray-light uppercase tracking-wide">{isLocal ? 'UD Atzeneta' : matchData.rival}</span>
               </div>
               <div className="bg-brand-black-bg/80 px-8 py-4 rounded-3xl border border-brand-black-border shadow-inner">
                  <span className="text-5xl font-black tracking-widest flex items-center">
                     <span className={scoreUs > scoreThem ? 'text-emerald-500' : scoreUs < scoreThem ? 'text-brand-red-600' : 'text-brand-gray-light'}>{isLocal ? scoreUs : scoreThem}</span>
                     <span className="text-brand-gray-dark mx-4 text-3xl">-</span>
                     <span className={scoreThem > scoreUs ? 'text-emerald-500' : scoreThem < scoreUs ? 'text-brand-red-600' : 'text-brand-gray-light'}>{isLocal ? scoreThem : scoreUs}</span>
                  </span>
               </div>
               <div className="text-left flex-1">
                  <span className="text-xl sm:text-2xl font-black text-brand-gray-light uppercase tracking-wide">{isLocal ? matchData.rival : 'UD Atzeneta'}</span>
               </div>
            </div>
            {opponentEvents.goals.length > 0 && (
               <div className="mt-6 flex flex-col items-center">
                 <span className="text-[10px] text-brand-gray-muted mb-2 uppercase">Goles del rival</span>
                 <div className="flex flex-wrap justify-center gap-2">
                   {opponentEvents.goals.map((g, idx) => (
                     <span key={idx} className="bg-brand-black-bg px-2 py-1 rounded text-xs text-brand-gray-light border border-brand-black-border">
                        ⚽ {g.dorsal ? `#${g.dorsal}` : 'Rival'} <span className="text-brand-gray-muted text-[10px]">({g.minute}')</span>
                     </span>
                   ))}
                 </div>
               </div>
            )}
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* CAMPOGRAMA */}
            <div className="space-y-4">
              <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-2 uppercase tracking-wider pl-2">
                <Users className="w-4 h-4 text-emerald-500" /> XI Inicial ({tacticalSystem})
              </h3>
              <div id="campograma-capture" className="relative w-full max-w-sm mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-800 to-emerald-950 border-4 border-emerald-100/20 rounded-3xl overflow-hidden shadow-2xl select-none ring-1 ring-white/10">
                {/* Franjas del césped */}
                <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                  {Array.from({ length: 10 }).map((_, i) => (
                    <div key={i} className={`h-[10%] w-full ${i % 2 === 0 ? 'bg-white' : 'bg-transparent'}`} />
                  ))}
                </div>

                {/* Líneas tácticas */}
                <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-emerald-100/20 -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 w-[30%] aspect-square border-2 border-emerald-100/20 rounded-full -translate-x-1/2 -translate-y-1/2" />
                <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-100/30 rounded-full -translate-x-1/2 -translate-y-1/2" />
                
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-b-2 border-x-2 border-emerald-100/20" />
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-b-2 border-x-2 border-emerald-100/20" />
                <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-b-2 border-emerald-100/20 rounded-b-full" />
                <div className="absolute top-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/25 rounded-full -translate-x-1/2" />

                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-t-2 border-x-2 border-emerald-100/20" />
                <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-t-2 border-x-2 border-emerald-100/20" />
                <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-t-2 border-emerald-100/20 rounded-t-full" />
                <div className="absolute bottom-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/25 rounded-full -translate-x-1/2" />
                {(FORMATIONS_SLOTS[tacticalSystem] || FORMATIONS_SLOTS['4-3-3']).map((slot: any, idx: number) => {
                  const playerId = lineup[idx];
                  const player = playerId ? dbPlayers.find(p => p.id === playerId) : null;
                  
                  // Get substitutions for this starter
                  let subs: any[] = [];
                  if (player && playerStats[player.id]) {
                    const pStat = playerStats[player.id];
                    const seenInIds = new Set<string>();
                    
                    if (pStat.event_minutes?.sub_out) {
                      pStat.event_minutes.sub_out.forEach(s => {
                        if (!seenInIds.has(s.playerInId)) {
                          seenInIds.add(s.playerInId);
                          subs.push({ min: s.minute, inId: s.playerInId });
                        }
                      });
                    }
                    if (pStat.substituted_for && pStat.substituted_minute && !seenInIds.has(pStat.substituted_for)) {
                      seenInIds.add(pStat.substituted_for);
                      subs.push({ min: pStat.substituted_minute.toString(), inId: pStat.substituted_for });
                    }
                  }

                  return (
                    <div
                      key={idx}
                      className="absolute transform -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-0.5"
                      style={{ left: `${slot.x}%`, top: `${slot.y}%`, zIndex: 10 }}
                    >
                      <div className="relative w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-black-card border-2 border-brand-gray-light shadow-xl flex items-center justify-center overflow-hidden ring-2 ring-black/50">
                        {player ? (
                          player.photo_url ? (
                            <img src={player.photo_url} alt={player.nickname || player.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-[10px] font-bold text-brand-gray-light">#{player.dorsal || '?'}</span>
                          )
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-brand-black-bg/50">
                            <Users className="w-3.5 h-3.5 text-brand-gray-dark/50" />
                          </div>
                        )}
                        {player && playerStats[player.id]?.event_minutes?.goals?.length > 0 && (
                          <div className="absolute -top-1 -right-1 bg-white rounded-full p-0.5 shadow">
                             <span className="text-[8px]">⚽</span>
                          </div>
                        )}
                      </div>
                      
                      {player && (
                        <div className="bg-brand-black-card/90 backdrop-blur-sm px-2 py-0.5 rounded shadow-lg border border-brand-black-border whitespace-nowrap">
                          <span className="text-[9px] font-bold text-white shadow-black drop-shadow-md">
                            {player.nickname || player.full_name.split(' ')[0]}
                          </span>
                        </div>
                      )}
                      
                      {/* Substitutions visuals */}
                      {subs.length > 0 && (
                        <div className="flex flex-col items-center -mt-0.5 z-20">
                          {subs.map((s, sIdx) => {
                            const subPlayer = dbPlayers.find(p => p.id === s.inId);
                            if (!subPlayer) return null;
                            return (
                              <div key={sIdx} className="flex flex-col items-center animate-fade-in">
                                <div className="h-2 border-l border-brand-gray-muted/50 border-dashed" />
                                <div className="bg-brand-black-card/95 border border-brand-gray-dark/50 px-1.5 py-0.5 rounded flex items-center gap-1 shadow-lg backdrop-blur-sm">
                                  <span className="text-[8px] text-brand-red-400 font-black">↓</span>
                                  <span className="text-[8px] text-emerald-400 font-black">↑</span>
                                  <span className="text-[8.5px] font-bold text-brand-gray-light max-w-[50px] leading-tight whitespace-normal break-words" title={subPlayer.nickname || subPlayer.full_name}>{subPlayer.nickname || subPlayer.full_name}</span>
                                  <span className="text-[7.5px] text-brand-gray-muted ml-0.5 bg-brand-black-bg px-0.5 rounded font-mono">{s.min}'</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* RENDIMIENTO Y VALORACIONES */}
            <div className="space-y-6">
              <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-2 uppercase tracking-wider pl-2">
                <Target className="w-4 h-4 text-indigo-400" /> Resumen de Rendimiento
              </h3>
              
              <div className="bg-brand-black-card/40 border border-brand-black-border rounded-2xl p-6 space-y-6 shadow-lg">
                <div className="grid grid-cols-2 gap-6">
                   <div className="space-y-3">
                     <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest border-b border-brand-black-border pb-1 block">Con Balón</span>
                     <div className="space-y-2">
                       <StarRating label="Salida de balón" value={teamRatings.with_ball.salida_balon} disabled={true} onChange={() => {}} />
                       <StarRating label="Posesión" value={teamRatings.with_ball.posesion} disabled={true} onChange={() => {}} />
                       <StarRating label="Finalización" value={teamRatings.with_ball.finalizacion} disabled={true} onChange={() => {}} />
                       <StarRating label="Juego Directo" value={teamRatings.with_ball.juego_directo} disabled={true} onChange={() => {}} />
                       <StarRating label="Ocupación Área" value={teamRatings.with_ball.ocupacion_area} disabled={true} onChange={() => {}} />
                     </div>
                   </div>
                   <div className="space-y-3">
                     <span className="text-[10px] font-black text-brand-red-500 uppercase tracking-widest border-b border-brand-black-border pb-1 block">Sin Balón</span>
                     <div className="space-y-2">
                       <StarRating label="Presión Alta" value={teamRatings.without_ball.presion_alta} disabled={true} onChange={() => {}} />
                       <StarRating label="Bloque Medio" value={teamRatings.without_ball.bloque_medio} disabled={true} onChange={() => {}} />
                       <StarRating label="Bloque Bajo" value={teamRatings.without_ball.bloque_bajo} disabled={true} onChange={() => {}} />
                       <StarRating label="Defensa Área" value={teamRatings.without_ball.defensa_area} disabled={true} onChange={() => {}} />
                     </div>
                     
                     <div className="pt-2">
                       <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest border-b border-brand-black-border pb-1 block mb-2">ABP</span>
                       <StarRating label="Ofensiva" value={teamRatings.set_pieces.ofensiva} disabled={true} onChange={() => {}} />
                       <StarRating label="Defensiva" value={teamRatings.set_pieces.defensiva} disabled={true} onChange={() => {}} />
                     </div>
                   </div>
                </div>
              </div>

              {(teamPositiveAspects || teamImproveAspects || tacticalWithBall || tacticalWithoutBall || tacticalSetPieces || tacticalGeneral) && (
                <div className="bg-brand-black-card/40 border border-brand-black-border rounded-2xl p-6 space-y-5 shadow-lg">
                   {teamPositiveAspects && (
                     <div>
                       <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Check className="w-3 h-3"/> Aspectos Positivos</span>
                       <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">{teamPositiveAspects}</p>
                     </div>
                   )}
                   {teamImproveAspects && (
                     <div>
                       <span className="text-[10px] font-black text-brand-red-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><AlertCircle className="w-3 h-3"/> Aspectos a Mejorar</span>
                       <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">{teamImproveAspects}</p>
                     </div>
                   )}
                   {tacticalWithBall && (
                     <div>
                       <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3"/> Análisis Con Balón</span>
                       <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">{tacticalWithBall}</p>
                     </div>
                   )}
                   {tacticalWithoutBall && (
                     <div>
                       <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3"/> Análisis Sin Balón</span>
                       <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">{tacticalWithoutBall}</p>
                     </div>
                   )}
                   {tacticalSetPieces && (
                     <div>
                       <span className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-1.5 flex items-center gap-1"><Zap className="w-3 h-3"/> Análisis Balón Parado (ABP)</span>
                       <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">{tacticalSetPieces}</p>
                     </div>
                   )}
                   {tacticalGeneral && (
                     <div>
                       <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1.5 flex items-center gap-1"><FileText className="w-3 h-3"/> Resumen General</span>
                       <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-wrap">{tacticalGeneral}</p>
                     </div>
                   )}
                </div>
              )}

              {/* Cronología de Eventos en Vista Lectura */}
              <div className="bg-brand-black-card/40 border border-brand-black-border rounded-2xl p-6 space-y-4 shadow-lg">
                <div className="border-b border-brand-black-border pb-3 text-left">
                  <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-brand-red-600" /> Línea de Tiempo de Eventos
                  </h3>
                  <p className="text-[10px] text-brand-gray-muted mt-0.5">Historial cronológico de todas las incidencias del partido</p>
                </div>
                
                <div className="max-h-[400px] overflow-y-auto pr-1 no-scrollbar">
                  {matchEvents.length === 0 ? (
                    <div className="text-center py-10 bg-brand-black/20 rounded-xl border border-dashed border-brand-black-border text-brand-gray-muted text-xs italic">
                      No hay incidencias registradas en este partido.
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      {/* Columna 1ª Parte */}
                      <div>
                        <h4 className="text-[11px] font-bold text-brand-gray-muted uppercase border-b border-brand-black-border pb-2 mb-3 sticky top-0 bg-brand-black-card z-20">1ª Parte</h4>
                        {matchEvents.filter(e => parseAbsoluteMinute(e.minute) <= 45).length === 0 ? (
                          <p className="text-xs text-brand-gray-muted italic">Sin incidencias</p>
                        ) : (
                          <div className="relative border-l-2 border-brand-black-border ml-3 pl-4 space-y-2 py-1">
                            {matchEvents
                              .filter(e => parseAbsoluteMinute(e.minute) <= 45)
                              .sort((a, b) => parseAbsoluteMinute(a.minute) - parseAbsoluteMinute(b.minute))
                              .map(evt => {
                              let icon = '⚽';
                              let typeText = 'Gol';
                              let colorClass = 'text-brand-gray-light';
                              let bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                              
                              if (evt.type === 'penalty_goals') {
                                icon = '⚽ ▭';
                                typeText = 'Gol de Penalti';
                                colorClass = 'text-brand-gray-light';
                                bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                              } else if (evt.type === 'assists') {
                                icon = '🥾';
                                typeText = 'Asistencia';
                                colorClass = 'text-emerald-400';
                                bgIconColor = 'bg-emerald-950 border-emerald-800 text-emerald-400';
                              } else if (evt.type === 'yellow_cards') {
                                icon = '🟨';
                                typeText = 'T. Amarilla';
                                colorClass = 'text-yellow-400';
                                bgIconColor = 'bg-yellow-950 border-yellow-800 text-yellow-400';
                              } else if (evt.type === 'red_card') {
                                icon = '🟥';
                                typeText = 'T. Roja';
                                colorClass = 'text-red-500';
                                bgIconColor = 'bg-red-950 border-red-800 text-red-500';
                              } else if (evt.type === 'conceded_goals') {
                                icon = '🥅';
                                typeText = 'Gol en Contra';
                                colorClass = 'text-cyan-400';
                                bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                              } else if (evt.type === 'conceded_penalty_goals') {
                                icon = '🥅 ▭';
                                typeText = 'Gol Recibido Penalti';
                                colorClass = 'text-cyan-400';
                                bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                              } else if (evt.type === 'own_goals') {
                                icon = '💥';
                                typeText = 'Gol en Propia';
                                colorClass = 'text-orange-400';
                                bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                              } else if (evt.type === 'opponent_own_goal') {
                                icon = '💥';
                                typeText = 'Gol en Propia (Rival)';
                                colorClass = 'text-orange-400';
                                bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                              } else if (evt.type === 'own_goal_team') {
                                icon = '💥';
                                typeText = 'Gol en Propia (U.D. Atzeneta)';
                                colorClass = 'text-orange-400';
                                bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                              } else if (evt.type === 'substitution') {
                                icon = '🔄';
                                typeText = `Cambio (Entra ${evt.extraInfo})`;
                                colorClass = 'text-brand-gray-light';
                                bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                              } else if (evt.type === 'opponent_goal') {
                                icon = '🥅';
                                typeText = 'Gol del Rival';
                                colorClass = 'text-brand-red-500';
                                bgIconColor = 'bg-brand-red-600/10 border-brand-red-600/30 text-brand-red-500';
                              } else if (evt.type === 'opponent_yellow_card') {
                                icon = '🟨';
                                typeText = 'Amarilla del Rival';
                                colorClass = 'text-yellow-500';
                                bgIconColor = 'bg-yellow-950/30 border-yellow-800/30 text-yellow-500';
                              } else if (evt.type === 'injury') {
                                icon = '🚑';
                                typeText = 'Lesión';
                                colorClass = 'text-amber-500';
                                bgIconColor = 'bg-amber-950 border-amber-800 text-amber-500';
                              }

                              return (
                                <div key={evt.id} className="relative group">
                                  <div className={`absolute -left-[27px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] z-10 ${bgIconColor}`}>
                                    {icon}
                                  </div>
                                  <div className="flex items-center justify-between py-2 px-3 bg-brand-black-card hover:bg-brand-black-hover rounded-xl border border-brand-black-border transition-all group-hover:border-brand-gray-dark shadow-sm ml-1">
                                    <div className="flex items-center gap-3 text-left">
                                      <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-brand-black/50 border border-brand-black-border shrink-0">
                                        <span className="text-[11px] font-black text-brand-red-600 leading-none">{evt.minute}'</span>
                                        <span className="text-[7px] font-bold text-brand-gray-muted uppercase leading-none mt-0.5">Min</span>
                                      </div>
                                      <div>
                                        <span className="font-bold text-xs text-brand-gray-light block leading-tight">{evt.playerName}</span>
                                        <span className={`text-[9px] font-bold uppercase mt-0.5 block ${colorClass}`}>{typeText}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>

                      {/* Columna 2ª Parte */}
                      <div>
                        <h4 className="text-[11px] font-bold text-brand-gray-muted uppercase border-b border-brand-black-border pb-2 mb-3 sticky top-0 bg-brand-black-card z-20">2ª Parte</h4>
                        {matchEvents.filter(e => parseAbsoluteMinute(e.minute) > 45).length === 0 ? (
                          <p className="text-xs text-brand-gray-muted italic">Sin incidencias</p>
                        ) : (
                          <div className="relative border-l-2 border-brand-black-border ml-3 pl-4 space-y-2 py-1">
                            {matchEvents
                              .filter(e => parseAbsoluteMinute(e.minute) > 45)
                              .sort((a, b) => parseAbsoluteMinute(a.minute) - parseAbsoluteMinute(b.minute))
                              .map(evt => {
                              let icon = '⚽';
                              let typeText = 'Gol';
                              let colorClass = 'text-brand-gray-light';
                              let bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                              
                              if (evt.type === 'penalty_goals') {
                                icon = '⚽ ▭';
                                typeText = 'Gol de Penalti';
                                colorClass = 'text-brand-gray-light';
                                bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                              } else if (evt.type === 'assists') {
                                icon = '🥾';
                                typeText = 'Asistencia';
                                colorClass = 'text-emerald-400';
                                bgIconColor = 'bg-emerald-950 border-emerald-800 text-emerald-400';
                              } else if (evt.type === 'yellow_cards') {
                                icon = '🟨';
                                typeText = 'T. Amarilla';
                                colorClass = 'text-yellow-400';
                                bgIconColor = 'bg-yellow-950 border-yellow-800 text-yellow-400';
                              } else if (evt.type === 'red_card') {
                                icon = '🟥';
                                typeText = 'T. Roja';
                                colorClass = 'text-red-500';
                                bgIconColor = 'bg-red-950 border-red-800 text-red-500';
                              } else if (evt.type === 'conceded_goals') {
                                icon = '🥅';
                                typeText = 'Gol en Contra';
                                colorClass = 'text-cyan-400';
                                bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                              } else if (evt.type === 'conceded_penalty_goals') {
                                icon = '🥅 ▭';
                                typeText = 'Gol Recibido Penalti';
                                colorClass = 'text-cyan-400';
                                bgIconColor = 'bg-cyan-950 border-cyan-800 text-cyan-400';
                              } else if (evt.type === 'own_goals') {
                                icon = '💥';
                                typeText = 'Gol en Propia';
                                colorClass = 'text-orange-400';
                                bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                              } else if (evt.type === 'opponent_own_goal') {
                                icon = '💥';
                                typeText = 'Gol en Propia (Rival)';
                                colorClass = 'text-orange-400';
                                bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                              } else if (evt.type === 'own_goal_team') {
                                icon = '💥';
                                typeText = 'Gol en Propia (U.D. Atzeneta)';
                                colorClass = 'text-orange-400';
                                bgIconColor = 'bg-orange-950 border-orange-800 text-orange-400';
                              } else if (evt.type === 'substitution') {
                                icon = '🔄';
                                typeText = `Cambio (Entra ${evt.extraInfo})`;
                                colorClass = 'text-brand-gray-light';
                                bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                              } else if (evt.type === 'opponent_goal') {
                                icon = '🥅';
                                typeText = 'Gol del Rival';
                                colorClass = 'text-brand-red-500';
                                bgIconColor = 'bg-brand-red-600/10 border-brand-red-600/30 text-brand-red-500';
                              } else if (evt.type === 'opponent_yellow_card') {
                                icon = '🟨';
                                typeText = 'Amarilla del Rival';
                                colorClass = 'text-yellow-500';
                                bgIconColor = 'bg-yellow-950/30 border-yellow-800/30 text-yellow-500';
                              } else if (evt.type === 'injury') {
                                icon = '🚑';
                                typeText = 'Lesión';
                                colorClass = 'text-amber-500';
                                bgIconColor = 'bg-amber-950 border-amber-800 text-amber-500';
                              }

                              return (
                                <div key={evt.id} className="relative group">
                                  <div className={`absolute -left-[27px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] z-10 ${bgIconColor}`}>
                                    {icon}
                                  </div>
                                  <div className="flex items-center justify-between py-2 px-3 bg-brand-black-card hover:bg-brand-black-hover rounded-xl border border-brand-black-border transition-all group-hover:border-brand-gray-dark shadow-sm ml-1">
                                    <div className="flex items-center gap-3 text-left">
                                      <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-brand-black/50 border border-brand-black-border shrink-0">
                                        <span className="text-[11px] font-black text-brand-red-600 leading-none">{evt.minute}'</span>
                                        <span className="text-[7px] font-bold text-brand-gray-muted uppercase leading-none mt-0.5">Min</span>
                                      </div>
                                      <div>
                                        <span className="font-bold text-xs text-brand-gray-light block leading-tight">{evt.playerName}</span>
                                        <span className={`text-[9px] font-bold uppercase mt-0.5 block ${colorClass}`}>{typeText}</span>
                                      </div>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          
          {/* TABLAS DE JUGADORES */}
          {renderPlayerListTables(true)}
        </div>
      )}

      {/* Modal Asistente de Eventos */}
      {isEventWizardOpen && (
        <MatchEventWizard
          isOpen={isEventWizardOpen}
          onClose={() => setIsEventWizardOpen(false)}
          calledUpPlayers={calledUpPlayers}
          playerStats={playerStats}
          onSave={handleSaveWizardEvents}
        />
      )}

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Borrar acta del partido"
        maxWidth="max-w-md"
      >
        <div className="space-y-5">
          <p className="text-sm text-brand-gray-muted leading-relaxed">
            ¿Seguro que deseas borrar todos los datos del acta (resultado, alineación,
            estadísticas de los jugadores y eventos)? Todo quedará restablecido a cero.
            <span className="block mt-2 font-semibold text-brand-red-500">Esta acción no se puede deshacer.</span>
          </p>
          <div className="flex justify-end gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="btn-secondary py-2 px-4 text-xs font-bold"
            >
              Cancelar
            </button>
            <button
              type="button"
              onClick={confirmDeleteReport}
              disabled={deleteReportMutation.isPending}
              className="btn-primary py-2 px-4 text-xs font-bold bg-brand-red-600 hover:bg-brand-red-700 border-brand-red-600"
            >
              {deleteReportMutation.isPending ? 'Borrando…' : 'Sí, borrar todo'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
};
