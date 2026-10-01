import React, { useMemo, useState, useEffect, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import type {
  OpponentAnalysis, OpponentPresentation, PresentationSlide, PresentationBlock,
  OpponentLibraryVideo, OpponentRosterPlayer,
} from '../../types';
import {
  Plus, Play, Trash2, Edit2, ArrowLeft, GripVertical, Check, X, LayoutGrid,
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

// Lo que se está arrastrando: ítems del catálogo (nuevas diapos) o diapositivas existentes (reordenar)
type DragPayload = { kind: 'catalog'; keys: string[] } | { kind: 'slides'; ids: string[] };

// Imagen fantasma del arrastre: tarjeta con el texto y un contador si hay varios elementos
const setDragGhost = (e: React.DragEvent, label: string, count: number) => {
  const ghost = document.createElement('div');
  ghost.style.cssText =
    'position:fixed;top:-1000px;left:-1000px;display:flex;align-items:center;gap:8px;padding:8px 12px;' +
    'background:#0a0a0a;border:1px solid #dc2626;border-radius:10px;color:#fff;font:600 12px system-ui,sans-serif;' +
    'box-shadow:0 10px 30px rgba(220,38,38,.35);max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;';
  if (count > 1) {
    const badge = document.createElement('span');
    badge.textContent = String(count);
    badge.style.cssText = 'background:#dc2626;color:#fff;border-radius:999px;padding:1px 7px;font-size:11px;font-weight:800;';
    ghost.appendChild(badge);
  }
  const text = document.createElement('span');
  text.textContent = count > 1 ? `${label} y ${count - 1} más` : label;
  text.style.cssText = 'overflow:hidden;text-overflow:ellipsis;';
  ghost.appendChild(text);
  document.body.appendChild(ghost);
  e.dataTransfer.setDragImage(ghost, 16, 16);
  window.setTimeout(() => ghost.remove(), 0);
};

const uid = () => `slide-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const bullets = (arr: string[]) => arr.map(s => `•  ${s}`).join('\n');

export const OpponentPresentationBuilder: React.FC<Props> = ({ analysis, presentations, libraryVideos, canEdit, onChange }) => {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [playingId, setPlayingId] = useState<string | null>(null);
  const [selectedSlideId, setSelectedSlideId] = useState<string | null>(null);
  // Selección múltiple (catálogo y diapositivas) y estado del arrastre
  const [selectedSlideIds, setSelectedSlideIds] = useState<Set<string>>(new Set());
  const [selectedCatalogKeys, setSelectedCatalogKeys] = useState<Set<string>>(new Set());
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [dragging, setDragging] = useState<DragPayload | null>(null);
  const [flashIds, setFlashIds] = useState<Set<string>>(new Set());
  const dragRef = useRef<DragPayload | null>(null);
  const rowRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const listRef = useRef<HTMLDivElement | null>(null);
  const catalogAnchorRef = useRef<string | null>(null);

  const flashSlides = (ids: string[]) => {
    setFlashIds(new Set(ids));
    window.setTimeout(() => setFlashIds(new Set()), 900);
  };

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

  // Inserta varias diapositivas nuevas (creadas desde el catálogo) en una posición concreta
  const insertSlidesAt = (makers: Array<() => PresentationSlide>, index: number) => {
    if (!editing || makers.length === 0) return;
    const created = makers.map(m => m());
    const next = [...editing.slides];
    const at = Math.max(0, Math.min(index, next.length));
    next.splice(at, 0, ...created);
    updatePresentation(editing.id, { slides: next });
    setSelectedSlideIds(new Set(created.map(s => s.id)));
    setSelectedSlideId(created[created.length - 1].id);
    flashSlides(created.map(s => s.id));
  };

  // Mueve un grupo de diapositivas (manteniendo su orden relativo) a la posición indicada
  const moveSlidesTo = (ids: string[], index: number) => {
    if (!editing || ids.length === 0) return;
    const idSet = new Set(ids);
    const moving = editing.slides.filter(s => idSet.has(s.id));
    const before = editing.slides.slice(0, index).filter(s => idSet.has(s.id)).length;
    const rest = editing.slides.filter(s => !idSet.has(s.id));
    const at = Math.max(0, Math.min(index - before, rest.length));
    rest.splice(at, 0, ...moving);
    if (rest.every((s, i) => s.id === editing.slides[i].id)) return;
    updatePresentation(editing.id, { slides: rest });
    flashSlides(ids);
  };

  const removeSlides = (ids: string[]) => {
    if (!editing || ids.length === 0) return;
    const idSet = new Set(ids);
    updatePresentation(editing.id, { slides: editing.slides.filter(s => !idSet.has(s.id)) });
    setSelectedSlideIds(prev => new Set([...prev].filter(id => !idSet.has(id))));
    if (selectedSlideId && idSet.has(selectedSlideId)) setSelectedSlideId(null);
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
    const allCatalogItems = BLOCK_ORDER.flatMap(b => catalog[b]);
    const catalogByKey = new Map(allCatalogItems.map(i => [i.key, i]));
    const usedCount = new Map<string, number>();
    editing.slides.forEach(s => { if (s.sourceKey) usedCount.set(s.sourceKey, (usedCount.get(s.sourceKey) || 0) + 1); });
    const draggingSlideIds = dragging?.kind === 'slides' ? new Set(dragging.ids) : null;
    const dragCount = dragging ? (dragging.kind === 'catalog' ? dragging.keys.length : dragging.ids.length) : 0;

    // --- Selección en el catálogo (clic = marcar/desmarcar, Shift = rango) ---
    const toggleCatalogItem = (key: string, e: React.MouseEvent) => {
      setSelectedCatalogKeys(prev => {
        const next = new Set(prev);
        const anchor = catalogAnchorRef.current;
        if (e.shiftKey && anchor && anchor !== key) {
          const a = allCatalogItems.findIndex(i => i.key === anchor);
          const b = allCatalogItems.findIndex(i => i.key === key);
          if (a !== -1 && b !== -1) {
            allCatalogItems.slice(Math.min(a, b), Math.max(a, b) + 1).forEach(i => next.add(i.key));
            return next;
          }
        }
        if (next.has(key)) next.delete(key); else next.add(key);
        return next;
      });
      catalogAnchorRef.current = key;
    };

    const toggleBlockSelection = (block: PresentationBlock) => {
      const keys = catalog[block].map(i => i.key);
      setSelectedCatalogKeys(prev => {
        const next = new Set(prev);
        const allSelected = keys.every(k => next.has(k));
        keys.forEach(k => (allSelected ? next.delete(k) : next.add(k)));
        return next;
      });
    };

    const addCatalogKeysAt = (keys: string[], index: number) => {
      const makers = keys.map(k => catalogByKey.get(k)?.make).filter((m): m is () => PresentationSlide => !!m);
      insertSlidesAt(makers, index);
      setSelectedCatalogKeys(new Set());
    };

    // --- Selección de diapositivas (clic = una, Ctrl/Cmd = añadir, Shift = rango) ---
    const clickSlide = (id: string, e: React.MouseEvent) => {
      if (e.metaKey || e.ctrlKey) {
        setSelectedSlideIds(prev => {
          const next = new Set(prev);
          if (next.has(id)) next.delete(id); else next.add(id);
          return next;
        });
      } else if (e.shiftKey && selectedSlideId) {
        const a = editing.slides.findIndex(s => s.id === selectedSlideId);
        const b = editing.slides.findIndex(s => s.id === id);
        if (a !== -1 && b !== -1) {
          setSelectedSlideIds(new Set(editing.slides.slice(Math.min(a, b), Math.max(a, b) + 1).map(s => s.id)));
        }
        return;
      } else {
        setSelectedSlideIds(new Set([id]));
      }
      setSelectedSlideId(id);
    };

    // --- Drag & drop ---
    const startDrag = (payload: DragPayload, e: React.DragEvent, label: string) => {
      dragRef.current = payload;
      setDragging(payload);
      e.dataTransfer.effectAllowed = payload.kind === 'catalog' ? 'copy' : 'move';
      e.dataTransfer.setData('text/plain', payload.kind);
      setDragGhost(e, label, payload.kind === 'catalog' ? payload.keys.length : payload.ids.length);
    };

    const onCatalogDragStart = (item: CatalogItem, e: React.DragEvent) => {
      const keys = selectedCatalogKeys.has(item.key)
        ? allCatalogItems.filter(i => selectedCatalogKeys.has(i.key)).map(i => i.key)
        : [item.key];
      startDrag({ kind: 'catalog', keys }, e, item.label);
    };

    const onSlideDragStart = (slide: PresentationSlide, e: React.DragEvent) => {
      if ((e.target as HTMLElement).closest?.('input')) { e.preventDefault(); return; }
      const ids = selectedSlideIds.has(slide.id)
        ? editing.slides.filter(s => selectedSlideIds.has(s.id)).map(s => s.id)
        : [slide.id];
      startDrag({ kind: 'slides', ids }, e, slide.title || BLOCK_LABELS[slide.block]);
    };

    const endDrag = () => {
      dragRef.current = null;
      setDragging(null);
      setDropIndex(null);
    };

    // Índice de inserción según la posición vertical del cursor respecto al centro de cada diapositiva
    const computeDropIndex = (clientY: number) => {
      for (let i = 0; i < editing.slides.length; i++) {
        const el = rowRefs.current.get(editing.slides[i].id);
        if (!el) continue;
        const r = el.getBoundingClientRect();
        if (clientY < r.top + r.height / 2) return i;
      }
      return editing.slides.length;
    };

    const onPanelDragOver = (e: React.DragEvent) => {
      const payload = dragRef.current;
      if (!payload) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = payload.kind === 'catalog' ? 'copy' : 'move';
      const idx = computeDropIndex(e.clientY);
      if (idx !== dropIndex) setDropIndex(idx);
      // Auto-scroll al acercarse a los bordes de la lista
      const list = listRef.current;
      if (list) {
        const r = list.getBoundingClientRect();
        if (e.clientY < r.top + 48) list.scrollTop -= 14;
        else if (e.clientY > r.bottom - 48) list.scrollTop += 14;
      }
    };

    const onPanelDragLeave = (e: React.DragEvent) => {
      if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropIndex(null);
    };

    const onPanelDrop = (e: React.DragEvent) => {
      const payload = dragRef.current;
      if (!payload) return;
      e.preventDefault();
      const idx = dropIndex ?? computeDropIndex(e.clientY);
      if (payload.kind === 'catalog') addCatalogKeysAt(payload.keys, idx);
      else moveSlidesTo(payload.ids, idx);
      endDrag();
    };

    const dropLine = (position: 'top' | 'bottom') => (
      <div className={`pointer-events-none absolute left-0 right-0 z-20 flex items-center ${position === 'top' ? '-top-[6px]' : '-bottom-[6px]'}`}>
        <span className="w-2.5 h-2.5 rounded-full bg-brand-red-500 ring-4 ring-brand-red-500/25 shrink-0" />
        <span className="flex-1 h-[3px] bg-brand-red-500 rounded-full shadow-[0_0_12px_rgba(239,68,68,0.9)]" />
        <span className="ml-2 text-[10px] font-bold uppercase tracking-wider bg-brand-red-600 text-white px-2 py-0.5 rounded-full shadow-lg shrink-0">
          {dragging?.kind === 'catalog' ? `+${dragCount} aquí` : dragCount > 1 ? `Mover ${dragCount}` : 'Mover aquí'}
        </span>
      </div>
    );

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
          <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 flex flex-col">
            <div className="flex items-center justify-between gap-2 mb-1">
              <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-red-600" /> Contenido disponible
              </h4>
            </div>
            <p className="text-[11px] text-brand-gray-dark mb-3 flex items-center gap-1.5">
              <GripVertical className="w-3 h-3" /> Clic para seleccionar varios · arrástralos a las diapositivas
            </p>

            {/* Barra de selección */}
            {selectedCatalogKeys.size > 0 && (
              <div className="flex items-center gap-2 mb-3 bg-brand-red-950/40 border border-brand-red-600/50 rounded-lg px-3 py-2">
                <span className="text-[11px] font-black text-white bg-brand-red-600 rounded-full px-2 py-0.5">{selectedCatalogKeys.size}</span>
                <span className="text-xs text-brand-gray-light flex-1">seleccionado{selectedCatalogKeys.size === 1 ? '' : 's'} · arrastra para colocar</span>
                <button
                  onClick={() => addCatalogKeysAt(allCatalogItems.filter(i => selectedCatalogKeys.has(i.key)).map(i => i.key), editing.slides.length)}
                  className="text-[11px] font-semibold text-white bg-brand-red-600 hover:bg-brand-red-500 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Al final
                </button>
                <button onClick={() => setSelectedCatalogKeys(new Set())} className="p-1 text-brand-gray-muted hover:text-white" title="Quitar selección">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {!catalogHasContent ? (
              <p className="text-xs text-brand-gray-dark italic py-6 text-center">
                No hay contenido para añadir todavía. Crea campogramas, informes o clips en las secciones anteriores.
              </p>
            ) : (
              <div className="space-y-4 max-h-[560px] overflow-y-auto no-scrollbar pr-1">
                {BLOCK_ORDER.filter(b => catalog[b].length > 0).map(block => {
                  const Icon = blockIcon[block];
                  const blockKeys = catalog[block].map(i => i.key);
                  const blockSelected = blockKeys.filter(k => selectedCatalogKeys.has(k)).length;
                  return (
                    <div key={block}>
                      <div className="flex items-center justify-between gap-2 mb-2 sticky top-0 z-10 bg-brand-black py-1.5 border-b border-brand-black-border">
                        <h5 className="text-[11px] font-bold text-brand-red-500 uppercase tracking-wider flex items-center gap-1.5">
                          <Icon className="w-3.5 h-3.5" /> {BLOCK_LABELS[block]}
                          <span className="text-[10px] font-semibold text-brand-gray-dark normal-case tracking-normal">({catalog[block].length})</span>
                        </h5>
                        <button
                          onClick={() => toggleBlockSelection(block)}
                          className="text-[10px] font-semibold text-brand-gray-muted hover:text-white px-1.5 py-0.5 rounded hover:bg-brand-black-card transition-colors"
                        >
                          {blockSelected === blockKeys.length ? 'Ninguno' : 'Seleccionar todo'}
                        </button>
                      </div>
                      <div className="space-y-1.5">
                        {catalog[block].map(item => {
                          const isSel = selectedCatalogKeys.has(item.key);
                          const used = usedCount.get(item.key) || 0;
                          const isBeingDragged = dragging?.kind === 'catalog' && dragging.keys.includes(item.key);
                          return (
                            <div
                              key={item.key}
                              draggable
                              onDragStart={e => onCatalogDragStart(item, e)}
                              onDragEnd={endDrag}
                              onClick={e => toggleCatalogItem(item.key, e)}
                              onDoubleClick={() => addCatalogKeysAt([item.key], editing.slides.length)}
                              title="Clic: seleccionar · Arrastrar: colocar en la presentación · Doble clic: añadir al final"
                              className={`w-full flex items-center gap-2.5 border rounded-lg px-2.5 py-2 text-left cursor-grab active:cursor-grabbing select-none transition-all group ${
                                isSel
                                  ? 'bg-brand-red-950/40 border-brand-red-500 shadow-[0_0_0_1px_rgba(239,68,68,0.25)]'
                                  : 'bg-black border-brand-black-border hover:border-brand-red-600/50 hover:bg-brand-black-card'
                              } ${isBeingDragged ? 'opacity-40 scale-[0.98]' : ''}`}
                            >
                              <span className={`w-4 h-4 rounded-[5px] border flex items-center justify-center shrink-0 transition-colors ${
                                isSel ? 'bg-brand-red-600 border-brand-red-500' : 'border-brand-gray-dark group-hover:border-brand-gray-muted'
                              }`}>
                                {isSel && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                              </span>
                              <span className={`flex-1 min-w-0 truncate text-xs ${isSel ? 'text-white font-semibold' : 'text-brand-gray-light group-hover:text-white'}`}>{item.label}</span>
                              {used > 0 && (
                                <span className="text-[9px] font-bold text-emerald-400 bg-emerald-950/50 border border-emerald-800/50 rounded-full px-1.5 py-0.5 shrink-0" title="Ya está en la presentación">
                                  ✓{used > 1 ? ` ×${used}` : ''}
                                </span>
                              )}
                              <GripVertical className="w-3.5 h-3.5 text-brand-gray-dark group-hover:text-brand-gray-muted shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Diapositivas ordenadas (zona de soltado) */}
          <div
            onDragOver={onPanelDragOver}
            onDragLeave={onPanelDragLeave}
            onDrop={onPanelDrop}
            className={`bg-brand-black border rounded-xl p-4 transition-all ${
              dragging ? 'border-brand-red-600/60 shadow-[0_0_0_3px_rgba(220,38,38,0.12)]' : 'border-brand-black-border'
            }`}
          >
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

            {/* Barra de selección múltiple de diapositivas */}
            {selectedSlideIds.size > 1 && (
              <div className="flex items-center gap-2 mb-3 bg-brand-red-950/40 border border-brand-red-600/50 rounded-lg px-3 py-2">
                <span className="text-[11px] font-black text-white bg-brand-red-600 rounded-full px-2 py-0.5">{selectedSlideIds.size}</span>
                <span className="text-xs text-brand-gray-light flex-1">diapositivas seleccionadas · arrastra para mover</span>
                <button
                  onClick={() => removeSlides([...selectedSlideIds])}
                  className="text-[11px] font-semibold text-brand-gray-light hover:text-white hover:bg-brand-red-600 border border-brand-red-600/50 px-2.5 py-1 rounded-md flex items-center gap-1 transition-colors"
                >
                  <Trash2 className="w-3 h-3" /> Eliminar
                </button>
                <button onClick={() => { setSelectedSlideIds(new Set()); setSelectedSlideId(null); }} className="p-1 text-brand-gray-muted hover:text-white" title="Quitar selección">
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {editing.slides.length === 0 ? (
              <div className={`text-center py-16 text-sm border-2 border-dashed rounded-xl transition-all ${
                dragging ? 'border-brand-red-500 bg-brand-red-950/20 text-white' : 'border-brand-black-border text-brand-gray-muted'
              }`}>
                <LayoutGrid className={`w-7 h-7 mx-auto mb-2 ${dragging ? 'text-brand-red-500 animate-pulse' : 'opacity-40'}`} />
                {dragging ? `Suelta aquí para añadir ${dragCount} diapositiva${dragCount === 1 ? '' : 's'}` : 'Arrastra contenido desde la izquierda.'}
              </div>
            ) : (
              <div ref={listRef} className="space-y-2 max-h-[560px] overflow-y-auto no-scrollbar px-1 py-1.5">
                {editing.slides.map((slide, idx) => {
                  const prevBlock = idx > 0 ? editing.slides[idx - 1].block : null;
                  const showBlockHeader = slide.block !== prevBlock;
                  const isSelected = selectedSlideIds.has(slide.id) || (selectedSlideId === slide.id && selectedSlideIds.size === 0);
                  const isDragged = !!draggingSlideIds?.has(slide.id);
                  const isFlash = flashIds.has(slide.id);
                  const BlockIcon = blockIcon[slide.block];
                  return (
                    <div
                      key={slide.id}
                      ref={el => { if (el) rowRefs.current.set(slide.id, el); else rowRefs.current.delete(slide.id); }}
                      className="relative"
                    >
                      {dragging && dropIndex === idx && dropLine('top')}
                      {showBlockHeader && (
                        <div className="flex items-center gap-2 pt-2 pb-1.5 px-1">
                          <BlockIcon className="w-3.5 h-3.5 text-brand-red-500" />
                          <span className="text-[10px] font-black uppercase tracking-[0.14em] text-brand-gray-light">{BLOCK_LABELS[slide.block]}</span>
                          <span className="flex-1 h-px bg-gradient-to-r from-brand-red-600/50 to-transparent" />
                        </div>
                      )}
                      <div
                        draggable
                        onDragStart={e => onSlideDragStart(slide, e)}
                        onDragEnd={endDrag}
                        onClick={e => clickSlide(slide.id, e)}
                        className={`flex items-center gap-2.5 border rounded-xl p-2.5 transition-all cursor-grab active:cursor-grabbing group ${
                          isSelected
                            ? 'ring-2 ring-brand-red-500 bg-brand-red-950/30 border-brand-red-500 shadow-lg'
                            : slide.type === 'cover'
                            ? 'bg-gradient-to-r from-brand-red-950/40 via-black to-black border-brand-red-600/60 shadow-md'
                            : 'bg-black border-brand-black-border/80 hover:border-brand-gray-muted'
                        } ${isDragged ? 'opacity-30 scale-[0.98]' : ''} ${isFlash ? 'ring-2 ring-emerald-500/70' : ''}`}
                      >
                        <GripVertical className="w-4 h-4 text-brand-gray-dark group-hover:text-brand-gray-muted shrink-0 -mr-1" />
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
                        <div className="flex items-center shrink-0">
                          <button
                            onClick={e => { e.stopPropagation(); removeSlides([slide.id]); }}
                            className="p-1.5 rounded-md text-brand-gray-muted hover:text-white hover:bg-brand-red-600 opacity-60 group-hover:opacity-100 transition-all"
                            title="Eliminar diapositiva"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                      {dragging && dropIndex === editing.slides.length && idx === editing.slides.length - 1 && dropLine('bottom')}
                    </div>
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
