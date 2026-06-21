// Debug: navega DESDE la página de clasificaciones FFCV y entra a un equipo
// Uso: node debug_team_page.cjs
// Comprueba la estructura real de la página de equipo cuando se accede correctamente

const { chromium } = require('playwright');

const CLASSIF_URL = 'https://ffcv.es/competiciones/';
const TARGET_TEMPORADA = '21';
const COMP_ID = '29509166'; // Primera FFCV
const TARGET_FFCV_COD = '14805'; // Paterna CF

async function handleCookies(page) {
  const selectors = [
    'button:has-text("Aceptar")', 'button:has-text("ACEPTAR")',
    'button:has-text("Aceptar todas")', '.cc-btn.cc-allow', '.cm-btn-success',
  ];
  for (const sel of selectors) {
    try { await page.locator(sel).first().click({ timeout: 2000 }); return; } catch (e) {}
  }
}

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({
    userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  // 1. Navegar a clasificaciones
  console.log('1. Navegando a clasificaciones...');
  await page.goto(CLASSIF_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  try { await page.waitForLoadState('networkidle', { timeout: 15000 }); } catch (e) {}
  await handleCookies(page);
  console.log(`   URL: ${page.url()}`);

  // 1b. Clic en "Clasificaciones"
  console.log('1b. Buscando pestaña Clasificaciones...');
  try {
    const classifLink = page.locator('a[href*="clasificaciones"], a:has-text("Clasificaciones"), a:has-text("CLASIFICACIONES")').first();
    await classifLink.waitFor({ state: 'visible', timeout: 10000 });
    await classifLink.click();
    await page.waitForTimeout(2000);
    console.log(`   URL tras clic: ${page.url()}`);
  } catch (e) {
    console.log('   No se encontró link clasificaciones, continuando...');
  }

  // 2. Seleccionar temporada
  console.log('2. Seleccionando temporada...');
  await page.waitForSelector('#sel-temporada', { timeout: 20000 });
  await page.selectOption('#sel-temporada', TARGET_TEMPORADA);
  await page.waitForFunction(() => {
    const sel = document.getElementById('sel-competicion');
    return sel && sel.options.length > 1;
  }, { timeout: 20000 });

  // 3. Seleccionar competición
  console.log('3. Seleccionando competición...');
  await page.selectOption('#sel-competicion', COMP_ID);
  await page.waitForTimeout(4000);

  // 4. Seleccionar primer grupo
  const grupos = await page.evaluate(() => {
    const sel = document.getElementById('sel-grupo');
    if (!sel) return [];
    return Array.from(sel.options).filter(o => o.value).map(o => ({ value: o.value, text: o.text.trim() }));
  });
  console.log(`4. Grupos: ${grupos.map(g => g.text).join(', ')}`);

  if (grupos.length > 0) {
    await page.selectOption('#sel-grupo', grupos[0].value);
    await page.waitForTimeout(3500);
  }

  // 5. Buscar el equipo y obtener su href
  await page.waitForSelector('[data-codequipo]', { timeout: 10000 });
  const teams = await page.evaluate(() =>
    Array.from(document.querySelectorAll('[data-codequipo]')).map(el => ({
      cod: el.getAttribute('data-codequipo'),
      name: el.getAttribute('data-team-name') || el.querySelector('.team-name-text')?.textContent?.trim(),
      href: el.querySelector('a')?.getAttribute('href'),
      fullHref: el.querySelector('a')?.href,
    }))
  );
  console.log(`5. ${teams.length} equipos cargados. Primeros 3:`);
  teams.slice(0, 3).forEach(t => console.log(`   [${t.cod}] ${t.name} | href="${t.href}" | full="${t.fullHref}"`));

  const target = teams.find(t => t.cod === TARGET_FFCV_COD) || teams[0];
  console.log(`\n   → Entrando a: [${target.cod}] ${target.name}`);

  // 6. Hacer clic en el equipo
  const teamLink = page.locator(`[data-codequipo="${target.cod}"] a`).first();
  await teamLink.click();
  await page.waitForTimeout(3000);

  const urlDespues = page.url();
  console.log(`6. URL después de clic: ${urlDespues}`);

  // 7. Inspeccionar la página del equipo
  const info = await page.evaluate(() => {
    const tabs = Array.from(document.querySelectorAll('[data-tab], .submenu-link, .nav-tab, .tab-link, [role="tab"]'))
      .map(el => ({
        tag: el.tagName, class: el.className,
        dataTtab: el.getAttribute('data-tab'), text: el.textContent?.trim().slice(0, 40),
      }));

    const headlines = Array.from(document.querySelectorAll('h1, h2, h3'))
      .map(h => h.textContent?.trim().slice(0, 80)).filter(Boolean);

    const ids = Array.from(document.querySelectorAll('[id]'))
      .map(el => el.id).filter(Boolean);

    const plantillaEl = Array.from(document.querySelectorAll('*'))
      .filter(el => {
        const t = (el.textContent || '').trim().toLowerCase();
        return (t === 'plantilla' || t === 'jugadores') && el.children.length === 0;
      })
      .map(el => ({ tag: el.tagName, class: el.className, text: el.textContent?.trim() }));

    const rosterEl = Array.from(document.querySelectorAll(
      '[class*="roster"], [class*="plantilla"], [class*="jugador"], [id*="roster"], [id*="plantilla"], [class*="player"]'
    )).map(el => ({ tag: el.tagName, class: el.className.slice(0, 60), id: el.id }));

    return { tabs, headlines, ids, plantillaEl, rosterEl };
  });

  console.log('\n📑 Tabs encontrados:');
  if (info.tabs.length === 0) console.log('   (ninguno)');
  info.tabs.forEach(t => console.log(`   [${t.tag}] class="${t.class}" data-tab="${t.dataTtab}" | "${t.text}"`));

  console.log('\n📝 Headlines:');
  info.headlines.slice(0, 8).forEach(h => console.log(`   ${h}`));

  console.log('\n🆔 IDs en página:');
  console.log(`   ${info.ids.slice(0, 20).join(', ')}`);

  console.log('\n🔑 Elementos con texto "Plantilla"/"Jugadores":');
  info.plantillaEl.forEach(e => console.log(`   [${e.tag}] class="${e.class}" | "${e.text}"`));

  console.log('\n👥 Elementos roster/player:');
  info.rosterEl.slice(0, 10).forEach(e => console.log(`   [${e.tag}] class="${e.class}" id="${e.id}"`));

  console.log('\n⏸️  Manteniendo navegador abierto 60s para inspección manual...');
  await page.waitForTimeout(60000);
  await browser.close();
})();
