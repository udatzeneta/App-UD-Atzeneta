import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer, BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, LabelList
} from 'recharts';
import { Activity, BarChart2, Grid3x3, TrendingUp, Trophy, Users, X } from 'lucide-react';
import { SquadRow, TeamMatchPoint, displayName } from './squadStats';

// Paleta categórica validada (modo oscuro, superficie #161616): asignación fija por orden de selección.
const SERIES = ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'];
const AXIS = '#737373';
const GRID = '#262626';
const MAX_SERIES = 5;

type EvoMetric = 'minutes' | 'goals' | 'assists' | 'ga' | 'yellow' | 'starter';
const EVO_LABEL: Record<EvoMetric, string> = {
  minutes: 'Minutos', goals: 'Goles', assists: 'Asistencias', ga: 'Goles + Asist.', yellow: 'Amarillas', starter: 'Titularidades'
};

const Card: React.FC<{ title: string; subtitle?: string; icon: React.ElementType; actions?: React.ReactNode; children: React.ReactNode; className?: string }> = ({ title, subtitle, icon: Icon, actions, children, className = '' }) => (
  <div className={`bg-brand-black border border-brand-black-border rounded-xl p-5 ${className}`}>
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-4">
      <div>
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Icon className="w-4 h-4 text-brand-red-600" /> {title}
        </h3>
        {subtitle && <p className="text-[11px] text-brand-gray-muted mt-0.5">{subtitle}</p>}
      </div>
      {actions}
    </div>
    {children}
  </div>
);

const TooltipBox: React.FC<{ title: string; rows: { label: string; value: React.ReactNode; color?: string }[] }> = ({ title, rows }) => (
  <div className="bg-brand-black-bg/95 border border-brand-black-border rounded-lg px-3 py-2 shadow-premium min-w-[150px]">
    <p className="text-[11px] font-bold text-white mb-1.5 pb-1.5 border-b border-brand-black-border">{title}</p>
    {rows.map(r => (
      <div key={r.label} className="flex items-center justify-between gap-4 text-[11px] py-0.5">
        <span className="flex items-center gap-1.5 text-brand-gray-muted">
          {r.color && <span className="w-2 h-2 rounded-full" style={{ background: r.color }} />}
          {r.label}
        </span>
        <span className="font-bold text-brand-gray-light tabular-nums">{r.value}</span>
      </div>
    ))}
  </div>
);

const axisProps = { stroke: AXIS, tick: { fontSize: 11, fill: '#a3a3a3' }, tickLine: false, axisLine: { stroke: GRID } };

interface Props {
  rows: SquadRow[];
  teamSeries: TeamMatchPoint[];
  competition: string;
  onOpen: (r: SquadRow) => void;
}

