// Sincroniza jugadores de equipos FFCV con la tabla scouting de Supabase
// Uso: node sync_players_scouting.cjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
// Prerrequisito: sync_teams_supabase.cjs ya ejecutado (equipos en Supabase)
// SQL previo: supabase/scouting_player_columns.sql y supabase/scouting_player_history.sql

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SEASON = '2025-2026';
const CLASSIF_URL = 'https://ffcv.es/competiciones/';
const TARGET_TEMPORADA = '21';

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

async function handleCookies(page) {
  const selectors = [
    'button:has-text("Aceptar")', 'button:has-text("ACEPTAR")',
    'button:has-text("Aceptar todas")', '.cc-btn.cc-allow', '.cm-btn-success',
  ];
  for (const sel of selectors) {
    try { await page.locator(sel).first().click({ timeout: 2000 }); return; } catch (e) {}
  }
}

// Navega a la clasificación y selecciona competición + grupo para que aparezcan los equipos
async function navigateToGroup(page, cod_competicion, cod_grupo) {
  await page.goto(CLASSIF_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch (e) {}
  await handleCookies(page);

  await page.waitForSelector('#sel-temporada', { timeout: 20000 });
  await page.selectOption('#sel-temporada', TARGET_TEMPORADA);

  await page.waitForFunction(() => {
    const sel = document.getElementById('sel-competicion');
    return sel && sel.options.length > 1;
  }, { timeout: 20000 });

  // Verificar que la competición existe en el selector
  const compOpts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#sel-competicion option')).map(o => ({ v: o.value, t: o.text.trim() }))
  );
  if (!compOpts.some(o => o.v === String(cod_competicion))) {
    throw new Error(`Competición ${cod_competicion} no está en el selector. Opciones: ${JSON.stringify(compOpts)}`);
  }

  await page.selectOption('#sel-competicion', String(cod_competicion));
  await page.waitForTimeout(4000);

  // Verificar que el grupo existe en el selector
  const grupoOpts = await page.evaluate(() =>
    Array.from(document.querySelectorAll('#sel-grupo option')).map(o => ({ v: o.value, t: o.text.trim() }))
  );
  if (!grupoOpts.some(o => o.v === String(cod_grupo))) {
    throw new Error(`Grupo ${cod_grupo} no está en el selector. Opciones: ${JSON.stringify(grupoOpts)}`);
  }

  await page.selectOption('#sel-grupo', String(cod_grupo));
  await page.waitForTimeout(3500);

  // Intentar ir a la pestaña Clasificaciones si existe (donde aparecen los equipos)
  try {
    const classifLink = page.locator('a[href*="clasificacion"], a:has-text("Clasificación"), a:has-text("Clasificaciones")').first();
    if (await classifLink.isVisible({ timeout: 3000 })) {
      await classifLink.click();
      await page.waitForTimeout(2000);
    }
  } catch (e) {}

  // Esperar equipos con [data-codequipo]
  try {
    await page.waitForSelector('[data-codequipo]', { timeout: 15000 });
  } catch (e) {
    // Diagnóstico: qué hay realmente en la página
    const pageUrl = page.url();
    const bodyText = await page.evaluate(() => document.body?.innerText?.slice(0, 300)).catch(() => '');
    throw new Error(`No aparecen equipos [data-codequipo] para comp=${cod_competicion} grupo=${cod_grupo}. URL: ${pageUrl}. Página: ${bodyText}`);
  }
}

// Asume que la página ya está en la ficha del equipo; hace clic en Plantilla y extrae jugadores
async function scrapeRosterFromTeamPage(page) {
  try {
    await page.waitForSelector('.submenu-link', { timeout: 10000 });
  } catch (e) {
    console.log(`    ⚠️  Página de equipo no cargó correctamente (${page.url()})`);
    return [];
  }

  const plantillaTab = page.locator('.submenu-link[data-tab="plantilla"]');
  try {
    await plantillaTab.waitFor({ state: 'visible', timeout: 8000 });
    await plantillaTab.click();
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log(`    ⚠️  Sin pestaña Plantilla`);
    return [];
  }

  try {
    await page.waitForSelector('.roster-card', { timeout: 10000 });
  } catch (e) {
    console.log(`    ℹ️  Plantilla vacía o sin datos`);
    return [];
  }

  return await page.evaluate(() =>
    Array.from(document.querySelectorAll('.roster-card')).map(card => {
      const link = card.querySelector('a.roster-card-nombre');
      return {
        name: link?.textContent?.trim() || null,
        dorsal: (card.querySelector('.roster-card-dorsal')?.textContent || '').replace('#', '').trim() || null,
        position: card.querySelector('.roster-card-pos')?.textContent?.trim() || null,
        playerUrl: link?.href || null,
      };
    }).filter(p => p.name && p.playerUrl)
  );
}

