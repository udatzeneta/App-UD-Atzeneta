const fs = require('fs');
let content = fs.readFileSync('src/components/opponent_analysis/FastClipperModal.tsx', 'utf8');

content = content.replace(
  /const handleFastClip = \(\) => {[\s\S]*?let currentTime = 0;\n    if \(playerRef\.current\) {\n      if \(typeof playerRef\.current\.getCurrentTime === 'function'\) {\n        currentTime = playerRef\.current\.getCurrentTime\(\);\n      } else {\n        currentTime = playerRef\.current\.currentTime \|\| 0;\n      }\n    }/m,
  `const handleFastClip = async () => {
    if (!playerRef.current) return;
    let currentTime = 0;
    if (playerRef.current) {
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const val = playerRef.current.getCurrentTime();
        currentTime = val instanceof Promise ? await val : val;
      } else {
        currentTime = playerRef.current.currentTime || 0;
      }
    }`
);

fs.writeFileSync('src/components/opponent_analysis/FastClipperModal.tsx', content);

let content2 = fs.readFileSync('src/components/opponent_analysis/OpponentVideoClipper.tsx', 'utf8');
content2 = content2.replace(
  /const addClip = \(\) => {[\s\S]*?const currentTime = playerRef\.current\?\.currentTime \|\| playerRef\.current\?\.getCurrentTime\?\.\(\) \|\| 0;/m,
  `const addClip = async () => {
    let currentTime = 0;
    if (playerRef.current) {
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const val = playerRef.current.getCurrentTime();
        currentTime = val instanceof Promise ? await val : val;
      } else {
        currentTime = playerRef.current.currentTime || 0;
      }
    }`
);
fs.writeFileSync('src/components/opponent_analysis/OpponentVideoClipper.tsx', content2);
