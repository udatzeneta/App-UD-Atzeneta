// Sincroniza TODOS los partidos de FFCV (todas las competiciones) con la tabla matches de Supabase
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

const COD_EQUIPO = '18331';
const logosMap = {};

// Mapeo de nombre de competición FFCV → valor del campo competition en Supabase
function mapCompeticion(nombre) {
  const n = (nombre || '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
  if (n.includes('copa')) return 'Copa';
  if (n.includes('promocion') || n.includes('playoff') || n.includes('ascenso')) return 'Promoción';
  if (n.includes('amistoso') || n.includes('torneo') || n.includes('trofeo')) return 'Amistoso';
  return 'Liga';
}

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

function pick(obj, keys) {
  for (const k of keys) {
    if (obj != null && obj[k] != null && obj[k] !== '') return obj[k];
  }
  return null;
}

function parseDate(dateStr) {
  if (!dateStr) return null;
  const s = String(dateStr).trim();
  if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
    const [dd, mm, yyyy] = s.split('/');
    return `${yyyy}-${mm}-${dd}`;
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

function parseGoals(val) {
  if (val == null || val === '') return null;
  const n = parseInt(String(val).replace(/[^\d]/g, ''), 10);
  return isNaN(n) ? null : n;
}

// La temporada 2026/2027 va de 2026-07-01 a 2027-06-30. Comparar solo el año
// del partido no basta, porque la 2025/2026 también tiene fechas con año 2026.
function isTemporada2026_2027(fecha) {
  return fecha >= '2026-07-01' && fecha <= '2027-06-30';
}

function mapPartido(p, competicion) {
  const fecha = pick(p, ['fecha', 'Fecha', 'fecha_partido']);
  const hora = pick(p, ['hora', 'Hora', 'hora_partido']);

  const jornadaRaw = pick(p, ['jornada', 'Jornada', 'num_jornada', 'fase', 'Fase']);
  const matchday = jornadaRaw ? String(jornadaRaw).trim() : null;

  const codLocal = String(pick(p, ['CodEquipo_local', 'codigo_equipo_local', 'cod_equipo_local', 'CodEquipoLocal']) || '').replace(/\D/g, '');
  const nombreLocal = String(pick(p, ['Nombre_equipo_local', 'equipo_local', 'local', 'NombreLocal']) || '').trim();
  const nombreVisitante = String(pick(p, ['Nombre_equipo_visitante', 'equipo_visitante', 'visitante', 'NombreVisitante']) || '').trim();

  const golesLocal = parseGoals(pick(p, ['Goles_casa', 'goles_casa', 'goles_local', 'GolesLocal']));
  const golesVisitante = parseGoals(pick(p, ['Goles_visitante', 'goles_visitante', 'GolesVisita', 'GolesVisitante']));

  const estado = String(pick(p, ['estado', 'Estado']) || '');
  const campo = pick(p, ['campojuego', 'campo', 'campo_juego', 'instalacion', 'localidad']);

  const isLocal = codLocal === COD_EQUIPO;
  const rival = isLocal ? nombreVisitante : nombreLocal;
  const scoreUs = isLocal ? golesLocal : golesVisitante;
  const scoreThem = isLocal ? golesVisitante : golesLocal;

  let status = 'Programado';
  if (scoreUs !== null && scoreThem !== null) {
    status = 'Jugado';
  } else if (/^5$|suspend/i.test(estado)) {
    status = 'Suspendido';
  }

  const imgLocal = pick(p, ['url_img_local']);
  const imgVisitante = pick(p, ['url_img_visitante']);
  if (nombreLocal && imgLocal) {
    logosMap[nombreLocal] = imgLocal.startsWith('http') ? imgLocal : `https://appwebffcv.novanet.es${imgLocal}`;
  }
  if (nombreVisitante && imgVisitante) {
    logosMap[nombreVisitante] = imgVisitante.startsWith('http') ? imgVisitante : `https://appwebffcv.novanet.es${imgVisitante}`;
  }

  const date = parseDate(fecha);
  if (!date || !rival) return null;

  return {
    date,
    matchday,
    rival,
    is_local: isLocal,
    competition: competicion,
    score_us: scoreUs,
    score_them: scoreThem,
    status,
    time: parseTime(hora),
    location: campo ? String(campo).trim() : null,
    objective: null,
    observations: null,
  };
}

async function handleCookies(page) {
  const selectors = [
    'button:has-text("Aceptar")', 'button:has-text("ACEPTAR")',
    'button:has-text("Aceptar todas")', '.cc-btn.cc-allow', '.cm-btn-success',
  ];
  for (const sel of selectors) {
    try { await page.locator(sel).first().click({ timeout: 2000 }); return; } catch (e) { }
  }
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

  if (!supabaseUrl || supabaseUrl.includes('your-supabase-project-id')) {
    console.error('❌ VITE_SUPABASE_URL no está configurada en el .env');
    process.exit(1);
  }
  if (!supabaseKey || supabaseKey.includes('your-supabase')) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY no está configurada en el .env');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log('🌐 Navegando a FFCV para establecer sesión...');
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'load', timeout: 60000 });
    await handleCookies(page);
    await page.waitForTimeout(2000);

    console.log('📡 Obteniendo lista de competiciones de la API...');
    const competitionsData = await page.evaluate(async (codEquipo) => {
      try {
        const response = await fetch(`https://ffcv.es/competiciones/api/equipos/vis_competiciones_equipo.php?codequipo=${encodeURIComponent(codEquipo)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { error: err.message };
      }
    }, COD_EQUIPO);

    if (!competitionsData || !Array.isArray(competitionsData.competiciones)) {
      throw new Error(`No se pudo obtener las competiciones de la API. Respuesta: ${JSON.stringify(competitionsData)}`);
    }

    // Mapear al formato de competiciones esperado
    let competiciones = competitionsData.competiciones.map(comp => {
      const codGrupo = comp.cogido_grupo || comp.cod_grupo || comp.codgrupo;
      const codTemporada = comp.codigo_temporada || comp.cod_temporada || '22';
      const nombre = comp.competicion || comp.nombre_competicion || comp.nombre || '';
      return { codGrupo, codTemporada, nombre };
    }).filter(c => c.codGrupo);

    // Filtrar para mantener solo Liga, Copa y Promoción (descartar Amistosos u otras)
    competiciones = competiciones.filter(c => {
      const cat = mapCompeticion(c.nombre);
      return cat === 'Liga' || cat === 'Copa' || cat === 'Promoción';
    });

    console.log(`📋 Competiciones a sincronizar: ${competiciones.map(c => c.nombre).join(', ')}`);

    // ── 4. Fetchear partidos de cada competición ─────────────────────────────
    let totalInserted = 0;
    let totalUpdated = 0;
    let totalErrors = 0;

    for (const comp of competiciones) {
      const competicion = mapCompeticion(comp.nombre);
      const apiUrl = `https://ffcv.es/competiciones/api/equipos/partidos_equipo_temporada.php?cod_equipo=${encodeURIComponent(COD_EQUIPO)}&cod_temporada=${encodeURIComponent(comp.codTemporada)}&cod_grupo=${encodeURIComponent(comp.codGrupo)}`;

      console.log(`\n📡 ${comp.nombre} (${competicion}): ${apiUrl}`);

      const apiData = await page.evaluate(async (url) => {
        try {
          const res = await fetch(url);
          if (!res.ok) return { error: `HTTP ${res.status}` };
          return await res.json();
        } catch (err) {
          return { error: err.message };
        }
      }, apiUrl);

      if (apiData?.error) {
        console.log(`   ❌ Error API: ${apiData.error}`);
        totalErrors++;
        continue;
      }

      let partidos = Array.isArray(apiData?.partidos) ? apiData.partidos : [];
      console.log(`   ✅ ${partidos.length} partidos via API.`);

      // Si la API devuelve vacío (ej. Copa), intentamos parsear del DOM
      if (partidos.length === 0) {
        try {
          await page.selectOption('#team-partidos-competicion', comp.codGrupo, { timeout: 1000 });
          await page.waitForTimeout(1000); // Esperar a que el DOM se actualice con esta competición
        } catch (e) {
          console.log('   ⚠️ No se pudo cambiar el selector de competición en el DOM:', e.message);
        }
        partidos = await page.evaluate(async (codGrupo) => {
          const sel = document.getElementById('team-partidos-competicion');
          if (sel) sel.value = codGrupo; // asegurar selección
          const MESES = { enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7, agosto: 8, septiembre: 9, octubre: 10, noviembre: 11, diciembre: 12 };
          const cards = Array.from(document.querySelectorAll('#team-partidos .match-card'));
          
          const results = [];
          for (const card of cards) {
            try {
              const meta = (card.querySelector('.m-meta')?.textContent || '').trim();
              // Extraer fecha: "7 septiembre de 2025"
              const fechaM = meta.match(/(\d{1,2})\s+(\w+)\s+de\s+(\d{4})/);
              let fecha = null;
              if (fechaM) {
                const dia = fechaM[1].padStart(2, '0');
                const mes = String(MESES[fechaM[2].toLowerCase()] || 1).padStart(2, '0');
                fecha = `${fechaM[3]}-${mes}-${dia}`;
              }
              let matchday = null;
              const partesMeta = meta.split('·');
              if (partesMeta.length > 1) {
                const matchdayText = partesMeta[1].trim();
                const numMatch = matchdayText.match(/\d+/);
                matchday = numMatch ? numMatch[0] : matchdayText;
              }
              const filas = Array.from(card.querySelectorAll('.team-row'));
              const allRows = filas;
              const atzeneta = filas.find(r => r.classList.contains('is-team'));
              const rival = filas.find(r => !r.classList.contains('is-team'));
              const isLocal = atzeneta === allRows[0]; // primera fila = local
              const nombreRival = rival?.querySelector('.team-name')?.textContent?.trim() || '';
              const golesAtzeneta = parseInt(atzeneta?.querySelector('.team-goals')?.textContent || '', 10);
              const golesRival = parseInt(rival?.querySelector('.team-goals')?.textContent || '', 10);
              const statusText = (card.querySelector('.match-status, .badge, [class*=\"status\"], [class*=\"estado\"]')?.textContent || '').toLowerCase();
              const hasScore = !isNaN(golesAtzeneta) && !isNaN(golesRival);
              const status = hasScore ? 'Jugado' : (statusText.includes('suspend') ? 'Suspendido' : 'Programado');

              const localName = allRows[0]?.querySelector('.team-name')?.textContent?.trim() || '';
              const localImg = allRows[0]?.querySelector('img')?.getAttribute('src');
              const visitanteName = allRows[1]?.querySelector('.team-name')?.textContent?.trim() || '';
              const visitanteImg = allRows[1]?.querySelector('img')?.getAttribute('src');

              // ── Extraer hora y campo haciendo fetch al detalle del partido ──────────
              let parsedTime = null;
              let parsedLocation = null;

              const anchor = card.closest('a');
              const href = anchor ? anchor.getAttribute('href') : '';
              const matchCod = href.match(/cod_partido=(\d+)/);
              const codPartido = matchCod ? matchCod[1] : null;

              if (codPartido) {
                try {
                  const res = await fetch(`../partidos/partido.php?cod_partido=${codPartido}`);
                  if (res.ok) {
                    const html = await res.text();
                    const startMarker = 'window.__FFCV_BOOTSTRAP_JSON = ';
                    const startIdx = html.indexOf(startMarker);
                    if (startIdx !== -1) {
                      const jsonStart = startIdx + startMarker.length;
                      const rest = html.slice(jsonStart);
                      const matchEnd = rest.match(/([\s\S]*?)\};\r?\n/);
                      if (matchEnd) {
                        const jsonText = matchEnd[1] + '}';
                        const data = JSON.parse(jsonText);
                        
                        if (data.hora) {
                          const m = String(data.hora).trim().match(/^(\d{1,2}):(\d{2})/);
                          if (m) {
                            parsedTime = `${m[1].padStart(2, '0')}:${m[2]}:00`;
                          }
                        }
                        if (data.campo) {
                          parsedLocation = String(data.campo).trim();
                        }
                      }
                    }
                  }
                } catch (fetchErr) {
                  // ignorar error del fetch individual y seguir
                }
              }

              results.push({
                fecha, matchday, nombreRival, isLocal,
                golesAtzeneta: hasScore ? golesAtzeneta : null,
                golesRival: hasScore ? golesRival : null,
                status,
                localName, localImg,
                visitanteName, visitanteImg,
                time: parsedTime,
                location: parsedLocation
              });
            } catch (e) {
              // ignorar error de tarjeta individual
            }
          }
          return results;
        }, comp.codGrupo);

        if (partidos.length > 0) {
          console.log(`   ✅ ${partidos.length} partidos parseados del HTML.`);
        } else {
          console.log('   ℹ️  Sin partidos (la competición puede no haber empezado).');
          continue;
        }

        // Mapear formato DOM → formato Supabase
        const mappedMatches = partidos.map(p => {
          if (!p.fecha || !p.nombreRival) return null;

          if (p.localName && p.localImg) {
            logosMap[p.localName] = p.localImg.startsWith('http') ? p.localImg : `https://appwebffcv.novanet.es${p.localImg}`;
          }
          if (p.visitanteName && p.visitanteImg) {
            logosMap[p.visitanteName] = p.visitanteImg.startsWith('http') ? p.visitanteImg : `https://appwebffcv.novanet.es${p.visitanteImg}`;
          }

          return {
            date: p.fecha,
            matchday: p.matchday,
            rival: p.nombreRival,
            is_local: p.isLocal,
            competition: competicion,
            score_us: p.golesAtzeneta,
            score_them: p.golesRival,
            status: p.status,
            time: p.time,
            location: p.location,
            objective: null,
            observations: null,
          };
        }).filter(Boolean);
        
        // Descartar partidos que no pertenezcan a la temporada 2026/2027 (rango: 2026-07-01 a 2027-06-30)
        const mappedMatchesFiltered = mappedMatches.filter(m => isTemporada2026_2027(m.date));

        if (mappedMatchesFiltered.length === 0) {
           console.log('   ℹ️  No se encontraron partidos válidos para la temporada 2026/2027 en pantalla.');
           continue;
        }

          for (const match of mappedMatchesFiltered) {
          let query = supabase.from('matches').select('id, status').eq('competition', match.competition).ilike('rival', match.rival);
          if (match.matchday) {
            query = query.eq('matchday', match.matchday);
          } else {
            query = query.eq('date', match.date);
          }
          const { data: existing, error: searchError } = await query.maybeSingle();
          if (searchError) { console.error(`   ❌ ${match.date} vs ${match.rival}: ${searchError.message}`); totalErrors++; continue; }
          if (existing) {
            if (existing.status === 'Jugado') {
              console.log(`   ⏭️  Omitido (Ya jugado): ${match.date} vs ${match.rival}`);
            } else {
              const { error } = await supabase.from('matches').update(match).eq('id', existing.id);
              if (error) { console.error(`   ❌ Update: ${error.message}`); totalErrors++; }
              else { totalUpdated++; console.log(`   ✏️  Actualizado: ${match.date} vs ${match.rival} [${match.status}]`); }
            }
          } else {
            const { error } = await supabase.from('matches').insert(match);
            if (error) { console.error(`   ❌ Insert: ${error.message}`); totalErrors++; }
            else { totalInserted++; console.log(`   ➕ Insertado: ${match.date} vs ${match.rival} [${match.status}]`); }
          }
        }
        continue;
      }

      const mappedMatches = partidos.map(p => mapPartido(p, competicion)).filter(Boolean);

      // Descartar partidos que no pertenezcan a la temporada 2026/2027 (rango: 2026-07-01 a 2027-06-30)
      const mappedMatchesFiltered = mappedMatches.filter(m => isTemporada2026_2027(m.date));

      if (mappedMatchesFiltered.length === 0) {
         console.log('   ℹ️  No se encontraron partidos válidos para la temporada 2026/2027 en la API.');
         continue;
      }

      for (const match of mappedMatchesFiltered) {
        let query = supabase
          .from('matches')
          .select('id, status')
          .eq('competition', match.competition)
          .ilike('rival', match.rival);

        if (match.matchday) {
          query = query.eq('matchday', match.matchday);
        } else {
          query = query.eq('date', match.date);
        }

        const { data: existing, error: searchError } = await query.maybeSingle();

        if (searchError) {
          console.error(`   ❌ Error buscando ${match.date} vs ${match.rival}: ${searchError.message}`);
          totalErrors++;
          continue;
        }

        if (existing) {
          if (existing.status === 'Jugado') {
            console.log(`   ⏭️  Omitido (Ya jugado): ${match.date} vs ${match.rival}`);
          } else {
            const { error } = await supabase.from('matches').update(match).eq('id', existing.id);
            if (error) { console.error(`   ❌ Update ${match.date} vs ${match.rival}: ${error.message}`); totalErrors++; }
            else { totalUpdated++; console.log(`   ✏️  Actualizado: ${match.date} vs ${match.rival} [${match.status}]`); }
          }
        } else {
          const { error } = await supabase.from('matches').insert(match);
          if (error) { console.error(`   ❌ Insert ${match.date} vs ${match.rival}: ${error.message}`); totalErrors++; }
          else { totalInserted++; console.log(`   ➕ Insertado: ${match.date} vs ${match.rival} [${match.status}]`); }
        }
      }
    }

    console.log(`\n📊 Sincronización completada:`);
    console.log(`   ➕ ${totalInserted} insertados`);
    console.log(`   ✏️  ${totalUpdated} actualizados`);
    if (totalErrors > 0) console.log(`   ❌ ${totalErrors} errores`);

    // Guardar el mapa de logos
    try {
      fs.writeFileSync(logosPath, JSON.stringify(logosMap, null, 2), 'utf8');
      console.log(`\n🎨 Logos actualizados en: ${logosPath}`);
    } catch (e) {
      console.error('❌ Error guardando logos:', e);
    }

  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
