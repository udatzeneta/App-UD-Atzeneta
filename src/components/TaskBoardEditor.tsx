import React, { useState, useRef, useEffect } from 'react';
import { 
  Maximize, MoveHorizontal, Image as ImageIcon, MousePointer2, 
  RotateCw, Trash2, Copy, Type 
} from 'lucide-react';

export type FieldType = 'full' | 'half' | 'blank';
export type ToolType = 'select' | 'player' | 'cone' | 'pole' | 'goal' | 'mini-goal' | 'ball' | 'hurdle' | 'ring' | 'ladder' | 'bosu' | 'arrow' | 'dashed-arrow' | 'zone-line' | 'text';

export interface BoardElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale?: number;
  text?: string;
}

export interface BoardLine {
  id: string;
  type: ToolType;
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  color: string;
  thickness?: number;
}

interface TaskBoardEditorProps {
  value?: string;
  onChange: (value: string) => void;
}

export const TaskBoardEditor: React.FC<TaskBoardEditorProps> = ({ value, onChange }) => {
  const [fieldType, setFieldType] = useState<FieldType>('half');
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [lines, setLines] = useState<BoardLine[]>([]);
  
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeColor, setActiveColor] = useState<string>('#ffffff');
  
  const [selectedElementId, setSelectedElementId] = useState<string | null>(null);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [drawingLine, setDrawingLine] = useState<BoardLine | null>(null);
  
  const boardRef = useRef<HTMLDivElement>(null);
  const hasDraggedRef = useRef(false);

  // Load initial data
  useEffect(() => {
    if (value) {
      try {
        const parsed = JSON.parse(value);
        if (parsed.fieldType) setFieldType(parsed.fieldType);
        if (parsed.elements) setElements(parsed.elements);
        if (parsed.lines) setLines(parsed.lines);
      } catch (e) {
        console.error("Error parsing board data");
      }
    }
  }, []);

  // Save changes automatically
  useEffect(() => {
    const data = JSON.stringify({ fieldType, elements, lines });
    if (data !== value) {
      onChange(data);
    }
  }, [fieldType, elements, lines, onChange, value]);

  // Handle pointer down on the board (canvas)
  const handleBoardPointerDown = (e: React.PointerEvent) => {
    if (!boardRef.current) return;
    
    if (e.target === boardRef.current || (e.target as Element).tagName === 'svg') {
      setSelectedElementId(null);
      setSelectedLineId(null);
    }

    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    if (['player', 'cone', 'pole', 'goal', 'mini-goal', 'ball', 'hurdle', 'ring', 'ladder', 'bosu', 'text'].includes(activeTool)) {
      const newEl: BoardElement = {
        id: `el-${Date.now()}`,
        type: activeTool,
        x,
        y,
        rotation: 0,
        color: activeColor,
        scale: 1,
        text: activeTool === 'text' ? 'Texto' : undefined
      };
      setElements([...elements, newEl]);
      // Seleccionamos automáticamente el texto para editarlo
      if (activeTool === 'text') {
        setSelectedElementId(newEl.id);
        setActiveTool('select'); // Switch to select to edit easily
      }
    } else if (['arrow', 'dashed-arrow', 'zone-line'].includes(activeTool)) {
      setDrawingLine({
        id: `line-${Date.now()}`,
        type: activeTool,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        color: activeColor,
        thickness: 1
      });
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
      } else if (activeDragId && activeTool === 'select') {
        hasDraggedRef.current = true;
        setElements(prev => prev.map(el => 
          el.id === activeDragId ? { ...el, x, y } : el
        ));
      }
    };

    const handlePointerUp = () => {
      if (drawingLine) {
        const dx = drawingLine.endX - drawingLine.startX;
        const dy = drawingLine.endY - drawingLine.startY;
        const length = Math.sqrt(dx*dx + dy*dy);
        
        if (length > 1) { 
          setLines(prev => [...prev, drawingLine]);
        }
        setDrawingLine(null);
      }
      if (activeDragId) {
        setActiveDragId(null);
      }
    };

    if (drawingLine || activeDragId) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [drawingLine, activeDragId, activeTool]);

  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === 'select') {
      hasDraggedRef.current = false;
      setActiveDragId(id);
      setSelectedElementId(id);
      setSelectedLineId(null);
    }
  };

  const handleLinePointerDown = (e: React.PointerEvent, id: string) => {
    e.stopPropagation();
    if (activeTool === 'select') {
      setSelectedLineId(id);
      setSelectedElementId(null);
    }
  };

  // Modifiers - Elements
  const rotateElement = (id: string, delta: number) => {
    setElements(elements.map(e => e.id === id ? { ...e, rotation: (e.rotation + delta) % 360 } : e));
  };

  const scaleElement = (id: string, delta: number) => {
    setElements(elements.map(e => e.id === id ? { ...e, scale: Math.max(0.5, Math.min(4, (e.scale || 1) + delta)) } : e));
  };

  const removeElement = (id: string) => {
    setElements(elements.filter(e => e.id !== id));
    if (selectedElementId === id) setSelectedElementId(null);
  };

  const updateElementText = (id: string, text: string) => {
    setElements(elements.map(e => e.id === id ? { ...e, text } : e));
  };

  const duplicateElement = (id: string) => {
    const elToCopy = elements.find(e => e.id === id);
    if (elToCopy) {
      const newEl = { 
        ...elToCopy, 
        id: `el-${Date.now()}`, 
        x: Math.min(95, elToCopy.x + 5), 
        y: Math.min(95, elToCopy.y + 5) 
      };
      setElements([...elements, newEl]);
      setSelectedElementId(newEl.id);
    }
  };

  // Modifiers - Lines
  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
    if (selectedLineId === id) setSelectedLineId(null);
  };

  const updateLineColor = (id: string, color: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, color } : l));
  };

  const updateLineThickness = (id: string, thickness: number) => {
    setLines(lines.map(l => l.id === id ? { ...l, thickness } : l));
  };

  // --- RENDERING ---

  const renderFieldBackground = () => {
    const bgStyle = {
      background: 'repeating-linear-gradient(0deg, #4da44d, #4da44d 10%, #56b056 10%, #56b056 20%)',
      width: '100%',
      height: '100%'
    };

    return (
      <div className="absolute inset-0" style={bgStyle}>
        {fieldType !== 'blank' && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
            <g stroke="rgba(255,255,255,0.7)" strokeWidth="0.4" fill="none">
              {fieldType === 'full' && (
              <>
                <rect x="2" y="2" width="96" height="96" />
                <line x1="2" y1="50" x2="98" y2="50" />
                <ellipse cx="50" cy="50" rx="12.8" ry="9" />
                <circle cx="50" cy="50" r="0.5" fill="white" />
                
                <rect x="20" y="2" width="60" height="16" />
                <rect x="35" y="2" width="30" height="5" />
                <path d="M 40 18 A 12.8 9 0 0 0 60 18" />
                <circle cx="50" cy="10" r="0.5" fill="white" />
                
                <rect x="20" y="82" width="60" height="16" />
                <rect x="35" y="93" width="30" height="5" />
                <path d="M 40 82 A 12.8 9 0 0 1 60 82" />
                <circle cx="50" cy="90" r="0.5" fill="white" />
              </>
            )}
            {fieldType === 'half' && (
              <>
                <rect x="2" y="-10" width="96" height="108" />
                <rect x="20" y="65" width="60" height="33" />
                <rect x="35" y="88" width="30" height="10" />
                <path d="M 37 65 A 13 13 0 0 1 63 65" />
                <circle cx="50" cy="80" r="0.5" fill="white" />
                
                <path d="M 35 2 A 15 15 0 0 0 65 2" />
                <circle cx="50" cy="2" r="0.5" fill="white" />
              </>
            )}
          </g>
        </svg>
        )}
      </div>
    );
  };

  const renderElement = (el: BoardElement) => {
    const isSelected = selectedElementId === el.id;
    
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: `translate(-50%, -50%) rotate(${el.rotation}deg) scale(${el.scale || 1})`,
      cursor: activeTool === 'select' ? (activeDragId === el.id ? 'grabbing' : 'grab') : 'default',
      filter: isSelected ? 'drop-shadow(0 0 0px #fff) drop-shadow(0 0 4px #dc2626)' : 'none',
      zIndex: isSelected ? 10 : 2,
      touchAction: 'none'
    };

    let content = null;
    
    switch (el.type) {
      case 'player':
        content = <div style={{
          width: '24px', height: '24px', borderRadius: '50%',
          background: `radial-gradient(circle at 30% 30%, ${el.color}, #111)`,
          boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.5), inset 2px 2px 4px rgba(255,255,255,0.4), 2px 3px 4px rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.2)'
        }} />;
        break;
      case 'cone':
        content = <div style={{
          width: '16px', height: '16px', borderRadius: '50%',
          background: `radial-gradient(circle at center, ${el.color} 20%, #cc4400 80%)`,
          boxShadow: '1px 2px 3px rgba(0,0,0,0.4)', border: '1px solid rgba(0,0,0,0.2)'
        }} />;
        break;
      case 'pole':
        content = (
          <div className="w-1.5 h-10 rounded-full" 
               style={{ 
                 background: `linear-gradient(90deg, #fff 0%, ${el.color} 40%, ${el.color} 60%, #333 100%)`, 
                 boxShadow: '2px 2px 3px rgba(0,0,0,0.4)' 
               }} 
          />
        );
        break;
      case 'hurdle':
        content = (
          <div className="relative w-10 h-3" style={{ color: el.color, filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))' }}>
            <div className="absolute top-0 w-full h-1 bg-current" />
            <div className="absolute top-1 left-0.5 w-1 h-3 bg-gray-300" />
            <div className="absolute top-1 right-0.5 w-1 h-3 bg-gray-300" />
          </div>
        );
        break;
      case 'goal':
        content = (
          <svg width="60" height="24" viewBox="0 0 60 24" style={{ filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.6))' }}>
            <rect x="2" y="0" width="56" height="20" fill="url(#net-pattern)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
            <path d="M 2 0 L 12 20 M 12 0 L 22 20 M 22 0 L 32 20 M 32 0 L 42 20 M 42 0 L 52 20 M 52 0 L 58 20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <rect x="0" y="20" width="60" height="4" fill="#ffffff" rx="1" />
            <rect x="0" y="0" width="4" height="24" fill="#e2e8f0" rx="1" />
            <rect x="56" y="0" width="4" height="24" fill="#e2e8f0" rx="1" />
          </svg>
        );
        break;
      case 'mini-goal':
        content = (
          <svg width="30" height="16" viewBox="0 0 30 16" style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.6))' }}>
            <rect x="2" y="0" width="26" height="12" fill="url(#net-pattern)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
            <rect x="0" y="12" width="30" height="3" fill="#ffffff" rx="1" />
            <rect x="0" y="0" width="3" height="15" fill="#e2e8f0" rx="1" />
            <rect x="27" y="0" width="3" height="15" fill="#e2e8f0" rx="1" />
          </svg>
        );
        break;
      case 'ring':
        content = (
          <div className="w-8 h-8 rounded-full border-4" style={{ borderColor: el.color, boxShadow: '2px 2px 3px rgba(0,0,0,0.4)' }} />
        );
        break;
      case 'bosu':
        content = (
          <div className="relative w-8 h-8" style={{ filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))' }}>
            <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${el.color}, #000)`, opacity: 0.9 }} />
            <div className="absolute inset-x-1 bottom-1 h-2 bg-black rounded-b-full opacity-80" />
            <div className="absolute inset-0 rounded-full border border-white/20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
          </div>
        );
        break;
      case 'ladder':
        content = (
          <svg width="24" height="80" viewBox="0 0 24 80" style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.5))' }}>
            <rect x="0" y="0" width="3" height="80" fill={el.color} />
            <rect x="21" y="0" width="3" height="80" fill={el.color} />
            <rect x="3" y="10" width="18" height="2" fill={el.color} />
            <rect x="3" y="30" width="18" height="2" fill={el.color} />
            <rect x="3" y="50" width="18" height="2" fill={el.color} />
            <rect x="3" y="70" width="18" height="2" fill={el.color} />
          </svg>
        );
        break;
      case 'ball':
        content = (
          <div style={{
            width: '12px', height: '12px', borderRadius: '50%',
            background: 'radial-gradient(circle at 30% 30%, #fff, #999)',
            boxShadow: 'inset -1px -1px 2px rgba(0,0,0,0.5), 1px 2px 3px rgba(0,0,0,0.4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid #333'
          }}>
            <div className="w-1 h-1 bg-black rounded-full" />
          </div>
        );
        break;
      case 'text':
        content = (
          <div 
            className="font-bold whitespace-nowrap px-1" 
            style={{ 
              color: el.color, 
              fontSize: '14px', 
              filter: 'drop-shadow(1px 1px 1px rgba(0,0,0,0.8))'
            }}
          >
            {el.text || 'Texto'}
          </div>
        );
        break;
    }

    return (
      <div 
        key={el.id} 
        style={baseStyle}
        onPointerDown={(e) => handleElementPointerDown(e, el.id)}
      >
        {content}
      </div>
    );
  };

  const renderLines = () => {
    const allLines = [...lines];
    if (drawingLine) allLines.push(drawingLine);

    return (
      <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1 }}>
        <defs>
          <pattern id="net-pattern" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 0 0 L 4 4 M 4 0 L 0 4" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
          </pattern>
          <marker id="arrowhead-white" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="white" />
          </marker>
          <marker id="arrowhead-black" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="black" />
          </marker>
          <marker id="arrowhead-red" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#ef4444" />
          </marker>
          <marker id="arrowhead-blue" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#3b82f6" />
          </marker>
          <marker id="arrowhead-yellow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill="#f59e0b" />
          </marker>
        </defs>

        {allLines.map(line => {
          const isSelected = selectedLineId === line.id;
          
          let markerEnd = "none";
          if (line.color === '#000000') markerEnd = 'url(#arrowhead-black)';
          else if (line.color === '#ef4444') markerEnd = 'url(#arrowhead-red)';
          else if (line.color === '#3b82f6') markerEnd = 'url(#arrowhead-blue)';
          else if (line.color === '#f59e0b') markerEnd = 'url(#arrowhead-yellow)';
          else markerEnd = 'url(#arrowhead-white)';
          
          let strokeDasharray = "none";
          let strokeWidth = (line.thickness || 1) * 0.5; // Base visual scaling
          let filter = isSelected ? 'drop-shadow(0 0 3px red)' : 'drop-shadow(1px 2px 2px rgba(0,0,0,0.5))';

          if (line.type === 'dashed-arrow') {
            strokeDasharray = "1.5, 1.5";
          } else if (line.type === 'zone-line') {
            strokeDasharray = "3, 2";
            strokeWidth = (line.thickness || 1) * 0.8; 
            filter = 'none'; 
            markerEnd = 'none'; // Las zonas no llevan flecha por defecto
          } else if (line.type === 'arrow') {
            // Normal arrow
          }

          return (
            <g 
              key={line.id} 
              className={activeTool === 'select' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
              onPointerDown={(e) => handleLinePointerDown(e, line.id)}
            >
              <line 
                x1={`${line.startX}%`} y1={`${line.startY}%`} 
                x2={`${line.endX}%`} y2={`${line.endY}%`} 
                stroke="transparent" strokeWidth="6" 
              />
              <line 
                x1={`${line.startX}%`} y1={`${line.startY}%`} 
                x2={`${line.endX}%`} y2={`${line.endY}%`} 
                stroke={line.color} 
                strokeWidth={strokeWidth} 
                strokeDasharray={strokeDasharray}
                markerEnd={markerEnd}
                filter={filter}
              />
            </g>
          );
        })}
      </svg>
    );
  };

  const ToolButton = ({ tool, icon, label, bg = false }: { tool: ToolType, icon: React.ReactNode, label: string, bg?: boolean }) => {
    const isActive = activeTool === tool;
    return (
      <button 
        onClick={() => setActiveTool(tool)} 
        className={`p-2 rounded flex flex-col items-center gap-1 transition-colors ${isActive ? 'bg-brand-red-600 text-white shadow-glow-red' : bg ? 'bg-brand-black hover:bg-brand-black-hover text-brand-gray-light' : 'text-brand-gray-muted hover:text-white'}`}
        title={label}
      >
        {icon}
        {label && <span className="text-[9px] uppercase font-bold tracking-wider hidden lg:block">{label}</span>}
      </button>
    );
  };

  const ColorButton = ({ color }: { color: string }) => {
    const isActive = activeColor === color;
    return (
      <button 
        onClick={() => setActiveColor(color)}
        className={`w-6 h-6 rounded-full border-2 transition-transform ${isActive ? 'scale-110 border-brand-red-600' : 'border-brand-black-border hover:scale-105'}`}
        style={{ backgroundColor: color }}
      />
    );
  };

  const selectedElement = elements.find(e => e.id === selectedElementId);
  const selectedLine = lines.find(l => l.id === selectedLineId);

  return (
    <div className="flex flex-col md:flex-row gap-4 h-full min-h-[500px]">
      
      {/* Sidebar Tools */}
      <div className="w-full md:w-20 lg:w-48 bg-brand-black-card border border-brand-black-border rounded-xl p-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-center">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="Mover" bg={true} />
        </div>

        <hr className="border-brand-black-border" />

        <h3 className="text-[10px] font-bold text-brand-gray-muted uppercase text-center hidden lg:block">Fondo</h3>
        <div className="flex md:flex-col gap-2 justify-center flex-wrap">
          <button onClick={() => setFieldType('full')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'full' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
            <Maximize className="w-4 h-4" />
            <span className="text-[9px] uppercase hidden lg:block">Entero</span>
          </button>
          <button onClick={() => setFieldType('half')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'half' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
            <MoveHorizontal className="w-4 h-4" />
            <span className="text-[9px] uppercase hidden lg:block">Medio</span>
          </button>
          <button onClick={() => setFieldType('blank')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'blank' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
            <ImageIcon className="w-4 h-4" />
            <span className="text-[9px] uppercase hidden lg:block">Liso</span>
          </button>
        </div>

        <hr className="border-brand-black-border" />

        <h3 className="text-[10px] font-bold text-brand-gray-muted uppercase text-center hidden lg:block">Añadir</h3>
        
        <div className="flex justify-center gap-2 flex-wrap pb-2">
          <ColorButton color="#ffffff" />
          <ColorButton color="#ef4444" />
          <ColorButton color="#3b82f6" />
          <ColorButton color="#f59e0b" />
          <ColorButton color="#000000" />
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-2 gap-2 pb-2 border-b border-brand-black-border mb-2">
          <ToolButton tool="player" label="Jugador" bg={true} icon={<div className="w-5 h-5 rounded-full border border-white/50" style={{ background: `radial-gradient(circle at 30% 30%, ${activeColor}, #333)` }} />}/>
          <ToolButton tool="ball" label="Balón" bg={true} icon={<div className="w-4 h-4 rounded-full bg-white border border-gray-600 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-black rounded-full" /></div>}/>
          <ToolButton tool="cone" label="Cono" bg={true} icon={<div className="w-4 h-4 rounded-full border border-black/20" style={{ background: `radial-gradient(circle at center, ${activeColor} 20%, #cc4400 80%)` }} />}/>
          <ToolButton tool="pole" label="Pica" bg={true} icon={<div className="w-1 h-5 rounded-full" style={{ background: `linear-gradient(90deg, #fff, ${activeColor} 50%, #333)` }} />}/>
          <ToolButton tool="hurdle" label="Valla" bg={true} icon={<div className="w-5 h-2 border-t border-l border-r border-current" style={{ color: activeColor }} />}/>
          <ToolButton tool="ring" label="Aro" bg={true} icon={<div className="w-4 h-4 rounded-full border-2" style={{ borderColor: activeColor }} />}/>
          <ToolButton tool="ladder" label="Escalera" bg={true} icon={
             <div className="flex flex-col gap-0.5 w-3" style={{ color: activeColor }}>
               <div className="w-full h-0.5 bg-current" />
               <div className="w-full h-0.5 bg-current" />
               <div className="w-full h-0.5 bg-current" />
             </div>
          }/>
          <ToolButton tool="bosu" label="Bosu" bg={true} icon={<div className="w-5 h-2.5 rounded-t-full border-b border-black" style={{ background: `radial-gradient(circle at top, ${activeColor}, #222)` }} />}/>
          <ToolButton tool="goal" label="Portería" bg={true} icon={<div className="w-6 h-2 border-t border-l border-r border-white" />}/>
          <ToolButton tool="mini-goal" label="Mini-Port." bg={true} icon={<div className="w-4 h-1.5 border-t border-l border-r border-white" />}/>
        </div>
        
        <div className="flex justify-center">
          <ToolButton tool="text" label="Texto" bg={true} icon={<Type className="w-5 h-5" />} />
        </div>

        <hr className="border-brand-black-border mt-auto" />
        <h3 className="text-[10px] font-bold text-brand-gray-muted uppercase text-center hidden lg:block">Dibujar</h3>
        <div className="grid grid-cols-1 gap-2">
          <ToolButton tool="arrow" label="Pase" bg={true} icon={
            <div className="flex items-center text-white w-full px-2">
               <div className="flex-1 h-0.5 bg-current" />
               <div className="w-0 h-0 border-t-[3px] border-b-[3px] border-l-[4px] border-transparent border-l-current" />
            </div>
          }/>
          <ToolButton tool="dashed-arrow" label="Desmarque" bg={true} icon={
            <div className="flex items-center text-white w-full px-2">
               <div className="flex-1 border-t border-dashed border-current" />
               <div className="w-0 h-0 border-t-[3px] border-b-[3px] border-l-[4px] border-transparent border-l-current" />
            </div>
          }/>
          <ToolButton tool="zone-line" label="Zona" bg={true} icon={
            <div className="flex items-center text-white w-full px-2">
               <div className="flex-1 border-t-2 border-dashed border-white" />
            </div>
          }/>
        </div>

        <hr className="border-brand-black-border mt-2" />
        <button 
          onClick={() => {
            if(window.confirm('¿Estás seguro de querer borrar todo el dibujo?')) {
              setElements([]);
              setLines([]);
              setSelectedElementId(null);
              setSelectedLineId(null);
            }
          }}
          className="w-full py-2 px-2 mt-2 flex items-center justify-center gap-1.5 text-[10px] font-bold bg-brand-red-600/10 text-brand-red-600 hover:bg-brand-red-600 hover:text-white rounded transition-colors uppercase"
          title="Borrar Todo"
        >
          <Trash2 className="w-3.5 h-3.5" />
          <span className="hidden lg:block">Limpiar</span>
        </button>
      </div>

      {/* Main Canvas Area */}
      <div className="flex-1 flex items-center justify-center relative bg-brand-black-card border border-brand-black-border rounded-xl overflow-hidden select-none shadow-inner p-2 sm:p-4">
        
        <div className="absolute top-2 left-2 z-20 pointer-events-none">
           {activeTool === 'select' && <span className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur">👆 Seleccionar y arrastrar</span>}
           {['player', 'cone', 'pole', 'goal', 'mini-goal', 'ball', 'hurdle', 'ring', 'ladder', 'bosu', 'text'].includes(activeTool) && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">🎯 Haz clic en el campo para colocar</span>}
           {['arrow', 'dashed-arrow', 'zone-line'].includes(activeTool) && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">✏️ Haz clic y arrastra para dibujar</span>}
        </div>

        {/* Field container */}
        <div 
          className="relative touch-none cursor-crosshair rounded overflow-hidden shadow-lg border border-white/10"
          style={{ 
            aspectRatio: fieldType === 'full' ? '7 / 10' : '1 / 1', 
            maxHeight: '100%',
            maxWidth: '100%',
            height: '100%'
          }}
          ref={boardRef}
          onPointerDown={handleBoardPointerDown}
        >
          {renderFieldBackground()}
          {renderLines()}
          {elements.map(renderElement)}
        </div>

        {/* Selected Element Controls */}
        {selectedElementId && selectedElement && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-black/95 backdrop-blur-md border border-brand-black-border rounded-xl p-2 flex items-center gap-1 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-fade-in z-50">
            
            {/* Si es texto, mostrar input de edición */}
            {selectedElement.type === 'text' ? (
              <>
                <input 
                  type="text" 
                  value={selectedElement.text || ''} 
                  onChange={(e) => updateElementText(selectedElementId, e.target.value)}
                  className="bg-black/50 border border-brand-black-border rounded px-2 py-1 text-sm text-white outline-none w-32 focus:border-brand-red-600"
                  placeholder="Texto..."
                />
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            ) : (
              <>
                <button onClick={() => rotateElement(selectedElementId, -15)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors" title="Rotar Izquierda">
                  <RotateCw className="w-4 h-4 -scale-x-100" />
                </button>
                <button onClick={() => rotateElement(selectedElementId, 15)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors" title="Rotar Derecha">
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            )}

            <button onClick={() => scaleElement(selectedElementId, 0.2)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors font-bold text-xs flex items-center justify-center w-8" title="Aumentar">
              A+
            </button>
            <button onClick={() => scaleElement(selectedElementId, -0.2)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors font-bold text-xs flex items-center justify-center w-8" title="Reducir">
              A-
            </button>
            
            {/* Duplicar Elemento */}
            <div className="w-px h-6 bg-brand-black-border mx-1" />
            <button onClick={() => duplicateElement(selectedElementId)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors" title="Duplicar">
              <Copy className="w-4 h-4" />
            </button>

            <div className="w-px h-6 bg-brand-black-border mx-1" />
            <button onClick={() => removeElement(selectedElementId)} className="p-2 text-brand-red-600 hover:bg-brand-red-600/10 rounded-lg transition-colors" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected Line Controls */}
        {selectedLineId && selectedLine && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-black/95 backdrop-blur-md border border-brand-black-border rounded-xl p-2 flex items-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-fade-in z-50">
            
            {/* Controles de Grosor */}
            <div className="flex bg-black/50 rounded-lg border border-brand-black-border p-1">
               <button onClick={() => updateLineThickness(selectedLineId, 1)} className={`px-2 py-1 rounded text-[10px] font-bold ${selectedLine.thickness === 1 || !selectedLine.thickness ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}>X1</button>
               <button onClick={() => updateLineThickness(selectedLineId, 2)} className={`px-2 py-1 rounded text-[10px] font-bold ${selectedLine.thickness === 2 ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}>X2</button>
               <button onClick={() => updateLineThickness(selectedLineId, 3)} className={`px-2 py-1 rounded text-[10px] font-bold ${selectedLine.thickness === 3 ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}>X3</button>
            </div>

            <div className="w-px h-6 bg-brand-black-border mx-1" />

            {/* Controles de Color de Línea */}
            <div className="flex gap-1.5 items-center px-1">
               {['#ffffff', '#ef4444', '#3b82f6', '#f59e0b', '#000000'].map(c => (
                 <button 
                    key={c}
                    onClick={() => updateLineColor(selectedLineId, c)}
                    className={`w-4 h-4 rounded-full border-2 ${selectedLine.color === c ? 'border-brand-red-600 scale-125' : 'border-gray-500'}`}
                    style={{ backgroundColor: c }}
                 />
               ))}
            </div>

            <div className="w-px h-6 bg-brand-black-border mx-1" />

            <button onClick={() => removeLine(selectedLineId)} className="p-2 text-brand-red-600 hover:bg-brand-red-600/10 rounded-lg transition-colors flex items-center gap-1 text-xs font-bold" title="Eliminar Línea">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

      </div>
    </div>
  );
};
