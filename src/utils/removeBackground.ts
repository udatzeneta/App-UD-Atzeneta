// Elimina el fondo de una imagen (usando un modelo de segmentación que corre
// 100% en el navegador, vía @imgly/background-removal) y compone el resultado
// sobre un fondo blanco sólido, dejando solo la silueta de la persona/objeto.
//
// La librería (~modelo ONNX incluido) es pesada, así que se importa de forma
// dinámica aquí dentro para que solo se descargue cuando hace falta (al
// guardar una foto de jugador), y no en cada carga de la app.

const loadImage = (url: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = url;
  });

export async function removeImageBackgroundToWhite(imageSrc: Blob | string): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');

  // 1. Segmentación: devuelve un PNG con fondo transparente (solo el sujeto)
  const transparentBlob = await removeBackground(imageSrc);
  const transparentUrl = URL.createObjectURL(transparentBlob);

  try {
    const img = await loadImage(transparentUrl);

    // 2. Componer sobre un lienzo con fondo blanco sólido
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('No se pudo obtener el contexto de canvas');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('No se pudo generar la imagen con fondo blanco'));
      }, 'image/png', 0.92);
    });
  } finally {
    URL.revokeObjectURL(transparentUrl);
  }
}
