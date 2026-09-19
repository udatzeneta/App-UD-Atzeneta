import React, { useMemo, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  OpponentAnalysis, OpponentPresentation, PresentationSlide, PresentationBlock,
  OpponentLibraryVideo, OpponentRosterPlayer,
} from '../../types';
import {
  Plus, Play, Trash2, Edit2, ChevronUp, ChevronDown, ArrowLeft, LayoutGrid,
  Presentation as PresentationIcon, PanelsTopLeft, Film, Users, ShieldAlert,
  Award, FileText, Settings as TacticalIcon, Layers, Wand2, BarChart2, Trophy, Activity,
} from 'lucide-react';
import { PresentationPlayer, BLOCK_LABELS } from './PresentationPlayer';
import { PresentationShareButton } from './PresentationShareButton';
import { OPPONENT_TAXONOMY, ABP_SIDES, catKey } from '../../constants/opponentTaxonomy';
import { allLibraryClips } from '../../utils/opponentVideo';
import { dataService } from '../../services/data';
import { isSameTeam } from '../../utils/teamUtils';

interface Props {
  analysis: OpponentAnalysis;
  presentations: OpponentPresentation[];
  libraryVideos: OpponentLibraryVideo[];
  canEdit: boolean;
  onChange: (presentations: OpponentPresentation[]) => void;
}

const BLOCK_ORDER: PresentationBlock[] = ['generales', 'jugadores', 'con_balon', 'sin_balon', 'abp'];

// Ítem del catálogo de contenido disponible: al pulsar "+" crea una diapositiva.
interface CatalogItem {
  key: string;
  block: PresentationBlock;
  label: string;
  make: () => PresentationSlide;
}

