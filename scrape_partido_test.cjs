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
      // Playwright click automatically waits for the element to be visible and stable
      await page.locator(sel).first().click({ timeout: 2000 });
      console.log(`Cookies accepted via: ${sel}`);
      await page.waitForTimeout(1000);
      return;
    } catch (e) {
      // Ignore errors and try next selector
    }
  }
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const testUrl = 'https://ffcv.es/competiciones/partidos/partido.php?cod_partido=26325361';
    console.log("Navigating to test match page:", testUrl);
    await page.goto(testUrl, { waitUntil: 'load', timeout: 60000 });
    
    console.log("Waiting for and handling cookie banner...");
    await handleCookies(page);
    
    await page.waitForTimeout(2000);

    // Save HTML content for parsing analysis
    const content = await page.content();
    fs.writeFileSync(path.join(__dirname, 'partido_page.html'), content);
    console.log("Successfully saved partido_page.html");

    // Take screenshot
    await page.screenshot({ path: path.join(__dirname, 'partido_page.png') });
    console.log("Successfully saved partido_page.png");

  } catch (err) {
    console.error("Error during execution:", err);
  } finally {
    await browser.close();
  }
})();
