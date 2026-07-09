import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  PlusCircle, Check, X, ChevronDown, ChevronUp, AlertCircle,
  FileText, Save, Users, Zap
} from 'lucide-react';

import { FORMATIONS_SLOTS } from '../utils/formations';

// Formaciones tácticas y coordenadas en porcentaje (x: 0-100, y: 0-100) para campo vertical


interface LocalPlayerStats {
  player_id: string;
  is_called_up: boolean;
  is_starter: boolean;
  position: string;
  minutes_played: number;
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
  };
}

export const MatchReport: React.FC = () => {
  const { matchId } = useParams<{ matchId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const { hasPermission } = usePermissions();

  const canEdit = hasPermission('matches', 'editar');

  // Estados Locales del Partido
  const [scoreUs, setScoreUs] = useState<number>(0);
  const [scoreThem, setScoreThem] = useState<number>(0);
  const [tacticalSystem, setTacticalSystem] = useState<string>('4-3-3');
  const [teamPositive, setTeamPositive] = useState<string>('');
  const [teamImprove, setTeamImprove] = useState<string>('');

  // Alineación (mapea slot de la formación a ID de jugador)
  const [lineup, setLineup] = useState<Record<number, string>>({});
  const [activeSlotForSelection, setActiveSlotForSelection] = useState<number | null>(null);

  // Estadísticas locales de los jugadores
  const [playerStats, setPlayerStats] = useState<Record<string, LocalPlayerStats>>({});
  const [expandedPlayerId, setExpandedPlayerId] = useState<string | null>(null);

  // Buscador para añadir jugadores a la convocatoria sobre la marcha
  const [showAddPlayerDropdown, setShowAddPlayerDropdown] = useState(false);
  const [playerSearchQuery, setPlayerSearchQuery] = useState('');

  // Formulario rápido para añadir evento en cronología
  const [timelinePlayerId, setTimelinePlayerId] = useState<string>('');
  const [timelineEventType, setTimelineEventType] = useState<'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals' | ''>('');
  const [timelinePeriod, setTimelinePeriod] = useState<string>('1T');
  const [timelineMinute, setTimelineMinute] = useState<string>('1');
  const [timelinePlayerInId, setTimelinePlayerInId] = useState<string>('');
  const [timelinePlayerInPosition, setTimelinePlayerInPosition] = useState<string>('');

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
  const { data: initialStats = [], isLoading: isLoadingStats } = useQuery({
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
      setTeamPositive(matchData.team_positive_aspects || '');
      setTeamImprove(matchData.team_improve_aspects || '');
    }
  }, [matchData]);

  // Inicializar estadísticas e XI Inicial
  useEffect(() => {
    if (dbPlayers.length > 0 && initialStats) {
      const statsMap: Record<string, LocalPlayerStats> = {};
      
      dbPlayers.forEach(p => {
        const init = initialStats.find(s => s.player_id === p.id);
        statsMap[p.id] = {
          player_id: p.id,
          is_called_up: init ? init.is_called_up : false,
          is_starter: init ? !!init.is_starter : false,
          position: init ? init.position || '' : '',
          minutes_played: init ? init.minutes_played || 0 : 0,
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
          }
        };
      });

      setPlayerStats(statsMap);

      // Reconstruir el XI Inicial (lineup) asociando los jugadores marcados como titulares
      // a sus posiciones en la formación actual
      const slots = FORMATIONS_SLOTS[tacticalSystem] || FORMATIONS_SLOTS['4-3-3'];
      const builtLineup: Record<number, string> = {};

      const starterStats = initialStats.filter(s => s.is_starter && s.is_called_up);
      starterStats.forEach(stat => {
        // Encontrar un slot compatible libre
        const slotIdx = slots.findIndex((slot, idx) => 
          slot.role === stat.position && !builtLineup[idx]
        );
        if (slotIdx !== -1) {
          builtLineup[slotIdx] = stat.player_id;
        } else {
          // Si no coincide el rol exacto, poner en el primer slot vacío
          const firstEmpty = slots.findIndex((_, idx) => !builtLineup[idx]);
          if (firstEmpty !== -1) {
            builtLineup[firstEmpty] = stat.player_id;
            // Corregir posición local para que coincida con el slot
            if (statsMap[stat.player_id]) {
              statsMap[stat.player_id].position = slots[firstEmpty].role;
            }
          }
        }
      });

      setLineup(builtLineup);
    }
  }, [dbPlayers, initialStats, tacticalSystem]);

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
          position: currentSlots[slotIdx].role,
          // Si jugaba de titular y tenía 0 minutos, inicializamos con un valor normal (ej. 90)
          minutes_played: next[playerId].minutes_played || 90
        };
      }
      return next;
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
          position: '',
          // Opcional: reducir los minutos
          minutes_played: 0
        };
      }
      return next;
    });
  };

  // Manejar cambios en estadísticas numéricas y redimensionar los arrays de minutos
  const handleStatChange = (playerId: string, field: keyof LocalPlayerStats, val: any) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      let updated = { ...player, [field]: val };

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
        updated.event_minutes = {
          ...updated.event_minutes,
          red_card: hasRed ? (player.event_minutes.red_card || '90') : null
        };
      }

      next[playerId] = updated;
      return next;
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
      return next;
    });
  };

  // Añadir un evento específico desde la cronología
  const handleAddMatchEvent = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals', minuteStr: string, playerInId?: string, positionIn?: string) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      if (type === 'substitution') {
        // Obtenemos el minuto global para los minutos jugados y el campograma
        let minuteNum = 90;
        const parts = minuteStr.trim().split(' ');
        if (parts.length > 1) {
          const period = parts[0].toUpperCase();
          const min = parseInt(parts[1].split('+')[0].replace(/\D/g, '')) || 0;
          if (period === '1T') minuteNum = min;
          else if (period === '2T') minuteNum = min + 45;
          else if (period === '1P') minuteNum = min + 90;
          else if (period === '2P') minuteNum = min + 105;
          else minuteNum = min;
        } else {
          minuteNum = parseInt(minuteStr.split('+')[0].replace(/\D/g, '')) || 90;
        }
        
        if (playerInId) {
          const playerIn = next[playerInId];
          if (playerIn) {
            next[playerId] = {
              ...player,
              substituted_for: playerInId,
              substituted_minute: minuteNum,
              minutes_played: minuteNum
            };
            next[playerInId] = {
              ...playerIn,
              position: positionIn || playerIn.position || '',
              minutes_played: Math.max(0, 90 - minuteNum)
            };
          }
        }
        return next;
      }

      const eventMin = { ...player.event_minutes };

      if (type === 'red_card') {
        eventMin.red_card = minuteStr;
        next[playerId] = {
          ...player,
          red_card: true,
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

      return next;
    });
  };

  // Quitar un evento específico desde la cronología
  const handleRemoveMatchEvent = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals', minuteStr: string, indexInType?: number) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      if (type === 'substitution') {
        const playerInId = player.substituted_for;
        next[playerId] = {
          ...player,
          substituted_for: undefined,
          substituted_minute: undefined,
          minutes_played: 90
        };
        if (playerInId && next[playerInId]) {
          next[playerInId] = {
            ...next[playerInId],
            minutes_played: 0,
            position: ''
          };
        }
        return next;
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

      return next;
    });
  };

  // Consolidar todos los eventos de forma ordenada para la línea de tiempo
  // Consolidar todos los eventos de forma ordenada para la línea de tiempo
  const matchEvents = useMemo(() => {
    const eventsList: {
      id: string;
      playerId: string;
      playerName: string;
      type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals' | 'substitution' | 'penalty_goals' | 'conceded_penalty_goals';
      minute: string;
      indexInType: number;
      extraInfo?: string;
    }[] = [];

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

      if (stat.red_card && stat.event_minutes.red_card !== null && stat.event_minutes.red_card !== undefined) {
        eventsList.push({ id: `${stat.player_id}-red_card-${stat.event_minutes.red_card}`, playerId: stat.player_id, playerName, type: 'red_card', minute: stat.event_minutes.red_card, indexInType: 0 });
      }

      if (stat.substituted_minute && stat.substituted_for) {
        const subInObj = dbPlayers.find(p => p.id === stat.substituted_for);
        eventsList.push({
          id: `${stat.player_id}-substitution-${stat.substituted_minute}`,
          playerId: stat.player_id,
          playerName,
          type: 'substitution',
          minute: `${stat.substituted_minute}'`,
          indexInType: 0,
          extraInfo: subInObj ? (subInObj.nickname || subInObj.full_name) : 'Jugador'
        });
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
    
    setScoreUs(newScoreUs);
    setScoreThem(newScoreThem);
  }, [playerStats]);

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

      // 1. Guardar metadatos del partido
      const updatedMatch = {
        score_us: matchStatus === 'Jugado' ? scoreUs : null,
        score_them: matchStatus === 'Jugado' ? scoreThem : null,
        status: matchStatus,
        tactical_system: tacticalSystem,
        team_positive_aspects: teamPositive.trim(),
        team_improve_aspects: teamImprove.trim()
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
        positive_aspects: p.positive_aspects.trim() || null,
        improve_aspects: p.improve_aspects.trim() || null,
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
      showToast('success', 'Acta Guardada', 'Las estadísticas y la táctica se guardaron correctamente.');
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
      queryClient.invalidateQueries({ queryKey: ['matches'] });
      queryClient.invalidateQueries({ queryKey: ['playerMatchStats', matchId] });
      showToast('success', 'Acta Borrada', 'Se han restablecido los datos del acta del partido.');
      navigate('/matches');
    },
    onError: (err: any) => {
      showToast('error', 'Error al Borrar', err.message || 'No se pudo borrar el acta.');
    }
  });

  const handleDeleteReport = () => {
    if (window.confirm('¿Estás seguro de que deseas borrar todos los datos del acta (resultado, alineación, estadísticas)? Esta acción no se puede deshacer.')) {
      deleteReportMutation.mutate();
    }
  };

  // Exportar el acta completa a PDF
  const handleExportPDF = async () => {
    if (!matchData) return;
    try {
      showToast('info', 'Generando PDF', 'Espere un momento mientras se crea el informe...');
      
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
        team_positive_aspects: teamPositive,
        team_improve_aspects: teamImprove
      };

      await exportMatchReportToPDF(currentMatch, orderedCalledUp, statsList);
      showToast('success', 'PDF Descargado', 'El acta del partido se ha descargado correctamente.');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error de Exportación', 'No se pudo generar el documento PDF.');
    }
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/matches')}
            className="p-2 hover:bg-brand-black-hover border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light rounded-lg transition-all"
            title="Volver a partidos"
          >
            <ArrowLeft className="w-4 h-4" />
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

          <button
            type="button"
            onClick={handleDeleteReport}
            disabled={deleteReportMutation.isPending}
            className="btn-secondary py-2.5 text-xs text-brand-red-600 border-brand-red-600/30 hover:bg-brand-red-600/10 font-bold"
          >
            {deleteReportMutation.isPending ? 'Borrando...' : 'Borrar Acta'}
          </button>

          <button
            onClick={handleSaveAll}
            disabled={saveMutation.isPending}
            className="btn-primary py-2.5 text-xs font-bold"
          >
            <Save className="w-4 h-4" /> {saveMutation.isPending ? 'Guardando...' : 'Guardar Acta de Partido'}
          </button>
        </div>
      </div>

      {/* Grid Principal: Lado Izquierdo vs Lado Derecho */}
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
              <span className="text-[10px] font-mono font-black text-brand-red-600 bg-brand-red-600/10 px-2 py-0.5 rounded border border-brand-red-600/20">
                {Object.keys(lineup).length}/11 Titulares
              </span>
            </div>

            {/* Representación gráfica del Campo de Fútbol */}
            <div className="relative w-full max-w-sm mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-800 to-emerald-950 border-4 border-emerald-100/20 rounded-2xl overflow-hidden shadow-2xl select-none">
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

              {/* Render de los slots de la formación */}
              {currentSlots.map((slot, idx) => {
                const starterId = lineup[idx];
                
                // Construir la cadena de sustituciones para mostrar múltiples jugadores si los hay
                const playerChain: Array<{ id: string, minute: number | null, stats: any }> = [];
                
                if (starterId && playerStats) {
                  let currentId = starterId;
                  let currentStats = playerStats[currentId];
                  playerChain.push({ id: currentId, minute: null, stats: currentStats });
                  
                  while (currentStats?.substituted_for) {
                    const subMinute = currentStats.substituted_minute || null;
                    currentId = currentStats.substituted_for;
                    currentStats = playerStats[currentId];
                    playerChain.push({ id: currentId, minute: subMinute, stats: currentStats });
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
                    className="absolute z-10 flex flex-col items-center select-none"
                  >
                    {playerChain.length > 0 ? (
                      // Slot Ocupado
                      <div className="relative flex flex-col items-center">
                        <button
                          type="button"
                          onClick={() => handleRemovePlayerFromLineup(idx)}
                          className="absolute -top-1.5 -right-1.5 bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-full p-0.5 shadow-md border border-emerald-950 transition-all z-20"
                          title="Quitar de alineación"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                        
                        <div className="flex flex-row items-end gap-1.5 bg-black/30 p-1 rounded-2xl backdrop-blur-sm">
                          {playerChain.map((chainItem, chainIdx) => {
                            const pObj = dbPlayers.find(p => p.id === chainItem.id);
                            if (!pObj) return null;
                            const isStarter = chainIdx === 0;
                            const activeStats = chainItem.stats;
                            
                            return (
                              <div key={chainItem.id} className="relative flex flex-col items-center group">
                                {chainItem.minute && (
                                  <span className="absolute -top-4 bg-brand-black-card text-white border border-brand-red-600/30 text-[8.5px] font-black px-1 rounded whitespace-nowrap z-40 shadow-sm">
                                    {chainItem.minute}'
                                  </span>
                                )}

                                <button
                                  type="button"
                                  onClick={() => setActiveSlotForSelection(activeSlotForSelection === idx ? null : idx)}
                                  className={`relative ${isStarter ? 'w-11 h-11' : 'w-9 h-9 opacity-95'} rounded-full bg-brand-black-card border-2 ${isStarter ? 'border-yellow-500' : 'border-brand-gray-light'} shadow-premium flex items-center justify-center hover:scale-105 active:scale-95 transition-all`}
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
                                
                                <span className={`mt-0.5 bg-brand-black-card/90 text-brand-gray-light font-bold px-1 py-0.5 rounded shadow border border-brand-black-border max-w-[55px] truncate text-center leading-none ${isStarter ? 'text-[9px]' : 'text-[7.5px]'}`}>
                                  {pObj.nickname || pObj.full_name.split(' ')[0]}
                                </span>
                              </div>
                            );
                          })}
                        </div>
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
                        <span className="text-[8px] font-black leading-none">{slot.role}</span>
                        <span className="text-[10px] font-bold leading-none mt-0.5">+</span>
                      </button>
                    )}

                    {/* Popover desplegable para asignar jugador en el slot activo */}
                    {activeSlotForSelection === idx && (
                      <div 
                        className={`absolute bg-brand-black border border-brand-black-border rounded-xl p-2.5 shadow-premium max-h-[170px] overflow-y-auto z-30 w-44 no-scrollbar
                          ${slot.y > 60 ? 'bottom-11' : 'top-11'} 
                          ${slot.x < 30 ? 'left-0' : slot.x > 70 ? 'right-0' : 'left-1/2 -translate-x-1/2'}
                        `}
                      >
                        <div className="text-[9px] font-bold text-brand-gray-muted uppercase border-b border-brand-black-border pb-1.5 mb-1.5 text-center">
                          Demarcación: {slot.role}
                        </div>
                        {availableSubstitutes.length === 0 ? (
                          <div className="text-[10px] text-brand-gray-muted text-center py-2.5 italic">
                            No quedan suplentes en convocatoria.
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {availableSubstitutes.map(p => (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => handleAssignPlayer(idx, p.id)}
                                className="w-full text-left p-1.5 rounded hover:bg-brand-black-hover text-[11px] font-semibold text-brand-gray-light flex items-center justify-between transition-colors"
                              >
                                <span>{p.nickname || p.full_name}</span>
                                {p.dorsal && (
                                  <span className="text-[9px] font-bold bg-brand-black-border text-brand-red-600 px-1 rounded">
                                    {p.dorsal}
                                  </span>
                                )}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Cronología / Registro de Eventos del Partido */}
          <div className="dashboard-card p-5 space-y-4">
            <div className="border-b border-brand-black-border pb-3 text-left">
              <h3 className="text-sm font-bold text-brand-gray-light">Cronología de Incidencias</h3>
              <p className="text-[10px] text-brand-gray-muted mt-0.5">Registra eventos en vivo o edita la línea de tiempo del partido</p>
            </div>

            {/* Formulario rápido para añadir incidencias */}
            <div className="bg-brand-black/30 p-3 rounded-lg border border-brand-black-border space-y-3">
              <span className="text-[10px] font-bold text-brand-red-600 uppercase tracking-wider block text-left">Registrar Nueva Incidencia</span>
              
              <div className="space-y-4 text-left mt-3">
                {/* Paso 1: Evento */}
                <div className="bg-brand-black/30 p-2.5 rounded border border-brand-black-border">
                  <label className="text-[10px] font-bold text-brand-gray-light uppercase block mb-1.5 flex items-center gap-1.5">
                    <span className="bg-brand-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px]">1</span> 
                    ¿Qué ha pasado?
                  </label>
                  <select
                    value={timelineEventType}
                    onChange={(e) => {
                      setTimelineEventType(e.target.value as any);
                      // Reset player selection when changing event type to avoid mismatches
                      setTimelinePlayerId('');
                      setTimelinePlayerInId('');
                      setTimelinePlayerInPosition('');
                    }}
                    className="form-input bg-brand-black-bg text-xs py-1.5 px-2.5 w-full border-brand-black-border"
                  >
                    <option value="">-- Selecciona el tipo de incidencia --</option>
                    <option value="goals">⚽ Gol</option>
                    <option value="penalty_goals">⚽ Gol de Penalti</option>
                    <option value="assists">🥾 Asistencia</option>
                    <option value="conceded_goals">🥅 Gol en Contra</option>
                    <option value="conceded_penalty_goals">🥅 Gol Recibido Penalti</option>
                    <option value="own_goals">💥 Gol en Propia</option>
                    <option value="yellow_cards">🟨 Tarjeta Amarilla</option>
                    <option value="red_card">🟥 Tarjeta Roja</option>
                    <option value="substitution">🔄 Cambio</option>
                  </select>
                </div>

                {/* Paso 2: Futbolista(s) */}
                {timelineEventType !== '' && (
                  <div className="bg-brand-black/30 p-2.5 rounded border border-brand-black-border animate-fadeIn space-y-3">
                    <label className="text-[10px] font-bold text-brand-gray-light uppercase block mb-1.5 flex items-center gap-1.5">
                      <span className="bg-brand-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px]">2</span> 
                      ¿Quién {timelineEventType === 'substitution' ? 'está implicado en el cambio' : 'es el protagonista'}?
                    </label>
                    
                    <div className="space-y-2.5">
                      <div>
                        <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">
                          {timelineEventType === 'substitution' ? 'SALE DEL CAMPO' : 'Futbolista'}
                        </label>
                        <select
                          value={timelinePlayerId}
                          onChange={(e) => {
                            const pId = e.target.value;
                            setTimelinePlayerId(pId);
                            const playerObj = dbPlayers.find(p => p.id === pId);
                            const stats = playerStats[pId];
                            const isGK = playerObj?.position === 'Portero' || stats?.position === 'GK';
                            if (!isGK && timelineEventType === 'conceded_goals') {
                              setTimelineEventType('goals');
                            }
                          }}
                          className="form-input bg-brand-black-bg text-xs py-1.5 px-2.5 w-full border-brand-black-border"
                        >
                          <option value="">-- Seleccionar --</option>
                          {calledUpPlayers.map(p => {
                            const stats = playerStats[p.id];
                            const isGK = p.position === 'Portero' || stats?.position === 'GK';
                            // Para cambios, lo ideal es que salga un titular o alguien ya en campo, pero permitimos todos de la convocatoria
                            return (
                              <option key={p.id} value={p.id}>
                                {p.dorsal ? `(${p.dorsal}) ` : ''}{p.nickname || p.full_name} {isGK ? ' (POR)' : ''}
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {timelineEventType === 'substitution' && (
                        <div className="grid grid-cols-2 gap-2 animate-fadeIn border-t border-brand-black-border pt-2.5">
                          <div>
                            <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1 text-cyan-400">ENTRA</label>
                            <select
                              value={timelinePlayerInId}
                              onChange={(e) => setTimelinePlayerInId(e.target.value)}
                              className="form-input bg-brand-black-bg text-xs py-1.5 px-2.5 w-full border-brand-black-border"
                            >
                              <option value="">-- Suplente --</option>
                              {calledUpPlayers.filter(p => !playerStats[p.id]?.is_starter).map(p => (
                                <option key={p.id} value={p.id}>{p.nickname || p.full_name}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Posición</label>
                            <select
                              value={timelinePlayerInPosition}
                              onChange={(e) => setTimelinePlayerInPosition(e.target.value)}
                              className="form-input bg-brand-black-bg text-xs py-1.5 px-2.5 w-full border-brand-black-border"
                            >
                              <option value="">Selecciona...</option>
                              <option value="Portero">Portero</option>
                              <option value="Lateral Derecho">Lateral Derecho</option>
                              <option value="Central Derecho">Central Derecho</option>
                              <option value="Central">Central</option>
                              <option value="Central Izquierdo">Central Izquierdo</option>
                              <option value="Lateral Izquierdo">Lateral Izquierdo</option>
                              <option value="Pivote">Pivote</option>
                              <option value="Interior Derecho">Interior Derecho</option>
                              <option value="Interior">Interior</option>
                              <option value="Interior Izquierdo">Interior Izquierdo</option>
                              <option value="Mediapunta">Mediapunta</option>
                              <option value="Extremo Derecho">Extremo Derecho</option>
                              <option value="Extremo Izquierdo">Extremo Izquierdo</option>
                              <option value="Delantero Centro">Delantero Centro</option>
                            </select>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Paso 3: Momento y Añadir */}
                {timelineEventType !== '' && timelinePlayerId !== '' && (timelineEventType !== 'substitution' || (timelinePlayerInId !== '' && timelinePlayerInPosition !== '')) && (
                  <div className="bg-brand-black/30 p-2.5 rounded border border-brand-black-border animate-fadeIn">
                    <label className="text-[10px] font-bold text-brand-gray-light uppercase block mb-2 flex items-center gap-1.5">
                      <span className="bg-brand-red-600 text-white w-4 h-4 rounded-full flex items-center justify-center text-[9px]">3</span> 
                      ¿Cuándo ha ocurrido?
                    </label>
                    <div className="flex flex-col sm:flex-row gap-2.5">
                      <div className="flex gap-2 w-full sm:w-auto flex-1">
                        <div className="w-1/2 sm:w-28 shrink-0">
                          <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Parte</label>
                          <select
                            value={timelinePeriod}
                            onChange={(e) => setTimelinePeriod(e.target.value)}
                            className="form-input bg-brand-black-bg text-xs py-1.5 px-2.5 w-full border-brand-black-border"
                          >
                            <option value="1T">1ª Parte</option>
                            <option value="2T">2ª Parte</option>
                            <option value="1P">Prórroga 1</option>
                            <option value="2P">Prórroga 2</option>
                            <option value="PEN">Penaltis</option>
                          </select>
                        </div>
                        <div className="w-1/2 sm:w-20 shrink-0">
                          <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Minuto</label>
                          <input
                            type="text"
                            placeholder="Ej: 45+2"
                            value={timelineMinute}
                            onChange={(e) => setTimelineMinute(e.target.value)}
                            className="form-input bg-brand-black-bg text-xs py-1.5 px-2.5 text-center w-full border-brand-black-border"
                          />
                        </div>
                      </div>
                      
                      <div className="w-full sm:w-auto mt-2 sm:mt-0 flex items-end">
                        <button
                          type="button"
                          onClick={() => {
                            if (!timelinePlayerId) {
                              showToast('error', 'Campos requeridos', 'Debes seleccionar un futbolista.');
                              return;
                            }
                            
                            // Validar tarjeta roja única
                            if (timelineEventType === 'red_card') {
                              const stats = playerStats[timelinePlayerId];
                              if (stats && stats.red_card) {
                                showToast('error', 'Incidencia inválida', 'Este jugador ya tiene una tarjeta roja registrada.');
                                return;
                              }
                            }
                            
                            const finalMinute = `${timelinePeriod} ${timelineMinute}`;

                            if (timelineEventType === 'substitution') {
                              if (!timelinePlayerInId) {
                                showToast('error', 'Campos requeridos', 'Debes seleccionar el jugador que entra.');
                                return;
                              }
                              handleAddMatchEvent(timelinePlayerId, timelineEventType, finalMinute, timelinePlayerInId, timelinePlayerInPosition);
                              // Reset forms
                              setTimelinePlayerInId('');
                              setTimelinePlayerInPosition('');
                            } else {
                              handleAddMatchEvent(timelinePlayerId, timelineEventType, finalMinute);
                            }
                            showToast('success', 'Incidencia añadida', 'El evento ha sido registrado en la cronología.');
                            
                            // Reset form to step 1 automatically to speed up next entry
                            setTimelineEventType('');
                            setTimelinePlayerId('');
                          }}
                          className="btn-primary py-2 px-4 text-xs font-bold w-full h-[34px] flex justify-center items-center"
                        >
                          Guardar Incidencia
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* LADO DERECHO: Tabla de Estadísticas de Jugadores */}
        <div className="xl:col-span-7 space-y-4">
          <div className="dashboard-card p-5 space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-brand-black-border pb-3">
              <div>
                <h3 className="text-sm font-bold text-brand-gray-light">Estadísticas de Rendimiento</h3>
                <p className="text-[10px] text-brand-gray-muted mt-0.5">Controla minutos, goles y tarjetas del plantel</p>
              </div>

              {/* Agregar jugadores a la convocatoria */}
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
            </div>

            {/* Listado en tabla */}
            <div className="grid grid-cols-1 2xl:grid-cols-2 gap-2 border border-brand-black-border p-2 rounded-xl bg-brand-black/10">
              {calledUpPlayers.length === 0 ? (
                <div className="col-span-1 2xl:col-span-2 text-center py-12 text-brand-gray-muted text-xs italic">
                  No hay jugadores en la convocatoria. Haz clic en "Convocar Jugador" para agregarlos al acta.
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
                          const isGK = player.position === 'Portero' || stats.position === 'GK';
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
                                      <span className="text-[10px] font-bold text-brand-gray-light truncate" title={player.nickname || player.full_name}>
                                        {player.nickname || player.full_name}
                                      </span>
                                    </div>
                                    <div className="text-[8px] text-brand-gray-muted mt-0.5 flex items-center gap-1 overflow-hidden">
                                      {stats.is_starter ? (
                                        <span className="text-yellow-500 font-semibold truncate shrink-0">Titular ({stats.position})</span>
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
                                    <input
                                      type="number"
                                      min="0"
                                      max="120"
                                      className="form-input text-[10px] font-bold text-white py-0.5 px-0.5 text-center w-full bg-brand-black-bg"
                                      value={stats.minutes_played}
                                      onChange={(e) => handleStatChange(player.id, 'minutes_played', Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                  </div>
                                  
                                  {/* Goles */}
                                  <div className="text-center w-[24px]">
                                    <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">Gol</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      className="form-input text-[10px] font-bold text-white py-0.5 px-0 text-center w-full bg-brand-black-bg"
                                      value={stats.goals}
                                      onChange={(e) => handleStatChange(player.id, 'goals', Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                  </div>

                                  {/* Asist / G. Enc */}
                                  {isGK ? (
                                    <div className="text-center w-[24px]">
                                      <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none" title="Goles Encajados">G.E</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        className="form-input text-[10px] font-bold text-white py-0.5 px-0 text-center w-full bg-brand-black-bg"
                                        value={stats.conceded_goals || 0}
                                        onChange={(e) => handleStatChange(player.id, 'conceded_goals', Math.max(0, parseInt(e.target.value) || 0))}
                                      />
                                    </div>
                                  ) : (
                                    <div className="text-center w-[24px]">
                                      <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">Ast</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        className="form-input text-[10px] font-bold text-white py-0.5 px-0 text-center w-full bg-brand-black-bg"
                                        value={stats.assists}
                                        onChange={(e) => handleStatChange(player.id, 'assists', Math.max(0, parseInt(e.target.value) || 0))}
                                      />
                                    </div>
                                  )}

                                  {/* Gol en propia (P.P.) */}
                                  <div className="text-center w-[24px]">
                                    <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none" title="Goles en propia puerta">P.P</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      className="form-input text-[10px] font-bold text-white py-0.5 px-0 text-center w-full bg-brand-black-bg"
                                      value={stats.own_goals || 0}
                                      onChange={(e) => handleStatChange(player.id, 'own_goals', Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                  </div>

                                  {/* Amarillas */}
                                  <div className="text-center w-[26px]">
                                    <span className="text-[6px] font-bold text-brand-gray-muted uppercase block mb-0.5 leading-none">TA</span>
                                    <select
                                      className="form-input text-[10px] font-bold text-white py-0.5 px-0 w-full bg-brand-black-bg text-center appearance-none"
                                      value={stats.yellow_cards}
                                      onChange={(e) => handleStatChange(player.id, 'yellow_cards', parseInt(e.target.value) || 0)}
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
                                      onClick={() => handleStatChange(player.id, 'red_card', !stats.red_card)}
                                      className={`text-[8px] font-bold w-full h-[20px] flex items-center justify-center rounded border transition-all ${
                                        stats.red_card
                                          ? 'bg-red-950/40 text-red-500 border-red-800'
                                          : 'bg-brand-black-bg text-brand-gray-muted border-brand-black-border hover:border-brand-gray-dark'
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
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'goals', gIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Goles Penalti */}
                                        {stats.event_minutes.penalty_goals?.map((min, pIdx) => (
                                          <div key={`p-${pIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-brand-gray-muted truncate">⚽ Penalti {pIdx + 1}:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'penalty_goals', pIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Goles Encajados */}
                                        {isGK && stats.event_minutes.conceded_goals?.map((min, cIdx) => (
                                          <div key={`c-${cIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-cyan-400 font-semibold truncate">🥅 Encajado {cIdx + 1}:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'conceded_goals', cIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Goles Encajados Penalti */}
                                        {isGK && stats.event_minutes.conceded_penalty_goals?.map((min, cpIdx) => (
                                          <div key={`cp-${cpIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-cyan-400 font-semibold truncate">🥅 Pen. Encaj {cpIdx + 1}:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'conceded_penalty_goals', cpIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Goles en Propia */}
                                        {stats.event_minutes.own_goals?.map((min, oIdx) => (
                                          <div key={`o-${oIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-orange-400 font-semibold truncate">💥 Propia {oIdx + 1}:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'own_goals', oIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Asistencias */}
                                        {stats.event_minutes.assists?.map((min, aIdx) => (
                                          <div key={`a-${aIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-brand-gray-muted truncate">🥾 Asist {aIdx + 1}:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'assists', aIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Amarillas */}
                                        {stats.event_minutes.yellow_cards?.map((min, yIdx) => (
                                          <div key={`y-${yIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-yellow-500 font-semibold truncate">🟨 Tarjeta {yIdx + 1}:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'yellow_cards', yIdx, e.target.value)}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Roja */}
                                        {stats.red_card && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-red-500 font-semibold truncate">🟥 Roja:</span>
                                            <input
                                              type="text"
                                              className="form-input text-xs w-20 py-1 px-1.5 text-center bg-brand-black"
                                              value={stats.event_minutes.red_card || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'red_card', 0, e.target.value)}
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
                                    <textarea
                                      className="form-input text-xs w-full p-2 bg-brand-black min-h-[60px]"
                                      placeholder="Añade un comentario sobre la actuación del jugador..."
                                      value={stats.comments || ''}
                                      onChange={(e) => handleStatChange(player.id, 'comments', e.target.value)}
                                    />
                                  </div>

                                  {/* Aspectos Cualitativos del Jugador */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider block mb-1">Aspectos Positivos</label>
                                      <textarea
                                        className="form-input text-xs h-16 resize-none bg-brand-black"
                                        placeholder="Puntos fuertes de su partido: repliegues, actitud, acierto en pase..."
                                        value={stats.positive_aspects}
                                        onChange={(e) => handleStatChange(player.id, 'positive_aspects', e.target.value)}
                                      />
                                    </div>
                                    <div>
                                      <label className="text-[10px] font-bold text-orange-400 uppercase tracking-wider block mb-1">Aspectos a Mejorar</label>
                                      <textarea
                                        className="form-input text-xs h-16 resize-none bg-brand-black"
                                        placeholder="Aspectos que debe corregir: pérdidas en zonas de riesgo, perfilación..."
                                        value={stats.improve_aspects}
                                        onChange={(e) => handleStatChange(player.id, 'improve_aspects', e.target.value)}
                                      />
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

          {/* Cronología de Eventos (Movida a la derecha) */}
          <div className="dashboard-card p-5 space-y-4">
            <div className="border-b border-brand-black-border pb-3 text-left">
              <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-brand-red-600" /> Línea de Tiempo de Eventos
              </h3>
              <p className="text-[10px] text-brand-gray-muted mt-0.5">Historial cronológico de todas las incidencias del partido</p>
            </div>
            
            <div className="max-h-[350px] overflow-y-auto pr-1 no-scrollbar">
              {matchEvents.length === 0 ? (
                <div className="text-center py-10 bg-brand-black/20 rounded-xl border border-dashed border-brand-black-border text-brand-gray-muted text-xs italic">
                  No hay incidencias registradas en este partido.
                </div>
              ) : (
                <div className="relative border-l-2 border-brand-black-border ml-3 pl-4 space-y-4 py-2">
                  {matchEvents.map(evt => {
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
                    } else if (evt.type === 'substitution') {
                      icon = '🔄';
                      typeText = `Cambio (Entra ${evt.extraInfo})`;
                      colorClass = 'text-brand-gray-light';
                      bgIconColor = 'bg-brand-black border-brand-black-border text-brand-gray-light';
                    }

                    return (
                      <div key={evt.id} className="relative group">
                        {/* Timeline node */}
                        <div className={`absolute -left-[27px] w-6 h-6 rounded-full border-2 flex items-center justify-center text-[10px] z-10 ${bgIconColor}`}>
                          {icon}
                        </div>
                        
                        {/* Event Card */}
                        <div className="flex items-center justify-between p-3 bg-brand-black-card hover:bg-brand-black-hover rounded-xl border border-brand-black-border transition-all group-hover:border-brand-gray-dark shadow-sm ml-1">
                          <div className="flex items-center gap-3 text-left">
                            <div className="flex flex-col items-center justify-center w-9 h-9 rounded-lg bg-brand-black/50 border border-brand-black-border shrink-0">
                              <span className="text-[11px] font-black text-brand-red-600 leading-none">{evt.minute}'</span>
                              <span className="text-[7px] font-bold text-brand-gray-muted uppercase leading-none mt-0.5">Min</span>
                            </div>
                            <div>
                              <span className="font-bold text-xs text-brand-gray-light block leading-tight">
                                {evt.playerName}
                              </span>
                              <span className={`text-[9px] font-bold uppercase mt-0.5 block ${colorClass}`}>
                                {typeText}
                              </span>
                            </div>
                          </div>

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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ASPECTOS COLECTIVOS DEL EQUIPO (BOTTON SECTION) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-brand-black-card border border-brand-black-border p-5 rounded-2xl">
        <div className="md:col-span-2 border-b border-brand-black-border pb-2.5 mb-2">
          <h3 className="text-sm font-bold text-brand-gray-light flex items-center gap-1.5">
            <Zap className="w-4.5 h-4.5 text-brand-red-600 animate-pulse" /> Informe Técnico del Equipo (Colectivo)
          </h3>
          <p className="text-[10px] text-brand-gray-muted mt-0.5">Analiza el rendimiento global de la U.D. Atzeneta en este partido</p>
        </div>

        {/* Aspectos Positivos */}
        <div className="bg-emerald-950/10 border border-emerald-900/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
            <Check className="w-4 h-4 bg-emerald-950 rounded-full border border-emerald-900/40 p-0.5 shrink-0" />
            Aspectos Positivos del Equipo
          </div>
          <textarea
            className="form-input text-xs h-28 bg-brand-black-bg"
            placeholder="Ej: Buena presión coordinada tras pérdida, efectividad a balón parado, circulación fluida en bloque medio..."
            value={teamPositive}
            onChange={(e) => setTeamPositive(e.target.value)}
          />
        </div>

        {/* Aspectos a Mejorar */}
        <div className="bg-orange-950/10 border border-orange-900/30 p-4 rounded-xl space-y-2">
          <div className="flex items-center gap-1.5 text-orange-400 font-bold text-xs uppercase tracking-wider">
            <AlertCircle className="w-4 h-4 bg-orange-950 rounded-full border border-orange-900/40 p-0.5 shrink-0" />
            Aspectos a Mejorar del Equipo
          </div>
          <textarea
            className="form-input text-xs h-28 bg-brand-black-bg"
            placeholder="Ej: Desajustes defensivos en transición, poca vigilancia en saques de esquina rivales, lentitud en los cambios de juego..."
            value={teamImprove}
            onChange={(e) => setTeamImprove(e.target.value)}
          />
        </div>
      </div>
    </div>
  );
};
