import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { useKeyboardShortcut } from '../hooks/useKeyboardShortcut';
import { Search, X, Trophy, Dumbbell, ShieldAlert, Award, User, MapPin, Calendar, ChevronRight } from 'lucide-react';

interface SearchResult {
  id: string;
  type: 'training' | 'match' | 'fine' | 'point' | 'player' | 'scouting' | 'opponent';
  title: string;
  subtitle: string;
  date?: string;
  path: string;
  icon: React.ReactNode;
}

export const GlobalSearch: React.FC = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const searchRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Atajo Cmd+K / Ctrl+K para abrir búsqueda
  useKeyboardShortcut({
    key: 'k',
    metaKey: true,
    callback: () => {
      setIsOpen(true);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  });

  // Consultar datos para búsqueda
  const { data: trainings = [] } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings(),
    enabled: isOpen
  });

  const { data: matches = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches(),
    enabled: isOpen
  });

  const { data: fines = [] } = useQuery({
    queryKey: ['fines'],
    queryFn: () => dataService.getFines(),
    enabled: isOpen
  });

  const { data: points = [] } = useQuery({
    queryKey: ['points'],
    queryFn: () => dataService.getPoints(),
    enabled: isOpen
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => authService.getProfiles(),
    enabled: isOpen
  });

  const { data: scouting = [] } = useQuery({
    queryKey: ['scouting'],
    queryFn: () => dataService.getScouting(),
    enabled: isOpen
  });

  const { data: opponents = [] } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis(),
    enabled: isOpen
  });

  // Cerrar con click fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(-1);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Filtrar resultados con useMemo
  const results: SearchResult[] = useMemo(() => {
    const resultList: SearchResult[] = [];
    const q = query.toLowerCase().trim();

    if (q.length < 2) return resultList;

    // Entrenamientos
    trainings
      .filter(t => t.objective.toLowerCase().includes(q) || t.location.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(t => {
        resultList.push({
          id: t.id,
          type: 'training',
          title: t.objective,
          subtitle: t.location,
          date: t.date,
          path: '/trainings',
          icon: <Dumbbell className="w-4 h-4" />
        });
      });

    // Partidos
    matches
      .filter(m => m.rival.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(m => {
        resultList.push({
          id: m.id,
          type: 'match',
          title: `vs ${m.rival}`,
          subtitle: m.competition,
          date: m.date,
          path: '/matches',
          icon: <Trophy className="w-4 h-4" />
        });
      });

    // Multas
    fines
      .filter(f => f.reason.toLowerCase().includes(q) || f.profiles?.full_name?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(f => {
        resultList.push({
          id: f.id,
          type: 'fine',
          title: f.reason,
          subtitle: f.profiles?.full_name || 'Jugador',
          date: f.date,
          path: '/fines',
          icon: <ShieldAlert className="w-4 h-4" />
        });
      });

    // Puntos
    points
      .filter(p => p.reason.toLowerCase().includes(q) || p.profiles?.full_name?.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(p => {
        resultList.push({
          id: p.id,
          type: 'point',
          title: p.reason,
          subtitle: `${p.points > 0 ? '+' : ''}${p.points} pts - ${p.profiles?.full_name || 'Jugador'}`,
          date: p.date,
          path: '/points',
          icon: <Award className="w-4 h-4" />
        });
      });

    // Jugadores/Perfiles
    profiles
      .filter(p => p.full_name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(p => {
        resultList.push({
          id: p.id,
          type: 'player',
          title: p.full_name,
          subtitle: p.email,
          path: '/settings',
          icon: <User className="w-4 h-4" />
        });
      });

    // Scouting
    scouting
      .filter(s =>
        s.player_name.toLowerCase().includes(q) ||
        s.team.toLowerCase().includes(q) ||
        s.position.toLowerCase().includes(q)
      )
      .slice(0, 3)
      .forEach(s => {
        resultList.push({
          id: s.id,
          type: 'scouting',
          title: s.player_name,
          subtitle: `${s.team} - ${s.position}`,
          path: '/scouting',
          icon: <MapPin className="w-4 h-4" />
        });
      });

    // Análisis de rivales
    opponents
      .filter(o => o.opponent.toLowerCase().includes(q))
      .slice(0, 3)
      .forEach(o => {
        resultList.push({
          id: o.id,
          type: 'opponent',
          title: o.opponent,
          subtitle: `Sistema: ${o.tactical_system}`,
          path: '/opponent-analysis',
          icon: <Calendar className="w-4 h-4" />
        });
      });

    return resultList;
  }, [query, trainings, matches, fines, points, profiles, scouting, opponents]);

  // Navegación con teclado
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isOpen) return;

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex(prev => Math.min(prev + 1, results.length - 1));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex(prev => Math.max(prev - 1, -1));
      } else if (e.key === 'Enter' && selectedIndex >= 0) {
        e.preventDefault();
        handleSelectResult(results[selectedIndex]);
      } else if (e.key === 'Escape') {
        setIsOpen(false);
        setQuery('');
        setSelectedIndex(-1);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, results, selectedIndex]);

  const handleSelectResult = (result: SearchResult) => {
    navigate(result.path);
    setIsOpen(false);
    setQuery('');
    setSelectedIndex(-1);
  };

  const getIconForType = (type: SearchResult['type']) => {
    switch (type) {
      case 'training': return 'bg-brand-red-600/10 text-brand-red-600';
      case 'match': return 'bg-yellow-500/10 text-yellow-500';
      case 'fine': return 'bg-red-950/20 text-brand-red-600';
      case 'point': return 'bg-emerald-500/10 text-emerald-500';
      case 'player': return 'bg-indigo-500/10 text-indigo-400';
      case 'scouting': return 'bg-purple-500/10 text-purple-400';
      case 'opponent': return 'bg-orange-500/10 text-orange-400';
    }
  };

  return (
    <div ref={searchRef} className="relative">
      {/* Input de búsqueda compacto */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-dark" />
        <input
          ref={inputRef}
          type="text"
          className="form-input pl-9 pr-9 py-1.5 text-xs w-40 lg:w-56 transition-all focus:w-48 lg:focus:w-72"
          placeholder="Buscar... (⌘K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setIsOpen(true);
            setSelectedIndex(-1);
          }}
          onFocus={() => setIsOpen(true)}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setSelectedIndex(-1);
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-brand-gray-dark hover:text-brand-gray-light"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {/* Resultados dropdown */}
      {isOpen && query.length >= 2 && (
        <div className="absolute right-0 top-full mt-2 w-96 max-h-[80vh] overflow-y-auto bg-brand-black-card border border-brand-black-border rounded-xl shadow-premium z-50">
          {results.length === 0 ? (
            <div className="p-6 text-center">
              <Search className="w-8 h-8 text-brand-gray-dark mx-auto mb-2" />
              <p className="text-sm text-brand-gray-muted">No se encontraron resultados</p>
              <p className="text-xs text-brand-gray-dark mt-1">Prueba con otros términos de búsqueda</p>
            </div>
          ) : (
            <div className="py-2">
              {/* Header */}
              <div className="px-4 py-2 border-b border-brand-black-border">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted">
                  {results.length} resultado{results.length !== 1 ? 's' : ''}
                </span>
              </div>

              {/* Lista de resultados */}
              {results.map((result, index) => (
                <button
                  key={`${result.type}-${result.id}`}
                  onClick={() => handleSelectResult(result)}
                  className={`w-full px-4 py-3 flex items-start gap-3 transition-colors ${
                    index === selectedIndex
                      ? 'bg-brand-red-600/10'
                      : 'hover:bg-brand-black-hover'
                  }`}
                >
                  {/* Icono */}
                  <div className={`p-2 rounded-lg shrink-0 ${getIconForType(result.type)}`}>
                    {result.icon}
                  </div>

                  {/* Contenido */}
                  <div className="flex-1 min-w-0 text-left">
                    <h4 className="text-sm font-semibold text-brand-gray-light truncate">
                      {result.title}
                    </h4>
                    <p className="text-xs text-brand-gray-muted truncate mt-0.5">
                      {result.subtitle}
                    </p>
                    {result.date && (
                      <span className="text-[10px] text-brand-gray-dark mt-1 block">
                        {result.date}
                      </span>
                    )}
                  </div>

                  {/* Flecha */}
                  <ChevronRight className="w-4 h-4 text-brand-gray-dark shrink-0 mt-1" />
                </button>
              ))}

              {/* Footer con atajos de teclado */}
              <div className="px-4 py-2 border-t border-brand-black-border bg-brand-black/50">
                <div className="flex items-center justify-between text-[10px] text-brand-gray-dark">
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-brand-black-border rounded text-[9px]">↑↓</kbd>
                    navegar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-brand-black-border rounded text-[9px]">↵</kbd>
                    seleccionar
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="px-1.5 py-0.5 bg-brand-black-border rounded text-[9px]">esc</kbd>
                    cerrar
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
