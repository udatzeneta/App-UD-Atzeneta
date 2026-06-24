import { chromium } from 'playwright';

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X) AppleWebKit/605.1.15'
  });

  try {
    await page.goto('http://localhost:5173', { waitUntil: 'networkidle', timeout: 10000 });
    await page.screenshot({
      path: '/private/tmp/claude-501/-Users-imac-Programas-App-UD-Atzeneta/63b1c275-8625-4a73-94f9-e42c1bb484a2/scratchpad/login-mobile.png',
      fullPage: true
    });
    console.log('Login screenshot saved');
  } catch (error) {
    console.error('Error:', error.message);
  }

  await browser.close();
})();
