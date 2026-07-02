import re

file_path = "/Users/imac/Programas/App UD Atzeneta/src/pages/Players.tsx"

with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

pitch_logic_old = """          ) : viewMode === 'pitch' ? (
            <div className="w-full bg-[#1b4332] rounded-2xl border-4 border-[#081c15] p-2 sm:p-4 md:p-8 relative min-h-[700px] shadow-2xl overflow-hidden flex flex-col md:flex-row gap-2 md:gap-4" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 80px), repeating-linear-gradient(90deg, transparent, transparent 40px, rgba(255,255,255,0.03) 40px, rgba(255,255,255,0.03) 80px)' }}>
              
              {/* Field Markings - More solid white lines */}
              {/* Center Line */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/40 -translate-y-1/2 md:top-0 md:bottom-0 md:left-1/2 md:right-auto md:w-1 md:h-full md:-translate-x-1/2" />
              {/* Center Circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white/40" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/60" />
              
              {/* Penalty Areas */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-32 md:h-auto md:w-48 md:top-1/2 md:-translate-y-1/2 md:left-0 border-t-4 md:border-t-0 md:border-r-4 md:border-y-4 border-white/40 w-56" />
              <div className="absolute left-1/2 -translate-x-1/2 top-0 h-32 md:h-auto md:w-48 md:top-1/2 md:-translate-y-1/2 md:right-0 border-b-4 md:border-b-0 md:border-l-4 md:border-y-4 border-white/40 w-56" />

              {/* Goal Areas */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-12 md:h-auto md:w-16 md:top-1/2 md:-translate-y-1/2 md:left-0 border-t-4 md:border-t-0 md:border-r-4 md:border-y-4 border-white/40 w-24" />
              <div className="absolute left-1/2 -translate-x-1/2 top-0 h-12 md:h-auto md:w-16 md:top-1/2 md:-translate-y-1/2 md:right-0 border-b-4 md:border-b-0 md:border-l-4 md:border-y-4 border-white/40 w-24" />

              {/* Player Zones */}
              {['GK', 'DEF', 'MID', 'FWD'].map((posCode) => {
                const getPositionCategory = (pos: string) => {
                  if (!pos) return 'MID';
                  const p = pos.toLowerCase();
                  if (p.includes('portero')) return 'GK';
                  if (p.includes('defensa') || p.includes('lateral')) return 'DEF';
                  if (p.includes('pivote') || p.includes('medio') || p.includes('interior') || p.includes('extremo')) return 'MID';
                  if (p.includes('delantero')) return 'FWD';
                  return 'MID';
                };
                
                // For proper positioning: GK is at the bottom in mobile (flex-col-reverse) and left in desktop (flex-row)
                // Wait, if it's flex-col, FWD is at the top, MID, DEF, GK at bottom.
                // If it's md:flex-row, GK is left, DEF, MID, FWD right.
                // Let's ensure the map order works with flex-col-reverse (mobile) and flex-row (desktop)
                const playersInPos = filteredPlayers.filter(p => getPositionCategory(p.position) === posCode);
                
                return (
                  <div key={posCode} className={`flex-1 flex flex-wrap justify-center items-center content-center gap-2 sm:gap-4 relative z-10 py-4 w-full ${posCode === 'GK' ? 'order-4 md:order-1' : posCode === 'DEF' ? 'order-3 md:order-2' : posCode === 'MID' ? 'order-2 md:order-3' : 'order-1 md:order-4'}`}>
                    {playersInPos.map(player => {
                      const isSelected = selectedPlayer?.id === player.id;
                      const statusColor = 
                        player.physical_status === 'Disponible' ? 'bg-emerald-500' :
                        player.physical_status === 'En duda' ? 'bg-amber-500' :
                        'bg-red-500';

                      return (
                        <div 
                          key={player.id} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayer(player);
                          }}
                          className={`flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform w-[60px] md:w-[70px] ${isSelected ? 'scale-110 ring-4 ring-brand-red-600 rounded-full' : ''}`}
                          title={`${player.nickname || player.full_name} - ${player.position}`}
                        >
                          <div className="relative">
                            {player.photo_url ? (
                              <img src={player.photo_url} className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-white bg-slate-800 shadow-xl" alt={player.full_name} />
                            ) : (
                              <div className="w-12 h-12 md:w-14 md:h-14 rounded-full bg-brand-black flex items-center justify-center text-lg font-black text-white border-2 border-white shadow-xl">
                                {player.dorsal || '?'}
                              </div>
                            )}
                            <div className={`absolute -bottom-1 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-white shadow-md ${statusColor}`} title={player.physical_status} />
                          </div>
                          <div className="mt-1.5 bg-black/70 px-1.5 py-0.5 rounded text-[9px] md:text-[10px] font-bold text-white w-full truncate text-center backdrop-blur-sm shadow-md">
                            {player.nickname || player.full_name.split(' ')[0]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>"""

