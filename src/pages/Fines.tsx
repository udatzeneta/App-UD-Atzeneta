import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { supabase, isMockMode } from '../lib/supabase';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { Fine, Profile } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  ShieldAlert, Search, Download, FileText, Plus, Edit2, Trash2,
  User, CreditCard, Calendar, Check, AlertTriangle, X
} from 'lucide-react';

// Tipos de multa predefinidos
const FINE_TYPES = [
  { label: 'No Avisar Asistencia', amount: 3 },
  { label: 'Retraso sin Aviso (1 min)', amount: 1 },
  { label: 'Ropa Inadecuada', amount: 5 },
  { label: 'Olvido Camiseta Partido', amount: 10 },
  { label: 'Olvido Pantalón Partido', amount: 5 },
  { label: 'Olvido Accesorios (1 prenda)', amount: 1 },
  { label: 'Tarjeta Amarilla', amount: 10 },
  { label: 'Tarjeta Roja', amount: 30 },
  { label: 'Chat Inapropiado', amount: 1 },
  { label: 'No Contestar Forms', amount: 2 },
  { label: 'No Visualizar Partido', amount: 1 },
  { label: 'Apuesta CT', amount: 10 },
  { label: 'Apuesta con CT perdida', amount: 10 },
  { label: 'Otros', amount: 0 },
];

// Importes de pago rápido
const PAYMENT_AMOUNTS = [1, 2, 3, 4, 5, 10, 15, 20, 30, 50];

