// Sincroniza todos los equipos de FFCV (todas las competiciones, temporada 21) con la tabla teams de Supabase
// Uso: node sync_teams_supabase.cjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const TEMPORADA = '21';
const SEASON = '2025-2026';
const BASE_IMG = 'https://appwebffcv.filesnovanet.es';

// Todas las competiciones de la temporada 2025-2026
const COMPETICIONES = [
  { value: '29509164', label: 'Tercera Federación' },
  { value: '29509139', label: 'Play Off de Ascenso a Segunda Federación' },
  { value: '29509770', label: 'Fase Autonómica Copa Federación' },
  { value: '29509377', label: 'Lliga Comunitat' },
  { value: '29509140', label: 'Play Off de Ascenso a Tercera Federación' },
  { value: '29509166', label: 'Primera FFCV' },
  { value: '29509148', label: 'Play Off de Ascenso a LLiga Comunitat FFCV' },
  { value: '29509171', label: 'Segona FFCV' },
  { value: '29509150', label: 'Play Off Ascenso a Primera FFCV' },
  { value: '29509180', label: 'Tercera FFCV' },
  { value: '29509147', label: 'Play Off de Ascenso a Segona FFCV' },
  { value: '29509703', label: 'V La Nostra Copa' },
  { value: '29509242', label: 'Lliga de Veterans' },
  { value: '29509155', label: 'Copa Campeones Veteranos' },
  { value: '29509435', label: 'Liga Nacional Juvenil' },
  { value: '30372389', label: 'Play Off de Ascenso a Liga Nacional Juvenil' },
  { value: '29509154', label: 'Lliga Comunitat Juvenil' },
  { value: '29509437', label: 'Primera FFCV Juvenil' },
  { value: '29509196', label: 'Segona FFCV Juvenil' },
  { value: '29509159', label: 'Tercera FFCV Juvenil' },
  { value: '905306891', label: 'Play Off Ascenso a Lliga Comunitat FFCV Juvenil' },
  { value: '29509446', label: 'Lliga Autonòmica Cadet' },
  { value: '29509448', label: 'Lliga Preferent Cadet' },
  { value: '29509453', label: 'Primera Cadet' },
  { value: '29509506', label: 'Segona Cadet València' },
  { value: '29509507', label: 'Segona Cadet Alacant' },
  { value: '29509519', label: 'Segona Cadet Castelló' },
  { value: '29509466', label: 'Lliga Autonòmica Infantil' },
  { value: '29509468', label: 'Lliga Preferent Infantil' },
  { value: '29509473', label: 'Primera Infantil' },
  { value: '29509520', label: 'Segona Infantil València' },
  { value: '29509521', label: 'Segona Infantil Alacant' },
  { value: '29509224', label: 'Segona Infantil Castelló' },
];

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  const env = {};
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    for (const line of content.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const eqIdx = trimmed.indexOf('=');
      if (eqIdx > 0) env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim();
    }
  } catch (e) {}
  return env;
}

function normalizeShieldUrl(url) {
  if (!url) return null;
  url = String(url).trim();
  if (!url || url.startsWith('data:')) return null;
  if (url.startsWith('http')) return url;
  if (url.startsWith('//')) return 'https:' + url;
  return `${BASE_IMG}${url.startsWith('/') ? '' : '/'}${url}`;
}

// Extrae equipos de la respuesta JSON de clasificacion
function extractTeamsFromClasificacion(data, competicion, codGrupo, codCompeticion) {
  const teams = [];
  const clasificacion = data?.clasificacion || data?.Clasificacion || data;
  const list = Array.isArray(clasificacion) ? clasificacion : [];
  for (const row of list) {
    const cod = String(row.CodEquipo || row.cod_equipo || row.codEquipo || row.codigo_equipo || '').trim();
    const name = String(row.Nombre || row.nombre || row.NombreEquipo || row.nombre_equipo || '').trim();
    const shield = normalizeShieldUrl(row.url_img || row.escudo || row.Escudo || row.logo || row.Logo);
    if (!cod || !name) continue;
    teams.push({ ffcv_cod: cod, name, shield_url: shield, competition: competicion, cod_competicion: codCompeticion, cod_grupo: codGrupo, season: SEASON });
  }
  return teams;
}

