const { chromium } = require('playwright');

async function handleCookies(page) {
  const selectors = [
    'button:has-text("Aceptar")',
    'button:has-text("Accept")',
    'button:has-text("ACEPTAR")',
    'button:has-text("Aceptar todas")',
    'button:has-text("Accept all")',
    '.cc-btn.cc-allow',
    '.cm-btn-success'
  ];
  for (const sel of selectors) {
    try {
      await page.locator(sel).first().click({ timeout: 2000 });
      await page.waitForTimeout(1000);
      return;
    } catch (e) {}
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to FFCV Competiciones...");
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'load', timeout: 60000 });
    await handleCookies(page);

    console.log("Searching for 'Atzeneta'...");
    await page.waitForSelector('#club-search');
    await page.fill('#club-search', 'Atzeneta');
    await page.waitForSelector('text=U.D. Atzeneta de Castellón', { timeout: 15000 });
    await page.locator('text=U.D. Atzeneta de Castellón').first().click();

    console.log("Waiting for club page...");
    await page.waitForSelector('text=Equipos', { timeout: 30000 });
    await page.locator('text=Equipos').first().click();

    console.log("Waiting for team link...");
    const teamLink = page.locator('text="U.D. Atzeneta de Castellón \'A\'"').first();
    await teamLink.waitFor({ state: 'visible', timeout: 20000 });

    console.log("Clicking team link...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
      teamLink.click()
    ]);

    console.log("Fetching vis_competiciones_equipo.php...");
    const compsData = await page.evaluate(async () => {
      try {
        const response = await fetch('../api/equipos/vis_competiciones_equipo.php?codequipo=18331');
        return await response.json();
      } catch (err) {
        return { error: err.message };
      }
    });

    console.log("Competitions data:");
    console.log(JSON.stringify(compsData, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
