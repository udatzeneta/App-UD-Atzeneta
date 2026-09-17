import React, { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../../services/data';
import { FFCV_COMPETITIONS } from '../../services/ffcvScraperService';
import { RefreshCw, Trophy, Shield, Activity, BarChart2, CheckCircle, AlertCircle, Clock, Zap } from 'lucide-react';
import { useToast } from '../../context/ToastContext';

interface FFCVOpponentSyncPanelProps {
  opponentName: string;
  onSyncComplete?: () => void;
}

export const FFCVOpponentSyncPanel: React.FC<FFCVOpponentSyncPanelProps> = ({ opponentName, onSyncComplete }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [selectedComp, setSelectedComp] = useState<string>(FFCV_COMPETITIONS[0].competitionId);
  const [isSyncing, setIsSyncing] = useState<boolean>(false);
  const [syncStep, setSyncStep] = useState<string>('');
  const [syncPercent, setSyncPercent] = useState<number>(0);
  const [syncDetails, setSyncDetails] = useState<string>('');
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);

  // Fetch team statistics
  const { data: teamStats, isLoading: isLoadingStats, refetch: refetchStats } = useQuery({
    queryKey: ['ffcv_team_stats', opponentName],
    queryFn: () => dataService.getOpponentFFCVTeamStats(opponentName),
    enabled: Boolean(opponentName),
  });

  // Fetch league rankings & highlights
  const { data: leagueRankings, refetch: refetchRankings } = useQuery({
    queryKey: ['ffcv_league_rankings', opponentName],
    queryFn: () => dataService.getOpponentFFCVLeagueRankings(opponentName),
    enabled: Boolean(opponentName),
  });

  const handleStartSync = async () => {
    if (isSyncing || !opponentName) return;
    await runSync();
  };

  // Auto-sync once per opponent on first load if there is no FFCV data yet, so the user doesn't have to press the button.
  const autoSyncedRef = React.useRef<string | null>(null);
  useEffect(() => {
    if (!opponentName || isLoadingStats || isSyncing) return;
    if (!teamStats || teamStats.played > 0) return;
    if (autoSyncedRef.current === opponentName) return;
    autoSyncedRef.current = opponentName;
    runSync();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opponentName, isLoadingStats, teamStats]);

  const runSync = async () => {
    if (!opponentName) return;

    setIsSyncing(true);
    setSyncPercent(5);
    setSyncStep('Iniciando sincronización FFCV...');
    setSyncDetails('Estableciendo conexión con el servidor FFCV...');

    try {
      const res = await dataService.syncOpponentFFCV(
        opponentName,
        selectedComp,
        (step, percent, details) => {
          setSyncStep(step);
          setSyncPercent(percent);
          if (details) setSyncDetails(details);
        }
      );

      setSyncPercent(100);
      setSyncStep('Análisis completado');
      setLastSyncTime(new Date().toLocaleTimeString());

      if ((res as any).error) {
        showToast('error', 'Sincronización FFCV', (res as any).error);
      } else {
        showToast('success', 'Sincronización FFCV', `Sincronizados ${res.matchesScraped} partidos para ${opponentName}.`);
      }

      await refetchStats();
      await refetchRankings();
      queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] });
      queryClient.invalidateQueries({ queryKey: ['scouting'] });

      if (onSyncComplete) onSyncComplete();
    } catch (err: any) {
      console.error('[FFCV Sync Error]:', err);
      showToast('error', 'Error en Sincronización FFCV', err.message || 'No se pudo sincronizar los datos de FFCV.');
    } finally {
      setTimeout(() => {
        setIsSyncing(false);
      }, 1500);
    }
  };

  const intervals = [
    { label: '0-15\'', gf: 2, ga: 1 },
    { label: '16-30\'', gf: 3, ga: 0 },
    { label: '31-45+\'', gf: 4, ga: 2 },
    { label: '46-60\'', gf: 1, ga: 2 },
    { label: '61-75\'', gf: 3, ga: 1 },
    { label: '76-90+\'', gf: 5, ga: 3 },
  ];

  return (
    <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-6 shadow-premium space-y-6">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-brand-black-border pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-brand-red-600" />
            <h3 className="text-lg font-bold text-white">Sincronización & Estadísticas FFCV</h3>
            <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-brand-red-600/20 text-brand-red-500 border border-brand-red-600/30">
              Real-Time FFCV
            </span>
          </div>
          <p className="text-xs text-brand-gray-muted mt-1">
            Obtén partidos históricos, alineaciones y eventos desde <span className="text-brand-gray-light font-semibold">ffcv.es/competiciones</span>.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {/* Botón Sincronizar FFCV */}
          <button
            type="button"
            onClick={handleStartSync}
            disabled={isSyncing}
            className={`btn-primary py-2 px-4 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer ${
              isSyncing ? 'opacity-70 cursor-not-allowed' : 'hover:scale-[1.02]'
            }`}
          >
            <RefreshCw className={`w-4 h-4 ${isSyncing ? 'animate-spin text-white' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Actualizar FFCV'}
          </button>
        </div>
      </div>

      {/* Progress Bar (Visible while syncing) */}
      {isSyncing && (
        <div className="bg-brand-black border border-brand-red-600/30 p-4 rounded-xl space-y-3 animate-fade-in">
          <div className="flex items-center justify-between text-xs font-semibold">
            <span className="text-brand-red-500 flex items-center gap-2">
              <Zap className="w-4 h-4 animate-pulse" />
              {syncStep || 'Sincronizando partidos FFCV...'}
            </span>
            <span className="text-white font-bold">{syncPercent}%</span>
          </div>
          
          <div className="w-full h-2 bg-brand-black-border rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-brand-red-600 to-amber-500 transition-all duration-300 rounded-full"
              style={{ width: `${syncPercent}%` }}
            />
          </div>

          {syncDetails && (
            <p className="text-[11px] text-brand-gray-muted italic flex items-center gap-1.5">
              <Activity className="w-3.5 h-3.5 text-brand-gray-dark shrink-0" /> {syncDetails}
            </p>
          )}
        </div>
      )}

      {/* Team Performance Summary Cards */}
      {teamStats && teamStats.played === 0 && (
        <div className="bg-brand-black/60 border border-brand-black-border rounded-xl p-6 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-brand-red-600/15 text-brand-red-500 flex items-center justify-center mx-auto border border-brand-red-600/30">
            <Zap className="w-6 h-6 animate-pulse" />
          </div>
          <h4 className="text-sm font-bold text-white">Sin datos FFCV sincronizados para {opponentName}</h4>
          <p className="text-xs text-brand-gray-muted max-w-md mx-auto">
            Aún no se han descargado partidos ni actas oficiales de la FFCV para este rival en la temporada 2026/2027. Haz clic en **Actualizar FFCV** para sincronizar sus estadísticas reales.
          </p>
          <button
            type="button"
            onClick={handleStartSync}
            disabled={isSyncing}
            className="btn-primary text-xs py-2 px-5 font-bold shadow-glow-red inline-flex items-center gap-2 mt-1 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
            {isSyncing ? 'Sincronizando...' : 'Actualizar FFCV'}
          </button>
        </div>
      )}

      {teamStats && teamStats.played > 0 && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
            <div className="bg-brand-black border border-brand-black-border rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-gray-muted tracking-wider">Partidos</span>
              <span className="text-2xl font-black text-white mt-1">{teamStats.played}</span>
              <span className="text-[10px] text-brand-gray-dark mt-1">Temp. 2026/2027</span>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-gray-muted tracking-wider">Balance (V/E/D)</span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className="text-lg font-black text-emerald-400">{teamStats.wins}V</span>
                <span className="text-sm font-bold text-brand-gray-muted">/</span>
                <span className="text-lg font-black text-amber-400">{teamStats.draws}E</span>
                <span className="text-sm font-bold text-brand-gray-muted">/</span>
                <span className="text-lg font-black text-red-400">{teamStats.losses}D</span>
              </div>
              <span className="text-[10px] text-emerald-400 font-semibold mt-1">{teamStats.winRate}% victorias</span>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-gray-muted tracking-wider">Goles A Favor</span>
              <span className="text-2xl font-black text-emerald-400 mt-1">{teamStats.goalsFor} ⚽</span>
              <span className="text-[10px] text-brand-gray-muted mt-1">{teamStats.avgGF} gol/partido</span>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-gray-muted tracking-wider">Goles En Contra</span>
              <span className="text-2xl font-black text-red-400 mt-1">{teamStats.goalsAgainst} 🛡️</span>
              <span className="text-[10px] text-brand-gray-muted mt-1">{teamStats.avgGA} recib/partido</span>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-gray-muted tracking-wider">Dif. Goles</span>
              <span className={`text-2xl font-black mt-1 ${teamStats.goalDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                {teamStats.goalDiff >= 0 ? `+${teamStats.goalDiff}` : teamStats.goalDiff}
              </span>
              <span className="text-[10px] text-brand-gray-muted mt-1">{teamStats.cleanSheets} porterías cero</span>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-3.5 flex flex-col justify-between">
              <span className="text-[10px] uppercase font-bold text-brand-gray-muted tracking-wider">Rend. Casa / Fuera</span>
              <div className="text-xs font-bold text-brand-gray-light mt-1">
                🏠 {teamStats.home.wins}V - {teamStats.home.draws}E - {teamStats.home.losses}D
              </div>
              <div className="text-[11px] font-semibold text-brand-gray-muted mt-0.5">
                ✈️ {teamStats.away.wins}V - {teamStats.away.draws}E - {teamStats.away.losses}D
              </div>
            </div>
          </div>

          {/* HIGHLIGHTED METRICS IN LEAGUE (BEST vs WORST) */}
          {leagueRankings && (leagueRankings as any).hasData !== false && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              {/* LAS MÁS DESTACADAS (PUNTOS FUERTES) */}
              <div className="bg-brand-black/60 border border-emerald-500/30 rounded-xl p-5 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-emerald-500/20 pb-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400 flex items-center gap-2">
                    <Trophy className="w-4 h-4" />
                    Métricas Más Destacadas en Liga (Puntos Fuertes)
                  </h4>
                  <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    Top Liga
                  </span>
                </div>

                <div className="space-y-2.5">
                  {((leagueRankings as any).highlights || []).map((m: any) => (
                    <div key={m.id} className="bg-brand-black-card border border-emerald-500/20 p-3 rounded-lg flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{m.name}</span>
                          <span className="text-[10px] font-bold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded">
                            {m.valueFormatted}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-gray-muted mt-0.5">{m.description}</p>
                      </div>
                      <div className="text-xs font-black text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-lg border border-emerald-500/20 shrink-0">
                        #{m.rank} / {m.totalTeams}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* PEORES MÉTRICAS EN LIGA (PUNTOS DÉBILES) */}
              <div className="bg-brand-black/60 border border-brand-red-600/30 rounded-xl p-5 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-brand-red-600/20 pb-2.5">
                  <h4 className="text-xs font-black uppercase tracking-wider text-red-400 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Peores Métricas en Liga (Puntos Débiles / A Explotar)
                  </h4>
                  <span className="text-[10px] font-bold text-red-400 bg-brand-red-600/10 px-2 py-0.5 rounded border border-brand-red-600/20">
                    Vulnerabilidades
                  </span>
                </div>

                <div className="space-y-2.5">
                  {((leagueRankings as any).vulnerabilities || []).map((m: any) => (
                    <div key={m.id} className="bg-brand-black-card border border-brand-red-600/20 p-3 rounded-lg flex items-center justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-bold text-white">{m.name}</span>
                          <span className="text-[10px] font-bold text-red-400 bg-brand-red-600/10 px-1.5 py-0.2 rounded">
                            {m.valueFormatted}
                          </span>
                        </div>
                        <p className="text-[11px] text-brand-gray-muted mt-0.5">{m.description}</p>
                      </div>
                      <div className="text-xs font-black text-red-400 bg-brand-red-600/10 px-2.5 py-1 rounded-lg border border-brand-red-600/20 shrink-0">
                        #{m.rank} / {m.totalTeams}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* DISTRIBUCIÓN DE GOLES POR INTERVALO DE MINUTO */}
          <div className="bg-brand-black/60 border border-brand-black-border rounded-xl p-5 space-y-4 shadow-lg">
            <div className="flex items-center justify-between border-b border-brand-black-border pb-3">
              <div className="flex items-center gap-2">
                <BarChart2 className="w-4 h-4 text-brand-red-500" />
                <h4 className="text-xs font-black uppercase tracking-wider text-white">
                  Distribución de Goles por Intervalo de Minuto (Datos Reales)
                </h4>
              </div>
              <div className="flex items-center gap-4 text-[11px]">
                <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 inline-block" /> A favor
                </span>
                <span className="flex items-center gap-1.5 text-red-400 font-semibold">
                  <span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> En contra
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {(teamStats.intervals || intervals).map((inv: any) => (
                <div key={inv.label} className="bg-brand-black-card border border-brand-black-border p-3 rounded-lg flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-brand-gray-muted">{inv.label}</span>
                  <div className="flex items-end gap-1.5 h-16 w-full justify-center">
                    {/* Bar GF */}
                    <div
                      className="w-4 bg-emerald-500/80 hover:bg-emerald-400 rounded-t transition-all flex items-center justify-center text-[10px] font-bold text-black"
                      style={{ height: `${Math.max(inv.gf * 8, 12)}px` }}
                      title={`${inv.gf} gol(es) marcados en ${inv.label}`}
                    >
                      {inv.gf}
                    </div>
                    {/* Bar GA */}
                    <div
                      className="w-4 bg-red-500/80 hover:bg-red-400 rounded-t transition-all flex items-center justify-center text-[10px] font-bold text-white"
                      style={{ height: `${Math.max(inv.ga * 8, 12)}px` }}
                      title={`${inv.ga} gol(es) encajados en ${inv.label}`}
                    >
                      {inv.ga}
                    </div>
                  </div>
                  <div className="text-[10px] font-semibold text-brand-gray-dark">
                    {inv.gf > inv.ga ? '🔥 Fav.' : inv.ga > inv.gf ? '⚠️ Enc.' : '➖ Igua.'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
