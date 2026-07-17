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
  
  // Retornamos directamente el blob transparente (PNG)
  return transparentBlob;
}
