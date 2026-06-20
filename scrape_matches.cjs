const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    console.log("Navigating to https://ffcv.es/competiciones/#partidos ...");
    await page.goto('https://ffcv.es/competiciones/#partidos', { waitUntil: 'load', timeout: 60000 });

    // Print all frames on the page
    const frames = page.frames();
    console.log(`Total frames found: ${frames.length}`);
    frames.forEach((frame, idx) => {
      console.log(`Frame ${idx}: name="${frame.name()}", url="${frame.url()}"`);
    });

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
