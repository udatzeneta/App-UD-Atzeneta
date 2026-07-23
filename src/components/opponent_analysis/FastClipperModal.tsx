import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import ReactPlayer from 'react-player';
import { X, Scissors, Info } from 'lucide-react';
import { OpponentVideoClip } from '../../types';

interface Props {
  videoUrl: string;
  onAddClip: (clip: Partial<OpponentVideoClip>) => void;
  onClose: () => void;
}

export const FastClipperModal: React.FC<Props> = ({ videoUrl, onAddClip, onClose }) => {
  const playerRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(true);
  const [lastClipInfo, setLastClipInfo] = useState<{ time: number, id: string } | null>(null);

  // Genera un clip al vuelo con +5s de margen
  const handleFastClip = () => {
    if (!playerRef.current) return;
    const currentTime = playerRef.current.currentTime;
    
    // Crear el clip: de t a t+5
    const newClip: Partial<OpponentVideoClip> = {
      title: `Corte ${new Date().toLocaleTimeString()}`,
      start: Math.round(currentTime),
      end: Math.round(currentTime + 5)
    };

    onAddClip(newClip);
    
    // Feedback visual
    const id = Date.now().toString();
    setLastClipInfo({ time: currentTime, id });
    setTimeout(() => {
      setLastClipInfo(current => current?.id === id ? null : current);
    }, 3000);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar si el usuario está escribiendo en algún input oculto (no debería)
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return;

      if (e.key.toLowerCase() === 'c') {
        e.preventDefault();
        handleFastClip();
      } else if (e.key === ' ' || e.key === 'k') {
        e.preventDefault();
        setPlaying(p => !p);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

  const content = (
    <div className="fixed inset-0 z-[80] bg-black/95 backdrop-blur-md flex flex-col animate-fade-in">
      {/* Cabecera */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-brand-black-border bg-brand-black">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <Scissors className="w-5 h-5 text-brand-red-600" />
            Modo Extracción Rápida
          </h2>
          <p className="text-xs text-brand-gray-muted mt-1 flex items-center gap-1">
            <Info className="w-3.5 h-3.5" />
            Pulsa <kbd className="bg-brand-black-border px-1.5 rounded text-white font-mono">C</kbd> para generar un corte (+5 seg). Pulsa <kbd className="bg-brand-black-border px-1.5 rounded text-white font-mono">Espacio</kbd> para pausar.
          </p>
        </div>
        <button
          onClick={onClose}
          className="flex items-center gap-2 px-4 py-2 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white border border-brand-red-600/30 rounded-lg transition-colors font-bold uppercase text-xs tracking-wide shadow-lg"
        >
          <X className="w-5 h-5" /> Cerrar
        </button>
      </div>

      {/* Reproductor Central */}
      <div className="flex-1 flex flex-col items-center justify-center p-6 min-h-0 relative">
        <div className="w-full max-w-6xl aspect-video bg-black rounded-lg overflow-hidden border border-brand-black-border shadow-2xl relative">
          <ReactPlayer
            ref={playerRef}
            src={videoUrl}
            width="100%"
            height="100%"
            controls={true}
            playing={playing}
            onPlay={() => setPlaying(true)}
            onPause={() => setPlaying(false)}
          />

          {/* Notificación flotante de éxito */}
          {lastClipInfo && (
            <div className="absolute top-4 right-4 bg-brand-red-600 text-white px-4 py-2 rounded-lg font-bold shadow-xl animate-fade-in flex items-center gap-2 pointer-events-none">
              <Scissors className="w-4 h-4" />
              ¡Corte guardado en {fmt(lastClipInfo.time)}!
            </div>
          )}
        </div>

        {/* Botón Inferior */}
        <div className="mt-8">
          <button
            type="button"
            onClick={handleFastClip}
            className="btn-primary py-4 px-12 text-lg rounded-xl shadow-lg shadow-brand-red-600/20 active:scale-95 transition-all flex items-center gap-3"
          >
            <Scissors className="w-6 h-6" />
            Generar Clip Ahora (C)
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(content, document.body);
};
