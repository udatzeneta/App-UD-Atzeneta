const fs = require('fs');
let content = fs.readFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', 'utf8');

// The rendering replacement needs to be robust.
// We will find `const content = (` and everything after it up to `return createPortal(content, document.body);`
// and replace it completely with the new conditional layout!

const contentStartIdx = content.indexOf('const content = (');
const contentEndIdx = content.lastIndexOf('return createPortal(content, document.body);');

if (contentStartIdx === -1 || contentEndIdx === -1) {
  console.error('Could not find content blocks!');
  process.exit(1);
}

const beforeContent = content.substring(0, contentStartIdx);
const afterContent = content.substring(contentEndIdx);

const newContent = `const clipToEdit = draftClip || editingClip;

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
        <>
          {/* Cabecera */}
          <div className="flex items-center justify-between px-4 sm:px-6 py-3 border-b border-brand-black-border bg-brand-black shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <Film className="w-5 h-5 text-brand-red-600 shrink-0" />
              <input
                type="text"
                value={video.title}
                onChange={e => onChange({ ...video, title: e.target.value })}
                disabled={readOnly}
                className="bg-transparent text-base sm:text-lg font-bold text-white outline-none truncate min-w-0 disabled:opacity-100"
                placeholder="Título del vídeo"
              />
            </div>
            <button onClick={onClose} className="flex items-center gap-2 px-4 py-2 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white border border-brand-red-600/30 rounded-lg transition-colors shrink-0 font-bold uppercase text-xs tracking-wide shadow-lg">
              <X className="w-5 h-5" /> Cerrar
            </button>
          </div>

          <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-hidden">
            {/* Columna Reproductor */}
            <div className="flex-1 min-h-0 flex flex-col p-4 sm:p-6 gap-4 overflow-y-auto">
              <div ref={wrapperRef} className="w-full aspect-video bg-black rounded-xl overflow-hidden border border-brand-black-border shadow-2xl relative">
                {video.clippable ? (
                  <>
                    {(() => {
                      const provider = detectVideoProvider(validUrl).provider;
                      const Player: any = provider === 'youtube' ? YouTubePlayer : ReactPlayer;
                      return (
                        <Player 
                          ref={playerRef} 
                          url={validUrl} 
                          width="100%" 
                          height="100%" 
                          controls 
                          playing={playing}
                          onPlay={() => setPlaying(true)}
                          onPause={() => setPlaying(false)}
                          onProgress={(state: any) => {
                            const t = state.playedSeconds;
                            // Auto-pause logic
                            const clipToPause = video.clips.find(c => {
                              const ft = c.freezeTime ?? c.start;
                              return c.annotations && c.annotations.length > 0 &&
                                     t >= ft && t < ft + 0.3;
                            });

                            if (clipToPause && !hasAutoPausedRef.current.has(clipToPause.id)) {
                              hasAutoPausedRef.current.add(clipToPause.id);
                              setPlaying(false);
                              if (playerRef.current) {
                                const target = clipToPause.freezeTime ?? clipToPause.start;
                                if (typeof playerRef.current.seekTo === 'function') {
                                  playerRef.current.seekTo(target, 'seconds');
                                } else {
                                  try { playerRef.current.currentTime = target; } catch { /* noop */ }
                                }
                              }
                              setActiveOverlayClip(clipToPause);

                              setTimeout(() => {
                                setActiveOverlayClip(null);
                                setPlaying(true);
                              }, (clipToPause.pauseDuration || 3) * 1000);
                            }

                            // Reset auto-pause if user seeks way back before the clip
                            if (hasAutoPausedRef.current.size > 0) {
                              video.clips.forEach(c => {
                                const ft = c.freezeTime ?? c.start;
                                if (t < ft - 1) {
                                  hasAutoPausedRef.current.delete(c.id);
                                }
                              });
                            }
                          }}
                        />
                      );
                    })()}
                    {activeOverlayClip && (
                      <ClipAnnotationRenderer
                        annotations={activeOverlayClip.annotations || []}
                        cw={dims.cw}
                        ch={dims.ch}
                        videoUrl={validUrl}
                        freezeTime={activeOverlayClip.freezeTime ?? activeOverlayClip.start}
                      />
                    )}
                  </>
                ) : (
                  <iframe
                    src={validUrl}
                    className="w-full h-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                    allowFullScreen
                    title={video.title}
                  />
                )}
              </div>

              {!video.clippable && (
                <div className="flex items-start gap-2 bg-amber-950/30 border border-amber-500/30 rounded-lg p-3 text-xs text-amber-400">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                  <div className="flex-1">
                    Este proveedor se muestra embebido y <b>no permite crear cortes</b>. Para recortar clips, añade el
                    enlace de vídeo directo (MP4/M3U8), YouTube o Vimeo.
                    <a href={validUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 mt-1.5 text-amber-300 hover:text-white font-semibold">
                      <ExternalLink className="w-3 h-3" /> Abrir en pestaña nueva
                    </a>
                  </div>
                </div>
              )}

              {video.clippable && !readOnly && (
                <div className="flex items-center gap-2">
                  <button type="button" onClick={addClip} className="btn-primary py-2.5 px-5 text-sm flex items-center gap-2">
                    <Plus className="w-4 h-4" /> Nuevo Corte
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsFastClipping(true)}
                    className="flex items-center gap-1.5 bg-brand-red-600/10 text-sm font-semibold text-brand-red-500 hover:bg-brand-red-600 hover:text-white px-4 py-2.5 rounded-lg transition-colors"
                  >
                    <Zap className="w-4 h-4" /> Extracción Rápida
                  </button>
                </div>
              )}
            </div>

            {/* Columna Clips */}
            {video.clippable && (
              <div className="w-full lg:w-[420px] shrink-0 border-t lg:border-t-0 lg:border-l border-brand-black-border bg-brand-black flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-brand-black-border flex items-center justify-between shrink-0">
                  <h3 className="text-sm font-bold text-white flex items-center gap-2 uppercase tracking-wider">
                    <Scissors className="w-4 h-4 text-brand-red-600" /> Cortes ({video.clips.length})
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto no-scrollbar p-4 space-y-3">
                  {video.clips.length === 0 ? (
                    <div className="text-center text-brand-gray-dark py-12 flex flex-col items-center justify-center gap-3">
                      <Scissors className="w-12 h-12 text-brand-gray-dark/50" />
                      <p className="text-sm">Aún no hay cortes.<br/>Crea uno con "Nuevo Corte".</p>
                    </div>
                  ) : (
                    (() => {
                      const grouped = video.clips.reduce((acc, clip) => {
                        const c = clip.category || 'none';
                        if (!acc[c]) acc[c] = [];
                        acc[c].push(clip);
                        return acc;
                      }, {} as Record<string, OpponentVideoClip[]>);

                      return Object.entries(grouped).map(([cat, clipsInCat]) => (
                        <div key={cat} className="space-y-2">
                          {cat !== 'none' && (
                            <h4 className="text-xs font-black uppercase text-brand-gray-light px-2 border-l-2 border-brand-red-600 mb-3 mt-4">
                              {catLabel(cat)}
                            </h4>
                          )}
                          {clipsInCat.map(clip => (
                            <div key={clip.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-3 shadow-md group hover:border-brand-red-600/50 transition-colors">
                              <div className="flex justify-between items-start gap-2 mb-2">
                                <div className="min-w-0 flex-1">
                                  {readOnly ? (
                                    <h4 className="text-sm font-bold text-white truncate">{clip.title}</h4>
                                  ) : (
                                    <input
                                      type="text"
                                      value={clip.title}
                                      onChange={e => updateClip(clip.id, { title: e.target.value })}
                                      className="w-full bg-transparent text-sm font-bold text-white outline-none placeholder:text-brand-gray-dark border-b border-transparent focus:border-brand-red-600/50 transition-colors"
                                      placeholder="Título del clip"
                                    />
                                  )}
                                  <div className="flex items-center gap-3 text-[11px] text-brand-gray-muted mt-1 font-mono">
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(clip.start)}</span>
                                    <span>→</span>
                                    <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {formatTime(clip.end)}</span>
                                    <span className="text-brand-gray-dark">•</span>
                                    <span className="text-brand-red-400 font-semibold">{formatTime(clip.end - clip.start)}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <button
                                    type="button"
                                    onClick={() => handlePlayClip(clip)}
                                    className="p-1.5 bg-brand-red-600/10 text-brand-red-500 hover:bg-brand-red-600 hover:text-white rounded transition-colors"
                                    title="Reproducir este corte"
                                  >
                                    <Play className="w-4 h-4 fill-current" />
                                  </button>
                                  {!readOnly && (
                                    <>
                                      <button
                                        type="button"
                                        onClick={() => setEditingClipId(clip.id)}
                                        className="p-1.5 text-brand-gray-muted hover:text-brand-red-500 hover:bg-brand-red-600/10 rounded transition-colors"
                                        title="Dibujar en el corte"
                                      >
                                        <Wand2 className="w-4 h-4" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => removeClip(clip.id)}
                                        className="p-1.5 text-brand-gray-muted hover:text-red-500 hover:bg-red-500/10 rounded transition-colors"
                                        title="Eliminar corte"
                                      >
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Catalogación */}
                              {readOnly ? (
                                <span className="inline-block text-[10px] bg-brand-red-600/10 text-brand-red-500 border border-brand-red-600/20 px-2 py-0.5 rounded-full font-semibold">
                                  {catLabel(clip.category)}
                                </span>
                              ) : (
                                <ClipCategorySelector value={clip.category} onChange={cat => updateClip(clip.id, { category: cat })} />
                              )}
                            </div>
                          ))}
                        </div>
                      ));
                    })()
                  )}
                </div>

                {/* Botón salir inferior */}
                <div className="p-4 border-t border-brand-black-border bg-brand-black">
                  <button onClick={onClose} className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-brand-black-card text-brand-gray-light hover:text-white hover:bg-brand-red-600 border border-brand-black-border hover:border-brand-red-600 rounded-xl transition-all font-bold uppercase text-sm tracking-wide shadow-lg group">
                    <X className="w-5 h-5 text-brand-gray-muted group-hover:text-white" /> Salir del Vídeo
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Extracción rápida */}
      {isFastClipping && (
        <FastClipperModal videoUrl={validUrl} onAddClip={handleFastAddClip} onClose={() => setIsFastClipping(false)} />
      )}
    </div>
  );

  `;

fs.writeFileSync('src/components/opponent_analysis/LibraryVideoStudio.tsx', beforeContent + newContent + afterContent);
