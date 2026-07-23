import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useQuery } from '@tanstack/react-query';
import ReactPlayer from 'react-player';
import type {
  OpponentPresentation, PresentationSlide, PresentationBlock,
  OpponentLibraryVideo, OpponentVideoClip,
} from '../../types';
import {
  X, ChevronLeft, ChevronRight, Maximize2, AlertTriangle, Film, LayoutGrid,
  Pencil, Eraser, Undo2, Trash2,
} from 'lucide-react';
import { FormationPitch } from './FormationPitch';
import { TaskBoardEditor } from '../TaskBoardEditor';
import { ClipAnnotationRenderer } from './ClipAnnotationRenderer';
import { YouTubePlayer } from './YouTubePlayer';
import { detectVideoProvider } from '../../utils/opponentVideo';
import { getValidUrl, formatTime } from '../../utils/opponentVideo';
import { dataService } from '../../services/data';

interface Props {
  presentation: OpponentPresentation;
  libraryVideos: OpponentLibraryVideo[];
  opponentName: string;
  onClose: () => void;
}

export const BLOCK_LABELS: Record<PresentationBlock, string> = {
  generales: 'Aspectos Generales',
  jugadores: 'Jugadores Destacados',
  con_balon: 'Con Balón',
  sin_balon: 'Sin Balón',
  abp: 'Balón Parado',
};

// Colores del rotulador (más un selector libre para cualquier color).
const MARKER_COLORS = ['#ef4444', '#f59e0b', '#facc15', '#22c55e', '#38bdf8', '#a855f7', '#ffffff', '#000000'];

interface Stroke {
  color: string;
  width: number;
  points: { x: number; y: number }[]; // coordenadas normalizadas 0..1
}

