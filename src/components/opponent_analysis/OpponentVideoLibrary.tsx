import React, { useState } from 'react';
import type { OpponentLibraryVideo } from '../../types';
import { LibraryVideoStudio } from './LibraryVideoStudio';
import { detectVideoProvider, defaultVideoTitle, resolveVeoUrl } from '../../utils/opponentVideo';
import {
  Plus, Link as LinkIcon, Film, Play, Trash2, Scissors, MonitorPlay, AlertTriangle, Video,
} from 'lucide-react';

interface Props {
  videos: OpponentLibraryVideo[];
  onChange: (videos: OpponentLibraryVideo[]) => void;
  canEdit: boolean;
}

const providerBadge = (provider?: string) => {
  switch (provider) {
    case 'youtube': return { label: 'YouTube', icon: MonitorPlay, cls: 'text-red-500' };
    case 'vimeo': return { label: 'Vimeo', icon: Video, cls: 'text-sky-400' };
    case 'direct': return { label: 'MP4', icon: Film, cls: 'text-emerald-400' };
    default: return { label: 'Embed', icon: LinkIcon, cls: 'text-amber-400' };
  }
};

// Videoteca central del rival: guarda vídeos de cualquier plataforma y abre
// el estudio para crear/catalogar clips.
export const OpponentVideoLibrary: React.FC<Props> = ({ videos, onChange, canEdit }) => {
  const [newUrl, setNewUrl] = useState('');
  const [openVideoId, setOpenVideoId] = useState<string | null>(null);

  const openVideo = videos.find(v => v.id === openVideoId) || null;

  const addVideo = async () => {
    const url = newUrl.trim();
    if (!url) return;
    
    const resolvedUrl = await resolveVeoUrl(url);
    const { provider, clippable } = detectVideoProvider(resolvedUrl);
    
    const newVideo: OpponentLibraryVideo = {
      id: `libvid-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      url: resolvedUrl,
      title: defaultVideoTitle(provider, videos.length),
      provider,
      clippable,
      added_at: new Date().toISOString(),
      clips: [],
    };
    onChange([...videos, newVideo]);
    setNewUrl('');
    setOpenVideoId(newVideo.id);
  };

  const updateVideo = (updated: OpponentLibraryVideo) => {
    onChange(videos.map(v => (v.id === updated.id ? updated : v)));
  };

  const removeVideo = (id: string) => {
    if (!window.confirm('¿Eliminar este vídeo y todos sus cortes de la videoteca?')) return;
    onChange(videos.filter(v => v.id !== id));
  };

  return (
    <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-4 shadow-premium">
      <div className="flex items-center gap-2 mb-4">
        <Film className="w-5 h-5 text-brand-red-600" />
        <h3 className="text-sm font-bold text-white uppercase tracking-wider">Videoteca</h3>
        <span className="text-[10px] text-brand-gray-muted bg-black px-2 py-0.5 rounded-full ml-auto">
          {videos.length} vídeo{videos.length === 1 ? '' : 's'}
        </span>
      </div>

      {canEdit && (
        <div className="flex gap-2 mb-4">
          <div className="relative flex-1">
            <LinkIcon className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
            <input
              type="text"
              value={newUrl}
              onChange={e => setNewUrl(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') addVideo(); }}
              placeholder="Pega un enlace (YouTube, Vimeo, MP4, Veo...)"
              className="w-full bg-black border border-brand-black-border rounded-lg pl-9 pr-3 py-2 text-xs text-brand-gray-light focus:border-brand-red-600 outline-none"
            />
          </div>
          <button type="button" onClick={addVideo} className="btn-primary py-2 px-3 text-xs shrink-0">
            <Plus className="w-4 h-4" />
          </button>
        </div>
      )}

      {videos.length === 0 ? (
        <div className="text-center py-10 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">
          <Film className="w-7 h-7 mx-auto mb-2 opacity-40" />
          Sin vídeos.<br />
          {canEdit ? 'Añade el primero pegando un enlace.' : 'Aún no se han añadido vídeos.'}
        </div>
      ) : (
        <div className="space-y-2.5 max-h-[70vh] overflow-y-auto no-scrollbar pr-0.5">
          {videos.map(v => {
            const badge = providerBadge(v.provider);
            const BadgeIcon = badge.icon;
            return (
              <div
                key={v.id}
                className="group bg-black border border-brand-black-border rounded-xl p-3 hover:border-brand-red-600/50 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <button
                    type="button"
                    onClick={() => setOpenVideoId(v.id)}
                    className="relative w-14 h-14 shrink-0 rounded-lg bg-brand-black-card border border-brand-black-border flex items-center justify-center text-brand-gray-muted hover:text-white hover:border-brand-red-600 transition-colors"
                    title="Abrir estudio"
                  >
                    <Play className="w-5 h-5" />
                  </button>
                  <div className="flex-1 min-w-0">
                    <button
                      type="button"
                      onClick={() => setOpenVideoId(v.id)}
                      className="text-sm font-semibold text-brand-gray-light hover:text-white text-left truncate block w-full"
                    >
                      {v.title}
                    </button>
                    <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                      <span className={`text-[10px] font-bold flex items-center gap-1 ${badge.cls}`}>
                        <BadgeIcon className="w-3 h-3" /> {badge.label}
                      </span>
                      {v.clippable ? (
                        <span className="text-[10px] text-brand-gray-muted flex items-center gap-1">
                          <Scissors className="w-3 h-3" /> {v.clips.length} corte{v.clips.length === 1 ? '' : 's'}
                        </span>
                      ) : (
                        <span className="text-[10px] text-amber-400/80 flex items-center gap-1" title="Este proveedor no permite recortar">
                          <AlertTriangle className="w-3 h-3" /> No recortable
                        </span>
                      )}
                    </div>
                  </div>
                  {canEdit && (
                    <button
                      type="button"
                      onClick={() => removeVideo(v.id)}
                      className="p-1 text-brand-gray-muted hover:text-brand-red-600 opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                      title="Eliminar vídeo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {openVideo && (
        <LibraryVideoStudio
          video={openVideo}
          onChange={updateVideo}
          onClose={() => setOpenVideoId(null)}
          readOnly={!canEdit}
        />
      )}
    </div>
  );
};
