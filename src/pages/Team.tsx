import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, TrendingUp, Users, Activity, Trophy, Crosshair, Target, AlertTriangle } from 'lucide-react';
import { Match, PlayerMatchStats, Player } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart, Legend, Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, BarChart, Bar } from 'recharts';

interface DemarcationData {
  [key: string]: {
    player: Player;
    minutes: number;
    stats: PlayerMatchStats[];
  }[];
}

interface TimelineEvent {
  minute: number;
  positive: number;
  negative: number;
  description: string[];
}

export const Team: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [matches, setMatches] = useState<Match[]>([]);
  const [playerStats, setPlayerStats] = useState<PlayerMatchStats[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [matchesRes, statsRes, playersRes] = await Promise.all([
        supabase.from('matches').select('*').order('date', { ascending: false }),
        supabase.from('player_match_stats').select('*'),
        supabase.from('players').select('*')
      ]);

      if (matchesRes.data) setMatches(matchesRes.data as Match[]);
      if (statsRes.data) setPlayerStats(statsRes.data as PlayerMatchStats[]);
      if (playersRes.data) setPlayers(playersRes.data as Player[]);
    } catch (error) {
      console.error('Error fetching team data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 rounded-full border-2 border-brand-black-border border-t-brand-red-600 animate-spin" />
          <span className="text-xs text-brand-gray-muted font-semibold tracking-wider uppercase">Analizando Datos...</span>
        </div>
      </div>
    );
  }

  // --- 1. Sistemas más utilizados ---
  const systemsCount: Record<string, number> = {};
  matches.forEach(m => {
    if (m.tactical_system && m.status === 'Jugado') {
      systemsCount[m.tactical_system] = (systemsCount[m.tactical_system] || 0) + 1;
    }
  });
  const topSystems = Object.entries(systemsCount)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  const mostUsedSystem = topSystems.length > 0 ? topSystems[0][0] : 'Desconocido';

  // --- 2. Jugadores Más Utilizados por Demarcación ---
  const getDemarcation = (pos: string) => {
    const p = (pos || '').toLowerCase();
    if (p.includes('portero') || p === 'gk' || p === 'pt' || p === 'por') return 'Porteros';
    if (p.includes('lateral') || p.includes('central') || p.includes('defensa') || p.includes('carrilero') || p === 'df' || p === 'cb' || p === 'lb' || p === 'rb' || p === 'rwb' || p === 'lwb' || p === 'def') return 'Defensas';
    if (p.includes('pivote') || p.includes('medio') || p.includes('interior') || p.includes('mediocentro') || p.includes('mediapunta') || p === 'cm' || p === 'cdm' || p === 'cam' || p === 'rm' || p === 'lm' || p === 'mc' || p === 'mco' || p === 'mcd' || p === 'md' || p === 'mi' || p.includes('centro')) return 'Centrocampistas';
    if (p.includes('delantero') || p.includes('extremo') || p.includes('punta') || p === 'st' || p === 'cf' || p === 'rw' || p === 'lw' || p === 'dc' || p === 'ed' || p === 'ei' || p === 'sd') return 'Delanteros';
    return 'Otros';
  };

  const playersMinutes: Record<string, number> = {};
  playerStats.forEach(stat => {
    playersMinutes[stat.player_id] = (playersMinutes[stat.player_id] || 0) + (stat.minutes_played || 0);
  });

  const playersWithDemarcation = players.map(p => {
    // Buscar la posición más repetida para este jugador o asumir por defecto
    const pStats = playerStats.filter(s => s.player_id === p.id && s.position);
    let commonPos = p.position || 'Desconocida';
    if (pStats.length > 0) {
      const posCounts: Record<string, number> = {};
      pStats.forEach(s => {
        if (s.position && s.position.trim() !== '') {
          posCounts[s.position] = (posCounts[s.position] || 0) + 1;
        }
      });
      const validPositions = Object.keys(posCounts);
      if (validPositions.length > 0) {
        commonPos = validPositions.reduce((a, b) => posCounts[a] > posCounts[b] ? a : b);
      }
    }
    return {
      player: p,
      minutes: playersMinutes[p.id] || 0,
      demarcation: getDemarcation(commonPos)
    };
  }).filter(p => p.minutes > 0 && p.demarcation !== 'Otros');

  const playersByDemarcation: Record<string, typeof playersWithDemarcation> = {
    'Porteros': [], 'Defensas': [], 'Centrocampistas': [], 'Delanteros': []
  };

  playersWithDemarcation.forEach(p => {
    if (playersByDemarcation[p.demarcation]) {
      playersByDemarcation[p.demarcation].push(p);
    }
  });

  Object.keys(playersByDemarcation).forEach(key => {
    playersByDemarcation[key].sort((a, b) => b.minutes - a.minutes);
  });

  // --- 3. Gráfica Evolutiva (1 al 90 min) ---
  const timeline: Record<number, TimelineEvent> = {};
  for (let i = 1; i <= 95; i++) {
    timeline[i] = { minute: i, positive: 0, negative: 0, description: [] };
  }

  // Iterar por partidos y stats para rellenar la gráfica evolutiva
  matches.filter(m => m.status === 'Jugado').forEach(match => {
    // Goles Rival (Negativos) y Tarjetas Rival
    if (match.opponent_events) {
      const oppGoals = Array.isArray(match.opponent_events.goals) ? match.opponent_events.goals : [];
      oppGoals.forEach((g: any) => {
        const m = parseInt(g?.minute);
        if (!isNaN(m) && timeline[m]) {
          timeline[m].negative += 1;
        }
      });
    }
  });

  playerStats.forEach(stat => {
    if (!stat.event_minutes) return;
    
    // Goles Nuestros (Positivos)
    const myGoals = Array.isArray(stat.event_minutes.goals) ? stat.event_minutes.goals : [];
    myGoals.forEach((mStr: any) => {
      const m = parseInt(mStr);
      if (!isNaN(m) && timeline[m]) timeline[m].positive += 1;
    });
    
    // Asistencias Nuestras (Positivos)
    const myAssists = Array.isArray(stat.event_minutes.assists) ? stat.event_minutes.assists : [];
    myAssists.forEach((mStr: any) => {
      const m = parseInt(mStr);
      if (!isNaN(m) && timeline[m]) timeline[m].positive += 0.5;
    });
    
    // Tarjetas Nuestras (Negativos)
    const myCards = Array.isArray(stat.event_minutes.yellow_cards) ? stat.event_minutes.yellow_cards : [];
    myCards.forEach((mStr: any) => {
      const m = parseInt(mStr);
      if (!isNaN(m) && timeline[m]) timeline[m].negative += 0.5;
    });
    
    if (stat.event_minutes.red_card) {
      const m = parseInt(String(stat.event_minutes.red_card));
      if (!isNaN(m) && timeline[m]) timeline[m].negative += 1;
    }
  });

  // Agrupar timeline en tramos de 5 o 10 minutos para suavizar la gráfica
  const bucketedTimeline = [];
  const BUCKET_SIZE = 5;
  for (let i = 1; i <= 90; i += BUCKET_SIZE) {
    let pos = 0;
    let neg = 0;
    for (let j = i; j < i + BUCKET_SIZE; j++) {
      if (timeline[j]) {
        pos += timeline[j].positive;
        neg += timeline[j].negative;
      }
    }
    bucketedTimeline.push({
      minute: `${i}-${i+BUCKET_SIZE-1}'`,
      ImpactoPositivo: pos,
      ImpactoNegativo: neg
    });
  }

  // --- 4. Jugadores Más Influyentes (G+A) ---
  const influentialPlayers = players.map(p => {
    const stats = playerStats.filter(s => s.player_id === p.id);
    const goals = stats.reduce((sum, s) => sum + (s.goals || 0), 0);
    const assists = stats.reduce((sum, s) => sum + (s.assists || 0), 0);
    return { player: p, goals, assists, total: goals + assists };
  }).filter(p => p.total > 0).sort((a, b) => b.total - a.total).slice(0, 5);

  // --- 5. Plus / Minus (MVP) ---
  // Cálculo de goles a favor vs en contra mientras el jugador está en el campo
  const plusMinusMap: Record<string, { goalsFor: number, goalsAgainst: number }> = {};
  players.forEach(p => plusMinusMap[p.id] = { goalsFor: 0, goalsAgainst: 0 });

  matches.filter(m => m.status === 'Jugado').forEach(match => {
    const mStats = playerStats.filter(s => s.match_id === match.id);
    
    // Goles a favor del equipo en este partido (minutos)
    const teamGoalsMinutes: number[] = [];
    mStats.forEach(s => {
      const goalsArr = Array.isArray(s.event_minutes?.goals) ? s.event_minutes.goals : [];
      goalsArr.forEach((mStr: any) => {
        const m = parseInt(mStr);
        if (!isNaN(m)) teamGoalsMinutes.push(m);
      });
    });

    // Goles en contra del equipo en este partido (minutos)
    const opponentGoalsMinutes: number[] = [];
    if (match.opponent_events) {
      const oppGoals = Array.isArray(match.opponent_events.goals) ? match.opponent_events.goals : [];
      oppGoals.forEach((g: any) => {
        const m = parseInt(g?.minute);
        if (!isNaN(m)) opponentGoalsMinutes.push(m);
      });
    }

    // Para cada jugador, ver si estaba en el campo en los minutos de los goles
    mStats.forEach(stat => {
      let entryMinute = 0;
      let exitMinute = stat.minutes_played || 0;

      if (!stat.is_starter) {
        // Encontrar por quién entró
        const prev = mStats.find(s => s.substituted_for === stat.player_id);
        entryMinute = prev && prev.substituted_minute ? prev.substituted_minute : 90;
        exitMinute = entryMinute + (stat.minutes_played || 0);
      } else if (stat.substituted_for && stat.substituted_minute) {
        // Era titular y fue sustituido
        exitMinute = stat.substituted_minute;
      } else if (stat.is_starter && !stat.substituted_for) {
        // Jugó todo el partido
        exitMinute = 95; // Para cubrir el descuento
      }

      // Contar goles a favor mientras estaba en el campo
      teamGoalsMinutes.forEach(gm => {
        if (gm >= entryMinute && gm <= exitMinute) {
          if (plusMinusMap[stat.player_id]) {
            plusMinusMap[stat.player_id].goalsFor += 1;
          }
        }
      });

      // Contar goles en contra mientras estaba en el campo
      opponentGoalsMinutes.forEach(gm => {
        if (gm >= entryMinute && gm <= exitMinute) {
          if (plusMinusMap[stat.player_id]) {
            plusMinusMap[stat.player_id].goalsAgainst += 1;
          }
        }
      });
    });
  });

  const mvpPlayers = players.map(p => {
    const pm = plusMinusMap[p.id];
    return {
      player: p,
      goalsFor: pm.goalsFor,
      goalsAgainst: pm.goalsAgainst,
      net: pm.goalsFor - pm.goalsAgainst
    };
  }).filter(p => (p.goalsFor > 0 || p.goalsAgainst > 0) && playersMinutes[p.player.id] > 90) // Filtrar a los que han jugado más de 90 min en total
    .sort((a, b) => b.net - a.net)
    .slice(0, 5);


  // --- 6. Rendimiento Táctico Promedio (team_ratings) ---
  const ratingsSum = {
    with_ball: { salida_balon: 0, posesion: 0, finalizacion: 0, juego_directo: 0, ocupacion_area: 0 },
    without_ball: { presion_alta: 0, bloque_medio: 0, bloque_bajo: 0, defensa_area: 0 },
    set_pieces: { ofensiva: 0, defensiva: 0 },
    count: 0
  };

  matches.filter(m => m.status === 'Jugado' && m.team_ratings).forEach(m => {
    const r = m.team_ratings!;
    if (r.with_ball && r.without_ball && r.set_pieces) {
      ratingsSum.count += 1;
      
      ratingsSum.with_ball.salida_balon += r.with_ball.salida_balon || 0;
      ratingsSum.with_ball.posesion += r.with_ball.posesion || 0;
      ratingsSum.with_ball.finalizacion += r.with_ball.finalizacion || 0;
      ratingsSum.with_ball.juego_directo += r.with_ball.juego_directo || 0;
      ratingsSum.with_ball.ocupacion_area += r.with_ball.ocupacion_area || 0;

      ratingsSum.without_ball.presion_alta += r.without_ball.presion_alta || 0;
      ratingsSum.without_ball.bloque_medio += r.without_ball.bloque_medio || 0;
      ratingsSum.without_ball.bloque_bajo += r.without_ball.bloque_bajo || 0;
      ratingsSum.without_ball.defensa_area += r.without_ball.defensa_area || 0;

      ratingsSum.set_pieces.ofensiva += r.set_pieces.ofensiva || 0;
      ratingsSum.set_pieces.defensiva += r.set_pieces.defensiva || 0;
    }
  });

  const avgRatingsWithBall = ratingsSum.count > 0 ? [
    { subject: 'Salida', A: Number((ratingsSum.with_ball.salida_balon / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'Posesión', A: Number((ratingsSum.with_ball.posesion / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'Finalización', A: Number((ratingsSum.with_ball.finalizacion / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'Directo', A: Number((ratingsSum.with_ball.juego_directo / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'Área', A: Number((ratingsSum.with_ball.ocupacion_area / ratingsSum.count).toFixed(1)), fullMark: 5 },
  ] : [];

  const avgRatingsWithoutBall = ratingsSum.count > 0 ? [
    { subject: 'Presión Alta', A: Number((ratingsSum.without_ball.presion_alta / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'B. Medio', A: Number((ratingsSum.without_ball.bloque_medio / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'B. Bajo', A: Number((ratingsSum.without_ball.bloque_bajo / ratingsSum.count).toFixed(1)), fullMark: 5 },
    { subject: 'D. Área', A: Number((ratingsSum.without_ball.defensa_area / ratingsSum.count).toFixed(1)), fullMark: 5 },
  ] : [];

  const avgRatingsABP = ratingsSum.count > 0 ? [
    { name: 'Ofensiva', valor: Number((ratingsSum.set_pieces.ofensiva / ratingsSum.count).toFixed(1)) },
    { name: 'Defensiva', valor: Number((ratingsSum.set_pieces.defensiva / ratingsSum.count).toFixed(1)) },
  ] : [];


  const renderFormation = (system: string) => {
    // Parse system, remove '1-' prefix if present (goalkeeper is implicit)
    let sys = system.replace(/^1-/, '');
    const lines = sys.split('-').map(n => parseInt(n)).filter(n => !isNaN(n));
    
    // Default to 4-4-2 if parsing fails
    if (lines.length === 0) lines.push(4, 4, 2);

    const positions = [];
    // Goalkeeper
    positions.push({ cx: 50, cy: 140 });

    // Other lines
    const numLines = lines.length;
    // We distribute lines vertically from y=110 to y=20
    const availableHeight = 90;
    const yStep = numLines > 1 ? availableHeight / (numLines - 1) : 0;

    lines.forEach((count, lineIdx) => {
      const y = 110 - (lineIdx * yStep);
      // Distribute players horizontally
      const xStep = 100 / (count + 1);
      for (let i = 1; i <= count; i++) {
        positions.push({ cx: i * xStep, cy: y });
      }
    });

    return (
      <svg width="100%" height="100%" viewBox="0 0 100 150" className="opacity-90 max-h-[160px]">
        {/* Pitch Outline */}
        <rect width="100" height="150" fill="none" stroke="#52525b" strokeWidth="1" />
        <line x1="0" y1="75" x2="100" y2="75" stroke="#52525b" strokeWidth="1" />
        <circle cx="50" cy="75" r="12" fill="none" stroke="#52525b" strokeWidth="1" />
        <rect x="25" y="0" width="50" height="20" fill="none" stroke="#52525b" strokeWidth="1" />
        <rect x="35" y="0" width="30" height="8" fill="none" stroke="#52525b" strokeWidth="1" />
        <path d="M 40 20 A 10 10 0 0 0 60 20" fill="none" stroke="#52525b" strokeWidth="1" />
        
        <rect x="25" y="130" width="50" height="20" fill="none" stroke="#52525b" strokeWidth="1" />
        <rect x="35" y="142" width="30" height="8" fill="none" stroke="#52525b" strokeWidth="1" />
        <path d="M 60 130 A 10 10 0 0 0 40 130" fill="none" stroke="#52525b" strokeWidth="1" />

        {/* Players */}
        {positions.map((pos, idx) => (
          <circle key={idx} cx={pos.cx} cy={pos.cy} r="4.5" fill="#ef4444" stroke="#18181b" strokeWidth="1.5" />
        ))}
      </svg>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight flex items-center gap-3">
          <Shield className="w-8 h-8 text-brand-red-600" />
          Análisis del Equipo
        </h1>
        <p className="text-brand-gray-muted text-sm sm:text-base">
          Resumen general de la temporada, sistemas más usados y rendimiento de los jugadores.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* WIDGET: Sistemas Tácticos */}
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 col-span-1 lg:col-span-1 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-brand-red-600" />
            Sistemas Tácticos
          </h2>
          
          <div className="bg-brand-black/50 border border-brand-black-border rounded-lg p-4 flex flex-col items-center justify-between flex-1 relative overflow-hidden min-h-[220px] gap-4">
            <div className="flex-1 w-full flex items-center justify-center">
               {renderFormation(mostUsedSystem)}
            </div>
            <div className="text-center bg-brand-black border border-brand-black-border/80 px-4 py-2 rounded-xl w-full">
              <span className="text-[10px] font-bold text-brand-red-600 tracking-widest uppercase block mb-0.5">Principal</span>
              <span className="text-2xl font-black text-white tracking-tighter drop-shadow-xl">{mostUsedSystem}</span>
              <span className="text-[10px] text-brand-gray-muted block mt-1">Usado en {topSystems.length > 0 ? topSystems[0][1] : 0} partidos</span>
            </div>
          </div>

          <div className="mt-4">
            <h3 className="text-xs font-semibold text-brand-gray-muted uppercase mb-3">Top 3 Sistemas</h3>
            <div className="space-y-3">
              {topSystems.map((sys, idx) => (
                <div key={idx} className="flex items-center justify-between bg-brand-black border border-brand-black-border rounded-lg px-3 py-2">
                  <span className="text-sm font-bold text-brand-gray-light">{sys[0]}</span>
                  <div className="flex items-center gap-2">
                    <div className="h-2 w-24 bg-brand-black-border rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-brand-red-600 rounded-full" 
                        style={{ width: `${(sys[1] / (topSystems[0][1] || 1)) * 100}%` }}
                      ></div>
                    </div>
                    <span className="text-xs font-medium text-brand-gray-muted w-4 text-right">{sys[1]}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* WIDGET: Gráfica Evolutiva (Impacto 1 al 90 min) */}
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 col-span-1 lg:col-span-2 flex flex-col">
          <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
            <Activity className="w-5 h-5 text-emerald-500" />
            Evolución de Impacto (Minuto 1 al 90)
          </h2>
          <p className="text-xs text-brand-gray-muted mb-4">
            Frecuencia de eventos positivos (Goles, Asistencias) vs negativos (Goles encajados, Tarjetas) agrupados cada 5 minutos.
          </p>
          <div className="flex-1 w-full min-h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={bucketedTimeline} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPos" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorNeg" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#ef4444" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#ef4444" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
                <XAxis dataKey="minute" stroke="#71717a" fontSize={10} tickMargin={10} />
                <YAxis stroke="#71717a" fontSize={10} tickFormatter={(val) => Math.floor(val).toString()} />
                <Tooltip 
                  contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff' }}
                  itemStyle={{ fontSize: '12px' }}
                  labelStyle={{ fontSize: '12px', color: '#a1a1aa', marginBottom: '4px' }}
                />
                <Legend iconType="circle" wrapperStyle={{ fontSize: '12px' }} />
                <Area type="monotone" dataKey="ImpactoPositivo" stroke="#10b981" strokeWidth={2} fillOpacity={1} fill="url(#colorPos)" name="Eventos a Favor" />
                <Area type="monotone" dataKey="ImpactoNegativo" stroke="#ef4444" strokeWidth={2} fillOpacity={1} fill="url(#colorNeg)" name="Eventos en Contra" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* WIDGET: Rendimiento Táctico Promedio */}
      <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-purple-500" />
          Rendimiento Táctico Promedio
        </h2>
        <p className="text-xs text-brand-gray-muted mb-6">
          Media de valoraciones (1-5 estrellas) recopiladas de las actas de {ratingsSum.count} partidos.
        </p>
        
        {ratingsSum.count > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 flex flex-col items-center">
              <h3 className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-2">Con Balón</h3>
              <div className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={avgRatingsWithBall}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="Media (Estrellas)" dataKey="A" stroke="#10b981" fill="#10b981" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 flex flex-col items-center">
              <h3 className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-2">Sin Balón</h3>
              <div className="w-full h-[220px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart cx="50%" cy="50%" outerRadius="65%" data={avgRatingsWithoutBall}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis dataKey="subject" tick={{ fill: '#a1a1aa', fontSize: 10 }} />
                    <PolarRadiusAxis angle={30} domain={[0, 5]} tick={false} axisLine={false} />
                    <Radar name="Media (Estrellas)" dataKey="A" stroke="#ef4444" fill="#ef4444" fillOpacity={0.4} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-brand-black border border-brand-black-border rounded-xl p-4 flex flex-col">
              <h3 className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-2 text-center">ABP</h3>
              <div className="w-full h-[220px] pt-4 flex items-center">
                <ResponsiveContainer width="100%" height={100}>
                  <BarChart data={avgRatingsABP} layout="vertical" margin={{ top: 0, right: 20, left: 20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#27272a" />
                    <XAxis type="number" domain={[0, 5]} stroke="#71717a" fontSize={10} tickCount={6} />
                    <YAxis dataKey="name" type="category" stroke="#71717a" fontSize={10} width={60} />
                    <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '0.5rem', color: '#fff', fontSize: '12px' }} cursor={{fill: 'transparent'}} />
                    <Bar dataKey="valor" name="Estrellas" fill="#3b82f6" radius={[0, 4, 4, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-10 bg-brand-black border border-brand-black-border rounded-xl">
            <p className="text-sm text-brand-gray-muted">No hay actas de partidos evaluadas todavía.</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* WIDGET: Jugadores Más Valiosos (+/-) */}
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Trophy className="w-5 h-5 text-yellow-500" />
            Jugadores Más Valiosos (Plus/Minus)
          </h2>
          <p className="text-xs text-brand-gray-muted mb-4">
            Diferencia de Goles Marcados vs Encajados mientras el jugador estaba en el campo.
          </p>
          
          <div className="space-y-3">
            {mvpPlayers.map((mvp, idx) => (
              <div key={idx} className="flex items-center justify-between bg-brand-black border border-brand-black-border rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <div className="relative w-10 h-10 rounded-full border border-brand-black-border overflow-hidden bg-brand-black-bg shrink-0">
                    <img 
                      src={mvp.player.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                      alt={mvp.player.full_name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-brand-gray-light block leading-tight">
                      {mvp.player.nickname || mvp.player.full_name}
                    </span>
                    <span className="text-xs text-brand-gray-muted">Goles: <span className="text-emerald-500">{mvp.goalsFor}</span> | Encajados: <span className="text-brand-red-600">{mvp.goalsAgainst}</span></span>
                  </div>
                </div>
                <div className={`px-3 py-1.5 rounded-lg border font-bold text-sm ${
                  mvp.net > 0 ? 'bg-emerald-950/30 text-emerald-500 border-emerald-900/50' :
                  mvp.net < 0 ? 'bg-red-950/30 text-brand-red-600 border-red-900/50' :
                  'bg-brand-black-bg text-brand-gray-muted border-brand-black-border'
                }`}>
                  {mvp.net > 0 ? '+' : ''}{mvp.net}
                </div>
              </div>
            ))}
            {mvpPlayers.length === 0 && (
              <div className="text-center py-6 text-sm text-brand-gray-muted">No hay datos suficientes de goles.</div>
            )}
          </div>
        </div>

        {/* WIDGET: Jugadores Más Influyentes (G + A) */}
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-1 flex items-center gap-2">
            <Crosshair className="w-5 h-5 text-blue-500" />
            Jugadores Más Influyentes
          </h2>
          <p className="text-xs text-brand-gray-muted mb-4">
            Jugadores con mayor participación directa en los goles del equipo (Goles + Asistencias).
          </p>
          
          <div className="space-y-3">
            {influentialPlayers.map((inf, idx) => (
              <div key={idx} className="flex items-center justify-between bg-brand-black border border-brand-black-border rounded-xl p-3">
                <div className="flex items-center gap-3">
                  <span className="text-lg font-black text-brand-black-border mx-1 w-4">{idx + 1}</span>
                  <div className="relative w-10 h-10 rounded-full border border-brand-black-border overflow-hidden bg-brand-black-bg shrink-0">
                    <img 
                      src={inf.player.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                      alt={inf.player.full_name} 
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div>
                    <span className="text-sm font-semibold text-brand-gray-light block leading-tight">
                      {inf.player.nickname || inf.player.full_name}
                    </span>
                    <span className="text-xs text-brand-gray-muted">{inf.goals} Goles • {inf.assists} Asistencias</span>
                  </div>
                </div>
                <div className="flex items-center justify-center w-10 h-10 bg-brand-black-bg rounded-lg border border-brand-black-border">
                  <span className="text-lg font-bold text-blue-400">{inf.total}</span>
                </div>
              </div>
            ))}
            {influentialPlayers.length === 0 && (
              <div className="text-center py-6 text-sm text-brand-gray-muted">No hay goles ni asistencias registrados.</div>
            )}
          </div>
        </div>
      </div>

      {/* WIDGET: Jugadores Más Utilizados por Demarcación */}
      <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
        <h2 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-5 h-5 text-brand-red-600" />
          Más Utilizados por Demarcación
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {['Porteros', 'Defensas', 'Centrocampistas', 'Delanteros'].map((demarcation) => (
            <div key={demarcation} className="bg-brand-black border border-brand-black-border rounded-xl p-4">
              <h3 className="text-xs font-bold text-brand-gray-muted uppercase tracking-wider mb-4 border-b border-brand-black-border pb-2">{demarcation}</h3>
              
              <div className="space-y-4">
                {playersByDemarcation[demarcation]?.slice(0, 2).map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div className="relative w-12 h-12 rounded-xl border border-brand-black-border overflow-hidden shrink-0">
                      <img 
                        src={p.player.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=150&q=80'} 
                        alt={p.player.full_name} 
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute bottom-0 right-0 bg-brand-red-600 text-white text-[9px] font-bold px-1 rounded-tl-md">
                        #{idx+1}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-brand-gray-light truncate">
                        {p.player.nickname || p.player.full_name}
                      </h4>
                      <div className="flex items-center gap-1 mt-1">
                        <TrendingUp className="w-3 h-3 text-emerald-500" />
                        <span className="text-xs font-medium text-emerald-500">{p.minutes}'</span>
                        <span className="text-[10px] text-brand-gray-muted ml-1">jugados</span>
                      </div>
                    </div>
                  </div>
                ))}
                
                {(!playersByDemarcation[demarcation] || playersByDemarcation[demarcation].length === 0) && (
                  <div className="text-xs text-brand-gray-muted text-center py-4">No hay datos</div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
};
