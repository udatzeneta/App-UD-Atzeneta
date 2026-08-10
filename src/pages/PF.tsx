import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../lib/supabase';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend
} from 'recharts';
import { computeGruposCounts } from '../lib/fuerzaConstants';
import MuscleHeatmap, { MuscleHeatmapLegend } from '../components/MuscleHeatmap';
import { useAuth } from '../context/AuthContext';
import { Plus, Download, Activity } from 'lucide-react';
import { GpsFormModal } from '../components/pf/GpsFormModal';
import { FuerzaFormModal } from '../components/pf/FuerzaFormModal';
import { PlayerSelect } from '../components/pf/PlayerSelect';
import { ComparadorGPS } from '../components/pf/ComparadorGPS';
import { PFHistoryList } from '../components/pf/PFHistoryList';
import { EjercicioFuerzaFormModal } from '../components/pf/EjercicioFuerzaFormModal';
import { EjercicioDetalleModal } from '../components/pf/EjercicioDetalleModal';
import { GPSPlayerPrintView } from '../components/pf/GPSPlayerPrintView';
import { FuerzaSessionPrintView } from '../components/pf/FuerzaSessionPrintView';
import { GPSSessionPrintView } from '../components/pf/GPSSessionPrintView';
import { GPSPlayerSessionPrintView } from '../components/pf/GPSPlayerSessionPrintView';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { useQueryClient, useMutation } from '@tanstack/react-query';
import { useToast } from '../context/ToastContext';

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
  const [activeTab, setActiveTab] = useState<'gps' | 'comparador' | 'fuerza'>('gps');

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
            onClick={() => setActiveTab('comparador')}
            className={`${
              activeTab === 'comparador'
                ? 'border-brand-red-600 text-brand-red-600'
                : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light hover:border-brand-gray-muted'
            } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm transition-colors`}
          >
            Comparador
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

      {activeTab === 'gps' && <DashboardGPS />}
      {activeTab === 'comparador' && <ComparadorTab />}
      {activeTab === 'fuerza' && <DashboardFuerza />}
    </div>
  );
}

