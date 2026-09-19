import { createClient } from '@supabase/supabase-js';
import { isSameTeam } from '../src/utils/teamUtils';
import {
  computeFFCVTeamStats,
  computeFFCVLeagueRankings,
  filterFFCVMatchesForTeam,
  filterScoutingForTeam,
} from '../src/utils/ffcvAggregation';

// Endpoint público de una presentación compartida.
//
// Es el único punto por el que un tercero (sin cuenta) accede a datos, y por eso
// concentra aquí toda la seguridad:
//   - Lee con la service role, que salta RLS: NO hace falta abrir lectura
//     anónima sobre opponent_analysis, scouting, teams ni las tablas FFCV.
//   - El token solo resuelve UNA presentación: nunca se devuelve el análisis
//     completo del rival ni el resto de presentaciones del mural.
//   - Del scouting y las sanciones solo sale lo del equipo de esa presentación.
//
// Al leer en cada visita, el enlace siempre refleja la última versión de la
// presentación sin tener que volver a compartirlo.

const CURRENT_FFCV_SEASON = '22'; // Temporada 2026/2027

// Node < 22 no trae WebSocket nativo y el módulo realtime de supabase-js lo exige.
async function ensureWebSocketPolyfill() {
  if (typeof (globalThis as any).WebSocket === 'undefined') {
    const wsModule: any = await import('ws');
    (globalThis as any).WebSocket = wsModule.default || wsModule;
  }
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Accept, Content-Type');
  // Caché muy corta: alivia ráfagas (un grupo de WhatsApp abriendo a la vez)
  // sin dejar de ser un enlace vivo.
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=60');

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const token = String((req.query?.token ?? req.body?.token) || '').trim();
  if (!token || !/^[a-f0-9]{16,64}$/i.test(token)) {
    return res.status(400).json({ error: 'Enlace no válido.' });
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    // Sin service role no se sirve nada: caer a la anon key dejaría el endpoint
    // a merced de las políticas RLS y devolvería presentaciones vacías.
    return res.status(500).json({ error: 'El servidor no tiene configurada la clave de servicio de Supabase.' });
  }

  await ensureWebSocketPolyfill();
  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } });

  try {
    const { data: share, error: shareError } = await supabase
      .from('presentation_shares')
      .select('*')
      .eq('token', token)
      .eq('revoked', false)
      .maybeSingle();

    if (shareError) throw shareError;
    if (!share) {
      return res.status(404).json({ error: 'Este enlace ya no está disponible.' });
    }

    const { data: analysis, error: analysisError } = await supabase
      .from('opponent_analysis')
      .select('id, opponent, presentations, library_videos')
      .eq('id', share.analysis_id)
      .maybeSingle();

    if (analysisError) throw analysisError;
    if (!analysis) {
      return res.status(404).json({ error: 'El análisis de esta presentación ya no existe.' });
    }

    const presentations = Array.isArray(analysis.presentations) ? analysis.presentations : [];
    const presentation = presentations.find((p: any) => p?.id === share.presentation_id);

    if (!presentation) {
      return res.status(404).json({ error: 'Esta presentación se ha eliminado del mural.' });
    }

    const opponentName: string = analysis.opponent || share.opponent || '';
    const libraryVideos = Array.isArray(analysis.library_videos) ? analysis.library_videos : [];

    // Consultas en paralelo: son independientes entre sí.
    const [teamsRes, settingsRes, matchesRes, scoutingRes, sanctionsRes] = await Promise.all([
      supabase.from('teams').select('id, name, shield_url'),
      supabase.from('settings').select('club_name, logo_url').eq('id', 1).maybeSingle(),
      supabase.from('ffcv_matches').select('*').eq('season', CURRENT_FFCV_SEASON).eq('played', true),
      supabase.from('scouting').select('*'),
      supabase.from('ffcv_sanctions').select('*').order('resolution_date', { ascending: false }),
    ]);

    const allScouting = scoutingRes.data || [];
    const teamScouting = filterScoutingForTeam(allScouting, opponentName);
    const teamMatches = filterFFCVMatchesForTeam(matchesRes.data || [], opponentName);

    const teamStats = computeFFCVTeamStats(opponentName, teamMatches, teamScouting);
    const leagueRankings = computeFFCVLeagueRankings(opponentName, teamStats);

    // Solo el escudo que la presentación necesita, no el listado de equipos.
    const rivalTeam = (teamsRes.data || []).find((t: any) => isSameTeam(t.name, opponentName));

    // Las sanciones se recortan al rival: el enlace no es una ventana al resto.
    // Mismo criterio que la diapositiva de sanciones: columna team_name.
    const sanctions = (sanctionsRes.data || []).filter((s: any) =>
      isSameTeam(s.team_name, opponentName),
    );

    // Contador de visitas, sin bloquear la respuesta.
    void supabase
      .from('presentation_shares')
      .update({ last_viewed_at: new Date().toISOString(), view_count: (share.view_count || 0) + 1 })
      .eq('token', token)
      .then(undefined, () => { /* el contador nunca debe tumbar una visita */ });

    return res.status(200).json({
      presentation,
      libraryVideos,
      opponentName,
      teams: rivalTeam ? [rivalTeam] : [],
      settings: settingsRes.data || null,
      teamStats,
      leagueRankings,
      scoutingPlayers: teamScouting,
      ffcvSanctions: sanctions,
    });
  } catch (err: any) {
    console.error('[shared-presentation] Error:', err);
    return res.status(500).json({ error: 'No se ha podido cargar la presentación.' });
  }
}
