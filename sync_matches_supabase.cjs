// Sincroniza TODOS los partidos de FFCV (Primer Equipo y Juvenil) con la tabla matches de Supabase
// Uso: node sync_matches_supabase.cjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Fix para Supabase en Node 20
if (!globalThis.WebSocket) {
  globalThis.WebSocket = require('ws');
}

// Configuración de los equipos y competiciones oficiales
const TEAMS_TO_SYNC = [
  {
    name: 'Primer Equipo',
    teamCategory: 'Primer Equipo',
    codEquipo: '18331',
    competitions: [
      {
        codCompeticion: '905431606', // Primera FFCV
        codGrupo: '905431607',       // Grup - 1
        codTemporada: '22',          // Temporada 2026-2027
        nombre: 'Primera FFCV',
        competitionType: 'Liga'
      },
      {
        codCompeticion: '905432482', // VI La Nostra Copa
        codGrupo: '905432483',       // Eliminatorias
        codTemporada: '22',
        nombre: 'VI La Nostra Copa',
        competitionType: 'Copa'
      }
    ]
  },
  {
    name: 'Equipo Juvenil',
    teamCategory: 'Juvenil',
    codEquipo: '905662975',
    competitions: [
      {
        codCompeticion: '905431573', // Tercera FFCV Juvenil
        codGrupo: '905431574',       // Grup - 1
        codTemporada: '22',
        nombre: 'Tercera FFCV Juvenil',
        competitionType: 'Liga'
      }
    ]
  }
];