// teamUrl: URL de la ficha del equipo para volver después de scraping del jugador
async function scrapePlayerData(page, playerUrl, teamUrl) {
  // Navegar desde la página actual (mantiene Referer dentro del dominio FFCV)
  await page.evaluate(url => { window.location.href = url; }, playerUrl);

  try {
    await page.waitForSelector('.stat-card', { timeout: 15000 });
  } catch (e) {
    // Si redirigió a WordPress, no hay datos
    if (page.url().includes('/wp')) {
      await page.evaluate(url => { window.location.href = url; }, teamUrl);
      await page.waitForTimeout(2000);
      return { stats: {}, history: [] };
    }
    await page.waitForTimeout(3000);
  }

  const stats = await page.evaluate(() => {
    const s = {};
    document.querySelectorAll('.stat-card').forEach(card => {
      const val = card.querySelector('.stat-val')?.textContent?.trim();
      const lbl = card.querySelector('.stat-lbl')?.textContent?.trim();
      if (val !== undefined && val !== null && lbl) s[lbl] = val;
    });
    document.querySelectorAll('.ring-card').forEach(card => {
      const title = card.querySelector('.ring-title')?.textContent?.trim();
      const sub = card.querySelector('.ring-sub')?.textContent?.trim();
      if (title && sub) s[title] = sub;
    });
    return s;
  });

  // Historial: la sección existe pero está oculta; intentar mostrarla y leer datos
  let history = [];
  try {
    await page.evaluate(() => {
      const sec = document.getElementById('history');
      if (sec) sec.style.removeProperty('display');
      const ui = document.getElementById('history-ui');
      if (ui) ui.style.removeProperty('display');
    });
    await page.waitForSelector('#history-ui table, #history-content table', { timeout: 5000 });

    history = await page.evaluate(() =>
      Array.from(document.querySelectorAll('#history-ui tbody tr, #history-content tbody tr')).map(row => {
        const cells = row.querySelectorAll('td');
        const imgSrc = cells[1]?.querySelector('img')?.src || null;
        return {
          temporada: cells[0]?.textContent?.trim() || null,
          shield_url: imgSrc && !imgSrc.includes('escudo_generico') ? imgSrc : null,
          equipo: cells[2]?.textContent?.trim() || null,
          categoria: cells[3]?.textContent?.trim() || null,
        };
      }).filter(r => r.temporada && r.equipo)
    );
  } catch (e) {
    // Sin historial disponible — normal si no hay tabla cargada
  }

  // Volver a la ficha del equipo para el siguiente jugador
  await page.evaluate(url => { window.location.href = url; }, teamUrl);
  await page.waitForTimeout(2000);

  return { stats, history };
}

function toInt(val) {
  const n = parseInt(val, 10);
  return isNaN(n) ? null : n;
}

function toFloat(val) {
  const n = parseFloat(val);
  return isNaN(n) ? null : n;
}

function buildRecord(player, team, stats) {
  return {
    player_name: player.name,
    team: team.name,
    season: SEASON,
    competition: team.competition,
    position: player.position || 'Desconocida',
    rating: 3,
    dorsal: toInt(player.dorsal),
    convocados: toInt(stats['Convocados']),
    jugados: toInt(stats['Jugados']),
    titular: toInt(stats['Titular']),
    suplente: toInt(stats['Suplente']),
    goles: toInt(stats['Goles']),
    media_goles: toFloat(stats['Media goles/partido']),
    amarillas: toInt(stats['Amarillas']),
    doble_amarilla: toInt(stats['Doble amarilla']),
    rojas: toInt(stats['Rojas']),
    tarjeta_verde: toInt(stats['Tarjeta verde']),
    participacion: stats['Participación'] || null,
    titularidad: stats['Titularidad'] || null,
    disciplina: stats['Disciplina'] || null,
    goles_partido: toFloat(stats['Goles/partido']),
  };
}