// Reproduce un clip de la videoteca a pantalla completa, con auto-pausa en el
// frame congelado para mostrar la telestración (mismo patrón que el estudio).
const ClipSlide: React.FC<{
  clip: OpponentVideoClip;
  videoUrl: string;
}> = ({ clip, videoUrl }) => {
  const playerRef = useRef<any>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [dims, setDims] = useState({ cw: 0, ch: 0 });
  const [playing, setPlaying] = useState(true);
  const [showOverlay, setShowOverlay] = useState(false);
  const start = clip.start || 0;
  const end = clip.end || 0;
  const freezeTime = clip.freezeTime ?? start;
  
  const [currentTime, setCurrentTime] = useState(start);
  const [duration, setDuration] = useState(0);
  
  const hasAutoPausedRef = useRef(false);
  const reachedEndRef = useRef(false);
  const isSeekingRef = useRef(false);

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const validUrl = getValidUrl(videoUrl);
  const hasAnnotations = !!(clip.annotations && clip.annotations.length > 0);

  // Dimensiones del lienzo
  useEffect(() => {
    const ob = new ResizeObserver(entries => {
      if (entries[0]) {
        setDims({ cw: entries[0].contentRect.width, ch: entries[0].contentRect.height });
      }
    });
    if (wrapperRef.current) ob.observe(wrapperRef.current);
    return () => ob.disconnect();
  }, []);

  // Interceptar teclas de control
  useEffect(() => {
    const onKey = async (e: KeyboardEvent) => {
      const player = playerRef.current;
      if (!player) return;

      const seekTo = (t: number) => {
        if (typeof player.seekTo === 'function') {
          player.seekTo(t, 'seconds');
        } else {
          try { player.currentTime = t; } catch { /* noop */ }
        }
      };

      const getCurrentTime = async (): Promise<number> => {
        if (typeof player.getCurrentTime === 'function') {
          const val = player.getCurrentTime();
          return (val instanceof Promise ? await val : val) || start;
        }
        return player.currentTime || start;
      };

      if (e.key === ' ') {
        e.stopPropagation();
        e.preventDefault();
        if (reachedEndRef.current) {
          reachedEndRef.current = false;
          hasAutoPausedRef.current = false;
          seekTo(start);
          setCurrentTime(start);
          setPlaying(true);
        } else {
          setPlaying(p => !p);
        }
      } else if (e.key === 'ArrowLeft') {
        e.stopPropagation();
        e.preventDefault();
        reachedEndRef.current = false;
        const current = await getCurrentTime();
        const newTime = Math.max(start, current - 5);
        seekTo(newTime);
        setCurrentTime(newTime);
        if (newTime < freezeTime) hasAutoPausedRef.current = false;
      } else if (e.key === 'ArrowRight') {
        if (reachedEndRef.current) {
          return;
        }
        e.stopPropagation();
        e.preventDefault();
        const current = await getCurrentTime();
        let newTime = current + 5;
        
        if (newTime >= end) {
          newTime = end;
          seekTo(end);
          setCurrentTime(end);
          setPlaying(false);
          reachedEndRef.current = true;
          hasAutoPausedRef.current = false;
        } else {
          seekTo(newTime);
          setCurrentTime(newTime);
        }
      }
    };
    
    // Usamos true (capture phase) para ser los primeros en interceptar
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [start, end, freezeTime]);

  return (
    <div className="relative w-full h-full bg-black rounded-xl overflow-hidden shadow-2xl flex items-center justify-center p-2 sm:p-4">
      {/* Contenedor 16:9 exacto para que los dibujos coincidan al milímetro con el vídeo */}
      <div 
        ref={wrapperRef} 
        className="relative w-full flex items-center justify-center"
        style={{ aspectRatio: '16/9', maxHeight: '100%', maxWidth: '100%' }}
      >
        {(() => {
          const provider = detectVideoProvider(validUrl).provider;
          const Player: any = provider === 'youtube' ? YouTubePlayer : ReactPlayer;
          return (
            <Player
              ref={playerRef}
              url={validUrl}
              width="100%"
              height="100%"
          playing={playing}
          controls={false} // Ocultamos los controles de YouTube para mostrar solo nuestro progreso
          progressInterval={100} // ESENCIAL para que el bucle y la pausa detecten el milisegundo exacto
          onPlay={() => setPlaying(true)}
          onPause={() => setPlaying(false)}
          onReady={() => {
             if (playerRef.current) {
               if (typeof playerRef.current.seekTo === 'function') {
                 playerRef.current.seekTo(start, 'seconds');
               } else {
                 try { playerRef.current.currentTime = start; } catch { /* noop */ }
               }
               const d = playerRef.current.duration || (playerRef.current.getDuration ? playerRef.current.getDuration() : 0);
               if (d > 0) setDuration(d);
             }
          }}
          onProgress={({ playedSeconds }: { playedSeconds: number }) => {
            if (isSeekingRef.current) return; // Ignorar onProgress mientras YouTube ejecuta un salto
            
            const t = playedSeconds;
            setCurrentTime(t);

            // Forzar inicio si YouTube empezó desde 0 por error
            if (t < start - 0.5) {
              isSeekingRef.current = true;
              if (playerRef.current) {
                if (typeof playerRef.current.seekTo === 'function') {
                  playerRef.current.seekTo(start, 'seconds');
                } else {
                  try { playerRef.current.currentTime = start; } catch { /* noop */ }
                }
              }
              reachedEndRef.current = false;
              hasAutoPausedRef.current = false;
              setTimeout(() => { isSeekingRef.current = false; }, 500);
              return;
            }

            if (t < freezeTime) {
               hasAutoPausedRef.current = false;
            }

            if (hasAnnotations && !hasAutoPausedRef.current && t >= freezeTime) {
              hasAutoPausedRef.current = true;
              setPlaying(false);
              playerRef.current?.seekTo(freezeTime, 'seconds');
              setCurrentTime(freezeTime);
              setShowOverlay(true);
              setTimeout(() => {
                setShowOverlay(false);
                if (!reachedEndRef.current) setPlaying(true);
              }, (clip.pauseDuration || 3) * 1000);
            }
            
            if (t >= end) {
              isSeekingRef.current = true;
              if (playerRef.current) {
                if (typeof playerRef.current.seekTo === 'function') {
                  playerRef.current.seekTo(start, 'seconds');
                } else {
                  try { playerRef.current.currentTime = start; } catch { /* noop */ }
                }
              }
              setCurrentTime(start);
              hasAutoPausedRef.current = false;
              // Restaurar flag después de un breve delay para dar tiempo al iframe de YouTube
              setTimeout(() => { isSeekingRef.current = false; }, 500);
              // No cambiamos el playing, dejamos que siga reproduciendo en bucle
            }
          }}
        />
          );
        })()}
        
        {showOverlay && (
          <ClipAnnotationRenderer
            annotations={clip.annotations || []}
            cw={dims.cw}
            ch={dims.ch}
            videoUrl={validUrl}
            freezeTime={freezeTime}
          />
        )}
      </div>

      {/* Timeline visual (estilo editor) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[90%] max-w-4xl bg-brand-black/90 backdrop-blur-md border border-brand-black-border rounded-xl p-3 shadow-2xl transition-opacity duration-300">
        <div className="overflow-x-auto no-scrollbar border border-brand-black-border rounded-lg bg-black">
          <div className="relative h-6 select-none w-full">
            {duration === 0 ? (
              <div className="absolute inset-0 flex items-center justify-center text-[10px] text-brand-gray-dark">
                Cargando línea de tiempo...
              </div>
            ) : (
              <>
                {/* Corte actual */}
                <div
                  className="absolute top-1 bottom-1 bg-brand-red-600/30 border border-brand-red-600 rounded"
                  style={{ left: `${(start / duration) * 100}%`, width: `${(Math.max(0, end - start) / duration) * 100}%` }}
                />
                
                {/* Marca del fotograma congelado / con dibujos */}
                {hasAnnotations && (
                  <div
                    className="absolute top-0 bottom-0 w-px pointer-events-none z-20 bg-yellow-400"
                    style={{ left: `${(freezeTime / duration) * 100}%` }}
                  >
                    <div className="absolute -top-1 -left-1 w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_6px_rgba(250,204,21,0.6)]" />
                  </div>
                )}

                {/* Cabezal de reproducción */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-brand-red-500 pointer-events-none z-30"
                  style={{ left: `${(currentTime / duration) * 100}%` }}
                />
              </>
            )}
          </div>
        </div>
        <div className="flex justify-between mt-1.5 text-[10px] text-brand-gray-light font-mono px-1">
          <span>{fmt(currentTime)}</span>
          <span className="text-brand-gray-muted">Corte: {fmt(start)} – {fmt(end)}</span>
          <span>{fmt(duration)}</span>
        </div>
      </div>

      {/* Indicador visual de controles */}
      <div className="absolute bottom-2 right-4 flex items-center gap-2 text-white/50 text-[10px] font-mono pointer-events-none">
        <span>[Espacio] Play/Pausa</span>
        <span>[←/→] ±5s</span>
        {reachedEndRef.current && <span className="text-brand-red-500 font-bold ml-2 animate-pulse">[→] Siguiente Diapositiva</span>}
      </div>
    </div>
  );
};

