import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactPlayer from 'react-player';
import { OpponentVideoClip, ClipAnnotation, ClipAnnotationType, ClipCategory } from '../../types';
import { ClipCategorySelector } from './ClipCategorySelector';
import { ClipAnnotationRenderer } from './ClipAnnotationRenderer';
import {
  X, Save, Trash2, MousePointer2, Sun, UserCircle2,
  ArrowUpRight, Lasso, Waypoints, Search as MagnifierIcon, Type,
  Play, Pause, Snowflake, Eraser, Check
} from 'lucide-react';

const COLORS = ['#ef4444', '#eab308', '#22c55e', '#3b82f6', '#ffffff', '#f97316'];

type Tool = 'select' | ClipAnnotationType;

const TOOLS: { id: Tool; icon: React.ElementType; label: string }[] = [
  { id: 'select', icon: MousePointer2, label: 'Seleccionar' },
  { id: 'spotlight', icon: Sun, label: 'Foco' },
  { id: 'player', icon: UserCircle2, label: 'Marcar jugador' },
  { id: 'line', icon: Waypoints, label: 'Enlazar jugadores (línea)' },
  { id: 'arrow', icon: ArrowUpRight, label: 'Flecha' },
  { id: 'zone', icon: Lasso, label: 'Zona (a mano alzada)' },
  { id: 'magnifier', icon: MagnifierIcon, label: 'Catalejo / Lupa' },
  { id: 'text', icon: Type, label: 'Texto' },
];

interface Props {
  videoUrl: string;
  clip: OpponentVideoClip;
  allClips?: OpponentVideoClip[]; // resto de cortes del vídeo (para pintarlos en la timeline)
  onSave: (clip: OpponentVideoClip) => void;
  onClose: () => void;
  readOnly?: boolean;
}

const clamp = (v: number, min = 0, max = 1) => Math.min(max, Math.max(min, v));
const uid = (t: string) => `${t}-${Date.now()}-${Math.round(Math.random() * 1e4)}`;

type DragState =
  | null
  | { mode: 'move'; id: string; ox: number; oy: number; sx: number; sy: number }
  | { mode: 'radius'; id: string }
  | { mode: 'arrow-end'; id: string }
  | { mode: 'freehand'; id: string };


