import React, { useState } from 'react';
import { OpponentVideo, OpponentVideoClip } from '../../types';
import { Plus, Trash2, Link, Play, Edit2, Check, X } from 'lucide-react';

interface Props {
  videos: OpponentVideo[];
  onChange: (v: OpponentVideo[]) => void;
}

export const OpponentVideoManager: React.FC<Props> = ({ videos, onChange }) => {
  const [newUrl, setNewUrl] = useState('');

  const addVideo = () => {
    if (!newUrl.trim()) return;
    const newVideo: OpponentVideo = {
      id: `vid-${Date.now()}`,
      url: newUrl.trim(),
      clips: []
    };
    onChange([...videos, newVideo]);
    setNewUrl('');
  };

  const removeVideo = (id: string) => {
    onChange(videos.filter(v => v.id !== id));
  };

  const updateVideoUrl = (id: string, url: string) => {
    onChange(videos.map(v => v.id === id ? { ...v, url } : v));
  };

  const addClip = (videoId: string) => {
    const newClip: OpponentVideoClip = {
      id: `clip-${Date.now()}`,
      title: 'Nuevo Clip',
      start: '00:00',
      end: '00:00'
    };
    onChange(videos.map(v => v.id === videoId ? { ...v, clips: [...v.clips, newClip] } : v));
  };

  const updateClip = (videoId: string, clipId: string, updates: Partial<OpponentVideoClip>) => {
    onChange(videos.map(v => v.id === videoId ? {
      ...v,
      clips: v.clips.map(c => c.id === clipId ? { ...c, ...updates } : c)
    } : v));
  };

  const removeClip = (videoId: string, clipId: string) => {
    onChange(videos.map(v => v.id === videoId ? {
      ...v,
      clips: v.clips.filter(c => c.id !== clipId)
    } : v));
  };

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Link className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
          <input
            type="text"
            value={newUrl}
            onChange={(e) => setNewUrl(e.target.value)}
            placeholder="Pegar enlace de YouTube o Vimeo..."
            className="w-full bg-brand-black border border-brand-black-border rounded-lg pl-9 pr-3 py-2 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
          />
        </div>
        <button
          onClick={addVideo}
          className="btn-primary py-2 px-4 text-xs flex-shrink-0"
        >
          <Plus className="w-4 h-4 mr-1" />
          Añadir Vídeo
        </button>
      </div>

      <div className="flex-1 overflow-y-auto space-y-4 no-scrollbar pr-2">
        {videos.length === 0 ? (
          <div className="text-center py-10 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-lg">
            No hay vídeos añadidos para esta fase.
          </div>
        ) : (
          videos.map(video => (
            <div key={video.id} className="bg-brand-black border border-brand-black-border rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <input
                  type="text"
                  value={video.url}
                  onChange={(e) => updateVideoUrl(video.id, e.target.value)}
                  className="flex-1 bg-transparent border-b border-transparent hover:border-brand-black-border focus:border-brand-red-600 px-1 py-0.5 text-sm text-brand-gray-light outline-none"
                  placeholder="URL del vídeo"
                />
                <button onClick={() => removeVideo(video.id)} className="text-brand-gray-muted hover:text-brand-red-600 transition-colors p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider">Clips Destacados</h4>
                  <button onClick={() => addClip(video.id)} className="text-xs text-brand-red-600 hover:text-brand-red-500 font-semibold flex items-center gap-1">
                    <Plus className="w-3 h-3" /> Añadir Clip
                  </button>
                </div>
                
                {video.clips.length === 0 ? (
                  <p className="text-xs text-brand-gray-dark italic">Sin clips definidos.</p>
                ) : (
                  <div className="space-y-2">
                    {video.clips.map(clip => (
                      <div key={clip.id} className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-[#1a1a1a] p-2 rounded border border-brand-black-border">
                        <input
                          type="text"
                          value={clip.title}
                          onChange={(e) => updateClip(video.id, clip.id, { title: e.target.value })}
                          className="flex-1 bg-transparent text-xs text-brand-gray-light outline-none min-w-[120px]"
                          placeholder="Nombre del clip..."
                        />
                        <div className="flex items-center gap-1 shrink-0">
                          <input
                            type="text"
                            value={clip.start}
                            onChange={(e) => updateClip(video.id, clip.id, { start: e.target.value })}
                            className="w-12 bg-black border border-brand-black-border rounded text-center text-xs py-1 outline-none focus:border-brand-red-600"
                            placeholder="00:00"
                          />
                          <span className="text-brand-gray-muted text-xs">-</span>
                          <input
                            type="text"
                            value={clip.end}
                            onChange={(e) => updateClip(video.id, clip.id, { end: e.target.value })}
                            className="w-12 bg-black border border-brand-black-border rounded text-center text-xs py-1 outline-none focus:border-brand-red-600"
                            placeholder="00:00"
                          />
                        </div>
                        <div className="flex gap-1 shrink-0">
                          {video.url && (
                            <a
                              href={video.url}
                              target="_blank"
                              rel="noreferrer"
                              className="p-1.5 bg-brand-black hover:bg-brand-red-600 hover:text-white text-brand-gray-muted rounded transition-colors"
                              title="Reproducir"
                            >
                              <Play className="w-3 h-3" />
                            </a>
                          )}
                          <button
                            onClick={() => removeClip(video.id, clip.id)}
                            className="p-1.5 bg-brand-black hover:bg-brand-black-hover text-brand-gray-muted hover:text-brand-red-600 rounded transition-colors"
                            title="Eliminar Clip"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
