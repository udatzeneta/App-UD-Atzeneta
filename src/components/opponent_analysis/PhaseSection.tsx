import React, { useState } from 'react';
import type { OpponentLibraryVideo, OpponentSubSection, OpponentPhase, OpponentVideoClip } from '../../types';
import { OPPONENT_TAXONOMY, ABP_SIDES, catKey, clipCatKey } from '../../constants/opponentTaxonomy';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { RichTextEditor } from '../RichTextEditor';
import { ClipAnnotationEditor } from './ClipAnnotationEditor';
import { allLibraryClips, getValidUrl, formatTime } from '../../utils/opponentVideo';
import { Edit2, Save, X, Play, Scissors, PenSquare, ChevronDown, ChevronUp, Trash2 } from 'lucide-react';

type LibClip = OpponentVideoClip & { videoId: string; videoUrl: string; videoTitle: string };

interface Props {
  phase: OpponentPhase;
  subSections: Record<string, OpponentSubSection>;
  libraryVideos: OpponentLibraryVideo[];
  canEdit: boolean;
  onChange: (subSections: Record<string, OpponentSubSection>) => void;
  onUpdateLibraryVideos?: (videos: OpponentLibraryVideo[]) => void;
}

export const PhaseSection: React.FC<Props> = ({ phase, subSections, libraryVideos, canEdit, onChange, onUpdateLibraryVideos }) => {
  const def = OPPONENT_TAXONOMY[phase];
  const [side, setSide] = useState<'ofensivo' | 'defensivo'>('ofensivo');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<OpponentSubSection>({});
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);
  const [viewingClip, setViewingClip] = useState<LibClip | null>(null);
  const [isEditingBoardModalOpen, setIsEditingBoardModalOpen] = useState(false);

  const activeSide = def.hasSides ? side : undefined;
  const allClips = allLibraryClips(libraryVideos);

  const clipsForKey = (key: string): LibClip[] => allClips.filter(c => clipCatKey(c.category) === key);

  const startEdit = (key: string) => {
    setDraft(subSections[key] || {});
    setEditingKey(key);
  };

  const saveEdit = (key: string) => {
    onChange({ ...subSections, [key]: draft });
    setEditingKey(null);
  };

  const renameClip = (clip: LibClip, newTitle: string) => {
    if (!onUpdateLibraryVideos) return;
    const newVideos = libraryVideos.map(v => {
      if (v.id !== clip.videoId) return v;
      return {
        ...v,
        clips: v.clips.map(c => c.id === clip.id ? { ...c, title: newTitle } : c)
      };
    });
    onUpdateLibraryVideos(newVideos);
  };

  const deleteClip = (clip: LibClip) => {
    if (!onUpdateLibraryVideos) return;
    if (!confirm('¿Estás seguro de que deseas eliminar este clip?')) return;
    const newVideos = libraryVideos.map(v => {
      if (v.id !== clip.videoId) return v;
      return {
        ...v,
        clips: v.clips.filter(c => c.id !== clip.id)
      };
    });
    onUpdateLibraryVideos(newVideos);
  };

  // Nº total de clips catalogados en toda la fase (para el contador del encabezado).
  const phaseClipCount = allClips.filter(c => c.category?.phase === phase).length;

  return (
    <div className="mb-14">
      {/* Encabezado de fase */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-brand-red-600/30 pb-3 mb-6">
        <div className="flex items-center gap-3">
          <h2 className="text-xl font-bold text-brand-red-500 uppercase tracking-wider">{def.label}</h2>
          <span className="text-[11px] font-semibold text-brand-gray-muted bg-black border border-brand-black-border px-2.5 py-1 rounded-full flex items-center gap-1.5">
            <Scissors className="w-3 h-3 text-brand-red-600" /> {phaseClipCount} clip{phaseClipCount === 1 ? '' : 's'}
          </span>
        </div>

        {def.hasSides && (
          <div className="flex items-center bg-black border border-brand-black-border rounded-lg p-1">
            {ABP_SIDES.map(s => (
              <button
                key={s.key}
                type="button"
                onClick={() => setSide(s.key)}
                className={`px-3 py-1.5 text-xs font-bold rounded-md transition-colors ${
                  side === s.key ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Subcategorías */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {def.subs.map(sub => {
          const key = catKey(phase, sub.key, activeSide);
          const content = subSections[key] || {};
          const clips = clipsForKey(key);
          const isEditing = editingKey === key;

          return (
            <div key={key} className="bg-brand-black-card border border-brand-black-border rounded-xl overflow-hidden flex flex-col">
              {/* Cabecera subcategoría */}
              <div className="bg-brand-black px-4 py-3 border-b border-brand-black-border flex items-center justify-between gap-2">
                <h4 className="text-sm font-bold text-brand-gray-light">{sub.label}</h4>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-[10px] text-brand-gray-muted bg-black px-1.5 py-0.5 rounded font-mono">{clips.length}</span>
                  {canEdit && !isEditing && (
                    <button type="button" onClick={() => startEdit(key)} className="p-1 text-brand-gray-muted hover:text-white" title="Editar">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              <div className="p-4 flex flex-col gap-3 flex-1">
                {isEditing ? (
                  <>
                    <RichTextEditor
                      value={draft.description || ''}
                      onChange={val => setDraft({ ...draft, description: val })}
                      placeholder="Análisis de esta subcategoría..."
                      className="w-full mb-3"
                    />
                    
                    <div className="flex flex-col gap-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-brand-gray-muted uppercase">Campograma</span>
                        {draft.board && (
                          <button
                            type="button"
                            onClick={() => setDraft({ ...draft, board: undefined })}
                            className="text-[10px] font-bold text-brand-red-600 hover:text-brand-red-400 flex items-center gap-1"
                          >
                            <Trash2 className="w-3 h-3" /> Eliminar
                          </button>
                        )}
                      </div>
                      <div className="relative bg-black border border-brand-black-border rounded-lg overflow-hidden h-32 flex items-center justify-center cursor-pointer group" onClick={() => setIsEditingBoardModalOpen(true)}>
                         {draft.board ? (
                           <div className="absolute inset-0 opacity-40 group-hover:opacity-20 transition-opacity">
                             <TaskBoardEditor value={draft.board} onChange={() => {}} readOnly hideToolbar />
                           </div>
                         ) : (
                           <span className="text-xs text-brand-gray-dark italic relative z-10">Sin campograma</span>
                         )}
                         <button type="button" className="absolute z-20 btn-secondary py-1.5 px-3 text-xs opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1.5">
                           <Edit2 className="w-3.5 h-3.5" /> {draft.board ? 'Editar campograma' : 'Crear campograma'}
                         </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 justify-end mt-2">
                      <button type="button" onClick={() => setEditingKey(null)} className="btn-secondary py-1.5 text-xs px-3">
                        <X className="w-3.5 h-3.5 mr-1" /> Cancelar
                      </button>
                      <button type="button" onClick={() => saveEdit(key)} className="btn-primary py-1.5 text-xs px-3">
                        <Save className="w-3.5 h-3.5 mr-1" /> Guardar
                      </button>
                    </div>
                  </>
                ) : (
                  <>
                    {content.description ? (
                      <div className="rich-text text-xs text-brand-gray-light" dangerouslySetInnerHTML={{ __html: content.description }} />
                    ) : (
                      <p className="text-xs text-brand-gray-dark italic">Sin descripción.</p>
                    )}

                    {content.board && (
                      <div>
                        <button
                          type="button"
                          onClick={() => setExpandedBoard(expandedBoard === key ? null : key)}
                          className="text-[11px] font-semibold text-brand-red-600 hover:text-brand-red-500 flex items-center gap-1"
                        >
                          <PenSquare className="w-3 h-3" />
                          {expandedBoard === key ? 'Ocultar campograma' : 'Ver campograma'}
                          {expandedBoard === key ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                        </button>
                        {expandedBoard === key && (
                          <div className="mt-2 bg-black border border-brand-black-border rounded-lg overflow-hidden min-h-[280px]">
                            <TaskBoardEditor value={content.board} onChange={() => {}} readOnly={true} hideToolbar={true} limitedTools={true} />
                          </div>
                        )}
                      </div>
                    )}

                    {/* Clips catalogados */}
                    <div className="mt-1 border-t border-brand-black-border/60 pt-3">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-1.5 mb-2">
                        <Scissors className="w-3 h-3 text-brand-red-600" /> Clips
                      </span>
                      {clips.length === 0 ? (
                        <p className="text-[11px] text-brand-gray-dark italic">Sin clips catalogados. Añádelos desde la Videoteca.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {clips.map(clip => (
                            <div
                              key={clip.id}
                              className="w-full flex items-center gap-2 bg-black border border-brand-black-border rounded-lg p-2 hover:border-brand-red-600/50 transition-colors group"
                            >
                              <button
                                type="button"
                                onClick={() => setViewingClip(clip)}
                                className="relative p-1.5 bg-brand-red-600/10 text-brand-red-500 rounded shrink-0 hover:bg-brand-red-600 hover:text-white transition-colors"
                                title="Reproducir clip"
                              >
                                <Play className="w-3 h-3" />
                                {clip.annotations && clip.annotations.length > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-brand-red-600 text-white text-[7px] font-bold rounded-full w-3 h-3 flex items-center justify-center">
                                    {clip.annotations.length}
                                  </span>
                                )}
                              </button>
                              
                              {canEdit ? (
                                <input
                                  type="text"
                                  value={clip.title}
                                  onChange={(e) => renameClip(clip, e.target.value)}
                                  className="flex-1 min-w-0 bg-transparent text-[11px] font-medium text-brand-gray-light hover:text-white focus:text-white outline-none border-b border-transparent focus:border-brand-red-600/50"
                                  placeholder="Nombre del clip..."
                                />
                              ) : (
                                <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-brand-gray-light">
                                  {clip.title}
                                </span>
                              )}

                              <span className="text-[9px] text-brand-gray-muted font-mono shrink-0">
                                {formatTime(clip.start)}-{formatTime(clip.end)}
                              </span>
                              
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={() => deleteClip(clip)}
                                  className="p-1.5 text-brand-gray-muted hover:text-brand-red-500 rounded shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
                                  title="Eliminar clip"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Visor de clip (solo lectura) */}
      {viewingClip && (
        <ClipAnnotationEditor
          videoUrl={getValidUrl(viewingClip.videoUrl)}
          clip={viewingClip}
          readOnly={true}
          onSave={() => {}}
          onClose={() => setViewingClip(null)}
        />
      )}

      {/* Modal para editar el campograma a pantalla completa */}
      {isEditingBoardModalOpen && editingKey && (
        <div className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-8 bg-black/80 backdrop-blur-sm">
          <div className="bg-brand-black-card border border-brand-black-border rounded-2xl shadow-2xl flex flex-col w-full h-[90vh] max-w-7xl animate-scale-in">
            <div className="flex items-center justify-between px-6 py-4 border-b border-brand-black-border shrink-0">
              <h3 className="text-lg font-bold text-white uppercase tracking-wider flex items-center gap-2">
                <PenSquare className="w-5 h-5 text-brand-red-500" /> Editor de Campograma
              </h3>
              <button onClick={() => setIsEditingBoardModalOpen(false)} className="p-2 text-brand-gray-muted hover:text-white rounded-lg hover:bg-brand-black transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 min-h-0 p-4 sm:p-6 bg-black/30 overflow-hidden flex flex-col">
              <TaskBoardEditor 
                value={draft.board || ''} 
                onChange={board => setDraft({ ...draft, board })} 
                limitedTools={false} 
              />
            </div>
            <div className="px-6 py-4 border-t border-brand-black-border flex justify-end shrink-0 bg-brand-black-card">
              <button type="button" onClick={() => setIsEditingBoardModalOpen(false)} className="btn-primary py-2 px-8 font-bold tracking-wide">
                <Save className="w-4 h-4 mr-2" /> Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
