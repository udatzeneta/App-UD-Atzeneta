// Sincroniza equipos de FFCV clasificaciones con la tabla teams de Supabase
// Uso: node sync_teams_supabase.cjs
// Requiere: VITE_SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en .env
// Ejecutar primero en Supabase: supabase/teams_table.sql

const { chromium } = require('playwright');
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const TARGET_TEMPORADA = '22';          // 2026-2027
const SEASON = '2026-2027';
const CLASSIF_URL = 'https://ffcv.es/competiciones/';

// Lista de competiciones a sincronizar con su configuración de filtrado de grupos
const TARGET_COMPETITIONS = [
  { id: '905431604', name: 'Tercera Federación', onlyGroups: ['VI', '6'] },
  { id: '905431821', name: 'Lliga Comunitat', onlyGroups: ['Nord', 'Norte'] },
  { id: '905431606', name: 'Primera FFCV', onlyGroups: ['1', 'I'] }
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
  } catch (e) { }
  return env;
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

// Fix 1 — Navega a la sección de clasificaciones y espera a que #sel-competicion tenga opciones.
// Se llama al inicio de cada competición (siempre, no condicionalmente).
async function navigateToClassifications(page) {
  await page.goto(CLASSIF_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch (e) { }
  await handleCookies(page);

  try {
    const classifLink = page.locator('a[href*="clasificaciones"], a:has-text("Clasificaciones"), a:has-text("CLASIFICACIONES")').first();
    await classifLink.waitFor({ state: 'visible', timeout: 10000 });
    await classifLink.click();
    await page.waitForTimeout(2000);
  } catch (e) {
    console.log('  ℹ️  No se encontró link de clasificaciones, probando URL directa...');
    await page.goto('https://ffcv.es/competiciones/#clasificaciones', { waitUntil: 'domcontentloaded', timeout: 30000 });
    try { await page.waitForLoadState('networkidle', { timeout: 10000 }); } catch (_) { }
  }

  await page.waitForSelector('#sel-temporada', { timeout: 30000 });
  await page.selectOption('#sel-temporada', TARGET_TEMPORADA);

  // Esperar a que #sel-competicion tenga opciones (en vez de waitForTimeout fijo)
  await page.waitForFunction(() => {
    const sel = document.getElementById('sel-competicion');
    return sel && sel.options.length > 1;
  }, { timeout: 20000 });
}

async function scrapeTeamDetail(page, teamUrl) {
  await page.goto(teamUrl, { waitUntil: 'load', timeout: 30000 });

  try {
    await page.waitForSelector('.detail-cards .dc-label', { timeout: 12000 });
  } catch (e) {
    await page.waitForTimeout(3000);
  }

  return await page.evaluate(() => {
    const result = {
      club: null, campo: null, web: null,
      email: null, telefono: null, horario: null,
      staff_tecnicos: [], staff_auxiliares: [],
    };

    document.querySelectorAll('.detail-card').forEach(card => {
      const label = (card.querySelector('.dc-label')?.textContent || '')
        .trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
      const val = (card.querySelector('.dc-val')?.textContent || '').trim() || null;
      if (!val) return;
      if (label.includes('club')) result.club = val;
      else if (label.includes('campo')) result.campo = val;
      else if (label.includes('web')) result.web = val;
      else if (label.includes('email') || label.includes('mail')) result.email = val;
      else if (label.includes('tel')) result.telefono = val;
      else if (label.includes('horario')) result.horario = val;
    });

    const staffBlock = document.querySelector('.ucl-staff-block');
    if (staffBlock) {
      staffBlock.querySelectorAll('.ucl-grid > div').forEach(section => {
        const title = (section.querySelector('div')?.textContent || '')
          .trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '');
        const names = Array.from(section.querySelectorAll('.li-name'))
          .map(el => el.textContent.trim()).filter(Boolean);
        if (title.includes('tecnico')) result.staff_tecnicos = names;
        else if (title.includes('auxiliar')) result.staff_auxiliares = names;
      });
    }

    return result;
  });
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

  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });
  const page = await context.newPage();

  try {
    for (const comp of TARGET_COMPETITIONS) {
      console.log(`\n🏆 Procesando competición: ${comp.name} (${comp.id})`);

      // ── 1. Navegar a clasificaciones (siempre, para garantizar estado limpio) ──
      console.log('🌐 Navegando a clasificaciones FFCV...');
      try {
        await navigateToClassifications(page);
      } catch (e) {
        console.error(`❌ No se pudo navegar a clasificaciones para ${comp.name}: ${e.message}`);
        continue;
      }

      // ── 2. Seleccionar competición ─────────────────────────────────────────────
      const available = await page.evaluate(() =>
        Array.from(document.querySelectorAll('#sel-competicion option')).map(o => o.value)
      );
      if (!available.includes(String(comp.id))) {
        console.error(`❌ Competición ${comp.id} (${comp.name}) no encontrada. Opciones disponibles:`);
        const opts = await page.evaluate(() =>
          Array.from(document.querySelectorAll('#sel-competicion option')).map(o => `  ${o.value}: ${o.text}`)
        );
        console.log(opts.join('\n'));
        continue;
      }
      await page.selectOption('#sel-competicion', comp.id);
      await page.waitForTimeout(4000); // Dar tiempo para que carguen los grupos

      // ── 3. Obtener todos los grupos disponibles ────────────────────────────────
      let grupos = await page.evaluate(() => {
        const sel = document.getElementById('sel-grupo');
        if (!sel) return [];
        return Array.from(sel.options)
          .filter(o => o.value)
          .map(o => ({ value: o.value, text: o.text.trim() }));
      });

      if (grupos.length === 0) {
        console.error(`❌ No se encontraron grupos para ${comp.name}. Verifica la competición seleccionada.`);
        continue;
      }
      console.log(`📋 Grupos encontrados: ${grupos.map(g => g.text).join(', ')}`);

      if (comp.onlyGroups) {
        grupos = grupos.filter(grupo => {
          return comp.onlyGroups.some(g => {
            const regex = new RegExp(`\\b${g}\\b`, 'i');
            return regex.test(grupo.text);
          });
        });
        console.log(`🎯 Grupos a descargar (filtrados): ${grupos.map(g => g.text).join(', ')}`);
      }

      if (grupos.length === 0) {
        console.log(`  ℹ️  No hay grupos que coincidan con el filtro para ${comp.name}.`);
        continue;
      }

      // ── 4. Recoger equipos de todos los grupos seleccionados ──────────────────
      const classifPageUrl = page.url();
      const teamsMap = new Map(); // ffcv_cod → { ffcv_cod, name, shield_url, cod_grupo, href }

      for (const grupo of grupos) {
        console.log(`  ⏳ Cargando equipos de: ${grupo.text}...`);
        await page.selectOption('#sel-grupo', grupo.value);
        await page.waitForTimeout(3500);

        try {
          await page.waitForSelector('[data-codequipo]', { timeout: 10000 });
        } catch (e) {
          console.log(`  ℹ️  ${grupo.text}: sin equipos en la tabla`);
          continue;
        }

        const teams = await page.evaluate(() =>
          Array.from(document.querySelectorAll('[data-codequipo]')).map(el => ({
            ffcv_cod: el.getAttribute('data-codequipo') || '',
            name: el.getAttribute('data-team-name') || el.querySelector('.team-name-text')?.textContent?.trim() || '',
            shield_url: el.querySelector('img.team-shield')?.getAttribute('src') || null,
            href: el.querySelector('a')?.getAttribute('href') || null,
          })).filter(t => t.ffcv_cod && t.name)
        );

        console.log(`  ${grupo.text}: ${teams.length} equipos`);

        for (const team of teams) {
          if (!teamsMap.has(team.ffcv_cod)) {
            teamsMap.set(team.ffcv_cod, { ...team, cod_grupo: grupo.value, grupo_name: grupo.text });
          }
        }
      }

      console.log(`🏟️  Total equipos únicos para ${comp.name}: ${teamsMap.size}`);

      // ── 5. Scrapear detalle de cada equipo e insertar en Supabase ─────────────
      let inserted = 0, skipped = 0, errors = 0;

      for (const [cod, team] of teamsMap) {
        // Fix 2 — Comprobar Supabase antes de navegar a la ficha del equipo
        const { data: existing } = await supabase
          .from('teams').select('id')
          .eq('ffcv_cod', cod).eq('cod_grupo', team.cod_grupo)
          .maybeSingle();

        if (existing) {
          console.log(`⏭️  ${team.name} (${team.grupo_name}) — ya existe, saltando`);
          skipped++;
          continue;
        }

        let teamUrl;
        try {
          teamUrl = team.href
            ? new URL(team.href, classifPageUrl).toString()
            : `https://ffcv.es/competiciones/equipos/equipo.php?cod_equipo=${cod}`;
        } catch (e) {
          teamUrl = `https://ffcv.es/competiciones/equipos/equipo.php?cod_equipo=${cod}`;
        }

        console.log(`🔍 ${team.name} (${team.grupo_name})`);

        let detail = {
          club: null, campo: null, web: null, email: null,
          telefono: null, horario: null, staff_tecnicos: [], staff_auxiliares: [],
        };
        try {
          detail = await scrapeTeamDetail(page, teamUrl);
          console.log(`   Club: ${detail.club ?? '—'} | Campo: ${detail.campo ?? '—'} | Horario: ${detail.horario ?? '—'}`);
          if (detail.staff_tecnicos.length)
            console.log(`   Técnicos: ${detail.staff_tecnicos.join(', ')}`);
          if (detail.staff_auxiliares.length)
            console.log(`   Auxiliares: ${detail.staff_auxiliares.join(', ')}`);
        } catch (err) {
          console.error(`   ⚠️  Error scrapeando detalle: ${err.message}`);
          errors++;
        }

        const shieldUrl = team.shield_url
          ? (team.shield_url.startsWith('http')
            ? team.shield_url
            : `https://appwebffcv.novanet.es${team.shield_url}`)
          : null;

        const record = {
          ffcv_cod: cod,
          name: team.name,
          shield_url: shieldUrl,
          competition: comp.name,
          cod_competicion: comp.id,
          cod_grupo: team.cod_grupo,
          season: SEASON,
          club: detail.club,
          campo: detail.campo,
          web: detail.web,
          email: detail.email,
          telefono: detail.telefono,
          horario: detail.horario,
          staff_tecnicos: detail.staff_tecnicos,
          staff_auxiliares: detail.staff_auxiliares,
          updated_at: new Date().toISOString(),
        };

        const { error } = await supabase.from('teams').insert(record);
        if (error) { console.error(`   ❌ Insert: ${error.message}`); errors++; }
        else { inserted++; console.log(`   ➕ Insertado`); }

        await page.waitForTimeout(800);
      }

      console.log(`\n📊 Sincronización de ${comp.name} completada:`);
      console.log(`   ➕ ${inserted} equipos insertados`);
      console.log(`   ⏭️  ${skipped} equipos saltados (ya existían)`);
      if (errors) console.log(`   ❌ ${errors} errores`);
    }

  } catch (err) {
    console.error('❌ Error:', err.message || err);
    process.exit(1);
  } finally {
    await browser.close();
  }
})();