const uid = () => `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const bullets = (arr: string[]) => arr.map(s => `•  ${s}`).join('\n');

export const OpponentPresentationBuilder: React.FC<Props> = ({ analysis, presentations, libraryVideos, canEdit, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);

  const editing = presentations.find(p => p.id === editingId) || null;
  const playing = presentations.find(p => p.id === playingId) || null;

  const { data: scoutingPlayers = [] } = useQuery({
    queryKey: ['scouting_opponent', analysis?.opponent],
    queryFn: () => analysis?.opponent ? dataService.getScoutingByTeam(analysis.opponent) : dataService.getScouting()
  });

  const teamScoutingPlayers = useMemo(() => {
    if (!analysis?.opponent) return [];
    const sameTeam = scoutingPlayers.filter(sp => isSameTeam(sp.team, analysis.opponent));
    const current2627 = sameTeam.filter(sp => sp.season === '2026-2027' || sp.season === '2026/2027');
    return current2627.length > 0 ? current2627 : sameTeam;
  }, [scoutingPlayers, analysis?.opponent]);

  const effectiveRoster = useMemo<OpponentRosterPlayer[]>(() => {
    if (analysis?.roster_comments && analysis.roster_comments.length > 0) {
      return analysis.roster_comments.map(p => {
        const matchingSp = teamScoutingPlayers.find(sp => sp.player_name.toLowerCase() === p.name.toLowerCase() || (sp.dorsal && sp.dorsal === p.number));
        if (!matchingSp) return p;
        return {
          ...p,
          matches_played: matchingSp.jugados ?? matchingSp.convocados ?? matchingSp.matches_played ?? p.matches_played ?? 0,
          starter_count: matchingSp.titular ?? matchingSp.starter_count ?? (matchingSp.jugados ?? matchingSp.convocados ?? matchingSp.matches_played ?? p.starter_count ?? 0),
          minutes_played: matchingSp.minutes_played ?? p.minutes_played ?? 0,
          goals: matchingSp.goles ?? matchingSp.goals ?? p.goals ?? 0,
          assists: matchingSp.assists ?? p.assists ?? 0,
          yellow_cards: matchingSp.amarillas ?? matchingSp.yellow_cards ?? p.yellow_cards ?? 0,
          red_cards: matchingSp.rojas ?? matchingSp.red_cards ?? p.red_cards ?? 0,
          photo_url: p.photo_url || matchingSp.photo_url,
          position: p.position || matchingSp.position || 'DF'
        };
      });
    }
    return teamScoutingPlayers.map(sp => ({
      id: `sp-${sp.id}`,
      name: sp.player_name,
      number: sp.dorsal || undefined,
      position: sp.position || 'DF',
      comments: sp.notes || '',
      photo_url: sp.photo_url,
      matches_played: sp.jugados ?? sp.convocados ?? sp.matches_played ?? 0,
      starter_count: sp.titular ?? sp.starter_count ?? (sp.jugados ?? sp.convocados ?? sp.matches_played ?? 0),
      minutes_played: sp.minutes_played ?? 0,
      goals: sp.goles ?? sp.goals ?? 0,
      assists: sp.assists ?? 0,
      yellow_cards: sp.amarillas ?? sp.yellow_cards ?? 0,
      red_cards: sp.rojas ?? sp.red_cards ?? 0,
      rating: sp.rating,
      is_featured: false
    }));
  }, [analysis?.roster_comments, teamScoutingPlayers]);

  // ----- Catálogo de contenido disponible (derivado del análisis) -----
  const catalog = useMemo<Record<PresentationBlock, CatalogItem[]>>(() => {
    const cat: Record<PresentationBlock, CatalogItem[]> = {
      generales: [], jugadores: [], con_balon: [], sin_balon: [], abp: [],
    };

    // Opción para insertar portada personalizada manual en cualquier bloque
    BLOCK_ORDER.forEach(b => {
      cat[b].push({
        key: `cover-${b}-manual`,
        block: b,
        label: `📌 Portada de Bloque: ${BLOCK_LABELS[b]}`,
        make: () => ({
          id: uid(),
          sourceKey: `cover-${b}-manual`,
          type: 'cover',
          block: b,
          title: BLOCK_LABELS[b],
          subtitle: `Análisis ${analysis.opponent}`,
        })
      });
    });

    // Generales (Todo en uno & Estadísticas FFCV)
    const hasMainFormation = analysis.general_formation && (analysis.general_formation.players?.length || 0) > 0;
    const hasAlts = (analysis.alternative_formations || []).length > 0;
    const hasRoster = (analysis.roster_comments || []).length > 0;
    const hasTexts = (analysis.strengths || []).length > 0 ||
                     (analysis.weaknesses || []).length > 0 ||
                     analysis.observations?.trim();

    if (hasMainFormation || hasAlts || hasTexts || hasRoster) {
      cat.generales.push({
        key: 'gen-summary',
        block: 'generales',
        label: 'Aspectos Generales (Sistema, Fortalezas, Jugadores, etc.)',
        make: () => ({
          id: uid(),
          sourceKey: 'gen-summary',
          type: 'general_summary',
          block: 'generales',
          title: 'Aspectos Generales',
          summaryData: {
            mainFormation: analysis.general_formation,
            alternativeFormations: analysis.alternative_formations,
            strengths: analysis.strengths,
            weaknesses: analysis.weaknesses,
            rosterComments: analysis.roster_comments,
            observations: analysis.observations,
          }
        })
      });
    }

    // Opciones de Estadísticas FFCV de Liga
    cat.generales.push({
      key: 'ffcv-stats',
      block: 'generales',
      label: '📊 Estadísticas FFCV de Liga (Partidos, V/E/D, Rendimiento)',
      make: () => ({
        id: uid(),
        sourceKey: 'ffcv-stats',
        type: 'ffcv_stats',
        block: 'generales',
        title: `Estadísticas FFCV en Liga — ${analysis.opponent}`,
      })
    });

    cat.generales.push({
      key: 'ffcv-highlights',
      block: 'generales',
      label: '🏆 Métricas Destacadas FFCV (Puntos Fuertes y Vulnerabilidades)',
      make: () => ({
        id: uid(),
        sourceKey: 'ffcv-highlights',
        type: 'ffcv_highlights',
        block: 'generales',
        title: 'Puntos Fuertes y Débiles en Liga (FFCV)',
      })
    });

    cat.generales.push({
      key: 'ffcv-intervals',
      block: 'generales',
      label: '⏱️ Distribución de Goles por Minuto (FFCV)',
      make: () => ({
        id: uid(),
        sourceKey: 'ffcv-intervals',
        type: 'ffcv_intervals',
        block: 'generales',
        title: 'Distribución de Goles por Intervalo de Minuto',
      })
    });

    // Jugadores / Plantilla (Bloque Jugadores)
    if (effectiveRoster.length > 0) {
      // 1. Slide con Rankings de Jugadores (Top Goleadores, Más Titulares, Tarjetas)
      cat.jugadores.push({
        key: 'roster-rankings',
        block: 'jugadores',
        label: '⚽ Rankings de Jugadores Rival (Goleadores, Titulares y Tarjetas)',
        make: () => ({
          id: uid(),
          sourceKey: 'roster-rankings',
          type: 'roster_rankings',
          block: 'jugadores',
          title: 'Rankings y Estadísticas del Rival',
        })
      });

      // 1b. Slide con Sancionados y Apercibidos del Comité FFCV
      cat.jugadores.push({
        key: 'ffcv-sanctions',
        block: 'jugadores',
        label: '🚫 Sancionados y Apercibidos (Comité FFCV)',
        make: () => ({
          id: uid(),
          sourceKey: 'ffcv-sanctions',
          type: 'ffcv_sanctions',
          block: 'jugadores',
          title: 'Sancionados y Apercibidos para la Jornada',
        })
      });

      // Filtrar a SOLAMENTE los jugadores destacados
      const explicitFeatured = effectiveRoster.filter(p => p.is_featured);
      const featuredPlayers = explicitFeatured.length > 0
        ? explicitFeatured
        : effectiveRoster.filter(p => (p.comments && p.comments.trim().length > 0) || (p.starter_count || 0) > 0 || (p.goals || 0) > 0 || (p.yellow_cards || 0) >= 3).slice(0, 8);

      // 2. Resumen de plantilla de destacados
      cat.jugadores.push({
        key: 'roster-summary',
        block: 'jugadores',
        label: `⭐ Resumen de Jugadores Destacados (${featuredPlayers.length} jug. destacados)`,
        make: () => ({
          id: uid(),
          sourceKey: 'roster-summary',
          type: 'general_summary',
          block: 'jugadores',
          title: 'Jugadores Destacados del Rival',
          summaryData: {
            rosterComments: featuredPlayers,
          }
        })
      });

      // 3. Fichas individuales ÚNICAMENTE de jugadores destacados (no todos los 64)
      featuredPlayers.forEach(p => {
        cat.jugadores.push({
          key: `player-${p.id}`,
          block: 'jugadores',
          label: `⭐ Ficha: ${p.name} ${p.number ? `(#${p.number})` : ''}`,
          make: () => ({
            id: uid(),
            sourceKey: `player-${p.id}`,
            type: 'text',
            block: 'jugadores',
            title: `Jugador Destacado: ${p.name} ${p.number ? `(#${p.number})` : ''}`,
            text: `Posición: ${p.position || 'Sin posición'}\n` +
                  `Partidos: ${p.matches_played ?? 0} | Titular: ${p.starter_count ?? 0}\n` +
                  `Minutos: ${p.minutes_played ? p.minutes_played + "'" : '0'}\n` +
                  `Estadísticas: ${p.goals ?? 0} Goles | 🟨 ${p.yellow_cards ?? 0} Amarillas | 🟥 ${p.red_cards ?? 0} Rojas\n` +
                  (p.comments ? `\nObservaciones Tácticas:\n${p.comments}` : '')
          })
        });
      });
    }



    // Fases (con_balon / sin_balon / abp): subsecciones (texto + campograma)
    const subSections = analysis.sub_sections || {};
    (['con_balon', 'sin_balon', 'abp'] as const).forEach(phase => {
      const def = OPPONENT_TAXONOMY[phase];
      const sides = def.hasSides ? ABP_SIDES.map(s => s.key) : [undefined];
      def.subs.forEach(sub => {
        sides.forEach(side => {
          const key = catKey(phase, sub.key, side);
          const content = subSections[key];
          if (!content) return;
          const sideLabel = side ? ` (${side === 'ofensivo' ? 'Of' : 'Def'})` : '';
          const heading = `${def.label} → ${sub.label}${sideLabel}`;
          const hasDesc = !!content.description?.trim();
          const hasBoard = !!content.board?.trim();

          if (hasDesc && hasBoard) {
            cat[phase].push({
              key: `${key}-combined`, block: phase, label: `Campograma + Texto: ${sub.label}${sideLabel}`,
              make: () => ({
                id: uid(), sourceKey: `${key}-combined`, type: 'board', block: phase, title: heading,
                board: content.board, text: content.description
              })
            });
          } else if (hasBoard) {
            cat[phase].push({
              key: `${key}-board`, block: phase, label: `Campograma: ${sub.label}${sideLabel}`,
              make: () => ({ id: uid(), sourceKey: `${key}-board`, type: 'board', block: phase, title: heading, board: content.board }),
            });
          } else if (hasDesc) {
            cat[phase].push({
              key: `${key}-desc`, block: phase, label: `Texto: ${sub.label}${sideLabel}`,
              make: () => ({ id: uid(), sourceKey: `${key}-desc`, type: 'text', block: phase, title: heading, text: content.description }),
            });
          }
        });
      });
    });

    // Clips catalogados por fase
    allLibraryClips(libraryVideos).forEach(clip => {
      const phase = clip.category?.phase;
      if (!phase) return;
      cat[phase].push({
        key: `clip-${clip.videoId}-${clip.id}`, block: phase, label: `Clip: ${clip.title}`,
        make: () => ({ id: uid(), sourceKey: `clip-${clip.videoId}-${clip.id}`, type: 'clip', block: phase, title: clip.title, videoId: clip.videoId, clipId: clip.id }),
      });
    });

    return cat;
  }, [analysis, libraryVideos]);

  // Sincronizar presentaciones automáticamente cuando cambia el catálogo (los datos base)
  useEffect(() => {
    if (presentations.length === 0 || !canEdit) return;
    
    const allItems = Object.values(catalog).flat();
    let hasChanges = false;
    
    const updatedPresentations = presentations.map(p => {
      let pChanged = false;
      const newSlides = p.slides.map(slide => {
        if (!slide.sourceKey) return slide;
        
        let catItem = allItems.find(c => c.key === slide.sourceKey);
        // Fallback: Si teníamos un campograma o texto suelto y ahora hay versión combinada
        if (!catItem && (slide.sourceKey.endsWith('-board') || slide.sourceKey.endsWith('-desc'))) {
          const baseKey = slide.sourceKey.replace(/-board$|-desc$/, '');
          catItem = allItems.find(c => c.key === `${baseKey}-combined`);
        }
        // Fallback inverso: Si teníamos uno combinado y ahora solo hay suelto (se borró texto/dibujo)
        if (!catItem && slide.sourceKey.endsWith('-combined')) {
           const baseKey = slide.sourceKey.replace(/-combined$/, '');
           catItem = allItems.find(c => c.key === `${baseKey}-board`) || allItems.find(c => c.key === `${baseKey}-desc`);
        }
        
        if (!catItem) return slide;
        
        const fresh = catItem.make();
        // Comprobar si los datos han cambiado (ignorando el id y propiedades editadas como title o strokes)
        const changed = 
          slide.sourceKey !== fresh.sourceKey ||
          slide.board !== fresh.board ||
          slide.text !== fresh.text ||
          JSON.stringify(slide.formation) !== JSON.stringify(fresh.formation) ||
          JSON.stringify(slide.summaryData) !== JSON.stringify(fresh.summaryData) ||
          slide.clipId !== fresh.clipId ||
          slide.videoId !== fresh.videoId;
          
        if (changed) {
          pChanged = true;
          hasChanges = true;
          return {
            ...slide,
            sourceKey: fresh.sourceKey,
            board: fresh.board,
            text: fresh.text,
            formation: fresh.formation,
            summaryData: fresh.summaryData,
            clipId: fresh.clipId,
            videoId: fresh.videoId,
          };
        }
        return slide;
      });
      
      if (pChanged) return { ...p, slides: newSlides };
      return p;
    });

    if (hasChanges) {
      onChange(updatedPresentations);
    }
  }, [catalog, canEdit]); // Omitimos dependencias que causan re-render loops (onChange, presentations no se añaden para evitar bucles)

  // ----- Mutadores de presentaciones -----
  const updatePresentation = (id: string, updates: Partial<OpponentPresentation>) => {
    onChange(presentations.map(p => (p.id === id ? { ...p, ...updates } : p)));
  };

  const createPresentation = () => {
    const p: OpponentPresentation = {
      id: `pres-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: `Presentación ${presentations.length + 1}`,
      created_at: new Date().toISOString(),
      slides: [],
    };
    onChange([...presentations, p]);
    setEditingId(p.id);
  };

  const deletePresentation = (id: string) => {
    if (!window.confirm('¿Eliminar esta presentación?')) return;
    onChange(presentations.filter(p => p.id !== id));
    if (editingId === id) setEditingId(null);
  };

  const addSlide = (make: () => PresentationSlide) => {
    if (!editing) return;
    const newSlide = make();
    if (selectedSlideId) {
      const idx = editing.slides.findIndex(s => s.id === selectedSlideId);
      if (idx !== -1) {
        const next = [...editing.slides];
        next.splice(idx, 0, newSlide);
        updatePresentation(editing.id, { slides: next });
        setSelectedSlideId(newSlide.id);
        return;
      }
    }
    updatePresentation(editing.id, { slides: [...editing.slides, newSlide] });
    setSelectedSlideId(newSlide.id);
  };

  const removeSlide = (slideId: string) => {
    if (!editing) return;
    updatePresentation(editing.id, { slides: editing.slides.filter(s => s.id !== slideId) });
    if (selectedSlideId === slideId) setSelectedSlideId(null);
  };

  const moveSlide = (idx: number, dir: -1 | 1) => {
    if (!editing) return;
    const next = [...editing.slides];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    updatePresentation(editing.id, { slides: next });
  };

  const updateSlideTitle = (slideId: string, title: string) => {
    if (!editing) return;
    updatePresentation(editing.id, { slides: editing.slides.map(s => (s.id === slideId ? { ...s, title } : s)) });
  };

  const sortByBlocks = () => {
    if (!editing) return;
    const sorted = [...editing.slides].sort((a, b) => {
      const ba = BLOCK_ORDER.indexOf(a.block);
      const bb = BLOCK_ORDER.indexOf(b.block);
      if (ba !== bb) return ba - bb;
      // dentro del bloque, las portadas primero
      if (a.type === 'cover' && b.type !== 'cover') return -1;
      if (b.type === 'cover' && a.type !== 'cover') return 1;
      return 0;
    });
    updatePresentation(editing.id, { slides: sorted });
  };

  const addCoverBeforeSelectedOrAuto = () => {
    if (!editing || editing.slides.length === 0) return;

    if (selectedSlideId) {
      const idx = editing.slides.findIndex(s => s.id === selectedSlideId);
      if (idx !== -1) {
        const targetSlide = editing.slides[idx];
        const coverSlide: PresentationSlide = {
          id: uid(),
          type: 'cover',
          block: targetSlide.block,
          title: targetSlide.title || BLOCK_LABELS[targetSlide.block],
          subtitle: `Análisis ${analysis.opponent}`,
        };
        const next = [...editing.slides];
        next.splice(idx, 0, coverSlide);
        updatePresentation(editing.id, { slides: next });
        setSelectedSlideId(coverSlide.id);
        return;
      }
    }

    // Fallback: Si no hay selección, añade portadas de bloque automáticas al principio
    const present = BLOCK_ORDER.filter(b => editing.slides.some(s => s.block === b));
    const existingCovers = new Set(editing.slides.filter(s => s.type === 'cover').map(s => s.block));
    const covers: PresentationSlide[] = present
      .filter(b => !existingCovers.has(b))
      .map(b => ({ id: uid(), type: 'cover', block: b, title: BLOCK_LABELS[b] }));
    if (covers.length === 0) return;
    const merged = [...editing.slides, ...covers].sort((a, b) => {
      const ba = BLOCK_ORDER.indexOf(a.block);
      const bb = BLOCK_ORDER.indexOf(b.block);
      if (ba !== bb) return ba - bb;
      if (a.type === 'cover' && b.type !== 'cover') return -1;
      if (b.type === 'cover' && a.type !== 'cover') return 1;
      return 0;
    });
    updatePresentation(editing.id, { slides: merged });
  };

  const blockIcon: Record<PresentationBlock, React.ElementType> = {
    generales: TacticalIcon, jugadores: Users, con_balon: ShieldAlert, sin_balon: Award, abp: FileText,
  };
  const slideTypeIcon = (t: PresentationSlide['type']) => {
    switch (t) {
      case 'cover': return PanelsTopLeft;
      case 'formation': return TacticalIcon;
      case 'board': return Layers;
      case 'clip': return Film;
      case 'ffcv_stats': return BarChart2;
      case 'ffcv_highlights': return Trophy;
      case 'ffcv_intervals': return Activity;
      case 'roster_rankings': return Users;
      case 'ffcv_sanctions': return ShieldAlert;
      default: return FileText;
    }
  };

  // ====================== VISTA: EDITOR DE UNA PRESENTACIÓN ======================
  if (editing) {
    const catalogHasContent = BLOCK_ORDER.some(b => catalog[b].length > 0);
    return (
      <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-4 sm:p-6 shadow-premium">
        {/* Cabecera del editor */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
          <div className="flex items-center gap-3 min-w-0">
            <button onClick={() => setEditingId(null)} className="p-2 text-brand-gray-muted hover:text-white rounded-lg hover:bg-brand-black transition-colors">
              <ArrowLeft className="w-4 h-4" />
            </button>
            <input
              type="text"
              value={editing.title}
              onChange={e => updatePresentation(editing.id, { title: e.target.value })}
              className="bg-transparent text-lg font-bold text-white outline-none border-b border-transparent focus:border-brand-red-600 min-w-0"
            />
            <span className="text-[11px] text-brand-gray-muted bg-black px-2 py-0.5 rounded-full shrink-0">{editing.slides.length} diapos</span>
          </div>
          <button
            onClick={() => setPlayingId(editing.id)}
            disabled={editing.slides.length === 0}
            className="btn-primary py-2 px-5 text-sm flex items-center gap-2 disabled:opacity-40"
          >
            <Play className="w-4 h-4" /> Reproducir
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Catálogo de contenido */}
          <div className="bg-brand-black border border-brand-black-border rounded-xl p-4">
            <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
              <Plus className="w-4 h-4 text-brand-red-600" /> Contenido disponible
            </h4>
            {!catalogHasContent ? (
              <p className="text-xs text-brand-gray-dark italic py-6 text-center">
                No hay contenido para añadir todavía. Crea campogramas, informes o clips en las secciones anteriores.
              </p>
            ) : (
              <div className="space-y-4 max-h-[520px] overflow-y-auto no-scrollbar pr-1">
                {BLOCK_ORDER.filter(b => catalog[b].length > 0).map(block => {
                  const Icon = blockIcon[block];
                  return (
                    <div key={block}>
                      <h5 className="text-[11px] font-bold text-brand-red-500 uppercase tracking-wider flex items-center gap-1.5 mb-2 sticky top-0 bg-brand-black py-1">
                        <Icon className="w-3.5 h-3.5" /> {BLOCK_LABELS[block]}
                      </h5>
                      <div className="space-y-1.5">
                        {catalog[block].map(item => (
                          <button
                            key={item.key}
                            onClick={() => addSlide(item.make)}
                            className="w-full flex items-center gap-2 bg-black border border-brand-black-border rounded-lg px-3 py-2 text-left hover:border-brand-red-600/50 transition-colors group"
                          >
                            <Plus className="w-3.5 h-3.5 text-brand-gray-muted group-hover:text-brand-red-500 shrink-0" />
                            <span className="flex-1 min-w-0 truncate text-xs text-brand-gray-light group-hover:text-white">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diapositivas ordenadas */}
          <div className="bg-brand-black border border-brand-black-border rounded-xl p-4">
            <div className="flex items-center justify-between mb-3 gap-2 flex-wrap">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2">
                <LayoutGrid className="w-4 h-4 text-brand-red-600" /> Diapositivas
              </h4>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={addCoverBeforeSelectedOrAuto}
                  disabled={editing.slides.length === 0}
                  className="text-[11px] font-semibold text-brand-gray-muted hover:text-white bg-brand-black-card border border-brand-black-border px-2.5 py-1 rounded flex items-center gap-1 disabled:opacity-40 hover:border-brand-red-600/50 transition-colors"
                  title={selectedSlideId ? "Añadir portada justo antes de la diapositiva seleccionada" : "Añadir portadas de bloque automáticamente"}
                >
                  <Wand2 className="w-3 h-3 text-brand-red-500" /> Portadas
                </button>
                <button onClick={sortByBlocks} disabled={editing.slides.length === 0} className="text-[11px] font-semibold text-brand-gray-muted hover:text-white bg-brand-black-card border border-brand-black-border px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40" title="Ordenar por bloques">
                  <Layers className="w-3 h-3" /> Ordenar
                </button>
              </div>
            </div>

            {editing.slides.length === 0 ? (
              <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">
                <LayoutGrid className="w-6 h-6 mx-auto mb-2 opacity-40" />
                Añade contenido desde la izquierda.
              </div>
            ) : (
              <div className="space-y-2 max-h-[520px] overflow-y-auto no-scrollbar pr-1">
                {editing.slides.map((slide, idx) => {
                  const TypeIcon = slideTypeIcon(slide.type);
                  const prevBlock = idx > 0 ? editing.slides[idx - 1].block : null;
                  const showBlockHeader = slide.block !== prevBlock;
                  const isSelected = selectedSlideId === slide.id;
                  return (
                    <React.Fragment key={slide.id}>
                      {showBlockHeader && (
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-dark pt-2 pb-0.5 px-1">{BLOCK_LABELS[slide.block]}</div>
                      )}
                      <div
                        onClick={() => setSelectedSlideId(slide.id)}
                        className={`flex items-center gap-3 border rounded-xl p-2.5 transition-all cursor-pointer ${
                          isSelected
                            ? 'ring-2 ring-brand-red-500 bg-brand-red-950/30 border-brand-red-500 shadow-lg'
                            : slide.type === 'cover'
                            ? 'bg-gradient-to-r from-brand-red-950/40 via-black to-black border-brand-red-600/60 shadow-md'
                            : 'bg-black border-brand-black-border/80 hover:border-brand-gray-muted'
                        }`}
                      >
                        <span className="text-[10px] font-mono text-brand-gray-muted w-4 text-center shrink-0">{idx + 1}</span>

                        {/* Diapositiva en miniatura (Thumbnail Preview) */}
                        <div className={`w-16 h-10 rounded-lg overflow-hidden shrink-0 border flex flex-col items-center justify-center p-1 relative shadow-inner ${
                          slide.type === 'cover'
                            ? 'bg-gradient-to-br from-brand-red-900 to-black border-brand-red-500'
                            : 'bg-brand-black-card border-brand-black-border'
                        }`}>
                          {slide.type === 'cover' ? (
                            <div className="flex flex-col items-center justify-center gap-0.5 text-center">
                              <PanelsTopLeft className="w-4 h-4 text-brand-red-400" />
                              <span className="text-[7px] font-black text-white uppercase tracking-tighter truncate max-w-[50px]">PORTADA</span>
                            </div>
                          ) : slide.type === 'formation' ? (
                            <div className="w-full h-full bg-emerald-950/60 border border-emerald-800/40 rounded flex items-center justify-center">
                              <TacticalIcon className="w-4 h-4 text-emerald-400" />
                            </div>
                          ) : slide.type === 'board' ? (
                            <div className="w-full h-full bg-emerald-950/80 border border-emerald-700/50 rounded flex items-center justify-center">
                              <Layers className="w-4 h-4 text-emerald-300" />
                            </div>
                          ) : slide.type === 'clip' ? (
                            <div className="w-full h-full bg-black border border-brand-red-900/60 rounded flex items-center justify-center">
                              <Film className="w-4 h-4 text-brand-red-500" />
                            </div>
                          ) : slide.type === 'ffcv_stats' || slide.type === 'ffcv_highlights' || slide.type === 'ffcv_intervals' ? (
                            <div className="w-full h-full bg-amber-950/40 border border-amber-800/40 rounded flex items-center justify-center">
                              <BarChart2 className="w-4 h-4 text-amber-400" />
                            </div>
                          ) : slide.type === 'roster_rankings' || slide.type === 'ffcv_sanctions' ? (
                            <div className="w-full h-full bg-sky-950/40 border border-sky-800/40 rounded flex items-center justify-center">
                              <Users className="w-4 h-4 text-sky-400" />
                            </div>
                          ) : (
                            <div className="w-full h-full bg-brand-black border border-brand-black-border rounded flex flex-col gap-0.5 p-1">
                              <div className="w-3/4 h-1 bg-brand-red-500/80 rounded-full" />
                              <div className="w-full h-0.5 bg-brand-gray-dark rounded-full" />
                              <div className="w-2/3 h-0.5 bg-brand-gray-dark rounded-full" />
                            </div>
                          )}
                        </div>

                        {/* Título de la diapositiva */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5 mb-0.5">
                            <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                              slide.type === 'cover'
                                ? 'bg-brand-red-600 text-white font-extrabold'
                                : 'bg-brand-black-card text-brand-gray-muted border border-brand-black-border'
                            }`}>
                              {slide.type === 'cover' ? '📌 PORTADA DE BLOQUE' : BLOCK_LABELS[slide.block]}
                            </span>
                          </div>
                          <input
                            type="text"
                            value={slide.title || ''}
                            onChange={e => updateSlideTitle(slide.id, e.target.value)}
                            placeholder={slide.type === 'cover' ? 'Título de portada' : 'Título de la diapositiva'}
                            className={`w-full bg-transparent text-xs font-semibold outline-none border-b border-transparent focus:border-brand-red-600 ${
                              slide.type === 'cover' ? 'text-brand-red-400 font-black text-sm' : 'text-white'
                            }`}
                          />
                        </div>

                        {/* Acciones */}
                        <div className="flex items-center shrink-0 gap-0.5">
                          <button onClick={() => moveSlide(idx, -1)} disabled={idx === 0} className="p-1 text-brand-gray-muted hover:text-white disabled:opacity-20"><ChevronUp className="w-3.5 h-3.5" /></button>
                          <button onClick={() => moveSlide(idx, 1)} disabled={idx === editing.slides.length - 1} className="p-1 text-brand-gray-muted hover:text-white disabled:opacity-20"><ChevronDown className="w-3.5 h-3.5" /></button>
                          <button onClick={() => removeSlide(slide.id)} className="p-1 text-brand-gray-muted hover:text-brand-red-600"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {playing && (
          <PresentationPlayer
            presentation={playing}
            libraryVideos={libraryVideos}
            opponentName={analysis.opponent}
            onClose={() => setPlayingId(null)}
          />
        )}
      </div>
    );
  }

  // ====================== VISTA: LISTA DE PRESENTACIONES ======================
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-brand-gray-muted">
          Monta diapositivas por bloques y reprodúcelas a pantalla completa para la charla técnica.
        </p>
        {canEdit && (
          <button onClick={createPresentation} className="btn-primary py-2 px-4 text-xs font-semibold flex items-center gap-1.5 shrink-0">
            <Plus className="w-3.5 h-3.5" /> Nueva presentación
          </button>
        )}
      </div>

      {presentations.length === 0 ? (
        <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">
          <PresentationIcon className="w-7 h-7 mx-auto mb-2 opacity-40" />
          Sin presentaciones.<br />
          {canEdit ? 'Crea la primera para preparar la charla.' : 'Aún no se ha creado ninguna.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {presentations.map(p => (
            <div key={p.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col gap-3 hover:border-brand-red-600/40 transition-colors">
              <div className="flex items-start gap-3">
                <span className="p-2 bg-brand-red-600/10 text-brand-red-500 rounded-lg shrink-0"><PresentationIcon className="w-5 h-5" /></span>
                <div className="flex-1 min-w-0">
                  <h4 className="text-sm font-bold text-white truncate">{p.title}</h4>
                  <span className="text-[11px] text-brand-gray-muted">{p.slides.length} diapositiva{p.slides.length === 1 ? '' : 's'}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 border-t border-brand-black-border pt-3">
                <button
                  onClick={() => setPlayingId(p.id)}
                  disabled={p.slides.length === 0}
                  className="flex-1 flex items-center justify-center gap-1.5 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white border border-brand-red-600/30 rounded-lg py-1.5 text-xs font-bold transition-colors disabled:opacity-40"
                >
                  <Play className="w-3.5 h-3.5" /> Reproducir
                </button>
                {canEdit && (
                  <>
                    <PresentationShareButton analysisId={analysis.id} opponentName={analysis.opponent} presentation={p} />
                    <button onClick={() => setEditingId(p.id)} className="p-2 text-brand-gray-muted hover:text-white bg-black border border-brand-black-border rounded-lg" title="Editar"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => deletePresentation(p.id)} className="p-2 text-brand-gray-muted hover:text-brand-red-600 bg-black border border-brand-black-border rounded-lg" title="Eliminar"><Trash2 className="w-3.5 h-3.5" /></button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {playing && !editing && (
        <PresentationPlayer
          presentation={playing}
          libraryVideos={libraryVideos}
          opponentName={analysis.opponent}
          onClose={() => setPlayingId(null)}
        />
      )}
    </div>
  );
};
