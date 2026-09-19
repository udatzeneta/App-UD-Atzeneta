import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { PresentationPlayer } from '../components/opponent_analysis/PresentationPlayer';
import type { OpponentPresentation, OpponentLibraryVideo } from '../types';

interface SharedPayload {
  presentation: OpponentPresentation;
  libraryVideos: OpponentLibraryVideo[];
  opponentName: string;
  teams: any[];
  settings: any;
  teamStats: any;
  leagueRankings: any;
  scoutingPlayers: any[];
  ffcvSanctions: any[];
}

// Visor público de una presentación compartida (/p/:token).
// No usa dataService ni sesión: todo llega resuelto del endpoint, que es quien
// tiene permisos para leer. Si el token no vale, aquí no hay nada que enseñar.
export const SharedPresentation: React.FC = () => {
  const { token } = useParams<{ token: string }>();
  const [payload, setPayload] = useState<SharedPayload | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const res = await fetch(`/api/shared-presentation?token=${encodeURIComponent(token || '')}`);
        const json = await res.json();
        if (cancelled) return;
        if (!res.ok) {
          setError(json?.error || 'Este enlace no está disponible.');
          return;
        }
        setPayload(json as SharedPayload);
      } catch {
        if (!cancelled) setError('No se ha podido conectar. Revisa tu conexión e inténtalo de nuevo.');
      }
    };

    load();
    return () => { cancelled = true; };
  }, [token]);

  if (error) {
    return (
      <div className="min-h-screen bg-brand-black-bg flex items-center justify-center px-6">
        <div className="max-w-md w-full bg-brand-black-card border border-brand-black-border rounded-2xl p-8 text-center shadow-premium">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-4" />
          <h1 className="text-lg font-black text-white uppercase tracking-wide mb-2">Enlace no disponible</h1>
          <p className="text-sm text-brand-gray-muted leading-relaxed">{error}</p>
          <p className="text-xs text-brand-gray-dark mt-4">
            Pide al cuerpo técnico que vuelva a compartirlo.
          </p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className="min-h-screen bg-brand-black-bg flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-brand-red-600 animate-spin" />
          <span className="text-xs text-brand-gray-muted font-semibold tracking-wider uppercase">
            Cargando presentación...
          </span>
        </div>
      </div>
    );
  }

  return (
    <PresentationPlayer
      presentation={payload.presentation}
      libraryVideos={payload.libraryVideos || []}
      opponentName={payload.opponentName}
      onClose={() => { /* en el visor público no hay a dónde volver */ }}
      publicView
      sharedData={{
        teams: payload.teams || [],
        settings: payload.settings,
        teamStats: payload.teamStats,
        leagueRankings: payload.leagueRankings,
        scoutingPlayers: payload.scoutingPlayers || [],
        ffcvSanctions: payload.ffcvSanctions || [],
      }}
    />
  );
};
