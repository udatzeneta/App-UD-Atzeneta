import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { TableSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { Training } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  Dumbbell, Search, Download, FileText, Plus, Edit2, Trash2,
  Clock, MapPin, Calendar, Users
} from 'lucide-react';

export const Trainings: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();

  const canCreate = hasPermission('trainings', 'crear');
  const canEdit = hasPermission('trainings', 'editar');
  const canDelete = hasPermission('trainings', 'eliminar');
  const canExport = hasPermission('trainings', 'exportar');

  const [search, setSearch] = useState('');
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingTraining, setEditingTraining] = useState<Training | null>(null);

  // Campos del formulario
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');
  const [duration, setDuration] = useState('90');
  const [objective, setObjective] = useState('');
  const [observations, setObservations] = useState('');

  // Query
  const { data: trainings = [], isLoading } = useQuery({
    queryKey: ['trainings'],
    queryFn: () => dataService.getTrainings()
  });

  const { data: attendanceList = [] } = useQuery({
    queryKey: ['training_attendance'],
    queryFn: () => dataService.getAllAttendance()
  });

  const { data: players = [] } = useQuery({
    queryKey: ['players'],
    queryFn: () => dataService.getPlayers()
  });

  const getAttendanceStats = (trainingId: string) => {
    const sessionAtt = attendanceList.filter(a => a.training_id === trainingId && (a.status === 'ENT' || a.player_intent === true));
    let gkCount = 0;
    let fieldCount = 0;
    sessionAtt.forEach(att => {
      const p = players.find(x => x.id === att.player_id);
      if (p) {
        if (p.position === 'Portero') gkCount++;
        else fieldCount++;
      }
    });
    return { total: sessionAtt.length, gkCount, fieldCount };
  };

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: (item: Omit<Training, 'id'>) => dataService.createTraining(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      showToast('success', 'Sesión programada', 'Se ha agendado la sesión de entrenamiento.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<Training> }) => dataService.updateTraining(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      showToast('success', 'Sesión modificada', 'Se ha guardado la modificación del entrenamiento.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteTraining(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['trainings'] });
      showToast('success', 'Sesión eliminada', 'El entrenamiento ha sido retirado de la base de datos.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleOpenCreateModal = () => {
    setEditingTraining(null);
    setDate(new Date().toISOString().split('T')[0]);
    setTime('18:00');
    setLocation('Campo Municipal El Porrejat');
    setDuration('90');
    setObjective('');
    setObservations('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (t: Training) => {
    setEditingTraining(t);
    setDate(t.date);
    setTime(t.time);
    setLocation(t.location);
    setDuration(String(t.duration));
    setObjective(t.objective);
    setObservations(t.observations);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingTraining(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!location.trim()) {
      showToast('error', 'Validación', 'El lugar del entrenamiento es obligatorio.');
      return;
    }
    if (!objective.trim()) {
      showToast('error', 'Validación', 'El objetivo de la sesión es obligatorio.');
      return;
    }

    const payload = {
      date,
      time,
      location: location.trim(),
      duration: Number(duration),
      objective: objective.trim(),
      observations: observations.trim()
    };

    if (editingTraining) {
      updateMutation.mutate({ id: editingTraining.id, item: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Deseas dar de baja este entrenamiento?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filtrado por fecha para estadísticas
  const filterByDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.getMonth() + 1 === selectedMonth && d.getFullYear() === selectedYear;
  };

  const totalTrainingsCount = trainings.length;
  const monthlyTrainingsCount = trainings.filter(t => filterByDate(t.date)).length;

  const sortedTrainingsChronologically = [...trainings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const getTrainingNumber = (id: string) => {
    const index = sortedTrainingsChronologically.findIndex(t => t.id === id);
    return index !== -1 ? index + 1 : 0;
  };

  const filteredTrainings = trainings.filter(t => {
    const matchSearch = t.objective.toLowerCase().includes(search.toLowerCase()) || t.location.toLowerCase().includes(search.toLowerCase());
    return matchSearch;
  }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Datos de exportación (definidos una sola vez, reutilizados por CSV y PDF)
  const exportHeaders = ['Fecha', 'Hora', 'Lugar', 'Duración (Mins)', 'Objetivo', 'Observaciones'];
  const buildExportRows = (): ExportCell[][] =>
    filteredTrainings.map(t => [
      t.date,
      t.time,
      t.location,
      t.duration,
      t.objective,
      t.observations,
    ]);

  const handleExportCSV = () => {
    if (filteredTrainings.length === 0) {
      showToast('info', 'Exportar', 'No hay entrenamientos para exportar.');
      return;
    }
    exportToCSV(`entrenamientos_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Exportado el histórico de entrenamientos.');
  };

  const handleExportPDF = async () => {
    if (filteredTrainings.length === 0) {
      showToast('info', 'Exportar', 'No hay entrenamientos para exportar.');
      return;
    }
    await exportToPDF('Entrenamientos UD Atzeneta', `entrenamientos_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Exportado el histórico de entrenamientos en PDF.');
  };

  const months = [
    { value: 1, label: 'Enero' }, { value: 2, label: 'Febrero' }, { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' }, { value: 5, label: 'Mayo' }, { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' }, { value: 8, label: 'Agosto' }, { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' }, { value: 11, label: 'Noviembre' }, { value: 12, label: 'Diciembre' }
  ];

  return (
    <div className="space-y-6">
      {/* Cabecera de Página */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Sesiones de Entrenamiento</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Programación y objetivos de la preparación física y táctica del vestuario.
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
              <Plus className="w-3.5 h-3.5" /> Programar Sesión
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          BLOQUES DE ESTADÍSTICAS
          ===================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Acumulado General */}
        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Acumulado General</span>
            <h3 className="text-2xl font-bold text-brand-gray-light mt-2">{totalTrainingsCount}</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Sesiones totales de temporada</span>
          </div>
          <div className="p-3 bg-brand-red-600/10 text-brand-red-600 rounded-xl">
            <Dumbbell className="w-6 h-6" />
          </div>
        </div>

        {/* Acumulado Mensual */}
        <div className="dashboard-card flex items-center justify-between p-5">
          <div>
            <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-gray-muted block">Conteo Mensual</span>
            <h3 className="text-2xl font-bold text-brand-gray-light mt-2">{monthlyTrainingsCount}</h3>
            <span className="text-[10px] text-brand-gray-muted mt-1 block">Sesiones en el mes seleccionado</span>
          </div>
          <div className="flex flex-col items-end gap-2">
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
            placeholder="Buscar por lugar u objetivo (ej. El Porrejat, transiciones)..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* =====================================================================
          TABLA / CARDS
          ===================================================================== */}
      {isLoading ? (
        <TableSkeleton />
      ) : filteredTrainings.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No se registran entrenamientos con los parámetros actuales.</p>
        </div>
      ) : (
        <>
          {/* Escritorio */}
          <div className="hidden md:block bg-brand-black border border-brand-black-border rounded-xl overflow-hidden shadow-premium">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th className="table-th">Fecha / Hora</th>
                  <th className="table-th">Objetivo</th>
                  <th className="table-th">Lugar</th>
                  <th className="table-th">Duración</th>
                  <th className="table-th">Asistencia</th>
                  {(canEdit || canDelete) && <th className="table-th text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-black-border bg-brand-black-card/10">
                {filteredTrainings.map((t) => (
                  <tr key={t.id} className="hover:bg-brand-black-hover/20 transition-colors">
                    <td className="table-td">
                      <div className="flex flex-col">
                        <span className="font-semibold text-brand-gray-light">Sesión {getTrainingNumber(t.id)}</span>
                        <span className="text-[11px] text-brand-gray-muted mt-0.5">{t.date} | {t.time} hs</span>
                      </div>
                    </td>
                    <td className="table-td">
                      <div className="flex flex-col max-w-sm">
                        <span className="font-semibold text-brand-gray-light truncate" title={t.objective}>
                          {t.objective}
                        </span>
                        {t.observations && (
                          <span className="text-[11px] text-brand-gray-muted truncate italic mt-0.5">
                            {t.observations}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="table-td text-brand-gray-light">
                      <a
                        href={t.location.startsWith('http') ? t.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location)}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 hover:text-brand-red-600 hover:underline transition-colors"
                        title="Ver ubicación en Google Maps"
                      >
                        <MapPin className="w-3.5 h-3.5 text-brand-red-600 shrink-0" />
                        <span>{t.location}</span>
                      </a>
                    </td>
                    <td className="table-td text-brand-gray-muted font-medium">{t.duration} min</td>
                    <td className="table-td">
                      {(() => {
                        const stats = getAttendanceStats(t.id);
                        return (
                          <div className="flex flex-col">
                            <span className="font-semibold text-brand-gray-light">{stats.total} asistentes</span>
                            {stats.total > 0 && <span className="text-[11px] text-brand-gray-muted mt-0.5">{stats.gkCount} Porteros, {stats.fieldCount} Jugadores</span>}
                          </div>
                        );
                      })()}
                    </td>
                    {(canEdit || canDelete) && (
                      <td className="table-td text-right">
                        <div className="flex gap-2 justify-end">
                          {canEdit && (
                            <button 
                              onClick={() => handleOpenEditModal(t)}
                              className="text-brand-gray-muted hover:text-brand-gray-light p-1.5 rounded bg-brand-black-hover hover:bg-brand-black-border border border-brand-black-border transition-all"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {canDelete && (
                            <button 
                              onClick={() => handleDelete(t.id)}
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

          {/* Móvil */}
          <div className="md:hidden space-y-3.5">
            {filteredTrainings.map((t) => (
              <div key={t.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 shadow-premium space-y-3.5">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="text-sm font-semibold text-brand-gray-light">Sesión {getTrainingNumber(t.id)}: {t.objective}</h4>
                    <span className="text-[11px] text-brand-gray-muted flex items-center gap-1 mt-1">
                      <Calendar className="w-3.5 h-3.5" /> {t.date} | <Clock className="w-3.5 h-3.5" /> {t.time} hs
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-1.5 text-xs text-brand-gray-muted bg-brand-black/40 p-2.5 rounded-lg border border-brand-black-border/50">
                  <a
                    href={t.location.startsWith('http') ? t.location : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(t.location)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 hover:text-brand-red-600 hover:underline transition-colors w-fit"
                    title="Ver ubicación en Google Maps"
                  >
                    <MapPin className="w-3.5 h-3.5 text-brand-red-600 shrink-0" />
                    <span>{t.location}</span>
                  </a>
                  <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5 text-brand-red-600" /> {t.duration} minutos de duración</span>
                  {(() => {
                    const stats = getAttendanceStats(t.id);
                    return (
                      <span className="flex items-center gap-1.5">
                        <Users className="w-3.5 h-3.5 text-brand-red-600" /> 
                        {stats.total} asistentes {stats.total > 0 ? `(${stats.gkCount} PT, ${stats.fieldCount} JUG)` : ''}
                      </span>
                    );
                  })()}
                </div>

                {t.observations && (
                  <p className="text-xs text-brand-gray-dark border-t border-brand-black-border pt-2 leading-relaxed italic">
                    Obs: {t.observations}
                  </p>
                )}

                {(canEdit || canDelete) && (
                  <div className="flex justify-end gap-2 border-t border-brand-black-border pt-3">
                    {canEdit && (
                      <button 
                        onClick={() => handleOpenEditModal(t)}
                        className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-gray-light flex items-center gap-1"
                      >
                        <Edit2 className="w-3 h-3" /> Editar
                      </button>
                    )}
                    {canDelete && (
                      <button 
                        onClick={() => handleDelete(t.id)}
                        className="text-xs text-brand-gray-muted bg-brand-black px-3 py-1.5 rounded border border-brand-black-border hover:text-brand-red-600 flex items-center gap-1"
                      >
                        <Trash2 className="w-3 h-3" /> Borrar
                      </button>
                    )}
                  </div>
                )}
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
        title={editingTraining ? 'Modificar Sesión' : 'Programar Nueva Sesión'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Fecha</label>
              <input
                type="date"
                className="form-input"
                value={date}
                onChange={(e) => setDate(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Hora de Inicio</label>
              <input
                type="time"
                className="form-input"
                value={time}
                onChange={(e) => setTime(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Lugar / Cancha</label>
              <input
                type="text"
                className="form-input"
                placeholder="Campo Municipal El Porrejat"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
              />
              <p className="text-[9px] text-brand-gray-muted mt-1 leading-tight">
                📍 Se enlazará automáticamente a Google Maps.
              </p>
            </div>
            <div>
              <label className="form-label">Duración (minutos)</label>
              <input
                type="number"
                min="1"
                className="form-input"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="form-label">Objetivo Principal de la Sesión</label>
            <input
              type="text"
              className="form-input"
              placeholder="Fase defensiva, presión en bloque, balón parado..."
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
            />
          </div>

          <div>
            <label className="form-label">Observaciones y Requisitos (Opcional)</label>
            <textarea
              className="form-input h-20 resize-none"
              placeholder="Traer calzado adecuado, hidratación, revisión de vídeos previa..."
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Sesión
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
};
