import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer
} from 'recharts';
import { computeGruposCounts } from '../lib/fuerzaConstants';
import MuscleHeatmap, { MuscleHeatmapLegend } from '../components/MuscleHeatmap';
import { useAuth } from '../context/AuthContext';
import { Plus } from 'lucide-react';
import { GpsFormModal } from '../components/pf/GpsFormModal';
import { FuerzaFormModal } from '../components/pf/FuerzaFormModal';
import { PlayerSelect } from '../components/pf/PlayerSelect';

const METRICS = [
  { key: 'distancia_total', label: 'Distancia total (m)', color: '#CC0000' },
  { key: 'velocidad_maxima', label: 'Velocidad máxima (km/h)', color: '#2563EB' },
  { key: 'sprints', label: 'Nº Sprints', color: '#16A34A' },
  { key: 'hsr', label: 'HSR alta vel. (m)', color: '#D97706' },
  { key: 'distancia_alta_intensidad', label: 'Dist. alta intensidad (m)', color: '#7C3AED' },
  { key: 'aceleraciones', label: 'Aceleraciones', color: '#0284C7' },
  { key: 'deceleraciones', label: 'Deceleraciones', color: '#DB2777' },
  { key: 'distancia_por_minuto', label: 'Dist./min (m/min)', color: '#059669' },
  { key: 'equilibrio_pasos', label: 'Equilibrio pasos (%)', color: '#EA580C' },
];

const POSICION_ORDER: Record<string, number> = { Portero: 0, Defensa: 1, Centrocampista: 2, Delantero: 3 };

function formatDate(iso: string) {
  if (!iso) return '—';
  const [y, m, d] = iso.split('T')[0].split('-');
  return `${d}/${m}`;
}

