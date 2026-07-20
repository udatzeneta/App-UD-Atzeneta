import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';

interface FuerzaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  catalogoEjercicios: any[];
}

export const FuerzaFormModal: React.FC<FuerzaFormModalProps> = ({ isOpen, onClose, catalogoEjercicios }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [plantilla, setPlantilla] = useState<'primer_equipo' | 'juvenil'>('primer_equipo');
  const [tipo, setTipo] = useState<'tabata' | 'repeticiones'>('repeticiones');
  const [fecha, setFecha] = useState(new Date().toISOString().split('T')[0]);
  
  // Guardamos un array de ejercicios seleccionados.
  const [ejerciciosSeleccionados, setEjerciciosSeleccionados] = useState<string[]>([]);
  const [currentSelection, setCurrentSelection] = useState('');

  const mutation = useMutation({
    mutationFn: async () => {
      // 1. Insertar la sesión de fuerza
      const { data: sesionData, error: sesionError } = await supabase
        .from('fuerza_sesiones')
        .insert({
          plantilla,
          tipo,
          fecha
        })
        .select('id')
        .single();
        
      if (sesionError) throw sesionError;
      
      // 2. Si hay ejercicios, insertar en la tabla de relación
      if (ejerciciosSeleccionados.length > 0) {
        const registrosEjercicios = ejerciciosSeleccionados.map(ej_id => ({
          sesion_id: sesionData.id,
          ejercicio_id: ej_id
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
      showToast('success', 'Sesión de fuerza registrada');
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
    if (currentSelection && !ejerciciosSeleccionados.includes(currentSelection)) {
      setEjerciciosSeleccionados([...ejerciciosSeleccionados, currentSelection]);
      setCurrentSelection('');
    }
  };

  const handleRemoveEjercicio = (id: string) => {
    setEjerciciosSeleccionados(ejerciciosSeleccionados.filter(e => e !== id));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Registrar Sesión de Fuerza" maxWidth="max-w-xl">
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
                <option key={ex.id} value={ex.id} disabled={ejerciciosSeleccionados.includes(ex.id)}>
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
            <ul className="space-y-2 max-h-40 overflow-y-auto pr-2 no-scrollbar">
              {ejerciciosSeleccionados.map(id => {
                const ex = catalogoEjercicios.find(e => e.id === id);
                return (
                  <li key={id} className="flex justify-between items-center bg-brand-black-card border border-brand-black-border p-2.5 rounded-lg text-sm text-brand-gray-light">
                    <span>{ex?.nombre}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveEjercicio(id)}
                      className="text-brand-red-600 hover:text-brand-red-500 text-xs font-semibold"
                    >
                      Quitar
                    </button>
                  </li>
                );
              })}
            </ul>
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
            {mutation.isPending ? 'Guardando...' : 'Registrar Sesión'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
