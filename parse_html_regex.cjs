const fs = require('fs');
const path = require('path');

const htmlPath = '/Users/victorzandal/Proyectos/App-UD-Atzeneta/clicked_match_page.html';
const html = fs.readFileSync(htmlPath, 'utf8');

const startMarker = 'window.__FFCV_BOOTSTRAP_JSON = ';
const startIdx = html.indexOf(startMarker);
if (startIdx !== -1) {
  const jsonStart = startIdx + startMarker.length;
  const rest = html.slice(jsonStart);
  // Find index of '};' followed by a newline or spaces
  const match = rest.match(/([\s\S]*?)\};\r?\n/);
  if (match) {
    const jsonText = match[1] + '}';
    try {
      const data = JSON.parse(jsonText);
      console.log("Success!");
      console.log("Jornada:", data.jornada);
      console.log("Hora:", data.hora);
      console.log("Campo:", data.campo);
    } catch (e) {
      console.log("JSON.parse error:", e.message);
    }
  } else {
    console.log("No match found for end of JSON");
  }
} else {
  console.log("Start marker not found");
}
