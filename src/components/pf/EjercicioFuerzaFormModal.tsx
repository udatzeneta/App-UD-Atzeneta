import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';

interface EjercicioFuerzaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const EjercicioFuerzaFormModal: React.FC<EjercicioFuerzaFormModalProps> = ({ isOpen, onClose }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [nombre, setNombre] = useState('');
  const [grupos, setGrupos] = useState<string>(''); // Comma separated for now
  const [imagenUrl, setImagenUrl] = useState('');
  const [zona, setZona] = useState<'anterior' | 'posterior' | 'ambos'>('ambos');
  const [tren, setTren] = useState<'superior' | 'inferior' | 'full_body'>('superior');
  const [patron, setPatron] = useState<'empuje' | 'tiron' | 'mixto' | 'ninguno'>('ninguno');

  const mutation = useMutation({
    mutationFn: async () => {
      const gruposArray = grupos.split(',').map(g => g.trim()).filter(Boolean);
      
      const { error } = await supabase
        .from('ejercicios_fuerza')
        .insert({
          nombre,
          grupos: gruposArray,
          imagen_url: imagenUrl || null,
          zona,
          tren,
          patron: tren === 'superior' ? patron : 'ninguno'
        });
        
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ejercicios_fuerza'] });
      showToast('success', 'Ejercicio creado correctamente');
      onClose();
      // Reset form
      setNombre('');
      setGrupos('');
      setImagenUrl('');
      setZona('ambos');
      setTren('superior');
      setPatron('ninguno');
    },
    onError: (error) => {
      console.error(error);
      showToast('error', 'Error al crear el ejercicio');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Crear Ejercicio de Fuerza" maxWidth="max-w-xl">
      <form onSubmit={handleSubmit} className="space-y-4">
        
        <div>
          <label className="block text-xs font-medium text-brand-gray-light mb-1">Nombre del Ejercicio</label>
          <input 
            type="text" 
            required
            className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2 focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none" 
            value={nombre} 
            onChange={e => setNombre(e.target.value)} 
            placeholder="Ej. Press Banca"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-gray-light mb-1">Grupos Musculares (separados por coma)</label>
          <input 
            type="text" 
            className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2 focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none" 
            value={grupos} 
            onChange={e => setGrupos(e.target.value)} 
            placeholder="Ej. Pecho, Triceps"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-gray-light mb-1">URL de la Imagen o Dibujo (Opcional)</label>
          <input 
            type="url" 
            className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2 focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none" 
            value={imagenUrl} 
            onChange={e => setImagenUrl(e.target.value)} 
            placeholder="https://ejemplo.com/imagen.jpg"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Zona</label>
            <select
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={zona}
              onChange={(e) => setZona(e.target.value as any)}
            >
              <option value="anterior">Anterior</option>
              <option value="posterior">Posterior</option>
              <option value="ambos">Ambos / Global</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Tren</label>
            <select
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={tren}
              onChange={(e) => setTren(e.target.value as any)}
            >
              <option value="superior">Superior</option>
              <option value="inferior">Inferior</option>
              <option value="full_body">Full Body</option>
            </select>
          </div>
        </div>

        {tren === 'superior' && (
          <div>
            <label className="block text-xs font-medium text-brand-gray-light mb-1">Patrón de Movimiento</label>
            <select
              className="w-full bg-brand-black border border-brand-black-border text-brand-gray-light rounded-lg px-3 py-2 text-sm focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none"
              value={patron}
              onChange={(e) => setPatron(e.target.value as any)}
            >
              <option value="empuje">Empuje</option>
              <option value="tiron">Tirón</option>
              <option value="mixto">Mixto</option>
              <option value="ninguno">Ninguno</option>
            </select>
          </div>
        )}

        <div className="pt-6 flex justify-end gap-3 border-t border-brand-black-border mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-gray-muted hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg text-sm font-semibold shadow-glow-red disabled:opacity-50">
            {mutation.isPending ? 'Creando...' : 'Crear Ejercicio'}
          </button>
        </div>
      </form>
    </Modal>
  );
};
