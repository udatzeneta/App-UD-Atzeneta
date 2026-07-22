import React, { useMemo, useState, useEffect } from 'react';
import type {
  OpponentAnalysis, OpponentPresentation, PresentationSlide, PresentationBlock,
  OpponentLibraryVideo,
} from '../../types';
import {
  Plus, Play, Trash2, Edit2, ChevronUp, ChevronDown, ArrowLeft, LayoutGrid,
  Presentation as PresentationIcon, PanelsTopLeft, Film, Users, ShieldAlert,
  Award, FileText, Settings as TacticalIcon, Layers, Wand2,
} from 'lucide-react';
import { PresentationPlayer, BLOCK_LABELS } from './PresentationPlayer';
import { OPPONENT_TAXONOMY, ABP_SIDES, catKey } from '../../constants/opponentTaxonomy';
import { allLibraryClips } from '../../utils/opponentVideo';

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

  const editing = presentations.find(p => p.id === editingId) || null;
  const playing = presentations.find(p => p.id === playingId) || null;

  // ----- Catálogo de contenido disponible (derivado del análisis) -----
  const catalog = useMemo<Record<PresentationBlock, CatalogItem[]>>(() => {
    const cat: Record<PresentationBlock, CatalogItem[]> = {
      generales: [], jugadores: [], con_balon: [], sin_balon: [], abp: [],
    };

    // Generales (Todo en uno)
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
    updatePresentation(editing.id, { slides: [...editing.slides, make()] });
  };

  const removeSlide = (slideId: string) => {
    if (!editing) return;
    updatePresentation(editing.id, { slides: editing.slides.filter(s => s.id !== slideId) });
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

  const addAutoCovers = () => {
    if (!editing) return;
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
                <button onClick={addAutoCovers} disabled={editing.slides.length === 0} className="text-[11px] font-semibold text-brand-gray-muted hover:text-white bg-brand-black-card border border-brand-black-border px-2 py-1 rounded flex items-center gap-1 disabled:opacity-40" title="Añadir portadas de bloque">
                  <Wand2 className="w-3 h-3" /> Portadas
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
                  return (
                    <React.Fragment key={slide.id}>
                      {showBlockHeader && (
                        <div className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-dark pt-2 pb-0.5 px-1">{BLOCK_LABELS[slide.block]}</div>
                      )}
                      <div className="flex items-center gap-2 bg-black border border-brand-black-border rounded-lg p-2">
                        <span className="text-[10px] font-mono text-brand-gray-muted w-5 text-center shrink-0">{idx + 1}</span>
                        <span className="p-1.5 bg-brand-red-600/10 text-brand-red-500 rounded shrink-0"><TypeIcon className="w-3.5 h-3.5" /></span>
                        <input
                          type="text"
                          value={slide.title || ''}
                          onChange={e => updateSlideTitle(slide.id, e.target.value)}
                          placeholder={slide.type === 'cover' ? 'Título de portada' : 'Título de la diapositiva'}
                          className="flex-1 min-w-0 bg-transparent text-xs text-brand-gray-light outline-none"
                        />
                        <div className="flex items-center shrink-0">
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
