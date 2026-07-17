// Elimina el fondo de una imagen (usando un modelo de segmentación que corre
// 100% en el navegador, vía @imgly/background-removal) y devuelve un PNG
// con fondo transparente (solo la silueta de la persona/objeto).
//
// La librería (~modelo ONNX incluido) es pesada, así que se importa de forma
// dinámica aquí dentro para que solo se descargue cuando hace falta (al
// guardar una foto de jugador), y no en cada carga de la app.

export async function removeImageBackgroundToWhite(imageSrc: Blob | string): Promise<Blob> {
  const { removeBackground } = await import('@imgly/background-removal');

  // 1. Segmentación: devuelve un PNG con fondo transparente (solo el sujeto)
  const transparentBlob = await removeBackground(imageSrc);
  
  // 2. Crear una imagen a partir del blob transparente
  const imgUrl = URL.createObjectURL(transparentBlob);
  const img = new Image();
  await new Promise((resolve, reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = imgUrl;
  });

  // 3. Crear un canvas y rellenarlo con fondo blanco
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No 2d context');

  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // 4. Dibujar la imagen recortada encima
  ctx.drawImage(img, 0, 0);
  URL.revokeObjectURL(imgUrl);

  // 5. Extraer el resultado como JPEG para forzar el fondo sólido (y reducir el tamaño)
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Error creating blob'));
      },
      'image/jpeg',
      0.9 // calidad
    );
  });
}
