import { Match, Player, PlayerMatchStats } from '../../types';

// Inicio de la temporada en curso (2026/2027). Partidos anteriores no computan.
export const SEASON_START = '2026-07-01';
export const SEASON_LABEL = '2026/2027';
export const YELLOW_CYCLE = 5;

export type CompetitionFilter = 'Liga' | 'Copa' | 'Amistoso' | 'Todas';

export interface PlayerTotals {
  called: number;      // convocatorias
  played: number;      // partidos jugados (minutos > 0)
  starter: number;     // titularidades
  subIn: number;       // entradas desde el banquillo
  minutes: number;
  minutesStarter: number;
  minutesSub: number;
  goals: number;
  assists: number;
  ga: number;          // goles + asistencias
  conceded: number;
  ownGoals: number;
  yellow: number;
  red: number;
  minutesPct: number;  // % de minutos disputados sobre el total posible
  minPerMatch: number;
  minPerGa: number | null;
}

export type DisciplineState = 'sancionado' | 'apercibido' | 'limpio';

export interface SanctionEvent {
  playerId: string;
  reason: 'ciclo' | 'roja' | 'doble_amarilla';
  label: string;
  triggerMatch: Match;
  servedMatch: Match | null;     // partido de liga en que cumplió la sanción
  pendingMatch: Match | null;    // próximo partido de liga si aún no la ha cumplido
}

export interface PlayerDiscipline {
  yellowCycle: number;          // amarillas computables para ciclo (sin dobles amarillas)
  yellowInCycle: number;        // posición dentro del ciclo actual (0-4)
  toNextSanction: number;       // amarillas que faltan para la próxima sanción
  reds: number;
  doubleYellows: number;
  events: SanctionEvent[];
  state: DisciplineState;
  pending: SanctionEvent | null;
}

export interface MatchCell {
  match: Match;
  stat: PlayerMatchStats | null;
}

export interface SquadRow extends Player {
  stats: PlayerTotals;
  discipline: PlayerDiscipline;
  isGuest: boolean;             // jugador de otra categoría que ha participado
  timeline: MatchCell[];        // celdas por partido (en orden cronológico)
}

export interface TeamMatchPoint {
  match: Match;
  label: string;                // J1, J2... o fecha
  gf: number;
  gc: number;
  result: 'V' | 'E' | 'D';
  points: number;
  cumPoints: number;
  cumGf: number;
  cumGc: number;
  yellows: number;
  reds: number;
}

const isSeason = (m: Match) => !!m.date && m.date >= SEASON_START;

const byDate = (a: Match, b: Match) =>
  (a.date + (a.time || '')).localeCompare(b.date + (b.time || ''));

export const matchLabel = (m: Match) => {
  if (m.competition === 'Liga' && m.matchday) return `J${m.matchday}`;
  const [, mm, dd] = m.date.split('-');
  return `${dd}/${mm}`;
};

export const matchMatchesCompetition = (m: Match, comp: CompetitionFilter) => {
  if (comp === 'Todas') return true;
  return (m.competition || 'Liga').toLowerCase() === comp.toLowerCase();
};

const teamOf = (m: Match) => m.team_category || 'Primer Equipo';

/** Partidos jugados del equipo en la temporada, filtrados por competición. */
export const getPlayedMatches = (matches: Match[], team: string, comp: CompetitionFilter) =>
  matches
    .filter(m => isSeason(m) && teamOf(m) === team && m.status === 'Jugado' && matchMatchesCompetition(m, comp))
    .sort(byDate);

/** Próximo partido programado de liga del equipo. */
export const getNextLeagueMatch = (matches: Match[], team: string, after?: string) =>
  matches
    .filter(m => isSeason(m) && teamOf(m) === team && m.competition === 'Liga' && m.status === 'Programado' && (!after || m.date > after))
    .sort(byDate)[0] || null;

