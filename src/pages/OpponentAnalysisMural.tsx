import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { OpponentAnalysis, OpponentLibraryVideo, OpponentSubSection, OpponentFormation, OpponentPresentation } from '../types';
import {
  ArrowLeft, ShieldAlert, Award, FileText, Settings as TacticalIcon,
  Edit2, Save, X, Users, Film, Swords, Shield, Flag, Presentation, Plus, Trash2, Star, Trophy
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
import { isSameTeam, isSamePlayer, normalizePlayerName } from '../utils/teamUtils';
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

  const { data: analysisList = [], isLoading } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis(),
  });

  const analysis = analysisList.find(a => a.id === id);

  const { data: scoutingPlayers = [], isLoading: isScoutingLoading } = useQuery({
    queryKey: ['scouting_opponent', analysis?.opponent],
    queryFn: () => dataService.getScoutingByTeam(analysis?.opponent || ''),
    enabled: !!analysis?.opponent,
  });

  const getPlayerScore = (sp: typeof scoutingPlayers[0], seasonFilter: '2026-2027' | '2025-2026') => {
    const isTargetSeason = seasonFilter === '2026-2027'
      ? (sp.season === '2026-2027' || sp.season === '2026/2027')
      : (sp.season === '2025-2026' || sp.season === '2025/2026');

    const hasStats = (Number(sp.titular) || 0) + (Number(sp.jugados) || 0) + (Number(sp.convocados) || 0) + (Number(sp.goles) || 0) + (Number(sp.amarillas) || 0);

    if (isTargetSeason && hasStats > 0) return 10000 + hasStats;
    if (hasStats > 0) return 5000 + hasStats;
    if (isTargetSeason) return 100;
    return 0;
  };

  const allTeamScoutingPlayers = useMemo(() => {
    if (!analysis?.opponent) return [];
    return scoutingPlayers.filter(sp => isSameTeam(sp.team, analysis.opponent));
  }, [scoutingPlayers, analysis?.opponent]);

  const teamScoutingPlayers = useMemo(() => {
    const bestByPlayer = new Map<string, typeof scoutingPlayers[0]>();
    allTeamScoutingPlayers.forEach(sp => {
      const normKey = normalizePlayerName(sp.player_name) || `dorsal-${sp.dorsal}`;
      const existing = bestByPlayer.get(normKey);
      const spScore = getPlayerScore(sp, selectedSeason);

      if (!existing) {
        bestByPlayer.set(normKey, sp);
      } else {
        const existingScore = getPlayerScore(existing, selectedSeason);
        if (spScore > existingScore) {
          bestByPlayer.set(normKey, sp);
        }
      }
    });

    return Array.from(bestByPlayer.values());
  }, [allTeamScoutingPlayers, selectedSeason]);

  const displayRoster = useMemo(() => {
    const parseNum = (val: any) => {
      if (val === undefined || val === null || val === '') return 0;
      const n = Number(val);
      return isNaN(n) ? 0 : n;
    };

    if (analysis?.roster_comments && analysis.roster_comments.length > 0) {
      return analysis.roster_comments.map(p => {
        const candidates = allTeamScoutingPlayers.filter(sp => isSamePlayer(sp.player_name, p.name, sp.dorsal, p.number));

        // Preferir el registro scrapeado de la temporada seleccionada tal cual (aunque sea 0, p.ej. si esta
        // temporada solo se ha jugado 1 partido y el jugador no lo disputó). Solo si no hay ningún registro
        // scrapeado de esa temporada en concreto (equipo aún no sincronizado) se recurre al mejor disponible
        // de otra temporada; la línea de "otra temporada" ya muestra ese dato aparte, sin mezclarlo aquí.
        const isTargetSeasonRow = (sp: typeof candidates[0]) =>
          selectedSeason === '2026-2027'
            ? (sp.season === '2026-2027' || sp.season === '2026/2027')
            : (sp.season === '2025-2026' || sp.season === '2025/2026');
        const seasonSp = candidates.find(isTargetSeasonRow);

        let matches = 0;
        let starter = 0;
        let goals = 0;
        let yellow_cards = 0;
        let red_cards = 0;

        if (seasonSp) {
          matches = parseNum(seasonSp.jugados) || parseNum(seasonSp.convocados) || parseNum(seasonSp.matches_played);
          starter = parseNum(seasonSp.titular) || parseNum(seasonSp.starter_count) || matches;
          goals = parseNum(seasonSp.goles) || parseNum(seasonSp.goals);
          yellow_cards = parseNum(seasonSp.amarillas) || parseNum(seasonSp.yellow_cards);
          red_cards = parseNum(seasonSp.rojas) || parseNum(seasonSp.red_cards);
        } else {
          const pM = parseNum(p.matches_played);
          const pS = parseNum(p.starter_count);
          const pG = parseNum(p.goals);
          const pY = parseNum(p.yellow_cards);
          const pR = parseNum(p.red_cards);

          if (selectedSeason === '2026-2027' && pM <= 3) {
            matches = pM;
            starter = pS;
            goals = pG;
            yellow_cards = pY;
            red_cards = pR;
          } else if (selectedSeason === '2025-2026') {
            matches = pM;
            starter = pS;
            goals = pG;
            yellow_cards = pY;
            red_cards = pR;
          }
        }

        const matchingSp = seasonSp || candidates.find(sp => sp.photo_url || sp.position);

        return {
          ...p,
          matches_played: matches,
          starter_count: starter,
          minutes_played: parseNum(p.minutes_played) || parseNum(matchingSp?.minutes_played),
          goals,
          assists: parseNum(p.assists) || parseNum(matchingSp?.assists),
          yellow_cards,
          red_cards,
          photo_url: p.photo_url || matchingSp?.photo_url,
          position: p.position || matchingSp?.position || 'DF'
        };
      });
    }

    return teamScoutingPlayers.map(sp => {
      const matches = parseNum(sp.jugados) || parseNum(sp.convocados) || parseNum(sp.matches_played);
      const starter = parseNum(sp.titular) || parseNum(sp.starter_count) || matches;
      return {
        id: `sp-${sp.id}`,
        name: sp.player_name,
        number: sp.dorsal || undefined,
        position: sp.position || 'DF',
        comments: sp.notes || '',
        photo_url: sp.photo_url,
        matches_played: matches,
        starter_count: starter,
        minutes_played: parseNum(sp.minutes_played),
        goals: parseNum(sp.goles) || parseNum(sp.goals),
        assists: parseNum(sp.assists),
        yellow_cards: parseNum(sp.amarillas) || parseNum(sp.yellow_cards),
        red_cards: parseNum(sp.rojas) || parseNum(sp.red_cards),
        rating: sp.rating,
        is_featured: false
      };
    });
  }, [analysis?.roster_comments, teamScoutingPlayers]);

  // Rankings del equipo rival derivados del scraping
  const rivalRankings = useMemo(() => {
    const list = [...displayRoster];
    const topScorers = [...list].filter(p => (p.goals || 0) > 0).sort((a, b) => (b.goals || 0) - (a.goals || 0)).slice(0, 11);
    const topStarters = [...list].filter(p => (p.starter_count || 0) > 0).sort((a, b) => (b.starter_count || 0) - (a.starter_count || 0)).slice(0, 11);
    const topCards = [...list].filter(p => (p.yellow_cards || 0) > 0 || (p.red_cards || 0) > 0).sort((a, b) => (b.yellow_cards || 0) - (a.yellow_cards || 0)).slice(0, 11);
    return { topScorers, topStarters, topCards };
  }, [displayRoster]);

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
                      {analysis.strengths.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguna especificada</span> : analysis.strengths.map((s, i) => (
                        <span key={i} className="text-[11px] bg-red-950/20 text-brand-red-500 border border-brand-red-600/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>

                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3 shrink-0"><ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.weaknesses.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguna especificada</span> : analysis.weaknesses.map((s, i) => (
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

                {/* Widgets de Rankings Rival (Scraping) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  {/* Top Goleadores */}
                  <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        ⚽ Goleadores Rival ({selectedSeason === '2026-2027' ? '26/27' : '25/26'})
                      </span>
                      <span className="text-[10px] text-emerald-400 font-bold bg-emerald-950/60 px-1.5 py-0.5 rounded">Scraping</span>
                    </div>
                    {rivalRankings.topScorers.length === 0 ? (
                      <span className="text-xs text-brand-gray-dark italic">Sin goles registrados en esta temporada</span>
                    ) : (
                      <div className="space-y-1.5 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
                        {rivalRankings.topScorers.map((p, idx) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-brand-gray-light font-medium truncate flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-brand-gray-muted">{idx + 1}.</span> {p.name} {p.number ? `(#${p.number})` : ''}
                            </span>
                            <span className="font-bold text-emerald-400 shrink-0">{p.goals} ⚽</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Top Titulares / Habituales */}
                  <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        👕 Más Titulares ({selectedSeason === '2026-2027' ? '26/27' : '25/26'})
                      </span>
                      <span className="text-[10px] text-sky-400 font-bold bg-sky-950/60 px-1.5 py-0.5 rounded">Scraping</span>
                    </div>
                    {rivalRankings.topStarters.length === 0 ? (
                      <span className="text-xs text-brand-gray-dark italic">Sin titularidades en esta temporada</span>
                    ) : (
                      <div className="space-y-1.5 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
                        {rivalRankings.topStarters.map((p, idx) => (
                          <div key={p.id} className="flex items-center justify-between text-xs">
                            <span className="text-brand-gray-light font-medium truncate flex items-center gap-1.5">
                              <span className="text-[10px] font-bold text-brand-gray-muted">{idx + 1}.</span> {p.name}
                            </span>
                            <span className="font-bold text-sky-400 shrink-0">{p.starter_count} Tit ({p.matches_played} PJ)</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Disciplina / Tarjetas */}
                  <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-3.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between border-b border-brand-black-border pb-2">
                      <span className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                        🟨 Tarjetas & Sanciones ({selectedSeason === '2026-2027' ? '26/27' : '25/26'})
                      </span>
                      <span className="text-[10px] text-amber-400 font-bold bg-amber-950/60 px-1.5 py-0.5 rounded">Scraping</span>
                    </div>
                    {rivalRankings.topCards.length === 0 ? (
                      <span className="text-xs text-brand-gray-dark italic">Sin tarjetas en esta temporada</span>
                    ) : (
                      <div className="space-y-1.5 max-h-[360px] overflow-y-auto no-scrollbar pr-1">
                        {rivalRankings.topCards.map((p, idx) => {
                          const yellow = p.yellow_cards || 0;
                          const isSanction = yellow > 0 && yellow % 5 === 0;
                          return (
                            <div key={p.id} className="flex items-center justify-between text-xs">
                              <span className="text-brand-gray-light font-medium truncate flex items-center gap-1.5">
                                <span className="text-[10px] font-bold text-brand-gray-muted">{idx + 1}.</span> {p.name}
                              </span>
                              <div className="flex items-center gap-1 shrink-0">
                                {isSanction && <span className="text-[9px] font-black text-red-400 bg-red-950 px-1 rounded">Sanción</span>}
                                <span className="font-bold text-amber-400">{yellow} 🟨</span>
                                {p.red_cards ? <span className="font-bold text-red-500">{p.red_cards} 🟥</span> : null}
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
            ) : isScoutingLoading ? (
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

                  // Buscar datos de la OTRA temporada en scouting para mostrar badge comparativo
                  const otherSeasonTag = selectedSeason === '2026-2027' ? '2025-2026' : '2026-2027';
                  const otherSeasonSp = scoutingPlayers.find(sp =>
                    isSameTeam(sp.team, analysis.opponent) &&
                    isSamePlayer(sp.player_name, player.name, sp.dorsal, player.number) &&
                    (sp.season === otherSeasonTag || (otherSeasonTag === '2025-2026' ? sp.season === '2025/2026' : sp.season === '2026/2027'))
                  );

                  const otherPJ = otherSeasonSp ? (Number(otherSeasonSp.jugados) || Number(otherSeasonSp.convocados) || Number(otherSeasonSp.matches_played) || 0) : 0;
                  const otherTit = otherSeasonSp ? (Number(otherSeasonSp.titular) || Number(otherSeasonSp.starter_count) || otherPJ) : 0;
                  const otherGoles = otherSeasonSp ? (Number(otherSeasonSp.goles) || Number(otherSeasonSp.goals) || 0) : 0;
                  const otherAmarillas = otherSeasonSp ? (Number(otherSeasonSp.amarillas) || Number(otherSeasonSp.yellow_cards) || 0) : 0;

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
                            <h5 className="text-sm font-bold text-white truncate">{player.name}</h5>
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

                      {/* Barra de Estadísticas del Scraping / Manuales para la Temporada Seleccionada */}
                      {(player.matches_played !== undefined || player.starter_count !== undefined || player.goals !== undefined || player.yellow_cards !== undefined) && (
                        <div className="space-y-1.5">
                          <div className="grid grid-cols-4 gap-1.5 bg-black/50 p-2 rounded-lg text-center border border-brand-black-border/60 text-[11px]">
                            <div>
                              <span className="text-[9px] text-brand-gray-muted block uppercase">Partidos</span>
                              <span className="font-bold text-white">{player.matches_played ?? '-'} PJ</span>
                            </div>
                            <div>
                              <span className="text-[9px] text-brand-gray-muted block uppercase">Titular</span>
                              <span className="font-bold text-sky-400">{player.starter_count !== undefined ? `${player.starter_count} Tit` : '-'}</span>
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

                          {/* Resumen de la Otra Temporada (Ej: Pasada 25/26 si la actual es 26/27) */}
                          {otherPJ > 0 && (
                            <div className="px-2.5 py-1 bg-amber-950/20 border border-amber-500/20 rounded-md text-[10px] flex items-center justify-between text-amber-300 font-medium">
                              <span className="flex items-center gap-1 font-bold text-amber-400">
                                📜 Temp {otherSeasonTag === '2025-2026' ? '25/26 (Pasada)' : '26/27 (Actual)'}:
                              </span>
                              <span>{otherPJ} PJ ({otherTit} Tit) • {otherGoles} ⚽ • {otherAmarillas} 🟨</span>
                            </div>
                          )}
                        </div>
                      )}

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
