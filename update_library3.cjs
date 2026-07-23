const fs = require('fs');
let content = fs.readFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', 'utf8');

// 1. Add draftClip state
content = content.replace(
  "const [editingClipId, setEditingClipId] = useState<string | null>(null);",
  "const [editingClipId, setEditingClipId] = useState<string | null>(null);\n  const [draftClip, setDraftClip] = useState<OpponentVideoClip | null>(null);"
);

// 2. Change addClip
content = content.replace(
  /const newClip: OpponentVideoClip = {[\s\S]*?annotations: \[\],\n    };\n    setClips\(\[\.\.\.video\.clips, newClip\]\);\n    setEditingClipId\(newClip\.id\);\n  };/m,
  `const newClip: OpponentVideoClip = {
      id: \`clip-\${Date.now()}-\${Math.random().toString(36).slice(2, 8)}\`,
      title: 'Nuevo Clip',
      start: t,
      end: t + 10,
      freezeTime: t,
      annotations: [],
    };
    setDraftClip(newClip);
  };`
);

// 3. Add handleSaveClip
content = content.replace(
  /const updateClip = \(clipId: string, updates: Partial<OpponentVideoClip>\) => {\n    const updated = { \.\.\.video\.clips\.find\(c => c\.id === clipId\)!, \.\.\.updates };\n    setClips\(video\.clips\.map\(c => \(c\.id === updated\.id \? updated : c\)\)\);\n  };/m,
  `const updateClip = (clipId: string, updates: Partial<OpponentVideoClip>) => {
    const updated = { ...video.clips.find(c => c.id === clipId)!, ...updates };
    setClips(video.clips.map(c => (c.id === updated.id ? updated : c)));
  };

  const handleSaveClip = (clip: OpponentVideoClip) => {
    if (draftClip) {
      setClips([...video.clips, clip]);
      setDraftClip(null);
    } else {
      updateClip(clip.id, clip);
      setEditingClipId(null);
    }
  };`
);

// 4. Update rendering to replace the layout
// We will find `const content = (` and wrap the inner content
const contentStart = 'const content = (\n    <div className="fixed inset-0 z-[100] bg-brand-black/95 flex flex-col font-sans backdrop-blur-xl animate-fade-in">';
const replacement = `const clipToEdit = draftClip || editingClip;

  const content = (
    <div className="fixed inset-0 z-[100] bg-brand-black/95 flex flex-col font-sans backdrop-blur-xl animate-fade-in">
      {clipToEdit ? (
        <ClipAnnotationEditor
          videoUrl={validUrl}
          clip={clipToEdit}
          allClips={video.clips}
          readOnly={readOnly}
          onSave={handleSaveClip}
          onClose={() => { setEditingClipId(null); setDraftClip(null); }}
        />
      ) : (
        <>`;
content = content.replace(contentStart, replacement);

// We need to close the `</>` before the `{/* Extracción rápida */}` section
content = content.replace(
  /\{\/\* Editor de anotaciones \*\/\}\n\s*\{editingClip && \([\s\S]*?\}\n\s*\)\}/m,
  `</>`
);

fs.writeFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', content);
