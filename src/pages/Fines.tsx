import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { authService } from '../services/auth';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { Fine } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  ShieldAlert, Search, Download, FileText, Plus, Edit2, Trash2,
  User, CreditCard, Calendar, Check, AlertTriangle
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
    queryFn: () => authService.getProfiles(),
    enabled: canCreate || canEdit // Solo cargar perfiles si puede escribir o editar
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
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetUserId) {
      showToast('error', 'Validación', 'Debes seleccionar un jugador.');
      return;
    }
    if (!reason.trim()) {
      showToast('error', 'Validación', 'El motivo de la multa es obligatorio.');
      return;
    }
    if (Number(amount) <= 0) {
      showToast('error', 'Validación', 'El importe debe ser mayor que cero.');
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

  const totalFinesCount = userFines.length;
  const totalFinesAmount = userFines.reduce((acc, f) => acc + Number(f.amount), 0);
  const monthlyFinesAmount = userFines.filter(f => filterByDate(f.date)).reduce((acc, f) => acc + Number(f.amount), 0);

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
      f.profiles?.full_name || 'Desconocido',
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
        
        {/* Multas Totales */}
        <div className="dashboard-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Sanciones</span>
            <h3 className="text-2xl font-bold text-brand-gray-light mt-2">{totalFinesCount}</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Multas acumuladas en total</span>
          </div>
          <div className="p-3 bg-brand-red-600/10 text-brand-red-600 rounded-xl">
            <ShieldAlert className="w-6 h-6" />
          </div>
        </div>

        {/* Importe Total Acumulado */}
        <div className="dashboard-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Deuda / Total</span>
            <h3 className="text-2xl font-bold text-brand-red-600 mt-2">{totalFinesAmount.toFixed(2)} €</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Balance histórico de sanciones</span>
          </div>
          <div className="p-3 bg-brand-red-600/10 text-brand-red-600 rounded-xl">
            <CreditCard className="w-6 h-6" />
          </div>
        </div>

        {/* Acumulado Mensual */}
        <div className="dashboard-card p-5 flex items-center justify-between">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Total Mensual</span>
            <h3 className="text-2xl font-bold text-brand-red-600 mt-2">{monthlyFinesAmount.toFixed(2)} €</h3>
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
      </div>

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
                        <span>{fine.profiles?.full_name || 'Desconocido'}</span>
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
                      <Calendar className="w-3.5 h-3.5" /> {fine.date} | <User className="w-3.5 h-3.5" /> {fine.profiles?.full_name || 'Desconocido'}
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
                  {p.full_name} ({p.email})
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
                  onClick={() => { setReason(ft.label); setAmount(String(ft.amount)); }}
                  className={`text-[10px] font-medium px-2.5 py-1 rounded-full border transition-all ${
                    reason === ft.label
                      ? 'bg-brand-red-600/20 text-brand-red-600 border-brand-red-600/50'
                      : 'bg-brand-black-hover text-brand-gray-muted border-brand-black-border hover:text-brand-gray-light hover:border-brand-gray-dark'
                  }`}
                >
                  {ft.label} · {ft.amount}€
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
            <label className="form-label">Motivo o Descripción de la Falta</label>
            <input
              type="text"
              className="form-input"
              placeholder="Retraso de 15 minutos en la convocatoria o usar móvil"
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
                  onClick={() => { setAmount(String(pa)); setStatus('Pagado'); }}
                  className={`text-[10px] font-semibold px-3 py-1 rounded-full border transition-all ${
                    status === 'Pagado' && amount === String(pa)
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/50'
                      : 'bg-brand-black-hover text-brand-gray-muted border-brand-black-border hover:text-emerald-400 hover:border-emerald-500/40'
                  }`}
                >
                  Pagado {pa}€
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
    </div>
  );
};
