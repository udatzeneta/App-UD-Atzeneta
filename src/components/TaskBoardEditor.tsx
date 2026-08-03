import React, { useState, useRef, useEffect } from 'react';
import { 
  Maximize, MoveHorizontal, Image as ImageIcon, MousePointer2, 
  RotateCw, Trash2, Copy, Type, ChevronDown, ChevronUp, Undo2, Redo2, Minus
} from 'lucide-react';

export type FieldType = 'full' | 'half' | 'half-top' | 'blank';
export type ToolType = 'select' | 'player' | 'cone' | 'cone-tall' | 'pole' | 'goal' | 'mini-goal' | 'goal-f11' | 'goal-f8' | 'goal-f5' | 'ball' | 'hurdle' | 'hurdle-high' | 'ring' | 'ladder' | 'bosu' | 'bosu-profile' | 'arrow' | 'dashed-arrow' | 'zone-line' | 'text' | 'shape-circle' | 'shape-square';

export interface BoardElement {
  id: string;
  type: ToolType;
  x: number;
  y: number;
  rotation: number;
  color: string;
  scale?: number;
  width?: number;
  height?: number;
  text?: string;
  filled?: boolean;
  dashed?: boolean;
  thickness?: number;
  abp_marking?: 'Z' | 'H' | '';
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
  curve?: number;
}

interface TaskBoardEditorProps {
  value?: string;
  onChange?: (value: string) => void;
  initialData?: string;
  readOnly?: boolean;
  hideToolbar?: boolean;
  printMode?: boolean;
  rotateFullField?: boolean;
  printWidth?: number;
  limitedTools?: boolean;
}

const TiroLeagueBall = ({ size = "100%", style = {} }: { size?: string | number, style?: React.CSSProperties }) => (
  <svg 
    width={size} height={size} 
    viewBox="0 0 100 100" 
    style={{ 
      borderRadius: '50%',
      boxShadow: 'inset -2px -2px 4px rgba(0,0,0,0.4), 1px 1px 2px rgba(0,0,0,0.2)',
      background: '#fff',
      display: 'block',
      ...style
    }}
  >
    <defs>
      <radialGradient id="tiroLeagueBallGrad" cx="30%" cy="30%" r="70%">
        <stop offset="0%" stopColor="#ffffff" />
        <stop offset="60%" stopColor="#f0f0f0" />
        <stop offset="100%" stopColor="#c0c0c0" />
      </radialGradient>
    </defs>
    <circle cx="50" cy="50" r="50" fill="url(#tiroLeagueBallGrad)" />
    
    {/* Maroon shapes */}
    <path d="M 28 30 L 72 30 L 50 68 Z" fill="#8b1c31" />
    
    {/* Side maroon strokes/patches */}
    <path d="M 5 45 Q 20 40 25 25 Q 10 25 5 45 Z" fill="#8b1c31" />
    <path d="M 95 45 Q 80 40 75 25 Q 90 25 95 45 Z" fill="#8b1c31" />
    <path d="M 20 75 Q 35 70 45 95 Q 20 95 20 75 Z" fill="#8b1c31" />
    <path d="M 80 75 Q 65 70 55 95 Q 80 95 80 75 Z" fill="#8b1c31" />
    <path d="M 35 5 Q 50 15 65 5 Z" fill="#8b1c31" />

    {/* Adidas Logo base triangle */}
    <polygon points="38,51 62,51 50,37" fill="#fff" />
    {/* Cuts to make 3 stripes */}
    <line x1="43" y1="36" x2="48" y2="53" stroke="#8b1c31" strokeWidth="1.5" />
    <line x1="49" y1="36" x2="54" y2="53" stroke="#8b1c31" strokeWidth="1.5" />
    
    {/* Text TIRO LEAGUE */}
    <text x="50" y="60" fontSize="4.5" fill="#fff" textAnchor="middle" fontFamily="sans-serif" letterSpacing="0.2" fontWeight="bold">TIRO LEAGUE</text>

    {/* Subtle panel lines */}
    <path d="M 28 30 L 10 20" stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none" />
    <path d="M 72 30 L 90 20" stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none" />
    <path d="M 50 68 L 50 95" stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none" />
    <path d="M 28 30 L 15 55" stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none" />
    <path d="M 72 30 L 85 55" stroke="rgba(0,0,0,0.15)" strokeWidth="1" fill="none" />
  </svg>
);

