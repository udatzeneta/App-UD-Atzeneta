import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ShieldAlert, Users, Trophy, ChevronRight, CheckCircle2, ArrowRight, X, Calendar as CalendarIcon, MapPin, Clock, Search, Award } from 'lucide-react';
import { Fine, Training, Match, Profile } from '../types';
import { Link, useNavigate } from 'react-router-dom';

type FormType = 'fines' | 'attendance' | 'matches' | null;

export const Dashboard: React.FC = () => {
  const { user, hasPermission } = useAuth();
  const { showToast } = useToast();
  const queryClient = useQueryClient();
  const navigate = useNavigate();

  const [activeForm, setActiveForm] = useState<FormType>(null);

  const canManageFines = hasPermission('fines', 'crear');
  const canManageTrainings = hasPermission('trainings', 'crear');
  const canManageMatches = hasPermission('matches', 'crear');

  // ==========================================
  // DATA FETCHING
  // ==========================================
  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: () => authService.getProfiles(),
    enabled: canManageFines || canManageTrainings
  });

  const { data: dbPlayers = [], isLoading: loadingPlayers } = useQuery({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers(),
    enabled: canManageFines || canManageTrainings
  });

  const { data: trainings = [], isLoading: loadingTrainings } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings(),
    enabled: canManageTrainings
  });

  const { data: matches = [], isLoading: loadingMatches } = useQuery({
    queryKey: ['matches'],
    queryFn: () => dataService.getMatches(),
    enabled: canManageMatches
  });

  // 1. Extraer Jugadores de la tabla `players`
  const combinedPlayers = dbPlayers.map(p => ({
    uid: p.profile_id || p.id, // ID real para la BD (profile_id si existe)
    id: p.id, // Key única para la UI
    full_name: p.nickname || p.full_name,
    photo_url: p.photo_url,
    dorsal: p.dorsal,
    role: 'Jugador'
  }));

  // 2. Extraer Entrenadores de la tabla `profiles` (role_id === 2)
  const combinedTrainers = profiles
    .filter(p => p.role_id === 2)
    .map(p => ({
      uid: p.id,
      id: p.id,
      full_name: p.full_name,
      photo_url: p.avatar_url,
      dorsal: null,
      role: 'Entrenador'
    }));

  const players = [...combinedPlayers, ...combinedTrainers].sort((a, b) => a.full_name.localeCompare(b.full_name));

  // ==========================================
  // FINES / PAYMENTS STATE & LOGIC
  // ==========================================
  const [fSelectedPlayerIds, setFSelectedPlayerIds] = useState<string[]>([]);
  const [fSearch, setFSearch] = useState('');
  const [fActiveTab, setFActiveTab] = useState<'multa' | 'pago'>('multa');
  const [fDate, setFDate] = useState(new Date().toISOString().split('T')[0]);
  const [fReason, setFReason] = useState('');
  const [fAmount, setFAmount] = useState<number>(0);
  const [fIsCustom, setFIsCustom] = useState(false);
  const [fCustomReason, setFCustomReason] = useState('');
  const [fCustomAmount, setFCustomAmount] = useState('10.00');
  const [fMinutesOfDelay, setFMinutesOfDelay] = useState<number>(15);
  const [fAccessoryCount, setFAccessoryCount] = useState<number>(1);

  const createFineMutation = useMutation({
    mutationFn: async (payloads: Omit<Fine, 'id'>[]) => {
      const promises = payloads.map(payload => dataService.createFine(payload));
      return Promise.all(promises);
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      queryClient.invalidateQueries({ queryKey: ['points'] });
      showToast('success', 'Operación registrada', `Se han guardado correctamente las ${data.length} transacciones.`);
      setActiveForm(null); // Reset
    },
    onError: (err: any) => {
      showToast('error', 'Error de registro', err.message || 'Ocurrió un error.');
    }
  });

  const handleSaveFines = () => {
    if (fSelectedPlayerIds.length === 0) return;
    let finalReason = '';
    let finalAmount = 0;
    if (fIsCustom) {
      finalReason = fActiveTab === 'pago' ? 'Abono' : fCustomReason.trim();
      finalAmount = Number(fCustomAmount) || 0;
      if (!finalReason || finalAmount <= 0) {
        showToast('error', 'Validación', fActiveTab === 'pago' ? 'Importe mayor a 0 obligatorio.' : 'Motivo e importe mayores a 0 obligatorios.');
        return;
      }
    } else {
      if (fReason === 'Retraso sin Aviso (1€ por minuto)') {
        finalReason = `Retraso sin Aviso (${fMinutesOfDelay} min)`;
        finalAmount = fMinutesOfDelay * 1;
      } else if (fReason === 'Olvido Accesorios (1€ por prenda)') {
        finalReason = `Olvido Accesorios (${fAccessoryCount} prendas)`;
        finalAmount = fAccessoryCount * 1;
      } else {
        finalReason = fReason;
        finalAmount = fAmount;
      }
    }
    if (!finalReason) {
      showToast('error', 'Validación', 'Selecciona o escribe un motivo.');
      return;
    }

    const payloads = fSelectedPlayerIds.map(selectedId => {
      const p = players.find(x => x.id === selectedId);
      return {
        user_id: p ? p.uid : selectedId,
        date: fDate,
        reason: finalReason,
        amount: finalAmount,
        status: fActiveTab === 'multa' ? 'Pendiente' as const : 'Pagado' as const
      };
    });

    createFineMutation.mutate(payloads);
  };

  // ==========================================
  // ATTENDANCE STATE & LOGIC
  // ==========================================
  const [aSelectedTrainingId, setASelectedTrainingId] = useState<string>('');
  const [aSearch, setASearch] = useState('');
  const [aAttendanceMap, setAAttendanceMap] = useState<Record<string, string>>({});

  const saveAttendanceMutation = useMutation({
    mutationFn: async (payload: { training_id: string, attendance: any[] }) => {
      // Usamos el endpoint existente en dataService si existe. Si no, lo simulamos para el plan
      // Aquí asumimos que dataService.saveTrainingAttendance existe y toma (training_id, record[])
      return (dataService as any).saveTrainingAttendance(payload.training_id, payload.attendance);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      queryClient.invalidateQueries({ queryKey: ['training_attendance'] });
      showToast('success', 'Asistencia guardada', 'Se ha registrado la asistencia correctamente.');
      setActiveForm(null);
    },
    onError: (err: any) => {
      showToast('error', 'Error', err.message || 'Error guardando asistencia');
    }
  });

  const handleSaveAttendance = () => {
    if (!aSelectedTrainingId) return;
    
    const attendanceRecords = players.map(p => ({
      training_id: aSelectedTrainingId,
      user_id: p.uid,
      status: aAttendanceMap[p.id] || 'ENT' // Default ENT
    }));
    saveAttendanceMutation.mutate({ training_id: aSelectedTrainingId, attendance: attendanceRecords });
  };

  // ==========================================
  // MATCH DATA STATE & LOGIC
  // ==========================================
  const [mSelectedMatchId, setMSelectedMatchId] = useState<string>('');

  const handleMatchAction = (action: 'convocatoria' | 'datos') => {
    if (!mSelectedMatchId) return;
    if (action === 'convocatoria') {
      // Redirigir a la pestaña de convocatoria (tab=convocatoria si la URL lo soporta, o simplemente al match)
      navigate(`/match/${mSelectedMatchId}?tab=convocatoria`);
    } else {
      navigate(`/match/${mSelectedMatchId}`);
    }
  };


  // ==========================================
  // RENDER HELPERS
  // ==========================================
  const quickFineTypes = [
    { label: 'No Avisar Asistencia', amount: 3 },
    { label: 'Retraso sin Aviso (1€ por minuto)', amount: 1 },
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
  const quickPaymentAmounts = [1, 2, 5, 10, 15, 20, 30, 50];
  const attendanceMotives = [
    { value: 'ENT', label: 'Presente' },
    { value: 'A', label: 'Ausente' },
    { value: 'ED', label: 'Entrenó Diferenciado' },
    { value: 'L', label: 'Lesionado' },
    { value: 'E', label: 'Enfermo' },
    { value: 'P', label: 'Partido' },
    { value: 'LJ', label: 'Libre, Jugó' },
    { value: 'V', label: 'Viaje' },
    { value: 'AA', label: 'Ausente con Aviso' },
    { value: 'AO', label: 'Ausente, Otros' },
    { value: 'D', label: 'Descanso' }
  ];

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="text-center sm:text-left mb-8">
        <h2 className="text-3xl font-extrabold text-brand-gray-light tracking-tight">
          Panel de Acciones Rápidas
        </h2>
        <p className="text-sm text-brand-gray-muted mt-2">
          Selecciona una de las opciones para registrar información de forma rápida.
        </p>
      </div>

      {/* Main Options Grid */}
      {!activeForm && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          
          {canManageFines && (
            <div 
              onClick={() => {
                setActiveForm('fines');
                setFSelectedPlayerIds([]);
                setFReason('');
                setFIsCustom(false);
              }}
              className="bg-brand-black-card border border-brand-black-border hover:border-brand-red-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-premium group flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-brand-red-600/10 border border-brand-red-600/30 flex items-center justify-center text-brand-red-500 group-hover:scale-110 transition-transform">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-brand-gray-light">Multas y Pagos</h3>
                <p className="text-xs text-brand-gray-muted mt-2 leading-relaxed">
                  Aplica sanciones o registra abonos de los jugadores.
                </p>
              </div>
            </div>
          )}

          {canManageTrainings && (
            <div 
              onClick={() => {
                setActiveForm('attendance');
                setASelectedTrainingId('');
                setAAttendanceMap({});
              }}
              className="bg-brand-black-card border border-brand-black-border hover:border-emerald-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-premium group flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500 group-hover:scale-110 transition-transform">
                <Users className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-brand-gray-light">Pasar Asistencia</h3>
                <p className="text-xs text-brand-gray-muted mt-2 leading-relaxed">
                  Registra quién ha entrenado y los motivos de las ausencias.
                </p>
              </div>
            </div>
          )}

          {canManageMatches && (
            <div 
              onClick={() => {
                setActiveForm('matches');
                setMSelectedMatchId('');
              }}
              className="bg-brand-black-card border border-brand-black-border hover:border-amber-500/50 rounded-2xl p-6 cursor-pointer transition-all hover:-translate-y-1 hover:shadow-premium group flex flex-col items-center text-center gap-4"
            >
              <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-500 group-hover:scale-110 transition-transform">
                <Trophy className="w-8 h-8" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-brand-gray-light">Gestión de Partido</h3>
                <p className="text-xs text-brand-gray-muted mt-2 leading-relaxed">
                  Haz la convocatoria o pasa los datos y estadísticas del partido.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* FORM: FINES / PAYMENTS */}
      {activeForm === 'fines' && (
        <div className="bg-brand-black-card border border-brand-black-border rounded-2xl overflow-hidden animate-fade-in shadow-premium relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red-600/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between p-6 border-b border-brand-black-border bg-brand-black/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveForm(null)} className="p-2 hover:bg-brand-black border border-transparent hover:border-brand-black-border rounded-lg transition-colors text-brand-gray-muted">
                <X className="w-5 h-5" />
              </button>
              <ShieldAlert className="w-6 h-6 text-brand-red-600" />
              <h3 className="text-lg font-bold text-brand-gray-light">Multas y Pagos</h3>
            </div>
          </div>

          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Col: Player Selection */}
            <div>
              <h4 className="text-sm font-semibold text-brand-gray-muted uppercase tracking-wider mb-4 flex justify-between items-center">
                <span>1. Seleccionar Jugadores ({fSelectedPlayerIds.length})</span>
                <button onClick={() => setFSelectedPlayerIds(players.map(p => p.id))} className="text-[10px] text-brand-red-400 hover:underline normal-case">Sel. Todos</button>
              </h4>
              <div className="relative mb-3">
                <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
                <input
                  type="text"
                  placeholder="Buscar jugador..."
                  className="w-full bg-brand-black/40 border border-brand-black-border rounded-lg pl-9 pr-3 py-2 text-sm text-brand-gray-light focus:ring-1 focus:ring-brand-red-600"
                  value={fSearch}
                  onChange={(e) => setFSearch(e.target.value)}
                />
              </div>
              <div className="bg-brand-black/30 border border-brand-black-border rounded-xl p-3 max-h-80 overflow-y-auto space-y-2 no-scrollbar">
                {players.filter(p => p.full_name.toLowerCase().includes(fSearch.toLowerCase())).map((p) => {
                  const isSel = fSelectedPlayerIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setFSelectedPlayerIds(prev => prev.includes(p.id) ? prev.filter(id => id !== p.id) : [...prev, p.id])}
                      className={`w-full flex items-center justify-between p-2.5 rounded-lg border transition-all text-left ${
                        isSel ? (fActiveTab === 'multa' ? 'bg-brand-red-600/10 border-brand-red-600/30' : 'bg-emerald-500/10 border-emerald-500/30') : 'bg-brand-black-card/30 border-transparent hover:bg-brand-black-hover/40'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <img src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} className="w-8 h-8 rounded-full border border-brand-black-border object-cover" />
                        <div>
                          <h4 className="text-sm font-semibold text-brand-gray-light leading-none">{p.full_name}</h4>
                          <span className="text-[10px] font-medium text-brand-gray-muted mt-1 block uppercase tracking-wider">{p.role}</span>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {p.dorsal !== undefined && p.dorsal !== null && p.role === 'Jugador' && (
                          <span className="text-2xl font-black text-amber-400 drop-shadow-md">
                            {p.dorsal}
                          </span>
                        )}
                        <div className={`w-5 h-5 rounded-full border flex items-center justify-center transition-all ${
                          isSel ? (fActiveTab === 'multa' ? 'bg-brand-red-600 border-brand-red-600 text-white' : 'bg-emerald-500 border-emerald-500 text-white') : 'border-brand-black-border'
                        }`}>
                          {isSel && <CheckCircle2 className="w-3.5 h-3.5" />}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Col: Details */}
            <div className={`transition-opacity ${fSelectedPlayerIds.length > 0 ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
              <h4 className="text-sm font-semibold text-brand-gray-muted uppercase tracking-wider mb-4">
                2. Configurar Acción
              </h4>
              <div className="flex bg-brand-black border border-brand-black-border p-1 rounded-xl mb-5">
                <button
                  type="button"
                  onClick={() => { setFActiveTab('multa'); setFReason(''); setFIsCustom(false); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${fActiveTab === 'multa' ? 'bg-brand-red-600 text-white shadow-glow-red' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
                >
                  <ShieldAlert className="w-4 h-4" /> Multa
                </button>
                <button
                  type="button"
                  onClick={() => { setFActiveTab('pago'); setFReason('Abono'); setFIsCustom(false); }}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${fActiveTab === 'pago' ? 'bg-emerald-600 text-white shadow-[0_0_12px_rgba(16,185,129,0.2)]' : 'text-brand-gray-muted hover:text-brand-gray-light'}`}
                >
                  <Award className="w-4 h-4" /> Pago
                </button>
              </div>

              <div className="mb-5">
                <label className="text-xs font-semibold text-brand-gray-muted mb-2 block">Fecha</label>
                <input type="date" className="w-full bg-brand-black/40 border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light" value={fDate} onChange={(e) => setFDate(e.target.value)} />
              </div>

              <div className="mb-6">
                <label className="text-xs font-semibold text-brand-gray-muted mb-2 block">Seleccionar Importe/Motivo</label>
                <div className="flex flex-wrap gap-2">
                  {(fActiveTab === 'multa' ? quickFineTypes : quickPaymentAmounts.map(a => ({ label: `Abono ${a}€`, amount: a }))).map((opt) => (
                    <button
                      key={opt.label}
                      type="button"
                      onClick={() => { setFReason(opt.label); setFAmount(opt.amount); setFIsCustom(false); }}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${
                        fReason === opt.label && !fIsCustom
                          ? (fActiveTab === 'multa' ? 'bg-brand-red-600/20 text-brand-red-400 border-brand-red-600/50' : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50')
                          : 'bg-brand-black/40 text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'
                      }`}
                    >
                      {opt.label} ({opt.amount}€)
                    </button>
                  ))}
                  <button
                    type="button"
                    onClick={() => setFIsCustom(true)}
                    className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all ${fIsCustom ? 'bg-brand-gray-dark text-white border-brand-gray-light' : 'bg-brand-black/40 text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light'}`}
                  >
                    Otro...
                  </button>
                </div>
              </div>

              {fReason === 'Retraso sin Aviso (1€ por minuto)' && !fIsCustom && (
                <div className="mb-6 p-4 bg-brand-black/30 border border-brand-black-border rounded-xl animate-fade-in">
                  <label className="text-xs font-semibold text-brand-gray-muted mb-1 block">Minutos de retraso</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" className="w-24 bg-brand-black border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light text-center focus:ring-1 focus:ring-brand-red-600" value={fMinutesOfDelay} onChange={e => setFMinutesOfDelay(Math.max(1, parseInt(e.target.value) || 1))} />
                    <span className="text-sm font-bold text-brand-gray-light">= {fMinutesOfDelay * 1}€</span>
                  </div>
                </div>
              )}

              {fReason === 'Olvido Accesorios (1€ por prenda)' && !fIsCustom && (
                <div className="mb-6 p-4 bg-brand-black/30 border border-brand-black-border rounded-xl animate-fade-in">
                  <label className="text-xs font-semibold text-brand-gray-muted mb-1 block">Número de prendas/accesorios</label>
                  <div className="flex items-center gap-3">
                    <input type="number" min="1" className="w-24 bg-brand-black border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light text-center focus:ring-1 focus:ring-brand-red-600" value={fAccessoryCount} onChange={e => setFAccessoryCount(Math.max(1, parseInt(e.target.value) || 1))} />
                    <span className="text-sm font-bold text-brand-gray-light">= {fAccessoryCount * 1}€</span>
                  </div>
                </div>
              )}

              {fIsCustom && (
                <div className={`grid ${fActiveTab === 'pago' ? 'grid-cols-1' : 'grid-cols-3'} gap-3 mb-6 p-4 bg-brand-black/30 border border-brand-black-border rounded-xl`}>
                  {fActiveTab === 'multa' && (
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-brand-gray-muted mb-1 block">Motivo</label>
                      <input type="text" className="w-full bg-brand-black border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light" value={fCustomReason} onChange={e => setFCustomReason(e.target.value)} />
                    </div>
                  )}
                  <div>
                    <label className="text-xs font-semibold text-brand-gray-muted mb-1 block">Importe (€)</label>
                    <input type="number" className="w-full bg-brand-black border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light text-center" value={fCustomAmount} onChange={e => setFCustomAmount(e.target.value)} />
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={handleSaveFines}
                disabled={createFineMutation.isPending || (!fReason && !fIsCustom)}
                className={`w-full py-3 text-sm font-bold rounded-xl transition-all flex items-center justify-center gap-2 ${
                  fActiveTab === 'multa' ? 'bg-brand-red-600 hover:bg-brand-red-700 text-white' : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {createFineMutation.isPending ? 'Guardando...' : (fActiveTab === 'multa' ? 'Aplicar Sanción' : 'Registrar Abono')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* FORM: ATTENDANCE */}
      {activeForm === 'attendance' && (
        <div className="bg-brand-black-card border border-brand-black-border rounded-2xl overflow-hidden animate-fade-in shadow-premium relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between p-6 border-b border-brand-black-border bg-brand-black/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveForm(null)} className="p-2 hover:bg-brand-black border border-transparent hover:border-brand-black-border rounded-lg transition-colors text-brand-gray-muted">
                <X className="w-5 h-5" />
              </button>
              <Users className="w-6 h-6 text-emerald-500" />
              <h3 className="text-lg font-bold text-brand-gray-light">Pasar Asistencia</h3>
            </div>
          </div>

          <div className="p-6">
            {!aSelectedTrainingId ? (
              <div className="max-w-xl mx-auto py-8">
                <h4 className="text-sm font-semibold text-brand-gray-muted uppercase tracking-wider mb-4 text-center">
                  1. Seleccionar Entrenamiento
                </h4>
                <div className="space-y-3">
                  {trainings.slice(0, 5).map(t => (
                    <button
                      key={t.id}
                      onClick={() => {
                        setASelectedTrainingId(t.id);
                        // Initialize all as ENT (Present)
                        const initial: Record<string, string> = {};
                        players.forEach(p => initial[p.id] = 'ENT');
                        setAAttendanceMap(initial);
                      }}
                      className="w-full bg-brand-black/40 border border-brand-black-border hover:border-emerald-500/40 p-4 rounded-xl flex items-center justify-between group transition-all"
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-brand-gray-light">{t.date}</span>
                        <span className="text-xs text-brand-gray-muted mt-1">{t.objective || 'Entrenamiento Regular'} • {t.time}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-brand-gray-dark group-hover:text-emerald-500 transition-colors" />
                    </button>
                  ))}
                  {trainings.length === 0 && (
                    <p className="text-center text-brand-gray-muted text-sm py-4">No hay entrenamientos recientes.</p>
                  )}
                </div>
              </div>
            ) : (
              <div className="animate-fade-in">
                <div className="flex justify-between items-center mb-6 bg-brand-black/30 border border-brand-black-border p-4 rounded-xl">
                  <div>
                    <h4 className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider mb-1">
                      2. Marcar Asistencia
                    </h4>
                    <p className="text-sm font-bold text-brand-gray-light">
                      Entrenamiento: {trainings.find(t => t.id === aSelectedTrainingId)?.date}
                    </p>
                  </div>
                  <button 
                    onClick={() => setASelectedTrainingId('')}
                    className="text-xs text-brand-gray-muted hover:text-brand-gray-light underline"
                  >
                    Cambiar Entrenamiento
                  </button>
                </div>

                <div className="relative mb-4 max-w-sm">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
                  <input
                    type="text"
                    placeholder="Buscar jugador..."
                    className="w-full bg-brand-black/40 border border-brand-black-border rounded-lg pl-9 pr-3 py-2 text-sm text-brand-gray-light focus:ring-1 focus:ring-emerald-500"
                    value={aSearch}
                    onChange={(e) => setASearch(e.target.value)}
                  />
                </div>

                <div className="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar mb-6">
                  {players.filter(p => p.full_name.toLowerCase().includes(aSearch.toLowerCase())).map(p => {
                    const status = aAttendanceMap[p.id] || 'ENT';
                    return (
                      <div key={p.id} className="bg-brand-black/40 border border-brand-black-border rounded-xl p-4 flex flex-col gap-3">
                        <div className="flex items-center gap-3">
                          <img src={p.photo_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'} className="w-8 h-8 rounded-full border border-brand-black-border object-cover" />
                          <div>
                            <h4 className="text-sm font-semibold text-brand-gray-light truncate leading-none">{p.full_name}</h4>
                            <span className="text-[10px] text-brand-gray-muted mt-1 uppercase">{p.role}</span>
                          </div>
                        </div>
                        <select
                          className={`w-full text-xs font-medium px-2 py-1.5 rounded border focus:ring-1 ${
                            status === 'ENT' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 focus:ring-emerald-500' : 'bg-brand-red-600/10 text-brand-red-400 border-brand-red-600/30 focus:ring-brand-red-500'
                          }`}
                          value={status}
                          onChange={(e) => setAAttendanceMap(prev => ({...prev, [p.id]: e.target.value}))}
                        >
                          {attendanceMotives.map(m => (
                            <option key={m.value} value={m.value} className="bg-brand-black text-brand-gray-light">
                              {m.value} - {m.label}
                            </option>
                          ))}
                        </select>
                      </div>
                    );
                  })}
                </div>

                <div className="border-t border-brand-black-border pt-6 flex justify-end">
                  <button
                    onClick={handleSaveAttendance}
                    disabled={saveAttendanceMutation.isPending}
                    className="btn-primary py-3 px-8 text-sm font-bold bg-emerald-600 hover:bg-emerald-700 shadow-[0_0_12px_rgba(16,185,129,0.2)]"
                  >
                    {saveAttendanceMutation.isPending ? 'Guardando...' : 'Guardar Asistencia'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* FORM: MATCHES */}
      {activeForm === 'matches' && (
        <div className="bg-brand-black-card border border-brand-black-border rounded-2xl overflow-hidden animate-fade-in shadow-premium relative">
          <div className="absolute top-0 right-0 w-64 h-64 bg-amber-500/5 rounded-full blur-[50px] pointer-events-none" />
          
          <div className="flex items-center justify-between p-6 border-b border-brand-black-border bg-brand-black/50">
            <div className="flex items-center gap-3">
              <button onClick={() => setActiveForm(null)} className="p-2 hover:bg-brand-black border border-transparent hover:border-brand-black-border rounded-lg transition-colors text-brand-gray-muted">
                <X className="w-5 h-5" />
              </button>
              <Trophy className="w-6 h-6 text-amber-500" />
              <h3 className="text-lg font-bold text-brand-gray-light">Gestión de Partido</h3>
            </div>
          </div>

          <div className="p-6">
            {!mSelectedMatchId ? (
              <div className="max-w-xl mx-auto py-8">
                <h4 className="text-sm font-semibold text-brand-gray-muted uppercase tracking-wider mb-4 text-center">
                  1. Seleccionar Partido
                </h4>
                <div className="space-y-3">
                  {matches.slice(0, 5).map(m => (
                    <button
                      key={m.id}
                      onClick={() => setMSelectedMatchId(m.id)}
                      className="w-full bg-brand-black/40 border border-brand-black-border hover:border-amber-500/40 p-4 rounded-xl flex items-center justify-between group transition-all"
                    >
                      <div className="flex flex-col text-left">
                        <span className="text-sm font-bold text-brand-gray-light">vs {m.rival}</span>
                        <span className="text-xs text-brand-gray-muted mt-1">{m.date} • {m.is_local ? 'Local' : 'Visitante'}</span>
                      </div>
                      <ChevronRight className="w-5 h-5 text-brand-gray-dark group-hover:text-amber-500 transition-colors" />
                    </button>
                  ))}
                  {matches.length === 0 && (
                    <p className="text-center text-brand-gray-muted text-sm py-4">No hay partidos recientes.</p>
                  )}
                </div>
                <div className="text-center mt-6">
                  <Link to="/matches" className="text-xs text-amber-500 hover:underline">Ver todos los partidos</Link>
                </div>
              </div>
            ) : (
              <div className="max-w-xl mx-auto py-8 animate-fade-in text-center">
                <div className="mb-8">
                  <h4 className="text-sm font-semibold text-brand-gray-muted uppercase tracking-wider mb-2">Partido Seleccionado</h4>
                  <p className="text-xl font-bold text-brand-gray-light">vs {matches.find(m => m.id === mSelectedMatchId)?.rival}</p>
                  <button onClick={() => setMSelectedMatchId('')} className="text-xs text-brand-gray-dark hover:text-brand-gray-light underline mt-2">Cambiar partido</button>
                </div>
                
                <h4 className="text-sm font-semibold text-brand-gray-muted uppercase tracking-wider mb-6">
                  2. ¿Qué quieres hacer?
                </h4>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <button
                    onClick={() => handleMatchAction('convocatoria')}
                    className="bg-brand-black/40 border border-brand-black-border hover:border-amber-500/50 p-6 rounded-xl group transition-all"
                  >
                    <Users className="w-8 h-8 text-amber-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <h5 className="font-bold text-brand-gray-light">Hacer Convocatoria</h5>
                    <p className="text-xs text-brand-gray-muted mt-2">Selecciona los jugadores citados y los descartes.</p>
                  </button>
                  
                  <button
                    onClick={() => handleMatchAction('datos')}
                    className="bg-brand-black/40 border border-brand-black-border hover:border-amber-500/50 p-6 rounded-xl group transition-all"
                  >
                    <Award className="w-8 h-8 text-amber-500 mx-auto mb-3 group-hover:scale-110 transition-transform" />
                    <h5 className="font-bold text-brand-gray-light">Pasar Datos y Estadísticas</h5>
                    <p className="text-xs text-brand-gray-muted mt-2">Introduce goles, asistencias y minutos jugados.</p>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
