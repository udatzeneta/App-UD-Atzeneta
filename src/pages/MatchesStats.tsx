import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/data';
import { TableSkeleton } from '../components/Skeletons';
import {
  ArrowLeft, Trophy, Target, Shield, TrendingUp,
  Activity, Star, Flame, Calendar
} from 'lucide-react';
import logos from '../assets/logos.json';

const getTeamLogo = (teamName: string): string => {
  const cleanName = teamName.replace('vs ', '').trim();
  const normalize = (str: string) => str.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  const target = normalize(cleanName);
  
  const matchKey = Object.keys(logos).find(key => normalize(key) === target);
  if (matchKey) {
    return (logos as Record<string, string>)[matchKey];
  }
  return 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png';
};

export const MatchesStats: React.FC = () => {
  const navigate = useNavigate();
  const [hoveredPoint, setHoveredPoint] = useState<any | null>(null);
  const [hoveredGoalPoint, setHoveredGoalPoint] = useState<any | null>(null);

  // Consultar todos los partidos
  const { data: matches = [], isLoading } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  // Filtramos partidos de Liga finalizados
  const ligaMatchesPlayed = React.useMemo(() => {
    return matches
      .filter(m => m.competition === 'Liga' && m.status === 'Jugado')
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [matches]);

  // Estadísticas Generales
  const stats = React.useMemo(() => {
    const total = ligaMatchesPlayed.length;
    let wins = 0;
    let draws = 0;
    let losses = 0;
    let goalsScored = 0;
    let goalsConceded = 0;

    let localPlayed = 0;
    let localWins = 0;
    let localDraws = 0;
    let localLosses = 0;
    let localGoalsScored = 0;
    let localGoalsConceded = 0;

    let visitorPlayed = 0;
    let visitorWins = 0;
    let visitorDraws = 0;
    let visitorLosses = 0;
    let visitorGoalsScored = 0;
    let visitorGoalsConceded = 0;

    ligaMatchesPlayed.forEach(m => {
      const us = m.score_us || 0;
      const them = m.score_them || 0;

      goalsScored += us;
      goalsConceded += them;

      if (us > them) wins++;
      else if (us === them) draws++;
      else losses++;

      if (m.is_local) {
        localPlayed++;
        localGoalsScored += us;
        localGoalsConceded += them;
        if (us > them) localWins++;
        else if (us === them) localDraws++;
        else localLosses++;
      } else {
        visitorPlayed++;
        visitorGoalsScored += us;
        visitorGoalsConceded += them;
        if (us > them) visitorWins++;
        else if (us === them) visitorDraws++;
        else visitorLosses++;
      }
    });

    const points = wins * 3 + draws;
    const effectiveness = total > 0 ? ((points / (total * 3)) * 100).toFixed(1) : '0';

    return {
      total, wins, draws, losses, points, effectiveness,
      goalsScored, goalsConceded,
      goalsDiff: goalsScored - goalsConceded,
      goalsScoredAvg: total > 0 ? (goalsScored / total).toFixed(2) : '0',
      goalsConcededAvg: total > 0 ? (goalsConceded / total).toFixed(2) : '0',
      local: { played: localPlayed, wins: localWins, draws: localDraws, losses: localLosses, goalsScored: localGoalsScored, goalsConceded: localGoalsConceded, points: localWins * 3 + localDraws },
      visitor: { played: visitorPlayed, wins: visitorWins, draws: visitorDraws, losses: visitorLosses, goalsScored: visitorGoalsScored, goalsConceded: visitorGoalsConceded, points: visitorWins * 3 + visitorDraws }
    };
  }, [ligaMatchesPlayed]);

  // Evolución de Puntos y Goles por jornada
  const { pointsEvolution, goalsEvolution, maxPoints, maxGoals } = React.useMemo(() => {
    let accumulatedPoints = 0;
    let accumulatedScored = 0;
    let accumulatedConceded = 0;

    const points = ligaMatchesPlayed.map((m, idx) => {
      let pts = 0;
      if (m.score_us !== null && m.score_them !== null) {
        if (m.score_us > m.score_them) pts = 3;
        else if (m.score_us === m.score_them) pts = 1;
      }
      accumulatedPoints += pts;
      return {
        jornada: idx + 1,
        rival: m.rival,
        date: m.date,
        result: `${m.score_us}-${m.score_them}`,
        points: accumulatedPoints
      };
    });

    const goals = ligaMatchesPlayed.map((m, idx) => {
      accumulatedScored += m.score_us || 0;
      accumulatedConceded += m.score_them || 0;
      return {
        jornada: idx + 1,
        rival: m.rival,
        date: m.date,
        scored: accumulatedScored,
        conceded: accumulatedConceded
      };
    });

    const maxPts = Math.max(...points.map(p => p.points), 10);
    const maxGls = Math.max(...goals.map(g => Math.max(g.scored, g.conceded)), 10);

    return {
      pointsEvolution: points,
      goalsEvolution: goals,
      maxPoints: maxPts,
      maxGoals: maxGls
    };
  }, [ligaMatchesPlayed]);

  // Forma Reciente (últimos 5 partidos)
  const recentForm = React.useMemo(() => {
    return [...ligaMatchesPlayed].slice(-5).reverse().map(m => {
      let form: 'W' | 'D' | 'L' = 'D';
      if (m.score_us !== null && m.score_them !== null) {
        if (m.score_us > m.score_them) form = 'W';
        else if (m.score_us < m.score_them) form = 'L';
      }
      return {
        id: m.id,
        form,
        rival: m.rival,
        result: `${m.score_us}-${m.score_them}`,
        date: m.date,
        is_local: m.is_local
      };
    });
  }, [ligaMatchesPlayed]);

  // Constantes de dimensiones de los SVG
  const svgW = 460;
  const svgH = 220;
  const padX = 35;
  const padY = 20;
  const chartW = svgW - 2 * padX;
  const chartH = svgH - 2 * padY;

  return (
    <div className="space-y-6">
      {/* Cabecera y botón de retroceso */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/matches')}
            className="p-2 hover:bg-brand-black-hover border border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light rounded-lg transition-all"
            title="Volver a partidos"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div>
            <h2 className="text-2xl font-bold text-brand-gray-light">Estadísticas del Club</h2>
            <p className="text-sm text-brand-gray-muted mt-1">
              Rendimiento evolutivo e histórico de la U.D. Atzeneta de Castellón en Liga.
            </p>
          </div>
        </div>

        {/* Escudo del club */}
        <div className="flex items-center gap-3 bg-brand-black border border-brand-black-border p-2.5 rounded-xl shrink-0">
          <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center p-0.5 border border-brand-black-border/10 shadow-sm">
            <img
              src="https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0074479982_ESCUDO_U.D._ATZENETA_PT.png"
              alt="U.D. Atzeneta"
              className="w-full h-full object-contain"
            />
          </div>
          <div>
            <h4 className="text-xs font-bold text-brand-gray-light leading-none">U.D. Atzeneta</h4>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Castellón 'A'</span>
          </div>
        </div>
      </div>

      {isLoading ? (
        <TableSkeleton />
      ) : ligaMatchesPlayed.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No hay suficientes partidos de liga jugados para calcular estadísticas.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Bloques de KPI */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Puntos y posición simulada */}
            <div className="dashboard-card p-5 flex items-center gap-4">
              <div className="p-3 bg-emerald-950/20 text-emerald-400 border border-emerald-900/20 rounded-xl">
                <Trophy className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider">Puntos Acumulados</span>
                <h3 className="text-2xl font-bold text-brand-gray-light mt-0.5">{stats.points}</h3>
                <span className="text-[10px] text-brand-gray-muted mt-1 block">{stats.wins}V - {stats.draws}E - {stats.losses}D</span>
              </div>
            </div>

            {/* Efectividad */}
            <div className="dashboard-card p-5 flex items-center gap-4">
              <div className="p-3 bg-indigo-950/20 text-indigo-400 border border-indigo-900/20 rounded-xl">
                <Activity className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider">Efectividad</span>
                <h3 className="text-2xl font-bold text-brand-gray-light mt-0.5">{stats.effectiveness}%</h3>
                <span className="text-[10px] text-brand-gray-muted mt-1 block">Rendimiento sobre 100</span>
              </div>
            </div>

            {/* Producción Goleadora */}
            <div className="dashboard-card p-5 flex items-center gap-4">
              <div className="p-3 bg-brand-red-600/10 text-brand-red-600 border border-brand-red-600/15 rounded-xl">
                <Target className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider">Goles a Favor</span>
                <h3 className="text-2xl font-bold text-brand-gray-light mt-0.5">{stats.goalsScored}</h3>
                <span className="text-[10px] text-brand-gray-muted mt-1 block">Promedio: {stats.goalsScoredAvg} / part.</span>
              </div>
            </div>

            {/* Defensa / Goles en Contra */}
            <div className="dashboard-card p-5 flex items-center gap-4">
              <div className="p-3 bg-red-950/20 text-red-400 border border-red-900/20 rounded-xl">
                <Shield className="w-6 h-6" />
              </div>
              <div>
                <span className="text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider">Goles en Contra</span>
                <h3 className="text-2xl font-bold text-brand-gray-light mt-0.5">{stats.goalsConceded}</h3>
                <span className="text-[10px] text-brand-gray-muted mt-1 block">Promedio: {stats.goalsConcededAvg} / part.</span>
              </div>
            </div>
          </div>

          {/* Gráficas Principales */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Gráfica 1: Puntos Evolutivos */}
            <div className="dashboard-card p-5 space-y-4">
              <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-brand-gray-light">Evolución de Puntos</h3>
                  <p className="text-[10px] text-brand-gray-muted mt-0.5">Puntos acumulados jornada a jornada en liga</p>
                </div>
                <div className="flex items-center gap-1 text-[10px] bg-emerald-950/20 text-emerald-400 px-2 py-0.5 border border-emerald-900/20 rounded font-semibold">
                  <TrendingUp className="w-3.5 h-3.5" /> Puntos: {stats.points}
                </div>
              </div>

              <div className="relative">
                <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
                  {/* Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = padY + chartH * ratio;
                    const val = Math.round(maxPoints * (1 - ratio));
                    return (
                      <g key={i} className="opacity-20">
                        <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#374151" strokeDasharray="3,3" />
                        <text x={padX - 8} y={y + 3} fill="#9ca3af" fontSize="8" textAnchor="end">{val}</text>
                      </g>
                    );
                  })}

                  {/* Gradient Area Fill */}
                  {pointsEvolution.length > 1 && (
                    <defs>
                      <linearGradient id="pointsGradFull" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#10b981" stopOpacity="0.3" />
                        <stop offset="100%" stopColor="#10b981" stopOpacity="0.0" />
                      </linearGradient>
                    </defs>
                  )}

                  {/* Area under curve */}
                  {pointsEvolution.length > 1 && (
                    <path
                      d={`${pointsEvolution.map((p, idx) => {
                        const x = padX + (idx / (pointsEvolution.length - 1)) * chartW;
                        const y = padY + chartH - (p.points / maxPoints) * chartH;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')} L ${padX + chartW} ${padY + chartH} L ${padX} ${padY + chartH} Z`}
                      fill="url(#pointsGradFull)"
                    />
                  )}

                  {/* Line Chart Path */}
                  {pointsEvolution.length > 1 && (
                    <path
                      d={pointsEvolution.map((p, idx) => {
                        const x = padX + (idx / (pointsEvolution.length - 1)) * chartW;
                        const y = padY + chartH - (p.points / maxPoints) * chartH;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Interactive dots */}
                  {pointsEvolution.map((p, idx) => {
                    const x = padX + (idx / (pointsEvolution.length - 1)) * chartW;
                    const y = padY + chartH - (p.points / maxPoints) * chartH;
                    const isHovered = hoveredPoint?.jornada === p.jornada;
                    return (
                      <circle
                        key={idx}
                        cx={x}
                        cy={y}
                        r={isHovered ? 5.5 : 3.5}
                        fill={isHovered ? '#10b981' : '#1f2937'}
                        stroke="#10b981"
                        strokeWidth={isHovered ? 2 : 1.5}
                        className="cursor-pointer transition-all"
                        onMouseEnter={() => setHoveredPoint(p)}
                        onMouseLeave={() => setHoveredPoint(null)}
                      />
                    );
                  })}
                </svg>

                {/* Tooltip */}
                {hoveredPoint ? (
                  <div className="mt-3 bg-brand-black border border-brand-black-border p-3 rounded-lg text-left shadow-premium leading-normal">
                    <div className="flex justify-between items-center text-[10px] text-brand-gray-muted border-b border-brand-black-border pb-1 mb-1 font-semibold">
                      <span>Jornada {hoveredPoint.jornada}</span>
                      <span>{hoveredPoint.date}</span>
                    </div>
                    <p className="text-xs font-bold text-brand-gray-light">{hoveredPoint.rival}</p>
                    <div className="flex justify-between items-center mt-2 text-xs">
                      <span className="text-brand-gray-muted">Resultado: <span className="font-semibold text-brand-gray-light">{hoveredPoint.result}</span></span>
                      <span className="text-emerald-400 font-bold text-sm">{hoveredPoint.points} pts</span>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 bg-brand-black/20 border border-dashed border-brand-black-border p-2.5 rounded-lg text-center text-[10px] text-brand-gray-muted italic">
                    Pasa el cursor sobre los puntos de la gráfica para ver los detalles del encuentro.
                  </div>
                )}
              </div>
            </div>

            {/* Gráfica 2: Goles Evolutivos */}
            <div className="dashboard-card p-5 space-y-4">
              <div className="border-b border-brand-black-border pb-3 flex justify-between items-center">
                <div>
                  <h3 className="text-sm font-bold text-brand-gray-light">Goles Marcados vs Recibidos</h3>
                  <p className="text-[10px] text-brand-gray-muted mt-0.5">Evolución acumulada de la delantera y defensa</p>
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-brand-gray-light">
                  Diff: <span className={`font-bold ${stats.goalsDiff >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{stats.goalsDiff >= 0 ? `+${stats.goalsDiff}` : stats.goalsDiff}</span>
                </div>
              </div>

              <div className="relative">
                <svg width="100%" height={svgH} viewBox={`0 0 ${svgW} ${svgH}`} className="overflow-visible">
                  {/* Gridlines */}
                  {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
                    const y = padY + chartH * ratio;
                    const val = Math.round(maxGoals * (1 - ratio));
                    return (
                      <g key={i} className="opacity-20">
                        <line x1={padX} y1={y} x2={padX + chartW} y2={y} stroke="#374151" strokeDasharray="3,3" />
                        <text x={padX - 8} y={y + 3} fill="#9ca3af" fontSize="8" textAnchor="end">{val}</text>
                      </g>
                    );
                  })}

                  {/* Scored line (emerald) */}
                  {goalsEvolution.length > 1 && (
                    <path
                      d={goalsEvolution.map((g, idx) => {
                        const x = padX + (idx / (goalsEvolution.length - 1)) * chartW;
                        const y = padY + chartH - (g.scored / maxGoals) * chartH;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#10b981"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Conceded line (red) */}
                  {goalsEvolution.length > 1 && (
                    <path
                      d={goalsEvolution.map((g, idx) => {
                        const x = padX + (idx / (goalsEvolution.length - 1)) * chartW;
                        const y = padY + chartH - (g.conceded / maxGoals) * chartH;
                        return `${idx === 0 ? 'M' : 'L'} ${x} ${y}`;
                      }).join(' ')}
                      fill="none"
                      stroke="#ef4444"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}

                  {/* Interactive dots */}
                  {goalsEvolution.map((g, idx) => {
                    const x = padX + (idx / (goalsEvolution.length - 1)) * chartW;
                    const yScored = padY + chartH - (g.scored / maxGoals) * chartH;
                    const yConceded = padY + chartH - (g.conceded / maxGoals) * chartH;
                    const isHovered = hoveredGoalPoint?.jornada === g.jornada;
                    return (
                      <g key={idx}>
                        {/* Dot Scored */}
                        <circle
                          cx={x}
                          cy={yScored}
                          r={isHovered ? 4.5 : 2.5}
                          fill={isHovered ? '#10b981' : '#1f2937'}
                          stroke="#10b981"
                          strokeWidth={isHovered ? 1.5 : 1}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredGoalPoint(g)}
                          onMouseLeave={() => setHoveredGoalPoint(null)}
                        />
                        {/* Dot Conceded */}
                        <circle
                          cx={x}
                          cy={yConceded}
                          r={isHovered ? 4.5 : 2.5}
                          fill={isHovered ? '#ef4444' : '#1f2937'}
                          stroke="#ef4444"
                          strokeWidth={isHovered ? 1.5 : 1}
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredGoalPoint(g)}
                          onMouseLeave={() => setHoveredGoalPoint(null)}
                        />
                        {/* Area de interacción vertical */}
                        <rect
                          x={x - 6}
                          y={padY}
                          width={12}
                          height={chartH}
                          fill="transparent"
                          className="cursor-pointer"
                          onMouseEnter={() => setHoveredGoalPoint(g)}
                          onMouseLeave={() => setHoveredGoalPoint(null)}
                        />
                      </g>
                    );
                  })}
                </svg>

                {/* Leyenda */}
                <div className="flex justify-center gap-4 text-[10px] mt-2">
                  <span className="flex items-center gap-1.5 text-brand-gray-light">
                    <span className="w-2.5 h-0.5 bg-emerald-500 rounded"></span> Goles Marcados ({stats.goalsScored})
                  </span>
                  <span className="flex items-center gap-1.5 text-brand-gray-light">
                    <span className="w-2.5 h-0.5 bg-red-500 rounded"></span> Goles Recibidos ({stats.goalsConceded})
                  </span>
                </div>

                {/* Tooltip */}
                {hoveredGoalPoint ? (
                  <div className="mt-3 bg-brand-black border border-brand-black-border p-3 rounded-lg text-left shadow-premium leading-normal">
                    <div className="flex justify-between items-center text-[10px] text-brand-gray-muted border-b border-brand-black-border pb-1 mb-1 font-semibold">
                      <span>Jornada {hoveredGoalPoint.jornada}</span>
                      <span>{hoveredGoalPoint.date}</span>
                    </div>
                    <p className="text-xs font-bold text-brand-gray-light">{hoveredGoalPoint.rival}</p>
                    <div className="grid grid-cols-2 gap-2 mt-2 text-xs">
                      <div className="bg-emerald-950/20 border border-emerald-900/30 p-1.5 rounded text-center">
                        <span className="text-[10px] text-emerald-400 block font-semibold mb-0.5">Marcados</span>
                        <span className="text-emerald-400 font-extrabold text-base">{hoveredGoalPoint.scored}</span>
                      </div>
                      <div className="bg-red-950/20 border border-red-900/30 p-1.5 rounded text-center">
                        <span className="text-[10px] text-red-400 block font-semibold mb-0.5">Recibidos</span>
                        <span className="text-red-400 font-extrabold text-base">{hoveredGoalPoint.conceded}</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="mt-3 bg-brand-black/20 border border-dashed border-brand-black-border p-2.5 rounded-lg text-center text-[10px] text-brand-gray-muted italic">
                    Pasa el cursor sobre los puntos de la gráfica para ver los detalles del encuentro.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Fila Inferior: Forma Reciente & Comparativa Local/Visitante */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Forma Reciente (1/3) */}
            <div className="dashboard-card p-5 space-y-4 flex flex-col justify-between">
              <div className="border-b border-brand-black-border pb-3">
                <h3 className="text-sm font-bold text-brand-gray-light">Racha Reciente</h3>
                <p className="text-[10px] text-brand-gray-muted mt-0.5">Estado de forma de los últimos 5 partidos</p>
              </div>

              <div className="flex items-center justify-around py-4">
                {recentForm.map((f, i) => {
                  const color = f.form === 'W' ? 'bg-emerald-500 text-white shadow-glow-emerald' : f.form === 'L' ? 'bg-red-500 text-white shadow-glow-red' : 'bg-brand-black-border text-brand-gray-light';
                  const title = f.form === 'W' ? 'Victoria' : f.form === 'L' ? 'Derrota' : 'Empate';
                  return (
                    <div key={i} className="flex flex-col items-center gap-2 group relative">
                      <div className="w-9 h-9 rounded-full bg-white flex items-center justify-center p-0.5 shrink-0 border border-brand-black-border/10 shadow-sm">
                        <img
                          src={getTeamLogo(f.rival)}
                          alt={f.rival}
                          className="w-full h-full object-contain"
                        />
                      </div>
                      <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${color}`} title={title}>
                        {f.form}
                      </span>
                      {/* Tooltip flotante */}
                      <div className="absolute bottom-16 scale-0 group-hover:scale-100 transition-all bg-brand-black border border-brand-black-border p-2 rounded-lg shadow-premium w-28 text-center text-[10px] z-10 leading-normal">
                        <p className="font-bold text-brand-gray-light truncate">{f.rival}</p>
                        <p className="text-brand-gray-muted mt-0.5">{f.result} ({f.is_local ? 'L' : 'V'})</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="text-[10px] text-brand-gray-muted text-center italic mt-2">
                Pasa el cursor por los escudos para ver el marcador de cada partido de la racha.
              </p>
            </div>

            {/* Comparativa Local / Visitante (2/3) */}
            <div className="dashboard-card p-5 space-y-4 lg:col-span-2">
              <div className="border-b border-brand-black-border pb-3">
                <h3 className="text-sm font-bold text-brand-gray-light">Rendimiento Local vs Visitante</h3>
                <p className="text-[10px] text-brand-gray-muted mt-0.5">Comparativa detallada de estadísticas de juego</p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Local */}
                <div className="bg-indigo-950/15 border border-indigo-900/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-indigo-400">
                    <Flame className="w-4.5 h-4.5" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Como Local</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Partidos / Puntos</span>
                      <p className="text-sm font-bold text-brand-gray-light mt-0.5">{stats.local.played} part. / {stats.local.points} pts</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Victorias/Empates/Derrotas</span>
                      <p className="text-sm font-bold text-brand-gray-light mt-0.5">{stats.local.wins}V - {stats.local.draws}E - {stats.local.losses}D</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Goles a Favor</span>
                      <p className="text-sm font-bold text-emerald-400 mt-0.5">+{stats.local.goalsScored} goles</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Goles en Contra</span>
                      <p className="text-sm font-bold text-brand-red-600 mt-0.5">-{stats.local.goalsConceded} goles</p>
                    </div>
                  </div>
                </div>

                {/* Visitante */}
                <div className="bg-orange-950/15 border border-orange-900/20 p-4 rounded-xl space-y-3">
                  <div className="flex items-center gap-2 text-orange-400">
                    <Calendar className="w-4.5 h-4.5" />
                    <h4 className="text-xs font-bold uppercase tracking-wider">Como Visitante</h4>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-left">
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Partidos / Puntos</span>
                      <p className="text-sm font-bold text-brand-gray-light mt-0.5">{stats.visitor.played} part. / {stats.visitor.points} pts</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Victorias/Empates/Derrotas</span>
                      <p className="text-sm font-bold text-brand-gray-light mt-0.5">{stats.visitor.wins}V - {stats.visitor.draws}E - {stats.visitor.losses}D</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Goles a Favor</span>
                      <p className="text-sm font-bold text-emerald-400 mt-0.5">+{stats.visitor.goalsScored} goles</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-brand-gray-muted">Goles en Contra</span>
                      <p className="text-sm font-bold text-brand-red-600 mt-0.5">-{stats.visitor.goalsConceded} goles</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