// Reproductor de presentaciones a pantalla completa: pasa diapositivas con las
// flechas del teclado, Espacio (siguiente), Esc (cerrar) y F (fullscreen real).
// Incluye escudo del club, campograma grande y rotulador para dibujar encima.
export const PresentationPlayer: React.FC<Props> = ({ presentation, libraryVideos, opponentName, onClose }) => {
  const [index, setIndex] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const slides = presentation.slides;
  // La primera diapositiva es siempre una portada automática (índice 0).
  const total = slides.length + 1;
  const isIntro = index === 0;
  const slide: PresentationSlide | undefined = isIntro ? undefined : slides[index - 1];

  // Escudo: primero el del rival (equipo FFCV por nombre), si no el del club.
  const { data: teams = [] } = useQuery({ queryKey: ['teams'], queryFn: () => dataService.getTeams() });
  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: () => dataService.getSettings() });
  const opponentShield = teams.find(t => t.name?.toLowerCase() === opponentName.toLowerCase())?.shield_url || null;
  const clubLogo = settings?.logo_url || null;
  const shield = opponentShield || clubLogo;
  const initials = opponentName.trim().slice(0, 3).toUpperCase();

  // ----- Rotulador (dibujo libre sobre la presentación) -----
  const [drawMode, setDrawMode] = useState(false);
  const [color, setColor] = useState<string>('#ef4444');
  const [width, setWidth] = useState(4);
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [current, setCurrent] = useState<Stroke | null>(null);

  // Limpia los trazos al cambiar de diapositiva.
  useEffect(() => { setStrokes([]); setCurrent(null); }, [index]);

  const go = (dir: 1 | -1) => setIndex(i => Math.min(total - 1, Math.max(0, i + dir)));

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); go(1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
      else if (e.key === 'Escape') { if (drawMode) setDrawMode(false); else onClose(); }
      else if (e.key.toLowerCase() === 'f') { toggleFullscreen(); }
      else if (e.key.toLowerCase() === 'd') { setDrawMode(d => !d); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [total, drawMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleFullscreen = () => {
    const el = rootRef.current;
    if (!el) return;
    if (!document.fullscreenElement) el.requestFullscreen?.().catch(() => { /* noop */ });
    else document.exitFullscreen?.().catch(() => { /* noop */ });
  };

  // --- Handlers de dibujo ---
  const pointFromEvent = (e: React.PointerEvent) => {
    const r = stageRef.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    return { x: (e.clientX - r.left) / r.width, y: (e.clientY - r.top) / r.height };
  };
  const onPointerDown = (e: React.PointerEvent) => {
    if (!drawMode) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    setCurrent({ color, width, points: [pointFromEvent(e)] });
  };
  const onPointerMove = (e: React.PointerEvent) => {
    if (!drawMode || !current) return;
    const p = pointFromEvent(e);
    setCurrent(c => (c ? { ...c, points: [...c.points, p] } : c));
  };
  const onPointerUp = () => {
    if (!current) return;
    setStrokes(s => (current.points.length > 1 ? [...s, current] : s));
    setCurrent(null);
  };
  const undoStroke = () => setStrokes(s => s.slice(0, -1));
  const clearStrokes = () => { setStrokes([]); setCurrent(null); };

  const toPointsAttr = (pts: { x: number; y: number }[]) => pts.map(p => `${p.x},${p.y}`).join(' ');

  // Escudo con fallback a iniciales dentro de un badge.
  const ShieldMark: React.FC<{ size: string; textSize: string }> = ({ size, textSize }) => (
    shield ? (
      <img src={shield} alt="Escudo" className={`${size} object-contain drop-shadow-2xl`} />
    ) : (
      <div className={`${size} rounded-2xl bg-gradient-to-br from-brand-red-600 to-red-900 border-2 border-white/20 flex items-center justify-center shadow-2xl`}>
        <span className={`${textSize} font-black text-white tracking-tight`}>{initials}</span>
      </div>
    )
  );

  // Portada automática: nombre del rival + escudo + "Análisis Rival".
  const renderIntro = () => (
    <div className="relative w-full h-full flex flex-col items-center justify-center text-center overflow-hidden">
      {/* Fondos decorativos rojo/negro */}
      <div className="absolute -top-40 -right-32 w-[520px] h-[520px] bg-brand-red-600/30 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute -bottom-48 -left-32 w-[520px] h-[520px] bg-brand-red-600/20 rounded-full blur-[130px] pointer-events-none" />
      <div className="absolute inset-0 opacity-[0.04] pointer-events-none" style={{ backgroundImage: 'repeating-linear-gradient(45deg, #fff 0, #fff 1px, transparent 1px, transparent 22px)' }} />
      {/* Franja diagonal roja */}
      <div className="absolute -left-10 top-1/2 -translate-y-1/2 w-[130%] h-24 bg-gradient-to-r from-brand-red-600/0 via-brand-red-600/15 to-brand-red-600/0 -rotate-6 pointer-events-none" />

      <div className="relative z-10 flex flex-col items-center gap-6 px-8">
        <span className="text-brand-red-500 text-sm sm:text-base font-black uppercase tracking-[0.5em] pl-[0.5em] bg-brand-red-600/10 border border-brand-red-600/30 rounded-full px-6 py-2">
          Análisis Rival
        </span>

        <div className="relative">
          <div className="absolute inset-0 bg-brand-red-600/40 blur-2xl rounded-full scale-90" />
          <div className="relative"><ShieldMark size="w-36 h-36 sm:w-48 sm:h-48" textSize="text-5xl sm:text-6xl" /></div>
        </div>

        <h1 className="text-6xl sm:text-8xl font-black text-white uppercase tracking-tight leading-none drop-shadow-2xl">
          {opponentName}
        </h1>
        <div className="w-32 h-1.5 bg-gradient-to-r from-transparent via-brand-red-600 to-transparent rounded-full" />

        <div className="flex items-center gap-2.5 text-brand-gray-muted mt-1">
          {clubLogo && <img src={clubLogo} alt="" className="w-6 h-6 object-contain" />}
          <span className="text-xs sm:text-sm font-semibold uppercase tracking-widest">{settings?.club_name || 'UD Atzeneta'} · Cuerpo Técnico</span>
        </div>
      </div>
    </div>
  );

  const renderSlide = (s: PresentationSlide) => {
    switch (s.type) {
      case 'cover':
        return (
          <div className="flex flex-col items-center justify-center text-center gap-5 px-8">
            <ShieldMark size="w-24 h-24 sm:w-32 sm:h-32 mb-1" textSize="text-4xl" />
            <span className="text-brand-red-500 text-sm font-bold uppercase tracking-[0.3em]">{opponentName}</span>
            <h1 className="text-5xl sm:text-7xl font-black text-white uppercase tracking-wide">{s.title || BLOCK_LABELS[s.block]}</h1>
            {s.subtitle && <p className="text-brand-gray-muted text-lg max-w-2xl">{s.subtitle}</p>}
            <div className="w-24 h-1 bg-brand-red-600 rounded-full mt-2" />
          </div>
        );
      case 'text':
        return (
          <div className="w-full max-w-4xl bg-brand-black-card border border-brand-black-border rounded-2xl p-8 sm:p-12 shadow-premium">
            {s.title && <h2 className="text-2xl sm:text-3xl font-black text-brand-red-500 uppercase tracking-wide mb-6">{s.title}</h2>}
            <div 
              className="rich-text text-lg sm:text-xl"
              dangerouslySetInnerHTML={{ __html: s.text || '' }}
            />
          </div>
        );
      case 'formation':
        return (
          <div className="flex flex-col items-center gap-4 h-full w-full py-2">
            {s.title && <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wide shrink-0">{s.title}</h2>}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              <FormationPitch value={s.formation} onChange={() => {}} readOnly fitHeight opponentName={opponentName} />
            </div>
          </div>
        );
      case 'board': {
        const hasText = !!s.text;
        return (
          <div className="flex flex-col items-center gap-4 h-full w-full py-2">
            {s.title && <h2 className="text-xl sm:text-3xl font-black text-white uppercase tracking-wide shrink-0">{s.title}</h2>}
            <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-4 sm:gap-6">
              {/* Board Area */}
              <div className="flex-1 flex flex-col min-h-0 bg-black border border-brand-black-border rounded-2xl overflow-hidden shadow-2xl">
                <TaskBoardEditor value={s.board || ''} onChange={() => {}} readOnly hideToolbar rotateFullField={true} />
              </div>

              {/* Text Area (if exists) */}
              {hasText && (
                <div 
                  className="w-full lg:w-[450px] shrink-0 overflow-y-auto no-scrollbar bg-brand-black-card border border-brand-black-border rounded-2xl p-6 sm:p-8 shadow-2xl rich-text text-base"
                  dangerouslySetInnerHTML={{ __html: s.text! }}
                />
              )}
            </div>
          </div>
        );
      }
      case 'clip': {
        const video = libraryVideos.find(v => v.id === s.videoId);
        const clip = video?.clips.find(c => c.id === s.clipId);
        if (!video || !clip) {
          return (
            <div className="flex flex-col items-center gap-3 text-brand-gray-muted">
              <AlertTriangle className="w-10 h-10 text-amber-500" />
              <p className="text-lg">El clip de esta diapositiva ya no existe en la videoteca.</p>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center gap-4 w-full h-full pb-2">
            {(s.title || clip.title) && (
              <h2 className="text-xl sm:text-2xl font-black text-white uppercase tracking-wide shrink-0">{s.title || clip.title}</h2>
            )}
            <div className="flex-1 min-h-0 w-full flex items-center justify-center">
              <ClipSlide key={s.id} clip={clip} videoUrl={video.url} />
            </div>
            <span className="text-xs text-brand-gray-muted font-mono shrink-0">{formatTime(clip.start)} – {formatTime(clip.end)}</span>
          </div>
        );
      }
      case 'general_summary': {
        const { summaryData } = s;
        if (!summaryData) return null;
        return (
          <div className="flex flex-col h-full w-full gap-4 py-2">
            {s.title && <h2 className="text-xl sm:text-3xl font-black text-brand-red-500 uppercase tracking-wide shrink-0 text-center">{s.title}</h2>}
            <div className="flex-1 min-h-0 w-full flex flex-col lg:flex-row gap-6">
              {/* Columna Izquierda: Sistema Principal */}
              <div className="w-full lg:w-[40%] flex flex-col gap-4 min-h-0">
                {summaryData.mainFormation && (
                  <div className="flex-1 min-h-0 bg-brand-black-card border border-brand-black-border rounded-xl p-3 flex flex-col shadow-premium">
                    <h3 className="text-sm font-bold text-white uppercase mb-2 shrink-0">Sistema Principal: {summaryData.mainFormation.system}</h3>
                    <div className="flex-1 min-h-0 relative">
                       <FormationPitch value={summaryData.mainFormation} onChange={() => {}} readOnly fitHeight opponentName={opponentName} />
                    </div>
                  </div>
                )}
              </div>

              {/* Columna Centro: Sistemas Alternativos */}
              {summaryData.alternativeFormations && summaryData.alternativeFormations.length > 0 && (
                <div className="w-full lg:w-[25%] flex flex-col gap-3 min-h-0 overflow-y-auto no-scrollbar">
                  <h3 className="text-xs font-bold text-brand-gray-muted uppercase mb-1 shrink-0">Sistemas Alternativos</h3>
                  {summaryData.alternativeFormations.map((f, i) => (
                    <div key={i} className="bg-brand-black-card border border-brand-black-border rounded-xl p-3 flex flex-col gap-2 shadow-premium shrink-0 h-64">
                      <span className="text-xs text-white font-bold text-center uppercase">{f.label ? `${f.label}: ${f.system}` : f.system}</span>
                      <div className="flex-1 min-h-0 w-full relative">
                        <FormationPitch value={f} onChange={() => {}} readOnly fitHeight compact opponentName={opponentName} />
                      </div>
                    </div>
                  ))}
                </div>
              )}
              
              {/* Columna Derecha: Textos */}
              <div className="w-full flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar pr-2 pb-20">
                 {summaryData.strengths && summaryData.strengths.length > 0 && (
                   <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 shadow-premium border-l-4 border-l-green-500">
                     <h3 className="text-sm font-black text-green-500 uppercase mb-3 tracking-wide">Fortalezas</h3>
                     <ul className="space-y-2">
                       {summaryData.strengths.map((st, i) => (
                         <li key={i} className="text-sm sm:text-base text-brand-gray-light flex items-start gap-2">
                           <span className="text-green-500 font-bold mt-0.5">•</span> {st}
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}
                 {summaryData.weaknesses && summaryData.weaknesses.length > 0 && (
                   <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 shadow-premium border-l-4 border-l-red-500">
                     <h3 className="text-sm font-black text-red-500 uppercase mb-3 tracking-wide">Debilidades</h3>
                     <ul className="space-y-2">
                       {summaryData.weaknesses.map((wk, i) => (
                         <li key={i} className="text-sm sm:text-base text-brand-gray-light flex items-start gap-2">
                           <span className="text-red-500 font-bold mt-0.5">•</span> {wk}
                         </li>
                       ))}
                     </ul>
                   </div>
                 )}
                  {summaryData.rosterComments && summaryData.rosterComments.length > 0 && (
                    <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 shadow-premium border-l-4 border-l-amber-500">
                      <h3 className="text-sm font-black text-amber-500 uppercase mb-4 tracking-wide">Jugadores Destacados</h3>
                      <div className="flex flex-col gap-4">
                        {summaryData.rosterComments.map((p, i) => (
                          <div key={i} className="flex gap-3 items-start bg-black border border-brand-black-border rounded-lg p-2.5">
                            <div className="w-12 h-12 shrink-0 bg-brand-black-border rounded overflow-hidden border border-brand-black-border">
                              {p.photo_url ? (
                                <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                              ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center bg-brand-black text-brand-gray-muted">
                                  <span className="text-[10px] font-bold uppercase">{p.number ? `Nº${p.number}` : 'No'}</span>
                                </div>
                              )}
                            </div>
                            <div className="flex flex-col flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2 mb-0.5">
                                <span className="font-bold text-white text-sm truncate">{p.name} {p.number ? `(Nº${p.number})` : ''}</span>
                                {p.position && <span className="text-[10px] text-brand-gray-muted uppercase shrink-0">{p.position}</span>}
                              </div>
                              <p className="text-xs text-brand-gray-light leading-snug whitespace-pre-wrap line-clamp-3">
                                {p.comments || 'Sin descripción'}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                 {summaryData.observations && (
                   <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 shadow-premium border-l-4 border-l-brand-gray-muted">
                     <h3 className="text-sm font-black text-brand-gray-muted uppercase mb-3 tracking-wide">Observaciones</h3>
                     <p className="text-sm sm:text-base text-brand-gray-light whitespace-pre-wrap leading-relaxed">{summaryData.observations}</p>
                   </div>
                 )}
              </div>
            </div>
          </div>
        );
      }
      default:
        return null;
    }
  };

  const content = (
    <div ref={rootRef} className="fixed inset-0 z-[110] bg-gradient-to-br from-black via-brand-black to-black flex flex-col animate-fade-in">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3 shrink-0">
        <div className="flex items-center gap-2 min-w-0">
          {shield ? <img src={shield} alt="Escudo" className="w-7 h-7 object-contain shrink-0" /> : <LayoutGrid className="w-5 h-5 text-brand-red-600 shrink-0" />}
          <span className="text-sm font-bold text-white truncate">{presentation.title}</span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button onClick={toggleFullscreen} className="p-2 text-brand-gray-muted hover:text-white rounded-lg hover:bg-brand-black-card transition-colors" title="Pantalla completa (F)">
            <Maximize2 className="w-5 h-5" />
          </button>
          <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white border border-brand-red-600/30 rounded-lg transition-colors font-bold uppercase text-xs tracking-wide" title="Cerrar (Esc)">
            <X className="w-5 h-5" /> Salir
          </button>
        </div>
      </div>

      {/* Diapositiva (escenario) */}
      <div ref={stageRef} className="flex-1 min-h-0 flex items-center justify-center px-4 sm:px-12 py-4 relative">
        {/* Escudo marca de agua en cada diapositiva (salvo portadas) */}
        {shield && !isIntro && slide && slide.type !== 'cover' && (
          <img src={shield} alt="" className="absolute top-3 right-4 w-10 h-10 object-contain opacity-25 pointer-events-none z-[15]" />
        )}

        {/* Flecha izquierda */}
        <button
          onClick={() => go(-1)}
          disabled={index === 0}
          className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-brand-black-card/70 border border-brand-black-border text-white hover:bg-brand-red-600 disabled:opacity-20 disabled:hover:bg-brand-black-card/70 transition-colors z-30"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        <div className="w-full h-full flex items-center justify-center overflow-y-auto no-scrollbar py-2">
          {isIntro ? renderIntro() : slide ? renderSlide(slide) : (
            <div className="flex flex-col items-center gap-3 text-brand-gray-muted">
              <Film className="w-10 h-10 opacity-40" />
              <p>Esta presentación no tiene diapositivas todavía. Añade contenido desde el montador.</p>
            </div>
          )}
        </div>

        {/* Flecha derecha */}
        <button
          onClick={() => go(1)}
          disabled={index >= total - 1}
          className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 p-3 rounded-full bg-brand-black-card/70 border border-brand-black-border text-white hover:bg-brand-red-600 disabled:opacity-20 disabled:hover:bg-brand-black-card/70 transition-colors z-30"
        >
          <ChevronRight className="w-6 h-6" />
        </button>

        {/* Capa de dibujo del rotulador */}
        <svg
          className={`absolute inset-0 w-full h-full z-20 ${drawMode ? 'pointer-events-auto cursor-crosshair' : 'pointer-events-none'}`}
          viewBox="0 0 1 1"
          preserveAspectRatio="none"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerLeave={onPointerUp}
        >
          {[...strokes, ...(current ? [current] : [])].map((st, i) => (
            <polyline
              key={i}
              points={toPointsAttr(st.points)}
              fill="none"
              stroke={st.color}
              strokeWidth={st.width}
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      </div>

      {/* Barra de rotulador (flotante) */}
      <div className="absolute left-1/2 -translate-x-1/2 bottom-16 z-40 flex items-center gap-2 bg-brand-black/90 backdrop-blur-md border border-brand-black-border rounded-full px-3 py-2 shadow-2xl">
        <button
          onClick={() => setDrawMode(d => !d)}
          className={`p-2 rounded-full transition-colors ${drawMode ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}
          title="Rotulador (D)"
        >
          <Pencil className="w-4 h-4" />
        </button>

        {drawMode && (
          <>
            <div className="flex items-center gap-1.5 px-1">
              {MARKER_COLORS.map(c => (
                <button
                  key={c}
                  onClick={() => setColor(c)}
                  className={`w-5 h-5 rounded-full border-2 transition-transform ${color === c ? 'border-white scale-110' : 'border-transparent'}`}
                  style={{ backgroundColor: c }}
                  title={c}
                />
              ))}
              <label className="w-5 h-5 rounded-full overflow-hidden border-2 border-brand-black-border cursor-pointer relative" title="Color libre">
                <span className="absolute inset-0 bg-[conic-gradient(red,orange,yellow,lime,cyan,blue,magenta,red)]" />
                <input type="color" value={color} onChange={e => setColor(e.target.value)} className="opacity-0 w-full h-full cursor-pointer" />
              </label>
            </div>

            <div className="flex items-center gap-1 px-1 border-l border-brand-black-border">
              {[3, 5, 8].map(w => (
                <button key={w} onClick={() => setWidth(w)} className={`rounded-full transition-colors ${width === w ? 'bg-brand-red-600' : 'bg-brand-gray-muted hover:bg-white'}`} style={{ width: w + 4, height: w + 4 }} title={`Grosor ${w}`} />
              ))}
            </div>

            <button onClick={undoStroke} disabled={strokes.length === 0} className="p-2 text-brand-gray-muted hover:text-white disabled:opacity-30" title="Deshacer">
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={clearStrokes} disabled={strokes.length === 0 && !current} className="p-2 text-brand-gray-muted hover:text-brand-red-500 disabled:opacity-30" title="Borrar todo">
              <Eraser className="w-4 h-4" />
            </button>
          </>
        )}
      </div>

      {/* Barra inferior */}
      <div className="shrink-0 px-4 sm:px-6 py-3 border-t border-brand-black-border bg-brand-black/60 backdrop-blur-md flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-wider text-brand-red-500 bg-brand-red-600/10 border border-brand-red-600/20 px-2.5 py-1 rounded-full shrink-0">
            {isIntro ? 'Portada' : slide ? BLOCK_LABELS[slide.block] : ''}
          </span>
          {slide?.title && <span className="text-sm text-brand-gray-light truncate">{slide.title}</span>}
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <div className="hidden sm:flex items-center gap-1.5 max-w-[40vw] overflow-hidden">
            {Array.from({ length: total }).map((_, i) => (
              <button
                key={i}
                onClick={() => setIndex(i)}
                className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-brand-red-600' : 'w-1.5 bg-brand-gray-dark hover:bg-brand-gray-muted'}`}
                title={i === 0 ? 'Portada' : `Diapositiva ${i}`}
              />
            ))}
          </div>
          <span className="text-xs font-mono text-brand-gray-muted">{index + 1} / {total}</span>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