function ComparadorTab() {
  const { data: jugadores = [] } = useQuery({
    queryKey: ['players'],
    queryFn: async () => {
      const { data, error } = await supabase.from('players').select('*').order('dorsal', { ascending: true, nullsFirst: false });
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

  return (
    <ComparadorGPS
      jugadores={jugadores}
      gpsRecords={gpsRecords}
      entrenamientos={entrenamientos}
      partidos={partidos}
      metrics={METRICS}
    />
  );
}

function DashboardGPS() {
  const { hasPermission, user } = useAuth();
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGpsRecord, setEditingGpsRecord] = useState<any>(null);
  
  const [viewMode, setViewMode] = useState<'player' | 'session'>('player');
  const [jugadorId, setJugadorId] = useState('');
  const [playerSessionId, setPlayerSessionId] = useState('todos');
  const [selectedSessionId, setSelectedSessionId] = useState('');

  React.useEffect(() => {
    setPlayerSessionId('todos');
  }, [jugadorId]);
  
  const [sessionFilter, setSessionFilter] = useState('todos'); // 'todos' | 'entrenamiento' | 'partido'
  const [metric, setMetric] = useState('distancia_total');
  
  const [plantilla, setPlantilla] = useState<'Primer Equipo' | 'Juvenil'>((user?.team_category === 'Juvenil') ? 'Juvenil' : 'Primer Equipo');

  React.useEffect(() => {
    if (user?.team_category) {
      setPlantilla((user.team_category === 'Juvenil') ? 'Juvenil' : 'Primer Equipo');
    }
  }, [user?.team_category]);

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

  const jugadoresOrdenados = [...jugadores]
    .filter(j => (j.team_category || 'Primer Equipo') === plantilla)
    .sort((a, b) => {
      return (a.dorsal || 999) - (b.dorsal || 999);
    });

  const sessionsWithGps = React.useMemo(() => {
    const sessionIds = new Set(gpsRecords.map(r => r.session_id));
    const list: { id: string; label: string; date: string; type: 'entrenamiento' | 'partido' }[] = [];
    
    entrenamientos.forEach(e => {
      if (sessionIds.has(e.id)) {
        list.push({
          id: e.id,
          label: `Entrenamiento - ${formatDate(e.date || e.fecha)}`,
          date: e.date || e.fecha || '',
          type: 'entrenamiento'
        });
      }
    });

    partidos.forEach(p => {
      if (sessionIds.has(p.id)) {
        list.push({
          id: p.id,
          label: `Partido vs ${p.rival || 'Rival'} - ${formatDate(p.date || p.fecha)}`,
          date: p.date || p.fecha || '',
          type: 'partido'
        });
      }
    });

    return list.sort((a, b) => b.date.localeCompare(a.date));
  }, [gpsRecords, entrenamientos, partidos]);

  React.useEffect(() => {
    if (sessionsWithGps.length > 0 && !selectedSessionId) {
      setSelectedSessionId(sessionsWithGps[0].id);
    }
  }, [sessionsWithGps, selectedSessionId]);

  const selectedSession = sessionsWithGps.find(s => s.id === selectedSessionId);

  const sessionRecords = React.useMemo(() => {
    if (!selectedSessionId) return [];
    return gpsRecords
      .filter(r => r.session_id === selectedSessionId)
      .map(r => {
        const player = jugadores.find(j => j.id === r.jugador_id);
        return {
          ...r,
          playerName: player ? (player.nickname || player.full_name) : 'Desconocido',
          dorsal: player?.dorsal || null
        };
      })
      .sort((a, b) => (b[metric as keyof typeof b] as number || 0) - (a[metric as keyof typeof a] as number || 0));
  }, [selectedSessionId, gpsRecords, jugadores, metric]);

  const chartData = React.useMemo(() => {
    return gpsRecords
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
  }, [gpsRecords, jugadorId, sessionFilter, entrenamientos, partidos]);

  const selectedJugador = jugadores.find(j => j.id === jugadorId);
  const selectedMetric = METRICS.find(m => m.key === metric);

  const hasData = chartData.length > 0;

  const lastValue = hasData ? chartData[chartData.length - 1][metric as keyof typeof chartData[0]] : null;
  const maxValue = hasData ? Math.max(...chartData.map(d => (d[metric as keyof typeof d] as number) || 0)) : null;
  const validDataCount = chartData.filter(d => d[metric as keyof typeof d] != null).length;
  const avgValue = hasData && validDataCount > 0
    ? (chartData.reduce((s, d) => s + ((d[metric as keyof typeof d] as number) || 0), 0) / validDataCount).toFixed(1)
    : null;

  const playerSessions = React.useMemo(() => {
    if (!jugadorId) return [];
    return gpsRecords
      .filter(r => r.jugador_id === jugadorId)
      .map(r => {
        const session = r.session_type === 'entrenamiento'
          ? entrenamientos.find(e => e.id === r.session_id)
          : partidos.find(p => p.id === r.session_id);
        const fecha = session?.date || session?.fecha || '';
        return {
          id: r.id,
          label: `${formatDate(fecha)} - ${r.session_type === 'entrenamiento' ? 'Entrenamiento' : 'Partido'}${r.session_type === 'partido' && session?.rival ? ` vs ${session.rival}` : ''}`,
          fecha,
          record: r,
          session
        };
      })
      .sort((a, b) => b.fecha.localeCompare(a.fecha));
  }, [jugadorId, gpsRecords, entrenamientos, partidos]);

  const selectedPlayerRecord = React.useMemo(() => {
    if (playerSessionId === 'todos') return null;
    return gpsRecords.find(r => r.id === playerSessionId);
  }, [playerSessionId, gpsRecords]);

  const playerAverages = React.useMemo(() => {
    if (!jugadorId) return {} as Record<string, number>;
    const playerRecs = gpsRecords.filter(r => r.jugador_id === jugadorId);
    const avgs: Record<string, number> = {};
    
    METRICS.forEach(m => {
      const validRecs = playerRecs.filter(r => r[m.key] != null);
      avgs[m.key] = validRecs.length > 0
        ? validRecs.reduce((sum, r) => sum + Number(r[m.key] || 0), 0) / validRecs.length
        : 0;
    });
    
    return avgs;
  }, [jugadorId, gpsRecords]);

  const singleSessionRadarData = React.useMemo(() => {
    if (!selectedPlayerRecord || !jugadorId) return [];
    
    const playerRecs = gpsRecords.filter(r => r.jugador_id === jugadorId);
    const personalMax: Record<string, number> = {};
    METRICS.forEach(m => {
      const vals = playerRecs.map(r => Number(r[m.key] || 0));
      personalMax[m.key] = Math.max(...vals, 1);
    });

    return METRICS.map(m => {
      const val = Number(selectedPlayerRecord[m.key] || 0);
      const avg = playerAverages[m.key] || 0;
      const ref = personalMax[m.key];
      
      return {
        metric: m.label.split(' (')[0],
        'Sesión Actual': Number(((val / ref) * 100).toFixed(1)),
        'Media Histórica': Number(((avg / ref) * 100).toFixed(1)),
        raw_val: val,
        raw_avg: Number(avg.toFixed(1))
      };
    });
  }, [selectedPlayerRecord, playerAverages, gpsRecords, jugadorId]);

  const sessionAvgValue = React.useMemo(() => {
    if (sessionRecords.length === 0) return '—';
    const sum = sessionRecords.reduce((s, r) => s + (Number(r[metric]) || 0), 0);
    return (sum / sessionRecords.length).toFixed(1);
  }, [sessionRecords, metric]);

  const sessionMaxInfo = React.useMemo(() => {
    if (sessionRecords.length === 0) return null;
    const sorted = [...sessionRecords].sort((a, b) => (Number(b[metric]) || 0) - (Number(a[metric]) || 0));
    return {
      value: Number(sorted[0][metric]) || 0,
      playerName: sorted[0].playerName
    };
  }, [sessionRecords, metric]);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('gps_records').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['gps_records'] });
      showToast('success', 'Registro GPS eliminado');
    },
    onError: () => {
      showToast('error', 'Error al eliminar el registro');
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este registro GPS?')) {
      deleteMutation.mutate(id);
    }
  };

  const handleEditGps = (record: any) => {
    setEditingGpsRecord(record);
    setIsModalOpen(true);
  };

  const gpsColumns = [
    { key: 'fecha', label: 'Fecha', render: (r: any) => formatDate(r.fecha) },
    { key: 'jugador', label: 'Jugador', render: (r: any) => {
      const j = jugadores.find(x => x.id === r.jugador_id);
      return j?.full_name || 'Desconocido';
    }},
    { key: 'sessionLabel', label: 'Sesión' },
    { key: 'distancia_total', label: 'Dist. Total' },
    { key: 'velocidad_maxima', label: 'Vel. Máx' }
  ];

  const allHistoryData = [...gpsRecords].map(g => {
    const session = g.session_type === 'entrenamiento'
      ? entrenamientos.find(e => e.id === g.session_id)
      : partidos.find(p => p.id === g.session_id);
    const fecha = session?.date || session?.fecha || g.created_at;
    return {
      ...g,
      fecha,
      sessionLabel: g.session_type === 'entrenamiento' ? 'Entrenamiento' : 'Partido'
    };
  }).sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  const handleDownloadPDF = () => {
    const element = document.getElementById('pdf-gps-player-container');
    if (!element || !selectedJugador) return;

    const filename = `Reporte_GPS_${selectedJugador.full_name.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    const opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleDownloadSessionPDF = () => {
    const element = document.getElementById('pdf-gps-session-container');
    if (!element || !selectedSession) return;

    const filename = `Reporte_GPS_Sesion_${selectedSession.label.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    const opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  const handleDownloadPlayerSessionPDF = () => {
    const element = document.getElementById('pdf-gps-player-session-container');
    if (!element || !selectedJugador || !selectedPlayerRecord) return;
    const sessionLabel = playerSessions.find(s => s.id === playerSessionId)?.label || 'Sesion';
    const filename = `Reporte_GPS_${selectedJugador.full_name.replace(/\s+/g, '_')}_Sesion_${sessionLabel.replace(/\s+/g, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;

    const opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'landscape' as const }
    };

    html2pdf().set(opt).from(element).save();
  };

  return (
    <div className="space-y-6">
      {/* Pestañas de Equipo */}
      {(user?.role_id === 1 || user?.role_id === 4 || (user?.role_id === 2 && user?.team_category === 'Primer Equipo')) && (
        <div className="flex bg-brand-black-card border-b border-brand-black-border mb-2">
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${plantilla === 'Primer Equipo' ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
            onClick={() => { setPlantilla('Primer Equipo'); setJugadorId(''); }}
          >
            Primer Equipo
          </button>
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${plantilla === 'Juvenil' ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
            onClick={() => { setPlantilla('Juvenil'); setJugadorId(''); }}
          >
            Juvenil
          </button>
        </div>
      )}

      {/* Mode toggle */}
      <div className="flex bg-brand-black border border-brand-black-border p-1 rounded-lg w-fit">
        <button
          className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
            viewMode === 'player' ? 'bg-brand-red-600 text-white shadow-glow-red' : 'text-brand-gray-muted hover:text-white'
          }`}
          onClick={() => setViewMode('player')}
        >
          Evolución por Jugador
        </button>
        <button
          className={`px-4 py-1.5 rounded-md text-xs font-bold transition-all ${
            viewMode === 'session' ? 'bg-brand-red-600 text-white shadow-glow-red' : 'text-brand-gray-muted hover:text-white'
          }`}
          onClick={() => setViewMode('session')}
        >
          Por Sesión (Entr. / Partido)
        </button>
      </div>

      <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl flex flex-wrap gap-4 items-end">
        {viewMode === 'player' ? (
          <>
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Jugador</label>
              <PlayerSelect 
                jugadores={jugadoresOrdenados} 
                value={jugadorId} 
                onChange={setJugadorId} 
              />
            </div>

            {jugadorId && (
              <div className="flex-1 min-w-[240px]">
                <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Sesión / Fecha</label>
                <select 
                  className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light text-sm rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2.5 outline-none" 
                  value={playerSessionId} 
                  onChange={e => setPlayerSessionId(e.target.value)}
                >
                  <option value="todos">Historial Completo (Evolución)</option>
                  {playerSessions.map(s => (
                    <option key={s.id} value={s.id}>{s.label}</option>
                  ))}
                </select>
              </div>
            )}

            {playerSessionId === 'todos' && (
              <>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Métrica</label>
                  <select className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light text-sm rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2.5 outline-none" value={metric} onChange={e => setMetric(e.target.value)}>
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
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex-1 min-w-[240px]">
              <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Seleccionar Sesión GPS</label>
              <select
                className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light text-sm rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2.5 outline-none"
                value={selectedSessionId}
                onChange={e => setSelectedSessionId(e.target.value)}
              >
                <option value="">-- Seleccionar Sesión --</option>
                {sessionsWithGps.map(s => (
                  <option key={s.id} value={s.id}>{s.label}</option>
                ))}
              </select>
            </div>

            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-brand-gray-muted uppercase tracking-wider mb-2">Métrica a Comparar</label>
              <select className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light text-sm rounded-lg focus:ring-brand-red-600 focus:border-brand-red-600 p-2.5 outline-none" value={metric} onChange={e => setMetric(e.target.value)}>
                {METRICS.map(m => <option key={m.key} value={m.key}>{m.label}</option>)}
              </select>
            </div>
          </>
        )}

        <div className="ml-auto flex gap-2">
          {viewMode === 'player' && jugadorId && hasData && (
            playerSessionId === 'todos' ? (
              <button
                onClick={handleDownloadPDF}
                className="flex items-center gap-2 bg-brand-black-hover border border-brand-black-border text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-gray-dark transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exportar PDF</span>
              </button>
            ) : (
              <button
                onClick={handleDownloadPlayerSessionPDF}
                className="flex items-center gap-2 bg-brand-black-hover border border-brand-black-border text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-gray-dark transition-colors"
              >
                <Download className="w-4 h-4" />
                <span>Exportar PDF</span>
              </button>
            )
          )}
          {viewMode === 'session' && selectedSessionId && sessionRecords.length > 0 && (
            <button
              onClick={handleDownloadSessionPDF}
              className="flex items-center gap-2 bg-brand-black-hover border border-brand-black-border text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-gray-dark transition-colors"
            >
              <Download className="w-4 h-4" />
              <span>Exportar PDF</span>
            </button>
          )}
          {hasPermission('pf', 'editar') && (
            <button
              onClick={() => {
                setEditingGpsRecord(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-brand-red-600 text-white px-4 py-2.5 rounded-lg text-sm font-semibold hover:bg-brand-red-700 transition-colors shadow-glow-red font-bold"
            >
              <Plus className="w-4 h-4" />
              <span>Añadir Registro GPS</span>
            </button>
          )}
        </div>
      </div>

      <GpsFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingGpsRecord(null);
        }}
        jugadores={jugadores}
        entrenamientos={entrenamientos}
        partidos={partidos}
        editData={editingGpsRecord}
      />

      {viewMode === 'player' ? (
        !jugadorId ? (
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
            <p className="text-brand-gray-muted">Selecciona un jugador para ver su evolución GPS.</p>
          </div>
        ) : !hasData ? (
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
            <p className="text-brand-gray-muted">No hay datos GPS con los filtros actuales.</p>
          </div>
        ) : playerSessionId !== 'todos' ? (
          <>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Radar comparisons and player card info */}
              <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 flex flex-col justify-between">
                <div>
                  <div className="flex items-center gap-4 border-b border-brand-black-border pb-4 mb-6">
                    <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-brand-red-600 shrink-0">
                      {selectedJugador?.photo_url ? (
                        <img src={selectedJugador.photo_url} alt={selectedJugador.nickname || selectedJugador.full_name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full bg-brand-black flex items-center justify-center text-xl font-bold text-brand-gray-muted">
                          {selectedJugador?.dorsal || '-'}
                        </div>
                      )}
                    </div>
                    <div>
                      <h3 className="text-base font-bold text-white leading-tight">
                        {selectedJugador?.dorsal ? `${selectedJugador.dorsal}. ` : ''}{selectedJugador?.nickname || selectedJugador?.full_name}
                      </h3>
                      <p className="text-xs text-brand-gray-muted mt-1">
                        {playerSessions.find(s => s.id === playerSessionId)?.label}
                      </p>
                    </div>
                  </div>

                  <h4 className="text-sm font-bold text-brand-gray-light mb-4 text-center">Comparativa vs Media Histórica</h4>
                  <div className="h-[300px] w-full flex justify-center">
                    <ResponsiveContainer width="100%" height="100%">
                      <RadarChart cx="50%" cy="50%" outerRadius="70%" data={singleSessionRadarData}>
                        <PolarGrid stroke="#333" />
                        <PolarAngleAxis dataKey="metric" tick={{ fill: '#888', fontSize: 10 }} />
                        <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fill: '#888', fontSize: 9 }} />
                        <Tooltip
                          formatter={(value, name, props) => {
                            const payload = props.payload;
                            if (name === 'Sesión Actual') {
                              return [`${payload.raw_val} (${value}%)`, name];
                            }
                            return [`${payload.raw_avg} (${value}%)`, name];
                          }}
                          contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 12, borderRadius: 6, color: '#fff' }}
                        />
                        <Legend wrapperStyle={{ fontSize: '11px' }} />
                        <Radar name="Sesión Actual" dataKey="Sesión Actual" stroke="#CC0000" fill="#CC0000" fillOpacity={0.4} />
                        <Radar name="Media Histórica" dataKey="Media Histórica" stroke="#2563EB" fill="#2563EB" fillOpacity={0.15} />
                      </RadarChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </div>

              {/* Grid of cards showing raw metrics */}
              <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
                <h4 className="text-sm font-bold text-white mb-4">Métricas de la Sesión</h4>
                <div className="grid grid-cols-3 gap-3">
                  {METRICS.map(m => {
                    const record = selectedPlayerRecord as any;
                    const val = record?.[m.key];
                    const avg = playerAverages[m.key];
                    
                    return (
                      <div key={m.key} className="bg-brand-black/30 border border-brand-black-border p-3 rounded-lg flex flex-col justify-between">
                        <div>
                          <span className="text-[10px] text-brand-gray-muted font-bold block uppercase tracking-wider truncate" title={m.label}>
                            {m.label.split(' (')[0]}
                          </span>
                          <div className="flex items-baseline gap-2 mt-1">
                            <span className="text-lg font-extrabold text-white">{val != null ? val : '—'}</span>
                            {m.label.includes('(') && (
                              <span className="text-[9px] text-brand-gray-muted">{m.label.split('(')[1].replace(')', '')}</span>
                            )}
                          </div>
                        </div>
                        <div className="flex justify-between items-center mt-3 pt-2 border-t border-brand-black-border/40 text-[10px]">
                          <span className="text-brand-gray-muted">Media:</span>
                          <span className="text-brand-gray-light font-medium">{avg ? avg.toFixed(1) : '—'}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </>
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
                <h3 className="text-lg font-bold text-white">
                  {selectedMetric?.label} — {selectedJugador?.full_name}
                </h3>
                <span className="text-xs bg-brand-black-border px-2 py-1 rounded text-brand-gray-light">{chartData.length} registros</span>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
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
                <MiniChart key={m.key} title={m.label} data={chartData} dataKey={m.key} color={m.color} />
              ))}
            </div>
          </>
        )
      ) : (
        !selectedSessionId ? (
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
            <p className="text-brand-gray-muted">Selecciona una sesión para comparar a los jugadores.</p>
          </div>
        ) : sessionRecords.length === 0 ? (
          <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-12 text-center">
            <p className="text-brand-gray-muted">No hay registros GPS registrados en esta sesión.</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-4">
              <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
                <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Jugadores Evaluados</div>
                <div className="text-2xl font-bold text-brand-red-600 mt-1">{sessionRecords.length}</div>
                <div className="text-xs text-brand-gray-muted mt-1">Con datos de GPS</div>
              </div>
              <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
                <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Máximo de la Sesión</div>
                <div className="text-2xl font-bold text-white mt-1">
                  {sessionMaxInfo?.value ?? '—'}
                </div>
                <div className="text-xs text-brand-gray-muted mt-1 truncate">
                  Logrado por {sessionMaxInfo?.playerName} ({selectedMetric?.label})
                </div>
              </div>
              <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
                <div className="text-xs font-medium text-brand-gray-muted uppercase tracking-wider">Media de la Sesión</div>
                <div className="text-2xl font-bold text-white mt-1">{sessionAvgValue}</div>
                <div className="text-xs text-brand-gray-muted mt-1">{selectedMetric?.label}</div>
              </div>
            </div>

            <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold text-white">
                  Comparativa de {selectedMetric?.label} — {selectedSession?.label}
                </h3>
                <span className="text-xs bg-brand-black-border px-2 py-1 rounded text-brand-gray-light">{sessionRecords.length} registros</span>
              </div>
              <div className="h-80 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sessionRecords} margin={{ top: 5, right: 20, left: 0, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#333" />
                    <XAxis dataKey="playerName" tick={{ fill: '#888', fontSize: 11 }} />
                    <YAxis tick={{ fill: '#888', fontSize: 11 }} />
                    <Tooltip
                      formatter={(v: any) => [v, selectedMetric?.label]}
                      contentStyle={{ backgroundColor: '#111', borderColor: '#333', fontSize: 12, borderRadius: 6, color: '#fff' }}
                    />
                    <Bar dataKey={metric} fill="#CC0000" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 overflow-hidden">
              <h3 className="text-sm font-bold text-white mb-4">Detalle General de la Sesión</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b border-brand-black-border text-brand-gray-muted uppercase font-bold">
                      <th className="py-2.5 px-3">Dorsal</th>
                      <th className="py-2.5 px-3">Jugador</th>
                      {METRICS.map(m => (
                        <th key={m.key} className="py-2.5 px-3 text-right">{m.label.split(' (')[0]}</th>
                      ))}
                      {hasPermission('pf', 'editar') && (
                        <th className="py-2.5 px-3 text-center">Acciones</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {sessionRecords.map(r => (
                      <tr key={r.id} className="border-b border-brand-black-border/40 hover:bg-brand-black/20 text-brand-gray-light">
                        <td className="py-3 px-3 font-semibold">{r.dorsal ?? '-'}</td>
                        <td className="py-3 px-3 text-white font-semibold">{r.playerName}</td>
                        {METRICS.map(m => (
                          <td key={m.key} className="py-3 px-3 text-right font-medium">
                            {r[m.key] != null ? r[m.key] : '—'}
                          </td>
                        ))}
                        {hasPermission('pf', 'editar') && (
                          <td className="py-3 px-3 text-center space-x-3">
                            <button onClick={() => handleEditGps(r)} className="text-brand-gray-muted hover:text-white transition-colors">
                              Editar
                            </button>
                            <button onClick={() => handleDelete(r.id)} className="text-brand-gray-muted hover:text-brand-red-600 transition-colors">
                              Eliminar
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </>
        )
      )}

      <PFHistoryList 
        title="Historial de Registros GPS"
        data={allHistoryData.slice(0, 50)}
        columns={gpsColumns}
        onDelete={handleDelete}
        onEdit={handleEditGps}
        hasPermission={hasPermission('pf', 'editar')}
      />

      {viewMode === 'player' && selectedJugador && hasData && (
        <div style={{ position: 'absolute', top: '-10000px', left: 0, zIndex: -1 }}>
          <div id="pdf-gps-player-container">
            <GPSPlayerPrintView
              jugador={selectedJugador}
              jugadorData={chartData}
              metrics={METRICS}
              selectedMetric={selectedMetric}
            />
          </div>
        </div>
      )}

      {viewMode === 'session' && selectedSession && sessionRecords.length > 0 && (
        <div style={{ position: 'absolute', top: '-10000px', left: 0, zIndex: -1 }}>
          <div id="pdf-gps-session-container">
            <GPSSessionPrintView
              session={selectedSession}
              records={sessionRecords}
              metrics={METRICS}
              selectedMetric={selectedMetric || null}
            />
          </div>
        </div>
      )}

      {viewMode === 'player' && selectedJugador && playerSessionId !== 'todos' && selectedPlayerRecord && (
        <div style={{ position: 'absolute', top: '-10000px', left: 0, zIndex: -1 }}>
          <div id="pdf-gps-player-session-container">
            <GPSPlayerSessionPrintView
              jugador={selectedJugador}
              record={selectedPlayerRecord}
              sessionLabel={playerSessions.find(s => s.id === playerSessionId)?.label || 'Sesión'}
              metrics={METRICS}
              radarData={singleSessionRadarData}
            />
          </div>
        </div>
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
  const queryClient = useQueryClient();
  const { showToast } = useToast();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFuerzaSession, setEditingFuerzaSession] = useState<any>(null);
  const [isEjercicioModalOpen, setIsEjercicioModalOpen] = useState(false);
  const [editingEjercicio, setEditingEjercicio] = useState<any>(null);
  const [viewingEjercicio, setViewingEjercicio] = useState<any>(null);
  const [plantilla, setPlantilla] = useState('primer_equipo');
  const [selectedSessionToPrint, setSelectedSessionToPrint] = useState<any>(null);

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

  const computeTagsCounts = () => {
    const tagCounts: Record<string, number> = {};
    let total = 0;
    const uniqueIds = [...new Set(entriesPlantilla.map(e => e.ejercicio_id))];
    uniqueIds.forEach(id => {
      const ex = catalogo.find(e => e.id === id);
      if (!ex || !ex.tags) return;
      ex.tags.forEach((t: string) => {
        tagCounts[t] = (tagCounts[t] || 0) + 1;
        total++;
      });
    });
    return { tagCounts, total };
  };
  
  const { tagCounts, total: totalTags } = computeTagsCounts();

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('fuerza_sesiones').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuerza_sesiones'] });
      queryClient.invalidateQueries({ queryKey: ['fuerza_sesion_ejercicios'] });
      showToast('success', 'Sesión de fuerza eliminada');
    },
    onError: () => {
      showToast('error', 'Error al eliminar la sesión');
    }
  });

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar esta sesión de fuerza?')) {
      deleteMutation.mutate(id);
    }
  };

  const deleteEjercicioMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ejercicios_fuerza').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ejercicios_fuerza'] });
      showToast('success', 'Ejercicio eliminado del catálogo');
    },
    onError: () => {
      showToast('error', 'Error al eliminar. Es posible que el ejercicio ya esté siendo usado en una sesión.');
    }
  });

  const handleDeleteEjercicio = (id: string) => {
    if (window.confirm('¿Estás seguro de que quieres eliminar este ejercicio del catálogo?')) {
      deleteEjercicioMutation.mutate(id);
    }
  };

  const handleEditEjercicio = (ejercicio: any) => {
    setEditingEjercicio(ejercicio);
    setIsEjercicioModalOpen(true);
  };

  const handleEditFuerza = (session: any) => {
    const ejercicios = sesionEjercicios.filter((se: any) => se.sesion_id === session.id).map((se: any) => se.ejercicio_id);
    setEditingFuerzaSession({ ...session, ejercicios });
    setIsModalOpen(true);
  };

  const fuerzaColumns = [
    { key: 'fecha', label: 'Fecha', render: (r: any) => formatDate(r.fecha) },
    { key: 'tipo', label: 'Tipo', render: (r: any) => r.tipo === 'repeticiones' ? 'Repeticiones' : 'Tabata' },
    { key: 'ejercicios', label: 'Nº Ejercicios', render: (r: any) => {
      return sesionEjercicios.filter((se: any) => se.sesion_id === r.id).length;
    }}
  ];

  const ejercicioColumns = [
    { key: 'nombre', label: 'Nombre' },
    { key: 'grupos', label: 'Grupos', render: (r: any) => (r.grupos || []).join(', ') },
    { key: 'tags', label: 'Tags', render: (r: any) => (r.tags || []).join(', ') },
    { key: 'zona', label: 'Zona', render: (r: any) => r.zona === 'ambos' ? 'Ambos' : r.zona === 'anterior' ? 'Anterior' : 'Posterior' },
    { key: 'tren', label: 'Tren', render: (r: any) => r.tren === 'full_body' ? 'Full Body' : r.tren === 'superior' ? 'Superior' : 'Inferior' }
  ];

  const historyData = [...sesionesPlantilla].sort((a, b) => new Date(b.fecha).getTime() - new Date(a.fecha).getTime());

  React.useEffect(() => {
    if (selectedSessionToPrint) {
      setTimeout(() => {
        const element = document.getElementById('pdf-fuerza-session-container');
        if (!element) return;
        
        const fecha = selectedSessionToPrint.fecha ? selectedSessionToPrint.fecha.split('T')[0] : 'fecha';
        const filename = `Sesion_Fuerza_${plantilla}_${fecha}.pdf`;
        
        const opt = {
          margin:       0,
          filename:     filename,
          image:        { type: 'jpeg' as const, quality: 0.98 },
          html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
          jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' as const },
        };

        html2pdf().set(opt).from(element).save().then(() => {
          setSelectedSessionToPrint(null);
        });
      }, 500);
    }
  }, [selectedSessionToPrint, plantilla]);

  const handlePrintSession = (session: any) => {
    setSelectedSessionToPrint(session);
  };

  const getEjerciciosParaImprimir = () => {
    if (!selectedSessionToPrint) return [];
    
    const sessionEntries = sesionEjercicios
      .filter(se => se.sesion_id === selectedSessionToPrint.id)
      .sort((a, b) => (a.orden || 0) - (b.orden || 0));

    return sessionEntries.map(se => {
      const catEj = catalogo.find(c => c.id === se.ejercicio_id) || {};
      return {
        ...se,
        ...catEj,
        id: se.id
      };
    });
  };

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
          <div className="flex gap-2">
            <button
              onClick={() => {
                setEditingEjercicio(null);
                setIsEjercicioModalOpen(true);
              }}
              className="flex items-center gap-2 bg-brand-black-hover border border-brand-black-border text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-gray-dark transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span>Nuevo Ejercicio</span>
            </button>
            <button
              onClick={() => {
                setEditingFuerzaSession(null);
                setIsModalOpen(true);
              }}
              className="flex items-center gap-2 bg-brand-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold hover:bg-brand-red-700 transition-colors shadow-glow-red"
            >
              <Plus className="w-4 h-4" />
              <span>Registrar Sesión</span>
            </button>
          </div>
        )}
      </div>

      <FuerzaFormModal
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setEditingFuerzaSession(null);
        }}
        catalogoEjercicios={catalogo}
        editData={editingFuerzaSession}
      />

      <EjercicioFuerzaFormModal 
        isOpen={isEjercicioModalOpen}
        onClose={() => {
          setIsEjercicioModalOpen(false);
          setEditingEjercicio(null);
        }}
        editData={editingEjercicio}
      />

      <EjercicioDetalleModal 
        isOpen={!!viewingEjercicio}
        onClose={() => setViewingEjercicio(null)}
        ejercicio={viewingEjercicio}
        sesiones={sesiones}
        sesionEjercicios={sesionEjercicios}
      />

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
        
        {/* Uso de Tags */}
        <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 shadow-sm md:col-span-1">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-8 h-8 rounded-lg bg-brand-red-600/10 flex items-center justify-center">
              <Activity className="w-4 h-4 text-brand-red-500" />
            </div>
            <div>
              <h3 className="text-white font-bold text-sm">Etiquetas (Tags)</h3>
              <p className="text-brand-gray-muted text-xs">Uso de tags manuales</p>
            </div>
          </div>
          
          <div className="space-y-4 max-h-[100px] overflow-y-auto pr-2 no-scrollbar">
            {Object.keys(tagCounts).length > 0 ? (
              Object.entries(tagCounts)
                .sort((a, b) => b[1] - a[1])
                .map(([tag, val]) => {
                  const pct = totalTags > 0 ? Math.round((val / totalTags) * 100) : 0;
                  return (
                    <div key={tag}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-brand-gray-light font-medium">{tag}</span>
                        <span className="text-brand-gray-muted font-bold">{pct}% ({val})</span>
                      </div>
                      <div className="h-1.5 w-full bg-brand-black-border rounded-full overflow-hidden">
                        <div 
                          className="h-full bg-brand-red-600 rounded-full"
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })
            ) : (
              <p className="text-xs text-brand-gray-muted text-center pt-8 italic">
                No hay tags registrados.
              </p>
            )}
          </div>
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

      <PFHistoryList 
        title="Catálogo de Ejercicios Creados"
        data={catalogo}
        columns={ejercicioColumns}
        onDelete={handleDeleteEjercicio}
        onEdit={handleEditEjercicio}
        onRowClick={(row) => setViewingEjercicio(row)}
        hasPermission={hasPermission('pf', 'editar')}
      />

      <PFHistoryList 
        title="Historial de Sesiones de Fuerza"
        data={historyData.slice(0, 50)}
        columns={fuerzaColumns}
        onDelete={handleDelete}
        onEdit={handleEditFuerza}
        onPrint={handlePrintSession}
        hasPermission={hasPermission('pf', 'editar')}
      />

      {/* Hidden Print View */}
      {selectedSessionToPrint && (
        <div style={{ position: 'absolute', top: '-10000px', left: 0, zIndex: -1 }}>
          <div id="pdf-fuerza-session-container">
            <FuerzaSessionPrintView
              session={selectedSessionToPrint}
              ejercicios={getEjerciciosParaImprimir()}
            />
          </div>
        </div>
      )}
    </div>
  );
}
