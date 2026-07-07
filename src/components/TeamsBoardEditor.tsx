import React, { useState, useRef, useEffect } from 'react';
import { Trash2, MousePointer2, User, Type, ArrowUpRight, Minus } from 'lucide-react';
import { Player } from '../types';

export interface BoardPlayer {
  id: string; // The placed element ID
  type: 'player' | 'text';
  x: number;
  y: number;
  color: string;
  // For players
  player_id?: string;
  nickname?: string;
  // For text
  text?: string;
}

export interface BoardLine {
  id: string;
  type: 'arrow' | 'line';
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
}

interface TeamsBoardEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  players?: Player[];
  readOnly?: boolean;
  printMode?: boolean;
}

export const TeamsBoardEditor: React.FC<TeamsBoardEditorProps> = ({ value, onChange, players = [], readOnly, printMode }) => {
  const [elements, setElements] = useState<BoardPlayer[]>(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.elements) return parsed.elements;
        if (Array.isArray(parsed)) return parsed;
      } catch(e) {}
    }
    return [];
  });
  const [lines, setLines] = useState<BoardLine[]>(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.lines) return parsed.lines;
      } catch(e) {}
    }
    return [];
  });
  const [activeTool, setActiveTool] = useState<'select' | 'arrow' | 'line' | 'text'>('select'); 
  const [activeColor, setActiveColor] = useState<string>('#3b82f6'); // Default blue
  
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeDragLastPosRef = useRef<{ x: number, y: number } | null>(null);
  
  const [drawingLine, setDrawingLine] = useState<BoardLine | null>(null);
  
  const boardRef = useRef<HTMLDivElement>(null);

  const lastValueRef = useRef(value);

  // Parse initial data
  useEffect(() => {
    if (value && value !== lastValueRef.current) {
      lastValueRef.current = value;
      try {
        const parsed = JSON.parse(value);
        if (parsed.elements) {
          setElements(parsed.elements);
        } else if (Array.isArray(parsed)) {
          // Fallback for old version
          setElements(parsed);
        }
        if (parsed.lines) {
          setLines(parsed.lines);
        }
      } catch (e) {
        console.error("Error parsing teams board data");
      }
    } else if (!value && value !== lastValueRef.current) {
      lastValueRef.current = value;
      setElements([]);
      setLines([]);
    }
  }, [value]);

  // Save changes
  useEffect(() => {
    if (readOnly || !onChange) return;
    const data = JSON.stringify({ elements, lines });
    if (data !== lastValueRef.current) {
      lastValueRef.current = data;
      onChange(data);
    }
  }, [elements, lines, onChange, readOnly]);

  // --- DRAG AND DROP FROM LIST TO BOARD ---
  const handleDragStartFromList = (e: React.DragEvent, player: Player) => {
    e.dataTransfer.setData('player_id', player.id);
  };

  const handleDragOverBoard = (e: React.DragEvent) => {
    e.preventDefault(); // Necessary to allow dropping
  };

  const handleDropOnBoard = (e: React.DragEvent) => {
    e.preventDefault();
    if (readOnly) return;
    const playerId = e.dataTransfer.getData('player_id');
    if (!playerId) return;

    const player = players.find(p => p.id === playerId);
    if (player && boardRef.current) {
      const rect = boardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;

      const newEl: BoardPlayer = {
        id: `p-${Date.now()}-${Math.random().toString(36).substr(2, 5)}`,
        type: 'player',
        player_id: player.id,
        nickname: player.nickname || player.full_name,
        x,
        y,
        color: activeColor
      };

      setElements(prev => [...prev, newEl]);
      setActiveTool('select');
    }
  };

  // --- POINTER EVENTS (Drawing & Moving) ---
  const handleBoardPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (!boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (activeTool === 'arrow' || activeTool === 'line') {
      setDrawingLine({
        id: `line-${Date.now()}`,
        type: activeTool,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        color: activeColor
      });
    } else if (activeTool === 'text') {
      const newEl: BoardPlayer = {
        id: `t-${Date.now()}`,
        type: 'text',
        text: 'Texto...',
        x,
        y,
        color: activeColor
      };
      setElements(prev => [...prev, newEl]);
      setActiveTool('select');
    }
  };

  useEffect(() => {
    const handlePointerMove = (e: PointerEvent) => {
      if (!boardRef.current) return;
      const rect = boardRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      x = Math.max(0, Math.min(100, x));
      y = Math.max(0, Math.min(100, y));

      if (drawingLine) {
        setDrawingLine(prev => prev ? { ...prev, endX: x, endY: y } : null);
      } else if (activeDragId && activeDragLastPosRef.current) {
        const dx = x - activeDragLastPosRef.current.x;
        const dy = y - activeDragLastPosRef.current.y;

        if (activeDragId.startsWith('line-') || activeDragId.startsWith('arrow-')) {
          setLines(prev => prev.map(l => {
            if (l.id === activeDragId) {
              return {
                ...l,
                startX: Math.max(0, Math.min(100, l.startX + dx)),
                startY: Math.max(0, Math.min(100, l.startY + dy)),
                endX: Math.max(0, Math.min(100, l.endX + dx)),
                endY: Math.max(0, Math.min(100, l.endY + dy))
              };
            }
            return l;
          }));
        } else {
          setElements(prev => prev.map(el => {
            if (el.id === activeDragId) {
              return { ...el, x: Math.max(0, Math.min(100, el.x + dx)), y: Math.max(0, Math.min(100, el.y + dy)) };
            }
            return el;
          }));
        }
        activeDragLastPosRef.current = { x, y };
      }
    };

    const handlePointerUp = () => {
      if (drawingLine) {
        // Only save if it has some length
        const dx = drawingLine.endX - drawingLine.startX;
        const dy = drawingLine.endY - drawingLine.startY;
        if (Math.sqrt(dx*dx + dy*dy) > 1) {
          setLines(prev => [...prev, drawingLine]);
        }
        setDrawingLine(null);
        setActiveTool('select');
      }
      setActiveDragId(null);
      activeDragLastPosRef.current = null;
    };

    if (drawingLine || activeDragId) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [drawingLine, activeDragId]);

  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    setActiveDragId(id);
    const rect = boardRef.current?.getBoundingClientRect();
    if (rect) {
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      activeDragLastPosRef.current = { x, y };
    }
  };

  const removeElement = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setElements(prev => prev.filter(el => el.id !== id));
    setLines(prev => prev.filter(l => l.id !== id));
  };

  const ColorButton = ({ color }: { color: string }) => {
    const isActive = activeColor === color;
    return (
      <button 
        onClick={() => setActiveColor(color)}
        className={`w-6 h-6 rounded-full border-2 transition-transform ${isActive ? 'scale-110 border-brand-red-600' : 'border-brand-black-border hover:scale-105'}`}
        style={{ backgroundColor: color }}
        title="Seleccionar Color"
      />
    );
  };

  const ToolButton = ({ tool, icon, label }: { tool: typeof activeTool, icon: React.ReactNode, label: string }) => {
    const isActive = activeTool === tool;
    return (
      <button 
        onClick={() => setActiveTool(tool)}
        className={`flex-1 p-2 rounded flex flex-col items-center gap-1 transition-colors ${isActive ? 'bg-brand-red-600 text-white' : 'bg-brand-black hover:bg-brand-black-hover text-brand-gray-light'}`}
        title={label}
      >
        {icon}
        <span className="text-[9px] uppercase font-bold tracking-wider">{label}</span>
      </button>
    );
  };

  const getPrintColor = (c: string) => {
    if (!printMode) return c;
    if (c === '#ffffff' || c.toLowerCase() === 'white') return '#000000';
    return c;
  };

  const px = (val: number) => `${(val / 5)}cqw`;

  return (
    <div className={`flex flex-col md:flex-row gap-4 h-full min-h-[400px] ${printMode ? 'w-full !h-full !min-h-0' : ''}`}>

      
      {/* Sidebar: Herramientas y Jugadores */}
      {!printMode && (
        <div className="w-full md:w-64 bg-brand-black-card border border-brand-black-border rounded-xl p-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        
        <div className="grid grid-cols-2 gap-2">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="Mover" />
          <ToolButton tool="text" icon={<Type className="w-5 h-5" />} label="Texto" />
          <ToolButton tool="arrow" icon={<ArrowUpRight className="w-5 h-5" />} label="Flecha" />
          <ToolButton tool="line" icon={<Minus className="w-5 h-5" />} label="Línea" />
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Colors */}
        <div>
          <h3 className="text-[10px] font-bold text-brand-gray-muted uppercase mb-2 text-center">Color</h3>
          <div className="flex justify-center gap-2 flex-wrap">
             <ColorButton color="#ef4444" /> {/* Rojo */}
             <ColorButton color="#3b82f6" /> {/* Azul */}
             <ColorButton color="#eab308" /> {/* Amarillo */}
             <ColorButton color="#22c55e" /> {/* Verde */}
             <ColorButton color="#a855f7" /> {/* Morado */}
             <ColorButton color="#ffffff" /> {/* Blanco */}
          </div>
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Players */}
        <div className="flex-1 flex flex-col min-h-0">
          <h3 className="text-[10px] font-bold text-brand-gray-muted uppercase mb-1 text-center">Plantilla</h3>
          <p className="text-[9px] text-brand-gray-muted text-center mb-2">Arrastra al jugador a la pizarra</p>
          <div className="flex-1 overflow-y-auto custom-scrollbar pr-1 flex flex-col gap-1">
             {players.map(p => {
               const playerElements = elements.filter(el => el.type === 'player' && el.player_id === p.id);
               const colorCounts = playerElements.reduce((acc, el) => {
                 acc[el.color] = (acc[el.color] || 0) + 1;
                 return acc;
               }, {} as Record<string, number>);
               const colors = Object.keys(colorCounts);
               
               return (
                 <div
                   key={p.id}
                   draggable={!readOnly}
                   onDragStart={(e) => handleDragStartFromList(e, p)}
                   className="flex justify-between items-center px-2 py-1.5 rounded text-xs font-medium bg-brand-black border border-brand-black-border text-brand-gray-light hover:bg-brand-black-hover cursor-grab active:cursor-grabbing select-none"
                 >
                   <span className="truncate">{p.nickname || p.full_name}</span>
                   {colors.length > 0 && (
                     <div className="flex gap-1 shrink-0">
                       {colors.map(color => (
                         <span 
                           key={color} 
                           className="flex items-center justify-center w-4 h-4 rounded-full text-[9px] font-bold text-white shadow-sm"
                           style={{ backgroundColor: color, textShadow: '0 1px 1px rgba(0,0,0,0.8)' }}
                           title={`${colorCounts[color]} veces`}
                         >
                           {colorCounts[color]}
                         </span>
                       ))}
                     </div>
                   )}
                 </div>
               );
             })}
          </div>
        </div>

        <hr className="border-brand-black-border" />
        <button 
          onClick={() => {
            if(window.confirm('¿Estás seguro de querer limpiar toda la pizarra?')) {
              setElements([]);
              setLines([]);
            }
          }}
          className="w-full py-2 px-2 flex items-center justify-center gap-1.5 text-[10px] font-bold bg-brand-red-600/10 text-brand-red-600 hover:bg-brand-red-600 hover:text-white rounded transition-colors uppercase shrink-0"
        >
          <Trash2 className="w-3.5 h-3.5" />
          Limpiar Todo
        </button>
      </div>
      )}

      {/* Area de la Pizarra */}
      <div 
        className={`flex-1 relative ${printMode ? '' : 'bg-brand-black-card border border-brand-black-border rounded-xl shadow-inner'} p-2 sm:p-4 overflow-hidden select-none`}
        ref={boardRef}
        onPointerDown={handleBoardPointerDown}
        onDragOver={handleDragOverBoard}
        onDrop={handleDropOnBoard}
      >
        {!printMode && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none">
             {activeTool === 'select' && <span className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur">👆 Arrastra desde la lista o mueve los elementos</span>}
             {activeTool === 'arrow' && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">↗️ Arrastra en la pizarra para dibujar flecha</span>}
             {activeTool === 'line' && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">📏 Arrastra en la pizarra para dibujar línea</span>}
             {activeTool === 'text' && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">🔤 Haz clic en la pizarra para añadir texto</span>}
          </div>
        )}

        {/* Board container */}
        <div 
          className={`relative touch-none border border-white/10 rounded shadow-lg overflow-hidden ${printMode ? 'bg-white mx-auto' : 'bg-[#1a1a1a]'}`}
          style={{ 
            aspectRatio: '105 / 68',
            width: '100%',
            height: '100%',
            maxHeight: '800px',
            maxWidth: '1200px',
            containerType: 'inline-size'
          }}
          ref={boardRef}
          onPointerDown={handleBoardPointerDown}
          onDragOver={handleDragOverBoard}
          onDrop={handleDropOnBoard}
        >
          {/* Subtle grid background */}
          {!printMode && (
            <div className="absolute inset-0 opacity-10 pointer-events-none" style={{ backgroundImage: 'radial-gradient(#ffffff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />
          )}

          {/* SVG Layer for Lines and Arrows */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10" style={{ overflow: 'visible' }}>
            <defs>
              <marker id="arrowhead-teams" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto">
                <polygon points="0 0, 10 3.5, 0 7" fill="context-stroke" />
              </marker>
            </defs>
            
            {[...lines, ...(drawingLine ? [drawingLine] : [])].map(line => (
              <g 
                key={line.id} 
                className={activeTool === 'select' ? 'pointer-events-auto cursor-grab active:cursor-grabbing group' : ''}
                onPointerDown={(e) => handleElementPointerDown(e, line.id)}
              >
                {/* Invisible wider area for easier grabbing */}
                <line 
                  x1={`${line.startX}%`} y1={`${line.startY}%`} 
                  x2={`${line.endX}%`} y2={`${line.endY}%`} 
                  stroke="transparent" strokeWidth="20"
                />
                <line 
                  x1={`${line.startX}%`} y1={`${line.startY}%`} 
                  x2={`${line.endX}%`} y2={`${line.endY}%`} 
                  stroke={line.color} 
                  strokeWidth="2.5"
                  markerEnd={line.type === 'arrow' ? 'url(#arrowhead-teams)' : ''}
                  style={{ stroke: line.color }}
                />
                {activeTool === 'select' && !readOnly && (
                   <circle
                     cx={`${(line.startX + line.endX) / 2}%`}
                     cy={`${(line.startY + line.endY) / 2}%`}
                     r="10"
                     fill="rgba(0,0,0,0.5)"
                     className="transition-colors hover:fill-red-500 cursor-pointer"
                     onClick={(e) => removeElement(line.id, e)}
                   />
                )}
              </g>
            ))}
          </svg>

          {/* DOM Elements Layer (Players and Text) */}
          <div className="absolute inset-0 w-full h-full z-20 pointer-events-none">
            {elements.map(el => (
              <div
                key={el.id}
                onPointerDown={(e) => handleElementPointerDown(e, el.id)}
                className="absolute group pointer-events-auto"
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  transform: 'translate(-50%, -50%)',
                  cursor: activeTool === 'select' ? (activeDragId === el.id ? 'grabbing' : 'grab') : 'default',
                  zIndex: activeDragId === el.id ? 30 : 20,
                  touchAction: 'none'
                }}
              >
                {el.type === 'player' ? (
                  /* Name Tag */
                  <div 
                    className={`rounded-full font-bold whitespace-nowrap shadow-md flex items-center justify-center border-solid`}
                    style={{ 
                       padding: `${px(4)} ${px(12)}`,
                       borderWidth: px(2),
                       fontSize: px(11),
                       gap: px(4),
                       backgroundColor: printMode ? 'white' : `${getPrintColor(el.color)}40`,
                       borderColor: getPrintColor(el.color),
                       textShadow: printMode ? 'none' : '0 1px 2px rgba(0,0,0,0.8)',
                       color: printMode ? getPrintColor(el.color) : 'white'
                    }}
                  >
                    <User style={{ width: px(12), height: px(12), color: getPrintColor(el.color) }} />
                    {el.nickname}
                    
                    {/* Delete button (shows when in select mode) */}
                    <button 
                      onClick={(e) => removeElement(el.id, e)}
                      className={`rounded-full bg-black/40 hover:bg-black/80 transition-all text-white ${activeTool === 'select' && !printMode ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      style={{ padding: px(2), marginLeft: px(4) }}
                      title="Eliminar"
                    >
                      <Trash2 style={{ width: px(12), height: px(12) }} />
                    </button>
                  </div>
                ) : (
                  /* Free Text */
                  <div className="relative group">
                    <input
                      value={el.text}
                      onChange={(e) => {
                        setElements(prev => prev.map(item => item.id === el.id ? { ...item, text: e.target.value } : item));
                      }}
                      className="bg-transparent border-none font-bold text-center outline-none whitespace-nowrap"
                      style={{ 
                        fontSize: px(14),
                        color: printMode ? getPrintColor(el.color) : el.color, 
                        textShadow: printMode ? 'none' : '0 1px 3px rgba(0,0,0,1)' 
                      }}
                      size={Math.max(3, (el.text || '').length)}
                    />
                    <button 
                      onClick={(e) => removeElement(el.id, e)}
                      className={`absolute rounded-full bg-black/80 transition-all text-white shadow-md z-10 ${activeTool === 'select' ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
                      style={{ top: `-${px(12)}`, right: `-${px(12)}`, padding: px(4) }}
                      title="Eliminar texto"
                    >
                      <Trash2 style={{ width: px(12), height: px(12) }} />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>

        </div>
      </div>
    </div>
  );
};
