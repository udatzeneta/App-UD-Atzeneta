import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { StatsSkeleton } from '../components/Skeletons';
import { 
  Dumbbell, Trophy, ShieldAlert, Award, Calendar as CalendarIcon, 
  MapPin, Clock, ArrowRight, Activity, TrendingUp, TrendingDown,
  Sparkles, CalendarRange, X, Search
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { Fine } from '../types';

export const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();

  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  // Estados para el panel de Multas Rápidas
  const [isQuickFineOpen, setIsQuickFineOpen] = useState(false);
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<string[]>([]);
  const [playerSearch, setPlayerSearch] = useState('');
  const [fineDate, setFineDate] = useState(new Date().toISOString().split('T')[0]);
  const [activeTab, setActiveTab] = useState<'multa' | 'pago'>('multa');
  const [selectedReason, setSelectedReason] = useState('');
  const [selectedAmount, setSelectedAmount] = useState<number>(0);
  const [minutesOfDelay, setMinutesOfDelay] = useState<number>(15);
  const [accessoryCount, setAccessoryCount] = useState<number>(1);
  const [isCustomReason, setIsCustomReason] = useState(false);
  const [customReasonText, setCustomReasonText] = useState('');
  const [customAmountVal, setCustomAmountVal] = useState('10.00');
  const [fineStatus, setFineStatus] = useState<'Pendiente' | 'Pagado'>('Pendiente');

  const canManageFines = hasPermission('fines', 'crear');

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

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => authService.getProfiles(),
    enabled: canManageFines
  });

  const isLoading = loadingTrainings || loadingMatches || loadingFines || loadingPoints || (loadingProfiles && canManageFines);

  // Tipos de multa predefinidos
  const quickFineTypes = [
    { label: 'No Avisar Asistencia', amount: 3 },
    { label: 'Retraso sin Aviso (1€/min)', amount: 1 },
    { label: 'Ropa Inadecuada', amount: 5 },
    { label: 'Olvido Camiseta Partido', amount: 10 },
    { label: 'Olvido Pantalón Partido', amount: 5 },
    { label: 'Olvido Accesorios (1€ por prenda)', amount: 1 },
    { label: 'Tarjeta Amarilla', amount: 10 },
    { label: 'Tarjeta Roja', amount: 30 },
    { label: 'Chat Inapropiado', amount: 1 },
    { label: 'No Contestar Forms', amount: 2 },
    { label: 'No Visualizar Partido', amount: 1 },
    { label: 'Apuesta CT', amount: 10 },
    { label: 'Apuesta con CT perdida', amount: 10 },
  ];

  // Importes de pago rápido
  const quickPaymentAmounts = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50];

  // Mutación para creación múltiple de multas/pagos
  const createFineMutation = useMutation({
    mutationFn: async (payloads: Omit<Fine, 'id'>[]) => {
      const promises = payloads.map(payload => dataService.createFine(payload));
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['points'] });
      showToast('success', 'Operación registrada', `Se han guardado correctamente las ${data.length} transacciones.`);
      
      // Limpiar formulario y cerrar panel
      setSelectedPlayerIds([]);
      setSelectedReason('');
      setSelectedAmount(0);
      setCustomReasonText('');
      setCustomAmountVal('10.00');
      setIsCustomReason(false);
      setIsQuickFineOpen(false);
    },
    onError: (err: any) => {
      showToast('error', 'Error de registro', err.message || 'Ocurrió un error al procesar las multas.');
    }
  });

  const handleSaveQuickFines = () => {
    if (selectedPlayerIds.length === 0) return;

    let finalReason = '';
    let finalAmount = 0;

    if (isCustomReason) {
      finalReason = customReasonText.trim();
      finalAmount = Number(customAmountVal) || 0;
      if (!finalReason) {
        showToast('error', 'Validación', 'El motivo detallado es obligatorio.');
        return;
      }
      if (finalAmount <= 0) {
        showToast('error', 'Validación', 'El importe debe ser mayor a 0€.');
        return;
      }
    } else {
      if (selectedReason === 'Retraso sin Aviso (1€/min)') {
        finalReason = `Retraso sin Aviso (${minutesOfDelay} min)`;
        finalAmount = minutesOfDelay * 1;
      } else if (selectedReason === 'Olvido Accesorios (1€ por prenda)') {
        finalReason = `Olvido Accesorios (${accessoryCount} prendas)`;
        finalAmount = accessoryCount * 1;
      } else {
        finalReason = selectedReason;
        finalAmount = selectedAmount;
      }
    }

    if (!finalReason) {
      showToast('error', 'Validación', 'Selecciona o escribe una descripción.');
      return;
    }

    const payloads = selectedPlayerIds.map(userId => ({
      user_id: userId,
      date: fineDate,
      reason: finalReason,
      amount: finalAmount,
      status: fineStatus
    }));

    createFineMutation.mutate(payloads);
  };

  // Filtrar datos por mes/año seleccionado para las estadísticas (robusto ante timezones)
  const filterByDate = (dateStr: string) => {
    if (!dateStr) return false;
    const parts = dateStr.split('-');
    if (parts.length >= 2) {
      const year = parseInt(parts[0], 10);
      const month = parseInt(parts[1], 10);
      return month === selectedMonth && year === selectedYear;
    }
    const d = new Date(dateStr);
    return d.getUTCMonth() + 1 === selectedMonth && d.getUTCFullYear() === selectedYear;
  };

  // Filtrar perfiles aptos (Jugadores y Entrenadores)
  const sortedProfiles = [...profiles]
    .filter(p => p.role_id === 3 || p.role_id === 2)
    .sort((a, b) => a.full_name.localeCompare(b.full_name));

  // 1. Estadísticas de Entrenamientos
  const totalTrainings = trainings.length;
  const monthlyTrainings = trainings.filter(t => filterByDate(t.date)).length;

  // 2. Estadísticas de Partidos
  const totalMatches = matches.length;
  const wins = matches.filter(m => m.status === 'Jugado' && m.score_us !== null && m.score_them !== null && m.score_us > m.score_them).length;
  const draws = matches.filter(m => m.status === 'Jugado' && m.score_us !== null && m.score_them !== null && m.score_us === m.score_them).length;
  const losses = matches.filter(m => m.status === 'Jugado' && m.score_us !== null && m.score_them !== null && m.score_us < m.score_them).length;

  // Estadísticas adicionales deportivas para la cabecera
  const playedMatches = matches.filter(m => m.status === 'Jugado').length;
  const winRate = playedMatches > 0 ? Math.round((wins / playedMatches) * 100) : 0;
  const goalsScored = matches.filter(m => m.status === 'Jugado' && m.score_us !== null).reduce((acc, m) => acc + Number(m.score_us), 0);
  const goalsConceded = matches.filter(m => m.status === 'Jugado' && m.score_them !== null).reduce((acc, m) => acc + Number(m.score_them), 0);

  // 3. Estadísticas de Multas
  const totalFinesAmount = fines.reduce((acc, f) => acc + Number(f.amount), 0);
  const monthlyFinesAmount = fines.filter(f => filterByDate(f.date)).reduce((acc, f) => acc + Number(f.amount), 0);

  // 4. Estadísticas de Puntos
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
        <div className="h-24 w-full bg-brand-black-card border border-brand-black-border rounded-2xl animate-pulse"></div>
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
      {/* Hero Banner de Bienvenida del Club */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-brand-red-950/70 via-brand-black-card to-brand-black border border-brand-black-border p-6 sm:p-8 shadow-premium">
        {/* Glow de fondo decorativo */}
        <div className="absolute top-[-50%] right-[-10%] w-[350px] h-[350px] bg-brand-red-600/10 rounded-full blur-[80px] pointer-events-none" />
        <div className="absolute bottom-[-50%] left-[-10%] w-[250px] h-[250px] bg-emerald-500/5 rounded-full blur-[60px] pointer-events-none" />

        <div className="relative flex flex-col md:flex-row items-center justify-between gap-6 z-10">
          <div className="flex flex-col sm:flex-row items-center gap-5 text-center sm:text-left">
            {/* Escudo del club con glow */}
            <div className="relative p-1.5 bg-brand-black-card border border-brand-red-600/30 rounded-2xl shadow-glow-red hover:border-brand-red-600/65 transition-all duration-300 transform hover:scale-105">
              <img 
                src="/club-logo.png" 
                alt="Escudo UD Atzeneta" 
                className="w-16 h-16 sm:w-20 sm:h-20 object-contain"
              />
            </div>
            <div>
              <div className="flex items-center justify-center sm:justify-start gap-2">
                <span className="text-[10px] bg-brand-red-600/10 text-brand-red-400 border border-brand-red-600/20 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex items-center gap-1">
                  <Sparkles className="w-3 h-3" /> UD Atzeneta 1947
                </span>
                <span className="text-[10px] bg-brand-black-border text-brand-gray-muted px-2 py-0.5 rounded-full font-semibold">
                  Temporada 2025/2026
                </span>
              </div>
              <h2 className="text-2xl sm:text-3xl font-extrabold text-brand-gray-light mt-2 tracking-tight">
                ¡Hola, <span className="bg-gradient-to-r from-brand-gray-light via-brand-gray-light to-brand-red-400 bg-clip-text text-transparent">{user?.full_name}</span>!
              </h2>
              <p className="text-xs sm:text-sm text-brand-gray-muted mt-1 max-w-md">
                Bienvenido al portal interno del club. Aquí tienes el estado actual y rendimiento de la plantilla.
              </p>
              
              {/* Botón Acceso Rápido Sanción / Pago */}
              {canManageFines && (
                <button 
                  onClick={() => setIsQuickFineOpen(!isQuickFineOpen)}
                  className="mt-4 btn-primary py-2 px-3.5 text-xs font-bold flex items-center gap-2 bg-brand-red-600/90 hover:bg-brand-red-600 border border-brand-red-600/30 transition-all hover:scale-[1.02] shadow-glow-red"
                >
                  <ShieldAlert className="w-4 h-4" />
                  {isQuickFineOpen ? 'Cerrar Gestor Rápido' : 'Multa / Pago Rápido'}
                </button>
              )}
            </div>
          </div>

          {/* Estadísticas de Rendimiento Rápido */}
          <div className="flex flex-wrap gap-4 justify-center md:justify-end w-full md:w-auto">
            <div className="bg-brand-black/60 border border-brand-black-border p-3.5 rounded-xl text-center min-w-[100px] hover:border-brand-red-600/20 transition-colors">
              <div className="text-[10px] text-brand-gray-muted font-semibold uppercase tracking-wider">Victorias</div>
              <div className="text-xl font-bold text-yellow-500 mt-1">{winRate}%</div>
              <div className="text-[9px] text-brand-gray-dark mt-0.5">Win Rate Liga</div>
            </div>
            <div className="bg-brand-black/60 border border-brand-black-border p-3.5 rounded-xl text-center min-w-[100px] hover:border-brand-red-600/20 transition-colors">
              <div className="text-[10px] text-brand-gray-muted font-semibold uppercase tracking-wider">Goles</div>
              <div className="text-xl font-bold text-emerald-400 mt-1">{goalsScored}:{goalsConceded}</div>
              <div className="text-[9px] text-brand-gray-dark mt-0.5">Favor vs Contra</div>
            </div>
            <div className="bg-brand-black/60 border border-brand-black-border p-3.5 rounded-xl text-center min-w-[100px] hover:border-brand-red-600/20 transition-colors">
              <div className="text-[10px] text-brand-gray-muted font-semibold uppercase tracking-wider">Próximo</div>
              <div className="text-xs font-bold text-brand-gray-light mt-2 truncate max-w-[120px]">
                {upcomingMatches[0] ? `vs ${(upcomingMatches[0] as any).rival}` : 'Ninguno'}
              </div>
              <div className="text-[9px] text-brand-gray-dark mt-0.5">Calendario</div>
            </div>
          </div>
        </div>
      </div>

      {/* Widget Interactivo de Multas y Pagos Rápidos */}
      {isQuickFineOpen && canManageFines && (
        <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-6 shadow-premium relative animate-slide-up overflow-hidden">
          {/* Luz de fondo en el panel */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red-600/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex justify-between items-center border-b border-brand-black-border pb-3 mb-5">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-brand-red-600" />
              <h3 className="text-sm font-bold text-brand-gray-light uppercase tracking-wider">Gestión de Sanciones y Abonos Rápidos</h3>
            </div>
            <button 
              onClick={() => setIsQuickFineOpen(false)} 
              className="text-brand-gray-muted hover:text-brand-gray-light p-1 rounded-lg"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            
            {/* Columna Izquierda: Selección de Jugadores/Entrenadores */}
            <div className="lg:col-span-5 flex flex-col space-y-3">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-semibold text-brand-gray-muted uppercase tracking-wider">
                  Destinatarios Seleccionados ({selectedPlayerIds.length})
                </label>
                <div className="flex gap-2">
                  <button 
                    type="button" 
                    onClick={() => setSelectedPlayerIds(sortedProfiles.map(p => p.id))}
                    className="text-[10px] text-brand-red-400 hover:underline"
                  >
                    Seleccionar Todos
                  </button>
                  <span className="text-brand-gray-dark">|</span>
                  <button 
                    type="button" 
                    onClick={() => setSelectedPlayerIds([])}
                    className="text-[10px] text-brand-gray-muted hover:underline"
                  >
                    Limpiar
                  </button>
                </div>
              </div>

              {/* Buscador de jugadores */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 w-3.5 h-3.5 text-brand-gray-dark" />
                <input
                  type="text"
                  placeholder="Buscar jugador o míster..."
                  className="w-full bg-brand-black/40 border border-brand-black-border rounded-lg pl-9 pr-3 py-1.5 text-xs text-brand-gray-light placeholder:text-brand-gray-dark focus:ring-1 focus:ring-brand-red-600 focus:border-brand-red-600"
                  value={playerSearch}
                  onChange={(e) => setPlayerSearch(e.target.value)}
                />
              </div>

              {/* Lista scrollable de perfiles */}
              <div className="bg-brand-black/30 border border-brand-black-border rounded-xl p-3 max-h-60 overflow-y-auto space-y-2 no-scrollbar">
                {sortedProfiles.filter(p => p.full_name.toLowerCase().includes(playerSearch.toLowerCase())).length === 0 ? (
                  <p className="text-center text-xs text-brand-gray-dark py-6">No se encontraron perfiles.</p>
                ) : (
                  sortedProfiles
                    .filter(p => p.full_name.toLowerCase().includes(playerSearch.toLowerCase()))
                    .map((p) => {
                      const isSelected = selectedPlayerIds.includes(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => {
                            setSelectedPlayerIds(prev => 
                              prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id]
                            );
                          }}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border transition-all text-left ${
                            isSelected 
                              ? activeTab === 'multa'
                                ? 'bg-brand-red-600/10 border-brand-red-600/30'
                                : 'bg-emerald-500/10 border-emerald-500/30'
                              : 'bg-brand-black-card/30 border-transparent hover:bg-brand-black-hover/40'
                          }`}
                        >
                          <div className="flex items-center gap-2.5">
                            <img 
                              src={p.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} 
                              alt={p.full_name} 
                              className="w-8 h-8 rounded-full border border-brand-black-border object-cover"
                            />
                            <div>
                              <h4 className="text-xs font-semibold text-brand-gray-light leading-none">{p.full_name}</h4>
                              <span className="text-[9px] text-brand-gray-muted mt-1 block">
                                {p.role_id === 2 ? 'Entrenador (Míster)' : `Jugador • Dorsal ${p.dorsal || '-'}`}
                              </span>
                            </div>
                          </div>
                          <div className={`w-4 h-4 rounded-full border flex items-center justify-center transition-all ${
                            isSelected 
                              ? activeTab === 'multa'
                                ? 'bg-brand-red-600 border-brand-red-600 text-white'
                                : 'bg-emerald-500 border-emerald-500 text-white'
                              : 'border-brand-black-border'
                          }`}>
                            {isSelected && <span className="text-[9px] font-bold">✓</span>}
                          </div>
                        </button>
                      );
                    })
                )}
              </div>
            </div>

            {/* Columna Derecha: Configurar Multa o Pago */}
            <div className="lg:col-span-7 flex flex-col space-y-4">
              
              {/* Tabs de tipo de operación */}
              <div className="flex bg-brand-black border border-brand-black-border p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => { setActiveTab('multa'); setFineStatus('Pendiente'); setSelectedReason(''); setSelectedAmount(0); setIsCustomReason(false); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'multa' 
                      ? 'bg-brand-red-600 text-white shadow-glow-red' 
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  <ShieldAlert className="w-3.5 h-3.5" />
                  Sanciones (Multas)
                </button>
                <button
                  type="button"
                  onClick={() => { setActiveTab('pago'); setFineStatus('Pagado'); setSelectedReason('Abono de multa'); setSelectedAmount(0); setIsCustomReason(false); }}
                  className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
                    activeTab === 'pago' 
                      ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]' 
                      : 'text-brand-gray-muted hover:text-brand-gray-light'
                  }`}
                >
                  <Award className="w-3.5 h-3.5" />
                  Abonos (Pagos)
                </button>
              </div>

              {/* Opciones Comunes */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block mb-1">
                    Fecha del Registro
                  </label>
                  <input
                    type="date"
                    className="w-full bg-brand-black/40 border border-brand-black-border rounded-lg px-3 py-1.5 text-xs text-brand-gray-light focus:ring-1 focus:ring-brand-red-600"
                    value={fineDate}
                    onChange={(e) => setFineDate(e.target.value)}
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block mb-1">
                    Estado de Pago
                  </label>
                  <select
                    className="w-full bg-brand-black/40 border border-brand-black-border rounded-lg px-3 py-1.5 text-xs text-brand-gray-light focus:ring-1 focus:ring-brand-red-600"
                    value={fineStatus}
                    onChange={(e) => setFineStatus(e.target.value as any)}
                  >
                    <option value="Pendiente" className="bg-brand-black text-brand-gray-light">Pendiente</option>
                    <option value="Pagado" className="bg-brand-black text-brand-gray-light">Pagado</option>
                  </select>
                </div>
              </div>

              {/* Botones de Selección Rápida */}
              <div className="flex-1">
                {activeTab === 'multa' ? (
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block mb-2">
                      Seleccionar Infracción
                    </label>
                    <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
                      {quickFineTypes.map((ft) => (
                        <button
                          key={ft.label}
                          type="button"
                          onClick={() => {
                            setSelectedReason(ft.label);
                            setSelectedAmount(ft.amount);
                            setIsCustomReason(false);
                          }}
                          className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                            selectedReason === ft.label && !isCustomReason
                              ? 'bg-brand-red-600/20 text-brand-red-400 border-brand-red-600/50 shadow-[0_0_8px_rgba(193,18,31,0.1)]'
                              : 'bg-brand-black/40 text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light hover:border-brand-gray-dark'
                          }`}
                        >
                          {ft.label} ({ft.amount}€)
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReason('');
                          setIsCustomReason(true);
                        }}
                        className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                          isCustomReason
                            ? 'bg-brand-red-600/20 text-brand-red-400 border-brand-red-600/50'
                            : 'bg-brand-black/40 text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                        }`}
                      >
                        Otro Motivo / Importe
                      </button>
                    </div>

                    {/* Cálculos Dinámicos */}
                    {selectedReason === 'Retraso sin Aviso (1€/min)' && (
                      <div className="mt-3 bg-brand-black/30 border border-brand-black-border p-3 rounded-lg flex items-center justify-between gap-4 animate-fade-in">
                        <span className="text-[11px] text-brand-gray-muted">Introduce los minutos de retraso:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="240"
                            className="w-16 bg-brand-black border border-brand-black-border rounded px-2 py-1 text-xs text-brand-gray-light text-center focus:ring-1 focus:ring-brand-red-600"
                            value={minutesOfDelay}
                            onChange={(e) => setMinutesOfDelay(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <span className="text-xs text-brand-gray-light font-bold">minutos = {minutesOfDelay}€</span>
                        </div>
                      </div>
                    )}

                    {selectedReason === 'Olvido Accesorios (1€ por prenda)' && (
                      <div className="mt-3 bg-brand-black/30 border border-brand-black-border p-3 rounded-lg flex items-center justify-between gap-4 animate-fade-in">
                        <span className="text-[11px] text-brand-gray-muted">Introduce el número de prendas/accesorios:</span>
                        <div className="flex items-center gap-2">
                          <input
                            type="number"
                            min="1"
                            max="20"
                            className="w-16 bg-brand-black border border-brand-black-border rounded px-2 py-1 text-xs text-brand-gray-light text-center focus:ring-1 focus:ring-brand-red-600"
                            value={accessoryCount}
                            onChange={(e) => setAccessoryCount(Math.max(1, parseInt(e.target.value) || 1))}
                          />
                          <span className="text-xs text-brand-gray-light font-bold">prendas = {accessoryCount}€</span>
                        </div>
                      </div>
                    )}
                  </div>
                ) : (
                  // Abonos
                  <div>
                    <label className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block mb-2">
                      Seleccionar Importe del Abono
                    </label>
                    <div className="flex flex-wrap gap-1.5">
                      {quickPaymentAmounts.map((pa) => (
                        <button
                          key={pa}
                          type="button"
                          onClick={() => {
                            setSelectedReason(`Abono de multa`);
                            setSelectedAmount(pa);
                            setIsCustomReason(false);
                          }}
                          className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                            selectedAmount === pa && !isCustomReason
                              ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50 shadow-[0_0_8px_rgba(16,185,129,0.1)]'
                              : 'bg-brand-black/40 text-brand-gray-muted border-brand-black-border hover:text-emerald-400 hover:border-emerald-500/40'
                          }`}
                        >
                          Pagado {pa}€
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedReason('');
                          setIsCustomReason(true);
                        }}
                        className={`text-[10px] font-bold px-3 py-1 rounded-full border transition-all ${
                          isCustomReason
                            ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                            : 'bg-brand-black/40 text-brand-gray-muted border-brand-black-border hover:text-emerald-400 hover:border-emerald-500/40'
                        }`}
                      >
                        Otro Importe
                      </button>
                    </div>
                  </div>
                )}

                {/* Formulario de motivo/importe personalizado */}
                {isCustomReason && (
                  <div className="grid grid-cols-3 gap-3 mt-4 p-3 bg-brand-black/30 border border-brand-black-border rounded-xl animate-fade-in">
                    <div className="col-span-2">
                      <label className="text-[9px] font-semibold uppercase tracking-wider text-brand-gray-muted block mb-1">
                        Motivo Detallado
                      </label>
                      <input
                        type="text"
                        placeholder={activeTab === 'multa' ? "Ej. Llegar tarde a charla técnica" : "Ej. Pago parcial de multa"}
                        className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2.5 py-1 text-xs text-brand-gray-light focus:ring-1 focus:ring-brand-red-600"
                        value={customReasonText}
                        onChange={(e) => setCustomReasonText(e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="text-[9px] font-semibold uppercase tracking-wider text-brand-gray-muted block mb-1">
                        Importe (€)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2.5 py-1 text-xs text-brand-gray-light text-center focus:ring-1 focus:ring-brand-red-600"
                        value={customAmountVal}
                        onChange={(e) => setCustomAmountVal(e.target.value)}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Botón de Envío */}
              <div className="border-t border-brand-black-border pt-4 mt-2 flex justify-between items-center">
                <div className="text-[11px] text-brand-gray-muted">
                  {selectedPlayerIds.length === 0 ? (
                    <span className="text-brand-red-400">Selecciona al menos un jugador o míster</span>
                  ) : (
                    <span>Se registrará la transacción para <strong className="text-brand-gray-light">{selectedPlayerIds.length}</strong> personas.</span>
                  )}
                </div>
                <button
                  type="button"
                  disabled={selectedPlayerIds.length === 0 || createFineMutation.isPending || (!selectedReason && !isCustomReason)}
                  onClick={handleSaveQuickFines}
                  className={`btn-primary py-2 px-4 text-xs font-bold ${
                    activeTab === 'multa'
                      ? 'bg-brand-red-600 hover:bg-brand-red-700 shadow-glow-red'
                      : 'bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.25)] border-emerald-500/20'
                  }`}
                >
                  {createFineMutation.isPending ? 'Guardando...' : activeTab === 'multa' ? 'Aplicar Sanción' : 'Registrar Abono'}
                </button>
              </div>

            </div>

          </div>
        </div>
      )}

      {/* Controles de Vista */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-brand-black-card/40 border border-brand-black-border p-4 rounded-xl backdrop-blur-md">
        <div className="flex items-center gap-2">
          <Activity className="w-4 h-4 text-brand-red-600" />
          <span className="text-sm font-semibold text-brand-gray-light">Filtro de Rendimiento Histórico</span>
        </div>

        {/* Filtro mensual global */}
        <div className="flex items-center gap-2 bg-brand-black border border-brand-black-border p-1.5 rounded-lg shrink-0 w-fit">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bg-transparent text-xs text-brand-gray-light px-2.5 py-1 focus:ring-0 border-none rounded cursor-pointer"
          >
            {months.map(m => (
              <option key={m.value} value={m.value} className="bg-brand-black text-brand-gray-light">{m.label}</option>
            ))}
          </select>
          <div className="h-4 w-px bg-brand-black-border" />
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bg-transparent text-xs text-brand-gray-light px-2.5 py-1 focus:ring-0 border-none rounded cursor-pointer"
          >
            <option value={2026} className="bg-brand-black text-brand-gray-light">2026</option>
            <option value={2025} className="bg-brand-black text-brand-gray-light">2025</option>
          </select>
        </div>
      </div>

      {/* Tarjetas de Estadísticas Principales (KPIs) */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {/* KPI 1: Entrenamientos */}
        <div className="relative group overflow-hidden bg-gradient-to-br from-brand-red-950/20 via-brand-black-card to-brand-black border border-brand-black-border hover:border-brand-red-600/30 rounded-xl p-5 shadow-premium hover:shadow-[0_4px_25px_rgba(193,18,31,0.08)] transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Entrenamientos</span>
            <div className="p-2 rounded-lg bg-brand-red-600/10 border border-brand-red-600/20 text-brand-red-400 group-hover:scale-110 transition-transform duration-300">
              <Dumbbell className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-brand-gray-light tracking-tight">{monthlyTrainings}</h3>
              <span className="text-xs text-brand-red-400 font-semibold bg-brand-red-600/10 px-1.5 py-0.5 rounded">Este mes</span>
            </div>
            <p className="text-xs text-brand-gray-muted mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-gray-muted" />
              {totalTrainings} acumulados en la temporada
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-brand-red-600 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </div>

        {/* KPI 2: Partidos */}
        <div className="relative group overflow-hidden bg-gradient-to-br from-amber-950/20 via-brand-black-card to-brand-black border border-brand-black-border hover:border-amber-500/30 rounded-xl p-5 shadow-premium hover:shadow-[0_4px_25px_rgba(245,158,11,0.08)] transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Partidos de Liga</span>
            <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400 group-hover:scale-110 transition-transform duration-300">
              <Trophy className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-1">
              <h3 className="text-2xl font-extrabold text-brand-gray-light tracking-tight">
                {wins}V - {draws}E - {losses}D
              </h3>
            </div>
            
            {/* Barra de progreso segmentada W/D/L */}
            {playedMatches > 0 ? (
              <div className="w-full h-1.5 bg-brand-black rounded-full overflow-hidden flex gap-[2px] mt-3">
                <div 
                  className="h-full bg-emerald-500 rounded-l" 
                  style={{ width: `${(wins / playedMatches) * 100}%` }}
                  title={`${wins} Victorias`}
                />
                <div 
                  className="h-full bg-brand-gray-dark" 
                  style={{ width: `${(draws / playedMatches) * 100}%` }}
                  title={`${draws} Empates`}
                />
                <div 
                  className="h-full bg-brand-red-600 rounded-r" 
                  style={{ width: `${(losses / playedMatches) * 100}%` }}
                  title={`${losses} Derrotas`}
                />
              </div>
            ) : (
              <div className="w-full h-1.5 bg-brand-black rounded-full mt-3" />
            )}
            
            <p className="text-xs text-brand-gray-muted mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              {totalMatches} partidos en total
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-amber-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </div>

        {/* KPI 3: Multas */}
        <div className="relative group overflow-hidden bg-gradient-to-br from-red-950/20 via-brand-black-card to-brand-black border border-brand-black-border hover:border-brand-red-500/30 rounded-xl p-5 shadow-premium hover:shadow-[0_4px_25px_rgba(239,68,68,0.08)] transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Importe de Multas</span>
            <div className="p-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 group-hover:scale-110 transition-transform duration-300">
              <ShieldAlert className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <h3 className="text-3xl font-extrabold text-brand-red-500 tracking-tight">
                {monthlyFinesAmount.toFixed(2)} €
              </h3>
              <span className="text-xs text-red-400 font-semibold bg-red-500/10 px-1.5 py-0.5 rounded">Mes</span>
            </div>
            <p className="text-xs text-brand-gray-muted mt-2 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-red-500" />
              {totalFinesAmount.toFixed(2)} € acumulado total
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-red-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </div>

        {/* KPI 4: Casillero de Puntos */}
        <div className="relative group overflow-hidden bg-gradient-to-br from-emerald-950/15 via-brand-black-card to-brand-black border border-brand-black-border hover:border-emerald-500/30 rounded-xl p-5 shadow-premium hover:shadow-[0_4px_25px_rgba(16,185,129,0.08)] transition-all duration-300 transform hover:-translate-y-0.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">
              {isPlayer ? 'Mis Puntos' : 'Puntos de Vestuario'}
            </span>
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 group-hover:scale-110 transition-transform duration-300">
              <Award className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-4">
            <div className="flex items-baseline gap-2">
              <h3 className={`text-3xl font-extrabold tracking-tight ${totalPoints >= 0 ? 'text-emerald-500' : 'text-brand-red-600'}`}>
                {totalPoints > 0 ? '+' : ''}{totalPoints} pts
              </h3>
              <span className={`text-xs font-semibold px-1.5 py-0.5 rounded ${monthlyPoints >= 0 ? 'text-emerald-400 bg-emerald-500/10' : 'text-brand-red-400 bg-brand-red-600/10'}`}>
                {monthlyPoints > 0 ? '+' : ''}{monthlyPoints} mes
              </span>
            </div>
            <p className="text-xs text-brand-gray-muted mt-2 flex items-center gap-1.5">
              {totalPoints >= 0 ? (
                <TrendingUp className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
              ) : (
                <TrendingDown className="w-3.5 h-3.5 text-brand-red-600 shrink-0" />
              )}
              {isPlayer ? 'Tu puntuación acumulada' : 'Puntos acumulados del grupo'}
            </p>
          </div>
          <div className="absolute bottom-0 left-0 w-full h-[3px] bg-emerald-500 transform scale-x-0 group-hover:scale-x-100 transition-transform duration-300 origin-left" />
        </div>
      </div>

      {/* Paneles Secundarios: Próximos Eventos & Actividad Reciente */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Próximos Eventos (7 cols) */}
        <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-6 shadow-premium lg:col-span-7 flex flex-col justify-between hover:border-brand-gray-dark/30 transition-all duration-300">
          <div>
            <div className="flex items-center justify-between border-b border-brand-black-border pb-4 mb-5">
              <div className="flex items-center gap-2">
                <CalendarRange className="w-4 h-4 text-brand-red-600" />
                <h3 className="text-sm font-bold text-brand-gray-light uppercase tracking-wider">Próximos Eventos</h3>
              </div>
              <span className="text-[10px] bg-brand-black-border text-brand-gray-muted px-2.5 py-1 rounded-full font-semibold">
                Planificación semanal
              </span>
            </div>
            {upcomingEvents.length === 0 ? (
              <div className="text-center py-16">
                <CalendarIcon className="w-10 h-10 text-brand-gray-dark mx-auto mb-3 opacity-30" />
                <p className="text-sm text-brand-gray-muted">No hay eventos programados próximamente.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {upcomingEvents.map((evt) => (
                  <div 
                    key={evt.id} 
                    className="group/item flex gap-4 p-4 bg-brand-black/40 border border-brand-black-border/80 hover:border-brand-gray-dark/30 hover:bg-brand-black-hover/40 rounded-xl items-center transition-all duration-200"
                  >
                    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-inner group-hover/item:scale-105 transition-transform duration-200 ${
                      evt.type === 'entrenamiento' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-amber-500/10 text-amber-400 border border-amber-500/20'
                    }`}>
                      {evt.type === 'entrenamiento' ? <Dumbbell className="w-5 h-5" /> : <Trophy className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs sm:text-sm font-bold text-brand-gray-light group-hover/item:text-brand-gray-light transition-colors truncate">
                          {evt.type === 'entrenamiento' ? `Entrenamiento: ${(evt as any).objective || 'Táctico'}` : `Partido vs ${(evt as any).rival}`}
                        </h4>
                        <span className="text-[10px] bg-brand-black-border border border-brand-black-border/50 text-brand-gray-muted px-2.5 py-0.5 rounded-full font-bold shrink-0">
                          {evt.date}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] text-brand-gray-muted">
                        <span className="flex items-center gap-1"><Clock className="w-3.5 h-3.5 shrink-0 text-brand-red-600/70" /> {evt.type === 'entrenamiento' ? (evt as any).time : 'Hora a confirmar'}</span>
                        <span className="flex items-center gap-1 truncate max-w-[220px]">
                          <MapPin className="w-3.5 h-3.5 shrink-0 text-brand-red-600" />
                          {evt.type === 'entrenamiento' ? (
                            <a
                              href={(evt as any).location.startsWith('http') ? (evt as any).location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((evt as any).location)}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-red-400 hover:underline transition-colors truncate"
                              title="Ver ubicación en Google Maps"
                            >
                              {(evt as any).location}
                            </a>
                          ) : (
                            <a
                              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent((evt as any).is_local ? '6R7J+Q2 Adzaneta' : 'Campo Rival')}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="hover:text-brand-red-400 hover:underline transition-colors truncate"
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
            <Link to="/calendar" className="text-xs font-semibold text-brand-red-500 hover:text-brand-red-400 flex items-center gap-1.5 w-fit group">
              Ver calendario completo <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        {/* Actividad Reciente (5 cols) */}
        <div className="bg-brand-black-card border border-brand-black-border rounded-2xl p-6 shadow-premium lg:col-span-5 flex flex-col hover:border-brand-gray-dark/30 transition-all duration-300">
          <div className="flex items-center justify-between border-b border-brand-black-border pb-4 mb-5">
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4 text-brand-red-600" />
              <h3 className="text-sm font-bold text-brand-gray-light uppercase tracking-wider">Actividad del Club</h3>
            </div>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-brand-red-600 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-brand-red-600"></span>
            </span>
          </div>
          {recentActivity.length === 0 ? (
            <div className="text-center py-16 flex-1 flex flex-col justify-center">
              <p className="text-sm text-brand-gray-muted">No se registran actividades recientes en el vestuario.</p>
            </div>
          ) : (
            <div className="space-y-4 flex-1">
              {recentActivity.map((act) => {
                const ActIcon = act.icon;
                return (
                  <div 
                    key={act.id} 
                    className="flex gap-3 items-start p-3 bg-brand-black/20 border border-brand-black-border/60 hover:border-brand-gray-dark/20 rounded-xl transition-all duration-200"
                  >
                    <div className={`p-2 rounded-lg shrink-0 mt-0.5 border ${act.iconColor.replace('bg-', 'bg-opacity-20 bg-').replace('text-', 'border-').replace('600', '500/20 text-')}`}>
                      <ActIcon className="w-4 h-4" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <h4 className="text-xs font-bold text-brand-gray-light leading-snug truncate">{act.title}</h4>
                        <span className="text-[9px] bg-brand-black-border text-brand-gray-muted px-1.5 py-0.5 rounded font-medium shrink-0">{act.date}</span>
                      </div>
                      <p className="text-[11px] text-brand-gray-muted mt-1 leading-relaxed">{act.description}</p>
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