// Extrae equipos únicos de la respuesta de partidos (sacando local y visitante de cada partido)
function extractTeamsFromPartidos(data, competicion, codGrupo, codCompeticion) {
  const teamsMap = {};
  const partidos = Array.isArray(data?.partidos) ? data.partidos : (Array.isArray(data) ? data : []);
  for (const p of partidos) {
    const codLocal = String(p.CodEquipo_local || p.cod_equipo_local || p.codigo_equipo_local || '').trim();
    const nameLocal = String(p.Nombre_equipo_local || p.equipo_local || '').trim();
    const shieldLocal = normalizeShieldUrl(p.url_img_local);
    const codVisita = String(p.CodEquipo_visitante || p.cod_equipo_visitante || p.codigo_equipo_visitante || '').trim();
    const nameVisita = String(p.Nombre_equipo_visitante || p.equipo_visitante || '').trim();
    const shieldVisita = normalizeShieldUrl(p.url_img_visitante);

    if (codLocal && nameLocal && !teamsMap[codLocal]) {
      teamsMap[codLocal] = { ffcv_cod: codLocal, name: nameLocal, shield_url: shieldLocal, competition: competicion, cod_competicion: codCompeticion, cod_grupo: codGrupo, season: SEASON };
    }
    if (codVisita && nameVisita && !teamsMap[codVisita]) {
      teamsMap[codVisita] = { ffcv_cod: codVisita, name: nameVisita, shield_url: shieldVisita, competition: competicion, cod_competicion: codCompeticion, cod_grupo: codGrupo, season: SEASON };
    }
  }
  return Object.values(teamsMap);
}

async function handleCookies(page) {
  const selectors = [
    'button:has-text("Aceptar")', 'button:has-text("ACEPTAR")',
    'button:has-text("Aceptar todas")', '.cc-btn.cc-allow', '.cm-btn-success',
  ];
  for (const sel of selectors) {
    try { await page.locator(sel).first().click({ timeout: 2000 }); return; } catch (e) {}
  }
}

// Rasca equipos del DOM de la página actual buscando links a equipo.php?codigo_equipo=XXXX
async function scrapeTeamsFromDOM(page, codGrupo, codCompeticion, compLabel) {
  return page.evaluate((codGrupo, codComp, compLabel, season, baseImg) => {
    const teams = [];
    const seen = new Set();

    function normalizeImg(src) {
      if (!src || src.startsWith('data:')) return null;
      if (src.startsWith('http')) return src;
      if (src.startsWith('//')) return 'https:' + src;
      if (src.startsWith('/')) return 'https://ffcv.es' + src;
      return baseImg + '/' + src;
    }

    // Links a páginas de equipo con el código del equipo en la URL
    const selectors = [
      'a[href*="codigo_equipo"]',
      'a[href*="cod_equipo="]',
      'a[href*="equipo.php"]',
    ];

    for (const sel of selectors) {
      document.querySelectorAll(sel).forEach(link => {
        const href = link.href || '';
        const codMatch = href.match(/(?:codigo_equipo|cod_equipo)=(\d+)/);
        if (!codMatch) return;
        const cod = codMatch[1];
        if (seen.has(cod)) return;
        seen.add(cod);

        // Nombre: buscar <span> dentro del link o el propio texto
        const span = link.querySelector('span');
        const name = (span || link).textContent.trim().replace(/\s+/g, ' ');
        if (!name || name.length < 2) return;

        // Escudo: buscar img en el link o en la fila del equipo
        const row = link.closest('tr, li, .team-row, .clasif-row, [class*="equipo"], [class*="team"]');
        const img = link.querySelector('img') || row?.querySelector('img');
        const shield = normalizeImg(img?.getAttribute('src') || img?.getAttribute('data-src') || null);

        teams.push({ ffcv_cod: cod, name, shield_url: shield, competition: compLabel, cod_competicion: codComp, cod_grupo: codGrupo, season });
      });
      if (teams.length > 0) break;
    }

    return teams;
  }, codGrupo, codCompeticion, compLabel, SEASON, BASE_IMG);
}

