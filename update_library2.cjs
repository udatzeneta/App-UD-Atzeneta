const fs = require('fs');
let content = fs.readFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', 'utf8');

content = content.replace(
  "import { ClipAnnotationRenderer } from './ClipAnnotationRenderer';",
  "import { YouTubePlayer } from './YouTubePlayer';\nimport { ClipAnnotationRenderer } from './ClipAnnotationRenderer';"
);

content = content.replace(
  /const Player: any = ReactPlayer;/,
  "const provider = detectVideoProvider(validUrl).provider;\n                  const Player: any = provider === 'youtube' ? YouTubePlayer : ReactPlayer;"
);

fs.writeFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', content);
