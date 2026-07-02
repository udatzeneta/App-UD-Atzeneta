import re

file_path = "/Users/imac/Programas/App UD Atzeneta/src/pages/Players.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pattern = re.compile(r"\) : viewMode === 'pitch' \? \([\s\S]*?\) : viewMode === 'grid' \? \(")
match = pattern.search(content)

if not match:
    print("Could not find the pitch view block")
    exit(1)

pitch_logic_new = """          ) : viewMode === 'pitch' ? (
            <div className="w-full bg-[#469A33] rounded-2xl border-4 border-[#2D6A1F] p-4 sm:p-6 md:p-8 relative min-h-[800px] md:min-h-0 md:h-[750px] shadow-2xl overflow-hidden" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(0,0,0,0.06) 50px, rgba(0,0,0,0.06) 100px)' }}>
              
              <style>{`
                .pitch-group {
                  position: absolute;
                  left: var(--x);
                  top: var(--y);
                  transform: translate(-50%, -50%);
                  display: flex;
                  flex-direction: row;
                  flex-wrap: wrap;
                  justify-content: center;
                  align-items: center;
                  width: 150px;
                  gap: 4px;
                  z-index: 10;
                }
                /* MOBILE (Vertical, Atacando hacia arriba) */
                .pos-GK    { --x: 50%; --y: 92%; }
                .pos-DEF_L { --x: 18%; --y: 78%; }
                .pos-DEF_C { --x: 50%; --y: 78%; }
                .pos-DEF_R { --x: 82%; --y: 78%; }
                .pos-MID_C { --x: 50%; --y: 58%; }
                .pos-EXT_L { --x: 18%; --y: 36%; }
                .pos-EXT_R { --x: 82%; --y: 36%; }
                .pos-FWD_C { --x: 50%; --y: 15%; }

                /* ESCRITORIO (Horizontal, Atacando hacia la derecha) */
                @media (min-width: 768px) {
                  .pitch-group {
                     width: 140px;
                     gap: 6px;
                  }
                  .pos-GK    { --x: 8%;  --y: 50%; }
                  .pos-DEF_L { --x: 22%; --y: 18%; }
                  .pos-DEF_C { --x: 22%; --y: 50%; }
                  .pos-DEF_R { --x: 22%; --y: 82%; }
                  .pos-MID_C { --x: 42%; --y: 50%; }
                  .pos-EXT_L { --x: 65%; --y: 18%; }
                  .pos-EXT_R { --x: 65%; --y: 82%; }
                  .pos-FWD_C { --x: 82%; --y: 50%; }
                }
              `}</style>

              {/* === DIBUJO DEL CAMPO (LÍNEAS) === */}
              <div className="absolute inset-4 md:inset-8 border-2 border-white/60 pointer-events-none z-0">
                 {/* Línea Central */}
                 <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-white/60 md:top-0 md:bottom-0 md:left-1/2 md:right-auto md:w-[2px] md:h-full -translate-y-1/2 md:translate-y-0 md:-translate-x-1/2" />
                 
                 {/* Círculo Central */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-40 md:h-40 rounded-full border-2 border-white/60" />
                 {/* Punto Central */}
                 <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/90" />

                 {/* --- MÓVIL (Campo Vertical) --- */}
                 <div className="md:hidden">
                   {/* Área Grande Arriba */}
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-28 border-2 border-t-0 border-white/60" />
                   {/* Área Pequeña Arriba */}
                   <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-10 border-2 border-t-0 border-white/60" />
                   {/* Punto Penalti Arriba */}
                   <div className="absolute top-20 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/90" />
                   {/* Semicírculo Arriba */}
                   <div className="absolute top-28 left-1/2 -translate-x-1/2 w-20 h-10 border-b-2 border-white/60 rounded-b-full" />

                   {/* Área Grande Abajo */}
                   <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-56 h-28 border-2 border-b-0 border-white/60" />
                   {/* Área Pequeña Abajo */}
                   <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-24 h-10 border-2 border-b-0 border-white/60" />
                   {/* Punto Penalti Abajo */}
                   <div className="absolute bottom-20 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full bg-white/90" />
                   {/* Semicírculo Abajo */}
                   <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-20 h-10 border-t-2 border-white/60 rounded-t-full" />
                 </div>

                 {/* --- ESCRITORIO (Campo Horizontal) --- */}
                 <div className="hidden md:block">
                   {/* Área Grande Izquierda */}
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 w-32 h-72 border-2 border-l-0 border-white/60" />
                   {/* Área Pequeña Izquierda */}
                   <div className="absolute left-0 top-1/2 -translate-y-1/2 w-12 h-32 border-2 border-l-0 border-white/60" />
                   {/* Punto Penalti Izquierda */}
                   <div className="absolute left-24 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/90" />
                   {/* Semicírculo Izquierda */}
                   <div className="absolute left-32 top-1/2 -translate-y-1/2 w-12 h-24 border-r-2 border-white/60 rounded-r-full" />

                   {/* Área Grande Derecha */}
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-32 h-72 border-2 border-r-0 border-white/60" />
                   {/* Área Pequeña Derecha */}
                   <div className="absolute right-0 top-1/2 -translate-y-1/2 w-12 h-32 border-2 border-r-0 border-white/60" />
                   {/* Punto Penalti Derecha */}
                   <div className="absolute right-24 top-1/2 -translate-y-1/2 w-1.5 h-1.5 rounded-full bg-white/90" />
                   {/* Semicírculo Derecha */}
                   <div className="absolute right-32 top-1/2 -translate-y-1/2 w-12 h-24 border-l-2 border-white/60 rounded-l-full" />
                 </div>
              </div>

              {/* === JUGADORES === */}
              {(() => {
                const getPlayerGroup = (pos: string) => {
                  if (!pos) return 'MID_C';
                  const p = pos.toLowerCase();
                  
                  if (p.includes('portero')) return 'GK';
                  
                  if (p.includes('lateral izquierd') || p.match(/\\b(li)\\b/)) return 'DEF_L';
                  if (p.includes('lateral derech') || p.match(/\\b(ld)\\b/)) return 'DEF_R';
                  if (p.includes('defensa') || p.includes('central') || p.match(/\\b(dfc)\\b/)) return 'DEF_C';
                  
                  if (p.includes('extremo izquierd') || p.match(/\\b(ei)\\b/)) return 'EXT_L';
                  if (p.includes('extremo derech') || p.match(/\\b(ed)\\b/)) return 'EXT_R';
                  
                  if (p.includes('delantero') || p.match(/\\b(dc)\\b/)) return 'FWD_C';
                  
                  // Pivote Defensivo, Mediocentro, Interior, Mediapunta
                  return 'MID_C';
                };

                const renderPlayerCard = (player: any) => {
                  const isSelected = selectedPlayer?.id === player.id;
                  const statusColor = player.physical_status === 'Disponible' ? 'bg-emerald-500' :
                                      player.physical_status === 'En duda' ? 'bg-amber-500' : 'bg-red-500';

                  return (
                    <div 
                      key={player.id} 
                      onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }}
                      className={`flex flex-col items-center justify-center cursor-pointer group hover:scale-110 transition-transform w-[55px] md:w-[65px] ${isSelected ? 'scale-110 ring-4 ring-brand-red-600 rounded-lg p-1 bg-black/20' : ''}`}
                      title={`${player.nickname || player.full_name} - ${player.position}`}
                    >
                      <div className="relative flex flex-col items-center drop-shadow-xl group-hover:drop-shadow-2xl transition-all">
                        <div className="w-12 h-12 md:w-14 md:h-14 relative">
                          <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M15.5 2C15.5 2 14 3.5 12 3.5C10 3.5 8.5 2 8.5 2L3 5.5L2 10L6.5 11.5V22H17.5V11.5L22 10L21 5.5L15.5 2Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" strokeLinejoin="round"/>
                            <path d="M8.5 2C8.5 2 10 3.5 12 3.5C14 3.5 15.5 2 15.5 2" stroke="#171717" strokeWidth="1.5" strokeLinecap="round"/>
                            <path d="M3 5.5L6.5 11.5M21 5.5L17.5 11.5" stroke="#7f1d1d" strokeWidth="1"/>
                          </svg>
                          {player.dorsal && (
                            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-xs md:text-sm pt-2 drop-shadow-md">
                              {player.dorsal}
                            </span>
                          )}
                        </div>
                        <div className={`absolute top-0 -right-1 w-3 h-3 rounded-full border-2 border-white shadow-md ${statusColor}`} title={player.physical_status} />
                      </div>
                      <div className="mt-1 bg-black/70 border border-white/10 px-1.5 py-0.5 rounded text-[9px] font-bold text-white w-full truncate text-center backdrop-blur-sm shadow-md">
                        {player.nickname || player.full_name.split(' ')[0]}
                      </div>
                    </div>
                  );
                };

                const positions = ['GK', 'DEF_L', 'DEF_C', 'DEF_R', 'MID_C', 'EXT_L', 'EXT_R', 'FWD_C'];

                return positions.map((posId) => {
                  const playersInPos = filteredPlayers.filter(p => getPlayerGroup(p.position) === posId);
                  if (playersInPos.length === 0) return null;
                  
                  return (
                    <div key={posId} className={`pitch-group pos-${posId}`}>
                      {playersInPos.map(renderPlayerCard)}
                    </div>
                  );
                });
              })()}
            </div>
          ) : viewMode === 'grid' ? ("""

new_content = content.replace(match.group(0), pitch_logic_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Pitch absolute positioning applied successfully!")
