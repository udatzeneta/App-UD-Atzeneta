import React, { useMemo, useState } from 'react';
import { ArrowDown, ArrowUp, ArrowUpDown, Edit2, Filter, FilterX, Trash2, Users } from 'lucide-react';
import { SquadRow, YELLOW_CYCLE, formatMatchShort } from './squadStats';

type ColType = 'text' | 'num';

interface Column {
  key: string;
  label: string;
  title?: string;
  type: ColType;
  value: (r: SquadRow) => string | number | null;
  sortValue?: (r: SquadRow) => number;
  align?: 'left' | 'center';
  render?: (r: SquadRow) => React.ReactNode;
  options?: string[];   // para filtros de texto con valores cerrados
  hideable?: boolean;
}

interface NumFilter { min?: string; max?: string }

const STATUS_ORDER = ['Disponible', 'En duda', 'Lesionado', 'Baja'];

const statusBadge = (s?: string) => {
  const status = s || 'Disponible';
  const cls =
    status === 'Disponible' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
    status === 'En duda' ? 'bg-amber-500/10 text-amber-400 border-amber-500/25' :
    'bg-red-500/10 text-red-400 border-red-500/25';
  return (
    <span className={`text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border ${cls}`}>
      {status}
    </span>
  );
};

export const CardCycle: React.FC<{ row: SquadRow; compact?: boolean }> = ({ row, compact }) => {
  const d = row.discipline;
  const filled = d.pending && d.pending.reason === 'ciclo' ? YELLOW_CYCLE : d.yellowInCycle;
  return (
    <div className="flex items-center gap-[3px]" title={`${d.yellowCycle} amarillas en liga · ${d.toNextSanction} para la próxima sanción`}>
      {Array.from({ length: YELLOW_CYCLE }).map((_, i) => (
        <span
          key={i}
          className={`${compact ? 'w-1.5 h-2.5' : 'w-2 h-3'} rounded-[2px] ${
            i < filled
              ? d.state === 'sancionado' ? 'bg-red-500' : d.state === 'apercibido' ? 'bg-amber-400' : 'bg-yellow-400'
              : 'bg-brand-black-border'
          }`}
        />
      ))}
    </div>
  );
};

export const DisciplineBadge: React.FC<{ row: SquadRow }> = ({ row }) => {
  const d = row.discipline;
  if (d.state === 'sancionado' && d.pending) {
    return (
      <span
        className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-red-500/15 text-red-400 border-red-500/40 whitespace-nowrap"
        title={`${d.pending.label} en ${formatMatchShort(d.pending.triggerMatch)} — cumple en ${formatMatchShort(d.pending.pendingMatch)}`}
      >
        Sancionado
      </span>
    );
  }
  if (d.state === 'apercibido') {
    return (
      <span className="text-[9px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border bg-amber-500/10 text-amber-400 border-amber-500/30 whitespace-nowrap" title="A 1 amarilla de sanción">
        Apercibido
      </span>
    );
  }
  return <span className="text-[10px] text-brand-gray-dark">—</span>;
};

interface Props {
  rows: SquadRow[];
  canEdit: boolean;
  canDelete: boolean;
  onOpen: (r: SquadRow) => void;
  onEdit: (r: SquadRow) => void;
  onDelete: (r: SquadRow) => void;
  onVisibleRowsChange?: (rows: SquadRow[]) => void;
}