pitch_logic_new = """          ) : viewMode === 'pitch' ? (
            <div className="w-full bg-[#469A33] rounded-2xl border-4 border-[#2D6A1F] p-2 sm:p-4 md:p-8 relative min-h-[700px] shadow-2xl overflow-hidden flex flex-col md:flex-row gap-2 md:gap-4" style={{ backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 50px, rgba(0,0,0,0.06) 50px, rgba(0,0,0,0.06) 100px)' }}>
              
              {/* Field Markings - More solid white lines */}
              {/* Center Line */}
              <div className="absolute top-1/2 left-0 right-0 h-1 bg-white/70 -translate-y-1/2 md:top-0 md:bottom-0 md:left-1/2 md:right-auto md:w-1 md:h-full md:-translate-x-1/2" />
              {/* Center Circle */}
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 md:w-48 md:h-48 rounded-full border-4 border-white/70" />
              <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-white/90" />
              
              {/* Penalty Areas */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-32 md:h-auto md:w-48 md:top-1/2 md:-translate-y-1/2 md:left-0 border-t-4 md:border-t-0 md:border-r-4 md:border-y-4 border-white/70 w-56" />
              <div className="absolute left-1/2 -translate-x-1/2 top-0 h-32 md:h-auto md:w-48 md:top-1/2 md:-translate-y-1/2 md:right-0 border-b-4 md:border-b-0 md:border-l-4 md:border-y-4 border-white/70 w-56" />

              {/* Goal Areas */}
              <div className="absolute left-1/2 -translate-x-1/2 bottom-0 h-12 md:h-auto md:w-16 md:top-1/2 md:-translate-y-1/2 md:left-0 border-t-4 md:border-t-0 md:border-r-4 md:border-y-4 border-white/70 w-24" />
              <div className="absolute left-1/2 -translate-x-1/2 top-0 h-12 md:h-auto md:w-16 md:top-1/2 md:-translate-y-1/2 md:right-0 border-b-4 md:border-b-0 md:border-l-4 md:border-y-4 border-white/70 w-24" />

              {/* Player Zones */}
              {['GK', 'DEF', 'MID', 'FWD'].map((posCode) => {
                const getPositionCategory = (pos: string) => {
                  if (!pos) return 'MID';
                  const p = pos.toLowerCase();
                  if (p.includes('portero')) return 'GK';
                  if (p.includes('defensa') || p.includes('lateral')) return 'DEF';
                  if (p.includes('pivote') || p.includes('medio') || p.includes('interior') || p.includes('extremo')) return 'MID';
                  if (p.includes('delantero')) return 'FWD';
                  return 'MID';
                };
                
                const playersInPos = filteredPlayers.filter(p => getPositionCategory(p.position) === posCode);
                
                return (
                  <div key={posCode} className={`flex-1 flex flex-wrap justify-center items-center content-center gap-4 sm:gap-6 relative z-10 py-4 w-full ${posCode === 'GK' ? 'order-4 md:order-1' : posCode === 'DEF' ? 'order-3 md:order-2' : posCode === 'MID' ? 'order-2 md:order-3' : 'order-1 md:order-4'}`}>
                    {playersInPos.map(player => {
                      const isSelected = selectedPlayer?.id === player.id;
                      const statusColor = 
                        player.physical_status === 'Disponible' ? 'bg-emerald-500' :
                        player.physical_status === 'En duda' ? 'bg-amber-500' :
                        'bg-red-500';

                      return (
                        <div 
                          key={player.id} 
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedPlayer(player);
                          }}
                          className={`flex flex-col items-center cursor-pointer group hover:scale-110 transition-transform w-[65px] md:w-[75px] ${isSelected ? 'scale-110 ring-4 ring-brand-red-600 rounded-lg p-1' : ''}`}
                          title={`${player.nickname || player.full_name} - ${player.position}`}
                        >
                          <div className="relative flex flex-col items-center drop-shadow-xl group-hover:drop-shadow-2xl transition-all">
                            <div className="w-12 h-12 md:w-16 md:h-16 relative">
                              {/* Camiseta SVG */}
                              <svg width="100%" height="100%" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                {/* Cuerpo principal de la camiseta en rojo y mangas con un ligero gradiente o negro (como en tu imagen) */}
                                <path d="M15.5 2C15.5 2 14 3.5 12 3.5C10 3.5 8.5 2 8.5 2L3 5.5L2 10L6.5 11.5V22H17.5V11.5L22 10L21 5.5L15.5 2Z" fill="#dc2626" stroke="#7f1d1d" strokeWidth="1" strokeLinejoin="round"/>
                                {/* Cuello oscuro */}
                                <path d="M8.5 2C8.5 2 10 3.5 12 3.5C14 3.5 15.5 2 15.5 2" stroke="#171717" strokeWidth="1.5" strokeLinecap="round"/>
                                {/* Mangas oscuras */}
                                <path d="M3 5.5L6.5 11.5M21 5.5L17.5 11.5" stroke="#7f1d1d" strokeWidth="1"/>
                              </svg>
                              
                              {/* Dorsal */}
                              {player.dorsal && (
                                <span className="absolute inset-0 flex items-center justify-center text-white font-black text-sm md:text-base pt-2 drop-shadow-md">
                                  {player.dorsal}
                                </span>
                              )}
                            </div>
                            
                            {/* Punto de estado físico */}
                            <div className={`absolute top-0 -right-1 w-3 h-3 md:w-3.5 md:h-3.5 rounded-full border-2 border-white shadow-md ${statusColor}`} title={player.physical_status} />
                          </div>
                          
                          <div className="mt-1 bg-black/60 border border-white/10 px-1.5 py-0.5 rounded text-[10px] md:text-xs font-bold text-white w-full truncate text-center backdrop-blur-sm shadow-md">
                            {player.nickname || player.full_name.split(' ')[0]}
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>"""

if pitch_logic_old in content:
    content = content.replace(pitch_logic_old, pitch_logic_new)
    with open(file_path, "w", encoding="utf-8") as f:
        f.write(content)
    print("UD Atzeneta players pitch logic updated with jerseys.")
else:
    print("Could not find the target block to replace.")

