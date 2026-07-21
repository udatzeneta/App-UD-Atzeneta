import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';

interface FuerzaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogoEjercicios: any[];
  editData?: any;
}
export const FuerzaFormModal: React.FC<FuerzaFormModalProps> = ({ isOpen, onClose, catalogoEjercicios, editData }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [plantilla, setPlantilla] = useState<'primer_equipo' | 'juvenil'>('primer_equipo');
  const [tipo, setTipo] = useState<'tabata' | 'repeticiones'>('repeticiones');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  // Guardamos un array de ejercicios seleccionados con sus metadatos.
  const [ejerciciosSeleccionados, setEjerciciosSeleccionados] = useState<{ tempId: string; id: string; repeticiones: string; tiempo: string; comentarios: string }[]>([]);
  const [currentSelection, setCurrentSelection] = useState('');

  React.useEffect(() => {
    if (isOpen && editData) {
      setPlantilla(editData.plantilla || 'primer_equipo');
      setTipo(editData.tipo || 'repeticiones');
      setFecha(editData.fecha ? editData.fecha.split('T')[0] : new Date().toISOString().split('T')[0]);
      // editData.ejercicios might be an array of objects now, or just IDs if legacy
      if (editData.ejercicios && editData.ejercicios.length > 0) {
        if (typeof editData.ejercicios[0] === 'string') {
          setEjerciciosSeleccionados(editData.ejercicios.map((id: string) => ({ tempId: crypto.randomUUID(), id, repeticiones: '', tiempo: '', comentarios: '' })));
        } else {
          setEjerciciosSeleccionados(editData.ejercicios.map((ej: any) => ({ ...ej, tempId: ej.tempId || crypto.randomUUID() })));
        }
      } else {
        setEjerciciosSeleccionados([]);
      }
    } else if (isOpen && !editData) {
      setPlantilla('primer_equipo');
      setTipo('repeticiones');
      setFecha(new Date().toISOString().split('T')[0]);
      setEjerciciosSeleccionados([]);
    }
  }, [isOpen, editData]);

  const mutation = useMutation({
    mutationFn: async () => {
      let sessionId = editData?.id;

      if (sessionId) {
        const { error: sesionError } = await supabase
          .from('fuerza_sesiones')
          .update({ plantilla, tipo, fecha })
          .eq('id', sessionId);
        if (sesionError) throw sesionError;
        
        const { error: delError } = await supabase
          .from('fuerza_sesion_ejercicios')
          .delete()
          .eq('sesion_id', sessionId);
        if (delError) throw delError;
      } else {
        const { data: sesionData, error: sesionError } = await supabase
          .from('fuerza_sesiones')
          .insert({ plantilla, tipo, fecha })
          .select('id')
          .single();
        if (sesionError) throw sesionError;
        sessionId = sesionData.id;
      }
      
      if (ejerciciosSeleccionados.length > 0) {
        const registrosEjercicios = ejerciciosSeleccionados.map(ej => ({
          sesion_id: sessionId,
          ejercicio_id: ej.id,
          repeticiones: ej.repeticiones || null,
          tiempo: ej.tiempo || null,
          comentarios: ej.comentarios || null
        }));
        
        const { error: ejerciciosError } = await supabase
          .from('fuerza_sesion_ejercicios')
          .insert(registrosEjercicios);
          
        if (ejerciciosError) throw ejerciciosError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['fuerza_sesiones'] });
      queryClient.invalidateQueries({ queryKey: ['fuerza_sesion_ejercicios'] });
      showToast('success', editData ? 'Sesión de fuerza actualizada' : 'Sesión de fuerza registrada');
      onClose();
      // Reset form
      setEjerciciosSeleccionados([]);
      setCurrentSelection('');
    },
    onError: (error) => {
      console.error(error);
      showToast('error', 'Error al guardar la sesión');
    }
  });

  const handleAddEjercicio = () => {
    if (currentSelection) {
      setEjerciciosSeleccionados([...ejerciciosSeleccionados, { tempId: crypto.randomUUID(), id: currentSelection, repeticiones: '', tiempo: '', comentarios: '' }]);
      setCurrentSelection('');
    }
  };

  const handleRemoveEjercicio = (tempId: string) => {
    setEjerciciosSeleccionados(ejerciciosSeleccionados.filter(e => e.tempId !== tempId));
  };

  const updateEjercicioData = (tempId: string, field: 'repeticiones' | 'tiempo' | 'comentarios', value: string) => {
    setEjerciciosSeleccionados(ejerciciosSeleccionados.map(e => e.tempId === tempId ? { ...e, [field]: value } : e));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Editar Sesión de Fuerza" : "Registrar Sesión de Fuerza"} maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-5">
        
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Plantilla</label>
            <select
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={plantilla}
              onChange={(e) => setPlantilla(e.target.value as any)}
            >
              <option value="primer_equipo">Primer Equipo</option>
              <option value="juvenil">Juvenil</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Tipo de Sesión</label>
            <select
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as any)}
            >
              <option value="repeticiones">Por Repeticiones</option>
              <option value="tabata">Tabata</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-gray-light mb-1">Fecha</label>
          <input 
            type="date" 
            required
            className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2" 
            value={fecha} 
            onChange={e => setFecha(e.target.value)} 
          />
        </div>

        <div className="border-t border-brand-black-border pt-4">
          <label className="block text-sm font-semibold text-brand-gray-light mb-2">Ejercicios Realizados</label>
          <div className="flex gap-2 mb-3">
            <select
              className="flex-1 bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={currentSelection}
              onChange={(e) => setCurrentSelection(e.target.value)}
            >
              <option value="">-- Seleccionar Ejercicio --</option>
              {catalogoEjercicios.map(ex => (
                <option key={ex.id} value={ex.id}>
                  {ex.nombre}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={handleAddEjercicio}
              disabled={!currentSelection}
              className="px-4 py-2 bg-brand-black-hover border border-brand-black-border text-white rounded-lg text-sm disabled:opacity-50 hover:bg-brand-gray-dark transition-colors"
            >
              Añadir
            </button>
          </div>

          {ejerciciosSeleccionados.length > 0 ? (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-2 no-scrollbar">
              {ejerciciosSeleccionados.map((item, index) => {
                const ex = catalogoEjercicios.find(e => e.id === item.id);
                return (
                  <div key={item.tempId} className="bg-brand-black-card border border-brand-black-border p-4 rounded-lg flex flex-col gap-3">
                    <div className="flex justify-between items-center">
                      <span className="text-brand-gray-light font-semibold text-sm">
                        <span className="text-brand-red-600 mr-2">{index + 1}.</span>{ex?.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleRemoveEjercicio(item.tempId)}
                        className="text-brand-gray-light hover:text-brand-red-600 transition-colors text-xs"
                      >
                        Eliminar
                      </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-[10px] font-medium text-brand-gray-muted uppercase mb-1">Repeticiones / Series</label>
                        <input
                          type="text"
                          className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded p-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
                          placeholder="Ej: 4x10"
                          value={item.repeticiones}
                          onChange={(e) => updateEjercicioData(item.tempId, 'repeticiones', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-brand-gray-muted uppercase mb-1">Tiempo de trabajo</label>
                        <input
                          type="text"
                          className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded p-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
                          placeholder="Ej: 30s"
                          value={item.tiempo}
                          onChange={(e) => updateEjercicioData(item.tempId, 'tiempo', e.target.value)}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-medium text-brand-gray-muted uppercase mb-1">Observaciones</label>
                      <input
                        type="text"
                        className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded p-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
                        placeholder="Opcional..."
                        value={item.comentarios}
                        onChange={(e) => updateEjercicioData(item.tempId, 'comentarios', e.target.value)}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-brand-gray-muted italic bg-brand-black p-3 rounded-lg text-center">
              No has añadido ejercicios a esta sesión.
            </p>
          )}
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-brand-black-border">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-gray-muted hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg text-sm font-semibold shadow-glow-red disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : (editData ? 'Actualizar Sesión' : 'Registrar Sesión')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