export const Fines: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission, roleSlug, user } = usePermissions();
  const { showToast } = useToast();

  const isPlayer = roleSlug === 'player';

  const canCreate = hasPermission('fines', 'crear');
  const canEdit = hasPermission('fines', 'editar');
  const canDelete = hasPermission('fines', 'eliminar');
  const canExport = hasPermission('fines', 'exportar');

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('Todos');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingFine, setEditingFine] = useState<Fine | null>(null);
  const [selectedPlayerDetail, setSelectedPlayerDetail] = useState<Profile | null>(null);
  const [isPaymentMode, setIsPaymentMode] = useState(false);

  // Campos formulario
  const [targetUserId, setTargetUserId] = useState('');
  const [date, setDate] = useState('');
  const [reason, setReason] = useState('');
  const [amount, setAmount] = useState('10.00');
  const [status, setStatus] = useState<'Pendiente' | 'Pagado'>('Pendiente');

  // Queries
  const { data: fines = [], isLoading: loadingFines } = useQuery({
    queryKey: ['fines'],
    queryFn: () => dataService.getFines()
  });

  const { data: profiles = [], isLoading: loadingProfiles } = useQuery({
    queryKey: ['profiles'],
    queryFn: async () => {
      // Roles: 2=Entrenador, 3=Jugador, 4=Directivo
      const allProfiles = await dataService.getProfilesByRoles([2, 3, 4]);
      if (isMockMode) {
        return allProfiles;
      }
      // Obtener nickname y dorsal de la tabla players
      const { data: players } = await supabase.from('players').select('profile_id, nickname, dorsal');
      const playersMap = new Map(players?.map(p => [p.profile_id, p]) || []);
      return allProfiles.map(p => {
        const player = playersMap.get(p.id);
        return {
          ...p,
          nickname: player?.nickname || p.full_name,
          dorsal: player?.dorsal
        };
      });
    },
    enabled: canCreate || canEdit
  });

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: (item: Omit<Fine, 'id'>) => dataService.createFine(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      showToast('success', 'Multa registrada', 'Se ha cargado la sanción al jugador.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<Fine> }) => dataService.updateFine(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      showToast('success', 'Multa modificada', 'Se ha guardado la actualización de la multa.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteFine(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      showToast('success', 'Multa retirada', 'La sanción ha sido condonada/eliminada.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleOpenCreateModal = () => {
    setEditingFine(null);
    setTargetUserId(profiles.length > 0 ? profiles[0].id : '');
    setDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setAmount('10.00');
    setStatus('Pendiente');
    setIsPaymentMode(false);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (f: Fine) => {
    setEditingFine(f);
    setTargetUserId(f.user_id);
    setDate(f.date);
    setReason(f.reason);
    setAmount(String(f.amount));
    setStatus(f.status);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingFine(null);
    setIsPaymentMode(false);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) {
      showToast('error', 'Validación', 'Debes seleccionar un jugador.');
      return;
    }
    if (Number(amount) <= 0) {
      showToast('error', 'Validación', 'El importe debe ser mayor que cero.');
      return;
    }

    // Modo PAGO: Marcar multas pendientes como pagadas
    if (isPaymentMode) {
      const playerPendingFines = fines
        .filter(f => f.user_id === targetUserId && f.status === 'Pendiente')
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

      if (playerPendingFines.length === 0) {
        showToast('error', 'Validación', 'Este jugador no tiene multas pendientes.');
        return;
      }

      let remainingAmount = Number(amount);
      const updates: Array<{ id: string; item: Partial<Fine> }> = [];

      // Procesar multas ordenadas por fecha (más antiguas primero)
      for (const fine of playerPendingFines) {
        if (remainingAmount <= 0) break;

        const fineAmount = Number(fine.amount);

        if (remainingAmount >= fineAmount) {
          // Multa completamente cubierta por el pago
          updates.push({ id: fine.id, item: { status: 'Pagado' } });
          remainingAmount -= fineAmount;
        } else {
          // Pago parcial: reducir el monto de la multa
          const newAmount = fineAmount - remainingAmount;
          updates.push({ id: fine.id, item: { amount: newAmount } });
          remainingAmount = 0;
        }
      }

      if (updates.length === 0) {
        showToast('error', 'Validación', 'No se pueden procesar el pago.');
        return;
      }

      // Aplicar todas las actualizaciones
      updates.forEach(({ id, item }) => {
        updateMutation.mutate({ id, item });
      });

      return;
    }

    // Modo MULTA: Crear nueva multa
    if (!reason.trim() && reason !== 'Otros') {
      showToast('error', 'Validación', 'El motivo de la multa es obligatorio.');
      return;
    }

    const payload = {
      user_id: targetUserId,
      date,
      reason: reason.trim(),
      amount: Number(amount),
      status
    };

    if (editingFine) {
      updateMutation.mutate({ id: editingFine.id, item: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Confirmas que deseas eliminar esta multa?')) {
      deleteMutation.mutate(id);
    }
  };

  const toggleStatusMutation = useMutation({
    mutationFn: (f: Fine) => dataService.updateFine(f.id, { status: f.status === 'Pagado' ? 'Pendiente' : 'Pagado' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fines'] });
      showToast('success', 'Estado modificado', 'Se actualizó el estado de pago.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleToggleStatus = (f: Fine) => {
    if (!canEdit) return;
    toggleStatusMutation.mutate(f);
  };

  // Filtrado de multas visible (Jugador solo ve las suyas)
  const userFines = fines.filter(f => !isPlayer || f.user_id === user?.id);

  // Estadísticas globales e individuales
  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  const isAbono = (f: Fine) => f.reason.toLowerCase().startsWith('abono');

  // Filtrado de la lista en pantalla (Búsqueda + Estado)
  const filteredFines = userFines.filter(f => {
    const matchSearch = 
      (f.profiles?.full_name || '').toLowerCase().includes(search.toLowerCase()) || 
      f.reason.toLowerCase().includes(search.toLowerCase());
    const matchStatus = filterStatus === 'Todos' || f.status === filterStatus;
    return matchSearch && matchStatus;
  });

  // Datos de exportación (definidos una sola vez, reutilizados por CSV y PDF)
  const exportHeaders = ['Fecha', 'Jugador', 'Motivo', 'Importe (EUR)', 'Estado'];
  const buildExportRows = (): ExportCell[][] =>
    filteredFines.map(f => [
      f.date,
      f.profiles?.nickname || f.profiles?.full_name || 'Desconocido',
      f.reason,
      f.amount,
      f.status,
    ]);

  const handleExportCSV = () => {
    if (filteredFines.length === 0) {
      showToast('info', 'Exportar', 'No hay registros en la lista para exportar.');
      return;
    }
    exportToCSV(`multas_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Exportado el listado de sanciones.');
  };

  const handleExportPDF = async () => {
    if (filteredFines.length === 0) {
      showToast('info', 'Exportar', 'No hay registros en la lista para exportar.');
      return;
    }
    await exportToPDF('Multas UD Atzeneta', `multas_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Se ha generado el informe de sanciones.');
  };

  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  const isLoading = loadingFines || (loadingProfiles && (canCreate || canEdit));

  // Estadísticas por jugador
  const playerStats = profiles.map(profile => {
    const playerFines = userFines.filter(f => f.user_id === profile.id);
    
    const playerRealFines = playerFines.filter(f => !isAbono(f));
    const playerAbonos = playerFines.filter(isAbono);

    const playerMonthlyRealFines = playerRealFines.filter(f => filterByDate(f.date));
    const playerMonthlyAbonos = playerAbonos.filter(f => filterByDate(f.date));

    // Totales
    const totalAmount = playerRealFines.reduce((acc, f) => acc + Number(f.amount), 0);
    const paidAmount = playerRealFines.filter(f => f.status === 'Pagado').reduce((acc, f) => acc + Number(f.amount), 0) + playerAbonos.reduce((acc, f) => acc + Number(f.amount), 0);
    const pendingAmount = totalAmount - paidAmount;

    // Mensuales
    const monthlyTotalAmount = playerMonthlyRealFines.reduce((acc, f) => acc + Number(f.amount), 0);
    const monthlyPaidAmount = playerMonthlyRealFines.filter(f => f.status === 'Pagado').reduce((acc, f) => acc + Number(f.amount), 0) + playerMonthlyAbonos.reduce((acc, f) => acc + Number(f.amount), 0);
    const monthlyPendingAmount = monthlyTotalAmount - monthlyPaidAmount;

    return {
      profile,
      totalFines: playerRealFines.length,
      totalAmount,
      paidAmount,
      pendingAmount,
      monthlyFines: playerMonthlyRealFines.length,
      monthlyTotalAmount,
      monthlyPaidAmount,
      monthlyPendingAmount,
    };
  }).filter(ps => ps.totalFines > 0 || ps.paidAmount > 0 || ps.monthlyFines > 0).sort((a, b) => b.pendingAmount - a.pendingAmount);

  const realFines = userFines.filter(f => !isAbono(f));
  const abonos = userFines.filter(isAbono);
  
  const totalFinesValue = realFines.reduce((acc, f) => acc + Number(f.amount), 0);
  const totalDebt = playerStats.reduce((acc, stat) => acc + stat.pendingAmount, 0);
  const monthlyFinesAmount = realFines.filter(f => filterByDate(f.date)).reduce((acc, f) => acc + Number(f.amount), 0);

  const finesByMonthData = months.map(m => {
    const mRealFines = realFines.filter(f => new Date(f.date).getMonth() + 1 === m.value && new Date(f.date).getFullYear() === selectedYear);
    const mTotal = mRealFines.reduce((acc, f) => acc + Number(f.amount), 0);
    return {
      name: m.label.substring(0, 3),
      total: mTotal
    };
  });
  
  const maxChartValue = Math.max(...finesByMonthData.map(d => d.total), 10);

  return (
    <div className="space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">
            {isPlayer ? 'Mis Sanciones / Multas' : 'Control de Multas'}
          </h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            {isPlayer ? 'Detalle de las multas de vestuario aplicadas a tu casillero.' : 'Sanciones monetarias internas para mantener la disciplina y puntualidad.'}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canExport && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canCreate && (
            <button onClick={handleOpenCreateModal} className="btn-primary py-2 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Aplicar Multa
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          BLOQUES DE ESTADÍSTICAS
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        
        {/* Multas Totales (€) */}
        <div className="dashboard-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Multas (€) total</span>
            <h3 className="text-2xl font-bold text-brand-gray-light mt-2">{totalFinesValue.toFixed(2)} €</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Histórico de sanciones</span>
          </div>
          <div className="p-3 bg-brand-black-border text-brand-gray-light rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Multas Mes (€) */}
        <div className="dashboard-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Multas (€) Mes</span>
            <h3 className="text-2xl font-bold text-brand-gray-light mt-2">{monthlyFinesAmount.toFixed(2)} €</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Sanciones aplicadas en este mes</span>
          </div>
          <div className="flex flex-col items-end gap-1">
            <div className="flex gap-1 bg-brand-black border border-brand-black-border px-2 py-0.5 rounded">
              <select 
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(Number(e.target.value))}
                className="bg-transparent text-[10px] text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
              >
                {months.map(m => <option key={m.value} value={m.value} className="bg-brand-black-card text-brand-gray-light">{m.label}</option>)}
              </select>
              <select 
                value={selectedYear}
                onChange={(e) => setSelectedYear(Number(e.target.value))}
                className="bg-transparent text-[10px] text-brand-gray-light border-none p-0 focus:ring-0 cursor-pointer"
              >
                <option value={2026} className="bg-brand-black-card text-brand-gray-light">2026</option>
                <option value={2025} className="bg-brand-black-card text-brand-gray-light">2025</option>
              </select>
            </div>
          </div>
        </div>

        {/* Deudas */}
        <div className="dashboard-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Deudas</span>
            <h3 className="text-2xl font-bold text-brand-red-600 mt-2">{totalDebt.toFixed(2)} €</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Balance histórico pendiente</span>
          </div>
          <div className="p-3 bg-brand-red-600/10 text-brand-red-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* =====================================================================
          GRÁFICA DE MULTAS POR MES
          ===================================================================== */}
      <div className="dashboard-card p-5">
        <h3 className="text-sm font-bold text-brand-gray-light mb-6">Multas por Mes ({selectedYear})</h3>
        <div className="flex items-end justify-between gap-1 sm:gap-2 h-48 w-full pt-6">
          {finesByMonthData.map((d, i) => (
            <div key={i} className="flex flex-col items-center flex-1 group">
              <div className="w-full relative flex justify-center items-end h-full bg-brand-black-bg/50 rounded-t-sm">
                <div 
                  className="w-full bg-brand-red-600/80 hover:bg-brand-red-500 rounded-t-sm transition-all relative"
                  style={{ height: `${(d.total / maxChartValue) * 100}%`, minHeight: d.total > 0 ? '4px' : '0' }}
                >
                  <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-black border border-brand-black-border text-xs text-white px-2 py-1 rounded shadow-premium pointer-events-none whitespace-nowrap transition-opacity z-10">
                    {d.total.toFixed(2)} €
                  </div>
                </div>
              </div>
              <span className="text-[10px] text-brand-gray-muted mt-2">{d.name}</span>
            </div>
          ))}
        </div>
      </div>

      {/* =====================================================================
          LISTADO DE JUGADORES Y SUS ESTADÍSTICAS DE MULTAS
          ===================================================================== */}
      {!isPlayer && playerStats.length > 0 && (
        <div className="bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
          <div className="p-4 border-b border-brand-black-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-lg font-bold text-brand-gray-light">Deuda de Multas por Jugador</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-brand-gray-muted uppercase tracking-wider">Mes:</span>
              <div className="flex gap-1">
                <select 
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(Number(e.target.value))}
                  className="bg-brand-black-bg border border-brand-black-border rounded px-2 py-1 text-xs text-brand-gray-light focus:ring-1 focus:ring-brand-red-600 focus:border-brand-red-600 transition-all"
                >
                  {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
                <select 
                  value={selectedYear}
                  onChange={(e) => setSelectedYear(Number(e.target.value))}
                  className="bg-brand-black-bg border border-brand-black-border rounded px-2 py-1 text-xs text-brand-gray-light focus:ring-1 focus:ring-brand-red-600 focus:border-brand-red-600 transition-all"
                >
                  <option value={2026}>2026</option>
                  <option value={2025}>2025</option>
                </select>
              </div>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr>
                  <th className="table-th">Jugador</th>
                  <th className="table-th text-center">Multas</th>
                  <th className="table-th text-center">Multas (€)</th>
                  <th className="table-th text-center">Paga</th>
                  <th className="table-th text-center">Deuda Total</th>
                  <th className="table-th text-center">Multas (Mes)</th>
                  <th className="table-th text-center">Multas Mes (€)</th>
                  <th className="table-th text-center">Paga Mes</th>
                  <th className="table-th text-center">Deuda Mes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-black-border bg-brand-black-card/10">
                {playerStats.map((stat) => (
                  <tr
                    key={stat.profile.id}
                    className={`transition-colors cursor-pointer ${stat.pendingAmount > 0 ? 'animate-blink-bg hover:bg-brand-red-900/30' : 'hover:bg-brand-black-hover/20'}`}
                    onClick={() => setSelectedPlayerDetail(stat.profile)}
                  >
                    <td className="table-td font-semibold text-brand-gray-light">
                      <div className="flex items-center gap-2">
                        <img
                          src={stat.profile.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                          alt="avatar"
                          className="w-6 h-6 rounded-full border border-brand-black-border object-cover"
                        />
                        <div className="flex items-center gap-2">
                          {stat.profile.dorsal && <span className="text-xs font-bold text-brand-red-600 bg-brand-black-border px-2 py-0.5 rounded">#{stat.profile.dorsal}</span>}
                          <span>{stat.profile.nickname || stat.profile.full_name}</span>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-center text-brand-gray-light">{stat.totalFines}</td>
                    <td className="table-td text-center text-brand-gray-light">{stat.totalAmount.toFixed(2)} €</td>
                    <td className="table-td text-center text-emerald-400 font-bold">{stat.paidAmount.toFixed(2)} €</td>
                    <td className={`table-td text-center font-bold ${stat.pendingAmount > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                      {stat.pendingAmount.toFixed(2)} €
                    </td>
                    <td className="table-td text-center text-brand-gray-light">{stat.monthlyFines}</td>
                    <td className="table-td text-center text-brand-gray-light">{stat.monthlyTotalAmount.toFixed(2)} €</td>
                    <td className="table-td text-center text-emerald-400 font-bold">{stat.monthlyPaidAmount.toFixed(2)} €</td>
                    <td className={`table-td text-center font-bold ${stat.monthlyPendingAmount > 0 ? 'text-red-500' : 'text-emerald-400'}`}>
                      {stat.monthlyPendingAmount.toFixed(2)} €
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* =====================================================================
          FILTROS Y BÚSQUEDA
          ===================================================================== */}
      <div className="flex flex-col sm:flex-row gap-3 bg-brand-black border border-brand-black-border p-4 rounded-xl">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-2.5 w-4 h-4 text-brand-gray-dark" />
          <input
            type="text"
            className="form-input pl-10 w-full"
            placeholder={isPlayer ? "Buscar por motivo de la sanción..." : "Buscar por jugador o motivo..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="w-full sm:w-48 shrink-0">
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="form-input bg-brand-black-bg"
          >
            <option value="Todos">Todos los Estados</option>
            <option value="Pendiente">Pendientes de Pago</option>
            <option value="Pagado">Pagados</option>
          </select>
        </div>
      </div>

      {/* =====================================================================
          TABLA O VISTA CARDS
          ===================================================================== */}
      {isLoading ? (
        <TableSkeleton />
      ) : filteredFines.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No se registran multas con los filtros aplicados.</p>
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Fecha</th>
                  <th className="table-th">Jugador</th>
                  <th className="table-th">Motivo de la Sanción</th>
                  <th className="table-th">Importe</th>
                  <th className="table-th">Estado de Pago</th>
                  {(canEdit || canDelete) && <th className="table-th text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-black-border bg-brand-black-card/10">
                {filteredFines.map((fine) => (
                  <tr key={fine.id} className="hover:bg-brand-black-hover/20 transition-colors">
                    <td className="table-td font-semibold text-brand-gray-light">{fine.date}</td>
                    <td className="table-td font-semibold text-brand-gray-light">
                      <div className="flex items-center gap-2">
                        <img
                          src={fine.profiles?.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                          alt="avatar"
                          className="w-6 h-6 rounded-full border border-brand-black-border object-cover"
                        />
                        <div className="flex items-center gap-2">
                          {fine.profiles?.dorsal && <span className="text-xs font-bold text-brand-red-600 bg-brand-black-border px-2 py-0.5 rounded">#{fine.profiles.dorsal}</span>}
                          <span>{fine.profiles?.nickname || fine.profiles?.full_name || 'Desconocido'}</span>
                        </div>
                      </div>
                    </td>
                    <td className="table-td text-brand-gray-light">{fine.reason}</td>
                    <td className="table-td text-brand-red-600 font-bold text-base">{Number(fine.amount).toFixed(2)} €</td>
                    <td className="table-td">
                      <button
                        onClick={() => handleToggleStatus(fine)}
                        disabled={!canEdit}
                        className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                          fine.status === 'Pagado'
                            ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                            : 'bg-red-950/20 text-brand-red-600 border-brand-red-600/30'
                        } ${canEdit ? 'hover:scale-[1.03] cursor-pointer' : 'cursor-default'}`}
                      >
                        {fine.status === 'Pagado' ? (
                          <>
                            <Check className="w-3 h-3 text-emerald-400" />
                            <span>Pagado</span>
                          </>
                        ) : (
                          <>
                            <AlertTriangle className="w-3 h-3 text-brand-red-600" />
                            <span>Pendiente</span>
                          </>
                        )}
                      </button>
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="table-td text-right">
                        <div className="flex gap-2 justify-end">
                          {canEdit && (
                            <button 
                              onClick={() => handleOpenEditModal(fine)}
                              className="text-brand-gray-muted hover:text-brand-gray-light p-1.5 rounded bg-brand-black-hover hover:bg-brand-black-border border border-brand-black-border transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => handleDelete(fine.id)}
                              className="text-brand-gray-muted hover:text-brand-red-600 p-1.5 rounded bg-brand-black-hover hover:bg-brand-red-600/10 border border-brand-black-border hover:border-brand-red-600/20 transition-all"
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
            </table>
          </div>

          {/* Cards responsivas */}
          <div className="md:hidden space-y-3">
            {filteredFines.map((fine) => (
              <div key={fine.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 shadow-premium space-y-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-brand-gray-light">{fine.reason}</h4>
                    <span className="text-[11px] text-brand-gray-muted flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" /> {fine.date} | <User className="w-3.5 h-3.5" /> {fine.profiles?.dorsal && `#${fine.profiles.dorsal} `}{fine.profiles?.nickname || fine.profiles?.full_name || 'Desconocido'}
                    </span>
                  </div>
                  <span className="text-sm font-bold text-brand-red-600 bg-brand-red-600/5 px-2 py-0.5 rounded border border-brand-red-600/10">
                    {Number(fine.amount).toFixed(2)} €
                  </span>
                </div>

                <div className="flex items-center justify-between border-t border-brand-black-border pt-3">
                  <button
                    onClick={() => handleToggleStatus(fine)}
                    disabled={!canEdit}
                    className={`inline-flex items-center gap-1.5 text-[10px] font-semibold px-2.5 py-1 rounded-full border transition-all ${
                      fine.status === 'Pagado'
                        ? 'bg-emerald-950/20 text-emerald-400 border-emerald-900/30'
                        : 'bg-red-950/20 text-brand-red-600 border-brand-red-600/30'
                    }`}
                  >
                    {fine.status}
                  </button>

                  <div className="flex gap-2">
                    {canEdit && (
                      <button 
                        onClick={() => handleOpenEditModal(fine)}
                        className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-gray-light flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => handleDelete(fine.id)}
                        className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Borrar
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* =====================================================================
          MODAL CREAR / EDITAR
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingFine ? 'Modificar Sanción' : 'Aplicar Nueva Multa Interna'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Jugador Infraccionado</label>
            <select
              value={targetUserId}
              onChange={(e) => setTargetUserId(e.target.value)}
              className="form-input bg-brand-black-bg"
            >
              <option value="">-- Seleccionar Jugador --</option>
              {profiles.map(p => (
                <option key={p.id} value={p.id} className="bg-brand-black-card text-brand-gray-light">
                  {p.dorsal ? `#${p.dorsal} ` : ''}{p.nickname || p.full_name} ({p.email})
                </option>
              ))}
            </select>
          </div>

          {/* Tipos de multa predefinidos */}
          <div>
            <label className="form-label">Tipo de Infracción (acceso rápido)</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5 max-h-36 overflow-y-auto pr-1 no-scrollbar">
              {FINE_TYPES.map((ft) => (
                <button
                  key={ft.label}
                  type="button"
                  onClick={() => {
                    if (ft.label === 'Otros') {
                      setReason('');
                      setAmount('10.00');
                    } else {
                      setReason(ft.label);
                      setAmount(String(ft.amount));
                    }
                  }}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                    (ft.label === 'Otros' ? reason === '' : reason === ft.label)
                      ? 'bg-brand-red-600/20 text-brand-red-600 border-brand-red-600/50'
                      : 'bg-brand-black-hover text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light hover:border-brand-gray-dark'
                  }`}
                >
                  {ft.label} {ft.amount > 0 ? `· ${ft.amount}€` : ''}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha del Suceso</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Importe (€)</label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                className="form-input"
                placeholder="20.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">
              Motivo o Descripción de la Falta
              {reason === '' && <span className="text-brand-gray-muted text-[10px] ml-1">(Personalizado)</span>}
            </label>
            <input
              type="text"
              className="form-input"
              placeholder={reason === '' ? "Escribe el motivo personalizado..." : "Retraso de 15 minutos en la convocatoria o usar móvil"}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
            />
          </div>

          {/* Importes de pago rápido */}
          <div>
            <label className="form-label">Pago Rápido (registrar importe pagado)</label>
            <div className="flex flex-wrap gap-1.5 mt-1.5">
              {PAYMENT_AMOUNTS.map((pa) => (
                <button
                  key={pa}
                  type="button"
                  onClick={() => {
                    setIsPaymentMode(true);
                    setAmount(String(pa));
                    setStatus('Pagado');
                  }}
                  className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all ${
                    isPaymentMode && status === 'Pagado' && amount === String(pa)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-brand-black-hover text-brand-gray-muted border-brand-black-border hover:text-emerald-400 hover:border-emerald-500/40'
                  }`}
                >
                  Pago {pa}€
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="form-label">Estado de la Multa</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
              className="form-input bg-brand-black-bg"
            >
              <option value="Pendiente">Pendiente de Pago</option>
              <option value="Pagado">Pagado</option>
            </select>
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Aplicar Sanción
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL DETALLE DE JUGADOR */}
      {selectedPlayerDetail && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-brand-black border border-brand-black-border rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="sticky top-0 bg-brand-black-card border-b border-brand-black-border p-6 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <img
                  src={selectedPlayerDetail.avatar_url || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=60&q=80'}
                  alt="avatar"
                  className="w-12 h-12 rounded-full border border-brand-black-border object-cover"
                />
                <div>
                  <h2 className="text-xl font-bold text-brand-gray-light flex items-center gap-2">
                    {selectedPlayerDetail.dorsal && <span className="text-sm font-bold text-brand-red-600 bg-brand-black border border-brand-black-border px-2 py-1 rounded">#{selectedPlayerDetail.dorsal}</span>}
                    {selectedPlayerDetail.nickname || selectedPlayerDetail.full_name}
                  </h2>
                  <p className="text-xs text-brand-gray-muted">{selectedPlayerDetail.email}</p>
                </div>
              </div>
              <button
                onClick={() => setSelectedPlayerDetail(null)}
                className="text-brand-gray-muted hover:text-brand-gray-light p-2"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Content */}
            <div className="p-6 space-y-6">
              {/* Estadísticas resumidas */}
              {(() => {
                const playerFines = userFines.filter(f => f.user_id === selectedPlayerDetail.id);
                const playerRealFines = playerFines.filter(f => !isAbono(f));
                const playerAbonos = playerFines.filter(isAbono);
                
                const totalAmount = playerRealFines.reduce((acc, f) => acc + Number(f.amount), 0);
                const paidAmount = playerRealFines.filter(f => f.status === 'Pagado').reduce((acc, f) => acc + Number(f.amount), 0) + playerAbonos.reduce((acc, f) => acc + Number(f.amount), 0);
                const pendingAmount = totalAmount - paidAmount;

                const playerFinesByMonthData = months.map(m => {
                  const mRealFines = playerRealFines.filter(f => new Date(f.date).getMonth() + 1 === m.value && new Date(f.date).getFullYear() === selectedYear);
                  const mTotal = mRealFines.reduce((acc, f) => acc + Number(f.amount), 0);
                  return {
                    name: m.label.substring(0, 3),
                    total: mTotal
                  };
                });
                const maxPlayerChartValue = Math.max(...playerFinesByMonthData.map(d => d.total), 10);

                return (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-brand-black-card border border-brand-black-border p-3 rounded-lg text-center">
                        <span className="text-xs text-brand-gray-muted block">Total Multas</span>
                        <h3 className="text-2xl font-bold text-brand-gray-light mt-1">{playerRealFines.length}</h3>
                      </div>
                      <div className="bg-brand-black-card border border-brand-black-border p-3 rounded-lg text-center">
                        <span className="text-xs text-brand-gray-muted block">Multas (€)</span>
                        <h3 className="text-2xl font-bold text-brand-gray-light mt-1">{totalAmount.toFixed(2)} €</h3>
                      </div>
                      <div className="bg-brand-black-card border border-brand-black-border p-3 rounded-lg text-center">
                        <span className="text-xs text-brand-gray-muted block">Pagado</span>
                        <h3 className="text-2xl font-bold text-emerald-400 mt-1">{paidAmount.toFixed(2)} €</h3>
                      </div>
                      <div className={`bg-brand-black-card border border-brand-black-border p-3 rounded-lg text-center ${pendingAmount > 0 ? 'border-red-600/30 animate-blink-bg' : ''}`}>
                        <span className="text-xs text-brand-gray-muted block">Pendiente</span>
                        <h3 className={`text-2xl font-bold mt-1 ${pendingAmount > 0 ? 'text-red-500' : 'text-emerald-400'}`}>{pendingAmount.toFixed(2)} €</h3>
                      </div>
                    </div>

                    {/* Gráfica de Multas por Mes del Jugador */}
                    <div className="bg-brand-black-card border border-brand-black-border p-4 rounded-xl">
                      <h4 className="text-xs font-bold text-brand-gray-light mb-4">Evolución de Multas ({selectedYear})</h4>
                      <div className="flex items-end justify-between gap-1 h-32 w-full pt-4">
                        {playerFinesByMonthData.map((d, i) => (
                          <div key={i} className="flex flex-col items-center flex-1 group">
                            <div className="w-full relative flex justify-center items-end h-full bg-brand-black-bg/50 rounded-t-sm">
                              <div 
                                className="w-full bg-brand-red-600/80 hover:bg-brand-red-500 rounded-t-sm transition-all relative"
                                style={{ height: `${(d.total / maxPlayerChartValue) * 100}%`, minHeight: d.total > 0 ? '4px' : '0' }}
                              >
                                <div className="opacity-0 group-hover:opacity-100 absolute -top-8 left-1/2 -translate-x-1/2 bg-brand-black border border-brand-black-border text-[10px] text-white px-2 py-1 rounded shadow-premium pointer-events-none whitespace-nowrap transition-opacity z-10">
                                  {d.total.toFixed(2)} €
                                </div>
                              </div>
                            </div>
                            <span className="text-[9px] text-brand-gray-muted mt-2">{d.name}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Listado de multas */}
              <div>
                <h3 className="text-lg font-bold text-brand-gray-light mb-3">Historial de Sanciones</h3>
                <div className="space-y-2">
                  {userFines.filter(f => f.user_id === selectedPlayerDetail.id).length === 0 ? (
                    <p className="text-sm text-brand-gray-muted text-center py-6">Sin multas registradas</p>
                  ) : (
                    userFines.filter(f => f.user_id === selectedPlayerDetail.id).map((fine) => (
                      <div key={fine.id} className="bg-brand-black-card border border-brand-black-border p-3 rounded-lg flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-sm font-semibold text-brand-gray-light">{fine.reason}</span>
                            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${
                              fine.status === 'Pagado'
                                ? 'bg-emerald-950/20 text-emerald-400'
                                : 'bg-red-950/20 text-red-500'
                            }`}>
                              {fine.status}
                            </span>
                          </div>
                          <span className="text-xs text-brand-gray-muted">{fine.date}</span>
                        </div>
                        <span className="text-sm font-bold text-brand-red-600">{Number(fine.amount).toFixed(2)} €</span>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
