const fs = require('fs');
let content = fs.readFileSync('src/components/opponent_analysis/PresentationPlayer.tsx', 'utf8');

content = content.replace(
  /const getCurrentTime = \(\): number => {[\s\S]*?return player\.currentTime \|\| start;\n      };/m,
  `const getCurrentTime = async (): Promise<number> => {
        if (typeof player.getCurrentTime === 'function') {
          const val = player.getCurrentTime();
          return (val instanceof Promise ? await val : val) || start;
        }
        return player.currentTime || start;
      };`
);

content = content.replace(
  /const current = getCurrentTime\(\);/g,
  "const current = await getCurrentTime();"
);

content = content.replace(
  /const onKey = \(e: KeyboardEvent\) => {/m,
  "const onKey = async (e: KeyboardEvent) => {"
);

fs.writeFileSync('src/components/opponent_analysis/PresentationPlayer.tsx', content);
