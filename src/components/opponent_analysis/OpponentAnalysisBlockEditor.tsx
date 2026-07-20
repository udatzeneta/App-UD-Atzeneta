import React, { useState } from 'react';
import { OpponentAnalysisBlock, OpponentVideo } from '../../types';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { OpponentVideoClipper } from './OpponentVideoClipper';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';

interface Props {
  block: OpponentAnalysisBlock;
  onChange: (block: OpponentAnalysisBlock) => void;
  onRemove: () => void;
  index: number;
}

export const OpponentAnalysisBlockEditor: React.FC<Props> = ({ block, onChange, onRemove, index }) => {
  const [isExpanded, setIsExpanded] = useState(true);

  return (
    <div className="bg-[#1a1a1a] border border-brand-black-border rounded-xl overflow-hidden mb-6">
      {/* Cabecera del Bloque */}
      <div className="bg-brand-black px-4 py-3 border-b border-brand-black-border flex items-center justify-between">
        <div className="flex items-center gap-3 flex-1">
          <span className="bg-brand-red-600/20 text-brand-red-500 font-bold px-2.5 py-0.5 rounded text-xs">
            Bloque {index + 1}
          </span>
          <input
            type="text"
            value={block.title}
            onChange={(e) => onChange({ ...block, title: e.target.value })}
            placeholder="Título del comentario o bloque (ej. Salida de balón)"
            className="flex-1 bg-transparent text-sm text-brand-gray-light font-bold outline-none placeholder:text-brand-gray-dark placeholder:font-normal"
          />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button type="button" onClick={() => setIsExpanded(!isExpanded)} className="p-1.5 text-brand-gray-muted hover:text-white transition-colors">
            {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button type="button" onClick={onRemove} className="p-1.5 text-brand-gray-muted hover:text-brand-red-600 transition-colors" title="Eliminar Bloque">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Contenido (Pizarra, Texto, Vídeo) */}
      {isExpanded && (
        <div className="p-4 flex flex-col xl:flex-row gap-6">
          {/* Columna Izquierda: Texto y Vídeo */}
          <div className="w-full xl:w-1/3 flex flex-col gap-4">
            <div>
              <label className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-2 block">
                Explicación / Comentario
              </label>
              <textarea
                value={block.description}
                onChange={(e) => onChange({ ...block, description: e.target.value })}
                placeholder="Añade tu análisis táctico aquí..."
                className="w-full h-32 bg-black border border-brand-black-border rounded-lg p-3 text-sm text-brand-gray-light outline-none focus:border-brand-red-600 resize-none"
              />
            </div>
            
            <div className="flex-1 min-h-[300px]">
              <label className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-2 block">
                Vídeos y Cortes
              </label>
              <OpponentVideoClipper
                videos={block.videos}
                onChange={(videos) => onChange({ ...block, videos })}
              />
            </div>
          </div>

          {/* Columna Derecha: Pizarra */}
          <div className="w-full xl:w-2/3 flex flex-col">
            <label className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-2 block">
              Campograma
            </label>
            <div className="flex-1 bg-black border border-brand-black-border rounded-lg overflow-hidden min-h-[450px]">
              <TaskBoardEditor
                value={block.board}
                onChange={(board) => onChange({ ...block, board })}
                limitedTools={true}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
