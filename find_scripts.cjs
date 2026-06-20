const fs = require('fs');
const path = require('path');

try {
  const html = fs.readFileSync(path.join(__dirname, 'matches_tab.html'), 'utf8');
  
  // Find all <script> blocks and log their snippet/content
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    count++;
    const content = match[1].trim();
    if (content.length > 0) {
      console.log(`--- Script #${count} (Length: ${content.length}) ---`);
      if (content.includes('partido') || content.includes('jornada') || content.includes('matches') || content.includes('payload') || content.includes('json') || content.includes('window.')) {
        console.log(content.substring(0, 800) + "\n... [TRUNCATED]");
      } else {
        console.log(content.substring(0, 150) + "...");
      }
    }
  }

} catch (e) {
  console.error("Error:", e);
}
