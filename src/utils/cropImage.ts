// Utilidad para generar, a partir de un área de recorte (proporcionada por react-easy-crop),
// un Blob de imagen ya recortada en formato cuadrado (se muestra en círculo vía CSS/máscara).

export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

const createImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener('load', () => resolve(image));
    image.addEventListener('error', (error) => reject(error));
    image.crossOrigin = 'anonymous';
    image.src = url;
  });

/**
 * Recorta la imagen según el área seleccionada y devuelve un Blob PNG cuadrado
 * (listo para mostrarse recortado en círculo con `border-radius: 50%` / `rounded-full`).
 */
export async function getCroppedImageBlob(
  imageSrc: string,
  cropArea: CropArea,
  outputSize = 400
): Promise<Blob> {
  const image = await createImage(imageSrc);

  const canvas = document.createElement('canvas');
  canvas.width = outputSize;
  canvas.height = outputSize;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se pudo obtener el contexto de canvas');

  ctx.drawImage(
    image,
    cropArea.x,
    cropArea.y,
    cropArea.width,
    cropArea.height,
    0,
    0,
    outputSize,
    outputSize
  );

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error('No se pudo generar la imagen recortada'));
    }, 'image/png', 0.92);
  });
}
