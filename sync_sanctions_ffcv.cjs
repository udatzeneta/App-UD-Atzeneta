// Sincroniza las sanciones del Comité de Competición de la FFCV con Supabase
// Uso: node sync_sanctions_ffcv.cjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

if (!globalThis.WebSocket) {
  globalThis.WebSocket = require('ws');
}

const SEASON = '2026-2027';
const CLASSIF_URL = 'https://ffcv.es/competiciones/#partidos';
const TARGET_TEMPORADA = '22';

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

function parseMatchesCount(metaText) {
  if (!metaText) return 1;
  const match = metaText.match(/(\d+)\s*partido/i);
  if (match) return parseInt(match[1], 10);
  if (/mes/i.test(metaText)) return 4; // 1 mes ~ 4 partidos
  if (/semana/i.test(metaText)) return 1;
  return 1;
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

async function scrapeSanctionsForGroup(page, cod_competicion, cod_grupo, groupName) {
  console.log(`\n🔍 Navegando a competición: ${cod_competicion} | grupo: ${cod_grupo} (${groupName || 'FFCV'})...`);
  await page.goto(CLASSIF_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(2000);
  await handleCookies(page);

  // 1. Seleccionar temporada 22 (2026/2027)
  try {
    await page.waitForSelector('#sel-temporada', { timeout: 10000 });
    await page.selectOption('#sel-temporada', TARGET_TEMPORADA);
    await page.waitForTimeout(1500);
  } catch (e) {
    console.log('Aviso al seleccionar temporada:', e.message);
  }

  // 2. Seleccionar competición si se especificó
  if (cod_competicion) {
    try {
      await page.waitForFunction(() => {
        const sel = document.getElementById('sel-competicion');
        return sel && sel.options.length > 1;
      }, { timeout: 10000 });
      await page.selectOption('#sel-competicion', String(cod_competicion));
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log(`Aviso al seleccionar competición ${cod_competicion}:`, e.message);
    }
  }

  // 3. Seleccionar grupo si se especificó
  if (cod_grupo) {
    try {
      await page.waitForFunction(() => {
        const sel = document.getElementById('sel-grupo');
        return sel && sel.options.length > 0;
      }, { timeout: 10000 });
      await page.selectOption('#sel-grupo', String(cod_grupo));
      await page.waitForTimeout(2500);
    } catch (e) {
      console.log(`Aviso al seleccionar grupo ${cod_grupo}:`, e.message);
    }
  }

  // 4. Hacer clic en pestaña Sanciones (#nav-sanciones)
  const sancionTab = page.locator('#nav-sanciones, a:has-text("Sanciones"), a[href*="sanciones"]').first();
  try {
    if (await sancionTab.isVisible({ timeout: 5000 })) {
      await sancionTab.click();
      await page.waitForTimeout(2500);
    } else {
      console.log('  ⚠️ No se localizó el botón #nav-sanciones para esta combinación.');
    }
  } catch (e) {
    console.log('  ⚠️ Error al hacer click en #nav-sanciones:', e.message);
  }

  // 5. Extraer fechas de comité disponibles (botones pill-btn o select #sel-fecha)
  const dateButtons = await page.$$eval('button.pill-btn[data-date]', btns =>
    btns.map(b => ({
      date: b.getAttribute('data-date'),
      text: b.textContent.trim()
    })).filter(b => b.date && b.date.trim().length > 0)
  );

  const groupSanctions = [];

  if (dateButtons.length === 0) {
    const cards = await extractCardsFromPage(page, new Date().toISOString().slice(0, 10));
    groupSanctions.push(...cards);
  } else {
    for (const btnInfo of dateButtons) {
      try {
        const btnLocator = page.locator(`button.pill-btn[data-date="${btnInfo.date}"]`).first();
        if (await btnLocator.isVisible({ timeout: 2000 })) {
          await btnLocator.click();
          await page.waitForTimeout(1500);
        }
      } catch (e) {}

      const cards = await extractCardsFromPage(page, btnInfo.date);
      if (cards.length > 0) {
        console.log(`  -> [${btnInfo.date}] ${cards.length} sanciones encontradas`);
        groupSanctions.push(...cards);
      }
    }
  }

  return groupSanctions;
}

async function extractCardsFromPage(page, resolutionDate) {
  return await page.$$eval('.sancion-card', (elements, resDate) => {
    const results = [];
    elements.forEach(card => {
      const teamName = card.querySelector('.team-head .team-name')?.textContent.trim() || '';
      const category = card.querySelector('.bloque-t:not(.team-head):not(.articulo-pill)')?.textContent.trim() || 'Jugadores';
      const article = card.querySelector('.articulo-pill')?.textContent.trim() || '';

      const items = Array.from(card.querySelectorAll('.sancion-item')).map(item => {
        const name = item.querySelector('.name')?.textContent.trim() || item.getAttribute('title')?.replace(/^Ver ficha de\s*/i, '').trim() || '';
        const meta = item.querySelector('.meta')?.textContent.trim() || '1 partido';
        const avatar = item.querySelector('img.avatar')?.getAttribute('src') || '';
        const href = item.getAttribute('href') || '';
        const codLicenciaMatch = href.match(/cod_licencia=([^&]+)/);
        const codLicencia = codLicenciaMatch ? codLicenciaMatch[1] : null;

        return {
          team_name: teamName,
          player_name: name,
          photo_url: avatar.startsWith('data:') || avatar.startsWith('http') ? avatar : null,
          category,
          article,
          sanction_text: meta,
          resolution_date: resDate,
          cod_licencia: codLicencia
        };
      });

      results.push(...items);
    });
    return results;
  }, resolutionDate);
}

async function main() {
  const env = loadEnv();
  const supabaseUrl = env.VITE_SUPABASE_URL;
  const supabaseKey = env.SUPABASE_SERVICE_ROLE_KEY || env.VITE_SUPABASE_ANON_KEY;

  let supabase = null;
  if (supabaseUrl && supabaseKey) {
    supabase = createClient(supabaseUrl, supabaseKey);
  }

  // Cargar grupos de competición desde Supabase
  let compGroups = [];
  if (supabase) {
    const { data: teams } = await supabase
      .from('teams')
      .select('cod_competicion, cod_grupo, competition')
      .eq('season', SEASON);

    if (teams && teams.length > 0) {
      const seen = new Set();
      for (const t of teams) {
        if (!t.cod_competicion || !t.cod_grupo) continue;
        const key = `${t.cod_competicion}__${t.cod_grupo}`;
        if (!seen.has(key)) {
          seen.add(key);
          compGroups.push({
            cod_competicion: t.cod_competicion,
            cod_grupo: t.cod_grupo,
            competition: t.competition
          });
        }
      }
    }
  }

  // Fallback si no hay Supabase o equipos cargados
  if (compGroups.length === 0) {
    compGroups = [
      { cod_competicion: '905431604', cod_grupo: '905431607', competition: 'Tercera Federación' },
      { cod_competicion: '905431821', cod_grupo: '905431822', competition: 'Lliga Comunitat - Grup Nord' },
      { cod_competicion: '905431821', cod_grupo: '905431823', competition: 'Lliga Comunitat - Grup Sud' },
      { cod_competicion: '905431606', cod_grupo: '905431607', competition: 'Primera FFCV - Grup 1' },
      { cod_competicion: '905431606', cod_grupo: '905431608', competition: 'Primera FFCV - Grup 2' },
      { cod_competicion: '905431611', cod_grupo: '905431612', competition: 'Segona FFCV - Grup 1' }
    ];
  }

  console.log(`📋 Sincronizando sanciones para ${compGroups.length} ligas y grupos FFCV...`);

  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const rawSanctions = [];

  try {
    for (const g of compGroups) {
      const cards = await scrapeSanctionsForGroup(page, g.cod_competicion, g.cod_grupo, g.competition);
      rawSanctions.push(...cards);
    }

    console.log(`\nTotal de sanciones extraídas en todas las ligas: ${rawSanctions.length}`);

    // Deduplicar sanciones por (team_name, player_name, resolution_date, article)
    const uniqueSanctions = [];
    const seen = new Set();

    for (const s of rawSanctions) {
      if (!s.player_name || !s.team_name) continue;
      const key = `${s.team_name}__${s.player_name}__${s.resolution_date}__${s.article}`.toLowerCase();
      if (!seen.has(key)) {
        seen.add(key);
        const matchesCount = parseMatchesCount(s.sanction_text);
        uniqueSanctions.push({
          id: `sanc-${Buffer.from(key).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 32)}`,
          team_name: s.team_name,
          player_name: s.player_name,
          photo_url: s.photo_url || null,
          category: s.category || 'Jugadores',
          article: s.article || '',
          sanction_text: s.sanction_text,
          matches_count: matchesCount,
          resolution_date: s.resolution_date,
          cod_licencia: s.cod_licencia || null,
          season: SEASON
        });
      }
    }

    console.log(`Sanciones únicas deduplicadas: ${uniqueSanctions.length}`);

    // Guardar en archivo local JSON como backup / cache
    const publicDataDir = path.join(__dirname, 'public', 'data');
    if (!fs.existsSync(publicDataDir)) {
      fs.mkdirSync(publicDataDir, { recursive: true });
    }
    const jsonPath = path.join(publicDataDir, 'ffcv_sanctions.json');
    fs.writeFileSync(jsonPath, JSON.stringify(uniqueSanctions, null, 2), 'utf8');
    console.log(`Copia local guardada en: ${jsonPath}`);

    // Guardar en Supabase si está disponible
    if (supabase && uniqueSanctions.length > 0) {
      console.log('Subiendo sanciones a Supabase...');
      for (const chunk of chunkArray(uniqueSanctions, 50)) {
        const { error } = await supabase.from('ffcv_sanctions').upsert(chunk, { onConflict: 'id' });
        if (error) {
          console.warn('Aviso al insertar en Supabase (puede requerir aplicar supabase/add_ffcv_sanctions.sql):', error.message);
        } else {
          console.log(` -> Subidas ${chunk.length} sanciones a Supabase.`);
        }
      }
    }

    console.log('\n✅ Sincronización de sanciones del Comité de Competición completada con éxito.');

  } catch (err) {
    console.error('Error durante la sincronización de sanciones:', err);
  } finally {
    await browser.close();
  }
}

function chunkArray(arr, size) {
  const chunks = [];
  for (let i = 0; i < arr.length; i += size) {
    chunks.push(arr.slice(i, i + size));
  }
  return chunks;
}

main();