export const TaskBoardEditor: React.FC<TaskBoardEditorProps> = ({ value, onChange, initialData, readOnly, hideToolbar, printMode, rotateFullField, printWidth, limitedTools }) => {
  const [fieldType, setFieldType] = useState<FieldType>('half');
  const [elements, setElements] = useState<BoardElement[]>([]);
  const [lines, setLines] = useState<BoardLine[]>([]);
  
  const [activeTool, setActiveTool] = useState<ToolType>('select');
  const [activeColor, setActiveColor] = useState<string>('#ffffff');
  
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);
  const [selectedLineId, setSelectedLineId] = useState<string | null>(null);
  
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const activeDragLastPosRef = useRef<{ x: number, y: number } | null>(null);
  const [activeResizeId, setActiveResizeId] = useState<string | null>(null);
  const resizeStartRef = useRef<{ id: string, corner?: string, initialScale: number, initialDist: number, elX: number, elY: number, initialW?: number, initialH?: number, startX?: number, startY?: number, elRotation?: number } | null>(null);
  const [drawingLine, setDrawingLine] = useState<BoardLine | null>(null);
  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  
  const [history, setHistory] = useState<{ elements: BoardElement[], lines: BoardLine[] }[]>([]);
  const saveState = () => {
     setHistory(prev => {
        const newHistory = [...prev, { elements: JSON.parse(JSON.stringify(elements)), lines: JSON.parse(JSON.stringify(lines)) }];
        if (newHistory.length > 50) newHistory.shift();
        return newHistory;
     });
  };

  const handleUndo = () => {
     if (history.length === 0) return;
     const prev = history[history.length - 1];
     setElements(prev.elements);
     setLines(prev.lines);
     setHistory(history.slice(0, -1));
  };

  
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ width: 500, height: 500 });
  // Espacio disponible del contenedor del campo (para calcular un ajuste "contain" exacto)
  const fitContainerRef = useRef<HTMLDivElement>(null);
  const [availSize, setAvailSize] = useState({ width: 0, height: 0 });
  const hasDraggedRef = useRef(false);
  const lastLoadedValueRef = useRef<string | null>(null);
  const internalChangeRef = useRef(false);

  useEffect(() => {
    if (!boardRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setBoardSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(boardRef.current);
    return () => observer.disconnect();
  }, [fieldType]);

  // Medir el espacio disponible del contenedor del campo para ajustar el tablero sin
  // depender de que el padre tenga una altura definida (evita que se colapse o se amplíe).
  useEffect(() => {
    if (!fitContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      if (entries[0]) {
        setAvailSize({
          width: entries[0].contentRect.width,
          height: entries[0].contentRect.height
        });
      }
    });
    observer.observe(fitContainerRef.current);
    return () => observer.disconnect();
  }, []);

  const [openSections, setOpenSections] = useState({
    background: true,
    colors: true,
    elements: true,
    goals: true,
    drawing: true,
  });

  const toggleSection = (section: keyof typeof openSections) => {
    setOpenSections(prev => ({ ...prev, [section]: !prev[section] }));
  };

  // Load initial data or external changes
  useEffect(() => {
    if (internalChangeRef.current) {
      internalChangeRef.current = false;
      return;
    }
    const dataToLoad = value || initialData;
    if (dataToLoad && dataToLoad !== lastLoadedValueRef.current) {
      lastLoadedValueRef.current = dataToLoad;
      try {
        const parsed = JSON.parse(dataToLoad);
        if (parsed.fieldType) setFieldType(parsed.fieldType);
        if (parsed.elements) setElements(parsed.elements);
        if (parsed.lines) setLines(parsed.lines);
      } catch (e) {
        console.error("Error parsing board data");
      }
    }
  }, [value, initialData]);

  // Save changes automatically
  useEffect(() => {
    if (readOnly || !onChange) return;
    const data = JSON.stringify({ fieldType, elements, lines });
    if (data !== value) {
      internalChangeRef.current = true;
      lastLoadedValueRef.current = data;
      onChange(data);
    }
  }, [fieldType, elements, lines, onChange, value, readOnly]);

  // Handle pointer down on the board (canvas)
  const handleBoardPointerDown = (e: React.PointerEvent) => {
    saveState();
    if (readOnly) return;
    if (!boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Los elementos y líneas llaman a stopPropagation(), así que si el evento
    // llega hasta aquí en modo "Mover" es porque el clic fue en zona vacía:
    // deseleccionamos e iniciamos la caja de selección (marquee).
    if (activeTool === 'select') {
      (e.target as Element).setPointerCapture(e.pointerId);
      setSelectedElementIds([]);
      setSelectedLineId(null);
      setSelectionBox({ startX: x, startY: y, currentX: x, currentY: y });
      return;
    }

    if (['player', 'cone', 'cone-tall', 'pole', 'goal', 'mini-goal', 'goal-f11', 'goal-f8', 'goal-f5', 'ball', 'hurdle', 'hurdle-high', 'ring', 'ladder', 'bosu', 'bosu-profile', 'text', 'shape-circle', 'shape-square'].includes(activeTool)) {
      const newEl: BoardElement = {
        id: `el-${Date.now()}`,
        type: activeTool,
        x,
        y,
        rotation: 0,
        color: activeColor,
        scale: 0.75, // Default elements smaller
        text: (activeTool === 'text' || activeTool.startsWith('shape-')) ? (activeTool === 'text' ? 'Texto' : '') : undefined,
        filled: false,
        dashed: false
      };
      setElements([...elements, newEl]);
      // Seleccionamos automáticamente el texto para editarlo
      if (activeTool === 'text' || activeTool.startsWith('shape-')) {
        setSelectedElementIds([newEl.id]);
        setActiveTool('select'); // Switch to select to edit easily
      }
    } else if (['arrow', 'dashed-arrow', 'zone-line'].includes(activeTool)) {
      (e.target as Element).setPointerCapture(e.pointerId);
      setDrawingLine({
        id: `line-${Date.now()}`,
        type: activeTool,
        startX: x,
        startY: y,
        endX: x,
        endY: y,
        color: activeColor,
        thickness: 2
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
      } else if (activeResizeId && resizeStartRef.current) {
        const { id, corner, initialScale, initialDist, elX, elY, initialW, initialH, startX, startY, elRotation } = resizeStartRef.current;
        
        if (corner === 'line-start') {
           setLines(prev => prev.map(l => l.id === id ? { ...l, startX: Math.max(0, Math.min(100, x)), startY: Math.max(0, Math.min(100, y)) } : l));
        } else if (corner === 'line-end') {
           setLines(prev => prev.map(l => l.id === id ? { ...l, endX: Math.max(0, Math.min(100, x)), endY: Math.max(0, Math.min(100, y)) } : l));
        } else if (corner && initialW !== undefined && initialH !== undefined && startX !== undefined && startY !== undefined) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          // Convert screen pixels to virtual val units (where 500 val = rect.width)
          const scaleFactor = 500 / rect.width;
          const dxVal = dx * scaleFactor;
          const dyVal = dy * scaleFactor;

          const angle = -(elRotation || 0) * Math.PI / 180;
          const localDx = dxVal * Math.cos(angle) - dyVal * Math.sin(angle);
          const localDy = dxVal * Math.sin(angle) + dyVal * Math.cos(angle);

          let newW = initialW;
          let newH = initialH;

          if (corner === 'br') {
            newW = initialW + localDx * 2;
            newH = initialH + localDy * 2;
          } else if (corner === 'bl') {
            newW = initialW - localDx * 2;
            newH = initialH + localDy * 2;
          } else if (corner === 'tr') {
            newW = initialW + localDx * 2;
            newH = initialH - localDy * 2;
          } else if (corner === 'tl') {
            newW = initialW - localDx * 2;
            newH = initialH - localDy * 2;
          }

          newW = Math.max(10, newW);
          newH = Math.max(10, newH);

          setElements(prev => prev.map(el => el.id === id ? { ...el, width: newW, height: newH } : el));
        } else {
          const dx = x - elX;
          const dy = y - elY;
          const currentDist = Math.sqrt(dx*dx + dy*dy);
          if (initialDist > 0) {
            let newScale = initialScale * (currentDist / initialDist);
            newScale = Math.max(0.2, Math.min(10, newScale));
            setElements(prev => prev.map(el => el.id === id ? { ...el, scale: newScale } : el));
          }
        }
      } else if (selectionBox && activeTool === 'select') {
        setSelectionBox(prev => prev ? { ...prev, currentX: x, currentY: y } : null);
      } else if (activeDragId && activeTool === 'select') {
        hasDraggedRef.current = true;
        
        if (activeDragLastPosRef.current) {
          const dx = x - activeDragLastPosRef.current.x;
          const dy = y - activeDragLastPosRef.current.y;
          
          if (activeDragId.startsWith('line-')) {
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
              if (selectedElementIds.includes(el.id)) {
                return { ...el, x: Math.max(0, Math.min(100, el.x + dx)), y: Math.max(0, Math.min(100, el.y + dy)) };
              }
              return el;
            }));
          }
          activeDragLastPosRef.current = { x, y };
        } else {
          if (!activeDragId.startsWith('line-')) {
            setElements(prev => prev.map(el => el.id === activeDragId ? { ...el, x, y } : el));
          }
        }
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
      if (selectionBox) {
        const minX = Math.min(selectionBox.startX, selectionBox.currentX);
        const maxX = Math.max(selectionBox.startX, selectionBox.currentX);
        const minY = Math.min(selectionBox.startY, selectionBox.currentY);
        const maxY = Math.max(selectionBox.startY, selectionBox.currentY);
        
        // Find elements within this box
        const selectedIds = elements
          .filter(el => el.x >= minX && el.x <= maxX && el.y >= minY && el.y <= maxY)
          .map(el => el.id);
          
        if (selectedIds.length > 0) {
          setSelectedElementIds(selectedIds);
        }
        setSelectionBox(null);
      }
      if (activeDragId) {
        setActiveDragId(null);
        activeDragLastPosRef.current = null;
      }
      if (activeResizeId) {
        setActiveResizeId(null);
        resizeStartRef.current = null;
      }
    };

    if (drawingLine || activeDragId || activeResizeId || selectionBox) {
      document.addEventListener('pointermove', handlePointerMove);
      document.addEventListener('pointerup', handlePointerUp);
      document.addEventListener('pointercancel', handlePointerUp);
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
      document.removeEventListener('pointercancel', handlePointerUp);
    };
  }, [drawingLine, selectionBox, activeDragId, activeResizeId, activeTool, elements, selectedElementIds]);

  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    saveState();
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (activeTool === 'select') {
      try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) {}
      hasDraggedRef.current = false;
      setActiveDragId(id);
      
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        activeDragLastPosRef.current = { x, y };
      }

      setSelectedLineId(null);
      
      if (!selectedElementIds.includes(id)) {
        if (e.shiftKey) {
          setSelectedElementIds(prev => [...prev, id]);
        } else {
          setSelectedElementIds([id]);
        }
      } else if (e.shiftKey) {
        setSelectedElementIds(prev => prev.filter(i => i !== id));
      }
    }
  };

  const handleResizePointerDown = (e: React.PointerEvent, id: string, corner?: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (activeTool === 'select') {
      try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) {}
      setActiveResizeId(id);
      setSelectedElementIds([id]);
      
      const el = elements.find(e => e.id === id);
      if (!el || !boardRef.current) return;
      
      const rect = boardRef.current.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * 100;
      const y = ((e.clientY - rect.top) / rect.height) * 100;
      
      const dx = x - el.x;
      const dy = y - el.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      
      resizeStartRef.current = { 
        id, corner, 
        initialScale: el.scale || 1, 
        initialDist: dist, 
        elX: el.x, elY: el.y,
        initialW: el.width || (40 * (el.scale || 1)),
        initialH: el.height || (40 * (el.scale || 1)),
        startX: e.clientX,
        startY: e.clientY,
        elRotation: el.rotation || 0
      };
    }
  };

  const handleLineResizePointerDown = (e: React.PointerEvent, id: string, point: string) => {
    saveState();
    if (activeTool !== 'select') return;
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) {}
    setActiveResizeId(id);
    setSelectedLineId(id);
    setSelectedElementIds([]);
    resizeStartRef.current = { id, corner: point, initialScale: 1, initialDist: 0, elX: 0, elY: 0 };
  };

  const handleLinePointerDown = (e: React.PointerEvent, id: string) => {
    saveState();
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (activeTool === 'select') {
      try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) {}
      setSelectedLineId(id);
      setSelectedElementIds([]);
      hasDraggedRef.current = false;
      setActiveDragId(id);
      
      const rect = boardRef.current?.getBoundingClientRect();
      if (rect) {
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        activeDragLastPosRef.current = { x, y };
      }
    }
  };

  // Modifiers - Elements
  const rotateElement = (ids: string[], delta: number) => {
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, rotation: (e.rotation + delta) % 360 } : e));
  };

  const scaleElement = (ids: string[], delta: number) => {
    setElements(elements.map(e => {
      if (!ids.includes(e.id)) return e;
      if (['shape-circle', 'shape-square'].includes(e.type)) {
        const currentW = e.width || (40 * (e.scale || 1));
        const currentH = e.height || (40 * (e.scale || 1));
        const factor = 1 + (delta * 0.5);
        return { ...e, width: currentW * factor, height: currentH * factor };
      }
      return { ...e, scale: Math.max(0.5, Math.min(4, (e.scale || 1) + delta)) };
    }));
  };

  const removeElement = (ids: string[]) => {
    setElements(elements.filter(e => !ids.includes(e.id)));
    setSelectedElementIds([]);
  };

  const updateElementText = (ids: string[], text: string) => {
    saveState();
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, text } : e));
  };

  const duplicateElement = (ids: string[]) => {
    saveState();
    const elsToCopy = elements.filter(e => ids.includes(e.id));
    if (elsToCopy.length > 0) {
      const now = Date.now();
      const newEls = elsToCopy.map((el, i) => ({
        ...el,
        id: `el-${now}-${i}`,
        x: Math.min(95, el.x + 5),
        y: Math.min(95, el.y + 5)
      }));
      setElements([...elements, ...newEls]);
      setSelectedElementIds(newEls.map(e => e.id));
    }
  };

  const duplicateElementSequence = (ids: string[]) => {
    saveState();
    const elsToCopy = elements.filter(e => ids.includes(e.id));
    if (elsToCopy.length > 0) {
      const newElements: any[] = [];
      const now = Date.now();
      elsToCopy.forEach((elToCopy, index) => {
        for (let i = 1; i <= 3; i++) {
          newElements.push({
            ...elToCopy,
            id: `el-${now}-${index}-${i}`,
            x: Math.min(95, elToCopy.x + (5 * i)),
            y: elToCopy.y
          });
        }
      });
      setElements([...elements, ...newElements]);
    }
  };

  const toggleElementFill = (ids: string[]) => {
    saveState();
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, filled: !e.filled } : e));
  };

  const toggleElementDashed = (ids: string[]) => {
    saveState();
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, dashed: !e.dashed } : e));
  };

  const updateElementThickness = (ids: string[], thickness: number) => {
    saveState();
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, thickness } : e));
  };

  const toggleAbpMarking = (ids: string[], marking: 'Z' | 'H' | '') => {
    saveState();
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, abp_marking: marking } : e));
  };

  // Keyboard shortcuts (Supr/Backspace: eliminar, Ctrl/Cmd+D: duplicar, Esc: deseleccionar)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // No interferir si el usuario está escribiendo en un campo de texto
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) {
        return;
      }

      if (e.key === 'Escape') {
        setSelectedElementIds([]);
        setSelectedLineId(null);
        return;
      }

      if (selectedElementIds.length === 0) return;

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        removeElement(selectedElementIds);
      } else if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D')) {
        e.preventDefault();
        duplicateElement(selectedElementIds);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedElementIds, elements]);

  // Modifiers - Lines
  const removeLine = (id: string) => {
    setLines(lines.filter(l => l.id !== id));
    if (selectedLineId === id) setSelectedLineId(null);
  };

  const updateLineColor = (id: string, color: string) => {
    setLines(lines.map(l => l.id === id ? { ...l, color } : l));
  };

  const updateLineCurve = (id: string, delta: number) => {
    setLines(lines.map(l => l.id === id ? { ...l, curve: (l.curve || 0) + delta } : l));
  };

  const updateLineThickness = (id: string, thickness: number) => {
    setLines(lines.map(l => l.id === id ? { ...l, thickness } : l));
  };

  const hexToRgba = (hex: string, alpha: number) => {
    if (!hex || !hex.startsWith('#')) return hex;
    const r = parseInt(hex.slice(1, 3), 16) || 0;
    const g = parseInt(hex.slice(3, 5), 16) || 0;
    const b = parseInt(hex.slice(5, 7), 16) || 0;
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // --- RENDERING ---

  const renderFieldBackground = () => {
    // Coordenadas a escala real (metros). Campo 68 ancho x 105 largo.
    const viewBox = fieldType === 'full'
      ? '0 0 68 105'
      : (fieldType === 'half' || fieldType === 'half-top')
        ? '0 0 68 52.5'
        : '0 0 68 68';

    const lineProps = {
      stroke: 'rgba(0,0,0,0.9)',
      strokeWidth: 0.28,
      fill: 'none' as const,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    };
    
    const circleFill = 'black';

    return (
      <div className="absolute inset-0 overflow-hidden" style={{ background: 'white' }}>
        {/* Fondo blanco sólido para el campo */}
        <div className="absolute inset-0 bg-white" />
        
        <div className="absolute inset-0 border border-black/30" />

        {fieldType !== 'blank' && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
            <g {...lineProps}>
              {fieldType === 'full' && (
              <>
                {/* Perímetro y línea de medio campo */}
                <rect x="1" y="1" width="66" height="103" />
                <line x1="1" y1="52.5" x2="67" y2="52.5" />
                <circle cx="34" cy="52.5" r="9.15" />
                <circle cx="34" cy="52.5" r="0.35" fill={circleFill} />

                {/* Área superior */}
                <rect x="13.84" y="1" width="40.32" height="16.5" />
                <rect x="24.84" y="1" width="18.32" height="5.5" />
                <circle cx="34" cy="12" r="0.35" fill={circleFill} />
                <path d="M 26.69 17.5 A 9.15 9.15 0 0 0 41.31 17.5" />
                <rect x="30.34" y="-0.4" width="7.32" height="1.4" fill={printMode ? 'transparent' : 'rgba(0,0,0,0.12)'} />

                {/* Área inferior */}
                <rect x="13.84" y="87.5" width="40.32" height="16.5" />
                <rect x="24.84" y="98.5" width="18.32" height="5.5" />
                <circle cx="34" cy="93" r="0.35" fill={circleFill} />
                <path d="M 26.69 87.5 A 9.15 9.15 0 0 1 41.31 87.5" />
                <rect x="30.34" y="104" width="7.32" height="1.4" fill={printMode ? 'transparent' : 'rgba(0,0,0,0.12)'} />

                {/* Córners */}
                <path d="M 2 1 A 1 1 0 0 0 1 2" />
                <path d="M 66 1 A 1 1 0 0 1 67 2" />
                <path d="M 1 103 A 1 1 0 0 1 2 104" />
                <path d="M 67 103 A 1 1 0 0 0 66 104" />
              </>
            )}
            {fieldType === 'half' && (
              <>
                {/* Perímetro (borde superior = línea de medio campo) */}
                <rect x="1" y="1" width="66" height="50.5" />
                <path d="M 24.85 1 A 9.15 9.15 0 0 0 43.15 1" />
                <circle cx="34" cy="1" r="0.35" fill={circleFill} />

                {/* Área (portería abajo) */}
                <rect x="13.84" y="35" width="40.32" height="16.5" />
                <rect x="24.84" y="46" width="18.32" height="5.5" />
                <circle cx="34" cy="40.5" r="0.35" fill={circleFill} />
                <path d="M 26.69 35 A 9.15 9.15 0 0 1 41.31 35" />
                <rect x="30.34" y="51.5" width="7.32" height="1.4" fill={printMode ? 'transparent' : 'rgba(0,0,0,0.12)'} />

                {/* Córners inferiores */}
                <path d="M 1 50.5 A 1 1 0 0 1 2 51.5" />
                <path d="M 67 50.5 A 1 1 0 0 0 66 51.5" />
              </>
            )}
            {fieldType === 'half-top' && (
              <>
                {/* Perímetro (borde inferior = línea de medio campo) */}
                <rect x="1" y="1" width="66" height="50.5" />
                <path d="M 24.85 51.5 A 9.15 9.15 0 0 1 43.15 51.5" />
                <circle cx="34" cy="51.5" r="0.35" fill={circleFill} />

                {/* Área (portería arriba) */}
                <rect x="13.84" y="1" width="40.32" height="16.5" />
                <rect x="24.84" y="1" width="18.32" height="5.5" />
                <circle cx="34" cy="12" r="0.35" fill={circleFill} />
                <path d="M 26.69 17.5 A 9.15 9.15 0 0 0 41.31 17.5" />
                <rect x="30.34" y="-0.4" width="7.32" height="1.4" fill={printMode ? 'transparent' : 'rgba(0,0,0,0.12)'} />

                {/* Córners superiores */}
                <path d="M 2 1 A 1 1 0 0 0 1 2" />
                <path d="M 66 1 A 1 1 0 0 1 67 2" />
              </>
            )}
          </g>
        </svg>
        )}
      </div>
    );
  };

  const getPrintColor = (c: string) => {
    return c;
  };

  const px = (val: number) => {
    // Usamos SIEMPRE el ancho real medido del campo (fittedW), tanto en el editor
    // como en la impresión, para que los elementos guarden exactamente la misma
    // proporción respecto al campo que se ve en el editor.
    // Solo si aún no hay medida (p.ej. impresión del navegador con display:none)
    // recurrimos al printWidth fijo como aproximación, y en último caso a cqw.
    let baseW = fittedW;
    if (baseW === 0 && printMode && printWidth) baseW = printWidth;
    if (baseW === 0) return `${(val / 5)}cqw`;

    // Si el campo está rotado, el baseW (que es el ancho del contenedor horizontal)
    // no corresponde al ancho lógico del campo interior (que es el lado corto).
    // El contenedor interior rotado (-90deg) tiene un ancho físico equivalente a baseW * (68/105).
    if (isRotated) {
      baseW = baseW * (68 / 105);
    } else if (isCropped) {
      // Si el campo está recortado (modo blank en impresión), el contenedor interior
      // se amplía artificialmente multiplicándolo por (100 / cropWidth).
      // Debemos aplicar el mismo factor a baseW para que los elementos escalen proporcionalmente.
      baseW = baseW * (100 / cropWidth);
    }

    return `${(val * baseW) / 500}px`;
  };

  const renderElement = (el: BoardElement) => {
    const isSelected = selectedElementIds.includes(el.id);
    const isShape = ['shape-circle', 'shape-square'].includes(el.type);
    
    const displayColor = getPrintColor(el.color);
    
    // Scale is only applied via the user's manual element scale now,
    // since container queries (cqw) handle adaptive screen/print scaling!
    const manualScale = el.scale || 1;
    
    let baseZIndex = 2;
    if (isShape) baseZIndex = 1;
    else if (['player', 'ball'].includes(el.type)) baseZIndex = 3;
    else if (el.type === 'text') baseZIndex = 4;
    
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: `translate(-50%, -50%) rotate(${el.rotation}deg) ${isShape ? '' : `scale(${manualScale})`}`,
      cursor: activeTool === 'select' ? (activeDragId === el.id ? 'grabbing' : 'grab') : 'default',
      filter: isSelected ? 'drop-shadow(0 0 0px #fff) drop-shadow(0 0 4px #dc2626)' : 'none',
      zIndex: isSelected ? 10 : baseZIndex,
      touchAction: 'none'
    };

    let content = null;
    
    switch (el.type) {
      case 'player':
        content = (
          <div className="relative flex items-center justify-center">
            <div style={{
              width: px(24), height: px(24), borderRadius: '50%',
              background: printMode ? displayColor : `radial-gradient(circle at 30% 30%, ${displayColor}, #111)`,
              border: `2px solid ${printMode ? '#000' : 'rgba(255,255,255,0.8)'}`,
              boxShadow: printMode ? 'none' : '2px 2px 4px rgba(0,0,0,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: ['#ffffff', '#ffeb3b'].includes(el.color.toLowerCase()) ? '#000' : '#fff',
              fontWeight: 'bold', fontSize: px(12),
              fontFamily: 'sans-serif'
            }}>
              {el.text}
            </div>
            {el.abp_marking && (
              <div style={{
                position: 'absolute', top: px(-10), right: px(-10),
                width: px(16), height: px(16), borderRadius: '50%',
                background: el.abp_marking === 'Z' ? '#3b82f6' : '#ef4444',
                color: '#fff', fontSize: px(10), fontWeight: 'bold',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                border: '1px solid #fff'
              }}>
                {el.abp_marking}
              </div>
            )}
          </div>
        );
        break;
      case 'cone':
        content = (
          <svg width={px(14)} height={px(14)} viewBox="0 0 20 20" style={{ filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.5))' }}>
            <path d="M 1 10 A 9 9 0 1 0 19 10 A 9 9 0 1 0 1 10 Z M 8 10 A 2 2 0 1 1 12 10 A 2 2 0 1 1 8 10 Z" fill={displayColor} fillRule="evenodd" />
            <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <circle cx="10" cy="10" r="2" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
          </svg>
        );
        break;
      case 'cone-tall':
        content = (
          <svg width={px(20)} height={px(24)} viewBox="0 0 20 24" style={{ filter: printMode ? 'none' : 'drop-shadow(2px 2px 2px rgba(0,0,0,0.4))' }}>
            <rect x="1" y="20" width="18" height="3" rx="1" fill={displayColor} filter={printMode ? undefined : "brightness(0.8)"} />
            <ellipse cx="10" cy="20" rx="7" ry="2" fill={displayColor} filter={printMode ? undefined : "brightness(0.9)"} />
            <path d="M 4 20 L 8 2 L 12 2 L 16 20 Z" fill={displayColor} />
            <ellipse cx="10" cy="2" rx="2" ry="1" fill={displayColor} filter={printMode ? undefined : "brightness(1.2)"} />
          </svg>
        );
        break;
      case 'pole':
        content = (
          <div className="relative flex flex-col items-center justify-end" style={{ filter: printMode ? 'none' : 'drop-shadow(2px 2px 3px rgba(0,0,0,0.4))' }}>
            <div className="rounded-t-sm" style={{ width: px(2), height: px(40), background: printMode ? displayColor : `linear-gradient(90deg, #fff 0%, ${displayColor} 40%, ${displayColor} 60%, #333 100%)` }} />
            <div className="rounded-t-full bg-black border-b border-gray-700 z-10" style={{ width: px(16), height: px(6) }} />
          </div>
        );
        break;
      case 'hurdle':
        content = (
          <div className="relative" style={{ width: px(32), height: px(12), color: displayColor, filter: printMode ? 'none' : 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))' }}>
            <div className="absolute top-0 w-full bg-current" style={{ height: px(3) }} />
            <div className="absolute left-[5%] bg-gray-300" style={{ top: px(3), width: px(3), height: px(8) }} />
            <div className="absolute right-[5%] bg-gray-300" style={{ top: px(3), width: px(3), height: px(8) }} />
          </div>
        );
        break;
      case 'hurdle-high':
        content = (
          <div className="relative" style={{ width: px(32), height: px(20), color: displayColor, filter: printMode ? 'none' : 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))' }}>
            <div className="absolute top-0 w-full bg-current" style={{ height: px(3) }} />
            <div className="absolute left-[5%] bg-gray-300" style={{ top: px(3), width: px(3), height: px(16) }} />
            <div className="absolute right-[5%] bg-gray-300" style={{ top: px(3), width: px(3), height: px(16) }} />
          </div>
        );
        break;
      case 'goal':
        content = (
          <svg width={px(60)} height={px(24)} viewBox="0 0 60 24" style={{ filter: printMode ? 'none' : 'drop-shadow(0px 3px 3px rgba(0,0,0,0.3))' }}>
            <path d="M 5 3 L 55 3 L 57 19 L 3 19 Z" fill="url(#net-pattern)" stroke="#111827" strokeWidth="2" strokeLinejoin="round" />
            <path d="M 1 20 L 59 20" stroke="#111827" strokeWidth="4" strokeLinecap="round" />
          </svg>
        );
        break;
      case 'mini-goal':
        content = (
          <svg width={px(24)} height={px(16)} viewBox="0 0 24 16" style={{ filter: printMode ? 'none' : 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' }}>
            <path d="M 3 2 L 21 2 L 22 11 L 2 11 Z" fill="url(#net-pattern)" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 1 12 L 23 12" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
        break;
      case 'goal-f11':
        content = (
          <svg width={px(73.2)} height={px(20)} viewBox="0 0 73.2 20" style={{ filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.3))' }}>
            <path d="M 4 2 L 69.2 2 L 71 16 L 2 16 Z" fill="url(#net-pattern)" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 1 17 L 72.2 17" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
        break;
      case 'goal-f8':
        content = (
          <svg width={px(40)} height={px(16)} viewBox="0 0 40 16" style={{ filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.3))' }}>
            <path d="M 3 2 L 37 2 L 38 12 L 2 12 Z" fill="url(#net-pattern)" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 1 13 L 39 13" stroke="#111827" strokeWidth="3" strokeLinecap="round" />
          </svg>
        );
        break;
      case 'goal-f5':
        content = (
          <svg width={px(30)} height={px(12)} viewBox="0 0 30 12" style={{ filter: 'drop-shadow(0px 2px 2px rgba(0,0,0,0.3))' }}>
            <path d="M 2 2 L 28 2 L 29 9 L 1 9 Z" fill="url(#net-pattern)" stroke="#111827" strokeWidth="1.5" strokeLinejoin="round" />
            <path d="M 1 10 L 29 10" stroke="#111827" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        );
        break;
      case 'shape-square':
        content = (
          <div style={{
            width: el.width ? px(el.width) : px(40 * manualScale),
            height: el.height ? px(el.height) : px(40 * manualScale),
            minWidth: el.width ? px(el.width) : px(40 * manualScale),
            minHeight: el.height ? px(el.height) : px(40 * manualScale),
            boxSizing: 'border-box',
            border: `${px(el.thickness || 2)} ${el.dashed ? 'dashed' : 'solid'} ${displayColor}`,
            backgroundColor: el.filled ? hexToRgba(displayColor, 0.25) : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: displayColor, fontSize: px(12), fontWeight: 'bold'
          }}>
            {el.text}
          </div>
        );
        break;
      case 'shape-circle':
        content = (
          <div style={{
            width: el.width ? px(el.width) : px(40 * manualScale),
            height: el.height ? px(el.height) : px(40 * manualScale),
            minWidth: el.width ? px(el.width) : px(40 * manualScale),
            minHeight: el.height ? px(el.height) : px(40 * manualScale),
            boxSizing: 'border-box',
            borderRadius: '50%',
            border: `${px(el.thickness || 2)} ${el.dashed ? 'dashed' : 'solid'} ${displayColor}`,
            backgroundColor: el.filled ? hexToRgba(displayColor, 0.25) : 'transparent',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: displayColor, fontSize: px(12), fontWeight: 'bold'
          }}>
            {el.text}
          </div>
        );
        break;
      case 'ring':
        content = <div style={{
          width: px(24), height: px(24), borderRadius: '50%',
          border: `${px(3)} solid ${displayColor}`,
          boxShadow: printMode ? 'none' : '1px 2px 3px rgba(0,0,0,0.4), inset 1px 2px 3px rgba(0,0,0,0.4)'
        }} />;
        break;
      case 'bosu':
        content = (
          <div className="relative" style={{ width: px(32), height: px(32), filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))' }}>
            <div className="absolute inset-0 rounded-full" style={{ background: `radial-gradient(circle at 30% 30%, ${displayColor}, #000)`, opacity: 0.9 }} />
            <div className="absolute bg-black rounded-b-full opacity-80" style={{ left: '10%', right: '10%', bottom: '10%', height: px(8) }} />
            <div className="absolute inset-0 rounded-full border border-white/20" style={{ backgroundImage: 'radial-gradient(rgba(255,255,255,0.3) 1px, transparent 1px)', backgroundSize: '4px 4px' }} />
          </div>
        );
        break;
      case 'bosu-profile':
        content = (
          <div className="relative" style={{ width: px(40), height: px(20), filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))' }}>
            <div className="absolute rounded-t-full border-b-2 border-black" style={{ bottom: px(4), width: '100%', height: px(16), background: `radial-gradient(circle at top, ${displayColor}, #222)` }} />
            <div className="absolute bottom-0 bg-black rounded-full" style={{ width: '100%', height: px(6) }} />
          </div>
        );
        break;
      case 'ladder':
        content = (
          <svg width={px(24)} height={px(120)} viewBox="0 0 24 120" style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.5))' }}>
            <rect x="0" y="0" width="3" height="120" fill={displayColor} />
            <rect x="21" y="0" width="3" height="120" fill={displayColor} />
            <rect x="3" y="10" width="18" height="2" fill={displayColor} />
            <rect x="3" y="30" width="18" height="2" fill={displayColor} />
            <rect x="3" y="50" width="18" height="2" fill={displayColor} />
            <rect x="3" y="70" width="18" height="2" fill={displayColor} />
            <rect x="3" y="90" width="18" height="2" fill={displayColor} />
            <rect x="3" y="110" width="18" height="2" fill={displayColor} />
          </svg>
        );
        break;
      case 'ball':
        content = (
          <div style={{ width: px(16), height: px(16), filter: printMode ? 'none' : 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))' }}>
            <TiroLeagueBall />
          </div>
        );
        break;
      case 'text':
        content = (
          <div style={{ color: displayColor, fontSize: px(18), fontWeight: 'bold', whiteSpace: 'nowrap', textShadow: printMode ? 'none' : '0 1px 3px rgba(0,0,0,0.8)' }}>
            {el.text}
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
        {isSelected && activeTool === 'select' && ['shape-circle', 'shape-square'].includes(el.type) && (
           <>
             <div 
               className="absolute top-0 left-0 bg-white border border-brand-red-600 shadow-md" 
               style={{ 
                 width: '12px', height: '12px', borderRadius: el.type === 'shape-circle' ? '50%' : '2px',
                 transform: `translate(-50%, -50%)`,
                 cursor: 'nwse-resize'
               }} 
               onPointerDown={(e) => handleResizePointerDown(e, el.id, 'tl')}
             />
             <div 
               className="absolute top-0 right-0 bg-white border border-brand-red-600 shadow-md" 
               style={{ 
                 width: '12px', height: '12px', borderRadius: el.type === 'shape-circle' ? '50%' : '2px',
                 transform: `translate(50%, -50%)`,
                 cursor: 'nesw-resize'
               }} 
               onPointerDown={(e) => handleResizePointerDown(e, el.id, 'tr')}
             />
             <div 
               className="absolute bottom-0 left-0 bg-white border border-brand-red-600 shadow-md" 
               style={{ 
                 width: '12px', height: '12px', borderRadius: el.type === 'shape-circle' ? '50%' : '2px',
                 transform: `translate(-50%, 50%)`,
                 cursor: 'nesw-resize'
               }} 
               onPointerDown={(e) => handleResizePointerDown(e, el.id, 'bl')}
             />
             <div 
               className="absolute bottom-0 right-0 bg-white border border-brand-red-600 shadow-md" 
               style={{ 
                 width: '12px', height: '12px', borderRadius: el.type === 'shape-circle' ? '50%' : '2px',
                 transform: `translate(50%, 50%)`,
                 cursor: 'nwse-resize'
               }} 
               onPointerDown={(e) => handleResizePointerDown(e, el.id, 'br')}
             />
           </>
        )}
      </div>
    );
  };

  const renderLines = () => {
    const allLines = [...lines];
    if (drawingLine) allLines.push(drawingLine);

    return (
      <svg viewBox={`0 0 ${boardSize.width} ${boardSize.height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 20, overflow: 'visible' }}>
        <defs>
          <pattern id="net-pattern" width="4" height="4" patternUnits="userSpaceOnUse">
            <path d="M 4 0 L 4 4 L 0 4" fill="none" stroke="#1e40af" strokeWidth="0.8" />
          </pattern>
          <marker id="arrowhead-white" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <polygon points="0 0, 6 3, 0 6" fill={printMode ? "black" : "white"} />
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
          const lineColor = getPrintColor(line.color);
          
          let markerEnd = "none";
          if (lineColor === '#000000') markerEnd = 'url(#arrowhead-black)';
          else if (lineColor === '#ef4444') markerEnd = 'url(#arrowhead-red)';
          else if (lineColor === '#3b82f6') markerEnd = 'url(#arrowhead-blue)';
          else if (lineColor === '#f59e0b') markerEnd = 'url(#arrowhead-yellow)';
          else markerEnd = 'url(#arrowhead-white)';
          
          let strokeDasharray = "none";
          let strokeWidth = (line.thickness || 1) * 0.5; // Base visual scaling
          let filter = isSelected ? 'drop-shadow(0 0 3px red)' : 'drop-shadow(1px 2px 2px rgba(0,0,0,0.5))';
          if (printMode) filter = 'none'; // html2canvas drops shadows badly

          if (line.type === 'dashed-arrow') {
            strokeDasharray = "1.5, 1.5";
          } else if (line.type === 'zone-line') {
            strokeDasharray = "3, 2";
            strokeWidth = (line.thickness || 1) * 0.8; 
            filter = 'none'; 
            markerEnd = 'none'; // Las zonas no llevan flecha por defecto
          }

          const isCurved = !!line.curve && line.curve !== 0;
          const px1 = (line.startX / 100) * boardSize.width;
          const py1 = (line.startY / 100) * boardSize.height;
          const px2 = (line.endX / 100) * boardSize.width;
          const py2 = (line.endY / 100) * boardSize.height;

          let d = `M ${px1} ${py1} L ${px2} ${py2}`;

          if (isCurved) {
            const mx = (px1 + px2) / 2;
            const my = (py1 + py2) / 2;
            const dx = px2 - px1;
            const dy = py2 - py1;
            const len = Math.sqrt(dx*dx + dy*dy) || 1;
            const nx = -dy / len;
            const ny = dx / len;
            const cx = mx + nx * (line.curve || 0) * 15;
            const cy = my + ny * (line.curve || 0) * 15;
            d = `M ${px1} ${py1} Q ${cx} ${cy} ${px2} ${py2}`;
          }

          return (
            <g 
              key={line.id} 
              className={activeTool === 'select' ? 'pointer-events-auto cursor-pointer' : 'pointer-events-none'}
              onPointerDown={(e) => handleLinePointerDown(e, line.id)}
            >
              <path 
                d={d}
                stroke="transparent" strokeWidth="15" fill="none"
              />
              <path 
                d={d}
                stroke={lineColor} 
                strokeWidth={strokeWidth} 
                strokeDasharray={strokeDasharray}
                markerEnd={markerEnd}
                filter={filter}
                fill="none"
              />
              {isSelected && activeTool === 'select' && (
                <>
                  <circle cx={px1} cy={py1} r="6" fill="white" stroke="#dc2626" strokeWidth="2" cursor="move" onPointerDown={(e) => handleLineResizePointerDown(e, line.id, 'line-start')} />
                  <circle cx={px2} cy={py2} r="6" fill="white" stroke="#dc2626" strokeWidth="2" cursor="move" onPointerDown={(e) => handleLineResizePointerDown(e, line.id, 'line-end')} />
                </>
              )}
            </g>
          );
        })}
      </svg>
    );
  };

  const ToolButton = ({ tool, icon, label, bg = false, hideLabel = false }: { tool: ToolType, icon: React.ReactNode, label: string, bg?: boolean, hideLabel?: boolean }) => {
    const isActive = activeTool === tool;
    return (
      <button 
        onClick={() => setActiveTool(tool)} 
        className={`p-1.5 rounded flex flex-col items-center justify-center gap-1 transition-colors ${isActive ? 'bg-brand-red-600 text-white shadow-glow-red' : bg ? 'bg-brand-black hover:bg-brand-black-hover text-brand-gray-light' : 'text-brand-gray-muted hover:text-white'}`}
        title={label}
      >
        {icon}
        {label && !hideLabel && <span className="text-[9px] uppercase font-bold tracking-wider hidden lg:block">{label}</span>}
      </button>
    );
  };

  const ColorButton = ({ color }: { color: string }) => {
    const isActive = activeColor === color;
    return (
      <button 
        onClick={() => {
          setActiveColor(color);
          if (selectedElementIds.length > 0) {
            saveState();
            setElements(prev => prev.map(e => selectedElementIds.includes(e.id) ? { ...e, color } : e));
          }
        }}
        className={`w-6 h-6 rounded-full border-2 transition-transform ${isActive ? 'scale-110 border-brand-red-600' : 'border-brand-black-border hover:scale-105'}`}
        style={{ backgroundColor: color }}
      />
    );
  };

  const selectedElement = selectedElementIds.length === 1 ? elements.find(e => e.id === selectedElementIds[0]) : null;
  const hasSelection = selectedElementIds.length > 0;
  const selectedLine = lines.find(l => l.id === selectedLineId);

    // --- Lógica de Cropping (solo en printMode y fieldType === 'blank') ---
    const isCropped = printMode && fieldType === 'blank';
    let cropBox = { minX: 0, maxX: 100, minY: 0, maxY: 100 };
    
    if (isCropped && (elements.length > 0 || lines.length > 0)) {
        let minX = 100, maxX = 0, minY = 100, maxY = 0;
        elements.forEach(el => {
          const halfW = el.width ? (el.width / 5) / 2 : (40 * (el.scale || 1) / 5) / 2;
          const halfH = el.height ? (el.height / 5) / 2 : (40 * (el.scale || 1) / 5) / 2;
          
          if (el.x - halfW < minX) minX = el.x - halfW;
          if (el.x + halfW > maxX) maxX = el.x + halfW;
          if (el.y - halfH < minY) minY = el.y - halfH;
          if (el.y + halfH > maxY) maxY = el.y + halfH;
        });
        lines.forEach(line => {
          if (line.startX < minX) minX = line.startX;
          if (line.startX > maxX) maxX = line.startX;
          if (line.startY < minY) minY = line.startY;
          if (line.startY > maxY) maxY = line.startY;
          if (line.endX < minX) minX = line.endX;
          if (line.endX > maxX) maxX = line.endX;
          if (line.endY < minY) minY = line.endY;
          if (line.endY > maxY) maxY = line.endY;
        });
        
        minX = Math.max(0, minX - 5);
        maxX = Math.min(100, maxX + 5);
        minY = Math.max(0, minY - 5);
        maxY = Math.min(100, maxY + 5);
        
        if (maxX - minX < 10) { minX = 0; maxX = 100; }
        if (maxY - minY < 10) { minY = 0; maxY = 100; }
        cropBox = { minX, maxX, minY, maxY };
    }
    
    const cropWidth = cropBox.maxX - cropBox.minX;
    const cropHeight = cropBox.maxY - cropBox.minY;
    const isRotated = rotateFullField && fieldType === 'full';
    
    let containerAspect = fieldType === 'full' ? '68 / 105' : fieldType === 'half' || fieldType === 'half-top' ? '136 / 105' : '1 / 1';
    if (isRotated) containerAspect = '105 / 68';
    if (isCropped) containerAspect = `${cropWidth} / ${cropHeight}`;

    // Relación ancho/alto numérica del campo, para el ajuste "contain" en pantalla.
    const aspectRatioNum = isRotated
      ? 105 / 68
      : isCropped
        ? cropWidth / cropHeight
        : fieldType === 'full'
          ? 68 / 105
          : (fieldType === 'half' || fieldType === 'half-top')
            ? 136 / 105
            : 1;

    // Calcular el tamaño del campo que cabe entero dentro del espacio disponible,
    // conservando la proporción. Así el campo nunca se recorta ni se amplía, y la
    // caja de referencia coincide con lo que se ve (los elementos se colocan bien).
    let fittedW = 0, fittedH = 0;
    if (availSize.width > 0 && availSize.height > 0) {
      let pX = 0, pY = 0;
      if (fitContainerRef.current) {
        const style = window.getComputedStyle(fitContainerRef.current);
        pX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
        pY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
      }
      const contentW = availSize.width - pX;
      const contentH = availSize.height - pY;
      
      const containerRatio = contentW / contentH;
      if (containerRatio > aspectRatioNum) {
        // El contenedor es más ancho que el campo → limita la altura
        fittedH = contentH;
        fittedW = fittedH * aspectRatioNum;
      } else {
        // El contenedor es más estrecho → limita la anchura
        fittedW = contentW;
        fittedH = fittedW / aspectRatioNum;
      }
    }

  return (
    <div className={`flex flex-row gap-2 sm:gap-4 h-full min-h-[300px] lg:min-h-[500px] ${printMode ? 'w-full !h-full !min-h-0' : ''}`}>

      {/* Sidebar Tools: franja lateral estrecha en móvil/tablet, panel ancho en escritorio */}
      {!hideToolbar && (
        <div className="w-20 lg:w-48 shrink-0 bg-brand-black-card border border-brand-black-border rounded-xl p-2 flex flex-col gap-2 overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-center gap-1">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="Mover" bg={true} />
          <button onClick={handleUndo} disabled={history.length === 0} className={`p-1.5 rounded flex flex-col items-center justify-center gap-1 transition-colors ${history.length === 0 ? 'opacity-50 cursor-not-allowed bg-brand-black text-brand-gray-dark' : 'bg-brand-black hover:bg-brand-black-hover text-brand-gray-light'}`} title="Deshacer">
             <Undo2 className="w-5 h-5" />
             <span className="text-[9px] uppercase font-bold tracking-wider hidden lg:block">Volver</span>
          </button>
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Background */}
        <div>
          <button onClick={() => toggleSection('background')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-1 hover:text-white transition-colors">
            <span className="hidden lg:block">Fondo</span>
            <span className="lg:hidden mx-auto">Fondo</span>
            {openSections.background ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.background && (
            <div className="grid grid-cols-4 gap-1">
              <button onClick={() => setFieldType('full')} title="Fondo Entero" className={`p-1.5 rounded flex flex-col items-center gap-1 transition-colors ${fieldType === 'full' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <Maximize className="w-4 h-4" />
              </button>
              <button onClick={() => setFieldType('half-top')} title="Fondo Medio Arriba" className={`p-1.5 rounded flex flex-col items-center gap-1 transition-colors ${fieldType === 'half-top' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <MoveHorizontal className="w-4 h-4" />
              </button>
              <button onClick={() => setFieldType('half')} title="Fondo Medio Abajo" className={`p-1.5 rounded flex flex-col items-center gap-1 transition-colors ${fieldType === 'half' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <MoveHorizontal className="w-4 h-4" />
              </button>
              <button onClick={() => setFieldType('blank')} title="Fondo Liso" className={`p-1.5 rounded flex flex-col items-center gap-1 transition-colors ${fieldType === 'blank' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <ImageIcon className="w-4 h-4" />
              </button>
            </div>
          )}
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Colors */}
        <div>
          <button onClick={() => toggleSection('colors')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-1 hover:text-white transition-colors">
            <span className="hidden lg:block">Color</span>
            <span className="lg:hidden mx-auto">Color</span>
            {openSections.colors ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.colors && (
            <div className="flex justify-center gap-1 flex-wrap">
              <ColorButton color="#ef4444" />
              <ColorButton color="#3b82f6" />
              <ColorButton color="#f59e0b" />
              <ColorButton color="#000000" />
              <ColorButton color="#22c55e" />
            </div>
          )}
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Elements */}
        <div>
          <button onClick={() => toggleSection('elements')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-1 hover:text-white transition-colors">
            <span className="hidden lg:block">Elementos</span>
            <span className="lg:hidden mx-auto">Elementos</span>
            {openSections.elements ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.elements && (
            <div className={`grid ${limitedTools ? 'grid-cols-2' : 'grid-cols-2 lg:grid-cols-2'} gap-1`}>
              <ToolButton tool="player" label="Jugador" bg={true} icon={<div className="w-5 h-5 rounded-full border border-white/50" style={{ background: `radial-gradient(circle at 30% 30%, ${activeColor}, #333)` }} />}/>
              <ToolButton tool="ball" label="Balón" bg={true} icon={<div className="w-4 h-4 flex items-center justify-center"><TiroLeagueBall /></div>}/>
              {!limitedTools && (
                <>
                  <ToolButton tool="cone" label="Chino" bg={true} icon={
                     <svg width="16" height="16" viewBox="0 0 20 20">
                       <path d="M 1 10 A 9 9 0 1 0 19 10 A 9 9 0 1 0 1 10 Z M 8 10 A 2 2 0 1 1 12 10 A 2 2 0 1 1 8 10 Z" fill={activeColor} fillRule="evenodd" />
                       <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
                       <circle cx="10" cy="10" r="2" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
                     </svg>
                  }/>
                  <ToolButton tool="cone-tall" label="Cono" bg={true} icon={
                     <svg width="16" height="19.2" viewBox="0 0 20 24">
                       <rect x="1" y="20" width="18" height="3" rx="1" fill={activeColor} filter="brightness(0.8)" />
                       <ellipse cx="10" cy="20" rx="7" ry="2" fill={activeColor} filter="brightness(0.9)" />
                       <path d="M 4 20 L 8 2 L 12 2 L 16 20 Z" fill={activeColor} />
                       <ellipse cx="10" cy="2" rx="2" ry="1" fill={activeColor} filter="brightness(1.2)" />
                     </svg>
                  }/>
                  <ToolButton tool="pole" label="Pica" bg={true} icon={
                    <div className="flex flex-col items-center justify-end h-5">
                      <div className="w-[2px] flex-1 rounded-t-sm" style={{ background: `linear-gradient(90deg, #fff, ${activeColor} 50%, #333)` }} />
                      <div className="w-3 h-1 rounded-t-full bg-black border-b border-gray-700" />
                    </div>
                  }/>
                  <ToolButton tool="hurdle" label="Valla Baja" bg={true} icon={<div className="w-5 h-2 border-t border-l border-r border-current" style={{ color: activeColor }} />}/>
                  <ToolButton tool="hurdle-high" label="Valla Alta" bg={true} icon={<div className="w-5 h-4 border-t border-l border-r border-current" style={{ color: activeColor }} />}/>
                  <ToolButton tool="ring" label="Aro" bg={true} icon={<div className="w-4 h-4 rounded-full border-2" style={{ borderColor: activeColor }} />}/>
                  <ToolButton tool="ladder" label="Escalera" bg={true} icon={
                     <div className="flex flex-col gap-0.5 w-3" style={{ color: activeColor }}>
                       <div className="w-full h-0.5 bg-current" />
                       <div className="w-full h-0.5 bg-current" />
                       <div className="w-full h-0.5 bg-current" />
                       <div className="w-full h-0.5 bg-current" />
                       <div className="w-full h-0.5 bg-current" />
                     </div>
                  }/>
                  <ToolButton tool="bosu" label="Bosu" bg={true} icon={<div className="w-4 h-4 rounded-full border border-white/20" style={{ background: `radial-gradient(circle at 30% 30%, ${activeColor}, #111)` }} />}/>
                  <ToolButton tool="bosu-profile" label="Bosu Perfil" bg={true} icon={<div className="w-5 h-2.5 rounded-t-full border-b border-black" style={{ background: `radial-gradient(circle at top, ${activeColor}, #222)` }} />}/>
                </>
              )}
            </div>
          )}
        </div>

        {!limitedTools && (
          <>
            <hr className="border-brand-black-border" />

            {/* Section: Goals */}
            <div>
              <button onClick={() => toggleSection('goals')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-1 hover:text-white transition-colors">
                <span className="hidden lg:block">Porterías</span>
                <span className="lg:hidden mx-auto">Porterías</span>
                {openSections.goals ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
              </button>
              {openSections.goals && (
                <div className="grid grid-cols-3 gap-1">
                  <ToolButton tool="goal-f11" label="Portería F11" bg={true} hideLabel={true} icon={<div className="w-8 h-2 border-t-2 border-l-2 border-r-2 border-white" />}/>
                  <ToolButton tool="goal-f8" label="Portería F8" bg={true} hideLabel={true} icon={<div className="w-6 h-2 border-t-2 border-l-2 border-r-2 border-white" />}/>
                  <ToolButton tool="goal-f5" label="Portería F5" bg={true} hideLabel={true} icon={<div className="w-4 h-1.5 border-t-2 border-l-2 border-r-2 border-white" />}/>
                </div>
              )}
            </div>
          </>
        )}

        <hr className="border-brand-black-border" />

        {/* Section: Drawing */}
        <div>
          <button onClick={() => toggleSection('drawing')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-1 hover:text-white transition-colors">
            <span className="hidden lg:block">Dibujo / Formas</span>
            <span className="lg:hidden mx-auto">Dibujo</span>
            {openSections.drawing ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.drawing && (
            <div className="flex flex-col gap-1">
              <div className="flex justify-center mb-0.5">
                <ToolButton tool="text" label="Texto" bg={true} icon={<Type className="w-5 h-5" />} />
              </div>
              <div className="grid grid-cols-1 gap-1 mb-0.5">
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
                <ToolButton tool="zone-line" label="Línea" bg={true} icon={
                  <div className="flex items-center text-white w-full px-2">
                     <div className="flex-1 border-t-2 border-dashed border-white" />
                  </div>
                }/>
              </div>
              <div className="grid grid-cols-2 gap-1">
                <ToolButton tool="shape-circle" label="Círculo" bg={true} icon={<div className="w-4 h-4 rounded-full border-2 border-current" style={{ color: activeColor }} />} />
                <ToolButton tool="shape-square" label="Zona" bg={true} icon={<div className="w-4 h-4 border-2 border-current rounded-sm" style={{ color: activeColor }} />} />
              </div>
            </div>
          )}
        </div>

        <hr className="border-brand-black-border mt-auto" />
        <button 
          onClick={() => {
            if(window.confirm('¿Estás seguro de querer borrar todo el dibujo?')) {
              setElements([]);
              setLines([]);
              setSelectedElementIds([]);
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
      )}

      {/* Main Canvas Area */}
      <div ref={fitContainerRef} className={`flex-1 flex items-center justify-center relative ${printMode ? '' : 'bg-brand-black-card border border-brand-black-border rounded-xl shadow-inner p-2 sm:p-4'} overflow-hidden select-none`}>

        {!readOnly && !printMode && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none flex flex-col gap-1 items-start">
             {activeTool === 'select' && <span className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur shadow-sm">👆 Arrastra en vacío para seleccionar varios · Shift+clic para añadir · Supr borra · Ctrl+D duplica</span>}
             {['player', 'cone', 'cone-tall', 'pole', 'goal', 'mini-goal', 'ball', 'hurdle', 'ring', 'ladder', 'bosu', 'text'].includes(activeTool) && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur shadow-sm">🎯 Haz clic en el campo para colocar</span>}
             {['arrow', 'dashed-arrow', 'zone-line'].includes(activeTool) && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur shadow-sm">✏️ Haz clic y arrastra para dibujar</span>}
          </div>
        )}

        {/* Field container */}
        <div 
          className={`relative touch-none cursor-crosshair rounded shadow-lg border border-white/10 ${isCropped ? 'overflow-hidden' : 'overflow-hidden'} ${printMode ? 'mx-auto' : ''}`}
          style={{
            // Usamos el mismo cálculo (fittedW, fittedH) tanto para editor como impresión.
            aspectRatio: containerAspect,
            width: fittedW ? `${fittedW}px` : '100%',
            height: fittedW ? `${fittedH}px` : 'auto',
            maxWidth: '100%',
            maxHeight: '100%',
            containerType: 'normal'
          }}
          ref={boardRef}
          onPointerDown={handleBoardPointerDown}
        >
          {isRotated ? (
             <div style={{
                width: '64.7619%', /* H/W = 68/105 */
                aspectRatio: '68 / 105', /* Replaces percentage height to avoid Safari 0px bug */
                transform: 'translate(-50%, -50%) rotate(-90deg)',
                position: 'absolute',
                top: '50%',
                left: '50%',
                containerType: 'inline-size'
             }}>
                {renderFieldBackground()}
                {elements.map(renderElement)}
                {renderLines()}
             </div>
          ) : isCropped ? (
             <div style={{
                width: `${(100 / cropWidth) * 100}%`,
                aspectRatio: '1 / 1', /* isCropped implies fieldType === 'blank' */
                left: `${-(cropBox.minX / cropWidth) * 100}%`,
                top: `${-(cropBox.minY / cropHeight) * 100}%`,
                position: 'absolute',
                containerType: 'inline-size'
             }}>
                {renderFieldBackground()}
                {elements.map(renderElement)}
                {renderLines()}
             </div>
          ) : (
             <div style={{ 
                width: '100%', 
                aspectRatio: fieldType === 'full' ? '68 / 105' : fieldType === 'half' || fieldType === 'half-top' ? '136 / 105' : '1 / 1', 
                position: 'relative', 
                containerType: 'inline-size' 
             }}>
                {renderFieldBackground()}
                {elements.map(renderElement)}
                {renderLines()}
             </div>
          )}

          {/* Marquee de selección */}
          {selectionBox && (
            <div
              className="absolute border border-brand-red-600 bg-brand-red-600/15 pointer-events-none z-40"
              style={{
                left: `${Math.min(selectionBox.startX, selectionBox.currentX)}%`,
                top: `${Math.min(selectionBox.startY, selectionBox.currentY)}%`,
                width: `${Math.abs(selectionBox.currentX - selectionBox.startX)}%`,
                height: `${Math.abs(selectionBox.currentY - selectionBox.startY)}%`,
              }}
            />
          )}
        </div>

        {/* Selected Element Controls */}
        {hasSelection && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-black/95 backdrop-blur-md border border-brand-black-border rounded-xl p-2 flex items-center gap-1 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-fade-in z-50">

            {/* Contador cuando hay varios seleccionados */}
            {selectedElementIds.length > 1 && (
              <>
                <span className="px-2 py-1 text-xs font-bold text-white bg-brand-red-600 rounded-lg whitespace-nowrap">
                  {selectedElementIds.length} elementos
                </span>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            )}

            {/* Si es un único texto o forma, mostrar input de edición */}
            {selectedElement && ['text', 'shape-circle', 'shape-square', 'player'].includes(selectedElement.type) ? (
              <>
                <input
                  type="text"
                  value={selectedElement.text || ''}
                  onChange={(e) => updateElementText(selectedElementIds, e.target.value)}
                  className="bg-black/50 border border-brand-black-border rounded px-2 py-1 text-sm text-white outline-none w-24 focus:border-brand-red-600"
                  placeholder="Texto..."
                />
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            ) : null}

            {/* Si es jugador y modo ABP, opciones de marcaje */}
            {selectedElement && selectedElement.type === 'player' && (
              <>
                <button
                  onClick={() => toggleAbpMarking(selectedElementIds, selectedElement.abp_marking === 'Z' ? '' : 'Z')}
                  className={`px-2 py-1 text-xs font-bold rounded transition-colors ${selectedElement.abp_marking === 'Z' ? 'bg-blue-500 text-white' : 'text-brand-gray-light hover:bg-brand-black-hover'}`}
                  title="Marcar en Zona"
                >
                  Z
                </button>
                <button
                  onClick={() => toggleAbpMarking(selectedElementIds, selectedElement.abp_marking === 'H' ? '' : 'H')}
                  className={`px-2 py-1 text-xs font-bold rounded transition-colors ${selectedElement.abp_marking === 'H' ? 'bg-red-500 text-white' : 'text-brand-gray-light hover:bg-brand-black-hover'}`}
                  title="Marcar al Hombre"
                >
                  H
                </button>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            )}

            {/* Rotar: oculto solo si la selección única es texto */}
            {!(selectedElement && selectedElement.type === 'text') && (
              <>
                <button onClick={() => rotateElement(selectedElementIds, -15)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors" title="Rotar Izquierda">
                  <RotateCw className="w-4 h-4 -scale-x-100" />
                </button>
                <button onClick={() => rotateElement(selectedElementIds, 15)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors" title="Rotar Derecha">
                  <RotateCw className="w-4 h-4" />
                </button>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            )}

            {/* Toggle Fill and Dashed solo para una forma única */}
            {selectedElement && ['shape-circle', 'shape-square'].includes(selectedElement.type) && (
              <>
                <button
                  onClick={() => toggleElementFill(selectedElementIds)}
                  className={`p-2 rounded-lg transition-colors font-bold text-xs flex items-center justify-center w-8 ${selectedElement.filled ? 'bg-brand-red-600 text-white' : 'text-brand-gray-light hover:text-white hover:bg-brand-black-hover'}`}
                  title="Alternar Relleno"
                >
                  <div className={`w-3 h-3 border border-current ${selectedElement.filled ? 'bg-current' : 'bg-transparent'} ${selectedElement.type === 'shape-circle' ? 'rounded-full' : ''}`} />
                </button>
                <button
                  onClick={() => toggleElementDashed(selectedElementIds)}
                  className={`p-2 rounded-lg transition-colors font-bold text-xs flex items-center justify-center w-8 ${selectedElement.dashed ? 'bg-brand-red-600 text-white' : 'text-brand-gray-light hover:text-white hover:bg-brand-black-hover'}`}
                  title="Línea Discontinua"
                >
                  <div className="w-4 border-t-2 border-dashed border-current" />
                </button>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
                
                <div className="flex bg-black/50 rounded-lg border border-brand-black-border p-1">
                   <button onClick={() => updateElementThickness(selectedElementIds, 2)} className={`px-2 py-1 rounded text-[10px] font-bold ${selectedElement.thickness === 2 || !selectedElement.thickness ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}>X1</button>
                   <button onClick={() => updateElementThickness(selectedElementIds, 4)} className={`px-2 py-1 rounded text-[10px] font-bold ${selectedElement.thickness === 4 ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}>X2</button>
                   <button onClick={() => updateElementThickness(selectedElementIds, 6)} className={`px-2 py-1 rounded text-[10px] font-bold ${selectedElement.thickness === 6 ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}>X3</button>
                </div>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            )}

            <button onClick={() => scaleElement(selectedElementIds, 0.2)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors font-bold text-lg flex items-center justify-center w-8" title="Aumentar">
              +
            </button>
            <button onClick={() => scaleElement(selectedElementIds, -0.2)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors font-bold text-lg flex items-center justify-center w-8" title="Reducir">
              −
            </button>
            
            {/* Duplicar Elemento */}
            <div className="w-px h-6 bg-brand-black-border mx-1" />
            <button onClick={() => duplicateElement(selectedElementIds)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors" title="Duplicar">
              <Copy className="w-4 h-4" />
            </button>

            {/* Secuencia */}
            <button onClick={() => duplicateElementSequence(selectedElementIds)} className="p-2 text-brand-gray-light hover:text-white hover:bg-brand-black-hover rounded-lg transition-colors flex items-center justify-center" title="Crear Secuencia (x3)">
              <div className="flex gap-[2px]">
                <div className="w-1.5 h-1.5 rounded-full bg-current"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-current opacity-70"></div>
                <div className="w-1.5 h-1.5 rounded-full bg-current opacity-40"></div>
              </div>
            </button>

            <div className="w-px h-6 bg-brand-black-border mx-1" />
            <button onClick={() => removeElement(selectedElementIds)} className="p-2 text-brand-red-600 hover:bg-brand-red-600/10 rounded-lg transition-colors" title="Eliminar">
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Selected Line Controls */}
        {selectedLineId && selectedLine && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-brand-black/95 backdrop-blur-md border border-brand-black-border rounded-xl p-2 flex items-center gap-2 shadow-[0_10px_30px_rgba(0,0,0,0.8)] animate-fade-in z-50">
            
            {/* Controles de Curva */}
            {(selectedLine.type === 'arrow' || selectedLine.type === 'dashed-arrow') && (
              <>
                <div className="flex bg-black/50 rounded-lg border border-brand-black-border p-1 gap-1">
                  <button onClick={() => updateLineCurve(selectedLineId, -1)} className="p-1 rounded text-brand-gray-muted hover:text-white hover:bg-white/10" title="Curvar Izquierda">
                    <Undo2 className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => setLines(lines.map(l => l.id === selectedLineId ? { ...l, curve: 0 } : l))} className={`p-1 rounded ${!selectedLine.curve ? 'text-white bg-white/20' : 'text-brand-gray-muted hover:text-white hover:bg-white/10'}`} title="Recta">
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => updateLineCurve(selectedLineId, 1)} className="p-1 rounded text-brand-gray-muted hover:text-white hover:bg-white/10" title="Curvar Derecha">
                    <Redo2 className="w-3.5 h-3.5" />
                  </button>
                </div>
                <div className="w-px h-6 bg-brand-black-border mx-1" />
              </>
            )}

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
