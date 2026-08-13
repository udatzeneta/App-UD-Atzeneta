const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  try {
    console.log("Navegando a FFCV Competiciones...");
    await page.goto('https://ffcv.es/competiciones/', { waitUntil: 'load', timeout: 60000 });
    
    // Aceptar cookies si aparecen
    const selectors = ['button:has-text("Aceptar")', 'button:has-text("ACEPTAR")', '.cc-btn.cc-allow'];
    for (const sel of selectors) {
      try { await page.locator(sel).first().click({ timeout: 2000 }); } catch(e) {}
    }

    console.log("Seleccionando temporada 2026-2027 (22)...");
    await page.waitForSelector('#sel-temporada');
    await page.selectOption('#sel-temporada', '22');
    await page.waitForTimeout(2000);

    // Obtener las categorías
    const categorias = await page.evaluate(() => {
      const sel = document.getElementById('sel-cat-grupo');
      if (!sel) return [];
      return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value);
    });

    console.log(`Encontradas ${categorias.length} categorías.`);

    for (const cat of categorias) {
      console.log(`\nSeleccionando categoría: ${cat.text} (${cat.value})`);
      await page.selectOption('#sel-cat-grupo', cat.value);
      await page.waitForTimeout(2000);

      const comps = await page.evaluate(() => {
        const sel = document.getElementById('sel-competicion');
        if (!sel) return [];
        return Array.from(sel.options).map(o => ({ value: o.value, text: o.text.trim() })).filter(o => o.value);
      });

      for (const comp of comps) {
        console.log(`  - [${comp.value}] ${comp.text}`);
      }
    }

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
