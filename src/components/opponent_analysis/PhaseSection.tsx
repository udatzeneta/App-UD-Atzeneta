import React, { useState } from 'react';
import type { OpponentLibraryVideo, OpponentSubSection, OpponentPhase, OpponentVideoClip } from '../../types';
import { OPPONENT_TAXONOMY, ABP_SIDES, catKey, clipCatKey } from '../../constants/opponentTaxonomy';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { ClipAnnotationEditor } from './ClipAnnotationEditor';
import { allLibraryClips, getValidUrl, formatTime } from '../../utils/opponentVideo';
import { Edit2, Save, X, Play, Scissors, PenSquare, ChevronDown, ChevronUp } from 'lucide-react';

type LibClip = OpponentVideoClip & { videoId: string; videoUrl: string; videoTitle: string };

interface Props {
  phase: OpponentPhase;
  subSections: Record<string, OpponentSubSection>;
  libraryVideos: OpponentLibraryVideo[];
  canEdit: boolean;
  onChange: (subSections: Record<string, OpponentSubSection>) => void;
}

export const PhaseSection: React.FC<Props> = ({ phase, subSections, libraryVideos, canEdit, onChange }) => {
  const def = OPPONENT_TAXONOMY[phase];
  const [side, setSide] = useState<'ofensivo' | 'defensivo'>('ofensivo');
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<OpponentSubSection>({});
  const [expandedBoard, setExpandedBoard] = useState<string | null>(null);
  const [viewingClip, setViewingClip] = useState<LibClip | null>(null);

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
                    <textarea
                      value={draft.description || ''}
                      onChange={e => setDraft({ ...draft, description: e.target.value })}
                      placeholder="Análisis de esta subcategoría..."
                      className="w-full h-24 bg-black border border-brand-black-border rounded-lg p-2.5 text-xs text-brand-gray-light outline-none focus:border-brand-red-600 resize-none"
                    />
                    <div className="bg-black border border-brand-black-border rounded-lg overflow-hidden min-h-[280px]">
                      <TaskBoardEditor value={draft.board || ''} onChange={board => setDraft({ ...draft, board })} limitedTools={true} />
                    </div>
                    <div className="flex items-center gap-2 justify-end">
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
                      <p className="text-xs text-brand-gray-light whitespace-pre-wrap leading-relaxed">{content.description}</p>
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
                            <TaskBoardEditor value={content.board} onChange={() => {}} readOnly={true} limitedTools={true} />
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
                            <button
                              key={clip.id}
                              type="button"
                              onClick={() => setViewingClip(clip)}
                              className="w-full flex items-center gap-2 bg-black border border-brand-black-border rounded-lg p-2 hover:border-brand-red-600/50 transition-colors text-left group"
                            >
                              <span className="relative p-1.5 bg-brand-red-600/10 text-brand-red-500 rounded shrink-0 group-hover:bg-brand-red-600 group-hover:text-white transition-colors">
                                <Play className="w-3 h-3" />
                                {clip.annotations && clip.annotations.length > 0 && (
                                  <span className="absolute -top-1 -right-1 bg-brand-red-600 text-white text-[7px] font-bold rounded-full w-3 h-3 flex items-center justify-center">
                                    {clip.annotations.length}
                                  </span>
                                )}
                              </span>
                              <span className="flex-1 min-w-0 truncate text-[11px] font-medium text-brand-gray-light group-hover:text-white">
                                {clip.title}
                              </span>
                              <span className="text-[9px] text-brand-gray-muted font-mono shrink-0">
                                {formatTime(clip.start)}-{formatTime(clip.end)}
                              </span>
                            </button>
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
    </div>
  );
};
