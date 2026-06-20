const fs = require('fs');
const path = require('path');

try {
  const html = fs.readFileSync(path.join(__dirname, 'matches_tab.html'), 'utf8');
  
  // Search for occurrence of "campo" (case insensitive)
  const matchesCampo = [];
  const lines = html.split('\n');
  lines.forEach((line, idx) => {
    if (line.toLowerCase().includes('campo') || line.toLowerCase().includes('mpal') || line.toLowerCase().includes('municipal') || line.toLowerCase().includes('localidad')) {
      matchesCampo.push({ lineNum: idx + 1, content: line.trim() });
    }
  });

  console.log(`Found ${matchesCampo.length} occurrences:`);
  console.log(JSON.stringify(matchesCampo.slice(0, 15), null, 2));

} catch (e) {
  console.error("Error:", e);
}
