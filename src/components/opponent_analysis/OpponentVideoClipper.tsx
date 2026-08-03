import React, { useState, useRef, useEffect } from 'react';
import ReactPlayer from 'react-player';
import { OpponentVideo, OpponentVideoClip } from '../../types';
import { Plus, Trash2, Link, Play, Scissors, Clock, Wand2, X, Zap } from 'lucide-react';
import { ClipAnnotationEditor } from './ClipAnnotationEditor';
import { FastClipperModal } from './FastClipperModal';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { ClipCategorySelector } from './ClipCategorySelector';
import { catLabel } from '../../constants/opponentTaxonomy';
import { resolveVeoUrl } from '../../utils/opponentVideo';

interface Props {
  videos?: OpponentVideo[];
  onChange: (videos: OpponentVideo[]) => void;
  readOnly?: boolean;
}

export const OpponentVideoClipper: React.FC<Props> = ({ videos = [], onChange, readOnly = false }) => {
  const [newUrl, setNewUrl] = useState('');
  const [activeVideoId, setActiveVideoId] = useState<string | null>(videos[0]?.id || null);
  const [editingClipId, setEditingClipId] = useState<string | null>(null);
  const [expandedClipId, setExpandedClipId] = useState<string | null>(null);
  const [isFastClipping, setIsFastClipping] = useState(false);
  const playerRef = useRef<any>(null);

  const activeVideo = videos.find(v => v.id === activeVideoId);
  const editingClip = activeVideo?.clips.find(c => c.id === editingClipId) || null;

  const getValidUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('www.')) return `https://${url}`;
    if (!url.startsWith('http://') && !url.startsWith('https://')) return `https://${url}`;
    return url;
  };

  const addVideo = async () => {
    if (!newUrl.trim()) return;
    const resolvedUrl = await resolveVeoUrl(newUrl.trim());
    const newVideo: OpponentVideo = {
      id: `vid-${Date.now()}`,
      url: resolvedUrl,
      clips: []
    };
    const newVideos = [...videos, newVideo];
    onChange(newVideos);
    setActiveVideoId(newVideo.id);
    setNewUrl('');
  };

  const removeVideo = (id: string) => {
    const newVideos = videos.filter(v => v.id !== id);
    onChange(newVideos);
    if (activeVideoId === id) {
      setActiveVideoId(newVideos[0]?.id || null);
    }
  };

  const addClip = () => {
    if (!activeVideoId) return;
    const currentTime = playerRef.current?.currentTime || playerRef.current?.getCurrentTime?.() || 0;
    const newClip: OpponentVideoClip = {
      id: `clip-${Date.now()}`,
      title: 'Nuevo Clip',
      start: Math.floor(currentTime),
      end: Math.floor(currentTime) + 10, // default 10 seconds
      freezeTime: Math.floor(currentTime),
      annotations: []
    };
    onChange(videos.map(v => v.id === activeVideoId ? { ...v, clips: [...v.clips, newClip] } : v));
    // Abrir el editor profesional nada más crear el corte.
    setEditingClipId(newClip.id);
  };

  const handleFastAddClip = (clipData: Partial<OpponentVideoClip>) => {
    if (!activeVideoId) return;
    const newClip: OpponentVideoClip = {
      id: `clip-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title: clipData.title || 'Corte Rápido',
      start: clipData.start || 0,
      end: clipData.end || 5,
      freezeTime: clipData.start || 0,
      annotations: []
    };
    onChange(videos.map(v => v.id === activeVideoId ? { ...v, clips: [...v.clips, newClip] } : v));
  };

  const updateClip = (clipId: string, updates: Partial<OpponentVideoClip>) => {
    onChange(videos.map(v => ({
      ...v,
      clips: v.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
    })));
  };

  const saveClip = (updated: OpponentVideoClip) => {
    onChange(videos.map(v => ({
      ...v,
      clips: v.clips.map(c => c.id === updated.id ? updated : c)
    })));
  };

  const removeClip = (clipId: string) => {
    onChange(videos.map(v => ({
      ...v,
      clips: v.clips.filter(c => c.id !== clipId)
    })));
  };

  const captureTime = (clipId: string, field: 'start' | 'end') => {
    const time = playerRef.current?.getCurrentTime() || 0;
    updateClip(clipId, { [field]: Math.floor(time) });
  };

  const playClip = (clip: OpponentVideoClip) => {
    if (playerRef.current) {
      // No programamos pausa automática por simplicidad, pero el usuario puede verlo
    }
  };

  const allClipsWithUrl = videos.flatMap(v => v.clips.map(c => ({ ...c, videoUrl: v.url })));
  const editingClipExtended = allClipsWithUrl.find(c => c.id === editingClipId);

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (readOnly) {
    return (
      <div className="flex flex-col gap-4 w-full h-full bg-[#111] border border-brand-black-border rounded-xl p-4">
        <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
          <Scissors className="w-3.5 h-3.5 text-brand-red-600" />
          Cortes de Vídeo
        </h4>
        {allClipsWithUrl.length === 0 ? (
          <p className="text-xs text-brand-gray-dark italic">No hay cortes definidos en esta fase.</p>
        ) : (
          <div className="space-y-2 max-h-96 overflow-y-auto no-scrollbar pr-1">
            {allClipsWithUrl.map(clip => (
              <React.Fragment key={clip.id}>
                <div className="flex items-start gap-2 bg-black p-2 rounded-lg border border-brand-black-border/50">
                  <button
                    type="button"
                    onClick={() => setEditingClipId(clip.id)}
                    className="mt-1 relative p-1.5 bg-brand-black-card text-brand-gray-muted hover:text-white rounded transition-colors shrink-0"
                    title="Ver clip anotado"
                  >
                    <Play className="w-3 h-3" />
                    {clip.annotations && clip.annotations.length > 0 && (
                      <span className="absolute -top-1 -right-1 bg-brand-red-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                        {clip.annotations.length}
                      </span>
                    )}
                  </button>

                  <div className="flex-1 flex flex-col px-2 gap-1">
                    <div className="flex justify-between items-center">
                      <span className="text-xs font-semibold text-brand-gray-light">{clip.title}</span>
                      <span className="text-xs text-brand-gray-muted font-mono bg-brand-black-card px-2 py-0.5 rounded">
                        {formatTime(clip.start)} - {formatTime(clip.end)}
                      </span>
                    </div>
                    {clip.description && (
                      <p className="text-[11px] text-brand-gray-muted mt-1 leading-relaxed">{clip.description}</p>
                    )}
                    {clip.board && (
                      <button
                        type="button"
                        onClick={() => setExpandedClipId(expandedClipId === clip.id ? null : clip.id)}
                        className="text-[10px] text-brand-red-600 hover:text-white text-left mt-1"
                      >
                        {expandedClipId === clip.id ? '- Ocultar Campograma' : 'Ver Campograma adjunto'}
                      </button>
                    )}
                  </div>
                </div>

                {expandedClipId === clip.id && (
                  <div className="p-2 bg-brand-black border border-brand-black-border rounded-lg mt-1 mb-3 pointer-events-none opacity-80">
                    <TaskBoardEditor value={clip.board || ''} onChange={() => {}} readOnly={true} />
                  </div>
                )}
              </React.Fragment>
            ))}
          </div>
        )}

        {/* Editor / Visor profesional del clip */}
        {editingClipExtended && (
          <ClipAnnotationEditor
            videoUrl={getValidUrl(editingClipExtended.videoUrl)}
            clip={editingClipExtended}
            allClips={allClipsWithUrl.filter(c => c.videoUrl === editingClipExtended.videoUrl)}
            readOnly={true}
            onSave={() => {}}
            onClose={() => setEditingClipId(null)}
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4 w-full h-full bg-[#111] border border-brand-black-border rounded-xl p-4">
      {/* Añadir Vídeo (solo edición) */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Añadir enlace de YouTube, Vimeo o MP4 (ej. Veo)..."
            className="w-full bg-black border border-brand-black-border rounded-lg pl-9 pr-3 py-2 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
          />
        </div>
        <button type="button" onClick={addVideo} className="btn-primary py-2 px-4 text-xs shrink-0">
          <Plus className="w-4 h-4 mr-1" /> Vídeo
        </button>
      </div>

      {/* Selector de Vídeo Activo */}
      {videos.length > 1 && (
        <div className="flex overflow-x-auto gap-2 no-scrollbar pb-1">
          {videos.map((v, idx) => (
            <button
              type="button"
              key={v.id}
              onClick={() => setActiveVideoId(v.id)}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg whitespace-nowrap transition-colors border ${
                activeVideoId === v.id
                  ? 'bg-brand-red-600/10 border-brand-red-600 text-brand-red-500'
                  : 'bg-black border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light'
              }`}
            >
              Vídeo {idx + 1}
            </button>
          ))}
        </div>
      )}

      {videos.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-brand-gray-muted text-sm border-2 border-dashed border-brand-black-border rounded-lg p-6">
          <Play className="w-8 h-8 mb-2 opacity-50" />
          <p>No hay vídeos para este bloque</p>
        </div>
      ) : activeVideo ? (
        <div className="flex flex-col gap-4">
          {/* Editor/Cabecera del Vídeo Actual */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              value={activeVideo.url}
              onChange={(e) => {
                onChange(videos.map(v => v.id === activeVideoId ? { ...v, url: e.target.value } : v));
              }}
              className="flex-1 bg-black border border-brand-black-border rounded px-2 py-1 text-xs text-brand-gray-light outline-none focus:border-brand-red-600"
              />
              <button type="button" onClick={() => removeVideo(activeVideo.id)} className="text-brand-gray-muted hover:text-brand-red-600 p-1">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

          {/* Reproductor Integrado */}
          <div className="w-full aspect-video bg-black rounded-lg overflow-hidden border border-brand-black-border relative">
            <ReactPlayer
              ref={playerRef}
              src={getValidUrl(activeVideo.url)}
              width="100%"
              height="100%"
              controls={true}
              playing={false}
            />
          </div>

          {/* Gestor de Clips */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="text-xs font-bold text-white flex items-center gap-1.5 uppercase tracking-wider">
                <Scissors className="w-3.5 h-3.5 text-brand-red-600" />
                Cortes de Vídeo
              </h4>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setIsFastClipping(true)} className="flex items-center gap-1 bg-brand-red-600/10 text-xs font-semibold text-brand-red-500 hover:bg-brand-red-600 hover:text-white px-2 py-1 rounded transition-colors">
                  <Zap className="w-3 h-3" /> Extracción Rápida
                </button>
                <button type="button" onClick={addClip} className="text-xs font-semibold text-brand-red-600 hover:text-brand-red-500">
                  + Añadir Corte
                </button>
              </div>
            </div>

            {activeVideo.clips.length === 0 ? (
              <p className="text-xs text-brand-gray-dark italic">No hay cortes definidos.</p>
            ) : (
              <div className="space-y-3 pr-2 overflow-y-auto max-h-48 no-scrollbar">
                {(() => {
                  const groupedClips = activeVideo.clips.reduce((acc, clip) => {
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
                    <div key={label} className="space-y-2 mb-4">
                      <h4 className="text-[10px] font-bold text-brand-red-500 uppercase tracking-wider sticky top-0 bg-[#1a1a1a] py-1 z-10 border-b border-brand-red-600/20">
                        {label} <span className="ml-1 opacity-60 text-brand-gray-muted">({groupedClips[label].length})</span>
                      </h4>
                      {groupedClips[label].map(clip => (
                        <React.Fragment key={clip.id}>
                          <div className="flex items-start gap-2 bg-black p-2 rounded-lg border border-brand-black-border">
                          {/* Reproducir Clip */}
                          <button
                            type="button"
                            onClick={() => playClip(clip)}
                            className="p-1.5 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white rounded transition-colors shrink-0"
                            title="Ir a este momento"
                          >
                            <Play className="w-3 h-3" />
                          </button>

                          {/* Editor profesional del clip (telestración) */}
                          {(!readOnly || (clip.annotations && clip.annotations.length > 0)) && (
                            <button
                              type="button"
                              onClick={() => setEditingClipId(clip.id)}
                              className="mt-1 relative p-1.5 bg-brand-black-card text-brand-gray-muted hover:text-white rounded transition-colors shrink-0"
                              title={readOnly ? 'Ver clip anotado' : 'Editar clip (focos, lupa, jugadores)'}
                            >
                              <Wand2 className="w-3 h-3" />
                              {clip.annotations && clip.annotations.length > 0 && (
                                <span className="absolute -top-1 -right-1 bg-brand-red-600 text-white text-[8px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                                  {clip.annotations.length}
                                </span>
                              )}
                            </button>
                          )}

                          <div className="flex-1 flex flex-col gap-2">
                            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
                              <input
                                type="text"
                                value={clip.title}
                                onChange={(e) => updateClip(clip.id, { title: e.target.value })}
                                className="flex-1 min-w-[80px] w-full sm:w-auto bg-transparent text-xs text-brand-gray-light outline-none placeholder:text-brand-gray-dark"
                                placeholder="Nombre del corte..."
                              />
                              
                              <div className="flex items-center gap-1 shrink-0 bg-brand-black-card rounded p-1 self-start sm:self-auto">
                                <button type="button" onClick={() => captureTime(clip.id, 'start')} className="p-1 hover:text-brand-red-600 text-brand-gray-muted" title="Fijar tiempo actual">
                                  <Clock className="w-3 h-3" />
                                </button>
                                <input
                                  type="number"
                                  value={clip.start}
                                  onChange={(e) => updateClip(clip.id, { start: parseInt(e.target.value) || 0 })}
                                  className="w-10 bg-transparent text-center text-xs text-brand-gray-light outline-none"
                                />
                                <span className="text-brand-gray-dark text-[10px]">-</span>
                                <input
                                  type="number"
                                  value={clip.end}
                                  onChange={(e) => updateClip(clip.id, { end: parseInt(e.target.value) || 0 })}
                                  className="w-10 bg-transparent text-center text-xs text-brand-gray-light outline-none"
                                />
                                <button type="button" onClick={() => captureTime(clip.id, 'end')} className="p-1 hover:text-brand-red-600 text-brand-gray-muted" title="Fijar tiempo actual">
                                  <Clock className="w-3 h-3" />
                                </button>
                              </div>

                              <button type="button" onClick={() => removeClip(clip.id)} className="p-1 text-brand-gray-muted hover:text-brand-red-600 shrink-0 self-start sm:self-auto">
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>

                            <div className="flex flex-col gap-2 border-t border-brand-black-border/50 pt-2 mt-1">
                              <div className="flex items-center gap-2 mb-1">
                                {readOnly ? (
                                  <span className="inline-block text-[10px] bg-brand-red-600/10 text-brand-red-500 border border-brand-red-600/20 px-2 py-0.5 rounded-full font-semibold">
                                    {catLabel(clip.category)}
                                  </span>
                                ) : (
                                  <ClipCategorySelector value={clip.category} onChange={cat => updateClip(clip.id, { category: cat })} />
                                )}
                              </div>
                              <textarea
                                value={clip.description || ''}
                                onChange={(e) => updateClip(clip.id, { description: e.target.value })}
                                placeholder="Comentario del clip..."
                                className="w-full bg-brand-black-card border border-brand-black-border rounded p-1.5 text-[11px] text-brand-gray-light outline-none focus:border-brand-red-600 min-h-[40px] resize-y"
                              />
                              <button
                                type="button"
                                onClick={() => setExpandedClipId(expandedClipId === clip.id ? null : clip.id)}
                                className="text-[10px] font-semibold text-brand-gray-muted hover:text-white self-start"
                              >
                                {expandedClipId === clip.id ? '- Ocultar Campograma' : '+ Añadir/Editar Campograma'}
                              </button>
                            </div>
                          </div>
                          </div>
                          
                          {expandedClipId === clip.id && (
                            <div className="p-2 bg-brand-black border border-brand-black-border rounded-lg mt-1 mb-3">
                              <TaskBoardEditor
                                value={clip.board || ''}
                                onChange={(board) => updateClip(clip.id, { board })}
                                readOnly={readOnly}
                              />
                            </div>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  ));
                })()}
              </div>
            )}
          </div>
        </div>
      ) : null}

      {/* Editor / Visor profesional del clip */}
      {editingClip && activeVideo && (
        <ClipAnnotationEditor
          videoUrl={getValidUrl(activeVideo.url)}
          clip={editingClip}
          allClips={activeVideo.clips}
          readOnly={readOnly}
          onSave={saveClip}
          onClose={() => setEditingClipId(null)}
        />
      )}
      {isFastClipping && activeVideo && (
        <FastClipperModal
          videoUrl={getValidUrl(activeVideo.url)}
          onAddClip={handleFastAddClip}
          onClose={() => setIsFastClipping(false)}
        />
      )}
    </div>
  );
};
