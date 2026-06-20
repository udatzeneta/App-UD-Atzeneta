const fs = require('fs');
const path = require('path');

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const htmlPath = path.join(__dirname, 'clicked_match_page.html');
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });

    // Print text on page containing "localidad" or similar
    const result = await page.evaluate(() => {
      const texts = [];
      const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
      let node;
      while ((node = walker.nextNode())) {
        const t = node.nodeValue.trim();
        if (t.toLowerCase().includes('localidad') || t.toLowerCase().includes('campo') || t.toLowerCase().includes('población') || t.toLowerCase().includes('poblacion') || t.toLowerCase().includes('ciudad') || t.toLowerCase().includes('municipio')) {
          texts.push(t);
        }
      }
      return texts;
    });

    console.log("Found text matches in match page:", JSON.stringify(result, null, 2));

  } catch (err) {
    console.error(err);
  } finally {
    await browser.close();
  }
})();
