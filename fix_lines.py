import re

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/components/TaskBoardEditor.tsx', 'r') as f:
    content = f.read()

# 1. Add handleLineResizePointerDown
func_resize = """  const handleLineResizePointerDown = (e: React.PointerEvent, id: string, point: string) => {
    saveState();
    if (activeTool !== 'select') return;
    e.stopPropagation();
    try { (e.target as Element).setPointerCapture(e.pointerId); } catch (err) {}
    setActiveResizeId(id);
    setSelectedLineId(id);
    setSelectedElementIds([]);
    resizeStartRef.current = { id, corner: point, initialScale: 1, initialDist: 0, elX: 0, elY: 0 };
  };

  const handleLinePointerDown = (e: React.PointerEvent, id: string) => {"""
content = content.replace("  const handleLinePointerDown = (e: React.PointerEvent, id: string) => {", func_resize)

# 2. Modify handlePointerMove to handle line-start and line-end
move_old = """      } else if (activeResizeId && resizeStartRef.current) {
        const { id, corner, initialScale, initialDist, elX, elY, initialW, initialH, startX, startY, elRotation } = resizeStartRef.current;
        
        if (corner && initialW !== undefined && initialH !== undefined && startX !== undefined && startY !== undefined) {"""
move_new = """      } else if (activeResizeId && resizeStartRef.current) {
        const { id, corner, initialScale, initialDist, elX, elY, initialW, initialH, startX, startY, elRotation } = resizeStartRef.current;
        
        if (corner === 'line-start') {
           setLines(prev => prev.map(l => l.id === id ? { ...l, startX: Math.max(0, Math.min(100, x)), startY: Math.max(0, Math.min(100, y)) } : l));
        } else if (corner === 'line-end') {
           setLines(prev => prev.map(l => l.id === id ? { ...l, endX: Math.max(0, Math.min(100, x)), endY: Math.max(0, Math.min(100, y)) } : l));
        } else if (corner && initialW !== undefined && initialH !== undefined && startX !== undefined && startY !== undefined) {"""
content = content.replace(move_old, move_new)

# 3. Add circles to renderLines
render_lines_old = """            <g 
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
            </g>"""
render_lines_new = """            <g 
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
            </g>"""
content = content.replace(render_lines_old, render_lines_new)

with open('/Users/victorzandal/Proyectos/App-UD-Atzeneta/src/components/TaskBoardEditor.tsx', 'w') as f:
    f.write(content)

