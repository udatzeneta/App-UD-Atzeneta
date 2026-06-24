import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  try {
    // Navegar a la app
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
    
    // Hacer click en "Admin (udatzenetact@gmail.com)" para logearse
    await page.click('button:has-text("Admin")');
    
    // Esperar a que cargue el dashboard
    await page.waitForTimeout(2000);
    
    await page.screenshot({
      path: '/private/tmp/claude-501/-Users-imac-Programas-App-UD-Atzeneta/63b1c275-8625-4a73-94f9-e42c1bb484a2/scratchpad/dashboard-mobile.png',
      fullPage: true
    });
    console.log('Dashboard screenshot saved');
  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
})();