(async () => {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || supabaseUrl.includes('your-supabase')) {
    console.error('❌ VITE_SUPABASE_URL no configurada en .env'); process.exit(1);
  }
  if (!supabaseKey || supabaseKey.includes('your-supabase')) {
    console.error('❌ SUPABASE_SERVICE_ROLE_KEY no configurada en .env'); process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, { auth: { persistSession: false } });

  const { data: teams, error: teamsError } = await supabase
    .from('teams')
    .select('ffcv_cod, name, cod_competicion, cod_grupo, competition')
    .eq('season', SEASON)
    .order('competition');

  if (teamsError) {
    console.error('❌ Error leyendo equipos de Supabase:', teamsError.message);
    process.exit(1);
  }
  if (!teams || teams.length === 0) {
    console.error('❌ No hay equipos en Supabase. Ejecuta sync_teams_supabase.cjs primero.');
    process.exit(1);
  }

  console.log(`🏟️  ${teams.length} equipos cargados desde Supabase`);

  // Agrupar equipos por (cod_competicion, cod_grupo) para minimizar navegaciones
  const groups = new Map();
  for (const team of teams) {
    const key = `${team.cod_competicion}__${team.cod_grupo}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(team);
  }
  console.log(`📋 ${groups.size} grupos de competición/grupo\n`);

  const DEBUG = process.env.DEBUG_HEADLESS === '1';
  const browser = await chromium.launch({ headless: !DEBUG });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  let totalInserted = 0, totalSkipped = 0, totalErrors = 0;

  try {
    for (const [groupKey, groupTeams] of groups) {
      const { cod_competicion, cod_grupo, competition } = groupTeams[0];
      console.log(`\n🏆 ${competition} | Grupo ${cod_grupo} (${groupTeams.length} equipos)`);

      try {
        await navigateToGroup(page, cod_competicion, cod_grupo);
      } catch (e) {
        console.error(`  ❌ Error navegando al grupo: ${e.message.split('\n')[0]}`);
        totalErrors += groupTeams.length;
        continue;
      }

      for (const team of groupTeams) {
        console.log(`\n  🏃 ${team.name}`);

        // Verificar si el equipo aparece en la clasificación actual
        const teamLink = page.locator(`[data-codequipo="${team.ffcv_cod}"] a`).first();
        const isVisible = await teamLink.isVisible().catch(() => false);

        if (!isVisible) {
          console.log(`    ⚠️  Equipo no visible en clasificación (cod ${team.ffcv_cod})`);
          continue;
        }

        // Hacer clic en el equipo (navegación real, no goto directo)
        await teamLink.click();
        await page.waitForTimeout(2000);
        const teamPageUrl = page.url(); // Guardar URL del equipo para volver desde jugadores

        // Extraer jugadores de la pestaña Plantilla
        let players;
        try {
          players = await scrapeRosterFromTeamPage(page);
        } catch (e) {
          console.error(`    ❌ Error scrapeando plantilla: ${e.message.split('\n')[0]}`);
          totalErrors++;
          players = [];
        }

        if (players.length === 0) {
          console.log(`    ℹ️  Sin jugadores`);
        } else {
          console.log(`    👥 ${players.length} jugadores en plantilla`);

          for (const player of players) {
            const { data: existing } = await supabase
              .from('scouting')
              .select('id')
              .eq('player_name', player.name)
              .eq('team', team.name)
              .eq('competition', team.competition)
              .eq('season', SEASON)
              .maybeSingle();

            if (existing) {
              console.log(`    ⏭️  ${player.name} — ya existe`);
              totalSkipped++;
              continue;
            }

            let stats = {}, history = [];
            try {
              ({ stats, history } = await scrapePlayerData(page, player.playerUrl, teamPageUrl));
            } catch (e) {
              console.error(`    ⚠️  Error datos ${player.name}: ${e.message.split('\n')[0]}`);
            }

            const record = buildRecord(player, team, stats);

            const { data: inserted, error: insertError } = await supabase
              .from('scouting')
              .insert(record)
              .select('id')
              .single();

            if (insertError) {
              console.error(`    ❌ Insert ${player.name}: ${insertError.message}`);
              totalErrors++;
            } else {
              console.log(`    ➕ ${player.name} | ${player.position} | Jugados: ${record.jugados ?? '—'} | Goles: ${record.goles ?? '—'} | Amarillas: ${record.amarillas ?? '—'}`);
              totalInserted++;

              if (history.length > 0 && inserted?.id) {
                const historyRows = history.map(h => ({ scouting_id: inserted.id, ...h }));
                const { error: histErr } = await supabase.from('scouting_player_history').insert(historyRows);
                if (histErr) {
                  console.error(`      ⚠️  Error historial: ${histErr.message}`);
                } else {
                  console.log(`      📋 Historial: ${history.length} temporadas`);
                }
              }
            }

            await page.waitForTimeout(400);
          }
        }

        // Volver a la clasificación para el siguiente equipo
        await page.goBack();
        await page.waitForTimeout(1500);

        // Si la SPA no restauró el estado, re-navegar al grupo
        const teamsStillVisible = await page.locator('[data-codequipo]').first().isVisible({ timeout: 5000 }).catch(() => false);
        if (!teamsStillVisible) {
          console.log(`    🔄 Re-navegando al grupo...`);
          try {
            await navigateToGroup(page, cod_competicion, cod_grupo);
          } catch (e) {
            console.error(`    ❌ Error re-navegando: ${e.message.split('\n')[0]}`);
            break;
          }
        }
      }
    }
  } catch (err) {
    console.error('❌ Error global:', err.message || err);
  } finally {
    await browser.close();
  }

  console.log('\n📊 Sincronización de jugadores completada:');
  console.log(`   ➕ ${totalInserted} jugadores insertados`);
  console.log(`   ⏭️  ${totalSkipped} jugadores saltados (ya existían)`);
  if (totalErrors) console.log(`   ❌ ${totalErrors} errores`);
})();