export const ClipAnnotationEditor: React.FC<Props> = ({ videoUrl, clip, allClips = [], onSave, onClose, readOnly = false }) => {
  const [annotations, setAnnotations] = useState<ClipAnnotation[]>(clip.annotations || []);
  const [freezeTime, setFreezeTime] = useState<number>(clip.freezeTime ?? clip.start ?? 0);
  const [start, setStart] = useState<number>(clip.start ?? 0);
  const [end, setEnd] = useState<number>(clip.end ?? (clip.start ?? 0) + 10);
  const [tool, setTool] = useState<Tool>('select');
  const [color, setColor] = useState<string>(COLORS[0]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawingLineId, setDrawingLineId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [dims, setDims] = useState({ cw: 0, ch: 0 });
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState<number>(clip.freezeTime ?? clip.start ?? 0);
  const [timelineZoom, setTimelineZoom] = useState(1);
  const [showCategoryPrompt, setShowCategoryPrompt] = useState(false);
  const [tempCategory, setTempCategory] = useState<ClipCategory | undefined>(clip.category);

  const playerRef = useRef<any>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const timelineRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState>(null);
  const tlDragRef = useRef<null | 'scrub' | 'start' | 'end' | 'move'>(null);
  const tlGrabRef = useRef(0); // offset (en seg) entre el puntero y el inicio del corte al arrastrarlo

  const [pauseDuration, setPauseDuration] = useState<number>(clip.pauseDuration ?? 3);
  const [hasAutoPaused, setHasAutoPaused] = useState(false);
  const autoPauseTimerRef = useRef<NodeJS.Timeout | null>(null);

  const frozen = !playing; // mientras no reproducimos, mostramos el frame congelado + anotaciones

  // Medir el tamaño en píxeles del lienzo (para posicionar la lupa).
  useEffect(() => {
    const el = overlayRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ cw: el.clientWidth, ch: el.clientHeight });
    });
    ro.observe(el);
    setDims({ cw: el.clientWidth, ch: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Congelar en el segundo elegido cuando estamos parados.
  const seekToFreeze = () => {
    if (playerRef.current) {
      try { playerRef.current.currentTime = freezeTime; } catch { /* noop */ }
    }
  };
  useEffect(() => {
    if (frozen) seekToFreeze();
  }, [freezeTime, frozen]); // eslint-disable-line react-hooks/exhaustive-deps

  const selected = annotations.find(a => a.id === selectedId) || null;

  const update = (fn: (list: ClipAnnotation[]) => ClipAnnotation[]) => setAnnotations(fn);
  const patch = (id: string, u: Partial<ClipAnnotation>) =>
    update(list => list.map(a => (a.id === id ? { ...a, ...u } : a)));

  const toNorm = (clientX: number, clientY: number) => {
    const rect = overlayRef.current!.getBoundingClientRect();
    return {
      x: clamp((clientX - rect.left) / rect.width),
      y: clamp((clientY - rect.top) / rect.height),
    };
  };

  const defaultFor = (t: ClipAnnotationType, x: number, y: number): ClipAnnotation => {
    const base = { id: uid(t), type: t, color, x, y } as ClipAnnotation;
    switch (t) {
      case 'spotlight': return { ...base, radius: 0.1 };
      case 'player': return { ...base, radius: 0.05, label: '' };
      case 'magnifier': return { ...base, radius: 0.11, zoom: 2 };
      case 'arrow': return { ...base, x2: clamp(x + 0.12), y2: clamp(y - 0.08) };
      case 'text': return { ...base, label: 'Texto' };
      default: return base;
    }
  };

  // Termina la línea de jugadores en curso (si la hay) y cambia de herramienta.
  const finishLine = () => {
    if (drawingLineId) {
      setAnnotations(list => list.filter(a => a.type !== 'line' || (a.points?.length || 0) >= 2));
      setDrawingLineId(null);
    }
  };
  const selectTool = (t: Tool) => {
    finishLine();
    setTool(t);
  };

  // ----- Interacción de puntero -----
  const onPointerDown = (e: React.PointerEvent) => {
    if (readOnly || !frozen) return;
    const { x, y } = toNorm(e.clientX, e.clientY);
    (e.target as Element).setPointerCapture?.(e.pointerId);

    if (tool === 'select') {
      const hit = hitTest(x, y);
      setSelectedId(hit?.id ?? null);
      if (hit) {
        dragRef.current = { mode: 'move', id: hit.id, ox: hit.x, oy: hit.y, sx: x, sy: y };
      }
      return;
    }

    // Línea que enlaza jugadores: cada clic añade un punto (vértice).
    if (tool === 'line') {
      if (drawingLineId) {
        update(list => list.map(a =>
          a.id === drawingLineId ? { ...a, points: [...(a.points || []), { x, y }] } : a));
      } else {
        const a: ClipAnnotation = { id: uid('line'), type: 'line', color, x, y, points: [{ x, y }] };
        update(list => [...list, a]);
        setDrawingLineId(a.id);
        setSelectedId(a.id);
      }
      return;
    }

    // Zona a mano alzada: arrastrar con el ratón traza el contorno.
    if (tool === 'zone') {
      const a: ClipAnnotation = { id: uid('zone'), type: 'zone', color, x, y, points: [{ x, y }] };
      update(list => [...list, a]);
      setSelectedId(a.id);
      dragRef.current = { mode: 'freehand', id: a.id };
      return;
    }

    // Crear nueva anotación con la herramienta activa.
    const a = defaultFor(tool, x, y);
    update(list => [...list, a]);
    setSelectedId(a.id);
    if (tool === 'arrow') dragRef.current = { mode: 'arrow-end', id: a.id };
    else if (tool === 'spotlight' || tool === 'player' || tool === 'magnifier') dragRef.current = { mode: 'radius', id: a.id };
    setTool('select');
  };

  // Doble clic: termina la línea de jugadores en curso.
  const onDoubleClick = () => { if (drawingLineId) { finishLine(); setTool('select'); } };

  const onPointerMove = (e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d) return;
    const { x, y } = toNorm(e.clientX, e.clientY);
    if (d.mode === 'move') {
      const a = annotations.find(x0 => x0.id === d.id);
      if (!a) return;
      const dx = x - d.sx, dy = y - d.sy;
      const nx = clamp(d.ox + dx), ny = clamp(d.oy + dy);
      const u: Partial<ClipAnnotation> = { x: nx, y: ny };
      const mdx = nx - a.x, mdy = ny - a.y; // desplazamiento aplicado
      if (a.type === 'arrow' && a.x2 != null && a.y2 != null) {
        u.x2 = clamp(a.x2 + mdx);
        u.y2 = clamp(a.y2 + mdy);
      }
      if (a.points) {
        u.points = a.points.map(p => ({ x: clamp(p.x + mdx), y: clamp(p.y + mdy) }));
      }
      patch(d.id, u);
    } else if (d.mode === 'arrow-end') {
      patch(d.id, { x2: x, y2: y });
    } else if (d.mode === 'radius') {
      const a = annotations.find(x0 => x0.id === d.id);
      if (!a) return;
      patch(d.id, { radius: clamp(Math.hypot(x - a.x, y - a.y), 0.02, 0.6) });
    } else if (d.mode === 'freehand') {
      update(list => list.map(a => {
        if (a.id !== d.id) return a;
        const pts = a.points || [];
        const last = pts[pts.length - 1];
        // Evita acumular miles de puntos: sólo añade si te has movido algo.
        if (last && Math.hypot(x - last.x, y - last.y) < 0.008) return a;
        return { ...a, points: [...pts, { x, y }] };
      }));
    }
  };

  const onPointerUp = () => {
    if (dragRef.current?.mode === 'freehand') setTool('select');
    dragRef.current = null;
  };

  const hitTest = (x: number, y: number): ClipAnnotation | null => {
    for (let i = annotations.length - 1; i >= 0; i--) {
      const a = annotations[i];
      if (a.type === 'zone' && a.points && a.points.length >= 3) {
        if (pointInPoly(x, y, a.points)) return a;
      } else if (a.type === 'zone') {
        if (x >= a.x && x <= a.x + (a.w || 0) && y >= a.y && y <= a.y + (a.h || 0)) return a;
      } else if (a.type === 'line' && a.points) {
        for (let k = 0; k < a.points.length - 1; k++) {
          if (distToSeg(x, y, a.points[k].x, a.points[k].y, a.points[k + 1].x, a.points[k + 1].y) < 0.025) return a;
        }
      } else if (a.type === 'arrow') {
        if (distToSeg(x, y, a.x, a.y, a.x2 || a.x, a.y2 || a.y) < 0.025) return a;
      } else if (a.radius != null) {
        if (Math.hypot(x - a.x, y - a.y) <= a.radius + 0.02) return a;
      } else {
        if (Math.hypot(x - a.x, y - a.y) < 0.05) return a;
      }
    }
    return null;
  };

  const deleteSelected = () => {
    if (!selectedId) return;
    update(list => list.filter(a => a.id !== selectedId));
    setSelectedId(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (readOnly) return;
      const el = document.activeElement;
      const typing = el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA');
      if ((e.key === 'Enter' || e.key === 'Escape') && drawingLineId) {
        finishLine();
        setTool('select');
        return;
      }
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedId && !typing) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selectedId, readOnly, drawingLineId]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSave = () => {
    if (!tempCategory?.phase) {
      setShowCategoryPrompt(true);
      return;
    }
    commitSave(tempCategory);
  };

  const commitSave = (cat?: ClipCategory) => {
    onSave({ ...clip, start: Math.round(start), end: Math.round(end), freezeTime, pauseDuration, annotations, category: cat });
    onClose();
  };

  // Mueve el vídeo a un segundo concreto (scrub). Si estamos congelados, ese
  // pasa a ser el fotograma sobre el que se anota.
  const seekTo = (t: number, freeze = frozen) => {
    const clamped = Math.max(0, duration ? Math.min(t, duration) : t);
    setCurrentTime(clamped);
    if (playerRef.current) {
      try { playerRef.current.currentTime = clamped; } catch { /* noop */ }
    }
    if (freeze) setFreezeTime(clamped);
    if (t < freezeTime) {
      setHasAutoPaused(false);
    }
    if (autoPauseTimerRef.current) {
      clearTimeout(autoPauseTimerRef.current);
      autoPauseTimerRef.current = null;
    }
  };

  // ----- Timeline (barra de tiempo) -----
  const tlTimeAt = (clientX: number) => {
    const rect = timelineRef.current!.getBoundingClientRect();
    const pct = clamp((clientX - rect.left) / rect.width);
    return pct * (duration || 0);
  };
  const onTlDown = (e: React.PointerEvent, mode: 'scrub' | 'start' | 'end' | 'move') => {
    if (readOnly && mode !== 'scrub') return;
    if (!duration) return;
    e.stopPropagation();
    e.preventDefault();
    tlDragRef.current = mode;
    const startS = start, endS = end;
    if (mode === 'move') { setPlaying(false); tlGrabRef.current = tlTimeAt(e.clientX) - startS; }
    if (mode === 'scrub') { setPlaying(false); seekTo(tlTimeAt(e.clientX)); }

    const onMove = (ev: PointerEvent) => {
      const t = tlTimeAt(ev.clientX);
      if (mode === 'scrub') seekTo(t);
      else if (mode === 'start') { const ns = Math.max(0, Math.min(t, endS - 0.5)); setStart(ns); seekTo(ns, false); }
      else if (mode === 'end') { const ne = Math.min(Math.max(t, startS + 0.5), duration); setEnd(ne); seekTo(ne, false); }
      else if (mode === 'move') {
        const dur = endS - startS;
        const ns = Math.max(0, Math.min(t - tlGrabRef.current, duration - dur));
        setStart(ns); setEnd(ns + dur); seekTo(ns, false);
      }
    };
    const onUp = () => {
      tlDragRef.current = null;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const spotlights = annotations.filter(a => a.type === 'spotlight');

  const content = (
    <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col animate-fade-in">
      {/* Barra superior */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-black-border bg-brand-black">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-sm font-bold text-white truncate">
            {readOnly ? 'Clip anotado' : 'Editor de Clip'} · {clip.title || 'Sin título'}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {!readOnly && (
            <button type="button" onClick={handleSave} className="btn-primary py-2 px-4 text-xs">
              <Save className="w-4 h-4 mr-1" /> Guardar Clip
            </button>
          )}
          <button type="button" onClick={onClose} className="flex items-center gap-2 px-4 py-2 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white border border-brand-red-600/30 rounded-lg transition-colors font-bold uppercase text-xs tracking-wide shadow-lg">
            <X className="w-5 h-5" /> Cerrar
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Herramientas (izquierda / arriba en móvil) */}
        {!readOnly && (
          <div className="flex lg:flex-col gap-2 p-3 bg-brand-black border-b lg:border-b-0 lg:border-r border-brand-black-border overflow-x-auto no-scrollbar">
            {TOOLS.map(t => (
              <button
                key={t.id}
                type="button"
                title={t.label}
                onClick={() => selectTool(t.id)}
                className={`shrink-0 flex items-center justify-center w-11 h-11 rounded-lg border transition-colors ${
                  tool === t.id
                    ? 'bg-brand-red-600 border-brand-red-600 text-white'
                    : 'bg-black border-brand-black-border text-brand-gray-muted hover:text-white'
                }`}
              >
                <t.icon className="w-5 h-5" />
              </button>
            ))}
            <div className="w-px lg:w-full lg:h-px bg-brand-black-border mx-1 lg:my-1 shrink-0" />
            {/* Colores */}
            <div className="flex lg:flex-wrap gap-1.5 shrink-0 lg:w-11">
              {COLORS.map(c => (
                <button
                  key={c}
                  type="button"
                  onClick={() => { setColor(c); if (selected) patch(selected.id, { color: c }); }}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'scale-110 border-white' : 'border-black/40'}`}
                  style={{ backgroundColor: c }}
                />
              ))}
            </div>
          </div>
        )}

        {/* Lienzo del vídeo */}
        <div className="flex-1 flex items-center justify-center p-4 min-h-0">
          <div className="w-full max-w-5xl">
            <div className="relative w-full aspect-video bg-black rounded-lg overflow-hidden border border-brand-black-border">
              {(() => {
                const Player: any = ReactPlayer;
                return (
                  <Player
                    ref={playerRef}
                src={videoUrl}
                width="100%"
                height="100%"
                controls={false}
                playing={playing}
                onReady={() => { 
                  if (frozen) seekToFreeze(); 
                  const d = playerRef.current?.duration || playerRef.current?.getDuration?.();
                  if (d && d > 0) setDuration(d);
                }}
                onDurationChange={(e) => {
                  const d = e.currentTarget.duration;
                  if (d && !isNaN(d)) setDuration(d);
                }}
                onTimeUpdate={(e) => {
                  const t = e.currentTarget.currentTime;
                  setCurrentTime(t);
                  
                  // 1. Loop/Boundaries en reproducción
                  if (!frozen) {
                    if (t >= end) {
                      seekTo(start, false);
                      return;
                    }
                    if (t < start) {
                      seekTo(start, false);
                      return;
                    }

                    // 2. Auto-pausa en anotaciones
                    if (annotations.length > 0 && !hasAutoPaused && t >= freezeTime && t < freezeTime + 0.3) {
                      setPlaying(false); // esto hará frozen=true y mostrará el dibujo
                      setHasAutoPaused(true);
                      seekToFreeze(); // asegura que clavemos el tiempo exacto
                      
                      autoPauseTimerRef.current = setTimeout(() => {
                        setPlaying(true);
                      }, pauseDuration * 1000);
                    }
                  }
                }}
              />
                );
              })()}

              {/* Capa de anotaciones (visible sólo congelado) */}
              {frozen && (
                <ClipAnnotationRenderer
                  annotations={annotations}
                  selectedId={selectedId}
                  cw={dims.cw}
                  ch={dims.ch}
                  videoUrl={videoUrl}
                  freezeTime={freezeTime}
                />
              )}

              {/* Capa de captura de puntero (edición) */}
              {!readOnly && frozen && (
                <div
                  ref={overlayRef}
                  onPointerDown={onPointerDown}
                  onPointerMove={onPointerMove}
                  onPointerUp={onPointerUp}
                  onDoubleClick={onDoubleClick}
                  className={`absolute inset-0 ${tool === 'select' ? 'cursor-default' : 'cursor-crosshair'}`}
                  style={{ touchAction: 'none' }}
                />
              )}
              {/* En readOnly medimos con un div invisible para la lupa */}
              {(readOnly || playing) && <div ref={overlayRef} className="absolute inset-0 pointer-events-none" />}

              {/* Ayuda contextual mientras se dibuja la línea de jugadores */}
              {drawingLineId && (
                <div className="absolute top-3 left-1/2 -translate-x-1/2 flex items-center gap-2 bg-black/85 border border-brand-black-border rounded-lg px-3 py-1.5 text-xs text-white">
                  <span>Clic sobre cada jugador para enlazarlos</span>
                  <button
                    type="button"
                    onClick={() => { finishLine(); setTool('select'); }}
                    className="flex items-center gap-1 bg-brand-red-600 hover:bg-brand-red-500 text-white rounded px-2 py-0.5 font-semibold"
                  >
                    <Check className="w-3 h-3" /> Finalizar
                  </button>
                </div>
              )}
            </div>

            {/* Línea de tiempo */}
            <div className="mt-3">
              <div className="overflow-x-auto no-scrollbar border border-brand-black-border rounded-lg bg-black">
                <div style={{ width: `${timelineZoom * 100}%`, minWidth: '100%' }}>
                  <div
                    ref={timelineRef}
                    onPointerDown={(e) => onTlDown(e, 'scrub')}
                    className="relative h-9 select-none"
                    style={{ touchAction: 'none', cursor: duration ? 'pointer' : 'default' }}
                  >
                {duration === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center text-[11px] text-brand-gray-dark">
                    Cargando duración del vídeo…
                  </div>
                ) : (
                  <>
                    {/* Otros cortes del vídeo (referencia) */}
                    {allClips.filter(c => c.id !== clip.id).map(c => {
                      const hasDrawings = c.annotations && c.annotations.length > 0;
                      return (
                        <React.Fragment key={c.id}>
                          <div
                            className="absolute top-1.5 bottom-1.5 bg-brand-gray-dark/40 border border-brand-gray-dark/40 rounded"
                            style={{ left: `${(c.start / duration) * 100}%`, width: `${(Math.max(0, c.end - c.start) / duration) * 100}%` }}
                            title={`${c.title} (${fmt(c.start)}–${fmt(c.end)})`}
                          />
                          {hasDrawings && (
                            <div 
                              className="absolute top-0 bottom-0 w-1 flex items-center justify-center z-10 pointer-events-none"
                              style={{ left: `${((c.freezeTime ?? c.start) / duration) * 100}%` }}
                            >
                              <div className="w-1.5 h-1.5 rounded-full bg-brand-gray-light shadow-[0_0_2px_black]" title="Contiene dibujos" />
                            </div>
                          )}
                        </React.Fragment>
                      );
                    })}

                    {/* Corte actual (editable): arrastrar el cuerpo lo mueve entero */}
                    <div
                      onPointerDown={(e) => !readOnly && onTlDown(e, 'move')}
                      className={`absolute top-1.5 bottom-1.5 bg-brand-red-600/30 border border-brand-red-600 rounded ${readOnly ? '' : 'cursor-grab active:cursor-grabbing'}`}
                      style={{ left: `${(start / duration) * 100}%`, width: `${(Math.max(0, end - start) / duration) * 100}%`, touchAction: 'none' }}
                      title={readOnly ? undefined : 'Arrastra para mover el corte'}
                    />
                    {/* Tirador inicio */}
                    {!readOnly && (
                      <div
                        onPointerDown={(e) => onTlDown(e, 'start')}
                        className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-col-resize z-10"
                        style={{ left: `${(start / duration) * 100}%`, touchAction: 'none' }}
                        title="Arrastra para cambiar el inicio"
                      >
                        <div className="w-1.5 h-6 bg-brand-red-500 rounded-full shadow ring-1 ring-black/40" />
                      </div>
                    )}
                    {/* Tirador fin */}
                    {!readOnly && (
                      <div
                        onPointerDown={(e) => onTlDown(e, 'end')}
                        className="absolute top-0 bottom-0 w-4 -ml-2 flex items-center justify-center cursor-col-resize z-10"
                        style={{ left: `${(end / duration) * 100}%`, touchAction: 'none' }}
                        title="Arrastra para cambiar el fin"
                      >
                        <div className="w-1.5 h-6 bg-brand-red-500 rounded-full shadow ring-1 ring-black/40" />
                      </div>
                    )}

                    {/* Marca del fotograma congelado / con dibujos */}
                    <div
                      className={`absolute top-0 bottom-0 w-px pointer-events-none z-20 ${annotations.length > 0 ? 'bg-yellow-400' : 'bg-white/70'}`}
                      style={{ left: `${(freezeTime / duration) * 100}%` }}
                    >
                      <div className={`absolute -top-1 -left-1 w-2 h-2 rounded-full ${annotations.length > 0 ? 'bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.6)]' : 'bg-white'}`} title={annotations.length > 0 ? "Fotograma con dibujos" : "Fotograma congelado"} />
                    </div>

                    {/* Cabezal de reproducción */}
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-brand-red-500 pointer-events-none z-30"
                      style={{ left: `${((frozen ? freezeTime : currentTime) / duration) * 100}%` }}
                    />
                  </>
                )}
                  </div>
                </div>
              </div>
              {duration > 0 && (
                <div className="flex justify-between mt-1 text-[10px] text-brand-gray-dark font-mono">
                  <span>{fmt(frozen ? freezeTime : currentTime)}</span>
                  <span>Corte: {fmt(start)} – {fmt(end)} ({fmt(Math.max(0, end - start))})</span>
                  <span>{fmt(duration)}</span>
                </div>
              )}
            </div>

            {/* Controles inferiores */}
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  if (autoPauseTimerRef.current) {
                    clearTimeout(autoPauseTimerRef.current);
                    autoPauseTimerRef.current = null;
                  }
                  if (!playing && currentTime >= end) {
                    seekTo(start, false);
                  }
                  setPlaying(p => !p);
                }}
                className="flex items-center gap-1.5 bg-black border border-brand-black-border rounded-lg px-3 py-2 text-xs text-brand-gray-light hover:text-white"
              >
                {playing ? <><Pause className="w-4 h-4" /> Pausar</> : <><Play className="w-4 h-4" /> Reproducir</>}
              </button>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => {
                    const t = playerRef.current?.currentTime ?? freezeTime;
                    setFreezeTime(Math.max(0, t));
                    setPlaying(false);
                  }}
                  className="flex items-center gap-1.5 bg-black border border-brand-black-border rounded-lg px-3 py-2 text-xs text-brand-gray-light hover:text-white"
                  title="Congelar el fotograma actual para anotar"
                >
                  <Snowflake className="w-4 h-4 text-brand-red-500" /> Congelar aquí
                </button>
              )}

              <span className="text-xs text-brand-gray-muted font-mono bg-black border border-brand-black-border rounded-lg px-3 py-2">
                Frame: {fmt(freezeTime)}
              </span>

              {!readOnly && (
                <div className="flex items-center gap-2 bg-black border border-brand-black-border rounded-lg pl-3 pr-2 py-1.5">
                  <span className="text-xs text-brand-gray-muted whitespace-nowrap">Pausa (seg):</span>
                  <input
                    type="number"
                    min={1} max={10}
                    value={pauseDuration}
                    onChange={(e) => setPauseDuration(Number(e.target.value) || 3)}
                    className="w-12 bg-transparent text-white text-xs border border-brand-black-border rounded px-1 py-0.5 text-center outline-none focus:border-brand-red-600"
                    title="Segundos que se detendrá el vídeo para ver el dibujo"
                  />
                </div>
              )}

              {/* Slider de Zoom del timeline */}
              <div className="flex items-center gap-2 bg-black border border-brand-black-border rounded-lg px-3 py-1.5 ml-2">
                <span className="text-xs text-brand-gray-muted whitespace-nowrap" title="Ampliar dimensiones de la línea de tiempo">Zoom:</span>
                <input
                  type="range"
                  min="1" max="20" step="0.5"
                  value={timelineZoom}
                  onChange={(e) => setTimelineZoom(Number(e.target.value))}
                  className="w-24 accent-brand-red-600"
                  title="Zoom en la línea de tiempo"
                />
                <span className="text-xs text-brand-gray-muted font-mono w-6 text-right">{timelineZoom}x</span>
              </div>

              {!readOnly && selected && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  className="flex items-center gap-1.5 bg-black border border-brand-black-border rounded-lg px-3 py-2 text-xs text-brand-gray-light hover:text-brand-red-500 ml-auto"
                >
                  <Trash2 className="w-4 h-4" /> Borrar selección
                </button>
              )}
              {!readOnly && annotations.length > 0 && (
                <button
                  type="button"
                  onClick={() => { setAnnotations([]); setSelectedId(null); }}
                  className="flex items-center gap-1.5 bg-black border border-brand-black-border rounded-lg px-3 py-2 text-xs text-brand-gray-muted hover:text-white"
                >
                  <Eraser className="w-4 h-4" /> Limpiar
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Panel de propiedades de la anotación seleccionada */}
        {!readOnly && selected && (
          <div className="w-full lg:w-64 p-4 bg-brand-black border-t lg:border-t-0 lg:border-l border-brand-black-border space-y-4 overflow-y-auto no-scrollbar">
            <h4 className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider">
              {TOOLS.find(t => t.id === selected.type)?.label || 'Anotación'}
            </h4>

            {(selected.type === 'player' || selected.type === 'text') && (
              <label className="block">
                <span className="text-[11px] text-brand-gray-muted">Etiqueta / Nº</span>
                <input
                  type="text"
                  value={selected.label || ''}
                  onChange={(e) => patch(selected.id, { label: e.target.value })}
                  className="w-full mt-1 bg-black border border-brand-black-border rounded px-2 py-1.5 text-sm text-white outline-none focus:border-brand-red-600"
                  placeholder={selected.type === 'player' ? 'Ej. 10' : 'Texto...'}
                />
              </label>
            )}

            {selected.type === 'magnifier' && (
              <label className="block">
                <span className="text-[11px] text-brand-gray-muted">Ampliación (x{selected.zoom || 2})</span>
                <input
                  type="range" min={1.5} max={4} step={0.5}
                  value={selected.zoom || 2}
                  onChange={(e) => patch(selected.id, { zoom: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-brand-red-600"
                />
              </label>
            )}

            {(selected.radius != null) && (
              <label className="block">
                <span className="text-[11px] text-brand-gray-muted">Tamaño</span>
                <input
                  type="range" min={0.02} max={0.4} step={0.005}
                  value={selected.radius}
                  onChange={(e) => patch(selected.id, { radius: parseFloat(e.target.value) })}
                  className="w-full mt-1 accent-brand-red-600"
                />
              </label>
            )}

            <div>
              <span className="text-[11px] text-brand-gray-muted">Color</span>
              <div className="flex flex-wrap gap-2 mt-1">
                {COLORS.map(c => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => patch(selected.id, { color: c })}
                    className={`w-6 h-6 rounded-full border-2 ${selected.color === c ? 'border-white scale-110' : 'border-black/40'}`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <p className="text-[11px] text-brand-gray-dark leading-relaxed pt-2 border-t border-brand-black-border">
              Arrastra la anotación para moverla. Pulsa <kbd className="bg-black px-1 rounded">Supr</kbd> para borrarla.
            </p>
          </div>
        )}
      </div>

      {/* Modal de categorización al guardar */}
      {showCategoryPrompt && (
        <div className="fixed inset-0 z-[100] bg-black/80 flex items-center justify-center p-4">
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 w-full max-w-sm flex flex-col gap-4 animate-fade-in shadow-premium">
            <h3 className="text-lg font-bold text-white uppercase tracking-wider">Catalogar el Corte</h3>
            <p className="text-sm text-brand-gray-light leading-relaxed">Por favor, asigna una sección a este corte antes de guardarlo para que quede correctamente organizado.</p>
            <div className="bg-black border border-brand-black-border p-4 rounded-xl">
              <ClipCategorySelector value={tempCategory} onChange={setTempCategory} />
            </div>
            <div className="flex justify-end gap-3 mt-2">
              <button onClick={() => commitSave(clip.category)} className="text-brand-gray-muted hover:text-white text-xs px-2 py-2 transition-colors">
                Guardar sin catalogar
              </button>
              <button onClick={() => { if (tempCategory?.phase) commitSave(tempCategory); }} className="btn-primary py-2 px-6 text-sm flex items-center gap-2" disabled={!tempCategory?.phase}>
                <Check className="w-4 h-4" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  return createPortal(content, document.body);
};

// Distancia de un punto a un segmento (para seleccionar flechas y líneas).
function distToSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  const len2 = dx * dx + dy * dy || 1e-9;
  let t = ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

// Test punto-en-polígono (ray casting) para seleccionar zonas a mano alzada.
function pointInPoly(px: number, py: number, pts: { x: number; y: number }[]) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y, xj = pts[j].x, yj = pts[j].y;
    if ((yi > py) !== (yj > py) && px < ((xj - xi) * (py - yi)) / (yj - yi + 1e-9) + xi) inside = !inside;
  }
  return inside;
}
