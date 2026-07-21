import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactPlayer from 'react-player';
import type { OpponentLibraryVideo, OpponentVideoClip } from '../../types';
import {
  X, Scissors, Clock, Play, Trash2, Wand2, Zap, Plus, AlertTriangle, Film, ExternalLink,
} from 'lucide-react';
import { ClipAnnotationEditor } from './ClipAnnotationEditor';
import { FastClipperModal } from './FastClipperModal';
import { ClipCategorySelector } from './ClipCategorySelector';
import { ClipAnnotationRenderer } from './ClipAnnotationRenderer';
import { catLabel } from '../../constants/opponentTaxonomy';
import { getValidUrl, formatTime } from '../../utils/opponentVideo';

interface Props {
  video: OpponentLibraryVideo;
  onChange: (video: OpponentLibraryVideo) => void;
  onClose: () => void;
  readOnly?: boolean;
}

// Estudio a pantalla completa: reproduce un vídeo de la videoteca, permite
// crear/editar clips, catalogarlos y anotarlos (telestración).
export const LibraryVideoStudio: React.FC<Props> = ({ video, onChange, onClose, readOnly = false }) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [isFastClipping, setIsFastClipping] = useState(false);

  // Overlay state
  const [dims, setDims] = useState({ cw: 0, ch: 0 });
  const [playing, setPlaying] = useState(false);
  const [activeOverlayClip, setActiveOverlayClip] = useState<OpponentVideoClip | null>(null);
  const hasAutoPausedRef = useRef<Set<string>>(new Set());

  // Measure player size for annotations
  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ cw: el.clientWidth, ch: el.clientHeight });
    });
    ro.observe(el);
    setDims({ cw: el.clientWidth, ch: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  const validUrl = getValidUrl(video.url);
  const editingClip = video.clips.find(c => c.id === editingClipId) || null;

  const setClips = (clips: OpponentVideoClip[]) => onChange({ ...video, clips });

  const addClip = () => {
    const t = Math.floor(playerRef.current?.currentTime || 0);
    const newClip: OpponentVideoClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: 'Nuevo Clip',
      start: t,
      end: t + 10,
      freezeTime: t,
      annotations: [],
    };
    setClips([...video.clips, newClip]);
    setEditingClipId(newClip.id);
  };

  const handleFastAddClip = (clipData: Partial<OpponentVideoClip>) => {
    const newClip: OpponentVideoClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      title: clipData.title || 'Corte Rápido',
      start: clipData.start || 0,
      end: clipData.end || 5,
      freezeTime: clipData.start || 0,
      annotations: [],
    };
    setClips([...video.clips, newClip]);
  };

  const updateClip = (clipId: string, updates: Partial<OpponentVideoClip>) => {
    setClips(video.clips.map(c => (c.id === clipId ? { ...c, ...updates } : c)));
  };

  const removeClip = (clipId: string) => {
    setClips(video.clips.filter(c => c.id !== clipId));
  };

  const saveClip = (updated: OpponentVideoClip) => {
    setClips(video.clips.map(c => (c.id === updated.id ? updated : c)));
  };

  const captureTime = (clipId: string, field: 'start' | 'end') => {
    updateClip(clipId, { [field]: Math.floor(playerRef.current?.currentTime || 0) });
  };

  const playClip = (clip: OpponentVideoClip) => {
    if (playerRef.current) {
      playerRef.current.currentTime = clip.start;
      playerRef.current.play?.();
    }
  };

  const content = (
    <div className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-md flex flex-col animate-fade-in">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-brand-black-border bg-brand-black shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <Film className="w-5 h-5 text-brand-red-600 shrink-0" />
          <input
            type="text"
            value={video.title}
            onChange={e => onChange({ ...video, title: e.target.value })}
            disabled={readOnly}
            className="bg-transparent text-base sm:text-lg font-bold text-white outline-none truncate min-w-0 disabled:opacity-100"
            placeholder="Título del vídeo"
          />
        </div>
        <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white border border-brand-red-600/30 rounded-lg transition-colors shrink-0 font-bold uppercase text-xs tracking-wide shadow-lg">
          <X className="w-5 h-5" /> Cerrar
        </button>
      </div>

      <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
        {/* Columna Reproductor */}
        <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto">
          <div ref={wrapperRef} className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-brand-black-border shadow-2xl relative">
            {video.clippable ? (
              <>
                <ReactPlayer 
                  ref={playerRef as any} 
                  src={validUrl} 
                  width="100%" 
                  height="100%" 
                  controls 
                  playing={playing}
                  onPlay={() => setPlaying(true)}
                  onPause={() => setPlaying(false)}
                  onTimeUpdate={(e: any) => {
                    const t = e.currentTarget.currentTime;
                    // Auto-pause logic
                    const clipToPause = video.clips.find(c =>
                      c.annotations && c.annotations.length > 0 &&
                      t >= c.freezeTime && t < c.freezeTime + 0.3
                    );

                    if (clipToPause && !hasAutoPausedRef.current.has(clipToPause.id)) {
                      hasAutoPausedRef.current.add(clipToPause.id);
                      setPlaying(false);
                      if (playerRef.current) {
                        try { playerRef.current.currentTime = clipToPause.freezeTime; } catch { /* noop */ }
                      }
                      setActiveOverlayClip(clipToPause);

                      setTimeout(() => {
                        setActiveOverlayClip(null);
                        setPlaying(true);
                      }, (clipToPause.pauseDuration || 3) * 1000);
                    }

                    // Reset auto-pause if user seeks way back before the clip
                    if (hasAutoPausedRef.current.size > 0) {
                      video.clips.forEach(c => {
                        if (t < c.freezeTime - 2 && hasAutoPausedRef.current.has(c.id)) {
                          hasAutoPausedRef.current.delete(c.id);
                        }
                      });
                    }
                  }}
                />
                {activeOverlayClip && (
                  <ClipAnnotationRenderer
                    annotations={activeOverlayClip.annotations || []}
                    cw={dims.cw}
                    ch={dims.ch}
                    videoUrl={validUrl}
                    freezeTime={activeOverlayClip.freezeTime}
                  />
                )}
              </>
            ) : (
              <iframe
                src={validUrl}
                className="w-full h-full"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                allowFullScreen
                title={video.title}
              />
            )}
          </div>

          {!video.clippable && (
            <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div className="flex-1">
                Este proveedor se muestra embebido y <b>no permite crear cortes</b>. Para recortar clips, añade el
                enlace de vídeo directo (MP4/M3U8), YouTube o Vimeo.
                <a href={validUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-amber-300 hover:text-white font-semibold">
                  <ExternalLink className="w-3 h-3" /> Abrir en pestaña nueva
                </a>
              </div>
            </div>
          )}

          {video.clippable && !readOnly && (
            <div className="flex items-center gap-2">
              <button type="button" onClick={addClip} className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2">
                <Plus className="w-4 h-4" /> Nuevo Corte
              </button>
              <button
                type="button"
                onClick={() => setIsFastClipping(true)}
                className="flex items-center gap-1.5 bg-brand-red-600/10 text-sm font-semibold text-brand-red-500 hover:bg-brand-red-600 hover:text-white px-4 py-2.5 rounded-lg transition-colors"
              >
                <Zap className="w-4 h-4" /> Extracción Rápida
              </button>
            </div>
          )}
        </div>

        {/* Columna Clips */}
        {video.clippable && (
          <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-brand-black-border bg-brand-black flex flex-col min-h-0">
            <div className="px-4 py-3 border-b border-brand-black-border flex items-center justify-between shrink-0">
              <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                <Scissors className="w-4 h-4 text-brand-red-600" /> Cortes ({video.clips.length})
              </h3>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
              {video.clips.length === 0 ? (
                <div className="text-center py-10 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">
                  <Scissors className="w-6 h-6 mx-auto mb-2 opacity-40" />
                  Aún no hay cortes.<br />Crea uno con "Nuevo Corte".
                </div>
              ) : (
                (() => {
                  const groupedClips = video.clips.reduce((acc, clip) => {
                    const label = catLabel(clip.category);
                    if (!acc[label]) acc[label] = [];
                    acc[label].push(clip);
                    return acc;
                  }, {} as Record<string, OpponentVideoClip[]>);
                  
                  const sortedLabels = Object.keys(groupedClips).sort((a, b) => {
                    if (a === 'Sin catalogar') return 1;
                    if (b === 'Sin catalogar') return -1;
                    return a.localeCompare(b);
                  });

                  return sortedLabels.map(label => (
                    <div key={label} className="space-y-3 mb-6">
                      <h4 className="text-[11px] font-bold text-brand-red-500 uppercase tracking-wider sticky top-0 bg-brand-black/90 backdrop-blur-sm py-1.5 z-10 border-b border-brand-red-600/20">
                        {label} <span className="ml-1 opacity-60 text-brand-gray-muted">({groupedClips[label].length})</span>
                      </h4>
                      {groupedClips[label].map(clip => (
                        <div key={clip.id} className="bg-black border border-brand-black-border rounded-xl p-3 space-y-2.5">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => playClip(clip)}
                              className="p-1.5 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white rounded transition-colors shrink-0"
                              title="Ir a este momento"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                            <input
                              type="text"
                              value={clip.title}
                              onChange={e => updateClip(clip.id, { title: e.target.value })}
                              disabled={readOnly}
                              className="flex-1 min-w-0 bg-transparent text-sm font-semibold text-brand-gray-light outline-none"
                              placeholder="Nombre del corte"
                            />
                            <button
                              type="button"
                              onClick={() => setEditingClipId(clip.id)}
                              className="relative p-1.5 bg-brand-black-card text-brand-gray-muted hover:text-white rounded transition-colors shrink-0"
                              title="Editar / anotar clip"
                            >
                              <Wand2 className="w-3.5 h-3.5" />
                              {clip.annotations && clip.annotations.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-brand-red-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                  {clip.annotations.length}
                                </span>
                              )}
                            </button>
                            {!readOnly && (
                              <button type="button" onClick={() => removeClip(clip.id)} className="p-1 text-brand-gray-muted hover:text-brand-red-600 shrink-0">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {/* Tiempos */}
                          <div className="flex items-center gap-1.5 bg-brand-black-card rounded-lg p-1.5 w-fit">
                            <button type="button" onClick={() => captureTime(clip.id, 'start')} disabled={readOnly} className="p-1 hover:text-brand-red-600 text-brand-gray-muted" title="Fijar inicio al tiempo actual">
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                            <input type="number" value={clip.start} onChange={e => updateClip(clip.id, { start: parseInt(e.target.value) || 0 })} disabled={readOnly} className="w-12 bg-transparent text-center text-xs text-brand-gray-light outline-none" />
                            <span className="text-brand-gray-dark text-xs">→</span>
                            <input type="number" value={clip.end} onChange={e => updateClip(clip.id, { end: parseInt(e.target.value) || 0 })} disabled={readOnly} className="w-12 bg-transparent text-center text-xs text-brand-gray-light outline-none" />
                            <button type="button" onClick={() => captureTime(clip.id, 'end')} disabled={readOnly} className="p-1 hover:text-brand-red-600 text-brand-gray-muted" title="Fijar fin al tiempo actual">
                              <Clock className="w-3.5 h-3.5" />
                            </button>
                            <span className="text-[10px] text-brand-gray-muted font-mono ml-1">
                              {formatTime(clip.start)}-{formatTime(clip.end)}
                            </span>
                          </div>

                          {/* Catalogación */}
                          {readOnly ? (
                            <span className="inline-block text-[10px] bg-brand-red-600/10 text-brand-red-500 border border-brand-red-600/20 px-2 py-0.5 rounded-full font-semibold">
                              {catLabel(clip.category)}
                            </span>
                          ) : (
                            <ClipCategorySelector value={clip.category} onChange={cat => updateClip(clip.id, { category: cat })} />
                          )}
                        </div>
                      ))}
                    </div>
                  ));
                })()
              )}
            </div>

            {/* Botón salir inferior */}
            <div className="p-4 border-t border-brand-black-border bg-brand-black">
              <button onClick={onClose} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-black-card text-brand-gray-light hover:text-white hover:bg-brand-red-600 border border-brand-black-border hover:border-brand-red-600 rounded-xl transition-all font-bold uppercase text-sm tracking-wide shadow-lg group">
                <X className="w-5 h-5 text-brand-gray-muted group-hover:text-white" /> Salir del Vídeo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Editor de anotaciones */}
      {editingClip && (
        <ClipAnnotationEditor
          videoUrl={validUrl}
          clip={editingClip}
          allClips={video.clips}
          readOnly={readOnly}
          onSave={saveClip}
          onClose={() => setEditingClipId(null)}
        />
      )}

      {/* Extracción rápida */}
      {isFastClipping && (
        <FastClipperModal videoUrl={validUrl} onAddClip={handleFastAddClip} onClose={() => setIsFastClipping(false)} />
      )}
    </div>
  );

  return createPortal(content, document.body);
};
