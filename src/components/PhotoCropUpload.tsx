import React, { useCallback, useRef, useState } from 'react';
import Cropper, { Area } from 'react-easy-crop';
import { Upload, ZoomIn, Check, X, Loader2, Users } from 'lucide-react';
import { Modal } from './Modal';
import { getCroppedImageBlob } from '../utils/cropImage';
import { removeImageBackgroundToWhite } from '../utils/removeBackground';
import { dataService } from '../services/data';
import { useToast } from '../context/ToastContext';

interface PhotoCropUploadProps {
  value: string;
  onChange: (url: string) => void;
  /** Carpeta dentro del bucket, útil para namespacing (por defecto 'players') */
  folder?: string;
}

/**
 * Botón de foto de perfil circular que, al seleccionar una imagen, abre un
 * recortador circular (react-easy-crop) y sube el resultado a Supabase Storage.
 */
export const PhotoCropUpload: React.FC<PhotoCropUploadProps> = ({ value, onChange, folder = 'players' }) => {
  const { showToast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [rawImage, setRawImage] = useState<string | null>(null);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [saveStage, setSaveStage] = useState<'idle' | 'removing-bg' | 'uploading'>('idle');
  const isSaving = saveStage !== 'idle';

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showToast('error', 'Archivo no válido', 'Selecciona un archivo de imagen (jpg, png, webp...).');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('error', 'Archivo demasiado grande', 'La imagen no puede superar los 10MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setRawImage(reader.result as string);
      setCrop({ x: 0, y: 0 });
      setZoom(1);
      setIsCropModalOpen(true);
    };
    reader.readAsDataURL(file);

    // Permitir volver a elegir el mismo archivo dos veces seguidas
    e.target.value = '';
  };

  const onCropComplete = useCallback((_croppedArea: Area, croppedAreaPixelsValue: Area) => {
    setCroppedAreaPixels(croppedAreaPixelsValue);
  }, []);

  const closeCropModal = () => {
    setIsCropModalOpen(false);
    setRawImage(null);
  };

  const handleConfirmCrop = async () => {
    if (!rawImage || !croppedAreaPixels) return;
    try {
      // 1. Recorta exactamente la zona que el usuario ha encuadrado con el zoom
      const croppedBlob = await getCroppedImageBlob(rawImage, croppedAreaPixels);

      // 2. Quita el fondo automáticamente y lo sustituye por blanco (todas las fotos de jugadores pasan por aquí)
      setSaveStage('removing-bg');
      const finalBlob = await removeImageBackgroundToWhite(croppedBlob);

      // 3. Sube el resultado final a Supabase Storage
      setSaveStage('uploading');
      const url = await dataService.uploadPlayerPhoto(finalBlob, folder);
      onChange(url);
      showToast('success', 'Foto subida', 'La foto de perfil se ha actualizado con fondo blanco.');
      closeCropModal();
    } catch (err: any) {
      showToast('error', 'Error al procesar la foto', err.message || 'No se pudo subir la imagen.');
    } finally {
      setSaveStage('idle');
    }
  };

  return (
    <>
      <div className="flex items-center gap-4 bg-brand-black/40 border border-brand-black-border p-3.5 rounded-xl">
        <div className="w-16 h-16 rounded-full border border-brand-black-border bg-brand-black overflow-hidden flex items-center justify-center shrink-0">
          {value ? (
            <img src={value} alt="Vista previa" className="w-full h-full object-cover" />
          ) : (
            <Users className="w-8 h-8 text-brand-gray-dark" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <label className="form-label">Foto de Perfil</label>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary py-2 text-xs w-full sm:w-auto flex items-center justify-center gap-2"
          >
            <Upload className="w-3.5 h-3.5" />
            {value ? 'Cambiar foto' : 'Subir foto'}
          </button>
        </div>
      </div>

      <Modal isOpen={isCropModalOpen} onClose={closeCropModal} title="Recortar Foto de Perfil" maxWidth="max-w-md">
        <div className="space-y-4">
          <div className="relative w-full h-72 bg-black rounded-lg overflow-hidden">
            {rawImage && (
              <Cropper
                image={rawImage}
                crop={crop}
                zoom={zoom}
                aspect={1}
                cropShape="round"
                showGrid={false}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomIn className="w-4 h-4 text-brand-gray-muted shrink-0" />
            <input
              type="range"
              min={1}
              max={3}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-brand-red-600"
            />
          </div>

          <p className="text-[11px] text-brand-gray-muted">
            Al guardar, se quitará automáticamente el fondo de la foto dejando solo la silueta sin fondo.
          </p>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={closeCropModal}
              className="btn-secondary py-2 text-xs flex items-center gap-1.5"
              disabled={isSaving}
            >
              <X className="w-3.5 h-3.5" />
              Cancelar
            </button>
            <button
              type="button"
              onClick={handleConfirmCrop}
              className="btn-primary py-2 text-xs flex items-center gap-1.5"
              disabled={isSaving || !croppedAreaPixels}
            >
              {isSaving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Check className="w-3.5 h-3.5" />
              )}
              {saveStage === 'removing-bg' && 'Quitando fondo...'}
              {saveStage === 'uploading' && 'Subiendo...'}
              {saveStage === 'idle' && 'Guardar foto'}
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
};
