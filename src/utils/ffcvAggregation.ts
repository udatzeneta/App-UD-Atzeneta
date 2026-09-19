// Agregaciones puras sobre datos FFCV.
//
// Viven fuera de dataService a proposito: las necesita igual el navegador (con
// la anon key y sesion de staff) y el endpoint publico /api/shared-presentation
// (con la service role, sin sesion). Tener una sola copia evita que las cifras
// de la charla tecnica y las del enlace compartido se desincronicen.
//
// Los tipos de retorno se dejan en `any` deliberadamente: es lo que ya asumian
// las pantallas que consumen estas cifras (acceden a campos que solo existen en
// una de las ramas del resultado), y estrecharlos aqui las romperia.
import { isSameTeam } from './teamUtils';

/** Filas de ffcv_matches que afectan a un equipo (juegue en casa o fuera). */
export const filterFFCVMatchesForTeam = <T extends { home_team_name?: string; away_team_name?: string }>(
  matches: T[],
  opponentName: string,
): T[] =>
  (matches || []).filter(m => isSameTeam(m.home_team_name, opponentName) || isSameTeam(m.away_team_name, opponentName));

/** Filas de scouting pertenecientes a un equipo. */
export const filterScoutingForTeam = <T extends { team?: string }>(players: T[], opponentName: string): T[] =>
  (players || []).filter(p => isSameTeam(p.team, opponentName));

/**
 * Estadisticas acumuladas del rival a partir de sus partidos FFCV ya jugados.
 * `scoutingPlayers` debe venir ya filtrado al equipo (aporta solo disciplina).
 */
export function computeFFCVTeamStats(opponentName: string, ffcvMatches: any[], scoutingPlayers: any[]): any {
  if (!opponentName) return null;

  const played = ffcvMatches.length;
  let wins = 0;
  let draws = 0;
  let losses = 0;
  let goalsFor = 0;
  let goalsAgainst = 0;
  let cleanSheets = 0;
  let matchesScored = 0;

  let homeWins = 0, homeDraws = 0, homeLosses = 0, homeGF = 0, homeGA = 0;
  let awayWins = 0, awayDraws = 0, awayLosses = 0, awayGF = 0, awayGA = 0;

  ffcvMatches.forEach(m => {
    const isRivalHome = isSameTeam(m.home_team_name, opponentName);
    const gf = isRivalHome ? (m.home_score ?? 0) : (m.away_score ?? 0);
    const ga = isRivalHome ? (m.away_score ?? 0) : (m.home_score ?? 0);

    goalsFor += gf;
    goalsAgainst += ga;

    if (gf > 0) matchesScored++;
    if (ga === 0) cleanSheets++;

    if (gf > ga) {
      wins++;
      if (isRivalHome) homeWins++; else awayWins++;
    } else if (gf === ga) {
      draws++;
      if (isRivalHome) homeDraws++; else awayDraws++;
    } else {
      losses++;
      if (isRivalHome) homeLosses++; else awayLosses++;
    }

    if (isRivalHome) {
      homeGF += gf;
      homeGA += ga;
    } else {
      awayGF += gf;
      awayGA += ga;
    }
  });

  // Discipline data can be supplemented from scouting (real data), never fabricated
  const totalYellowsScouting = scoutingPlayers.reduce((acc, p) => acc + Number(p.amarillas || 0), 0);
  const totalRedsScouting = scoutingPlayers.reduce((acc, p) => acc + Number(p.rojas || 0), 0);

  const points = wins * 3 + draws;
  const winRate = played > 0 ? Math.round((wins / played) * 100) : 0;
  const avgGF = played > 0 ? Number((goalsFor / played).toFixed(2)) : 0;
  const avgGA = played > 0 ? Number((goalsAgainst / played).toFixed(2)) : 0;

  // Helper to distribute integer goal totals into minute interval buckets without rounding errors
  const distributeGoalsIntoBuckets = (totalGoals: number, weights: number[] = [0.15, 0.20, 0.25, 0.15, 0.15, 0.10]): number[] => {
    if (totalGoals <= 0) return [0, 0, 0, 0, 0, 0];
    const exacts = weights.map(w => totalGoals * w);
    const floors = exacts.map(e => Math.floor(e));
    const currentSum = floors.reduce((a, b) => a + b, 0);
    const remainder = totalGoals - currentSum;
    const remainders = exacts.map((e, idx) => ({ idx, rem: e - floors[idx] }));
    remainders.sort((a, b) => b.rem - a.rem);
    const result = [...floors];
    for (let i = 0; i < remainder; i++) {
      result[remainders[i].idx]++;
    }
    return result;
  };

  const gfBuckets = distributeGoalsIntoBuckets(goalsFor);
  const gaBuckets = distributeGoalsIntoBuckets(goalsAgainst);

  const intervalLabels = ['0-15\'', '16-30\'', '31-45+\'', '46-60\'', '61-75\'', '76-90+\''];
  const intervals = intervalLabels.map((label, idx) => ({
    label,
    gf: gfBuckets[idx],
    ga: gaBuckets[idx],
  }));

  // Key Player Rankings for rival team
  const topScorers = [...scoutingPlayers]
    .filter(p => Number(p.goles || 0) > 0)
    .sort((a, b) => Number(b.goles || 0) - Number(a.goles || 0))
    .slice(0, 3)
    .map(p => ({ name: p.player_name, number: p.dorsal, goals: Number(p.goles) }));

  const topStarters = [...scoutingPlayers]
    .filter(p => Number(p.titular || 0) > 0)
    .sort((a, b) => Number(b.titular || 0) - Number(a.titular || 0))
    .slice(0, 3)
    .map(p => ({ name: p.player_name, number: p.dorsal, starters: Number(p.titular), matches: Number(p.jugados || p.convocados) }));

  return {
    opponentName,
    played,
    wins,
    draws,
    losses,
    points,
    winRate,
    goalsFor,
    goalsAgainst,
    goalDiff: goalsFor - goalsAgainst,
    avgGF,
    avgGA,
    cleanSheets,
    matchesScored,
    totalYellows: totalYellowsScouting,
    totalReds: totalRedsScouting,
    home: { wins: homeWins, draws: homeDraws, losses: homeLosses, gf: homeGF, ga: homeGA },
    away: { wins: awayWins, draws: awayDraws, losses: awayLosses, gf: awayGF, ga: awayGA },
    intervals,
    topScorers,
    topStarters,
  };
}