export const SquadAnalytics: React.FC<Props> = ({ rows, teamSeries, competition, onOpen }) => {
  const [evoMetric, setEvoMetric] = useState<EvoMetric>('minutes');
  const [selectedIds, setSelectedIds] = useState<string[] | null>(null);
  const [heatSort, setHeatSort] = useState<'minutes' | 'dorsal'>('minutes');

  const used = useMemo(() => rows.filter(r => r.stats.called > 0 || r.stats.minutes > 0), [rows]);

  // Por defecto: top 5 de la métrica elegida
  const defaultIds = useMemo(
    () => [...rows].sort((a, b) => b.stats[evoMetric] - a.stats[evoMetric]).filter(r => r.stats[evoMetric] > 0).slice(0, MAX_SERIES).map(r => r.id),
    [rows, evoMetric]
  );
  const activeIds = selectedIds ?? defaultIds;
  const activeRows = activeIds.map(id => rows.find(r => r.id === id)).filter(Boolean) as SquadRow[];

  const evoData = useMemo(() => {
    const acc: Record<string, number> = {};
    return teamSeries.map((tp, idx) => {
      const point: Record<string, any> = { label: tp.label, rival: tp.match.rival };
      activeRows.forEach(r => {
        const s = r.timeline[idx]?.stat;
        let v = 0;
        if (s) {
          if (evoMetric === 'minutes') v = s.minutes_played || 0;
          else if (evoMetric === 'goals') v = s.goals || 0;
          else if (evoMetric === 'assists') v = s.assists || 0;
          else if (evoMetric === 'ga') v = (s.goals || 0) + (s.assists || 0);
          else if (evoMetric === 'yellow') v = s.yellow_cards || 0;
          else if (evoMetric === 'starter') v = s.is_starter ? 1 : 0;
        }
        acc[r.id] = (acc[r.id] || 0) + v;
        point[r.id] = acc[r.id];
      });
      return point;
    });
  }, [teamSeries, activeRows, evoMetric]);

  const togglePlayer = (id: string) => {
    const base = activeIds;
    if (base.includes(id)) setSelectedIds(base.filter(x => x !== id));
    else if (base.length < MAX_SERIES) setSelectedIds([...base, id]);
  };

  const minutesData = useMemo(
    () => [...used].sort((a, b) => b.stats.minutes - a.stats.minutes).map(r => ({
      name: displayName(r), id: r.id, titular: r.stats.minutesStarter, suplente: r.stats.minutesSub, total: r.stats.minutes, pct: r.stats.minutesPct, totalLabel: `${r.stats.minutes}'`
    })),
    [used]
  );

  const attackData = useMemo(
    () => [...used].filter(r => r.stats.ga > 0).sort((a, b) => b.stats.ga - a.stats.ga || b.stats.goals - a.stats.goals).map(r => ({
      name: displayName(r), goles: r.stats.goals, asistencias: r.stats.assists, total: r.stats.ga, totalLabel: String(r.stats.ga)
    })),
    [used]
  );

  const mostUsed11 = useMemo(
    () => [...rows].sort((a, b) => b.stats.starter - a.stats.starter || b.stats.minutes - a.stats.minutes).filter(r => r.stats.minutes > 0).slice(0, 11),
    [rows]
  );

  const heatRows = useMemo(() => {
    const list = [...used];
    if (heatSort === 'dorsal') return list.sort((a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999));
    return list.sort((a, b) => b.stats.minutes - a.stats.minutes);
  }, [used, heatSort]);

  if (teamSeries.length === 0) {
    return (
      <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
        <BarChart2 className="w-8 h-8 text-brand-gray-dark mx-auto mb-3" />
        <p className="text-sm text-brand-gray-muted">Todavía no hay partidos jugados de {competition === 'Todas' ? 'ninguna competición' : competition} esta temporada.</p>
      </div>
    );
  }

  const resultColor = (r: 'V' | 'E' | 'D') => r === 'V' ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' : r === 'E' ? 'bg-neutral-500/15 text-neutral-300 border-neutral-500/30' : 'bg-red-500/15 text-red-400 border-red-500/30';

  return (
    <div className="space-y-5">
      {/* Evolución del equipo */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Puntos acumulados" subtitle={`Evolución jornada a jornada · ${competition}`} icon={TrendingUp}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={teamSeries} margin={{ top: 16, right: 16, bottom: 0, left: -20 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip
                  cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as TeamMatchPoint;
                    return <TooltipBox title={`${p.label} · ${p.match.is_local ? 'vs' : '@'} ${p.match.rival}`} rows={[
                      { label: 'Resultado', value: `${p.gf} - ${p.gc} (${p.result})` },
                      { label: 'Puntos acumulados', value: p.cumPoints, color: SERIES[0] }
                    ]} />;
                  }}
                />
                <Line type="linear" dataKey="cumPoints" stroke={SERIES[0]} strokeWidth={2} dot={{ r: 4, fill: SERIES[0], stroke: '#000', strokeWidth: 2 }} activeDot={{ r: 6 }}>
                  <LabelList dataKey="cumPoints" position="top" fill="#e5e5e5" fontSize={11} fontWeight={700} />
                </Line>
              </LineChart>
            </ResponsiveContainer>
          </div>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {teamSeries.map(tp => (
              <span key={tp.match.id} title={`${tp.match.rival} ${tp.gf}-${tp.gc}`} className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${resultColor(tp.result)}`}>
                {tp.label} {tp.result} {tp.gf}-{tp.gc}
              </span>
            ))}
          </div>
        </Card>

        <Card title="Goles a favor y en contra" subtitle="Por partido" icon={Activity}>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={teamSeries} margin={{ top: 16, right: 8, bottom: 0, left: -20 }} barGap={2}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip
                  cursor={{ fill: '#ffffff', opacity: 0.04 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload as TeamMatchPoint;
                    return <TooltipBox title={`${p.label} · ${p.match.rival}`} rows={[
                      { label: 'A favor', value: p.gf, color: SERIES[0] },
                      { label: 'En contra', value: p.gc, color: SERIES[1] },
                      { label: 'Acumulado', value: `${p.cumGf} - ${p.cumGc}` }
                    ]} />;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                <Bar dataKey="gf" name="A favor" fill={SERIES[0]} radius={[4, 4, 0, 0]} maxBarSize={28} />
                <Bar dataKey="gc" name="En contra" fill={SERIES[1]} radius={[4, 4, 0, 0]} maxBarSize={28} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* Evolución acumulada por jugador */}
      <Card
        title="Evolución acumulada por jugador"
        subtitle={`Selecciona hasta ${MAX_SERIES} jugadores para comparar · por defecto, los 5 primeros en la métrica`}
        icon={TrendingUp}
        actions={
          <div className="flex items-center gap-1 bg-brand-black-bg border border-brand-black-border rounded-lg p-0.5 flex-wrap">
            {(Object.keys(EVO_LABEL) as EvoMetric[]).map(k => (
              <button
                key={k}
                onClick={() => { setEvoMetric(k); setSelectedIds(null); }}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-colors ${evoMetric === k ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'}`}
              >
                {EVO_LABEL[k]}
              </button>
            ))}
          </div>
        }
      >
        <div className="flex flex-wrap gap-1.5 mb-4">
          {[...used].sort((a, b) => b.stats[evoMetric] - a.stats[evoMetric]).map(r => {
            const idx = activeIds.indexOf(r.id);
            const on = idx >= 0;
            const full = !on && activeIds.length >= MAX_SERIES;
            return (
              <button
                key={r.id}
                disabled={full}
                onClick={() => togglePlayer(r.id)}
                className={`text-[11px] font-semibold pl-1.5 pr-2 py-0.5 rounded-full border flex items-center gap-1.5 transition-colors ${
                  on ? 'border-brand-gray-dark bg-brand-black-hover text-white' : full ? 'border-brand-black-border text-brand-gray-dark cursor-not-allowed' : 'border-brand-black-border text-brand-gray-muted hover:text-white hover:border-brand-gray-dark'
                }`}
              >
                <span className="w-2 h-2 rounded-full" style={{ background: on ? SERIES[idx] : '#404040' }} />
                {displayName(r)}
                {on && <X className="w-3 h-3 opacity-60" />}
              </button>
            );
          })}
        </div>
        <div className="h-72">
          {activeRows.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-brand-gray-muted">Selecciona jugadores para ver su evolución.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={evoData} margin={{ top: 10, right: 70, bottom: 0, left: -10 }}>
                <CartesianGrid stroke={GRID} vertical={false} />
                <XAxis dataKey="label" {...axisProps} />
                <YAxis allowDecimals={false} {...axisProps} />
                <Tooltip
                  cursor={{ stroke: AXIS, strokeDasharray: '3 3' }}
                  content={({ active, payload, label }) => {
                    if (!active || !payload?.length) return null;
                    const sorted = [...payload].sort((a: any, b: any) => (b.value as number) - (a.value as number));
                    return <TooltipBox title={`${label} · ${payload[0].payload.rival}`} rows={sorted.map((p: any) => ({
                      label: p.name, value: `${p.value}${evoMetric === 'minutes' ? "'" : ''}`, color: p.color
                    }))} />;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                {activeRows.map((r, i) => (
                  <Line
                    key={r.id}
                    type="linear"
                    dataKey={r.id}
                    name={displayName(r)}
                    stroke={SERIES[i]}
                    strokeWidth={2}
                    dot={{ r: 3.5, fill: SERIES[i], stroke: '#000', strokeWidth: 2 }}
                    activeDot={{ r: 5.5 }}
                  >
                    <LabelList
                      dataKey={r.id}
                      content={(props: any) => props.index === evoData.length - 1 ? (
                        <text x={props.x + 8} y={props.y + 4} fill="#e5e5e5" fontSize={11} fontWeight={600}>{displayName(r)}</text>
                      ) : null}
                    />
                  </Line>
                ))}
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </Card>

      {/* Mapa de participación partido a partido */}
      <Card
        title="Participación partido a partido"
        subtitle="Minutos jugados en cada encuentro · borde = titular · iconos de goles, asistencias y tarjetas"
        icon={Grid3x3}
        actions={
          <select value={heatSort} onChange={e => setHeatSort(e.target.value as any)} className="form-input py-1 text-xs w-auto">
            <option value="minutes">Ordenar por minutos</option>
            <option value="dorsal">Ordenar por dorsal</option>
          </select>
        }
      >
        <div className="overflow-x-auto">
          <table className="text-[11px] border-separate" style={{ borderSpacing: 3 }}>
            <thead>
              <tr>
                <th className="text-left text-[10px] uppercase text-brand-gray-muted font-semibold pr-3 sticky left-0 bg-brand-black z-10">Jugador</th>
                {teamSeries.map(tp => (
                  <th key={tp.match.id} className="text-center font-semibold text-brand-gray-muted min-w-[52px]" title={tp.match.rival}>
                    <div className="text-[10px] text-brand-gray-light">{tp.label}</div>
                    <div className={`text-[9px] font-bold ${tp.result === 'V' ? 'text-emerald-400' : tp.result === 'D' ? 'text-red-400' : 'text-neutral-400'}`}>{tp.gf}-{tp.gc}</div>
                  </th>
                ))}
                <th className="text-center text-[10px] uppercase text-brand-gray-muted font-semibold pl-2">Total</th>
              </tr>
            </thead>
            <tbody>
              {heatRows.map(r => (
                <tr key={r.id}>
                  <td className="pr-3 sticky left-0 bg-brand-black z-10">
                    <button onClick={() => onOpen(r)} className="flex items-center gap-1.5 hover:text-brand-red-400 text-brand-gray-light font-semibold whitespace-nowrap">
                      <span className="text-[10px] font-black text-brand-red-500 w-4 text-right">{r.dorsal ?? ''}</span>
                      {displayName(r)}
                    </button>
                  </td>
                  {r.timeline.map(({ match, stat: s }) => {
                    const mins = s?.minutes_played || 0;
                    const dur = match.duration || 90;
                    const ratio = Math.min(1, mins / dur);
                    const notCalled = !s || !s.is_called_up;
                    const title = notCalled
                      ? `${match.rival}: no convocado${s?.comments ? ` (${s.comments})` : ''}`
                      : `${match.rival}: ${mins}' ${s?.is_starter ? '(titular)' : mins > 0 ? '(suplente)' : '(no jugó)'}`;
                    return (
                      <td key={match.id} title={title} className="p-0">
                        <div
                          className={`relative h-9 rounded-md flex flex-col items-center justify-center ${s?.is_starter ? 'ring-1 ring-inset ring-white/40' : ''}`}
                          style={{
                            background: notCalled ? 'transparent' : mins === 0 ? '#1f1f1f' : `rgba(193, 18, 31, ${0.22 + ratio * 0.78})`,
                            border: notCalled ? '1px dashed #2a2a2a' : undefined
                          }}
                        >
                          <span className={`font-mono font-bold leading-none ${notCalled ? 'text-brand-gray-dark' : mins === 0 ? 'text-brand-gray-muted' : 'text-white'}`}>
                            {notCalled ? '–' : mins === 0 ? 'SJ' : `${mins}'`}
                          </span>
                          {s && (s.goals > 0 || s.assists > 0 || s.yellow_cards > 0 || s.red_card) && (
                            <span className="flex items-center gap-0.5 mt-0.5 leading-none">
                              {s.goals > 0 && <span className="text-[9px]">{'⚽'.repeat(Math.min(s.goals, 3))}</span>}
                              {s.assists > 0 && <span className="text-[8px] font-black text-sky-300">A{s.assists > 1 ? s.assists : ''}</span>}
                              {s.yellow_cards > 0 && Array.from({ length: s.yellow_cards }).map((_, i) => <span key={i} className="w-1.5 h-2 rounded-[1px] bg-yellow-400" />)}
                              {s.red_card && <span className="w-1.5 h-2 rounded-[1px] bg-red-500 ring-1 ring-white/60" />}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                  <td className="pl-2 text-center font-mono font-bold text-white">{r.stats.minutes}'</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center gap-4 mt-4 text-[10px] text-brand-gray-muted">
          <span className="flex items-center gap-1.5">
            <span className="w-16 h-2.5 rounded-sm" style={{ background: 'linear-gradient(90deg, rgba(193,18,31,0.25), rgba(193,18,31,1))' }} /> 1' → 90'
          </span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded ring-1 ring-inset ring-white/40 bg-brand-red-700" /> Titular</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded bg-[#1f1f1f]" /> SJ: convocado sin jugar</span>
          <span className="flex items-center gap-1.5"><span className="w-3.5 h-3.5 rounded border border-dashed border-[#2a2a2a]" /> No convocado</span>
        </div>
      </Card>

      {/* Reparto de minutos + Contribución ofensiva */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <Card title="Reparto de minutos" subtitle="Minutos como titular y desde el banquillo" icon={BarChart2}>
          <div style={{ height: Math.max(220, minutesData.length * 26 + 40) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={minutesData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={4}>
                <CartesianGrid stroke={GRID} horizontal={false} />
                <XAxis type="number" {...axisProps} />
                <YAxis yAxisId="name" type="category" dataKey="name" width={78} {...axisProps} tick={{ fontSize: 11, fill: '#d4d4d4' }} />
                <YAxis yAxisId="total" type="category" dataKey="totalLabel" orientation="right" width={44} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#d4d4d4', fontWeight: 600 }} />
                <Tooltip
                  cursor={{ fill: '#ffffff', opacity: 0.04 }}
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const p = payload[0].payload;
                    return <TooltipBox title={p.name} rows={[
                      { label: 'Titular', value: `${p.titular}'`, color: SERIES[0] },
                      { label: 'Suplente', value: `${p.suplente}'`, color: SERIES[1] },
                      { label: 'Total', value: `${p.total}' (${p.pct}%)` }
                    ]} />;
                  }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                <Bar yAxisId="name" dataKey="titular" name="Titular" stackId="m" fill={SERIES[0]} stroke="#000" strokeWidth={1} />
                <Bar yAxisId="name" dataKey="suplente" name="Suplente" stackId="m" fill={SERIES[1]} stroke="#000" strokeWidth={1} radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="Contribución ofensiva" subtitle="Goles y asistencias por jugador" icon={Trophy}>
          {attackData.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-xs text-brand-gray-muted">Sin goles ni asistencias registrados.</div>
          ) : (
            <div style={{ height: Math.max(200, attackData.length * 30 + 40) }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={attackData} layout="vertical" margin={{ top: 0, right: 0, bottom: 0, left: 0 }} barCategoryGap={5}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" allowDecimals={false} domain={[0, (max: number) => Math.max(max, 3)]} {...axisProps} />
                  <YAxis yAxisId="name" type="category" dataKey="name" width={78} {...axisProps} tick={{ fontSize: 11, fill: '#d4d4d4' }} />
                  <YAxis yAxisId="total" type="category" dataKey="totalLabel" orientation="right" width={32} axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#d4d4d4', fontWeight: 600 }} />
                  <Tooltip
                    cursor={{ fill: '#ffffff', opacity: 0.04 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p = payload[0].payload;
                      return <TooltipBox title={p.name} rows={[
                        { label: 'Goles', value: p.goles, color: SERIES[2] },
                        { label: 'Asistencias', value: p.asistencias, color: SERIES[0] }
                      ]} />;
                    }}
                  />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                  <Bar yAxisId="name" dataKey="goles" name="Goles" stackId="a" fill={SERIES[2]} stroke="#000" strokeWidth={1} />
                  <Bar yAxisId="name" dataKey="asistencias" name="Asistencias" stackId="a" fill={SERIES[0]} stroke="#000" strokeWidth={1} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>
      </div>

      {/* XI más utilizado */}
      <Card title="XI más utilizado" subtitle="Ordenado por titularidades y minutos" icon={Users}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2.5">
          {mostUsed11.map((p, idx) => (
            <button
              key={p.id}
              onClick={() => onOpen(p)}
              className="text-left bg-brand-black-card border border-brand-black-border hover:border-brand-red-600/50 p-2.5 rounded-lg flex items-center gap-3 transition-all group"
            >
              <span className="text-[10px] font-mono font-bold text-brand-gray-dark w-4">{idx + 1}</span>
              <div className="w-9 h-9 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
                {p.photo_url ? <img src={p.photo_url} alt={p.full_name} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-brand-gray-dark" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  {p.dorsal != null && <span className="text-[10px] font-black text-brand-red-500">{p.dorsal}</span>}
                  <span className="text-xs font-bold text-white truncate group-hover:text-brand-red-400 transition-colors">{displayName(p)}</span>
                </div>
                <span className="text-[10px] text-brand-gray-muted block truncate">{p.position || 'Sin posición'}</span>
              </div>
              <div className="text-right shrink-0">
                <div className="text-xs font-bold text-emerald-400 tabular-nums">{p.stats.starter} tit.</div>
                <div className="text-[10px] font-mono text-brand-gray-muted">{p.stats.minutes}'</div>
              </div>
            </button>
          ))}
        </div>
      </Card>
    </div>
  );
};
