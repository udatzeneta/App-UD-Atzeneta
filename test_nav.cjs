const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

async function handleCookies(page) {
  try {
    const selectors = [
      'button:has-text("Aceptar")',
      'button:has-text("Accept")',
      'button:has-text("ACEPTAR")',
      'button:has-text("Aceptar todas")',
      'button:has-text("Accept all")',
      '.cc-btn.cc-allow',
      '#cookie-law-info-bar a',
      '.cm-btn-success'
    ];
    for (const sel of selectors) {
      const btn = page.locator(sel).first();
      if (await btn.isVisible()) {
        await btn.click();
        console.log(`Cookies accepted via: ${sel}`);
        await page.waitForTimeout(1000);
        return;
      }
    }
  } catch (e) {}
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to FFCV to establish session...");
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'load', timeout: 60000 });
    await handleCookies(page);
    await page.waitForTimeout(2000);

    console.log("Fetching competitions list via API in browser context...");
    const competitionsData = await page.evaluate(async (codEquipo) => {
      try {
        const response = await fetch(`https://ffcv.es/competiciones/api/equipos/vis_competiciones_equipo.php?codequipo=${encodeURIComponent(codEquipo)}`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return await response.json();
      } catch (err) {
        return { error: err.message };
      }
    }, '18331');

    console.log("API response (Competitions):", competitionsData.competiciones ? competitionsData.competiciones[0] : "no competitions");

    if (competitionsData && Array.isArray(competitionsData.competiciones)) {
      const activeComps = competitionsData.competiciones;
      console.log(`Found ${activeComps.length} competitions in raw data.`);

      for (const comp of activeComps) {
        const codGrupo = comp.cod_grupo || comp.codgrupo;
        const codTemporada = comp.cod_temporada || comp.codtemporada || '22'; // 2026/2027 season code
        const name = comp.nombre_competicion || comp.nombre || '';

        console.log(`\nFetching matches for: ${name} (Grupo: ${codGrupo}, Temporada: ${codTemporada})`);
        const matchesData = await page.evaluate(async ({ codEquipo, codTemporada, codGrupo }) => {
          try {
            const url = `https://ffcv.es/competiciones/api/equipos/partidos_equipo_temporada.php?cod_equipo=${encodeURIComponent(codEquipo)}&cod_temporada=${encodeURIComponent(codTemporada)}&cod_grupo=${encodeURIComponent(codGrupo)}`;
            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            return await response.json();
          } catch (err) {
            return { error: err.message };
          }
        }, { codEquipo: '18331', codTemporada, codGrupo });

        const partidos = matchesData?.partidos || [];
        console.log(`-> Received ${partidos.length} matches.`);
        if (partidos.length > 0) {
          console.log(`-> Sample match: ${JSON.stringify(partidos[0], null, 2)}`);
        }
      }
    } else {
      console.error("Failed to retrieve competitions array from API response.");
    }

  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await browser.close();
  }
})();
