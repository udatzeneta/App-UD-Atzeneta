import { createClient } from '@supabase/supabase-js';

// Node < 22 has no native WebSocket; @supabase/supabase-js's realtime module needs one even when unused here.
async function ensureWebSocketPolyfill() {
  if (typeof (globalThis as any).WebSocket === 'undefined') {
    const wsModule: any = await import('ws');
    (globalThis as any).WebSocket = wsModule.default || wsModule;
  }
}

const FFCV_BASE = 'https://ffcv.es/competiciones';
const BROWSER_UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36';

function normalizeTeamName(str: string): string {
  if (!str) return '';
  return str
    .toLowerCase()
    .replace(/['"''´`""]/g, '')
    .replace(/\b(c\.?f\.?|c\.?d\.?|u\.?d\.?|s\.?d\.?|a\.?d\.?|f\.?c\.?|at\.?|atletico|atlético)\b/gi, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function isSameTeam(a: string, b: string): boolean {
  const na = normalizeTeamName(a);
  const nb = normalizeTeamName(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.length >= 3 && nb.length >= 3 && (na.includes(nb) || nb.includes(na))) return true;
  return false;
}

async function ffcvFetch(url: string): Promise<any> {
  const res = await fetch(url, { headers: { 'User-Agent': BROWSER_UA, 'Accept': 'application/json' } });
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// The FFCV backend (Novanet) is frequently and transiently degraded; retry a few times before giving up.
async function ffcvFetchWithRetry(url: string, attempts = 3, delayMs = 1200): Promise<any> {
  for (let i = 0; i < attempts; i++) {
    const data = await ffcvFetch(url);
    if (data && data.estado !== '0') return data;
    if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
  }
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Known FFCV competitions to try, in order, when the hinted competition doesn't contain the opponent team.
const FALLBACK_COMPETITIONS = ['905431821', '905431606', '905431611', '905431620'];

async function findGroupForTeam(competitionId: string, season: string, opponentTeam: string): Promise<{ group: any; totalJornadas: number } | null> {
  const groupsData = await ffcvFetchWithRetry(`${FFCV_BASE}/api/filtros/grupos_fetch.php?cod_competicion=${competitionId}&cod_temporada=${season}`);
  const groups: any[] = Array.isArray(groupsData?.grupos) ? groupsData.grupos : [];

  for (const g of groups) {
    const groupCode = g.codigo || g.cod_grupo;
    const j1 = await ffcvFetchWithRetry(`${FFCV_BASE}/api/partidos/resultados_por_grupo_jornada_data.php?cod_temporada=${season}&cod_competicion=${competitionId}&cod_grupo=${groupCode}&cod_jornada=1`);
    const partidos: any[] = Array.isArray(j1?.partidos) ? j1.partidos : [];
    const found = partidos.some(p => isSameTeam(p.local, opponentTeam) || isSameTeam(p.visitante, opponentTeam));
    if (found) {
      return { group: g, totalJornadas: parseInt(g.total_jornadas, 10) || 30 };
    }
    await sleep(900);
  }
  return null;
}

export default async function handler(req: any, res: any) {
  // Setup CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  const { opponentTeam, competitionId = '905431821', season = '22' } = req.body || req.query || {};

  if (!opponentTeam) {
    return res.status(400).json({ error: 'Parámetro opponentTeam es obligatorio.' });
  }

  await ensureWebSocketPolyfill();

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseKey) {
    return res.status(500).json({ error: 'Supabase URL/Key no configurada en el servidor.' });
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  console.log(`[FFCV Serverless] Scraping opponent: ${opponentTeam} (season ${season}, competition ${competitionId})`);

  try {
    // 1. Locate which group/competition contains the opponent team.
    // Try the hinted competition first, then fall back to the other known FFCV competitions.
    const competitionsToTry = [String(competitionId), ...FALLBACK_COMPETITIONS.filter(c => c !== String(competitionId))];

    let resolvedCompetitionId: string | null = null;
    let targetGroup: any = null;
    let totalJornadas = 30;

    for (const compId of competitionsToTry) {
      const result = await findGroupForTeam(compId, season, opponentTeam);
      if (result) {
        resolvedCompetitionId = compId;
        targetGroup = result.group;
        totalJornadas = result.totalJornadas;
        break;
      }
    }

    if (!targetGroup || !resolvedCompetitionId) {
      return res.status(200).json({ success: true, opponentTeam, syncedCount: 0, totalMatches: 0, error: `No se encontró a "${opponentTeam}" en ninguna competición/grupo de la FFCV para la temporada ${season}.` });
    }

    const groupCode = targetGroup.codigo || targetGroup.cod_grupo;

    // 3. Walk every jornada of the resolved group and collect the opponent's matches
    let syncedCount = 0;
    let totalOpponentMatches = 0;

    for (let jornada = 1; jornada <= totalJornadas; jornada++) {
      const jData = await ffcvFetchWithRetry(`${FFCV_BASE}/api/partidos/resultados_por_grupo_jornada_data.php?cod_temporada=${season}&cod_competicion=${resolvedCompetitionId}&cod_grupo=${groupCode}&cod_jornada=${jornada}`);
      const partidos: any[] = Array.isArray(jData?.partidos) ? jData.partidos : [];

      for (const p of partidos) {
        const isOpponentMatch = isSameTeam(p.local, opponentTeam) || isSameTeam(p.visitante, opponentTeam);
        if (!isOpponentMatch) continue;

        totalOpponentMatches++;

        const played = p.estado === '1';
        let homeScore: number | null = null;
        let awayScore: number | null = null;
        if (played && typeof p.resultado === 'string' && p.resultado.includes('-')) {
          const [h, a] = p.resultado.split('-').map((s: string) => parseInt(s.trim(), 10));
          if (!isNaN(h) && !isNaN(a)) {
            homeScore = h;
            awayScore = a;
          }
        }

        const codacta = String(p.codacta || `${groupCode}-${jornada}-${p.cod_equipo_local}-${p.cod_equipo_visitante}`);

        const { error } = await supabase.from('ffcv_matches').upsert({
          ffcv_match_id: codacta,
          competition_id: String(resolvedCompetitionId),
          group_id: String(groupCode),
          season,
          home_team_id: String(p.cod_equipo_local || ''),
          away_team_id: String(p.cod_equipo_visitante || ''),
          home_team_name: p.local || '',
          away_team_name: p.visitante || '',
          home_score: homeScore,
          away_score: awayScore,
          played: played && homeScore !== null && awayScore !== null,
          match_date: p.fecha || null,
          match_url: `/competiciones/partidos/partido.php?cod_partido=${codacta}`,
          status: played ? 'SCRAPED' : 'PENDING',
          last_scraped_at: new Date().toISOString(),
        }, { onConflict: 'ffcv_match_id' });

        if (!error) syncedCount++;
        else console.warn(`[FFCV Serverless] Upsert error for match ${codacta}:`, error.message);
      }

      await sleep(900);
    }

    return res.status(200).json({
      success: true,
      opponentTeam,
      syncedCount,
      totalMatches: totalOpponentMatches,
      competitionId: resolvedCompetitionId,
      groupCode,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error('[FFCV Serverless] Error:', err);
    return res.status(500).json({ error: err.message || 'Error en scraping de FFCV.' });
  }
}
