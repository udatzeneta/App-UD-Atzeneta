import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { useAuth } from '../context/AuthContext';
import { StatsSkeleton } from '../components/Skeletons';
import { 
  Dumbbell, Trophy, ShieldAlert, Award, Calendar as CalendarIcon, 
  MapPin, Clock, ArrowRight
} from 'lucide-react';
import { Link } from 'react-router-dom';

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Consultar datos con React Query
  const { data: trainings = [], isLoading: loadingTrainings } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings()
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches()
  });

  const { data: fines = [], isLoading: loadingFines } = useQuery({
    queryKey: ['fines'],
    queryFn: () => dataService.getFines()
  });

  const { data: points = [], isLoading: loadingPoints } = useQuery({
    queryKey: ['points'],
    queryFn: () => dataService.getPoints()
  });

  const isLoading = loadingTrainings || loadingMatches || loadingFines || loadingPoints;

  // Filtrar datos por mes/año seleccionado para las estadísticas
  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  // 1. Estadísticas de Entrenamientos
  const totalTrainings = trainings.length;
  const monthlyTrainings = trainings.filter(t => filterByDate(t.date)).length;

  // 2. Estadísticas de Partidos
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.status === 'Jugado' && m.score_us !== null && m.score_them !== null && m.score_us > m.score_them).length;
  const draws = matches.filter(m => m.status === 'Jugado' && m.score_us !== null && m.score_them !== null && m.score_us === m.score_them).length;
  const losses = matches.filter(m => m.status === 'Jugado' && m.score_us !== null && m.score_them !== null && m.score_us < m.score_them).length;

  // 3. Estadísticas de Multas
  const totalFinesAmount = fines.reduce((acc, f) => acc + Number(f.amount), 0);
  const monthlyFinesAmount = fines.filter(f => filterByDate(f.date)).reduce((acc, f) => acc + Number(f.amount), 0);

  // 4. Estadísticas de Puntos
  // Si es jugador, mostramos solo sus puntos. Si es admin/entrenador, mostramos el acumulado global de todos.
  const isPlayer = user?.role_id === 3;
  const userPointsList = points.filter(p => !isPlayer || p.user_id === user.id);
  const totalPoints = userPointsList.reduce((acc, p) => acc + p.points, 0);
  const monthlyPoints = userPointsList.filter(p => filterByDate(p.date)).reduce((acc, p) => acc + p.points, 0);

  // Próximos eventos (Próximos 4 días/semanas ordenados por fecha)
  const todayStr = new Date().toISOString().split('T')[0];
  
  const upcomingTrainings = trainings
    .filter(t => t.date >= todayStr && t.status === 'Programado')
    .map(t => ({ ...t, type: 'entrenamiento' as const }));

  const upcomingMatches = matches
    .filter(m => m.date >= todayStr && m.status === 'Programado')
    .map(m => ({ ...m, type: 'partido' as const }));

  const upcomingEvents = [...upcomingTrainings, ...upcomingMatches]
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 3);

  // Actividad Reciente (Últimos 4 registros creados de Fines o Puntos)
  const recentFines = fines.slice(0, 3).map(f => ({
    id: f.id,
    type: 'fine' as const,
    title: `Multa aplicada: ${f.profiles?.full_name || 'Jugador'}`,
    description: `${f.reason} - €${f.amount}`,
    date: f.date,
    icon: ShieldAlert,
    iconColor: 'text-brand-red-600 bg-brand-red-600/10'
  }));

  const recentPoints = points.slice(0, 3).map(p => ({
    id: p.id,
    type: 'points' as const,
    title: `${p.points > 0 ? 'Puntos sumados' : 'Puntos restados'}: ${p.profiles?.full_name || 'Jugador'}`,
    description: `${p.reason} (${p.points > 0 ? '+' : ''}${p.points} pts)`,
    date: p.date,
    icon: Award,
    iconColor: p.points > 0 ? 'text-emerald-500 bg-emerald-500/10' : 'text-amber-500 bg-amber-500/10'
  }));

  const recentActivity = [...recentFines, ...recentPoints]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 4);

  // Meses para el selector
  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' },
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="h-10 w-48 bg-brand-black-border rounded animate-pulse"></div>
        <StatsSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
          <div className="h-64 bg-brand-black-card border border-brand-black-border rounded-xl animate-pulse"></div>
          <div className="h-64 bg-brand-black-card border border-brand-black-border rounded-xl animate-pulse"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Cabecera del Dashboard */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Resumen del Club</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Hola, <span className="text-brand-gray-light font-medium">{user?.full_name}</span>. Vista general del UD Atzeneta.
          </p>
        </div>

        {/* Filtro mensual global */}
        <div className="flex items-center gap-2 bg-brand-black border border-brand-black-border p-1.5 rounded-lg shrink-0 w-fit">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-xs text-brand-gray-light px-2 py-1 focus:ring-0 border-none rounded cursor-pointer"
          >
            {months.map(m => (
              <option key={m.value} value={m.value} className="bg-brand-black-card text-brand-gray-light">{m.label}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-xs text-brand-gray-light px-2 py-1 focus:ring-0 border-none rounded cursor-pointer"
          >
            <option value={2026} className="bg-brand-black-card text-brand-gray-light">2026</option>
            <option value={2025} className="bg-brand-black-card text-brand-gray-light">2025</option>
          </select>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Principales (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Entrenamientos */}
        <div className="dashboard-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Entrenamientos</span>
            <Dumbbell className="w-5 h-5 text-brand-red-600 bg-brand-red-600/10 p-1 rounded" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-brand-gray-light">{monthlyTrainings}</h3>
            <p className="text-xs text-brand-gray-muted mt-1">
              En este mes ({totalTrainings} acumulado)
            </p>
          </div>
        </div>

        {/* KPI 2: Partidos */}
        <div className="dashboard-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Partidos de Liga</span>
            <Trophy className="w-5 h-5 text-yellow-500 bg-yellow-500/10 p-1 rounded" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-brand-gray-light">
              {wins}V - {draws}E - {losses}D
            </h3>
            <p className="text-xs text-brand-gray-muted mt-1">
              Récord global de temporada ({totalMatches} partidos)
            </p>
          </div>
        </div>

        {/* KPI 3: Multas */}
        <div className="dashboard-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Importe de Multas</span>
            <ShieldAlert className="w-5 h-5 text-brand-red-600 bg-brand-red-600/10 p-1 rounded" />
          </div>
          <div className="mt-4">
            <h3 className="text-2xl font-bold text-brand-red-600">
              {monthlyFinesAmount.toFixed(2)} €
            </h3>
            <p className="text-xs text-brand-gray-muted mt-1">
              Este mes ({totalFinesAmount.toFixed(2)} € total)
            </p>
          </div>
        </div>

        {/* KPI 4: Casillero de Puntos */}
        <div className="dashboard-card flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">
              {isPlayer ? 'Mis Puntos' : 'Puntos del Vestuario'}
            </span>
            <Award className="w-5 h-5 text-emerald-500 bg-emerald-500/10 p-1 rounded" />
          </div>
          <div className="mt-4">
            <h3 className={`text-2xl font-bold ${totalPoints >= 0 ? 'text-emerald-500' : 'text-brand-red-600'}`}>
              {totalPoints > 0 ? '+' : ''}{totalPoints} pts
            </h3>
            <p className="text-xs text-brand-gray-muted mt-1">
              {monthlyPoints > 0 ? '+' : ''}{monthlyPoints} pts este mes
            </p>
          </div>
        </div>
      </div>

      {/* Paneles Secundarios: Próximos Eventos & Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Próximos Eventos (7 cols) */}
        <div className="dashboard-card lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b border-brand-black-border pb-4 mb-4">
              <h3 className="text-sm font-semibold text-brand-gray-light">Próximos Eventos</h3>
              <CalendarIcon className="w-4 h-4 text-brand-gray-muted" />
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-sm text-brand-gray-muted">No hay eventos programados próximamente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((evt) => (
                  <div key={evt.id} className="flex gap-4 p-3 bg-brand-black-hover/40 border border-brand-black-border rounded-lg items-center">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${
                      evt.type === 'entrenamiento' ? 'bg-brand-red-600/10 text-brand-red-600' : 'bg-yellow-500/10 text-yellow-500'
                    }`}>
                      {evt.type === 'entrenamiento' ? <Dumbbell className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <h4 className="text-xs font-semibold text-brand-gray-light truncate">
                          {evt.type === 'entrenamiento' ? `Entrenamiento: ${evt.objective || 'Táctico'}` : `Partido vs ${evt.rival}`}
                        </h4>
                        <span className="text-[10px] bg-brand-black-border text-brand-gray-muted px-2 py-0.5 rounded font-semibold shrink-0">
                          {evt.date}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-1.5 text-[11px] text-brand-gray-muted">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 shrink-0" /> {evt.type === 'entrenamiento' ? (evt as any).time : 'Hora a confirmar'}</span>
                        <span className="flex items-center gap-1 truncate">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-brand-red-600" />
                          {evt.type === 'entrenamiento' ? (
                            <a
                              href={(evt as any).location.startsWith('http') ? (evt as any).location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((evt as any).location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-red-600 hover:underline transition-colors"
                              title="Ver ubicación en Google Maps"
                            >
                              {(evt as any).location}
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((evt as any).is_local ? '6R7J+Q2 Adzaneta' : 'Campo Rival')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-red-600 hover:underline transition-colors"
                              title="Ver ubicación en Google Maps"
                            >
                              {((evt as any).is_local ? 'El Porrejat (6R7J+Q2 Adzaneta)' : 'Campo Rival')}
                            </a>
                          )}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          <div className="border-t border-brand-black-border pt-4 mt-6">
            <Link to="/calendar" className="text-xs font-medium text-brand-red-600 hover:text-brand-red-700 flex items-center gap-1.5 w-fit">
              Ver calendario completo <ArrowRight className="w-3 h-3" />
            </Link>
          </div>
        </div>

        {/* Actividad Reciente (5 cols) */}
        <div className="dashboard-card lg:col-span-5">
          <div className="flex items-center justify-between border-b border-brand-black-border pb-4 mb-4">
            <h3 className="text-sm font-semibold text-brand-gray-light">Registro de Actividad</h3>
            <span className="text-[10px] bg-brand-red-600/10 text-brand-red-600 border border-brand-red-600/20 px-2 py-0.5 rounded-full font-semibold">
              Tiempo real
            </span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-brand-gray-muted">No se registran actividades recientes en el vestuario.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentActivity.map((act) => {
                const ActIcon = act.icon;
                return (
                  <div key={act.id} className="flex gap-3 items-start">
                    <div className={`p-1.5 rounded-lg shrink-0 mt-0.5 ${act.iconColor}`}>
                      <ActIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-semibold text-brand-gray-light leading-none truncate">{act.title}</h4>
                        <span className="text-[9px] text-brand-gray-dark shrink-0">{act.date}</span>
                      </div>
                      <p className="text-[11px] text-brand-gray-muted mt-1 leading-tight">{act.description}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
