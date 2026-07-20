import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { OpponentAnalysis, OpponentAnalysisBlock, OpponentRosterPlayer } from '../types';
import { ArrowLeft, ShieldAlert, Award, FileText, Settings as TacticalIcon, Edit2, Save, X, Play, Link } from 'lucide-react';
import { TaskBoardEditor } from '../components/TaskBoardEditor';
import { OpponentVideoClipper } from '../components/opponent_analysis/OpponentVideoClipper';
import { OpponentRosterManager } from '../components/opponent_analysis/OpponentRosterManager';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';

export const OpponentAnalysisMural: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const canEdit = hasPermission('opponent_analysis', 'editar');

  const { data: analysisList = [], isLoading } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis()
  });

  const analysis = analysisList.find(a => a.id === id);

  const allMatchVideos = React.useMemo(() => {
    if (!analysis) return [];
    const videos = [
      ...(analysis.with_ball_blocks?.flatMap(b => b.videos || []) || []),
      ...(analysis.without_ball_blocks?.flatMap(b => b.videos || []) || []),
      ...(analysis.abp_blocks?.flatMap(b => b.videos || []) || [])
    ];
    // Remove duplicates based on URL
    return videos.filter((v, i, a) => a.findIndex(t => t.url === v.url) === i);
  }, [analysis]);

  type BlockKey = 'general' | 'roster' | 'with_ball' | 'without_ball' | 'abp' | null;
  const [editingBlock, setEditingBlock] = useState<BlockKey>(null);
  const [editData, setEditData] = useState<Partial<OpponentAnalysis>>({});

  // Local state for 'general' block
  const [strengthsText, setStrengthsText] = useState('');
  const [weaknessesText, setWeaknessesText] = useState('');
  const [keyPlayersText, setKeyPlayersText] = useState('');

  const updateMutation = useMutation({
    mutationFn: (item: Partial<OpponentAnalysis>) => dataService.updateOpponentAnalysis(id!, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] });
      showToast('success', 'Guardado', 'Los cambios se han guardado correctamente.');
      setEditingBlock(null);
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

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

  const startEditingGeneral = () => {
    setEditData(analysis);
    setStrengthsText((analysis.strengths || []).join(', '));
    setWeaknessesText((analysis.weaknesses || []).join(', '));
    setKeyPlayersText((analysis.key_players || []).join(', '));
    setEditingBlock('general');
  };

  const saveGeneral = () => {
    updateMutation.mutate({
      general_board: editData.general_board,
      observations: editData.observations,
      strengths: strengthsText.split(',').map(s => s.trim()).filter(Boolean),
      weaknesses: weaknessesText.split(',').map(s => s.trim()).filter(Boolean),
      key_players: keyPlayersText.split(',').map(s => s.trim()).filter(Boolean),
    });
  };

  const renderSectionHeader = (title: string, blockKey: NonNullable<BlockKey>) => (
    <div className="flex justify-between items-end border-b border-brand-red-600/30 pb-2 mb-6">
      <h2 className="text-xl font-bold text-brand-red-500 uppercase tracking-wider mb-0 border-none pb-0">
        {title}
      </h2>
      {canEdit && editingBlock !== blockKey && (
        <button 
          onClick={() => {
            if (blockKey === 'general') {
              startEditingGeneral();
            } else {
              setEditData(analysis);
              setEditingBlock(blockKey);
            }
          }}
          className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors"
        >
          <Edit2 className="w-3 h-3" /> Editar
        </button>
      )}
      {editingBlock === blockKey && (
        <div className="flex items-center gap-2">
          <button onClick={() => setEditingBlock(null)} className="btn-secondary py-1.5 text-xs px-3">
            <X className="w-3.5 h-3.5 mr-1" /> Cancelar
          </button>
          <button 
            onClick={() => {
              if (blockKey === 'general') saveGeneral();
              else updateMutation.mutate(editData);
            }}
            className="btn-primary py-1.5 text-xs px-3"
            disabled={updateMutation.isPending}
          >
            <Save className="w-3.5 h-3.5 mr-1" /> {updateMutation.isPending ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      )}
    </div>
  );

  const renderPhase = (title: string, blocksKey: 'with_ball_blocks' | 'without_ball_blocks' | 'abp_blocks', blockKey: NonNullable<BlockKey>) => {
    const blocks = analysis[blocksKey] || [];
    const isEditing = editingBlock === blockKey;
    
    const block = blocks[0] || {
      id: `phase-${Date.now()}`,
      title: title,
      description: '',
      board: '',
      videos: []
    };
    
    if (!isEditing && !block.description && !block.board && (!block.videos || block.videos.length === 0)) {
      return (
        <div className="mb-12">
          {renderSectionHeader(title, blockKey)}
          <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">
            Esta fase no tiene datos definidos.
          </div>
        </div>
      );
    }

    const currentBlock = isEditing ? (editData[blocksKey]?.[0] || block) : block;

    const updateBlock = (updates: Partial<OpponentAnalysisBlock>) => {
      setEditData({ ...editData, [blocksKey]: [{ ...currentBlock, ...updates }] });
    };

    return (
      <div className="mb-12">
        {renderSectionHeader(title, blockKey)}
        
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium">
          {isEditing ? (
            <div className="space-y-6">
              <div>
                <label className="form-label">Comentario general de esta parte del juego</label>
                <textarea
                  className="form-input h-24 resize-none"
                  placeholder="Añade un breve resumen general..."
                  value={currentBlock.description}
                  onChange={(e) => updateBlock({ description: e.target.value })}
                />
              </div>

              <div>
                <label className="form-label">Campograma General de la fase (Opcional)</label>
                <div className="p-2 bg-brand-black border border-brand-black-border rounded-lg">
                  <TaskBoardEditor
                    value={currentBlock.board}
                    onChange={(board) => updateBlock({ board })}
                  />
                </div>
              </div>

              <div>
                <label className="form-label">Clips de Vídeo</label>
                <div className="p-4 bg-brand-black-card border border-brand-black-border rounded-xl">
                  <OpponentVideoClipper
                    videos={currentBlock.videos}
                    onChange={(videos) => updateBlock({ videos })}
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              {currentBlock.description && (
                <div className="mb-6 bg-brand-black p-4 rounded-lg border border-brand-black-border text-sm text-brand-gray-light whitespace-pre-wrap leading-relaxed">
                  {currentBlock.description}
                </div>
              )}

              <div className={`grid grid-cols-1 ${currentBlock.board && currentBlock.videos?.length ? 'xl:grid-cols-2' : ''} gap-6`}>
                {currentBlock.videos && currentBlock.videos.length > 0 && (
                  <div className="flex flex-col gap-6">
                    <OpponentVideoClipper videos={currentBlock.videos} onChange={() => {}} readOnly={true} />
                  </div>
                )}
                
                {currentBlock.board && (
                  <div className="bg-black border border-brand-black-border rounded-lg overflow-hidden min-h-[400px]">
                    <TaskBoardEditor value={currentBlock.board} onChange={() => {}} readOnly={true} limitedTools={true} />
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 max-w-[1600px] mx-auto pb-12">
      {/* Botón Volver */}
      <button 
        onClick={() => navigate('/opponent-analysis')}
        className="flex items-center gap-2 text-sm text-brand-gray-muted hover:text-white transition-colors"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al panel de análisis
      </button>

      {/* Cabecera del Mural */}
      <div className="bg-gradient-to-r from-brand-black to-brand-black-card border border-brand-black-border rounded-2xl p-8 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <h1 className="text-4xl font-black text-white mb-2">{analysis.opponent}</h1>
            <p className="text-brand-gray-muted text-lg">Mural de Análisis Táctico</p>
          </div>
          <div className="bg-brand-black border border-brand-black-border px-4 py-2 rounded-xl flex items-center gap-3">
            <TacticalIcon className="w-5 h-5 text-brand-red-600" />
            <span className="text-sm font-bold text-brand-gray-light">Sistema: {analysis.tactical_system}</span>
          </div>
        </div>
      </div>

      {/* 1. Aspectos Generales */}
      <div className="mb-12">
        {renderSectionHeader('Aspectos Generales', 'general')}
        
        {editingBlock === 'general' ? (
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2">
                <label className="form-label">Alineación / Campograma General</label>
                <div className="p-2 bg-brand-black border border-brand-black-border rounded-lg">
                  <TaskBoardEditor
                    value={editData.general_board || ''}
                    onChange={(board) => setEditData({ ...editData, general_board: board })}
                  />
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="form-label flex items-center gap-2"><TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistema Táctico</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editData.tactical_system || ''}
                    onChange={e => setEditData({ ...editData, tactical_system: e.target.value })}
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas (separadas por comas)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={strengthsText}
                    onChange={e => setStrengthsText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades (separadas por comas)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={weaknessesText}
                    onChange={e => setWeaknessesText(e.target.value)}
                  />
                </div>
                <div>
                  <label className="form-label flex items-center gap-2"><Award className="w-4 h-4 text-emerald-500" /> Jugadores Clave (separados por comas)</label>
                  <input
                    type="text"
                    className="form-input"
                    value={keyPlayersText}
                    onChange={e => setKeyPlayersText(e.target.value)}
                  />
                </div>
              </div>
            </div>
            <div>
              <label className="form-label flex items-center gap-2"><FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones Generales</label>
              <textarea
                className="form-input h-28 resize-none"
                value={editData.observations || ''}
                onChange={e => setEditData({ ...editData, observations: e.target.value })}
              />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Campograma General (Alineación) */}
            <div className="lg:col-span-2 bg-brand-black-card border border-brand-black-border rounded-xl overflow-hidden min-h-[450px]">
              {analysis.general_board ? (
                <TaskBoardEditor value={analysis.general_board} onChange={() => {}} readOnly={true} limitedTools={true} />
              ) : (
                <div className="flex items-center justify-center h-full text-brand-gray-muted text-sm italic">
                  Alineación / Campograma no definido
                </div>
              )}
            </div>
            
            {/* Puntos Fuertes, Débiles y Observaciones */}
            <div className="lg:col-span-1 flex flex-col gap-6">
              <div className="bg-brand-black border border-brand-black-border rounded-xl p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.strengths.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguna</span> : analysis.strengths.map((s, i) => (
                    <span key={i} className="text-[11px] bg-red-950/20 text-brand-red-500 border border-brand-red-600/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                  ))}
                </div>
              </div>

              <div className="bg-brand-black border border-brand-black-border rounded-xl p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
                  <ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.weaknesses.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguna</span> : analysis.weaknesses.map((s, i) => (
                    <span key={i} className="text-[11px] bg-amber-950/20 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                  ))}
                </div>
              </div>
              
              <div className="bg-brand-black border border-brand-black-border rounded-xl p-5">
                <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
                  <Award className="w-4 h-4 text-emerald-500" /> Jugadores Clave (Etiquetas)
                </h4>
                <div className="flex flex-wrap gap-2">
                  {analysis.key_players.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguno</span> : analysis.key_players.map((s, i) => (
                    <span key={i} className="text-[11px] bg-emerald-950/20 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                  ))}
                </div>
              </div>
              
              {!editingBlock && analysis.observations && (
                <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 mt-auto">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
                    <FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones
                  </h4>
                  <p className="text-sm text-brand-gray-light whitespace-pre-wrap leading-relaxed">{analysis.observations}</p>
                </div>
              )}
              
              {/* Partidos Completos / Vídeos */}
              {allMatchVideos.length > 0 && (
                <div className="bg-brand-black border border-brand-black-border rounded-xl p-5">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
                    <Play className="w-4 h-4 text-brand-red-600" /> Partidos Completos
                  </h4>
                  <div className="flex flex-col gap-2">
                    {allMatchVideos.map((v, i) => (
                      <a 
                        key={i} 
                        href={v.url} 
                        target="_blank" 
                        rel="noreferrer" 
                        className="flex items-center gap-2 text-xs bg-brand-black-card border border-brand-black-border p-2.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors group"
                      >
                        <Link className="w-3.5 h-3.5 text-brand-gray-muted group-hover:text-brand-red-500" />
                        <span className="truncate flex-1 font-medium text-brand-gray-light group-hover:text-white">Vídeo Completo {i + 1}</span>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 2. Jugadores Destacados y Resumen */}
      <div className="mb-12">
        {renderSectionHeader('Jugadores Destacados', 'roster')}
        {editingBlock === 'roster' ? (
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium h-[600px]">
            <OpponentRosterManager 
              players={editData.roster_comments || []} 
              onChange={(players) => setEditData({ ...editData, roster_comments: players })} 
              opponentName={analysis.opponent}
            />
          </div>
        ) : (
          (!analysis.roster_comments || analysis.roster_comments.length === 0) ? (
            <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">
              No hay jugadores destacados.
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {analysis.roster_comments.map(player => (
                <div key={player.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col gap-2">
                  <div className="flex items-center gap-3 border-b border-brand-black-border pb-2">
                    <div className="shrink-0 w-10 h-10 rounded-full bg-brand-black-card border border-brand-black-border flex items-center justify-center overflow-hidden">
                      {player.photo_url ? (
                        <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-red-600/10 text-brand-red-500 font-bold flex items-center justify-center text-xs">
                          {player.number || '-'}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <h5 className="text-sm font-bold text-white">{player.name}</h5>
                      <div className="flex gap-2 items-center mt-1">
                        {player.photo_url && player.number && (
                          <span className="text-[10px] text-brand-red-500 font-bold bg-brand-red-600/10 px-1.5 py-0.5 rounded">
                            Nº {player.number}
                          </span>
                        )}
                        <span className="text-[10px] text-brand-gray-muted font-mono uppercase bg-black px-1.5 py-0.5 rounded">
                          {player.position || 'N/A'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-brand-gray-light whitespace-pre-wrap leading-relaxed flex-1 pt-1">
                    {player.comments || <span className="italic text-brand-gray-dark">Sin comentarios adicionales.</span>}
                  </p>
                </div>
              ))}
            </div>
          )
        )}
      </div>

      {/* 3, 4 y 5. Fases de Juego */}
      <div className="mt-12">
        {renderPhase('Fase Ofensiva (Con Balón)', 'with_ball_blocks', 'with_ball')}
        {renderPhase('Fase Defensiva (Sin Balón)', 'without_ball_blocks', 'without_ball')}
        {renderPhase('Acciones a Balón Parado (ABP)', 'abp_blocks', 'abp')}
      </div>
    </div>
  );
};