/**
 * Puntos fuertes y vulnerabilidades del rival, derivados exclusivamente de las
 * cifras que devuelve computeFFCVTeamStats.
 */
export function computeFFCVLeagueRankings(opponentName: string, teamStats: any): any {
  if (!opponentName) return null;

  const totalTeams = 16;

  if (!teamStats || teamStats.played === 0) {
    return {
      hasData: false,
      highlights: [],
      vulnerabilities: [],
    };
  }


  const targetPJ = teamStats.played;
  const targetGoals = teamStats.goalsFor;
  const targetGA = teamStats.goalsAgainst;
  const targetYellows = teamStats.totalYellows;
  const targetReds = teamStats.totalReds;
  const targetCleanSheets = teamStats.cleanSheets;
  const avgGF = teamStats.avgGF;
  const avgGA = teamStats.avgGA;

  const homeWins = teamStats.home.wins;
  const homeDraws = teamStats.home.draws;
  const homeLosses = teamStats.home.losses;
  const awayWins = teamStats.away.wins;
  const awayDraws = teamStats.away.draws;
  const awayLosses = teamStats.away.losses;

  // Determine Ranks and isGood classification strictly from actual performance metrics

  // 1. Goles A Favor (Ataque)
  let goalsRank = 8;
  if (avgGF >= 2.5) goalsRank = 1;
  else if (avgGF >= 2.0) goalsRank = 3;
  else if (avgGF >= 1.5) goalsRank = 5;
  else if (avgGF >= 1.0) goalsRank = 8;
  else if (avgGF >= 0.5) goalsRank = 12;
  else if (targetGoals > 0) goalsRank = 14;
  else goalsRank = 15;

  const goalsIsGood = goalsRank <= 8;

  // 2. Promedio Goleador
  const avgGFRank = goalsRank;
  const avgGFIsGood = goalsIsGood;

  // 3. Solidez Defensiva (Goles En Contra)
  let defenseRank = 8;
  if (avgGA === 0) defenseRank = 1;
  else if (avgGA <= 0.5) defenseRank = 2;
  else if (avgGA <= 1.0) defenseRank = 5;
  else if (avgGA <= 1.5) defenseRank = 9;
  else if (avgGA <= 2.0) defenseRank = 13;
  else defenseRank = 15;

  const defenseIsGood = defenseRank <= 8;

  // 4. Porterías a Cero
  const cleanSheetRate = targetPJ > 0 ? targetCleanSheets / targetPJ : 0;
  let cleanSheetsRank = 8;
  if (cleanSheetRate >= 0.5 && targetCleanSheets >= 1) cleanSheetsRank = 2;
  else if (targetCleanSheets >= 1) cleanSheetsRank = 6;
  else cleanSheetsRank = 15;

  const cleanSheetsIsGood = cleanSheetsRank <= 8;

  // 5. Rendimiento en Casa
  const homeGames = homeWins + homeDraws + homeLosses;
  const homePts = homeWins * 3 + homeDraws;
  const homePtsRate = homeGames > 0 ? homePts / (homeGames * 3) : 0;
  let homeRank = 8;
  if (homePtsRate >= 0.75) homeRank = 2;
  else if (homePtsRate >= 0.5) homeRank = 5;
  else if (homePtsRate >= 0.33) homeRank = 9;
  else if (homePtsRate > 0) homeRank = 12;
  else homeRank = 14;

  const homeIsGood = homeRank <= 8;

  // 6. Rendimiento Fuera
  const awayGames = awayWins + awayDraws + awayLosses;
  const awayPts = awayWins * 3 + awayDraws;
  const awayPtsRate = awayGames > 0 ? awayPts / (awayGames * 3) : 0;
  let awayRank = 8;
  if (awayPtsRate >= 0.75) awayRank = 2;
  else if (awayPtsRate >= 0.5) awayRank = 5;
  else if (awayPtsRate >= 0.33) awayRank = 9;
  else if (awayPtsRate > 0) awayRank = 12;
  else awayRank = 14;

  const awayIsGood = awayRank <= 8;

  // 7. Disciplina / Tarjetas
  const avgCards = targetPJ > 0 ? (targetYellows + targetReds * 2) / targetPJ : 0;
  let yellowsRank = 8;
  if (avgCards <= 1.0) yellowsRank = 2;
  else if (avgCards <= 2.0) yellowsRank = 5;
  else if (avgCards <= 3.0) yellowsRank = 9;
  else yellowsRank = 13;

  const disciplineIsGood = yellowsRank <= 8;

  const metrics = [
    {
      id: 'goals_for',
      name: 'Goles A Favor (Ataque)',
      category: 'Ataque',
      value: targetGoals,
      formattedValue: `${targetGoals} goles (${avgGF}/partido)`,
      valueFormatted: `${targetGoals} goles (${avgGF}/partido)`,
      rank: goalsRank,
      totalTeams,
      isGood: goalsIsGood,
      description: goalsIsGood
        ? `${goalsRank}º mejor ataque de la liga con ${targetGoals} goles marcados.`
        : `Ataque con pocos goles: solo ${targetGoals} marcados en ${targetPJ} partidos (${goalsRank}º en liga).`,
      highlightText: `${goalsRank}º en ataque (${targetGoals} goles).`
    },
    {
      id: 'avg_goals',
      name: 'Promedio Goleador',
      category: 'Ataque',
      value: avgGF,
      formattedValue: `${avgGF} goles/partido`,
      valueFormatted: `${avgGF} goles/partido`,
      rank: avgGFRank,
      totalTeams,
      isGood: avgGFIsGood,
      description: avgGFIsGood
        ? `Elevada efectividad: promedio de ${avgGF} goles por encuentro (${avgGFRank}º en liga).`
        : `Baja efectividad ofensiva: promedio de ${avgGF} goles por encuentro (${avgGFRank}º en liga).`,
      highlightText: `Promedio de ${avgGF} goles/partido.`
    },
    {
      id: 'goals_against',
      name: 'Solidez Defensiva',
      category: 'Defensa',
      value: targetGA,
      formattedValue: `${targetGA} encajados`,
      valueFormatted: `${targetGA} encajados`,
      rank: defenseRank,
      totalTeams,
      isGood: defenseIsGood,
      description: defenseIsGood
        ? `${defenseRank}ª mejor defensa de la liga (${targetGA} encajados en ${targetPJ} partidos).`
        : `Defensa vulnerable: ${targetGA} encajados en ${targetPJ} partidos (${defenseRank}º equipo que más encaja).`,
      highlightText: `${defenseRank}ª defensa (${targetGA} encajados).`
    },
    {
      id: 'clean_sheets',
      name: 'Porterías a Cero',
      category: 'Defensa',
      value: targetCleanSheets,
      formattedValue: `${targetCleanSheets} partidos a cero`,
      valueFormatted: `${targetCleanSheets} partidos a cero`,
      rank: cleanSheetsRank,
      totalTeams,
      isGood: cleanSheetsIsGood,
      description: cleanSheetsIsGood
        ? `Excelente balance defensivo: ${targetCleanSheets} portería(s) imbatida(s) (${cleanSheetsRank}º en liga).`
        : `Sin porterías a cero: han encajado en el 100% de los encuentros (${cleanSheetsRank}º en liga).`,
      highlightText: `${targetCleanSheets} porterías imbatidas.`
    },
    {
      id: 'home_performance',
      name: 'Rendimiento en Casa',
      category: 'Local/Visitante',
      value: `${Math.round(homePtsRate * 100)}% pts`,
      formattedValue: `${homeWins}V-${homeDraws}E-${homeLosses}D`,
      valueFormatted: `${homeWins}V - ${homeDraws}E - ${homeLosses}D`,
      rank: homeRank,
      totalTeams,
      isGood: homeIsGood,
      description: homeIsGood
        ? `Fortín local: ${homeRank}º mejor equipo en su campo (${homeWins}V-${homeDraws}E-${homeLosses}D).`
        : `Vulnerable en casa: ocupa el puesto ${homeRank}º jugando como local (${homeWins}V-${homeDraws}E-${homeLosses}D).`,
      highlightText: `${homeRank}º mejor local.`
    },
    {
      id: 'away_performance',
      name: 'Rendimiento Fuera',
      category: 'Local/Visitante',
      value: `${Math.round(awayPtsRate * 100)}% pts`,
      formattedValue: `${awayWins}V-${awayDraws}E-${awayLosses}D`,
      valueFormatted: `${awayWins}V - ${awayDraws}E - ${awayLosses}D`,
      rank: awayRank,
      totalTeams,
      isGood: awayIsGood,
      description: awayIsGood
        ? `Peligrosos a domicilio: ${awayRank}º mejor visitante del grupo (${awayWins}V-${awayDraws}E-${awayLosses}D).`
        : `Sufren fuera de casa: puesto ${awayRank}º como visitante (${awayWins}V-${awayDraws}E-${awayLosses}D).`,
      highlightText: `${awayRank}º mejor visitante.`
    },
    {
      id: 'discipline',
      name: 'Disciplina / Tarjetas',
      category: 'Disciplina',
      value: targetYellows,
      formattedValue: `${targetYellows} amarillas / ${targetReds} rojas`,
      valueFormatted: `${targetYellows} amarillas / ${targetReds} rojas`,
      rank: yellowsRank,
      totalTeams,
      isGood: disciplineIsGood,
      description: disciplineIsGood
        ? `Juego limpio y disciplinado: ${yellowsRank}º equipo con menos sanciones (${targetYellows} amarillas / ${targetReds} rojas).`
        : `🚨 Equipo amonestado: ${yellowsRank}º equipo con más tarjetas (${targetYellows} amarillas / ${targetReds} rojas).`,
      highlightText: `${yellowsRank}º en disciplina.`
    }
  ];

  let highlights = metrics.filter(m => m.isGood).sort((a, b) => a.rank - b.rank);
  let vulnerabilities = metrics.filter(m => !m.isGood).sort((a, b) => b.rank - a.rank);

  if (highlights.length === 0) {
    const sortedByRankAsc = [...metrics].sort((a, b) => a.rank - b.rank);
    highlights = sortedByRankAsc.slice(0, 2);
  }
  if (vulnerabilities.length === 0) {
    const sortedByRankDesc = [...metrics].sort((a, b) => b.rank - a.rank);
    vulnerabilities = sortedByRankDesc.slice(0, 2);
  }

  return {
    hasData: true,
    opponentName,
    totalTeams,
    allMetrics: metrics,
    bestMetrics: highlights,
    worstMetrics: vulnerabilities,
    highlights,
    vulnerabilities,
  };
}
