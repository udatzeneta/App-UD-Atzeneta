const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    await page.goto('https://ffcv.es/competiciones/', { waitUntil: 'load', timeout: 60000 });
    
    // Aceptar cookies
    const selectors = ['button:has-text("Aceptar")', 'button:has-text("ACEPTAR")', '.cc-btn.cc-allow'];
    for (const sel of selectors) {
      try { await page.locator(sel).first().click({ timeout: 2000 }); } catch(e) {}
    }

    const selectElements = await page.evaluate(() => {
      return Array.from(document.querySelectorAll('select')).map(s => ({
        id: s.id,
        name: s.name,
        optionsCount: s.options.length,
        firstOption: s.options[0]?.text
      }));
    });

    console.log("Select elements found:", selectElements);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
