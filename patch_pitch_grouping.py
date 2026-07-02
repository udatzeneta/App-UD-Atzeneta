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
            <div className="w-full bg-[#469A33] rounded-2xl border-4 border-[#2D6A1F] p-4 sm:p-6 md:p-8 relative min-h-[800px] md:min-h-0 md:h-[750px] shadow-2xl overflow-hidden flex flex-col md:flex-row gap-2 md:gap-4" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(0,0,0,0.06) 50px, rgba(0,0,0,0.06) 100px)' }}>
              
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
                const getPlayerZone = (pos: string) => {
                  if (!pos) return { line: 'MID', side: 'center' };
                  const p = pos.toLowerCase();
                  
                  let side = 'center';
                  // Identificar banda
                  if (p.includes('izquierd') || p.match(/\\b(li|ei)\\b/)) side = 'left';
                  else if (p.includes('derech') || p.match(/\\b(ld|ed)\\b/)) side = 'right';

                  if (p.includes('portero')) return { line: 'GK', side: 'center' };
                  if (p.includes('defensa') || p.includes('lateral')) return { line: 'DEF', side };
                  if (p.includes('extremo') || p.includes('delantero')) return { line: 'FWD', side };
                  return { line: 'MID', side };
                };

                const renderPlayerCard = (player: any) => {
                  const isSelected = selectedPlayer?.id === player.id;
                  const statusColor = player.physical_status === 'Disponible' ? 'bg-emerald-500' :
                                      player.physical_status === 'En duda' ? 'bg-amber-500' : 'bg-red-500';

                  return (
                    <div 
                      key={player.id} 
                      onClick={(e) => { e.stopPropagation(); setSelectedPlayer(player); }}
                      className={`flex flex-col items-center justify-center cursor-pointer group hover:scale-110 transition-transform w-[60px] md:w-[70px] m-1 ${isSelected ? 'scale-110 ring-4 ring-brand-red-600 rounded-lg p-1 bg-black/20' : ''}`}
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
                            <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm md:text-base pt-2 drop-shadow-md">
                              {player.dorsal}
                            </span>
                          )}
                        </div>
                        <div className={`absolute top-0 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-white shadow-md ${statusColor}`} title={player.physical_status} />
                      </div>
                      <div className="mt-1 bg-black/70 border border-white/10 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold text-white w-full truncate text-center backdrop-blur-sm shadow-md">
                        {player.nickname || player.full_name.split(' ')[0]}
                      </div>
                    </div>
                  );
                };

                return ['GK', 'DEF', 'MID', 'FWD'].map((lineCode) => {
                  const linePlayers = filteredPlayers.filter(p => getPlayerZone(p.position).line === lineCode);
                  const leftPlayers = linePlayers.filter(p => getPlayerZone(p.position).side === 'left');
                  const centerPlayers = linePlayers.filter(p => getPlayerZone(p.position).side === 'center');
                  const rightPlayers = linePlayers.filter(p => getPlayerZone(p.position).side === 'right');

                  // Responsive Ordering:
                  // Mobile (Vertical): GK bottom, FWD top.
                  // PC (Horizontal): GK left, FWD right.
                  const orderClass = lineCode === 'GK' ? 'order-4 md:order-1' : 
                                     lineCode === 'DEF' ? 'order-3 md:order-2' : 
                                     lineCode === 'MID' ? 'order-2 md:order-3' : 
                                     'order-1 md:order-4';

                  // Using CSS Grid to strictly group and position the sides
                  return (
                    <div key={lineCode} className={`flex-1 w-full h-full relative z-10 ${orderClass}`}>
                      {lineCode === 'GK' ? (
                        <div className="w-full h-full flex justify-center items-center">
                          <div className="flex flex-row md:flex-col flex-wrap justify-center items-center content-center gap-2">
                             {centerPlayers.map(renderPlayerCard)}
                          </div>
                        </div>
                      ) : (
                        <div className="w-full h-full grid grid-cols-3 md:grid-cols-1 md:grid-rows-3">
                          {/* Top / Left */}
                          <div className="flex flex-row md:flex-col flex-wrap justify-center items-center content-center w-full h-full p-1 overflow-visible">
                            {leftPlayers.map(renderPlayerCard)}
                          </div>
                          {/* Center */}
                          <div className="flex flex-row md:flex-col flex-wrap justify-center items-center content-center w-full h-full p-1 overflow-visible">
                            {centerPlayers.map(renderPlayerCard)}
                          </div>
                          {/* Bottom / Right */}
                          <div className="flex flex-row md:flex-col flex-wrap justify-center items-center content-center w-full h-full p-1 overflow-visible">
                            {rightPlayers.map(renderPlayerCard)}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                });
              })()}
            </div>
          ) : viewMode === 'grid' ? ("""

new_content = content.replace(match.group(0), pitch_logic_new)

with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Pitch grouping logic updated!")
