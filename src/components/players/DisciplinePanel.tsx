import React, { useMemo } from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend } from 'recharts';
import { AlertTriangle, CalendarClock, CheckCircle2, History, ShieldAlert, ShieldCheck, Users } from 'lucide-react';
import { Match } from '../../types';
import { SquadRow, SanctionEvent, YELLOW_CYCLE, displayName, formatMatchShort } from './squadStats';
import { CardCycle } from './SquadTable';

interface Props {
  rows: SquadRow[];
  nextLeague: Match | null;
  leagueCards: { match: Match; label: string; yellows: number; reds: number }[];
  onOpen: (r: SquadRow) => void;
}

const Avatar: React.FC<{ r: SquadRow; size?: string }> = ({ r, size = 'w-8 h-8' }) => (
  <div className={`${size} rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0`}>
    {r.photo_url ? <img src={r.photo_url} alt={r.full_name} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-brand-gray-dark" />}
  </div>
);

const reasonChip = (e: SanctionEvent) => {
  const cls = e.reason === 'ciclo' ? 'bg-yellow-400/10 text-yellow-300 border-yellow-400/30' : 'bg-red-500/10 text-red-400 border-red-500/30';
  return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border whitespace-nowrap ${cls}`}>{e.label}</span>;
};

export const DisciplinePanel: React.FC<Props> = ({ rows, nextLeague, leagueCards, onOpen }) => {
  const sanctioned = rows.filter(r => r.discipline.state === 'sancionado');
  const warned = rows.filter(r => r.discipline.state === 'apercibido');
  const withCards = useMemo(
    () => rows
      .filter(r => r.discipline.yellowCycle > 0 || r.discipline.reds > 0 || r.discipline.doubleYellows > 0)
      .sort((a, b) => {
        const rank = (r: SquadRow) => (r.discipline.state === 'sancionado' ? 0 : r.discipline.state === 'apercibido' ? 1 : 2);
        return rank(a) - rank(b) || b.discipline.yellowInCycle - a.discipline.yellowInCycle || b.discipline.yellowCycle - a.discipline.yellowCycle;
      }),
    [rows]
  );

  const history = useMemo(
    () => rows.flatMap(r => r.discipline.events.map(e => ({ r, e })))
      .sort((a, b) => b.e.triggerMatch.date.localeCompare(a.e.triggerMatch.date)),
    [rows]
  );

  const totalYellow = rows.reduce((a, r) => a + r.discipline.yellowCycle + r.discipline.doubleYellows * 2, 0);
  const totalRed = rows.reduce((a, r) => a + r.discipline.reds + r.discipline.doubleYellows, 0);
  const cycleCards = rows.reduce((a, r) => a + r.discipline.yellowInCycle, 0);

  return (
    <div className="space-y-5">
      {/* Cabecera: próximo partido */}
      <div className="bg-gradient-to-r from-brand-red-950/40 to-brand-black border border-brand-red-600/25 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-brand-red-600/15 border border-brand-red-600/30 flex items-center justify-center">
            <CalendarClock className="w-5 h-5 text-brand-red-500" />
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider font-bold text-brand-gray-muted">Próximo partido de liga</p>
            <p className="text-sm font-bold text-white">{nextLeague ? formatMatchShort(nextLeague) : 'Sin partidos de liga programados'}</p>
          </div>
        </div>
        <p className="text-[11px] text-brand-gray-muted max-w-md">
          Reglas aplicadas: cada <strong className="text-yellow-300">{YELLOW_CYCLE}, {YELLOW_CYCLE * 2}, {YELLOW_CYCLE * 3}…</strong> amarillas acumuladas
          en liga o una <strong className="text-red-400">roja</strong> suponen sanción, que se cumple en el siguiente partido de liga. Solo computan partidos de Liga.
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: 'Sancionados próx. jornada', value: sanctioned.length, icon: ShieldAlert, cls: sanctioned.length ? 'text-red-400' : 'text-brand-gray-light' },
          { label: `Apercibidos (${YELLOW_CYCLE - 1}ª en ciclo)`, value: warned.length, icon: AlertTriangle, cls: warned.length ? 'text-amber-400' : 'text-brand-gray-light' },
          { label: 'Amarillas en liga', value: totalYellow, icon: null, chip: 'bg-yellow-400', cls: 'text-white' },
          { label: 'Rojas en liga', value: totalRed, icon: null, chip: 'bg-red-500', cls: 'text-white' }
        ].map(k => (
          <div key={k.label} className="bg-brand-black border border-brand-black-border rounded-xl p-4">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider font-bold text-brand-gray-muted">
              {k.icon ? <k.icon className="w-3.5 h-3.5" /> : <span className={`w-2 h-3 rounded-[2px] ${k.chip}`} />}
              {k.label}
            </div>
            <div className={`text-3xl font-black mt-1 tabular-nums ${k.cls}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        {/* Sancionados */}
        <div className="bg-brand-black border border-red-900/40 rounded-xl p-4">
          <h4 className="text-xs font-bold text-red-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <ShieldAlert className="w-4 h-4" /> No disponibles por sanción
          </h4>
          {sanctioned.length === 0 ? (
            <p className="text-xs text-brand-gray-muted flex items-center gap-2 py-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Ningún jugador sancionado para la próxima jornada.</p>
          ) : (
            <div className="space-y-2">
              {sanctioned.map(r => (
                <button key={r.id} onClick={() => onOpen(r)} className="w-full text-left flex items-center gap-3 bg-red-950/20 hover:bg-red-950/40 border border-red-800/40 rounded-lg p-2.5 transition-colors">
                  <Avatar r={r} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white">{displayName(r)} <span className="text-[10px] font-normal text-brand-gray-muted">· {r.position || 'Sin posición'}</span></p>
                    <p className="text-[10px] text-brand-gray-muted mt-0.5">Provocada en {formatMatchShort(r.discipline.pending!.triggerMatch)}</p>
                  </div>
                  {reasonChip(r.discipline.pending!)}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Apercibidos */}
        <div className="bg-brand-black border border-amber-900/40 rounded-xl p-4">
          <h4 className="text-xs font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1.5 mb-3">
            <AlertTriangle className="w-4 h-4" /> Apercibidos · a 1 amarilla de sanción
          </h4>
          {warned.length === 0 ? (
            <p className="text-xs text-brand-gray-muted flex items-center gap-2 py-2"><ShieldCheck className="w-4 h-4 text-emerald-500" /> Ningún jugador apercibido.</p>
          ) : (
            <div className="space-y-2">
              {warned.map(r => (
                <button key={r.id} onClick={() => onOpen(r)} className="w-full text-left flex items-center gap-3 bg-amber-950/10 hover:bg-amber-950/30 border border-amber-800/30 rounded-lg p-2.5 transition-colors">
                  <Avatar r={r} />
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-bold text-white">{displayName(r)}</p>
                    <p className="text-[10px] text-brand-gray-muted mt-0.5">{r.discipline.yellowCycle} amarillas en liga</p>
                  </div>
                  <CardCycle row={r} />
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">
        {/* Tabla de control */}
        <div className="xl:col-span-3 bg-brand-black border border-brand-black-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-brand-black-border flex items-center justify-between">
            <h4 className="text-sm font-bold text-white">Control de ciclos de amarillas</h4>
            <span className="text-[10px] text-brand-gray-muted">{cycleCards} amarillas vivas en ciclo</span>
          </div>
          {withCards.length === 0 ? (
            <p className="text-xs text-brand-gray-muted p-6 text-center">Sin tarjetas en liga esta temporada.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-brand-black-bg text-[10px] uppercase tracking-wider text-brand-gray-muted">
                  <tr>
                    <th className="px-3 py-2.5 text-left font-semibold">Jugador</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Ciclo</th>
                    <th className="px-3 py-2.5 text-center font-semibold" title="Amarillas computables en liga">TA</th>
                    <th className="px-3 py-2.5 text-center font-semibold" title="Rojas directas + dobles amarillas">TR</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Para sanción</th>
                    <th className="px-3 py-2.5 text-center font-semibold">Sanciones</th>
                  </tr>
                </thead>
                <tbody>
                  {withCards.map(r => {
                    const d = r.discipline;
                    return (
                      <tr key={r.id} onClick={() => onOpen(r)} className={`border-t border-brand-black-border/50 hover:bg-brand-black-hover cursor-pointer ${d.state === 'sancionado' ? 'bg-red-950/20' : ''}`}>
                        <td className="px-3 py-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] font-black text-brand-red-500 w-4 text-right">{r.dorsal ?? ''}</span>
                            <span className="font-bold text-brand-gray-light">{displayName(r)}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2"><div className="flex justify-center"><CardCycle row={r} /></div></td>
                        <td className="px-3 py-2 text-center font-bold text-yellow-400 tabular-nums">{d.yellowCycle}</td>
                        <td className="px-3 py-2 text-center font-bold text-red-500 tabular-nums">{d.reds + d.doubleYellows || '—'}</td>
                        <td className="px-3 py-2 text-center">
                          {d.state === 'sancionado' ? (
                            <span className="text-[10px] font-black uppercase text-red-400">Sancionado</span>
                          ) : (
                            <span className={`font-bold tabular-nums ${d.toNextSanction === 1 ? 'text-amber-400' : 'text-brand-gray-light'}`}>
                              {d.toNextSanction} TA
                            </span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-center text-brand-gray-muted tabular-nums">{d.events.length || '—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Tarjetas por jornada */}
        <div className="xl:col-span-2 bg-brand-black border border-brand-black-border rounded-xl p-4">
          <h4 className="text-sm font-bold text-white">Tarjetas por jornada</h4>
          <p className="text-[11px] text-brand-gray-muted mb-3">Total del equipo en cada partido de liga</p>
          {leagueCards.length === 0 ? (
            <p className="text-xs text-brand-gray-muted py-10 text-center">Sin jornadas disputadas.</p>
          ) : (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={leagueCards} margin={{ top: 8, right: 4, bottom: 0, left: -24 }}>
                  <CartesianGrid stroke="#262626" vertical={false} />
                  <XAxis dataKey="label" stroke="#737373" tick={{ fontSize: 11, fill: '#a3a3a3' }} tickLine={false} />
                  <YAxis allowDecimals={false} stroke="#737373" tick={{ fontSize: 11, fill: '#a3a3a3' }} tickLine={false} />
                  <Tooltip
                    cursor={{ fill: '#ffffff', opacity: 0.04 }}
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const p: any = payload[0].payload;
                      return (
                        <div className="bg-brand-black-bg/95 border border-brand-black-border rounded-lg px-3 py-2 text-[11px]">
                          <p className="font-bold text-white mb-1">{p.label} · {p.match.rival}</p>
                          <p className="text-brand-gray-muted">Amarillas: <span className="font-bold text-yellow-300">{p.yellows}</span></p>
                          <p className="text-brand-gray-muted">Rojas: <span className="font-bold text-red-400">{p.reds}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Legend iconType="square" iconSize={8} wrapperStyle={{ fontSize: 11, color: '#a3a3a3' }} />
                  <Bar dataKey="yellows" name="Amarillas" stackId="c" fill="#eab308" stroke="#000" strokeWidth={1} maxBarSize={32} />
                  <Bar dataKey="reds" name="Rojas" stackId="c" fill="#dc2626" stroke="#000" strokeWidth={1} radius={[4, 4, 0, 0]} maxBarSize={32} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>

      {/* Historial */}
      <div className="bg-brand-black border border-brand-black-border rounded-xl p-4">
        <h4 className="text-sm font-bold text-white flex items-center gap-2 mb-3"><History className="w-4 h-4 text-brand-red-600" /> Historial de sanciones</h4>
        {history.length === 0 ? (
          <p className="text-xs text-brand-gray-muted py-2">Todavía no se ha producido ninguna sanción esta temporada.</p>
        ) : (
          <div className="divide-y divide-brand-black-border/60">
            {history.map(({ r, e }, i) => (
              <div key={i} className="flex flex-col sm:flex-row sm:items-center gap-2 py-2.5">
                <div className="flex items-center gap-2.5 sm:w-48 shrink-0">
                  <Avatar r={r} size="w-7 h-7" />
                  <span className="text-xs font-bold text-white">{displayName(r)}</span>
                </div>
                <div className="flex-1 flex flex-wrap items-center gap-2 text-[11px] text-brand-gray-muted">
                  {reasonChip(e)}
                  <span>en {formatMatchShort(e.triggerMatch)}</span>
                </div>
                {e.servedMatch ? (
                  <span className="text-[10px] font-semibold text-emerald-400 flex items-center gap-1"><CheckCircle2 className="w-3.5 h-3.5" /> Cumplida · {formatMatchShort(e.servedMatch)}</span>
                ) : (
                  <span className="text-[10px] font-semibold text-red-400 flex items-center gap-1"><ShieldAlert className="w-3.5 h-3.5" /> Pendiente · {formatMatchShort(e.pendingMatch)}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
