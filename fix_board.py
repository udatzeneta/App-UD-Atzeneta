import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/components/TaskBoardEditor.tsx', 'r') as f:
    content = f.read()

# 1. Swap render order so lines render above elements
content = re.sub(
    r'(\{renderFieldBackground\(\)\})\s*(\{renderLines\(\)\})\s*(\{elements\.map\(renderElement\)\})',
    r'\1\n                \3\n                \2',
    content
)

# 2. Add history state and undo logic
history_state = """  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);
  
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
"""
content = content.replace("  const [selectionBox, setSelectionBox] = useState<{ startX: number, startY: number, currentX: number, currentY: number } | null>(null);", history_state)

# 3. Add Undo icon import
if "Undo" not in content:
    content = content.replace("MousePointer2,", "MousePointer2, Undo,")

# 4. Inject saveState into pointer downs and actions
replacements = {
    "const handleBoardPointerDown = (e: React.PointerEvent) => {": "const handleBoardPointerDown = (e: React.PointerEvent) => {\n    saveState();",
    "const handleElementPointerDown = (e: React.PointerEvent, id: string) => {": "const handleElementPointerDown = (e: React.PointerEvent, id: string) => {\n    saveState();",
    "const handleLinePointerDown = (e: React.PointerEvent, id: string) => {": "const handleLinePointerDown = (e: React.PointerEvent, id: string) => {\n    saveState();",
    "const handleResizePointerDown = (e: React.PointerEvent, id: string, corner: string) => {": "const handleResizePointerDown = (e: React.PointerEvent, id: string, corner: string) => {\n    saveState();",
    "const duplicateElement = (ids: string[]) => {": "const duplicateElement = (ids: string[]) => {\n    saveState();",
    "const duplicateElementSequence = (ids: string[]) => {": "const duplicateElementSequence = (ids: string[]) => {\n    saveState();",
    "const deleteSelectedElements = () => {": "const deleteSelectedElements = () => {\n    saveState();",
    "const rotateElement = (ids: string[], deg: number) => {": "const rotateElement = (ids: string[], deg: number) => {\n    saveState();",
    "const scaleElement = (ids: string[], factor: number) => {": "const scaleElement = (ids: string[], factor: number) => {\n    saveState();",
    "const toggleElementFill = (ids: string[]) => {": "const toggleElementFill = (ids: string[]) => {\n    saveState();",
    "const toggleElementDashed = (ids: string[]) => {": "const toggleElementDashed = (ids: string[]) => {\n    saveState();",
    "const updateElementThickness = (ids: string[], thickness: number) => {": "const updateElementThickness = (ids: string[], thickness: number) => {\n    saveState();",
    "const updateElementText = (ids: string[], text: string) => {": "const updateElementText = (ids: string[], text: string) => {\n    saveState();",
}

for old, new_ in replacements.items():
    content = content.replace(old, new_)

# Also color change needs saveState
color_btn_old = """        onClick={() => {
          setActiveColor(color);
          if (selectedElementIds.length > 0) {
            setElements(prev => prev.map(e => selectedElementIds.includes(e.id) ? { ...e, color } : e));
          }
        }}"""
color_btn_new = """        onClick={() => {
          setActiveColor(color);
          if (selectedElementIds.length > 0) {
            saveState();
            setElements(prev => prev.map(e => selectedElementIds.includes(e.id) ? { ...e, color } : e));
          }
        }}"""
content = content.replace(color_btn_old, color_btn_new)

# 5. Add Undo Button to UI
undo_btn = """        <div className="flex justify-center gap-1">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="Mover" bg={true} />
          <button onClick={handleUndo} disabled={history.length === 0} className={`p-1.5 rounded flex flex-col items-center justify-center gap-1 transition-colors ${history.length === 0 ? 'opacity-50 cursor-not-allowed bg-brand-black text-brand-gray-dark' : 'bg-brand-black hover:bg-brand-black-hover text-brand-gray-light'}`} title="Deshacer">
             <Undo className="w-5 h-5" />
             <span className="text-[9px] uppercase font-bold tracking-wider hidden lg:block">Volver</span>
          </button>
        </div>"""
content = content.replace("""        <div className="flex justify-center">
          <ToolButton tool="select" icon={<MousePointer2 className="w-5 h-5" />} label="Mover" bg={true} />
        </div>""", undo_btn)

# Make sure elements have a base z-index so they don't block lines incorrectly if there's any weird stacking context. Actually, lines are rendered AFTER elements now, so they will naturally be on top.
# Let's verify element z-index inside `renderElement`
content = content.replace(
    """const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg) scale(${el.scale || 1})`,
      zIndex: isSelected ? 20 : 10,
      cursor: activeTool === 'select' ? 'pointer' : 'crosshair',
      pointerEvents: activeTool === 'select' ? 'auto' : 'none'
    };""",
    """const baseStyle: React.CSSProperties = {
      position: 'absolute',
      left: `${el.x}%`,
      top: `${el.y}%`,
      transform: `translate(-50%, -50%) rotate(${el.rotation || 0}deg) scale(${el.scale || 1})`,
      zIndex: isSelected ? 10 : (el.type.startsWith('shape-') ? 1 : 5), // Zonas van al fondo (zIndex 1), elementos normales encima (5)
      cursor: activeTool === 'select' ? 'pointer' : 'crosshair',
      pointerEvents: activeTool === 'select' ? 'auto' : 'none'
    };"""
)

# Render Lines zIndex
content = content.replace(
    """<svg viewBox={`0 0 ${boardSize.width} ${boardSize.height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 1, overflow: 'visible' }}>""",
    """<svg viewBox={`0 0 ${boardSize.width} ${boardSize.height}`} preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none" style={{ zIndex: 20, overflow: 'visible' }}>"""
)

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/components/TaskBoardEditor.tsx', 'w') as f:
    f.write(content)

