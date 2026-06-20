const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    const htmlPath = path.join(__dirname, 'matches_tab.html');
    console.log("Reading HTML file:", htmlPath);
    const htmlContent = fs.readFileSync(htmlPath, 'utf8');
    
    console.log("Setting page content with domcontentloaded...");
    await page.setContent(htmlContent, { waitUntil: 'domcontentloaded' });
    console.log("Content set successfully.");

    // Let's inspect the cards
    const cardInfo = await page.evaluate(() => {
      // Find all elements that look like cards or contain matches
      // Looking at the screenshot, cards have "Jornada" and date text, team logos, names, etc.
      // Let's search for elements containing "Jornada 1"
      const allDivs = Array.from(document.querySelectorAll('div'));
      const cardDiv = allDivs.find(d => d.innerText && d.innerText.includes('Jornada 1') && d.innerText.includes('C.D. Cabanes'));
      
      if (!cardDiv) {
        return "Could not find card div containing Jornada 1 and C.D. Cabanes";
      }

      // Walk up to find a container class or grid item
      let current = cardDiv;
      let depth = 0;
      while (current && current.parentElement && depth < 4) {
        const className = (current.className || '').toLowerCase();
        if (className.includes('partido') || className.includes('card') || className.includes('row')) {
          break;
        }
        current = current.parentElement;
        depth++;
      }

      // Let's also print some info about the parent structure
      return {
        tag: current.tagName,
        className: current.className,
        outerHTML: current.outerHTML.substring(0, 3000), // print first 3000 chars of HTML
        text: current.innerText
      };
    });

    console.log("Card HTML Structure:\n", JSON.stringify(cardInfo, null, 2));

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await browser.close();
  }
})();