export function PF() {
  const [activeTab, setActiveTab] = useState<'gps' | 'fuerza'>('gps');

  return (
    <div className="space-y-6">
      <div className="page-header flex justify-between items-center bg-brand-black-card border border-brand-black-border p-6 rounded-2xl">
        <div>
          <h2 className="text-2xl font-bold tracking-tight text-white mb-2">Preparación Física (PF)</h2>
          <p className="text-brand-gray-muted text-sm max-w-2xl">
            Monitorización de carga, métricas GPS y sesiones de fuerza.
          </p>
        </div>
      </div>

      <div className="border-b border-brand-black-border">
        <nav className="-mb-px flex space-x-8" aria-label="Tabs">
          <button
            onClick={() => setActiveTab('gps')}
            className={`${
              activeTab === 'gps'
                ? 'border-brand-red-600 text-brand-red-600'
                : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light hover:border-brand-gray-muted'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Dashboard GPS
          </button>
          <button
            onClick={() => setActiveTab('fuerza')}
            className={`${
              activeTab === 'fuerza'
                ? 'border-brand-red-600 text-brand-red-600'
                : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light hover:border-brand-gray-muted'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Dashboard Fuerza
          </button>
        </nav>
      </div>

      {activeTab === 'gps' ? <DashboardGPS /> : <DashboardFuerza />}
    </div>
  );
}

function DashboardGPS() {
  const { hasPermission } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [jugadorId, setJugadorId] = useState('');
  const [sessionFilter, setSessionFilter] = useState('todos'); // 'todos' | 'entrenamiento' | 'partido'
  const [metric, setMetric] = useState('distancia_total');

  // Queries
  const { data: jugadores = [] } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('dorsal', { ascending: true, nullsFirst: false });
      if (error) throw error;
      return data;
    }
  });

  const { data: gpsRecords = [] } = useQuery({
    queryKey: ['gps_records'],
    queryFn: async () => {
      const { data, error } = await supabase.from('gps_records').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: entrenamientos = [] } = useQuery({
    queryKey: ['trainings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('trainings').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: partidos = [] } = useQuery({
    queryKey: ['matches'],
    queryFn: async () => {
      const { data, error } = await supabase.from('matches').select('*');
      if (error) throw error;
      return data;
    }
  });

  const jugadoresOrdenados = [...jugadores].sort((a, b) => {
    // We don't have strict position mapped here easily, just fallback to dorsal
    return (a.dorsal || 999) - (b.dorsal || 999);
  });

  const jugadorData = gpsRecords
    .filter(g => {
      if (g.jugador_id !== jugadorId) return false;
      if (sessionFilter !== 'todos' && g.session_type !== sessionFilter) return false;
      return true;
    })
    .map(g => {
      const session = g.session_type === 'entrenamiento'
        ? entrenamientos.find(e => e.id === g.session_id)
        : partidos.find(p => p.id === g.session_id);
      
      const fecha = session?.date || session?.fecha || '0000-00-00';
      return {
        ...g,
        fecha,
        label: session ? formatDate(fecha) : '?',
        sessionLabel: g.session_type === 'entrenamiento'
          ? (session ? `Ent. ${formatDate(fecha)}` : 'Ent. ?')
          : (session ? `vs. ${session.rival || '?'} ${formatDate(fecha)}` : 'Part. ?'),
      };
    })
    .sort((a, b) => a.fecha.localeCompare(b.fecha));

  const selectedJugador = jugadores.find(j => j.id === jugadorId);
  const selectedMetric = METRICS.find(m => m.key === metric);

  const hasData = jugadorData.length > 0;

  const lastValue = hasData ? jugadorData[jugadorData.length - 1][metric as keyof typeof jugadorData[0]] : null;
  const maxValue = hasData ? Math.max(...jugadorData.map(d => (d[metric as keyof typeof d] as number) || 0)) : null;
  const validDataCount = jugadorData.filter(d => d[metric as keyof typeof d] != null).length;
  const avgValue = hasData && validDataCount > 0
    ? (jugadorData.reduce((s, d) => s + ((d[metric as keyof typeof d] as number) || 0), 0) / validDataCount).toFixed(1)
    : null;

  return (
    <div className="space-y-6">
      <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[240px]">
          <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Jugador</label>
          <PlayerSelect 
            jugadores={jugadoresOrdenados} 
            value={jugadorId} 
            onChange={setJugadorId} 
          />
        </div>

        <div className="flex-1 min-w-[200px]">
          <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Métrica</label>
          <select className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light text-sm rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2.5" value={metric} onChange={e => setMetric(e.target.value)}>
            {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
          </select>
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Tipo de sesión</label>
          <div className="flex gap-2">
            {['todos', 'entrenamiento', 'partido'].map(f => (
              <button
                key={f}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${sessionFilter === f ? 'bg-brand-red-600 text-white' : 'bg-brand-black border border-brand-black-border text-brand-gray-muted hover:text-white'}`}
                onClick={() => setSessionFilter(f)}
              >
                {f === 'todos' ? 'Todos' : f === 'entrenamiento' ? 'Entrenamientos' : 'Partidos'}
              </button>
            ))}
          </div>
        </div>

        {hasPermission('pf', 'editar') && (
          <div className="ml-auto">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-2 bg-brand-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-red-700 transition-colors shadow-glow-red"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Registro GPS</span>
            </button>
          </div>
        )}
      </div>

      <GpsFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        jugadores={jugadores}
        entrenamientos={entrenamientos}
        partidos={partidos}
      />

      {!jugadorId ? (
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
          <p className="text-brand-gray-muted">Selecciona un jugador para ver su evolución GPS.</p>
        </div>
      ) : !hasData ? (
        <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
          <p className="text-brand-gray-muted">No hay datos GPS para <strong>{selectedJugador?.full_name}</strong> con los filtros actuales.</p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
              <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Último valor</div>
              <div className="text-2xl font-bold text-brand-red-600 mt-1">{lastValue ?? '—'}</div>
              <div className="text-xs text-brand-gray-muted mt-1">{selectedMetric?.label}</div>
            </div>
            <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
              <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Máximo</div>
              <div className="text-2xl font-bold text-white mt-1">{maxValue ?? '—'}</div>
              <div className="text-xs text-brand-gray-muted mt-1">{selectedMetric?.label}</div>
            </div>
            <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
              <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Media</div>
              <div className="text-2xl font-bold text-white mt-1">{avgValue ?? '—'}</div>
              <div className="text-xs text-brand-gray-muted mt-1">{selectedMetric?.label}</div>
            </div>
          </div>

          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-white">{selectedMetric?.label} — {selectedJugador?.full_name}</h3>
              <span className="text-xs bg-brand-black-border px-2 py-1 rounded text-brand-gray-light">{jugadorData.length} registros</span>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={jugadorData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                  <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 11 }} />
                  <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                  <Tooltip
                    formatter={(v: any) => [v, selectedMetric?.label]}
                    labelFormatter={(_: any, payload: any) => payload?.[0]?.payload?.sessionLabel || ''}
                    contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 12, borderRadius: 6, color: '#fff' }}
                  />
                  <Line
                    type="monotone"
                    dataKey={metric}
                    stroke="#CC0000"
                    strokeWidth={2}
                    dot={{ fill: '#CC0000', r: 4 }}
                    activeDot={{ r: 6 }}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {METRICS.map(m => (
              <MiniChart key={m.key} title={m.label} data={jugadorData} dataKey={m.key} color={m.color} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function MiniChart({ title, data, dataKey, color = '#CC0000' }: { title: string, data: any[], dataKey: string, color?: string }) {
  return (
    <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
      <h4 className="text-xs font-bold text-brand-gray-light mb-3">{title}</h4>
      <div className="h-40 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 8, left: -20, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
            <XAxis dataKey="label" tick={{ fill: '#888', fontSize: 10 }} />
            <YAxis tick={{ fill: '#888', fontSize: 10 }} />
            <Tooltip
              formatter={(v: any) => [v, title]}
              contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 11, borderRadius: 6, color: '#fff' }}
            />
            <Bar dataKey={dataKey} fill={color} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function DashboardFuerza() {
  const { hasPermission } = useAuth();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [plantilla, setPlantilla] = useState('primer_equipo');

  const { data: sesiones = [] } = useQuery({
    queryKey: ['fuerza_sesiones'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fuerza_sesiones').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: sesionEjercicios = [] } = useQuery({
    queryKey: ['fuerza_sesion_ejercicios'],
    queryFn: async () => {
      const { data, error } = await supabase.from('fuerza_sesion_ejercicios').select('*');
      if (error) throw error;
      return data;
    }
  });

  const { data: catalogo = [] } = useQuery({
    queryKey: ['ejercicios_fuerza'],
    queryFn: async () => {
      const { data, error } = await supabase.from('ejercicios_fuerza').select('*');
      if (error) throw error;
      return data;
    }
  });

  const sesionesPlantilla = sesiones.filter(s => (s.plantilla || 'primer_equipo') === plantilla);
  const sesionIds = new Set(sesionesPlantilla.map(s => s.id));
  const entriesPlantilla = sesionEjercicios.filter(se => sesionIds.has(se.sesion_id));

  const tabataCount = sesionesPlantilla.filter(s => s.tipo === 'tabata').length;
  const repeticionesCount = sesionesPlantilla.filter(s => s.tipo === 'repeticiones').length;

  const counts = computeGruposCounts(entriesPlantilla.map(e => e.ejercicio_id), catalogo);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <button
            onClick={() => setPlantilla('primer_equipo')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${plantilla === 'primer_equipo' ? 'bg-brand-red-600 text-white' : 'bg-brand-black border border-brand-black-border text-brand-gray-muted'}`}
          >
            Primer Equipo
          </button>
          <button
            onClick={() => setPlantilla('juvenil')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${plantilla === 'juvenil' ? 'bg-brand-red-600 text-white' : 'bg-brand-black border border-brand-black-border text-brand-gray-muted'}`}
          >
            Juvenil
          </button>
        </div>

        {hasPermission('pf', 'editar') && (
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center gap-2 bg-brand-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-red-700 transition-colors shadow-glow-red"
          >
            <Plus className="w-4 h-4" />
            <span>Registrar Sesión</span>
          </button>
        )}
      </div>

      <FuerzaFormModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        catalogoEjercicios={catalogo}
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
          <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Sesiones de fuerza</div>
          <div className="text-2xl font-bold text-white mt-1">{sesionesPlantilla.length}</div>
        </div>
        <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
          <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Sesiones Tabata</div>
          <div className="text-2xl font-bold text-white mt-1">{tabataCount}</div>
        </div>
        <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
          <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Sesiones por repeticiones</div>
          <div className="text-2xl font-bold text-white mt-1">{repeticionesCount}</div>
        </div>
      </div>

      <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6">
        <div className="font-bold text-white mb-1">Grupos musculares más trabajados</div>
        <p className="text-sm text-brand-gray-muted mb-6">Acumulado de todas las sesiones de fuerza de la temporada</p>
        
        {sesionesPlantilla.length === 0 ? (
          <div className="text-center p-12 text-brand-gray-muted bg-brand-black/50 rounded-lg">
            <p>Aún no hay sesiones de fuerza registradas para esta plantilla.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center">
            <div className="mb-6 bg-brand-black p-4 rounded-xl border border-brand-black-border/50">
              <MuscleHeatmap counts={counts} size={300} />
            </div>
            <MuscleHeatmapLegend />
          </div>
        )}
      </div>
    </div>
  );
}