(async () => {
  const env = loadEnv();
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

  // Interceptor: captura las URLs de API de FFCV más recientes (lista ordenada, se resetea por grupo)
  let recentCaptures = [];
  page.on('request', req => {
    const url = req.url();
    if (!url.includes('ffcv.es')) return;
    if (!url.includes('clasificacion') && !url.includes('partidos') && !url.includes('equipos')) return;
    const clean = url.split('&force_rebuild')[0];
    const type = url.includes('clasificacion') ? 'clasificacion' : url.includes('partidos') ? 'partidos' : 'equipos';
    // Evitar duplicados
    if (!recentCaptures.find(c => c.url === clean)) recentCaptures.push({ url: clean, type });
  });

  let totalInserted = 0;
  let totalUpdated = 0;
  let totalErrors = 0;

  try {
    console.log('🌐 Navegando a FFCV Competiciones...');
    await page.goto('https://ffcv.es/competiciones/index.php', { waitUntil: 'load', timeout: 60000 });
    await handleCookies(page);

    // Seleccionar temporada 21
    await page.waitForSelector('#sel-temporada', { timeout: 15000 });
    await page.selectOption('#sel-temporada', TEMPORADA);
    await page.waitForTimeout(1500);

    console.log(`🏆 Procesando ${COMPETICIONES.length} competiciones...\n`);

    for (const comp of COMPETICIONES) {
      console.log(`📋 ${comp.label} (${comp.value})`);

      try {
        await page.selectOption('#sel-competicion', comp.value);
        await page.waitForTimeout(2000);
      } catch (e) {
        console.log(`   ⚠️  No se pudo seleccionar: ${e.message}`);
        continue;
      }

      // Leer grupos del selector (si existe)
      let grupos = [];
      try {
        const grupoSel = await page.$('#sel-grupo, #sel-grupo-competicion, select[name*="grupo"]');
        if (grupoSel) {
          grupos = await page.evaluate(sel => {
            return Array.from(sel.options)
              .filter(o => o.value && o.value !== '0')
              .map(o => ({ value: o.value, label: o.text.trim() }));
          }, grupoSel);
        }
      } catch (e) {}

      if (grupos.length === 0) {
        grupos = [{ value: comp.value, label: comp.label }];
      }

      for (const grupo of grupos) {
        // Resetear capturas antes de cada grupo para usar sólo las más recientes
        recentCaptures = [];

        // Seleccionar grupo si hay varios
        if (grupos.length > 1) {
          try {
            await page.selectOption('#sel-grupo, #sel-grupo-competicion, select[name*="grupo"]', grupo.value);
            await page.waitForTimeout(2000);
          } catch (e) {}
        }

        const codGrupo = grupo.value;
        let teams = [];

        // Pestañas a intentar en orden: Partidos primero (los links a equipo.php?codigo_equipo=X
        // aparecen en los partidos según los returnTo de las URLs de ejemplo), luego
        // Clasificación y Equipos como fallback. Se incluyen nombres en castellano y
        // valenciano ya que la FFCV mezcla ambos idiomas en su interfaz.
        const tabsToTry = [
          {
            name: 'Partidos',
            selectors: [
              'a:has-text("Partits")', 'a:has-text("Partidos")',
              'button:has-text("Partits")', 'button:has-text("Partidos")',
              '[data-tab="partidos"]', '[data-tab="partits"]',
              'a[href="#partidos"]', 'a[href="#partits"]',
            ],
          },
          {
            name: 'Clasificacion',
            selectors: [
              'a:has-text("Classificació")', 'a:has-text("Clasificación")', 'a:has-text("Clasificacion")',
              'button:has-text("Classificació")', 'button:has-text("Clasificación")',
              '[data-tab="clasificacion"]', '[data-tab="classificacio"]',
              'a[href="#clasificacion"]', 'a[href="#classificacio"]',
            ],
          },
          {
            name: 'Equipos',
            selectors: [
              'a:has-text("Equips")', 'a:has-text("Equipos")',
              'button:has-text("Equips")', 'button:has-text("Equipos")',
              '[data-tab="equipos"]', '[data-tab="equips"]',
              'a[href="#equipos"]', 'a[href="#equips"]',
            ],
          },
        ];

        for (const tab of tabsToTry) {
          if (teams.length > 0) break;

          // Intentar click en la pestaña
          for (const sel of tab.selectors) {
            try {
              await page.locator(sel).first().click({ timeout: 2000 });
              break;
            } catch (e) {}
          }

          // Esperar carga (red inactiva o timeout)
          await page.waitForLoadState('networkidle', { timeout: 5000 }).catch(() => {});
          await page.waitForTimeout(1500);

          // Scraping DOM
          try {
            const domTeams = await scrapeTeamsFromDOM(page, codGrupo, comp.value, comp.label);
            if (domTeams.length > 0) {
              teams = domTeams;
              console.log(`   🔍 ${tab.name}: ${teams.length} equipos encontrados en DOM`);
            }
          } catch (e) {}
        }

        // ── Fallback: URLs capturadas por el interceptor de red ───────────────
        if (teams.length === 0 && recentCaptures.length > 0) {
          console.log(`   🔎 Probando ${recentCaptures.length} URLs interceptadas...`);
          for (const { url, type } of recentCaptures) {
            try {
              const data = await page.evaluate(async (u) => {
                try { const r = await fetch(u, { cache: 'no-cache' }); return r.ok ? await r.json() : null; } catch (e) { return null; }
              }, url);
              if (!data) continue;
              if (type === 'clasificacion') teams = extractTeamsFromClasificacion(data, comp.label, codGrupo, comp.value);
              else if (type === 'partidos') teams = extractTeamsFromPartidos(data, comp.label, codGrupo, comp.value);
              else if (type === 'equipos') {
                const list = Array.isArray(data) ? data : (data?.equipos || []);
                for (const eq of list) {
                  const cod = String(eq.CodEquipo || eq.cod_equipo || eq.codEquipo || eq.codigo_equipo || '').trim();
                  const name = String(eq.Nombre || eq.nombre || eq.NombreEquipo || '').trim();
                  const shield = normalizeShieldUrl(eq.url_img || eq.escudo || eq.logo);
                  if (cod && name) teams.push({ ffcv_cod: cod, name, shield_url: shield, competition: comp.label, cod_competicion: comp.value, cod_grupo: codGrupo, season: SEASON });
                }
              }
              if (teams.length > 0) {
                console.log(`   🔍 API interceptada (${type}): ${teams.length} equipos`);
                break;
              }
            } catch (e) {}
          }
        }

        // ── Fallback: llamadas API directas ────────────────────────────────────
        if (teams.length === 0) {
          const apiBase = 'https://ffcv.es/competiciones/api';
          // Intentar con el valor del grupo Y con el de la competición (a veces coinciden)
          const gruposToTry = [...new Set([codGrupo, comp.value])];
          const urlsToTry = [];
          for (const g of gruposToTry) {
            urlsToTry.push(
              `${apiBase}/partidos/partidos_grupo.php?cod_grupo=${g}&cod_temporada=${TEMPORADA}&cod_competicion=${comp.value}`,
              `${apiBase}/partidos/partidos_grupo.php?cod_grupo=${g}&cod_temporada=${TEMPORADA}`,
              `${apiBase}/partidos/partidos_grupo.php?codgrupo=${g}&codtemporada=${TEMPORADA}`,
              `${apiBase}/clasificacion/clasificacion_grupo.php?cod_grupo=${g}&cod_temporada=${TEMPORADA}&cod_competicion=${comp.value}`,
              `${apiBase}/clasificacion/clasificacion_grupo.php?cod_grupo=${g}&cod_temporada=${TEMPORADA}`,
              `${apiBase}/clasificacion/clasificacion_grupo.php?codgrupo=${g}&codtemporada=${TEMPORADA}`,
              `${apiBase}/equipos/equipos_grupo.php?cod_grupo=${g}&cod_temporada=${TEMPORADA}`,
              `${apiBase}/equipos/equipos_grupo.php?codgrupo=${g}&codtemporada=${TEMPORADA}`,
            );
          }

          for (const apiUrl of urlsToTry) {
            try {
              const data = await page.evaluate(async (url) => {
                try {
                  const res = await fetch(url, { cache: 'no-cache' });
                  if (!res.ok) return null;
                  const text = await res.text();
                  if (!text || text.trim() === '' || text.trim() === 'null' || text.trim().startsWith('<')) return null;
                  return JSON.parse(text);
                } catch (e) { return null; }
              }, apiUrl);

              if (!data) continue;

              if (apiUrl.includes('partidos')) {
                teams = extractTeamsFromPartidos(data, comp.label, codGrupo, comp.value);
              } else if (apiUrl.includes('clasificacion')) {
                teams = extractTeamsFromClasificacion(data, comp.label, codGrupo, comp.value);
              } else if (apiUrl.includes('equipos_grupo')) {
                const list = Array.isArray(data) ? data : (data?.equipos || []);
                for (const eq of list) {
                  const cod = String(eq.CodEquipo || eq.cod_equipo || eq.codEquipo || eq.codigo_equipo || '').trim();
                  const name = String(eq.Nombre || eq.nombre || eq.NombreEquipo || '').trim();
                  const shield = normalizeShieldUrl(eq.url_img || eq.escudo || eq.logo);
                  if (cod && name) teams.push({ ffcv_cod: cod, name, shield_url: shield, competition: comp.label, cod_competicion: comp.value, cod_grupo: codGrupo, season: SEASON });
                }
              }

              if (teams.length > 0) {
                console.log(`   🔍 API directa: ${teams.length} equipos`);
                break;
              }
            } catch (e) {}
          }
        }

        if (teams.length === 0) {
          console.log(`   ⚠️  Grupo ${grupo.label || codGrupo}: sin datos`);
          continue;
        }

        console.log(`   ✅ Grupo "${grupo.label}" → ${teams.length} equipos`);

        // Upsert en Supabase
        for (const team of teams) {
          const { data: existing, error: searchErr } = await supabase
            .from('teams')
            .select('id, shield_url')
            .eq('ffcv_cod', team.ffcv_cod)
            .eq('cod_grupo', team.cod_grupo)
            .maybeSingle();

          if (searchErr) {
            console.error(`      ❌ ${team.name}: ${searchErr.message}`);
            totalErrors++;
            continue;
          }

          if (existing) {
            const update = { name: team.name, competition: team.competition, updated_at: new Date().toISOString() };
            if (team.shield_url && !existing.shield_url) update.shield_url = team.shield_url;
            const { error } = await supabase.from('teams').update(update).eq('id', existing.id);
            if (error) { console.error(`      ❌ Update ${team.name}: ${error.message}`); totalErrors++; }
            else totalUpdated++;
          } else {
            const { error } = await supabase.from('teams').insert(team);
            if (error) { console.error(`      ❌ Insert ${team.name}: ${error.message}`); totalErrors++; }
            else { totalInserted++; console.log(`      ➕ ${team.name}`); }
          }
        }
      }
    }

    console.log('\n📊 Sincronización completada:');
    console.log(`   ➕ ${totalInserted} equipos insertados`);
    console.log(`   ✏️  ${totalUpdated} equipos actualizados`);
    if (totalErrors > 0) console.log(`   ❌ ${totalErrors} errores`);

  } catch (err) {
    console.error('❌ Error fatal:', err.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