const emptyTotals = (): PlayerTotals => ({
  called: 0, played: 0, starter: 0, subIn: 0, minutes: 0, minutesStarter: 0, minutesSub: 0,
  goals: 0, assists: 0, ga: 0, conceded: 0, ownGoals: 0, yellow: 0, red: 0,
  minutesPct: 0, minPerMatch: 0, minPerGa: null
});

/**
 * Control disciplinario en LIGA.
 * - Cada múltiplo de 5 amarillas acumuladas = 1 partido de sanción.
 * - Roja directa = sanción (se asume 1 partido).
 * - Doble amarilla en el mismo partido = expulsión; esas amarillas no suman al ciclo.
 * La sanción se cumple en el siguiente partido de liga jugado por el equipo.
 */
export const computeDiscipline = (
  playerId: string,
  leagueMatches: Match[],
  statsByMatch: Map<string, Map<string, PlayerMatchStats>>,
  nextLeague: Match | null
): PlayerDiscipline => {
  let yellowCycle = 0;
  let reds = 0;
  let doubleYellows = 0;
  const events: SanctionEvent[] = [];

  leagueMatches.forEach((m, idx) => {
    const s = statsByMatch.get(m.id)?.get(playerId);
    if (!s) return;
    const y = s.yellow_cards || 0;
    const nextPlayed = leagueMatches[idx + 1] || null;
    const mk = (reason: SanctionEvent['reason'], label: string): SanctionEvent => ({
      playerId, reason, label, triggerMatch: m,
      servedMatch: nextPlayed,
      pendingMatch: nextPlayed ? null : nextLeague
    });

    if (y >= 2) {
      doubleYellows += 1;
      events.push(mk('doble_amarilla', 'Doble amarilla'));
    } else {
      const before = yellowCycle;
      yellowCycle += y;
      for (let k = Math.floor(before / YELLOW_CYCLE) + 1; k <= Math.floor(yellowCycle / YELLOW_CYCLE); k++) {
        events.push(mk('ciclo', `${k * YELLOW_CYCLE}ª amarilla (ciclo ${k})`));
      }
    }
    if (s.red_card && y < 2) {
      reds += 1;
      events.push(mk('roja', 'Roja directa'));
    }
  });

  const pending = events.find(e => !e.servedMatch) || null;
  const yellowInCycle = yellowCycle % YELLOW_CYCLE;
  const toNextSanction = YELLOW_CYCLE - yellowInCycle;
  const state: DisciplineState = pending ? 'sancionado' : toNextSanction === 1 ? 'apercibido' : 'limpio';

  return { yellowCycle, yellowInCycle, toNextSanction, reds, doubleYellows, events, state, pending };
};

export interface SquadComputation {
  rows: SquadRow[];
  playedMatches: Match[];
  leagueMatches: Match[];
  nextLeague: Match | null;
  teamSeries: TeamMatchPoint[];
  leagueCards: { match: Match; label: string; yellows: number; reds: number }[];
  totalMinutesAvailable: number;
}

