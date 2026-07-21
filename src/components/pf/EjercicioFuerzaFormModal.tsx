import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { Modal } from '../Modal';
import { useToast } from '../../context/ToastContext';
import { GRUPOS_MUSCULARES } from '../../lib/fuerzaConstants';

interface EjercicioFuerzaFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  editData?: any;
}

export const EjercicioFuerzaFormModal: React.FC<EjercicioFuerzaFormModalProps> = ({ isOpen, onClose, editData }) => {
  const queryClient = useQueryClient();
  const { showToast } = useToast();

  const [nombre, setNombre] = useState('');
  const [gruposSeleccionados, setGruposSeleccionados] = useState<string[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [explicacion, setExplicacion] = useState('');
  const [imagenUrl, setImagenUrl] = useState('');
  const [zona, setZona] = useState<'anterior' | 'posterior' | 'ambos'>('ambos');
  const [tren, setTren] = useState<'superior' | 'inferior' | 'full_body'>('superior');
  const [patron, setPatron] = useState<'empuje' | 'tiron' | 'mixto' | 'ninguno'>('ninguno');

  React.useEffect(() => {
    if (isOpen && editData) {
      setNombre(editData.nombre || '');
      setGruposSeleccionados(editData.grupos || []);
      setTags(editData.tags || []);
      setExplicacion(editData.explicacion || '');
      setImagenUrl(editData.imagen_url || '');
      setZona(editData.zona || 'ambos');
      setTren(editData.tren || 'superior');
      setPatron(editData.patron || 'ninguno');
      setTagInput('');
    } else if (isOpen && !editData) {
      setNombre('');
      setGruposSeleccionados([]);
      setTags([]);
      setExplicacion('');
      setImagenUrl('');
      setZona('ambos');
      setTren('superior');
      setPatron('ninguno');
    }
  }, [isOpen, editData]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        nombre,
        grupos: gruposSeleccionados,
        tags,
        explicacion,
        imagen_url: imagenUrl || null,
        zona,
        tren,
        patron: tren === 'superior' ? patron : 'ninguno'
      };

      if (editData?.id) {
        const { error } = await supabase.from('ejercicios_fuerza').update(payload).eq('id', editData.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ejercicios_fuerza').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ejercicios_fuerza'] });
      showToast('success', editData ? 'Ejercicio actualizado' : 'Ejercicio creado correctamente');
      onClose();
      // Reset form
      setNombre('');
      setGruposSeleccionados([]);
      setTags([]);
      setExplicacion('');
      setImagenUrl('');
      setZona('ambos');
      setTren('superior');
      setPatron('ninguno');
    },
    onError: (error) => {
      console.error(error);
      showToast('error', editData ? 'Error al actualizar' : 'Error al crear el ejercicio');
    }
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    mutation.mutate();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={editData ? "Editar Ejercicio de Fuerza" : "Crear Ejercicio de Fuerza"} maxWidth="max-w-xl">
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
          <label className="block text-xs font-medium text-brand-gray-light mb-2">Grupos Musculares</label>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {GRUPOS_MUSCULARES.map((grupo) => (
              <label key={grupo.key} className="flex items-center gap-2 text-sm text-brand-gray-muted hover:text-white cursor-pointer">
                <input
                  type="checkbox"
                  className="rounded border-brand-black-border bg-brand-black text-brand-red-600 focus:ring-brand-red-600"
                  checked={gruposSeleccionados.includes(grupo.key)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      setGruposSeleccionados([...gruposSeleccionados, grupo.key]);
                    } else {
                      setGruposSeleccionados(gruposSeleccionados.filter(g => g !== grupo.key));
                    }
                  }}
                />
                <span>{grupo.label}</span>
              </label>
            ))}
          </div>
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

        <div>
          <label className="block text-xs font-medium text-brand-gray-light mb-1">Tags (Etiquetas manuales)</label>
          <div className="flex gap-2">
            <input 
              type="text" 
              className="flex-1 bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2 focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none" 
              value={tagInput} 
              onChange={e => setTagInput(e.target.value)} 
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                    setTags([...tags, tagInput.trim()]);
                    setTagInput('');
                  }
                }
              }}
              placeholder="Ej. Fuerza Maxima, Preventivo (Presiona Enter)"
            />
            <button 
              type="button" 
              onClick={() => {
                if (tagInput.trim() && !tags.includes(tagInput.trim())) {
                  setTags([...tags, tagInput.trim()]);
                  setTagInput('');
                }
              }}
              className="px-4 py-2 bg-brand-black-hover border border-brand-black-border rounded-lg text-sm text-white hover:bg-brand-gray-dark"
            >
              Añadir
            </button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {tags.map(tag => (
                <span key={tag} className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs bg-brand-gray-dark border border-brand-black-border text-white">
                  {tag}
                  <button type="button" onClick={() => setTags(tags.filter(t => t !== tag))} className="text-brand-gray-muted hover:text-brand-red-500 font-bold ml-1">
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-brand-gray-light mb-1">Explicación del Ejercicio (Opcional)</label>
          <textarea 
            className="w-full bg-brand-black border border-brand-black-border text-white text-sm rounded-lg p-2 focus:border-brand-red-600 focus:ring-1 focus:ring-brand-red-600 outline-none min-h-[80px]" 
            value={explicacion} 
            onChange={e => setExplicacion(e.target.value)} 
            placeholder="Describe cómo realizar el ejercicio..."
          />
        </div>

        <div className="pt-6 flex justify-end gap-3 border-t border-brand-black-border mt-6">
          <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-brand-gray-muted hover:text-white transition-colors">
            Cancelar
          </button>
          <button type="submit" disabled={mutation.isPending} className="px-6 py-2 bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg text-sm font-semibold shadow-glow-red disabled:opacity-50">
            {mutation.isPending ? 'Guardando...' : (editData ? 'Actualizar Ejercicio' : 'Crear Ejercicio')}
          </button>
        </div>
      </form>
    </Modal>
  );
};
