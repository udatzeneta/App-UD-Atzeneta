import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check } from 'lucide-react';

interface PlayerSelectProps {
  jugadores: any[];
  value: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

export const PlayerSelect: React.FC<PlayerSelectProps> = ({ jugadores, value, onChange, placeholder = "— Selecciona un jugador —" }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selectedPlayer = jugadores.find(j => j.id === value);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="relative w-full" ref={containerRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2.5 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none flex items-center justify-between transition-colors hover:bg-brand-black-hover"
      >
        {selectedPlayer ? (
          <div className="flex items-center gap-3">
            <img 
              src={selectedPlayer.photo_url || selectedPlayer.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'} 
              alt={selectedPlayer.nickname || selectedPlayer.full_name} 
              className="w-6 h-6 rounded-full object-cover border border-brand-black-border shrink-0"
            />
            <span className="font-semibold text-brand-red-600 min-w-[24px]">#{selectedPlayer.dorsal || '-'}</span>
            <span className="truncate text-white">{selectedPlayer.nickname || selectedPlayer.full_name}</span>
          </div>
        ) : (
          <span className="text-brand-gray-muted">{placeholder}</span>
        )}
        <ChevronDown className="w-4 h-4 text-brand-gray-muted shrink-0" />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-1 bg-brand-black-card border border-brand-black-border rounded-lg shadow-premium overflow-hidden max-h-60 overflow-y-auto animate-fade-in no-scrollbar">
          {jugadores.length === 0 ? (
            <div className="px-4 py-3 text-sm text-brand-gray-muted text-center">No hay jugadores disponibles</div>
          ) : (
            <ul className="py-1">
              {jugadores.map((j) => (
                <li key={j.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onChange(j.id);
                      setIsOpen(false);
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2 text-sm transition-colors hover:bg-brand-black-hover ${value === j.id ? 'bg-brand-black-hover/50' : ''}`}
                  >
                    <img 
                      src={j.photo_url || j.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=80&q=80'} 
                      alt={j.nickname || j.full_name} 
                      className="w-8 h-8 rounded-full object-cover border border-brand-black-border shrink-0"
                    />
                    <div className="flex-1 flex flex-col items-start overflow-hidden">
                      <span className="text-white font-medium truncate w-full text-left">{j.nickname || j.full_name}</span>
                      <span className="text-xs text-brand-red-600 font-bold">Dorsal #{j.dorsal || '-'}</span>
                    </div>
                    {value === j.id && <Check className="w-4 h-4 text-brand-red-600 shrink-0" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
};