export const computeSquad = (
  players: Player[],
  matches: Match[],
  allStats: PlayerMatchStats[],
  team: string,
  comp: CompetitionFilter
): SquadComputation => {
  const playedMatches = getPlayedMatches(matches, team, comp);
  const leagueMatches = getPlayedMatches(matches, team, 'Liga');
  const nextLeague = getNextLeagueMatch(matches, team);

  // Índice: match_id -> player_id -> stat
  const statsByMatch = new Map<string, Map<string, PlayerMatchStats>>();
  allStats.forEach(s => {
    if (!statsByMatch.has(s.match_id)) statsByMatch.set(s.match_id, new Map());
    statsByMatch.get(s.match_id)!.set(s.player_id, s);
  });

  // player_match_stats puede referenciar players.id o profile_id
  const resolveStat = (m: Match, p: Player) => {
    const map = statsByMatch.get(m.id);
    if (!map) return null;
    return map.get(p.id) || (p.profile_id ? map.get(p.profile_id) : undefined) || null;
  };

  const totalMinutesAvailable = playedMatches.reduce((acc, m) => acc + (m.duration || 90), 0);

  const rows: SquadRow[] = [];
  players.forEach(p => {
    const timeline: MatchCell[] = playedMatches.map(m => ({ match: m, stat: resolveStat(m, p) }));
    const isOwn = (p.team_category || 'Primer Equipo') === team;
    const participated = timeline.some(c => c.stat && (c.stat.is_called_up || (c.stat.minutes_played || 0) > 0));
    if (!isOwn && !participated) return;

    const t = emptyTotals();
    timeline.forEach(({ stat: s }) => {
      if (!s) return;
      const mins = s.minutes_played || 0;
      if (s.is_called_up) t.called += 1;
      if (mins > 0) t.played += 1;
      if (s.is_starter) { t.starter += 1; t.minutesStarter += mins; }
      else if (mins > 0) { t.subIn += 1; t.minutesSub += mins; }
      t.minutes += mins;
      t.goals += s.goals || 0;
      t.assists += s.assists || 0;
      t.conceded += s.conceded_goals || 0;
      t.ownGoals += s.own_goals || 0;
      t.yellow += s.yellow_cards || 0;
      if (s.red_card) t.red += 1;
    });
    t.ga = t.goals + t.assists;
    t.minutesPct = totalMinutesAvailable > 0 ? Math.round((t.minutes / totalMinutesAvailable) * 100) : 0;
    t.minPerMatch = t.played > 0 ? Math.round(t.minutes / t.played) : 0;
    t.minPerGa = t.ga > 0 ? Math.round(t.minutes / t.ga) : null;

    // La disciplina se calcula siempre sobre la liga (adaptando el id real usado en stats)
    const leagueIndex = new Map<string, Map<string, PlayerMatchStats>>();
    leagueMatches.forEach(m => {
      const s = resolveStat(m, p);
      if (s) leagueIndex.set(m.id, new Map([[p.id, s]]));
    });
    const discipline = computeDiscipline(p.id, leagueMatches, leagueIndex, nextLeague);

    rows.push({ ...p, stats: t, discipline, isGuest: !isOwn, timeline });
  });

  // Serie evolutiva del equipo
  let cumPoints = 0, cumGf = 0, cumGc = 0;
  const teamSeries: TeamMatchPoint[] = playedMatches.map(m => {
    const gf = m.score_us ?? 0;
    const gc = m.score_them ?? 0;
    const result: 'V' | 'E' | 'D' = gf > gc ? 'V' : gf === gc ? 'E' : 'D';
    const points = result === 'V' ? 3 : result === 'E' ? 1 : 0;
    cumPoints += points; cumGf += gf; cumGc += gc;
    let yellows = 0, reds = 0;
    statsByMatch.get(m.id)?.forEach(s => { yellows += s.yellow_cards || 0; if (s.red_card) reds += 1; });
    return { match: m, label: matchLabel(m), gf, gc, result, points, cumPoints, cumGf, cumGc, yellows, reds };
  });

  const leagueCards = leagueMatches.map(m => {
    let yellows = 0, reds = 0;
    statsByMatch.get(m.id)?.forEach(s => { yellows += s.yellow_cards || 0; if (s.red_card) reds += 1; });
    return { match: m, label: matchLabel(m), yellows, reds };
  });

  return { rows, playedMatches, leagueMatches, nextLeague, teamSeries, leagueCards, totalMinutesAvailable };
};

export const formatMatchShort = (m: Match | null) => {
  if (!m) return '—';
  const [, mm, dd] = m.date.split('-');
  return `${matchLabel(m)} · ${m.rival} (${dd}/${mm})`;
};

export const displayName = (p: Pick<Player, 'nickname' | 'full_name'>) =>
  p.nickname || p.full_name.split(' ')[0];
