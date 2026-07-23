const fs = require('fs');
let content = fs.readFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', 'utf8');

content = content.replace(
  "import { getValidUrl, formatTime } from '../../utils/opponentVideo';",
  "import { getValidUrl, formatTime, detectVideoProvider } from '../../utils/opponentVideo';"
);

content = content.replace(
  /const addClip = \(\) => {[\s\S]*?const newClip: OpponentVideoClip = {/m,
  `const addClip = async () => {
    let t = 0;
    if (playerRef.current) {
      if (typeof playerRef.current.getCurrentTime === 'function') {
        const val = playerRef.current.getCurrentTime();
        t = Math.floor((val instanceof Promise ? await val : val) || 0);
      } else {
        t = Math.floor(playerRef.current.currentTime || 0);
      }
    }
    const newClip: OpponentVideoClip = {`
);

content = content.replace(
  /const handlePlayClip = \(clip: OpponentVideoClip\) => {[\s\S]*?if \(current >= clip\.end \|\| current < clip\.start\) {/m,
  `const handlePlayClip = async (clip: OpponentVideoClip) => {
    setEditingClipId(null);
    const player = playerRef.current;
    if (player) {
      let current = 0;
      if (typeof player.getCurrentTime === 'function') {
        const val = player.getCurrentTime();
        current = val instanceof Promise ? await val : val;
      } else {
        current = player.currentTime || 0;
      }

      // Si el video está más allá del clip, lo volvemos al inicio. 
      // Si está dentro, dejamos que siga reproduciendo desde donde está.
      if (current >= clip.end || current < clip.start) {`
);

fs.writeFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', content);
