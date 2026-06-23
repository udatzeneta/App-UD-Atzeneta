import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { useToast } from '../context/ToastContext';
import { usePermissions } from '../hooks/usePermissions';
import { CardSkeleton } from '../components/Skeletons';
import { exportMatchReportToPDF } from '../utils/export';
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
  event_minutes: {
    goals: number[];
    assists: number[];
    yellow_cards: number[];
    red_card: number | null;
    conceded_goals: number[];
    own_goals: number[];
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
  const [matchStatus, setMatchStatus] = useState<'Programado' | 'Jugado' | 'Suspendido'>('Jugado');
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
  const [timelineEventType, setTimelineEventType] = useState<'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals'>('goals');
  const [timelineMinute, setTimelineMinute] = useState<number>(1);

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

  // Inicializar estado del formulario con los datos de BD
  useEffect(() => {
    if (matchData) {
      setScoreUs(matchData.score_us !== null ? matchData.score_us : 0);
      setScoreThem(matchData.score_them !== null ? matchData.score_them : 0);
      setMatchStatus(matchData.status);
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
          event_minutes: {
            goals: init?.event_minutes?.goals || [],
            assists: init?.event_minutes?.assists || [],
            yellow_cards: init?.event_minutes?.yellow_cards || [],
            red_card: init?.event_minutes?.red_card || null,
            conceded_goals: init?.event_minutes?.conceded_goals || [],
            own_goals: init?.event_minutes?.own_goals || []
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
          while (arr.length < count) arr.push(90); // default minute
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, goals: arr };
      } else if (field === 'conceded_goals') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.conceded_goals || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push(90);
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, conceded_goals: arr };
      } else if (field === 'own_goals') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.own_goals || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push(90);
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, own_goals: arr };
      } else if (field === 'assists') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.assists || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push(90);
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, assists: arr };
      } else if (field === 'yellow_cards') {
        const count = Math.max(0, parseInt(val) || 0);
        let arr = [...(player.event_minutes.yellow_cards || [])];
        if (arr.length < count) {
          while (arr.length < count) arr.push(90);
        } else {
          arr = arr.slice(0, count);
        }
        updated.event_minutes = { ...updated.event_minutes, yellow_cards: arr };
      } else if (field === 'red_card') {
        const hasRed = !!val;
        updated.event_minutes = {
          ...updated.event_minutes,
          red_card: hasRed ? (player.event_minutes.red_card || 90) : null
        };
      }

      next[playerId] = updated;
      return next;
    });
  };

  // Manejar cambios en los minutos específicos de un evento
  const handleEventMinuteChange = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals', index: number, value: number) => {
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
  const handleAddMatchEvent = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals', minute: number) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      const eventMin = { ...player.event_minutes };

      if (type === 'red_card') {
        eventMin.red_card = minute;
        next[playerId] = {
          ...player,
          red_card: true,
          event_minutes: eventMin
        };
      } else {
        const arr = [...(eventMin[type] || []), minute];
        arr.sort((a, b) => a - b);
        eventMin[type] = arr;
        
        next[playerId] = {
          ...player,
          [type]: arr.length,
          event_minutes: eventMin
        };
      }

      return next;
    });
  };

  // Quitar un evento específico desde la cronología
  const handleRemoveMatchEvent = (playerId: string, type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals', minute: number, indexInType?: number) => {
    setPlayerStats(prev => {
      const next = { ...prev };
      const player = next[playerId];
      if (!player) return prev;

      const eventMin = { ...player.event_minutes };

      if (type === 'red_card') {
        eventMin.red_card = null;
        next[playerId] = {
          ...player,
          red_card: false,
          event_minutes: eventMin
        };
      } else {
        const arr = [...(eventMin[type] || [])];
        const targetIdx = indexInType !== undefined ? indexInType : arr.indexOf(minute);
        if (targetIdx !== -1) {
          arr.splice(targetIdx, 1);
        }
        eventMin[type] = arr;

        next[playerId] = {
          ...player,
          [type]: arr.length,
          event_minutes: eventMin
        };
      }

      return next;
    });
  };

  // Consolidar todos los eventos de forma ordenada para la línea de tiempo
  const matchEvents = useMemo(() => {
    const eventsList: {
      id: string;
      playerId: string;
      playerName: string;
      type: 'goals' | 'assists' | 'yellow_cards' | 'red_card' | 'conceded_goals' | 'own_goals';
      minute: number;
      indexInType: number;
    }[] = [];

    Object.values(playerStats).forEach(stat => {
      const playerObj = dbPlayers.find(p => p.id === stat.player_id);
      const playerName = playerObj ? (playerObj.nickname || playerObj.full_name) : 'Jugador';

      stat.event_minutes.goals?.forEach((min, idx) => {
        eventsList.push({
          id: `${stat.player_id}-goals-${idx}-${min}`,
          playerId: stat.player_id,
          playerName,
          type: 'goals',
          minute: min,
          indexInType: idx
        });
      });

      stat.event_minutes.conceded_goals?.forEach((min, idx) => {
        eventsList.push({
          id: `${stat.player_id}-conceded_goals-${idx}-${min}`,
          playerId: stat.player_id,
          playerName,
          type: 'conceded_goals',
          minute: min,
          indexInType: idx
        });
      });

      stat.event_minutes.own_goals?.forEach((min, idx) => {
        eventsList.push({
          id: `${stat.player_id}-own_goals-${idx}-${min}`,
          playerId: stat.player_id,
          playerName,
          type: 'own_goals',
          minute: min,
          indexInType: idx
        });
      });

      stat.event_minutes.assists?.forEach((min, idx) => {
        eventsList.push({
          id: `${stat.player_id}-assists-${idx}-${min}`,
          playerId: stat.player_id,
          playerName,
          type: 'assists',
          minute: min,
          indexInType: idx
        });
      });

      stat.event_minutes.yellow_cards?.forEach((min, idx) => {
        eventsList.push({
          id: `${stat.player_id}-yellow_cards-${idx}-${min}`,
          playerId: stat.player_id,
          playerName,
          type: 'yellow_cards',
          minute: min,
          indexInType: idx
        });
      });

      if (stat.red_card && stat.event_minutes.red_card !== null && stat.event_minutes.red_card !== undefined) {
        eventsList.push({
          id: `${stat.player_id}-red_card-${stat.event_minutes.red_card}`,
          playerId: stat.player_id,
          playerName,
          type: 'red_card',
          minute: stat.event_minutes.red_card,
          indexInType: 0
        });
      }
    });

    return eventsList.sort((a, b) => a.minute - b.minute);
  }, [playerStats, dbPlayers]);

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

      {/* Marcador e Información de Estado */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 bg-brand-black-card/45 border border-brand-black-border p-5 rounded-2xl">
        <div className="lg:col-span-4 space-y-3.5 text-left">
          <span className="text-[10px] font-bold text-brand-red-600 uppercase tracking-wider block">Configuración de Encuentro</span>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-bold text-brand-gray-muted uppercase block mb-1">Estado</label>
              <select
                value={matchStatus}
                onChange={(e) => setMatchStatus(e.target.value as any)}
                className="form-input bg-brand-black-bg text-xs py-1.5"
              >
                <option value="Programado">Programado</option>
                <option value="Jugado">Jugado</option>
                <option value="Suspendido">Suspendido</option>
              </select>
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
        <div className="lg:col-span-8 flex items-center justify-center gap-6 py-2 border-t lg:border-t-0 lg:border-l border-brand-black-border lg:pl-6">
          <div className="text-center">
            <h4 className="text-xs font-bold text-brand-gray-muted mb-1.5">UD ATZENETA</h4>
            <div className="w-14 h-14 bg-white/5 rounded-xl border border-brand-black-border flex items-center justify-center">
              <img 
                src="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png" 
                alt="UD Atzeneta" 
                className="w-10 h-10 object-contain"
              />
            </div>
          </div>

          <div className="flex items-center gap-3.5">
            {matchStatus === 'Jugado' ? (
              <>
                <input
                  type="number"
                  min="0"
                  value={scoreUs}
                  onChange={(e) => setScoreUs(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-16 h-16 bg-brand-black border-2 border-brand-black-border text-center text-3xl font-black rounded-2xl text-brand-gray-light focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 transition-all"
                />
                <span className="text-2xl font-black text-brand-gray-dark">-</span>
                <input
                  type="number"
                  min="0"
                  value={scoreThem}
                  onChange={(e) => setScoreThem(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-16 h-16 bg-brand-black border-2 border-brand-black-border text-center text-3xl font-black rounded-2xl text-brand-gray-light focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 transition-all"
                />
              </>
            ) : (
              <span className="text-sm font-semibold text-brand-gray-muted italic bg-brand-black px-4 py-2 rounded-xl border border-brand-black-border">
                {matchStatus === 'Programado' ? 'Pendiente de Jugar' : 'Partido Suspendido'}
              </span>
            )}
          </div>

          <div className="text-center">
            <h4 className="text-xs font-bold text-brand-gray-muted mb-1.5 truncate max-w-[120px]">{matchData.rival.toUpperCase()}</h4>
            <div className="w-14 h-14 bg-white/5 rounded-xl border border-brand-black-border flex items-center justify-center">
              <span className="text-lg font-bold text-brand-red-600">{matchData.rival.substring(0, 3).toUpperCase()}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Grid Principal: Campograma vs Tabla de Jugadores */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
        {/* LADO IZQUIERDO: Campograma */}
        <div className="xl:col-span-5 space-y-4">
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
                const placedPlayerId = lineup[idx];
                const playerObj = dbPlayers.find(p => p.id === placedPlayerId);

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
                    {playerObj ? (
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
                        
                        <button
                          type="button"
                          onClick={() => setActiveSlotForSelection(activeSlotForSelection === idx ? null : idx)}
                          className="w-11 h-11 rounded-full bg-brand-black-card border-2 border-yellow-500 shadow-premium flex items-center justify-center overflow-hidden hover:scale-105 active:scale-95 transition-all"
                        >
                          {playerObj.photo_url ? (
                            <img src={playerObj.photo_url} alt={playerObj.full_name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-xs font-black text-brand-gray-light">{playerObj.dorsal || '?'}</span>
                          )}
                        </button>
                        
                        <span className="mt-1 bg-brand-black-card/90 text-brand-gray-light text-[9px] font-bold px-1 py-0.5 rounded shadow border border-brand-black-border max-w-[65px] truncate text-center leading-none">
                          {playerObj.nickname || playerObj.full_name.split(' ')[0]}
                        </span>
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
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 items-end text-left">
                <div>
                  <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Futbolista</label>
                  <select
                    value={timelinePlayerId}
                    onChange={(e) => {
                      const pId = e.target.value;
                      setTimelinePlayerId(pId);
                      // Si el jugador seleccionado no es portero, cambiar tipo de evento si estaba seleccionado gol encajado
                      const playerObj = dbPlayers.find(p => p.id === pId);
                      const stats = playerStats[pId];
                      const isGK = playerObj?.position === 'Portero' || stats?.position === 'GK';
                      if (!isGK && timelineEventType === 'conceded_goals') {
                        setTimelineEventType('goals');
                      }
                    }}
                    className="form-input bg-brand-black-bg text-xs py-1 px-2.5 w-full"
                  >
                    <option value="">-- Seleccionar --</option>
                    {calledUpPlayers.map(p => {
                      const stats = playerStats[p.id];
                      const isGK = p.position === 'Portero' || stats?.position === 'GK';
                      return (
                        <option key={p.id} value={p.id}>
                          {p.dorsal ? `(${p.dorsal}) ` : ''}{p.nickname || p.full_name} {isGK ? ' (POR)' : ''}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Evento</label>
                  <select
                    value={timelineEventType}
                    onChange={(e) => setTimelineEventType(e.target.value as any)}
                    className="form-input bg-brand-black-bg text-xs py-1 px-2.5 w-full"
                  >
                    <option value="goals">⚽ Gol</option>
                    <option value="assists">🥾 Asistencia</option>
                    {(() => {
                      const playerObj = dbPlayers.find(p => p.id === timelinePlayerId);
                      const stats = playerStats[timelinePlayerId];
                      const isGK = playerObj?.position === 'Portero' || stats?.position === 'GK';
                      if (isGK) {
                        return <option value="conceded_goals">🥅 Gol Encajado</option>;
                      }
                      return null;
                    })()}
                    <option value="own_goals">💥 Gol en Propia</option>
                    <option value="yellow_cards">🟨 Tarjeta Amarilla</option>
                    <option value="red_card">🟥 Tarjeta Roja</option>
                  </select>
                </div>

                <div className="flex gap-2">
                  <div className="w-16 shrink-0">
                    <label className="text-[9px] font-bold text-brand-gray-muted uppercase block mb-1">Minuto</label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={timelineMinute}
                      onChange={(e) => setTimelineMinute(Math.max(1, Math.min(120, parseInt(e.target.value) || 1)))}
                      className="form-input bg-brand-black-bg text-xs py-1 px-2 text-center w-full"
                    />
                  </div>
                  
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

                      handleAddMatchEvent(timelinePlayerId, timelineEventType, timelineMinute);
                      showToast('success', 'Incidencia añadida', 'El evento ha sido registrado en la cronología.');
                    }}
                    className="btn-primary py-1.5 px-3 text-xs font-bold w-full flex justify-center items-center"
                  >
                    Añadir
                  </button>
                </div>
              </div>
            </div>

            {/* Listado de eventos cronológico */}
            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1 no-scrollbar border border-brand-black-border p-2.5 rounded-xl bg-brand-black/10">
              {matchEvents.length === 0 ? (
                <div className="text-center py-6 text-brand-gray-muted text-xs italic">
                  Sin incidencias registradas.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {matchEvents.map(evt => {
                    let icon = '⚽';
                    let typeText = 'Gol';
                    let colorClass = 'text-brand-gray-light';
                    
                    if (evt.type === 'assists') {
                      icon = '🥾';
                      typeText = 'Asistencia';
                      colorClass = 'text-emerald-400';
                    } else if (evt.type === 'yellow_cards') {
                      icon = '🟨';
                      typeText = 'T. Amarilla';
                      colorClass = 'text-yellow-400';
                    } else if (evt.type === 'red_card') {
                      icon = '🟥';
                      typeText = 'T. Roja';
                      colorClass = 'text-red-500';
                    } else if (evt.type === 'conceded_goals') {
                      icon = '🥅';
                      typeText = 'Gol Encajado';
                      colorClass = 'text-cyan-400';
                    } else if (evt.type === 'own_goals') {
                      icon = '💥';
                      typeText = 'Gol en Propia';
                      colorClass = 'text-orange-400';
                    }

                    return (
                      <div
                        key={evt.id}
                        className="flex items-center justify-between p-2 bg-brand-black-card hover:bg-brand-black-hover rounded-lg border border-brand-black-border transition-colors text-xs"
                      >
                        <div className="flex items-center gap-2 text-left">
                          <span className="font-bold text-[10px] text-brand-red-600 bg-brand-red-600/10 px-1.5 py-0.5 rounded min-w-[32px] text-center">
                            {evt.minute}'
                          </span>
                          <span className="text-sm leading-none shrink-0">{icon}</span>
                          <div>
                            <span className="font-semibold text-brand-gray-light block leading-tight">
                              {evt.playerName}
                            </span>
                            <span className={`text-[9px] font-medium block uppercase ${colorClass}`}>
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
                          className="p-1 hover:text-brand-red-600 text-brand-gray-muted rounded transition-colors"
                          title="Eliminar incidencia"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
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
            <div className="space-y-4 max-h-[500px] overflow-y-auto pr-1 no-scrollbar border border-brand-black-border p-2.5 rounded-xl bg-brand-black/10">
              {calledUpPlayers.length === 0 ? (
                <div className="text-center py-12 text-brand-gray-muted text-xs italic">
                  No hay jugadores en la convocatoria. Haz clic en "Convocar Jugador" para agregarlos al acta.
                </div>
              ) : (
                ['Titulares (XI Inicial)', 'Suplentes (Banquillo)'].map(group => {
                  const isStarterGroup = group.startsWith('Titulares');
                  const list = calledUpPlayers.filter(p => {
                    const stats = playerStats[p.id];
                    return stats && stats.is_starter === isStarterGroup;
                  });

                  if (list.length === 0) return null;

                  return (
                    <div key={group} className="space-y-2">
                      <div className="text-[10px] font-bold text-brand-red-600 uppercase tracking-wider px-1">
                        {group} ({list.length})
                      </div>
                      
                      <div className="space-y-2">
                        {list.map(player => {
                          const stats = playerStats[player.id];
                          const isGK = player.position === 'Portero' || stats.position === 'GK';
                          const hasEvents = stats.goals > 0 || (stats.conceded_goals || 0) > 0 || (stats.own_goals || 0) > 0 || stats.assists > 0 || stats.yellow_cards > 0 || stats.red_card;
                          const isExpanded = expandedPlayerId === player.id;

                          return (
                            <div 
                              key={player.id}
                              className={`p-3 rounded-xl border transition-all ${
                                isExpanded 
                                  ? 'bg-brand-black/50 border-brand-red-600/35' 
                                  : 'bg-brand-black-card border-brand-black-border hover:border-brand-black-border/80'
                              }`}
                            >
                              {/* Row principal */}
                              <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 text-left">
                                <div className="flex items-center gap-3">
                                  {/* Avatar */}
                                  <div className="w-8 h-8 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                                    {player.photo_url ? (
                                      <img src={player.photo_url} alt={player.full_name} className="w-full h-full object-cover" />
                                    ) : (
                                      <span className="text-xs font-black text-brand-gray-dark">{player.dorsal || '?'}</span>
                                    )}
                                  </div>
                                  <div>
                                    <div className="flex items-center gap-2">
                                      {player.dorsal && (
                                        <span className="text-[9px] font-black text-brand-red-600 bg-brand-red-600/10 px-1 rounded">
                                          {player.dorsal}
                                        </span>
                                      )}
                                      <span className="text-xs font-bold text-brand-gray-light">
                                        {player.nickname || player.full_name}
                                      </span>
                                    </div>
                                    <div className="text-[9px] text-brand-gray-muted mt-0.5 flex items-center gap-1.5">
                                      {stats.is_starter ? (
                                        <span className="text-yellow-500 font-semibold">Titular ({stats.position})</span>
                                      ) : (
                                        <span className="text-brand-gray-muted font-medium">Suplente</span>
                                      )}
                                      {hasEvents && (
                                        <span className="flex items-center gap-1 bg-brand-black-border/60 px-1 rounded text-brand-gray-light leading-none">
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

                                {/* Inputs rápidos */}
                                <div className="grid grid-cols-6 gap-2 sm:gap-3 items-center shrink-0">
                                  {/* Minutos */}
                                  <div className="text-center">
                                    <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5">Minutos</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="120"
                                      className="form-input text-xs py-0.5 px-1.5 text-center w-12 bg-brand-black-bg"
                                      value={stats.minutes_played}
                                      onChange={(e) => handleStatChange(player.id, 'minutes_played', Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                  </div>
                                  
                                  {/* Goles */}
                                  <div className="text-center">
                                    <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5">Goles</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      className="form-input text-xs py-0.5 px-1.5 text-center w-10 bg-brand-black-bg"
                                      value={stats.goals}
                                      onChange={(e) => handleStatChange(player.id, 'goals', Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                  </div>

                                  {/* Asist / G. Enc */}
                                  {isGK ? (
                                    <div className="text-center">
                                      <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5" title="Goles Encajados">G. Enc</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="50"
                                        className="form-input text-xs py-0.5 px-1.5 text-center w-10 bg-brand-black-bg"
                                        value={stats.conceded_goals || 0}
                                        onChange={(e) => handleStatChange(player.id, 'conceded_goals', Math.max(0, parseInt(e.target.value) || 0))}
                                      />
                                    </div>
                                  ) : (
                                    <div className="text-center">
                                      <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5">Asist</span>
                                      <input
                                        type="number"
                                        min="0"
                                        max="10"
                                        className="form-input text-xs py-0.5 px-1.5 text-center w-10 bg-brand-black-bg"
                                        value={stats.assists}
                                        onChange={(e) => handleStatChange(player.id, 'assists', Math.max(0, parseInt(e.target.value) || 0))}
                                      />
                                    </div>
                                  )}

                                  {/* Gol en propia (P.P.) */}
                                  <div className="text-center">
                                    <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5" title="Goles en propia puerta">P.P.</span>
                                    <input
                                      type="number"
                                      min="0"
                                      max="10"
                                      className="form-input text-xs py-0.5 px-1.5 text-center w-10 bg-brand-black-bg"
                                      value={stats.own_goals || 0}
                                      onChange={(e) => handleStatChange(player.id, 'own_goals', Math.max(0, parseInt(e.target.value) || 0))}
                                    />
                                  </div>

                                  {/* Amarillas */}
                                  <div className="text-center">
                                    <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5">Amar.</span>
                                    <select
                                      className="form-input text-xs py-0.5 px-1 w-11 bg-brand-black-bg"
                                      value={stats.yellow_cards}
                                      onChange={(e) => handleStatChange(player.id, 'yellow_cards', parseInt(e.target.value) || 0)}
                                    >
                                      <option value={0}>0</option>
                                      <option value={1}>1</option>
                                      <option value={2}>2</option>
                                    </select>
                                  </div>

                                  {/* Roja */}
                                  <div className="text-center flex flex-col items-center">
                                    <span className="text-[8px] font-bold text-brand-gray-muted uppercase block mb-0.5">Roja</span>
                                    <button
                                      type="button"
                                      onClick={() => handleStatChange(player.id, 'red_card', !stats.red_card)}
                                      className={`text-[9px] font-bold w-9 py-0.5 rounded border transition-all ${
                                        stats.red_card
                                          ? 'bg-red-950/40 text-red-500 border-red-800'
                                          : 'bg-brand-black-bg text-brand-gray-muted border-brand-black-border hover:border-brand-gray-dark'
                                      }`}
                                    >
                                      {stats.red_card ? 'Sí' : 'No'}
                                    </button>
                                  </div>
                                </div>

                                {/* Botones de fila */}
                                <div className="flex items-center gap-1.5 justify-end">
                                  <button
                                    type="button"
                                    onClick={() => setExpandedPlayerId(isExpanded ? null : player.id)}
                                    className="p-1 text-brand-gray-muted hover:text-brand-gray-light bg-brand-black-bg rounded border border-brand-black-border transition-all"
                                    title={isExpanded ? 'Colapsar detalles' : 'Editar detalles del evento'}
                                  >
                                    {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                  </button>

                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (window.confirm(`¿Deseas desconvocar a ${player.nickname || player.full_name}?`)) {
                                        handleToggleCallUp(player.id);
                                      }
                                    }}
                                    className="p-1 text-brand-gray-muted hover:text-brand-red-600 bg-brand-black-bg rounded border border-brand-black-border transition-all"
                                    title="Desconvocar"
                                  >
                                    <X className="w-3.5 h-3.5" />
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
                                            <span className="text-[10px] text-brand-gray-muted truncate">⚽ Gol {gIdx + 1} (Min):</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="120"
                                              className="form-input text-xs w-16 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'goals', gIdx, Math.max(0, parseInt(e.target.value) || 0))}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Goles Encajados */}
                                        {isGK && stats.event_minutes.conceded_goals?.map((min, cIdx) => (
                                          <div key={`c-${cIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-cyan-400 font-semibold truncate">🥅 Encajado {cIdx + 1} (Min):</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="120"
                                              className="form-input text-xs w-16 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'conceded_goals', cIdx, Math.max(0, parseInt(e.target.value) || 0))}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Goles en Propia */}
                                        {stats.event_minutes.own_goals?.map((min, oIdx) => (
                                          <div key={`o-${oIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-orange-400 font-semibold truncate">💥 Propia {oIdx + 1} (Min):</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="120"
                                              className="form-input text-xs w-16 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'own_goals', oIdx, Math.max(0, parseInt(e.target.value) || 0))}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Asistencias */}
                                        {stats.event_minutes.assists?.map((min, aIdx) => (
                                          <div key={`a-${aIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-brand-gray-muted truncate">🥾 Asist {aIdx + 1} (Min):</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="120"
                                              className="form-input text-xs w-16 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'assists', aIdx, Math.max(0, parseInt(e.target.value) || 0))}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Amarillas */}
                                        {stats.event_minutes.yellow_cards?.map((min, yIdx) => (
                                          <div key={`y-${yIdx}`} className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-yellow-500 font-semibold truncate">🟨 Tarjeta {yIdx + 1} (Min):</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="120"
                                              className="form-input text-xs w-16 py-1 px-1.5 text-center bg-brand-black"
                                              value={min || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'yellow_cards', yIdx, Math.max(0, parseInt(e.target.value) || 0))}
                                            />
                                          </div>
                                        ))}

                                        {/* Minutos Roja */}
                                        {stats.red_card && (
                                          <div className="flex items-center gap-1.5">
                                            <span className="text-[10px] text-red-500 font-semibold truncate">🟥 Tarjeta Roja (Min):</span>
                                            <input
                                              type="number"
                                              min="1"
                                              max="120"
                                              className="form-input text-xs w-16 py-1 px-1.5 text-center bg-brand-black"
                                              value={stats.event_minutes.red_card || ''}
                                              onChange={(e) => handleEventMinuteChange(player.id, 'red_card', 0, Math.max(0, parseInt(e.target.value) || 0))}
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
