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

    // List all links containing "Partidos" on this team page
    const teamPageLinks = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('a')).map(a => ({
        text: a.innerText.trim(),
        href: a.getAttribute('href'),
        className: a.className,
        parentClass: a.parentElement ? a.parentElement.className : '',
        parentTag: a.parentElement ? a.parentElement.tagName : '',
        outerHTML: a.outerHTML.substring(0, 300)
      })).filter(l => l.text.toLowerCase().includes('partido') || (l.href && l.href.toLowerCase().includes('partido')));
    });

    console.log("Found matches/partidos related links on team page:", JSON.stringify(teamPageLinks, null, 2));

    // Look for the correct tab link. It usually has class "submenu-link"
    const targetLinkInfo = teamPageLinks.find(l => l.className === 'submenu-link' && l.text === 'Partidos');
    console.log("Target link info:", targetLinkInfo);

    console.log("Clicking the 'Partidos' tab link...");
    // Let's locate it by selecting an anchor with class submenu-link and text Partidos
    const partidosTab = page.locator('a.submenu-link:has-text("Partidos")').first();
    await partidosTab.click();
    console.log("Clicked! Waiting for #team-partidos-competicion dropdown...");

    await page.waitForSelector('#team-partidos-competicion', { timeout: 20000 });
    console.log("Matches select dropdown found!");

    // Get all options in the select element
    const options = await page.evaluate(() => {
      const select = document.getElementById('team-partidos-competicion');
      if (!select) return [];
      return Array.from(select.options).map(opt => ({
        value: opt.value,
        text: opt.textContent.trim()
      }));
    });
    console.log("Found competitions inside dropdown:", JSON.stringify(options, null, 2));

    // Save matches tab screenshot
    await page.waitForTimeout(2000);
    await page.screenshot({ path: path.join(__dirname, 'matches_tab_loaded.png') });
    console.log("Saved matches_tab_loaded.png");

    // Save the page HTML to analyze the table structure
    const content = await page.content();
    fs.writeFileSync(path.join(__dirname, 'matches_tab.html'), content);
    console.log("Saved matches_tab.html");

  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await browser.close();
  }
})();
