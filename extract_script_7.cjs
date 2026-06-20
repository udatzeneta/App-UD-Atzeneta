const fs = require('fs');
const path = require('path');

try {
  const html = fs.readFileSync(path.join(__dirname, 'matches_tab.html'), 'utf8');
  
  const scriptRegex = /<script\b[^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  let count = 0;
  
  while ((match = scriptRegex.exec(html)) !== null) {
    count++;
    if (count === 7) {
      const content = match[1].trim();
      fs.writeFileSync(path.join(__dirname, 'script_7.js'), content);
      console.log("Successfully extracted Script #7 to script_7.js");
      break;
    }
  }

} catch (e) {
  console.error("Error:", e);
}
