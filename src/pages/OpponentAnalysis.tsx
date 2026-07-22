import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { CardSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { OpponentAnalysis } from '../types';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  Plus, Search, Edit2, Trash2, Download,
  Settings as TacticalIcon, ShieldAlert, Award, FileText
} from 'lucide-react';
import { OpponentAnalysisEditor } from '../components/opponent_analysis/OpponentAnalysisEditor';

export const OpponentAnalysisPage: React.FC = () => {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();

  const canCreate = hasPermission('opponent_analysis', 'crear');
  const canEdit = hasPermission('opponent_analysis', 'editar');
  const canDelete = hasPermission('opponent_analysis', 'eliminar');
  const canExport = hasPermission('opponent_analysis', 'exportar');

  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAnalysis, setEditingAnalysis] = useState<OpponentAnalysis | null>(null);

  // Queries
  const { data: analysisList = [], isLoading } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis()
  });

  const { data: teamsList = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: () => dataService.getTeams()
  });

  const { data: scoutingList = [] } = useQuery({
    queryKey: ['scouting'],
    queryFn: () => dataService.getScouting()
  });

  // Preparar opciones del selector de equipos
  const ffcvTeams = teamsList.map(t => t.name).sort();
  
  // Equipos únicos de scouting que no estén ya en FFCV
  const scoutingTeams = Array.from(
    new Set(
      scoutingList
        .map(p => p.team)
        .filter(t => t && !ffcvTeams.includes(t))
    )
  ).sort();

  // Mutaciones
  const createMutation = useMutation({
    mutationFn: (item: Omit<OpponentAnalysis, 'id'>) => dataService.createOpponentAnalysis(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] });
      showToast('success', 'Análisis creado', 'Se ha guardado la ficha táctica del rival.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<OpponentAnalysis> }) => dataService.updateOpponentAnalysis(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] });
      showToast('success', 'Análisis actualizado', 'Se guardaron los cambios tácticos.');
      handleCloseModal();
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteOpponentAnalysis(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] });
      showToast('success', 'Análisis eliminado', 'Se ha retirado la ficha táctica.');
    },
    onError: (err) => showToast('error', 'Error', err.message)
  });

  const handleOpenCreateModal = () => {
    setEditingAnalysis(null);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (oa: OpponentAnalysis) => {
    setEditingAnalysis(oa);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingAnalysis(null);
  };

  const handleSave = (payload: Partial<OpponentAnalysis>, isManual: boolean, oppSelect: string, oppManual: string) => {
    const finalOpponent = isManual ? oppManual.trim() : oppSelect.trim();
    if (!finalOpponent) {
      showToast('error', 'Validación', 'El nombre del rival es obligatorio.');
      return;
    }
    if (!payload.tactical_system?.trim()) {
      showToast('error', 'Validación', 'El sistema táctico es obligatorio.');
      return;
    }

    const finalPayload = {
      ...payload,
      opponent: finalOpponent
    };

    if (editingAnalysis) {
      updateMutation.mutate({ id: editingAnalysis.id, item: finalPayload });
    } else {
      createMutation.mutate(finalPayload as Omit<OpponentAnalysis, 'id'>);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Eliminar definitivamente este informe táctico del rival?')) {
      deleteMutation.mutate(id);
    }
  };

  const filteredList = analysisList.filter(oa => 
    oa.opponent.toLowerCase().includes(search.toLowerCase()) ||
    oa.tactical_system.toLowerCase().includes(search.toLowerCase())
  );

  // Datos de exportación (definidos una sola vez, reutilizados por CSV y PDF)
  const exportHeaders = ['Rival', 'Sistema Táctico', 'Fortalezas', 'Debilidades', 'Jugadores Clave', 'Observaciones'];
  const buildExportRows = (): ExportCell[][] =>
    filteredList.map(oa => [
      oa.opponent,
      oa.tactical_system,
      oa.strengths.join('; '),
      oa.weaknesses.join('; '),
      oa.key_players.join('; '),
      oa.observations,
    ]);

  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      showToast('info', 'Exportar', 'No hay análisis en la lista para exportar.');
      return;
    }
    exportToCSV(`analisis_rivales_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Exportados los análisis de rivales.');
  };

  const handleExportPDF = async () => {
    if (filteredList.length === 0) {
      showToast('info', 'Exportar', 'No hay análisis en la lista para exportar.');
      return;
    }
    await exportToPDF('Análisis de Rivales · UD Atzeneta', `analisis_rivales_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Exportados los análisis de rivales en PDF.');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Análisis de Rivales</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Planteamiento estratégico, sistemas de juego y fichas detalladas de los contrincantes directos.
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
              <Plus className="w-3.5 h-3.5" /> Nuevo Análisis
            </button>
          )}
        </div>
      </div>

      {/* Buscador */}
      <div className="relative bg-brand-black border border-brand-black-border p-4 rounded-xl">
        <Search className="absolute left-7 top-6.5 w-4 h-4 text-brand-gray-dark" />
        <input
          type="text"
          className="form-input pl-10 w-full"
          placeholder="Buscar por club rival (ej. CD Alcoyano)..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      {/* Grid de informes */}
      {isLoading ? (
        <div className="grid grid-cols-1 gap-6">
          <CardSkeleton />
        </div>
      ) : filteredList.length === 0 ? (
        <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
          <p className="text-sm text-brand-gray-muted">No se registran análisis de rivales actualmente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {filteredList.map((analysis) => {
            const teamInfo = teamsList.find(t => t.name.toLowerCase() === analysis.opponent.toLowerCase());

            return (
            <div key={analysis.id} className="dashboard-card flex flex-col justify-between p-0 overflow-hidden relative group z-0">
              
              {/* Escudo diagonal de fondo */}
              {teamInfo?.shield_url && (
                <div className="absolute -right-12 sm:-right-24 -bottom-12 sm:-bottom-24 w-64 sm:w-[400px] aspect-square opacity-[0.05] group-hover:opacity-[0.08] pointer-events-none transition-opacity duration-500 transform -rotate-[25deg] -z-10">
                  <img 
                    src={teamInfo.shield_url} 
                    alt={analysis.opponent} 
                    className="w-full h-full object-contain"
                  />
                </div>
              )}

              <div 
                className="p-6 space-y-6 cursor-pointer hover:bg-brand-black-hover/40 transition-colors"
                onClick={() => navigate(`/opponent-analysis/${analysis.id}`)}
              >
                {/* Bloque Cabecera Ficha */}
              <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-brand-black-border pb-4">
                <div>
                  <h3 className="text-lg font-bold text-brand-gray-light">{analysis.opponent}</h3>
                  <span className="text-xs text-brand-gray-muted mt-1 inline-block">
                    Planteamiento táctico del partido
                  </span>
                </div>
                <div className="flex items-center gap-2 bg-brand-black border border-brand-black-border px-3 py-1.5 rounded-lg w-fit">
                  <TacticalIcon className="w-4 h-4 text-brand-red-600 shrink-0" />
                  <span className="text-xs font-bold text-brand-gray-light">Sistema: {analysis.tactical_system}</span>
                </div>
              </div>

              {/* Bloque 3 Columnas: Fortalezas, Debilidades y Jugadores Clave */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                
                {/* Fortalezas (Red pills) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.strengths.length === 0 ? (
                      <span className="text-xs text-brand-gray-dark italic">Ninguna reportada</span>
                    ) : (
                      analysis.strengths.map((s, idx) => (
                        <span key={idx} className="text-[10px] bg-red-950/25 text-brand-red-500 border border-brand-red-600/20 px-2 py-0.5 rounded-full font-medium">
                          {s}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Debilidades (Amber pills) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted flex items-center gap-1.5">
                    <ShieldAlert className="w-4 h-4 text-amber-500" /> Puntos Débiles
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.weaknesses.length === 0 ? (
                      <span className="text-xs text-brand-gray-dark italic">Ninguno reportado</span>
                    ) : (
                      analysis.weaknesses.map((w, idx) => (
                        <span key={idx} className="text-[10px] bg-amber-950/25 text-amber-500 border border-amber-500/20 px-2 py-0.5 rounded-full font-medium">
                          {w}
                        </span>
                      ))
                    )}
                  </div>
                </div>

                {/* Jugadores Clave (Emerald pills) */}
                <div className="space-y-3">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-brand-gray-muted flex items-center gap-1.5">
                    <Award className="w-4 h-4 text-emerald-500" /> Jugadores Peligrosos
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {analysis.key_players.length === 0 ? (
                      <span className="text-xs text-brand-gray-dark italic">Ninguno destacado</span>
                    ) : (
                      analysis.key_players.map((kp, idx) => (
                        <span key={idx} className="text-[10px] bg-emerald-950/25 text-emerald-500 border border-emerald-500/20 px-2 py-0.5 rounded-full font-medium">
                          {kp}
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>

              {/* Observaciones Estratégicas */}
              {analysis.observations && (
                <div className="space-y-2 bg-brand-black/40 border border-brand-black-border p-4 rounded-xl">
                  <span className="text-xs font-semibold text-brand-gray-muted flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-brand-red-600" /> Plan de Partido / Observaciones
                  </span>
                  <p className="text-xs text-brand-gray-light leading-relaxed whitespace-pre-line">
                    {analysis.observations}
                  </p>
                </div>
              )}
              </div>

              {/* Acciones de Edición/Borrado */}
              {(canEdit || canDelete) && (
                <div className="flex justify-end gap-2 border-t border-brand-black-border p-4 bg-brand-black/30">
                  {canEdit && (
                    <button 
                      onClick={() => navigate(`/opponent-analysis/${analysis.id}`)}
                      className="text-xs text-brand-gray-muted bg-brand-black px-3.5 py-2 rounded-lg border border-brand-black-border hover:text-brand-gray-light flex items-center gap-1.5 transition-colors"
                    >
                      <Edit2 className="w-3.5 h-3.5" /> Editar Bloques
                    </button>
                  )}
                  {canDelete && (
                    <button 
                      onClick={() => handleDelete(analysis.id)}
                      className="text-xs text-brand-gray-muted bg-brand-black px-3.5 py-2 rounded-lg border border-brand-black-border hover:text-brand-red-600 flex items-center gap-1.5 transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" /> Eliminar Ficha
                    </button>
                  )}
                </div>
              )}
            </div>
          )})}
        </div>
      )}

      {/* =====================================================================
          MODAL CREAR / EDITAR
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingAnalysis ? `Editar Informe: ${editingAnalysis.opponent}` : 'Registrar Análisis del Rival'}
        maxWidth="max-w-[1200px]"
      >
        <OpponentAnalysisEditor
          initialData={editingAnalysis}
          onSave={handleSave}
          onCancel={handleCloseModal}
          ffcvTeams={ffcvTeams}
          scoutingTeams={scoutingTeams}
        />
      </Modal>
    </div>
  );
};
