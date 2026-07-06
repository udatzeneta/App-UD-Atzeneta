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
}

export const TaskBoardEditor: React.FC<TaskBoardEditorProps> = ({ value, onChange, initialData, readOnly, hideToolbar, printMode }) => {
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
  
  const boardRef = useRef<HTMLDivElement>(null);
  const [boardSize, setBoardSize] = useState({ width: 500, height: 500 });
  const hasDraggedRef = useRef(false);

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

  // Load initial data
  useEffect(() => {
    const dataToLoad = value || initialData;
    if (dataToLoad && !elements.length && !lines.length) {
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
      onChange(data);
    }
  }, [fieldType, elements, lines, onChange, value, readOnly]);

  // Handle pointer down on the board (canvas)
  const handleBoardPointerDown = (e: React.PointerEvent) => {
    if (readOnly) return;
    if (!boardRef.current) return;
    
    const rect = boardRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    // Los elementos y líneas llaman a stopPropagation(), así que si el evento
    // llega hasta aquí en modo "Mover" es porque el clic fue en zona vacía:
    // deseleccionamos e iniciamos la caja de selección (marquee).
    if (activeTool === 'select') {
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
        scale: 1,
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
        
        if (corner && initialW !== undefined && initialH !== undefined && startX !== undefined && startY !== undefined) {
          const dx = e.clientX - startX;
          const dy = e.clientY - startY;

          const angle = -(elRotation || 0) * Math.PI / 180;
          const localDx = dx * Math.cos(angle) - dy * Math.sin(angle);
          const localDy = dx * Math.sin(angle) + dy * Math.cos(angle);

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

          newW = Math.max(20, newW);
          newH = Math.max(20, newH);

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
    }

    return () => {
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };
  }, [drawingLine, selectionBox, activeDragId, activeResizeId, activeTool, elements, selectedElementIds]);

  const handleElementPointerDown = (e: React.PointerEvent, id: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (activeTool === 'select') {
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

  const handleLinePointerDown = (e: React.PointerEvent, id: string) => {
    if (activeTool !== 'select') return;
    e.stopPropagation();
    if (activeTool === 'select') {
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
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, text } : e));
  };

  const duplicateElement = (ids: string[]) => {
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
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, filled: !e.filled } : e));
  };

  const toggleElementDashed = (ids: string[]) => {
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, dashed: !e.dashed } : e));
  };

  const updateElementThickness = (ids: string[], thickness: number) => {
    setElements(elements.map(e => ids.includes(e.id) ? { ...e, thickness } : e));
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

  // --- RENDERING ---

  const renderFieldBackground = () => {
    // Coordenadas a escala real (metros). Campo 68 ancho x 105 largo.
    const viewBox = fieldType === 'full'
      ? '0 0 68 105'
      : (fieldType === 'half' || fieldType === 'half-top')
        ? '0 0 68 52.5'
        : '0 0 68 68';

    const lineProps = {
      stroke: 'rgba(255,255,255,0.9)',
      strokeWidth: 0.28,
      fill: 'none' as const,
      strokeLinecap: 'round' as const,
      strokeLinejoin: 'round' as const,
    };

    return (
      <div className="absolute inset-0 overflow-hidden">
        {/* Césped con franjas de siega */}
        <div className="absolute inset-0" style={{
          background: 'repeating-linear-gradient(0deg, #3f9445 0 7%, #48a04f 7% 14%)'
        }} />
        {/* Iluminación y viñeta para dar profundidad */}
        <div className="absolute inset-0" style={{
          background: 'radial-gradient(ellipse at 50% 30%, rgba(255,255,255,0.12), rgba(0,0,0,0) 55%), radial-gradient(ellipse at 50% 105%, rgba(0,0,0,0.35), rgba(0,0,0,0) 60%)'
        }} />

        {fieldType !== 'blank' && (
          <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox={viewBox} preserveAspectRatio="xMidYMid meet">
            <g {...lineProps}>
              {fieldType === 'full' && (
              <>
                {/* Perímetro y línea de medio campo */}
                <rect x="1" y="1" width="66" height="103" />
                <line x1="1" y1="52.5" x2="67" y2="52.5" />
                <circle cx="34" cy="52.5" r="9.15" />
                <circle cx="34" cy="52.5" r="0.35" fill="white" />

                {/* Área superior */}
                <rect x="13.84" y="1" width="40.32" height="16.5" />
                <rect x="24.84" y="1" width="18.32" height="5.5" />
                <circle cx="34" cy="12" r="0.35" fill="white" />
                <path d="M 26.69 17.5 A 9.15 9.15 0 0 0 41.31 17.5" />
                <rect x="30.34" y="-0.4" width="7.32" height="1.4" fill="rgba(255,255,255,0.12)" />

                {/* Área inferior */}
                <rect x="13.84" y="87.5" width="40.32" height="16.5" />
                <rect x="24.84" y="98.5" width="18.32" height="5.5" />
                <circle cx="34" cy="93" r="0.35" fill="white" />
                <path d="M 26.69 87.5 A 9.15 9.15 0 0 1 41.31 87.5" />
                <rect x="30.34" y="104" width="7.32" height="1.4" fill="rgba(255,255,255,0.12)" />

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
                <circle cx="34" cy="1" r="0.35" fill="white" />

                {/* Área (portería abajo) */}
                <rect x="13.84" y="35" width="40.32" height="16.5" />
                <rect x="24.84" y="46" width="18.32" height="5.5" />
                <circle cx="34" cy="40.5" r="0.35" fill="white" />
                <path d="M 26.69 35 A 9.15 9.15 0 0 1 41.31 35" />
                <rect x="30.34" y="51.5" width="7.32" height="1.4" fill="rgba(255,255,255,0.12)" />

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
                <circle cx="34" cy="51.5" r="0.35" fill="white" />

                {/* Área (portería arriba) */}
                <rect x="13.84" y="1" width="40.32" height="16.5" />
                <rect x="24.84" y="1" width="18.32" height="5.5" />
                <circle cx="34" cy="12" r="0.35" fill="white" />
                <path d="M 26.69 17.5 A 9.15 9.15 0 0 0 41.31 17.5" />
                <rect x="30.34" y="-0.4" width="7.32" height="1.4" fill="rgba(255,255,255,0.12)" />

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

  const renderElement = (el: BoardElement) => {
    const isSelected = selectedElementIds.includes(el.id);
    const isShape = ['shape-circle', 'shape-square'].includes(el.type);
    
    const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: `translate(-50%, -50%) rotate(${el.rotation}deg) ${isShape ? '' : `scale(${el.scale || 1})`}`,
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
        content = (
          <svg width="14" height="14" viewBox="0 0 20 20" style={{ filter: 'drop-shadow(1px 2px 3px rgba(0,0,0,0.5))' }}>
            <path d="M 1 10 A 9 9 0 1 0 19 10 A 9 9 0 1 0 1 10 Z M 8 10 A 2 2 0 1 1 12 10 A 2 2 0 1 1 8 10 Z" fill={el.color} fillRule="evenodd" />
            <circle cx="10" cy="10" r="9" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <circle cx="10" cy="10" r="2" fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth="0.5" />
          </svg>
        );
        break;
      case 'cone-tall':
        content = (
          <svg width="20" height="24" viewBox="0 0 20 24" style={{ filter: 'drop-shadow(2px 2px 2px rgba(0,0,0,0.4))' }}>
            <rect x="1" y="20" width="18" height="3" rx="1" fill={el.color} filter="brightness(0.8)" />
            <ellipse cx="10" cy="20" rx="7" ry="2" fill={el.color} filter="brightness(0.9)" />
            <path d="M 4 20 L 8 2 L 12 2 L 16 20 Z" fill={el.color} />
            <ellipse cx="10" cy="2" rx="2" ry="1" fill={el.color} filter="brightness(1.2)" />
          </svg>
        );
        break;
      case 'pole':
        content = (
          <div className="relative flex flex-col items-center justify-end" style={{ filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.4))' }}>
            <div className="w-[2px] h-10 rounded-t-sm" style={{ background: `linear-gradient(90deg, #fff 0%, ${el.color} 40%, ${el.color} 60%, #333 100%)` }} />
            <div className="w-4 h-1.5 rounded-t-full bg-black border-b border-gray-700 z-10" />
          </div>
        );
        break;
      case 'hurdle':
        content = (
          <div className="relative w-8 h-3" style={{ color: el.color, filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))' }}>
            <div className="absolute top-0 w-full h-[3px] bg-current" />
            <div className="absolute top-[3px] left-0.5 w-[3px] h-2 bg-gray-300" />
            <div className="absolute top-[3px] right-0.5 w-[3px] h-2 bg-gray-300" />
          </div>
        );
        break;
      case 'hurdle-high':
        content = (
          <div className="relative w-8 h-5" style={{ color: el.color, filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.4))' }}>
            <div className="absolute top-0 w-full h-[3px] bg-current" />
            <div className="absolute top-[3px] left-0.5 w-[3px] h-4 bg-gray-300" />
            <div className="absolute top-[3px] right-0.5 w-[3px] h-4 bg-gray-300" />
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
      case 'goal-f11':
        content = (
          <svg width="80" height="24" viewBox="0 0 80 24" style={{ filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.6))' }}>
            <rect x="2" y="0" width="76" height="20" fill="url(#net-pattern)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
            <path d="M 2 0 L 12 20 M 12 0 L 22 20 M 22 0 L 32 20 M 32 0 L 42 20 M 42 0 L 52 20 M 52 0 L 62 20 M 62 0 L 72 20 M 72 0 L 78 20" stroke="rgba(255,255,255,0.4)" strokeWidth="0.5" />
            <rect x="0" y="20" width="80" height="4" fill="#ffffff" rx="1" />
            <rect x="0" y="0" width="4" height="24" fill="#e2e8f0" rx="1" />
            <rect x="76" y="0" width="4" height="24" fill="#e2e8f0" rx="1" />
          </svg>
        );
        break;
      case 'goal-f8':
        content = (
          <svg width="50" height="20" viewBox="0 0 50 20" style={{ filter: 'drop-shadow(2px 3px 3px rgba(0,0,0,0.6))' }}>
            <rect x="2" y="0" width="46" height="16" fill="url(#net-pattern)" stroke="rgba(255,255,255,0.8)" strokeWidth="2" />
            <rect x="0" y="16" width="50" height="4" fill="#ffffff" rx="1" />
            <rect x="0" y="0" width="4" height="20" fill="#e2e8f0" rx="1" />
            <rect x="46" y="0" width="4" height="20" fill="#e2e8f0" rx="1" />
          </svg>
        );
        break;
      case 'goal-f5':
        content = (
          <svg width="36" height="16" viewBox="0 0 36 16" style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.6))' }}>
            <rect x="2" y="0" width="32" height="12" fill="url(#net-pattern)" stroke="rgba(255,255,255,0.8)" strokeWidth="1.5" />
            <rect x="0" y="12" width="36" height="4" fill="#ffffff" rx="1" />
            <rect x="0" y="0" width="3" height="16" fill="#e2e8f0" rx="1" />
            <rect x="33" y="0" width="3" height="16" fill="#e2e8f0" rx="1" />
          </svg>
        );
        break;
      case 'shape-circle':
        content = (
          <div style={{
            width: `${el.width || (40 * (el.scale || 1))}px`, height: `${el.height || (40 * (el.scale || 1))}px`, borderRadius: '50%',
            backgroundColor: el.filled ? `${el.color}40` : 'transparent',
            border: `${el.thickness || 2}px ${el.dashed ? 'dashed' : 'solid'} ${el.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: el.color, fontSize: '12px', fontWeight: 'bold'
          }}>
            {el.text}
          </div>
        );
        break;
      case 'shape-square':
        content = (
          <div style={{
            width: `${el.width || (40 * (el.scale || 1))}px`, height: `${el.height || (40 * (el.scale || 1))}px`, borderRadius: '4px',
            backgroundColor: el.filled ? `${el.color}40` : 'transparent',
            border: `${el.thickness || 2}px ${el.dashed ? 'dashed' : 'solid'} ${el.color}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            color: el.color, fontSize: '12px', fontWeight: 'bold'
          }}>
            {el.text}
          </div>
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
      case 'bosu-profile':
        content = (
          <div className="relative w-10 h-5" style={{ filter: 'drop-shadow(2px 2px 3px rgba(0,0,0,0.5))' }}>
            <div className="absolute bottom-1 w-10 h-4 rounded-t-full border-b-2 border-black" style={{ background: `radial-gradient(circle at top, ${el.color}, #222)` }} />
            <div className="absolute bottom-0 w-10 h-1.5 bg-black rounded-full" />
          </div>
        );
        break;
      case 'ladder':
        content = (
          <svg width="24" height="120" viewBox="0 0 24 120" style={{ filter: 'drop-shadow(1px 2px 2px rgba(0,0,0,0.5))' }}>
            <rect x="0" y="0" width="3" height="120" fill={el.color} />
            <rect x="21" y="0" width="3" height="120" fill={el.color} />
            <rect x="3" y="10" width="18" height="2" fill={el.color} />
            <rect x="3" y="30" width="18" height="2" fill={el.color} />
            <rect x="3" y="50" width="18" height="2" fill={el.color} />
            <rect x="3" y="70" width="18" height="2" fill={el.color} />
            <rect x="3" y="90" width="18" height="2" fill={el.color} />
            <rect x="3" y="110" width="18" height="2" fill={el.color} />
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
                stroke={line.color} 
                strokeWidth={strokeWidth} 
                strokeDasharray={strokeDasharray}
                markerEnd={markerEnd}
                filter={filter}
                fill="none"
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
        onClick={() => {
          setActiveColor(color);
          if (selectedElementIds.length > 0) {
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

  return (
    <div className={`flex flex-col md:flex-row gap-4 h-full min-h-[500px] ${printMode ? 'w-full !h-full !min-h-0' : ''}`}>
      
      {/* Sidebar Tools */}
      {!hideToolbar && (
        <div className="w-full md:w-20 lg:w-48 bg-brand-black-card border border-brand-black-border rounded-xl p-3 flex flex-col gap-4 overflow-y-auto custom-scrollbar">
        
        <div className="flex justify-center">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="Mover" bg={true} />
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Background */}
        <div>
          <button onClick={() => toggleSection('background')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-2 hover:text-white transition-colors">
            <span className="hidden lg:block">Fondo</span>
            <span className="lg:hidden mx-auto">Fondo</span>
            {openSections.background ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.background && (
            <div className="flex md:flex-col gap-2 justify-center flex-wrap">
              <button onClick={() => setFieldType('full')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'full' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <Maximize className="w-4 h-4" />
                <span className="text-[9px] uppercase hidden lg:block">Entero</span>
              </button>
              <button onClick={() => setFieldType('half-top')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'half-top' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <MoveHorizontal className="w-4 h-4" />
                <span className="text-[9px] uppercase hidden lg:block text-center whitespace-nowrap">Medio Arr.</span>
              </button>
              <button onClick={() => setFieldType('half')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'half' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <MoveHorizontal className="w-4 h-4" />
                <span className="text-[9px] uppercase hidden lg:block text-center whitespace-nowrap">Medio Abj.</span>
              </button>
              <button onClick={() => setFieldType('blank')} className={`p-2 rounded flex flex-col items-center gap-1 ${fieldType === 'blank' ? 'bg-[#3b843f] text-white border border-[#4da44d]' : 'bg-brand-black border border-transparent text-brand-gray-muted hover:text-white'}`}>
                <ImageIcon className="w-4 h-4" />
                <span className="text-[9px] uppercase hidden lg:block">Liso</span>
              </button>
            </div>
          )}
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Colors */}
        <div>
          <button onClick={() => toggleSection('colors')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-2 hover:text-white transition-colors">
            <span className="hidden lg:block">Color</span>
            <span className="lg:hidden mx-auto">Color</span>
            {openSections.colors ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.colors && (
            <div className="flex justify-center gap-2 flex-wrap">
              <ColorButton color="#ffffff" />
              <ColorButton color="#ef4444" />
              <ColorButton color="#3b82f6" />
              <ColorButton color="#f59e0b" />
              <ColorButton color="#000000" />
            </div>
          )}
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Elements */}
        <div>
          <button onClick={() => toggleSection('elements')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-2 hover:text-white transition-colors">
            <span className="hidden lg:block">Elementos</span>
            <span className="lg:hidden mx-auto">Elementos</span>
            {openSections.elements ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.elements && (
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2">
              <ToolButton tool="player" label="Jugador" bg={true} icon={<div className="w-5 h-5 rounded-full border border-white/50" style={{ background: `radial-gradient(circle at 30% 30%, ${activeColor}, #333)` }} />}/>
              <ToolButton tool="ball" label="Balón" bg={true} icon={<div className="w-4 h-4 rounded-full bg-white border border-gray-600 flex items-center justify-center"><div className="w-1.5 h-1.5 bg-black rounded-full" /></div>}/>
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
            </div>
          )}
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Goals */}
        <div>
          <button onClick={() => toggleSection('goals')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-2 hover:text-white transition-colors">
            <span className="hidden lg:block">Porterías</span>
            <span className="lg:hidden mx-auto">Porterías</span>
            {openSections.goals ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.goals && (
            <div className="grid grid-cols-2 lg:grid-cols-2 gap-2">
              <ToolButton tool="goal-f11" label="Port. F11" bg={true} icon={<div className="w-8 h-2 border-t-2 border-l-2 border-r-2 border-white" />}/>
              <ToolButton tool="goal-f8" label="Port. F8" bg={true} icon={<div className="w-6 h-2 border-t-2 border-l-2 border-r-2 border-white" />}/>
              <ToolButton tool="goal-f5" label="Port. F5" bg={true} icon={<div className="w-4 h-1.5 border-t-2 border-l-2 border-r-2 border-white" />}/>
            </div>
          )}
        </div>

        <hr className="border-brand-black-border" />

        {/* Section: Drawing */}
        <div>
          <button onClick={() => toggleSection('drawing')} className="flex items-center justify-between w-full text-[10px] font-bold text-brand-gray-muted uppercase mb-2 hover:text-white transition-colors">
            <span className="hidden lg:block">Dibujo / Formas</span>
            <span className="lg:hidden mx-auto">Dibujo</span>
            {openSections.drawing ? <ChevronUp className="w-3 h-3 hidden lg:block" /> : <ChevronDown className="w-3 h-3 hidden lg:block" />}
          </button>
          {openSections.drawing && (
            <div className="flex flex-col gap-2">
              <div className="flex justify-center mb-1">
                <ToolButton tool="text" label="Texto" bg={true} icon={<Type className="w-5 h-5" />} />
              </div>
              <div className="grid grid-cols-1 gap-2 mb-1">
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
              <div className="grid grid-cols-2 gap-2">
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
      <div className={`flex-1 flex items-center justify-center relative ${printMode ? '' : 'bg-brand-black-card border border-brand-black-border rounded-xl shadow-inner p-2 sm:p-4'} overflow-hidden select-none`}>
        
        {!printMode && (
          <div className="absolute top-2 left-2 z-20 pointer-events-none">
             {activeTool === 'select' && <span className="bg-black/50 text-white text-xs px-2 py-1 rounded backdrop-blur">👆 Arrastra en vacío para seleccionar varios · Shift+clic para añadir · Supr borra · Ctrl+D duplica</span>}
             {['player', 'cone', 'cone-tall', 'pole', 'goal', 'mini-goal', 'ball', 'hurdle', 'ring', 'ladder', 'bosu', 'text'].includes(activeTool) && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">🎯 Haz clic en el campo para colocar</span>}
             {['arrow', 'dashed-arrow', 'zone-line'].includes(activeTool) && <span className="bg-brand-red-600/80 text-white text-xs px-2 py-1 rounded backdrop-blur">✏️ Haz clic y arrastra para dibujar</span>}
          </div>
        )}

        {/* Field container */}
        <div 
          className="relative touch-none cursor-crosshair rounded overflow-hidden shadow-lg border border-white/10"
          style={{ 
            aspectRatio: fieldType === 'full' ? '68 / 105' : fieldType === 'half' || fieldType === 'half-top' ? '136 / 105' : '1 / 1',
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
            {selectedElement && ['text', 'shape-circle', 'shape-square'].includes(selectedElement.type) ? (
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
