const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

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
      console.log(`Cookies accepted via: ${sel}`);
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
    console.log("Navigating to https://ffcv.es/competiciones/#partidos ...");
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'load', timeout: 60000 });
    await handleCookies(page);

    console.log("Searching for 'Atzeneta'...");
    await page.waitForSelector('#club-search');
    await page.fill('#club-search', 'Atzeneta');
    await page.waitForSelector('text=U.D. Atzeneta de Castellón', { timeout: 15000 });
    await page.locator('text=U.D. Atzeneta de Castellón').first().click();

    console.log("Waiting for club page...");
    await page.waitForSelector('text=Equipos', { timeout: 30000 });
    await handleCookies(page);
    await page.waitForTimeout(2000);

    console.log("Clicking 'Equipos' tab...");
    await page.locator('text=Equipos').first().click();

    console.log("Waiting for team link...");
    const teamLink = page.locator('text="U.D. Atzeneta de Castellón \'A\'"').first();
    await teamLink.waitFor({ state: 'visible', timeout: 20000 });

    // Click the team link and wait for navigation
    console.log("Clicking team link...");
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
      teamLink.click()
    ]);

    console.log(`Current URL on team page: ${page.url()}`);
    await page.waitForTimeout(2000);
    await handleCookies(page);

    console.log("Clicking the 'Partidos' tab link...");
    const partidosTab = page.locator('a.submenu-link:has-text("Partidos")').first();
    await partidosTab.click();
    console.log("Clicked! Waiting for #team-partidos-competicion dropdown...");

    await page.waitForSelector('#team-partidos-competicion', { timeout: 20000 });
    console.log("Matches select dropdown found!");

    // Wait for the matches list/table cards to load
    await page.waitForSelector('.match-card', { timeout: 15000 });
    console.log("Found match cards!");

    // Let's click the first match card
    console.log("Clicking the first match card...");
    const firstMatchCard = page.locator('.match-card').first();
    
    // We expect navigation
    await Promise.all([
      page.waitForNavigation({ waitUntil: 'load', timeout: 30000 }),
      firstMatchCard.click()
    ]);

    console.log(`URL after clicking match card: ${page.url()}`);
    await page.waitForTimeout(3000);
    await handleCookies(page);

    // Save screenshot and HTML of match detail page
    await page.screenshot({ path: path.join(__dirname, 'clicked_match_page.png') });
    console.log("Saved clicked_match_page.png");

    const matchContent = await page.content();
    fs.writeFileSync(path.join(__dirname, 'clicked_match_page.html'), matchContent);
    console.log("Saved clicked_match_page.html");

  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await browser.close();
  }
})();
