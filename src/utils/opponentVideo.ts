// =====================================================================
// Utilidades de vídeo para el Análisis del Rival: normalización de URL,
// formateo de tiempo y detección de proveedor / capacidad de recorte.
// =====================================================================
import type { OpponentLibraryVideo } from '../types';

/** Normaliza una URL añadiendo https:// si falta el esquema. */
export function getValidUrl(url: string): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (trimmed.startsWith('www.')) return `https://${trimmed}`;
  if (!trimmed.startsWith('http://') && !trimmed.startsWith('https://')) return `https://${trimmed}`;
  return trimmed;
}

/** Formatea segundos a m:ss. */
export function formatTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r < 10 ? '0' : ''}${r}`;
}

export type VideoProvider = 'youtube' | 'vimeo' | 'direct' | 'embed';

/**
 * Detecta el proveedor del vídeo y si es recortable (clippable).
 * YouTube, Vimeo y ficheros directos (mp4/webm/ogg/m3u8/mov) → recortables.
 * Cualquier otra cosa (Veo/Hudl dashboard, etc.) → embed no recortable.
 */
export function detectVideoProvider(rawUrl: string): { provider: VideoProvider; clippable: boolean } {
  const url = getValidUrl(rawUrl).toLowerCase();

  if (/(?:youtube\.com|youtu\.be)/.test(url)) return { provider: 'youtube', clippable: true };
  if (/vimeo\.com/.test(url)) return { provider: 'vimeo', clippable: true };

  // Fichero de vídeo directo o stream HLS (sin tener en cuenta query string).
  const pathOnly = url.split('?')[0];
  if (/\.(mp4|webm|ogg|ogv|mov|m4v|m3u8|mpd)$/.test(pathOnly)) {
    return { provider: 'direct', clippable: true };
  }

  return { provider: 'embed', clippable: false };
}

/** Nombre legible por defecto para un vídeo recién añadido. */
export function defaultVideoTitle(provider: VideoProvider, index: number): string {
  const map: Record<VideoProvider, string> = {
    youtube: 'Vídeo YouTube',
    vimeo: 'Vídeo Vimeo',
    direct: 'Vídeo',
    embed: 'Vídeo embebido',
  };
  return `${map[provider]} ${index + 1}`;
}

/** Todos los clips de la videoteca con la URL de su vídeo de origen. */
export function allLibraryClips(videos: OpponentLibraryVideo[]) {
  return videos.flatMap(v =>
    v.clips.map(c => ({ ...c, videoId: v.id, videoUrl: v.url, videoTitle: v.title }))
  );
}
