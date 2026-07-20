import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { OpponentAnalysis, OpponentAnalysisBlock } from '../types';
import { ArrowLeft, ShieldAlert, Award, FileText, Settings as TacticalIcon } from 'lucide-react';
import { TaskBoardEditor } from '../components/TaskBoardEditor';
import { OpponentVideoClipper } from '../components/opponent_analysis/OpponentVideoClipper';

export const OpponentAnalysisMural: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: analysisList = [], isLoading } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis()
  });

  const analysis = analysisList.find(a => a.id === id);

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

  const renderBlocks = (title: string, blocks?: OpponentAnalysisBlock[]) => {
    if (!blocks || blocks.length === 0) return null;

    return (
      <div className="mb-12">
        <h2 className="text-xl font-bold text-brand-red-500 border-b border-brand-red-600/30 pb-2 mb-6 uppercase tracking-wider">
          {title}
        </h2>
        <div className="space-y-8">
          {blocks.map((block, idx) => (
            <div key={block.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium">
              <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                <span className="bg-brand-red-600/20 text-brand-red-500 w-6 h-6 flex items-center justify-center rounded-full text-xs">
                  {idx + 1}
                </span>
                {block.title || `Bloque ${idx + 1}`}
              </h3>

              <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                {/* Texto y Vídeo */}
                <div className="xl:col-span-1 flex flex-col gap-6">
                  {block.description && (
                    <div className="bg-brand-black p-4 rounded-lg border border-brand-black-border text-sm text-brand-gray-light whitespace-pre-wrap leading-relaxed">
                      {block.description}
                    </div>
                  )}
                  {block.videos && block.videos.length > 0 && (
                    <div className="flex-1">
                      <OpponentVideoClipper videos={block.videos} onChange={() => {}} readOnly={true} />
                    </div>
                  )}
                </div>

                {/* Pizarra */}
                <div className="xl:col-span-2 bg-black border border-brand-black-border rounded-lg overflow-hidden min-h-[400px]">
                  {block.board ? (
                    <TaskBoardEditor value={block.board} onChange={() => {}} readOnly={true} limitedTools={true} />
                  ) : (
                    <div className="flex items-center justify-center h-full text-brand-gray-muted text-sm italic">
                      Sin campograma definido
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
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

      {/* Grid General */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <Award className="w-4 h-4 text-emerald-500" /> Jugadores Peligrosos
          </h4>
          <div className="flex flex-wrap gap-2">
            {analysis.key_players.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguno</span> : analysis.key_players.map((s, i) => (
              <span key={i} className="text-[11px] bg-emerald-950/20 text-emerald-500 border border-emerald-500/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
            ))}
          </div>
        </div>
      </div>

      {analysis.observations && (
        <div className="bg-brand-black border border-brand-black-border rounded-xl p-6">
           <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3">
            <FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones Generales
          </h4>
          <p className="text-sm text-brand-gray-light leading-relaxed whitespace-pre-line">{analysis.observations}</p>
        </div>
      )}

      {/* Plantilla */}
      {analysis.roster_comments && analysis.roster_comments.length > 0 && (
        <div className="mb-12">
          <h2 className="text-xl font-bold text-brand-gray-light border-b border-brand-black-border pb-2 mb-6 uppercase tracking-wider">
            Plantilla y Análisis Individual
          </h2>
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
        </div>
      )}

      {/* Bloques de Análisis */}
      <div className="mt-12">
        {renderBlocks('Fase Ofensiva (Con Balón)', analysis.with_ball_blocks)}
        {renderBlocks('Fase Defensiva (Sin Balón)', analysis.without_ball_blocks)}
        {renderBlocks('Acciones a Balón Parado (ABP)', analysis.abp_blocks)}
      </div>

    </div>
  );
};