const logosMap = {};

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) {
        env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
      }
    }
  } catch (e) { }
  return env;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm.padStart(2, '0')}-${dd.padStart(2, '0')}`;
  }
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  return null;
}

function parseTime(timeStr) {
  if (!timeStr) return null;
  const m = String(timeStr).trim().match(/^(\d{1,2}):(\d{2})/);
  if (!m) return null;
  return `${m[1].padStart(2, '0')}:${m[2]}:00`;
}

function parseResult(resultadoStr) {
  if (!resultadoStr) return { scoreHome: null, scoreAway: null };
  const parts = String(resultadoStr).split('-').map(p => p.trim());
  if (parts.length === 2) {
    const h = parseInt(parts[0], 10);
    const a = parseInt(parts[1], 10);
    if (!isNaN(h) && !isNaN(a)) {
      return { scoreHome: h, scoreAway: a };
    }
  }
  return { scoreHome: null, scoreAway: null };
}

(async () => {
  const env = loadEnv();
  const logosPath = path.join(__dirname, 'src', 'assets', 'logos.json');
  try {
    const existingLogos = JSON.parse(fs.readFileSync(logosPath, 'utf8'));
    Object.assign(logosMap, existingLogos);
  } catch (e) { }

  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Faltan credenciales de Supabase en .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36'
  });
  const page = await context.newPage();

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  try {
    console.log('🌐 Conectando a la FFCV...');
    await page.goto('https://ffcv.es/competiciones/#calendario', { waitUntil: 'load', timeout: 45000 });
    await page.waitForTimeout(2000);

    for (const team of TEAMS_TO_SYNC) {
      console.log(`\n========================================`);
      console.log(`⚽ Sincronizando equipo: ${team.name} (${team.teamCategory}) [CodEquipo: ${team.codEquipo}]`);
      console.log(`========================================`);

      for (const comp of team.competitions) {
        console.log(`\n📋 Consultando jornadas de: ${comp.nombre} (Grupo ${comp.codGrupo})...`);

        const jornadasData = await page.evaluate(async (codGrupo) => {
          try {
            const res = await fetch(`https://ffcv.es/competiciones/api/filtros/jornadas_fetch.php?cod_grupo=${encodeURIComponent(codGrupo)}`);
            if (!res.ok) return { error: `HTTP ${res.status}` };
            return await res.json();
          } catch (e) {
            return { error: e.message };
          }
        }, comp.codGrupo);

        const jornadas = Array.isArray(jornadasData?.jornadas) ? jornadasData.jornadas : [];
        if (jornadas.length === 0) {
          console.log(`   ℹ️ No se encontraron jornadas para ${comp.nombre}`);
          continue;
        }

        console.log(`   ✅ ${jornadas.length} jornadas disponibles en calendario.`);

        for (const j of jornadas) {
          const codJornada = j.codjornada;
          const jornadaLabel = j.nombre || codJornada;

          const data = await page.evaluate(async ({ codTemp, codComp, codGrp, codJor }) => {
            try {
              const url = `https://ffcv.es/competiciones/api/partidos/resultados_por_grupo_jornada_data.php?cod_temporada=${codTemp}&cod_competicion=${codComp}&cod_grupo=${codGrp}&cod_jornada=${codJor}`;
              const res = await fetch(url);
              if (!res.ok) return { error: `HTTP ${res.status}` };
              return await res.json();
            } catch (err) {
              return { error: err.message };
            }
          }, {
            codTemp: comp.codTemporada,
            codComp: comp.codCompeticion,
            codGrp: comp.codGrupo,
            codJor: codJornada
          });

          if (data?.error || !Array.isArray(data?.partidos)) continue;

          // Buscar partido donde participe nuestro equipo
          const rawMatch = data.partidos.find(p => {
            const locId = String(p.cod_equipo_local || '');
            const visId = String(p.cod_equipo_visitante || '');
            if (locId === team.codEquipo || visId === team.codEquipo) return true;
            const locName = (p.local || '').toLowerCase();
            const visName = (p.visitante || '').toLowerCase();
            return locName.includes('atzeneta') || visName.includes('atzeneta');
          });

          if (!rawMatch) continue;

          const isLocal = String(rawMatch.cod_equipo_local) === team.codEquipo ||
                          (rawMatch.local || '').toLowerCase().includes('atzeneta');

          const rival = isLocal ? rawMatch.visitante : rawMatch.local;
          const parsedDate = parseDate(rawMatch.fecha);
          const parsedTime = parseTime(rawMatch.hora);
          const { scoreHome, scoreAway } = parseResult(rawMatch.resultado);

          const scoreUs = isLocal ? scoreHome : scoreAway;
          const scoreThem = isLocal ? scoreAway : scoreHome;

          let status = 'Programado';
          if (scoreUs !== null && scoreThem !== null) {
            status = 'Jugado';
          } else if (rawMatch.estado === '3' || (rawMatch.motivo_estado || '').toLowerCase().includes('suspend') || (rawMatch.motivo_estado || '').toLowerCase().includes('metereo')) {
            status = 'Suspendido';
          }

          // Guardar logos de rivales
          if (rawMatch.local && rawMatch.escudo_local) {
            logosMap[rawMatch.local] = rawMatch.escudo_local.startsWith('http')
              ? rawMatch.escudo_local
              : `https://appwebffcv.novanet.es${rawMatch.escudo_local}`;
          }
          if (rawMatch.visitante && rawMatch.escudo_visitante) {
            logosMap[rawMatch.visitante] = rawMatch.escudo_visitante.startsWith('http')
              ? rawMatch.escudo_visitante
              : `https://appwebffcv.novanet.es${rawMatch.escudo_visitante}`;
          }

          const matchPayload = {
            date: parsedDate,
            time: parsedTime,
            matchday: String(jornadaLabel).trim(),
            rival: rival ? rival.trim() : 'Rival',
            is_local: isLocal,
            competition: comp.competitionType,
            team_category: team.teamCategory,
            score_us: scoreUs,
            score_them: scoreThem,
            status: status,
            location: rawMatch.campo ? String(rawMatch.campo).trim() : null,
            observations: rawMatch.motivo_estado ? `FFCV: ${rawMatch.motivo_estado}` : null
          };

          // Buscar coincidencia en Supabase (primero por matchday, si no por fecha y rival)
          let { data: existing } = await supabase
            .from('matches')
            .select('id, status, tactical_system')
            .eq('team_category', team.teamCategory)
            .eq('competition', comp.competitionType)
            .eq('matchday', matchPayload.matchday)
            .maybeSingle();

          if (!existing && matchPayload.date) {
            const { data: byDate } = await supabase
              .from('matches')
              .select('id, status, tactical_system')
              .eq('team_category', team.teamCategory)
              .eq('competition', comp.competitionType)
              .eq('date', matchPayload.date)
              .ilike('rival', `%${matchPayload.rival.replace(/['"]/g, '').split(' ')[0]}%`)
              .maybeSingle();
            existing = byDate;
          }

          if (existing) {
            // Si el partido ya fue jugado y tiene acta registrada por el cuerpo técnico, no pisamos resultado local salvo que esté vacío
            const updateFields = {
              date: matchPayload.date,
              time: matchPayload.time,
              rival: matchPayload.rival,
              is_local: matchPayload.is_local,
              location: matchPayload.location,
            };

            // Solo actualizar resultado/estado si no está ya marcado como Jugado en la app
            if (existing.status !== 'Jugado') {
              updateFields.status = matchPayload.status;
              if (matchPayload.score_us !== null) updateFields.score_us = matchPayload.score_us;
              if (matchPayload.score_them !== null) updateFields.score_them = matchPayload.score_them;
            }

            const { error: updError } = await supabase.from('matches').update(updateFields).eq('id', existing.id);
            if (updError) {
              console.error(`   ❌ Error actualizando J.${matchPayload.matchday}:`, updError.message);
              totalErrors++;
            } else {
              totalUpdated++;
              console.log(`   ✏️  J.${matchPayload.matchday}: ${matchPayload.date} ${matchPayload.time || '--:--'} vs ${matchPayload.rival} (${matchPayload.location || 'Sin campo'}) [${matchPayload.status}]`);
            }
          } else {
            const { error: insError } = await supabase.from('matches').insert(matchPayload);
            if (insError) {
              console.error(`   ❌ Error insertando J.${matchPayload.matchday}:`, insError.message);
              totalErrors++;
            } else {
              totalInserted++;
              console.log(`   ➕ Insertado J.${matchPayload.matchday}: ${matchPayload.date} ${matchPayload.time || '--:--'} vs ${matchPayload.rival}`);
            }
          }
        }
      }
    }

    console.log(`\n========================================`);
    console.log(`📊 Sincronización oficial FFCV finalizada:`);
    console.log(`   ➕ Insertados: ${totalInserted}`);
    console.log(`   ✏️  Actualizados: ${totalUpdated}`);
    if (totalErrors > 0) console.log(`   ❌ Errores: ${totalErrors}`);
    console.log(`========================================`);

    try {
      fs.writeFileSync(logosPath, JSON.stringify(logosMap, null, 2), 'utf8');
      console.log(`🎨 Logos guardados en: ${logosPath}`);
    } catch (e) { }

  } catch (err) {
    console.error('❌ Error general durante la sincronización:', err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