export const SquadTable: React.FC<Props> = ({ rows, canEdit, canDelete, onOpen, onEdit, onDelete, onVisibleRowsChange }) => {
  const [sortKey, setSortKey] = useState<string>('minutes');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [showFilters, setShowFilters] = useState(false);
  const [textFilters, setTextFilters] = useState<Record<string, string>>({});
  const [numFilters, setNumFilters] = useState<Record<string, NumFilter>>({});

  const positions = useMemo(() => Array.from(new Set(rows.map(r => r.position).filter(Boolean) as string[])).sort(), [rows]);

  const num = (cls: string) => (r: SquadRow, v: number | null, suffix = '') => (
    <span className={`font-bold tabular-nums ${v ? cls : 'text-brand-gray-dark'}`}>{v ?? '—'}{v ? suffix : ''}</span>
  );

  const columns: Column[] = [
    {
      key: 'name', label: 'Jugador', type: 'text', align: 'left', value: r => `${r.nickname || ''} ${r.full_name}`,
      render: r => (
        <div className="flex items-center gap-2.5 min-w-[150px]">
          <div className="w-8 h-8 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
            {r.photo_url ? <img src={r.photo_url} alt={r.full_name} className="w-full h-full object-cover" /> : <Users className="w-4 h-4 text-brand-gray-dark" />}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              {r.dorsal != null && <span className="text-[10px] font-black text-brand-red-500 tabular-nums">{r.dorsal}</span>}
              <span className="font-bold text-[13px] text-brand-gray-light group-hover:text-white transition-colors truncate">{r.nickname || r.full_name}</span>
              {r.isGuest && (
                <span className="text-[8px] font-black uppercase px-1 py-px rounded bg-sky-500/10 text-sky-400 border border-sky-500/25" title={`Ficha de ${r.team_category}`}>
                  {r.team_category === 'Juvenil' ? 'Filial' : '1er Eq.'}
                </span>
              )}
            </div>
            {r.nickname && <span className="text-[10px] text-brand-gray-muted block truncate max-w-[150px]">{r.full_name}</span>}
          </div>
        </div>
      )
    },
    {
      key: 'position', label: 'Posición', type: 'text', align: 'left', value: r => r.position || '', options: positions,
      render: r => <span className="text-[10px] uppercase font-semibold text-brand-gray-muted block max-w-[96px] leading-tight">{r.position || '—'}</span>
    },
    { key: 'called', label: 'Conv', title: 'Convocatorias', type: 'num', value: r => r.stats.called, render: r => num('text-brand-gray-light')(r, r.stats.called) },
    { key: 'played', label: 'PJ', title: 'Partidos jugados (con minutos)', type: 'num', value: r => r.stats.played, render: r => num('text-white')(r, r.stats.played) },
    { key: 'starter', label: 'Tit', title: 'Partidos como titular', type: 'num', value: r => r.stats.starter, render: r => num('text-emerald-400')(r, r.stats.starter) },
    { key: 'subIn', label: 'Supl', title: 'Entradas desde el banquillo', type: 'num', value: r => r.stats.subIn, render: r => num('text-brand-gray-light')(r, r.stats.subIn) },
    {
      key: 'minutes', label: 'Min', title: 'Minutos jugados (y % sobre el total posible)', type: 'num', value: r => r.stats.minutes,
      render: r => (
        <div className="flex flex-col items-center gap-1 min-w-[64px]">
          <span className={`font-mono font-bold tabular-nums ${r.stats.minutes ? 'text-white' : 'text-brand-gray-dark'}`}>{r.stats.minutes}'</span>
          <div className="flex items-center gap-1">
            <div className="w-10 h-1 rounded-full bg-brand-black-border overflow-hidden">
              <div className="h-full bg-brand-red-600 rounded-full" style={{ width: `${Math.min(100, r.stats.minutesPct)}%` }} />
            </div>
            <span className="text-[9px] text-brand-gray-muted tabular-nums">{r.stats.minutesPct}%</span>
          </div>
        </div>
      )
    },
    { key: 'minPerMatch', label: 'Min/PJ', title: 'Media de minutos por partido jugado', type: 'num', value: r => r.stats.minPerMatch, render: r => num('text-brand-gray-light')(r, r.stats.minPerMatch, "'") },
    { key: 'goals', label: 'Gol', title: 'Goles', type: 'num', value: r => r.stats.goals, render: r => num('text-emerald-400')(r, r.stats.goals) },
    { key: 'assists', label: 'Asis', title: 'Asistencias', type: 'num', value: r => r.stats.assists, render: r => num('text-sky-400')(r, r.stats.assists) },
    { key: 'ga', label: 'G+A', title: 'Goles + asistencias', type: 'num', value: r => r.stats.ga, render: r => num('text-white')(r, r.stats.ga) },
    {
      key: 'conceded', label: 'GC', title: 'Goles encajados (porteros)', type: 'num',
      value: r => (r.position?.toLowerCase().includes('portero') ? r.stats.conceded : null),
      render: r => r.position?.toLowerCase().includes('portero') ? num('text-red-400')(r, r.stats.conceded) : <span className="text-brand-gray-dark">—</span>
    },
    {
      key: 'yellow', label: 'TA', title: 'Tarjetas amarillas', type: 'num', value: r => r.stats.yellow,
      render: r => (
        <div className="flex items-center justify-center gap-1.5">
          <span className={`font-bold tabular-nums w-3 text-right ${r.stats.yellow ? 'text-yellow-400' : 'text-brand-gray-dark'}`}>{r.stats.yellow}</span>
        </div>
      )
    },
    { key: 'red', label: 'TR', title: 'Tarjetas rojas', type: 'num', value: r => r.stats.red, render: r => num('text-red-500')(r, r.stats.red) },
    {
      key: 'discipline', label: 'Ciclo liga', title: `Amarillas de liga en el ciclo actual de ${YELLOW_CYCLE} y estado disciplinario`, type: 'text',
      options: ['Sancionado', 'Apercibido', 'Sin riesgo'],
      value: r => (r.discipline.state === 'sancionado' ? 'Sancionado' : r.discipline.state === 'apercibido' ? 'Apercibido' : 'Sin riesgo'),
      sortValue: r => (r.discipline.state === 'sancionado' ? 100 : r.discipline.state === 'apercibido' ? 50 : 0) + r.discipline.yellowInCycle,
      render: r => (
        <div className="flex flex-col items-center gap-1">
          <CardCycle row={r} compact />
          {r.discipline.state !== 'limpio' && <DisciplineBadge row={r} />}
        </div>
      )
    },
    {
      key: 'status', label: 'Estado', type: 'text', options: STATUS_ORDER,
      value: r => r.physical_status || 'Disponible', render: r => statusBadge(r.physical_status)
    }
  ];

  const filtered = useMemo(() => {
    let list = rows.filter(r => columns.every(c => {
      if (c.type === 'text') {
        const f = (textFilters[c.key] || '').trim().toLowerCase();
        if (!f) return true;
        const v = String(c.value(r) ?? '').toLowerCase();
        return c.options ? v === f : v.includes(f);
      }
      const nf = numFilters[c.key];
      if (!nf || (!nf.min && !nf.max)) return true;
      const v = c.value(r);
      if (v === null || v === undefined) return false;
      if (nf.min !== undefined && nf.min !== '' && Number(v) < Number(nf.min)) return false;
      if (nf.max !== undefined && nf.max !== '' && Number(v) > Number(nf.max)) return false;
      return true;
    }));

    const col = columns.find(c => c.key === sortKey);
    if (col) {
      list = [...list].sort((a, b) => {
        const va = col.sortValue ? col.sortValue(a) : col.value(a);
        const vb = col.sortValue ? col.sortValue(b) : col.value(b);
        // Los vacíos siempre al final
        if (va === null || va === '') return 1;
        if (vb === null || vb === '') return -1;
        let cmp: number;
        if (col.key === 'status') cmp = STATUS_ORDER.indexOf(String(va)) - STATUS_ORDER.indexOf(String(vb));
        else if (col.type === 'num' || col.sortValue) cmp = Number(va) - Number(vb);
        else cmp = String(va).localeCompare(String(vb), 'es');
        if (sortDir === 'desc') cmp = -cmp;
        // Desempate estable: más minutos primero, independientemente de la dirección
        return cmp || b.stats.minutes - a.stats.minutes;
      });
    }
    return list;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, textFilters, numFilters, sortKey, sortDir]);

  React.useEffect(() => { onVisibleRowsChange?.(filtered); }, [filtered, onVisibleRowsChange]);

  const activeFilters = Object.values(textFilters).filter(Boolean).length +
    Object.values(numFilters).filter(f => f.min || f.max).length;

  const handleSort = (c: Column) => {
    if (sortKey === c.key) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
    else { setSortKey(c.key); setSortDir(c.type === 'num' ? 'desc' : 'asc'); }
  };

  // Totales del equipo (filas visibles)
  const totals = useMemo(() => filtered.reduce((acc, r) => {
    acc.goals += r.stats.goals; acc.assists += r.stats.assists; acc.yellow += r.stats.yellow; acc.red += r.stats.red;
    acc.minutes += r.stats.minutes;
    return acc;
  }, { goals: 0, assists: 0, yellow: 0, red: 0, minutes: 0 }), [filtered]);

  return (
    <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-2.5 border-b border-brand-black-border bg-brand-black-bg/60">
        <span className="text-[11px] text-brand-gray-muted">
          <span className="font-bold text-brand-gray-light">{filtered.length}</span> de {rows.length} jugadores · clic en una columna para ordenar
        </span>
        <div className="flex items-center gap-2">
          {activeFilters > 0 && (
            <button
              onClick={() => { setTextFilters({}); setNumFilters({}); }}
              className="text-[11px] font-semibold text-brand-gray-muted hover:text-white flex items-center gap-1 px-2 py-1 rounded border border-brand-black-border hover:bg-brand-black-hover"
            >
              <FilterX className="w-3.5 h-3.5" /> Limpiar ({activeFilters})
            </button>
          )}
          <button
            onClick={() => setShowFilters(v => !v)}
            className={`text-[11px] font-semibold flex items-center gap-1 px-2 py-1 rounded border transition-colors ${
              showFilters ? 'bg-brand-red-600/15 text-brand-red-400 border-brand-red-600/40' : 'text-brand-gray-muted hover:text-white border-brand-black-border hover:bg-brand-black-hover'
            }`}
          >
            <Filter className="w-3.5 h-3.5" /> Filtros por columna
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-brand-gray-light">
          <thead className="bg-brand-black-bg border-b border-brand-black-border text-[10px] uppercase tracking-wider text-brand-gray-muted sticky top-0 z-10">
            <tr>
              {columns.map(c => {
                const active = sortKey === c.key;
                const Icon = active ? (sortDir === 'asc' ? ArrowUp : ArrowDown) : ArrowUpDown;
                return (
                  <th
                    key={c.key}
                    title={c.title}
                    onClick={() => handleSort(c)}
                    className={`px-2 py-3 font-semibold cursor-pointer select-none whitespace-nowrap hover:text-white transition-colors ${c.align === 'left' ? 'text-left' : 'text-center'} ${active ? 'text-white' : ''}`}
                  >
                    <span className={`inline-flex items-center gap-1 ${c.align === 'left' ? '' : 'justify-center'}`}>
                      {c.key === 'yellow' && <span className="w-2 h-2.5 rounded-[2px] bg-yellow-400 inline-block" />}
                      {c.key === 'red' && <span className="w-2 h-2.5 rounded-[2px] bg-red-500 inline-block" />}
                      {c.label}
                      <Icon className={`w-3 h-3 ${active ? 'text-brand-red-500' : 'opacity-30'}`} />
                    </span>
                  </th>
                );
              })}
              {(canEdit || canDelete) && <th className="px-2.5 py-3 font-semibold text-right">Acc.</th>}
            </tr>
            {showFilters && (
              <tr className="bg-brand-black border-t border-brand-black-border normal-case tracking-normal">
                {columns.map(c => (
                  <th key={c.key} className="px-1.5 py-2 font-normal">
                    {c.type === 'text' ? (
                      c.options ? (
                        <select
                          value={textFilters[c.key] || ''}
                          onChange={e => setTextFilters(f => ({ ...f, [c.key]: e.target.value }))}
                          className="w-full min-w-[90px] bg-brand-black-bg border border-brand-black-border rounded px-1.5 py-1 text-[11px] text-brand-gray-light focus:border-brand-red-600 outline-none"
                        >
                          <option value="">Todos</option>
                          {c.options.map(o => <option key={o} value={o.toLowerCase()}>{o}</option>)}
                        </select>
                      ) : (
                        <input
                          value={textFilters[c.key] || ''}
                          onChange={e => setTextFilters(f => ({ ...f, [c.key]: e.target.value }))}
                          placeholder="Contiene…"
                          className="w-full min-w-[90px] bg-brand-black-bg border border-brand-black-border rounded px-1.5 py-1 text-[11px] text-brand-gray-light placeholder:text-brand-gray-dark focus:border-brand-red-600 outline-none"
                        />
                      )
                    ) : (
                      <div className="flex flex-col gap-1">
                        {(['min', 'max'] as const).map(k => (
                          <input
                            key={k}
                            type="number"
                            value={numFilters[c.key]?.[k] || ''}
                            onChange={e => setNumFilters(f => ({ ...f, [c.key]: { ...f[c.key], [k]: e.target.value } }))}
                            placeholder={k === 'min' ? '≥' : '≤'}
                            className="w-full min-w-[44px] bg-brand-black-bg border border-brand-black-border rounded px-1 py-0.5 text-[10px] text-center text-brand-gray-light placeholder:text-brand-gray-dark focus:border-brand-red-600 outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                          />
                        ))}
                      </div>
                    )}
                  </th>
                ))}
                {(canEdit || canDelete) && <th />}
              </tr>
            )}
          </thead>
          <tbody>
            {filtered.length === 0 && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-10 text-center text-brand-gray-muted">Ningún jugador cumple los filtros.</td></tr>
            )}
            {filtered.map(r => (
              <tr
                key={r.id}
                onClick={() => onOpen(r)}
                className={`border-b border-brand-black-border/50 hover:bg-brand-black-hover transition-colors cursor-pointer group ${
                  r.discipline.state === 'sancionado' ? 'bg-red-950/20' : ''
                }`}
              >
                {columns.map(c => (
                  <td key={c.key} className={`px-2 py-2 ${c.align === 'left' ? 'text-left' : 'text-center'}`}>
                    {c.render ? c.render(r) : String(c.value(r) ?? '—')}
                  </td>
                ))}
                {(canEdit || canDelete) && (
                  <td className="px-2.5 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {canEdit && (
                        <button
                          onClick={e => { e.stopPropagation(); onEdit(r); }}
                          className="p-1.5 text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-card border border-brand-black-border rounded transition-all"
                          title="Editar"
                        >
                          <Edit2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={e => { e.stopPropagation(); onDelete(r); }}
                          className="p-1.5 text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/5 border border-brand-black-border hover:border-brand-red-600/30 rounded transition-all"
                          title="Eliminar"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-brand-black-bg border-t border-brand-black-border text-[11px] font-bold text-brand-gray-muted">
              <tr>
                <td colSpan={6} className="px-2.5 py-2.5 uppercase tracking-wider text-[10px]">Totales (filas visibles)</td>
                <td className="px-2.5 py-2.5 text-center font-mono text-brand-gray-light">{totals.minutes}'</td>
                <td />
                <td className="px-2.5 py-2.5 text-center text-emerald-400">{totals.goals}</td>
                <td className="px-2.5 py-2.5 text-center text-sky-400">{totals.assists}</td>
                <td className="px-2.5 py-2.5 text-center text-white">{totals.goals + totals.assists}</td>
                <td />
                <td className="px-2.5 py-2.5 text-center text-yellow-400">{totals.yellow}</td>
                <td className="px-2.5 py-2.5 text-center text-red-500">{totals.red}</td>
                <td colSpan={(canEdit || canDelete) ? 3 : 2} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};
