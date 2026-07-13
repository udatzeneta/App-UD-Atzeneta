import { supabase, isMockMode } from '../lib/supabase';
import { MockDatabase, delay } from './mockData';
import { Training, Match, Team, PlayerMatchStats, Fine, PointLog, ScoutingPlayer, OpponentAnalysis, Settings, TrainingAttendance, TacticalBoard, Player, PlayerWeight, PlayerPhysioRecord, PlayerInjury, SocialEvent, TrainingTask, TrainingSessionTask } from '../types';


const applyCompetitiveLeaveEffects = async (injury: PlayerInjury) => {
  if (!injury.competitive_leave || injury.status === 'Recuperado') return;

  const todayStr = new Date().toISOString().split('T')[0];

  try {
    // 1. Trainings (Attendances)
    const trainings = await dataService.getTrainings();
    const futureTrainings = trainings.filter(t => t.date >= todayStr);
    
    if (isMockMode) {
      const allAttendances = MockDatabase.getTrainingAttendance();
      for (const t of futureTrainings) {
        let att = allAttendances.find((a: any) => a.training_id === t.id && a.player_id === injury.player_id);
        if (att) {
          att.status = 'L';
          att.observations = `Baja competitiva: ${injury.diagnosis}`;
        } else {
          allAttendances.push({
            id: `att-${Date.now()}-${Math.random()}`,
            training_id: t.id,
            player_id: injury.player_id,
            status: 'L',
            observations: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
      MockDatabase.setTrainingAttendance(allAttendances);
    } else {
      for (const t of futureTrainings) {
        const { data: existing } = await supabase
          .from('training_attendances')
          .select('*')
          .eq('training_id', t.id)
          .eq('player_id', injury.player_id)
          .maybeSingle();

        if (existing) {
          await supabase.from('training_attendances').update({
            status: 'L',
            observations: `Baja competitiva: ${injury.diagnosis}`
          }).eq('id', existing.id);
        } else {
          await supabase.from('training_attendances').insert({
            training_id: t.id,
            player_id: injury.player_id,
            status: 'L',
            observations: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
    }

    // 2. Matches (PlayerMatchStats)
    const matches = await dataService.getMatches();
    const futureMatches = matches.filter(m => m.date >= todayStr);

    if (isMockMode) {
      const allStats = MockDatabase.getPlayerMatchStats();
      for (const m of futureMatches) {
        let stat = allStats.find(s => s.match_id === m.id && s.player_id === injury.player_id);
        if (stat) {
          stat.is_called_up = false;
          stat.comments = `Baja competitiva: ${injury.diagnosis}`;
        } else {
          allStats.push({
            id: `stat-${Date.now()}-${Math.random()}`,
            match_id: m.id,
            player_id: injury.player_id,
            is_called_up: false,
            minutes_played: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_card: false,
            comments: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
      MockDatabase.setPlayerMatchStats(allStats);
    } else {
      for (const m of futureMatches) {
        const { data: existing } = await supabase
          .from('player_match_stats')
          .select('*')
          .eq('match_id', m.id)
          .eq('player_id', injury.player_id)
          .maybeSingle();

        if (existing) {
          await supabase.from('player_match_stats').update({
            is_called_up: false,
            comments: `Baja competitiva: ${injury.diagnosis}`
          }).eq('id', existing.id);
        } else {
          await supabase.from('player_match_stats').insert({
            match_id: m.id,
            player_id: injury.player_id,
            is_called_up: false,
            minutes_played: 0,
            goals: 0,
            assists: 0,
            yellow_cards: 0,
            red_card: false,
            comments: `Baja competitiva: ${injury.diagnosis}`
          });
        }
      }
    }
  } catch (err) {
    console.error("Error applying competitive leave effects", err);
  }
};

export const dataService = {
  // =====================================================================
  // ENTRENAMIENTOS (TRAININGS)
  // =====================================================================
  async getTrainings(): Promise<Training[]> {
    if (isMockMode) {
      await delay(300);
      return MockDatabase.getTrainings().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Training[];
    }
  },

  async createTraining(item: Omit<Training, 'id'>): Promise<Training> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getTrainings();
      const newItem: Training = { ...item, id: `t-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setTrainings(list);
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('trainings')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as Training;
    }
  },

  async updateTraining(id: string, item: Partial<Training>): Promise<Training> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getTrainings();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Entrenamiento no encontrado');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setTrainings(list);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('trainings')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Training;
    }
  },

  async deleteTraining(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getTrainings();
      list = list.filter(x => x.id !== id);
      MockDatabase.setTrainings(list);
    } else {
      const { error } = await supabase
        .from('trainings')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  async getTeams(): Promise<Team[]> {
    if (isMockMode) {
      await delay(200);
      return [
        { id: '1', ffcv_cod: '123', name: 'CD Alcoyano', shield_url: 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0000030064_escudo.png', competition: 'Liga', cod_grupo: '1', season: '2025-2026' },
        { id: '2', ffcv_cod: '456', name: 'Ontinyent 1931 CF', shield_url: 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0000055106_escudo.png', competition: 'Liga', cod_grupo: '1', season: '2025-2026' },
        { id: '3', ffcv_cod: '789', name: 'CD Castellón B', shield_url: 'https://appwebffcv.novanet.es/pnfg/pimg/Clubes/00100_0000030026_escudo.png', competition: 'Liga', cod_grupo: '1', season: '2025-2026' }
      ];
    } else {
      const { data, error } = await supabase
        .from('teams')
        .select('*')
        .order('name', { ascending: true });
      if (error) throw error;
      return data as Team[];
    }
  },

  async createTeam(item: Omit<Team, 'id' | 'created_at' | 'updated_at'>): Promise<Team> {
    if (isMockMode) {
      await delay(200);
      return { ...item, id: `team-${Date.now()}` } as Team;
    } else {
      const { data, error } = await supabase
        .from('teams')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as Team;
    }
  },

  async getMatches(): Promise<Match[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getMatches().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const { data, error } = await supabase
        .from('matches')
        .select('*')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Match[];
    }
  },

  async getPlayerMatchStats(matchId: string): Promise<PlayerMatchStats[]> {
    if (isMockMode) {
      await delay(200);
      try {
        const data = localStorage.getItem('ud_atzeneta_player_match_stats');
        const list = data ? JSON.parse(data) : [];
        return list.filter((x: any) => x.match_id === matchId) as PlayerMatchStats[];
      } catch (e) {
        console.error("Error parseando player_match_stats:", e);
        return [];
      }
    } else {
      const { data, error } = await supabase
        .from('player_match_stats')
        .select('*')
        .eq('match_id', matchId);
      if (error) throw error;
      return data as PlayerMatchStats[];
    }
  },

  async getAllPlayerMatchStatsByPlayer(playerId: string): Promise<PlayerMatchStats[]> {
    if (isMockMode) {
      await delay(200);
      try {
        const data = localStorage.getItem('ud_atzeneta_player_match_stats');
        const list = data ? JSON.parse(data) : [];
        return list.filter((x: any) => x.player_id === playerId) as PlayerMatchStats[];
      } catch (e) {
        console.error("Error parseando player_match_stats:", e);
        return [];
      }
    } else {
      const { data, error } = await supabase
        .from('player_match_stats')
        .select('*')
        .eq('player_id', playerId);
      if (error) throw error;
      return data as PlayerMatchStats[];
    }
  },

  async getAllPlayerMatchStats(): Promise<PlayerMatchStats[]> {
    if (isMockMode) {
      await delay(200);
      try {
        const data = localStorage.getItem('ud_atzeneta_player_match_stats');
        return data ? JSON.parse(data) as PlayerMatchStats[] : [];
      } catch (e) {
        console.error("Error parseando player_match_stats:", e);
        return [];
      }
    } else {
      const { data, error } = await supabase
        .from('player_match_stats')
        .select('*');
      if (error) throw error;
      return data as PlayerMatchStats[];
    }
  },

  async savePlayerMatchStats(matchId: string, items: Omit<PlayerMatchStats, 'id' | 'created_at' | 'updated_at'>[]): Promise<PlayerMatchStats[]> {
    if (isMockMode) {
      await delay(300);
      const data = localStorage.getItem('ud_atzeneta_player_match_stats');
      let list = data ? JSON.parse(data) : [];
      // Eliminar previos de este partido
      list = list.filter((x: any) => x.match_id !== matchId);
      
      // Agregar nuevos
      const newItems = items.map((x, idx) => ({
        ...x,
        id: `pms-${Date.now()}-${idx}`
      }));
      list.push(...newItems);
      localStorage.setItem('ud_atzeneta_player_match_stats', JSON.stringify(list));

      // Actualizar estadísticas globales del jugador simulado
      const mockPlayersData = MockDatabase.getPlayers();
      const updatedPlayers = mockPlayersData.map((player: Player) => {
        const playerStats = list.filter((x: any) => x.player_id === player.id);
        const matches_played = playerStats.filter((x: any) => x.minutes_played > 0).length;
        const minutes_played = playerStats.reduce((sum: number, x: any) => sum + (x.minutes_played || 0), 0);
        const goals = playerStats.reduce((sum: number, x: any) => sum + (x.goals || 0), 0);
        const assists = playerStats.reduce((sum: number, x: any) => sum + (x.assists || 0), 0);
        const yellow_cards = playerStats.reduce((sum: number, x: any) => sum + (x.yellow_cards || 0), 0);
        const red_cards = playerStats.filter((x: any) => x.red_card === true).length;
        
        return {
          ...player,
          matches_played,
          minutes_played,
          goals,
          assists,
          yellow_cards,
          red_cards
        };
      });
      MockDatabase.setPlayers(updatedPlayers);
      
      return newItems as PlayerMatchStats[];
    } else {
      const { data, error } = await supabase
        .from('player_match_stats')
        .upsert(items, { onConflict: 'player_id,match_id' })
        .select();
      if (error) throw error;
      return data as PlayerMatchStats[];
    }
  },

  async createMatch(item: Omit<Match, 'id'>): Promise<Match> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getMatches();
      const newItem: Match = { ...item, id: `m-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setMatches(list);
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('matches')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as Match;
    }
  },

  async updateMatch(id: string, item: Partial<Match>): Promise<Match> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getMatches();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Partido no encontrado');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setMatches(list);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('matches')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Match;
    }
  },

  async deleteMatchCallups(matchId: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let list = MockDatabase.getMatches();
      const idx = list.findIndex(x => x.id === matchId);
      if (idx !== -1) {
        list[idx] = { ...list[idx], callup_time: undefined, callup_location: undefined, kit_shirt_color: undefined, kit_shorts_color: undefined, kit_socks_color: undefined };
        MockDatabase.setMatches(list);
      }
      let stats = MockDatabase.getPlayerMatchStats();
      stats = stats.filter((s: import('../types').PlayerMatchStats) => s.match_id !== matchId);
      MockDatabase.setPlayerMatchStats(stats);
    } else {
      await supabase.from('matches').update({
        callup_time: null,
        callup_location: null,
        kit_shirt_color: null,
        kit_shorts_color: null,
        kit_socks_color: null
      }).eq('id', matchId);
      
      const { error } = await supabase.from('player_match_stats').delete().eq('match_id', matchId);
      if (error) throw error;
    }
  },

  async deleteMatchReport(matchId: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let list = MockDatabase.getMatches();
      const idx = list.findIndex(x => x.id === matchId);
      if (idx !== -1) {
        list[idx] = { 
          ...list[idx], 
          score_us: null, 
          score_them: null, 
          status: 'Programado',
          tactical_system: undefined,
          tactical_with_ball: undefined,
          tactical_without_ball: undefined,
          tactical_set_pieces: undefined,
          tactical_general: undefined,
          opponent_events: { goals: [], yellow_cards: [] },
          team_positive_aspects: undefined,
          team_improve_aspects: undefined,
          team_ratings: undefined
        };
        MockDatabase.setMatches(list);
      }
      // Eliminar lesiones del partido simuladas
      let injuries = MockDatabase.getPlayerInjuries();
      injuries = injuries.filter(i => i.match_id !== matchId);
      MockDatabase.setPlayerInjuries(injuries);

      // Borramos por completo todas las estadísticas y convocatoria de este partido
      let stats = MockDatabase.getPlayerMatchStats();
      stats = stats.filter((s: import('../types').PlayerMatchStats) => s.match_id !== matchId);
      MockDatabase.setPlayerMatchStats(stats);
    } else {
      await supabase.from('matches').update({
        score_us: null,
        score_them: null,
        status: 'Programado',
        tactical_system: null,
        tactical_with_ball: null,
        tactical_without_ball: null,
        tactical_set_pieces: null,
        tactical_general: null,
        opponent_events: { goals: [], yellow_cards: [] },
        team_positive_aspects: null,
        team_improve_aspects: null,
        team_ratings: null
      }).eq('id', matchId);

      // Borramos por completo los stats de los jugadores para este partido
      const { error } = await supabase.from('player_match_stats').delete().eq('match_id', matchId);
      if (error) throw error;

      // Eliminar lesiones del partido (no crítico: si la columna match_id aún no existe
      // o falla, no debe abortar el borrado del acta ni impedir la navegación posterior)
      const { error: injuryError } = await supabase.from('player_injuries').delete().eq('match_id', matchId);
      if (injuryError) console.warn('No se pudieron borrar las lesiones del partido:', injuryError.message);
    }
  },

  async deleteMatch(id: string): Promise<void> {
    try {
      // 1. Obtener la sesión actual para RLS (Row Level Security)
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa. Inicia sesión de nuevo.');
      
      // 2. Eliminar el partido
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      // La tabla player_match_stats y player_injuries deberían tener ON DELETE CASCADE,
      // pero por si acaso, intentamos limpiar (ignorando errores)
      const { error: statsError } = await supabase.from('player_match_stats').delete().eq('match_id', id);
      const { error: injuryError } = await supabase.from('player_injuries').delete().eq('match_id', id);
      
    } catch (err: any) {
      console.error('Error eliminando partido:', err.message);
      throw err;
    }
  },

  async deleteMatches(ids: string[]): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No hay sesión activa.');
      if (!ids.length) return;

      const { error } = await supabase
        .from('matches')
        .delete()
        .in('id', ids);

      if (error) throw error;
      
      await supabase.from('player_match_stats').delete().in('match_id', ids);
      await supabase.from('player_injuries').delete().in('match_id', ids);
    } catch (err: any) {
      console.error('Error eliminando múltiples partidos:', err.message);
      throw err;
    }
  },

  // ---------------------------------------------------------
  // APARTADO: MULTAS (FINES)
  // ---------------------------------------------------------},

  async upsertMatches(items: Omit<Match, 'id'>[]): Promise<Match[]> {
    const results: Match[] = [];
    for (const item of items) {
      // Buscar coincidencia por fecha y rival
      const { data: existing, error: searchError } = await supabase
        .from('matches')
        .select('*')
        .eq('date', item.date)
        .ilike('rival', item.rival)
        .maybeSingle();

      if (searchError) throw searchError;

      if (existing) {
        const { data, error } = await supabase
          .from('matches')
          .update(item)
          .eq('id', existing.id)
          .select()
          .single();
        if (error) throw error;
        results.push(data as Match);
      } else {
        const { data, error } = await supabase
          .from('matches')
          .insert(item)
          .select()
          .single();
        if (error) throw error;
        results.push(data as Match);
      }
    }
    return results;
  },


  async getProfilesByRoles(roleIds: number[]): Promise<Profile[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getProfiles().filter((p: any) => roleIds.includes(p.role_id));
    } else {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .in('role_id', roleIds);
      if (error) throw error;
      return data as Profile[];
    }
  },

  async linkPlayerToUser(userId: string, fullName: string): Promise<boolean> {
    if (isMockMode) {
      await delay(200);
      const players = MockDatabase.getPlayers();
      // Búsqueda simple por similitud de texto (separando por palabras clave)
      const queryParts = fullName.toLowerCase().trim().split(' ').filter(p => p.length > 2);
      const match = players.find(p => {
        const pName = p.full_name.toLowerCase();
        return queryParts.some(part => pName.includes(part));
      });
      if (match) {
        match.profile_id = userId;
        MockDatabase.setPlayers(players);
        return true;
      }
      return false;
    } else {
      // Búsqueda más flexible, coger la primera palabra del nombre/apellido
      const queryParts = fullName.trim().split(' ').filter(p => p.length > 2);
      if (queryParts.length === 0) return false;
      
      // Armar query OR ilike
      const orQuery = queryParts.map(part => `full_name.ilike.%${part}%`).join(',');
      
      const { data: players, error } = await supabase
        .from('players')
        .select('id, full_name')
        .or(orQuery);
      
      if (error) {
        console.error('Error buscando jugador para enlazar:', error);
        return false;
      }
      
      if (players && players.length > 0) {
        const playerId = players[0].id;
        const { error: updateError } = await supabase
          .from('players')
          .update({ profile_id: userId })
          .eq('id', playerId);
          
        if (updateError) return false;
        return true;
      }
      return false;
    }
  },

  // =====================================================================
  // MULTAS (FINES)
  // =====================================================================
  async getFines(): Promise<Fine[]> {
    if (isMockMode) {
      await delay(300);
      const fines = MockDatabase.getFines();
      const profiles = MockDatabase.getProfiles();
      const players = MockDatabase.getPlayers();
      return fines.map(f => {
        const profile = profiles.find(p => p.id === f.user_id);
        const player = players.find(p => p.profile_id === f.user_id);
        return {
          ...f,
          profiles: profile ? {
            ...profile,
            nickname: player?.nickname || profile.full_name,
            dorsal: player?.dorsal
          } : undefined
        };
      }).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      // Query 1: Obtener multas
      const { data: finesData, error: finesError } = await supabase
        .from('fines')
        .select('*')
        .order('created_at', { ascending: false });

      if (finesError) throw finesError;

      // Query 2: Obtener perfiles
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('*');

      if (profilesError) throw profilesError;

      // Query 3: Obtener jugadores (para obtener nickname y dorsal)
      const { data: playersData, error: playersError } = await supabase
        .from('players')
        .select('profile_id, nickname, dorsal');

      if (playersError) throw playersError;

      // Combinar datos manualmente
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);
      const playersMap = new Map(playersData?.map(p => [p.profile_id, p]) || []);

      const result = finesData?.map(f => {
        const profile = profilesMap.get(f.user_id);
        const player = playersMap.get(f.user_id);
        return {
          ...f,
          profiles: profile ? {
            ...profile,
            nickname: player?.nickname || profile.full_name,
            dorsal: player?.dorsal
          } : undefined
        };
      }) || [];

      return result as Fine[];
    }
  },

  async createFine(item: Omit<Fine, 'id'>): Promise<Fine> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getFines();
      const newItem: Fine = { ...item, id: `f-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setFines(list);
      const profiles = MockDatabase.getProfiles();
      return { ...newItem, profiles: profiles.find(p => p.id === newItem.user_id) };
    } else {
      const { data, error } = await supabase
        .from('fines')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      // Obtener relación para devolver objeto íntegro
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user_id).single();
      return { ...data, profiles: profile } as Fine;
    }
  },

  async updateFine(id: string, item: Partial<Fine>): Promise<Fine> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getFines();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Multa no encontrada');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setFines(list);
      const profiles = MockDatabase.getProfiles();
      return { ...list[idx], profiles: profiles.find(p => p.id === list[idx].user_id) };
    } else {
      const { data, error } = await supabase
        .from('fines')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user_id).single();
      return { ...data, profiles: profile } as Fine;
    }
  },

  async deleteFine(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getFines();
      list = list.filter(x => x.id !== id);
      MockDatabase.setFines(list);
    } else {
      const { error } = await supabase
        .from('fines')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =====================================================================
  // PUNTOS (POINTS LOG)
  // =====================================================================
  async getPoints(): Promise<PointLog[]> {
    if (isMockMode) {
      await delay(300);
      const points = MockDatabase.getPoints();
      const profiles = MockDatabase.getProfiles();
      return points.map(p => ({
        ...p,
        profiles: profiles.find(pr => pr.id === p.user_id)
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const { data, error } = await supabase
        .from('points')
        .select('*, profiles(*)')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as PointLog[];
    }
  },

  async createPoint(item: Omit<PointLog, 'id'>): Promise<PointLog> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getPoints();
      const newItem: PointLog = { ...item, id: `p-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setPoints(list);
      const profiles = MockDatabase.getProfiles();
      return { ...newItem, profiles: profiles.find(p => p.id === newItem.user_id) };
    } else {
      const { data, error } = await supabase
        .from('points')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user_id).single();
      return { ...data, profiles: profile } as PointLog;
    }
  },

  async updatePoint(id: string, item: Partial<PointLog>): Promise<PointLog> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getPoints();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Punto no encontrado');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setPoints(list);
      const profiles = MockDatabase.getProfiles();
      return { ...list[idx], profiles: profiles.find(p => p.id === list[idx].user_id) };
    } else {
      const { data, error } = await supabase
        .from('points')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      const { data: profile } = await supabase.from('profiles').select('*').eq('id', data.user_id).single();
      return { ...data, profiles: profile } as PointLog;
    }
  },

  async deletePoint(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getPoints();
      list = list.filter(x => x.id !== id);
      MockDatabase.setPoints(list);
    } else {
      const { error } = await supabase
        .from('points')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =====================================================================
  // SCOUTING
  // =====================================================================
  async getScouting(): Promise<ScoutingPlayer[]> {
    if (isMockMode) {
      await delay(300);
      return MockDatabase.getScouting();
    } else {
      const allData: ScoutingPlayer[] = [];
      const pageSize = 1000;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const start = page * pageSize;
        const end = start + pageSize - 1;
        const { data, error } = await supabase
          .from('scouting')
          .select('*')
          .order('created_at', { ascending: false })
          .range(start, end);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData.push(...data as ScoutingPlayer[]);
          if (data.length < pageSize) {
            hasMore = false;
          }
        }
        page++;
      }
      return allData;
    }
  },

  async getScoutingWithHistory(): Promise<ScoutingPlayer[]> {
    if (isMockMode) {
      await delay(300);
      return MockDatabase.getScouting();
    } else {
      const allData: ScoutingPlayer[] = [];
      const pageSize = 500;
      let page = 0;
      let hasMore = true;

      while (hasMore) {
        const start = page * pageSize;
        const end = start + pageSize - 1;
        const { data, error } = await supabase
          .from('scouting')
          .select('*, scouting_player_history(*)')
          .order('created_at', { ascending: false })
          .range(start, end);

        if (error) throw error;
        if (!data || data.length === 0) {
          hasMore = false;
        } else {
          allData.push(...data as ScoutingPlayer[]);
          if (data.length < pageSize) {
            hasMore = false;
          }
        }
        page++;
      }
      return allData;
    }
  },

  async createScouting(item: Omit<ScoutingPlayer, 'id'>): Promise<ScoutingPlayer> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getScouting();
      const newItem: ScoutingPlayer = { ...item, id: `s-${Date.now()}`, created_at: new Date().toISOString() };
      list.push(newItem);
      MockDatabase.setScouting(list);
      return newItem;
    } else {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user?.id;
      const { data, error } = await supabase
        .from('scouting')
        .insert({ ...item, created_by: userId })
        .select()
        .single();
      if (error) throw error;
      return data as ScoutingPlayer;
    }
  },

  async updateScouting(id: string, item: Partial<ScoutingPlayer>): Promise<ScoutingPlayer> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getScouting();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Jugador en scouting no encontrado');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setScouting(list);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('scouting')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as ScoutingPlayer;
    }
  },

  async deleteScouting(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getScouting();
      list = list.filter(x => x.id !== id);
      MockDatabase.setScouting(list);
    } else {
      const { error } = await supabase
        .from('scouting')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =====================================================================
  // ANÁLISIS DE RIVALES (OPPONENT ANALYSIS)
  // =====================================================================
  async getOpponentAnalysis(): Promise<OpponentAnalysis[]> {
    if (isMockMode) {
      await delay(300);
      return MockDatabase.getOpponentAnalysis();
    } else {
      const { data, error } = await supabase
        .from('opponent_analysis')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as OpponentAnalysis[];
    }
  },

  async createOpponentAnalysis(item: Omit<OpponentAnalysis, 'id'>): Promise<OpponentAnalysis> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getOpponentAnalysis();
      const newItem: OpponentAnalysis = { ...item, id: `oa-${Date.now()}`, created_at: new Date().toISOString() };
      list.push(newItem);
      MockDatabase.setOpponentAnalysis(list);
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('opponent_analysis')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as OpponentAnalysis;
    }
  },

  async updateOpponentAnalysis(id: string, item: Partial<OpponentAnalysis>): Promise<OpponentAnalysis> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getOpponentAnalysis();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Análisis no encontrado');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setOpponentAnalysis(list);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('opponent_analysis')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as OpponentAnalysis;
    }
  },

  async deleteOpponentAnalysis(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getOpponentAnalysis();
      list = list.filter(x => x.id !== id);
      MockDatabase.setOpponentAnalysis(list);
    } else {
      const { error } = await supabase
        .from('opponent_analysis')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  // =====================================================================
  // CONFIGURACIÓN (SETTINGS)
  // =====================================================================
  async getSettings(): Promise<Settings> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getSettings();
    } else {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 1)
        .single();
      if (error) throw error;
      return data as Settings;
    }
  },

  async updateSettings(item: Partial<Settings>): Promise<Settings> {
    if (isMockMode) {
      await delay(200);
      const data = MockDatabase.getSettings();
      const updated = { ...data, ...item };
      MockDatabase.setSettings(updated);
      return updated;
    } else {
      const { data, error } = await supabase
        .from('settings')
        .update(item)
        .eq('id', 1)
        .select()
        .single();
      if (error) throw error;
      return data as Settings;
    }
  },

  // =====================================================================
  // ASISTENCIAS (TRAINING ATTENDANCE)
  // =====================================================================
  async getTrainingAttendance(): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getTrainingAttendance();
    } else {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*');
      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async getAttendanceByTraining(trainingId: string): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(300);
      const attendance = MockDatabase.getTrainingAttendance();
      return attendance.filter(x => x.training_id === trainingId);
    } else {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*, players(*)')
        .eq('training_id', trainingId);
      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async getAllAttendance(): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(300);
      return MockDatabase.getTrainingAttendance();
    } else {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*');
      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async getAttendanceByMonth(year: number, month: number): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(300);
      const trainings = MockDatabase.getTrainings();
      // Filtrar entrenamientos del mes
      const filteredTrainings = trainings.filter(t => {
        const d = new Date(t.date);
        return d.getFullYear() === year && (d.getMonth() + 1) === month;
      });
      const trainingIds = filteredTrainings.map(t => t.id);
      
      const attendance = MockDatabase.getTrainingAttendance();
      const profiles = MockDatabase.getProfiles();
      
      return attendance
        .filter(x => trainingIds.includes(x.training_id));
    } else {
      const daysInMonth = new Date(year, month, 0).getDate();
      const start = `${year}-${String(month).padStart(2, '0')}-01`;
      const end = `${year}-${String(month).padStart(2, '0')}-${String(daysInMonth).padStart(2, '0')}`;

      // 1. Obtener entrenamientos del mes
      const { data: trainings, error: tError } = await supabase
        .from('trainings')
        .select('id')
        .gte('date', start)
        .lte('date', end);

      if (tError) throw tError;
      if (!trainings || trainings.length === 0) return [];

      const trainingIds = trainings.map(t => t.id);

      // 2. Obtener asistencias de dichos entrenamientos
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*')
        .in('training_id', trainingIds);

      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async saveAttendanceList(trainingId: string, attendanceList: Omit<TrainingAttendance, 'id'>[]): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(300);
      let attendance = MockDatabase.getTrainingAttendance();
      attendance = attendance.filter(x => x.training_id !== trainingId);
      const newItems = attendanceList.map((x, idx) => ({
        ...x,
        id: `att-${Date.now()}-${idx}`
      }));
      attendance.push(...newItems);
      MockDatabase.setTrainingAttendance(attendance);
      return newItems;
    } else {
      const itemsToUpsert = attendanceList.map(item => ({
        training_id: item.training_id,
        player_id: item.player_id,
        status: item.status,
        observations: item.observations,
        player_intent: item.player_intent,
        player_reason: item.player_reason
      }));

      const { data, error } = await supabase
        .from('training_attendance')
        .upsert(itemsToUpsert, { onConflict: 'training_id,player_id' })
        .select('*');

      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async updateAttendance(trainingId: string, playerId: string, status: any, observations?: string): Promise<TrainingAttendance> {
    if (isMockMode) {
      await delay(200);
      const attendance = MockDatabase.getTrainingAttendance();
      const idx = attendance.findIndex(x => x.training_id === trainingId && x.player_id === playerId);
      let updatedItem: TrainingAttendance;
      if (idx !== -1) {
        attendance[idx] = { ...attendance[idx], status, observations };
        updatedItem = attendance[idx];
      } else {
        updatedItem = {
          id: `att-${Date.now()}`,
          training_id: trainingId,
          player_id: playerId,
          status,
          observations
        };
        attendance.push(updatedItem);
      }
      MockDatabase.setTrainingAttendance(attendance);
      return updatedItem;
    } else {
      const { data, error } = await supabase
        .from('training_attendance')
        .upsert(
          { training_id: trainingId, player_id: playerId, status, observations },
          { onConflict: 'training_id,player_id' }
        )
        .select('*')
        .single();

      if (error) throw error;
      return data as TrainingAttendance;
    }
  },

  async savePlayerAttendanceIntent(trainingId: string, playerId: string, intent: boolean, reason: string): Promise<TrainingAttendance> {
    if (isMockMode) {
      await delay(200);
      const attendance = MockDatabase.getTrainingAttendance();
      const idx = attendance.findIndex(x => x.training_id === trainingId && x.player_id === playerId);
      let updatedItem: TrainingAttendance;
      if (idx !== -1) {
        attendance[idx] = { ...attendance[idx], player_intent: intent, player_reason: reason };
        updatedItem = attendance[idx];
      } else {
        updatedItem = {
          id: `att-${Date.now()}`,
          training_id: trainingId,
          player_id: playerId,
          status: '-', // or 'Pendiente'
          player_intent: intent,
          player_reason: reason
        };
        attendance.push(updatedItem);
      }
      MockDatabase.setTrainingAttendance(attendance);
      return updatedItem;
    } else {
      // Intentamos hacer fetch primero para no sobreescribir el status actual si ya existe
      const { data: existing } = await supabase
        .from('training_attendance')
        .select('*')
        .eq('training_id', trainingId)
        .eq('player_id', playerId)
        .maybeSingle();

      const itemToSave = existing 
        ? { ...existing, player_intent: intent, player_reason: reason }
        : { training_id: trainingId, player_id: playerId, status: '-', player_intent: intent, player_reason: reason };

      const { data, error } = await supabase
        .from('training_attendance')
        .upsert(itemToSave, { onConflict: 'training_id,player_id' })
        .select('*')
        .single();

      if (error) throw error;
      return data as TrainingAttendance;
    }
  },

  async deleteAttendanceRecord(trainingId: string, playerId: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let attendance = MockDatabase.getTrainingAttendance();
      attendance = attendance.filter(x => !(x.training_id === trainingId && x.player_id === playerId));
      MockDatabase.setTrainingAttendance(attendance);
    } else {
      const { error } = await supabase
        .from('training_attendance')
        .delete()
        .eq('training_id', trainingId)
        .eq('player_id', playerId);
      if (error) throw error;
    }
  },

  async deleteAllAttendanceForTraining(trainingId: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let attendance = MockDatabase.getTrainingAttendance();
      attendance = attendance.filter(x => x.training_id !== trainingId);
      MockDatabase.setTrainingAttendance(attendance);
    } else {
      const { error } = await supabase
        .from('training_attendance')
        .delete()
        .eq('training_id', trainingId);
      if (error) throw error;
    }
  },

  // =====================================================================
  // TABLERO TÁCTICO / CAMPOGRAMA (TACTICAL BOARD)
  // =====================================================================
  async getTacticalBoard(): Promise<TacticalBoard> {
    const data = localStorage.getItem('ud_atzeneta_tactical_board');
    if (data) {
      return JSON.parse(data);
    }
    return {
      id: 'scouting',
      name: 'Tablero de Scouting',
      formation: 'Libre',
      players: []
    };
  },

  async saveTacticalBoard(board: TacticalBoard): Promise<TacticalBoard> {
    localStorage.setItem('ud_atzeneta_tactical_board', JSON.stringify(board));
    return board;
  },

  // =====================================================================
  // JUGADORES (PLAYERS)
  // =====================================================================
  async getPlayers(): Promise<Player[]> {
    if (isMockMode) {
      await delay(300);
      return MockDatabase.getPlayers();
    } else {
      const { data, error } = await supabase
        .from('players')
        .select('*')
        .order('dorsal', { ascending: true });
      if (error) throw error;
      return data as Player[];
    }
  },

  async createPlayer(item: Omit<Player, 'id'>): Promise<Player> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getPlayers();
      const newItem: Player = { ...item, id: `p-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setPlayers(list);
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('players')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      return data as Player;
    }
  },

  async updatePlayer(id: string, item: Partial<Player>): Promise<Player> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getPlayers();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Jugador no encontrado');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setPlayers(list);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('players')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data as Player;
    }
  },

  async deletePlayer(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getPlayers();
      list = list.filter(x => x.id !== id);
      MockDatabase.setPlayers(list);
    } else {
      const { error } = await supabase
        .from('players')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  /**
   * Sube una foto de perfil (ya recortada) al bucket público 'player-photos'
   * de Supabase Storage y devuelve la URL pública. En modo Mock, convierte
   * el blob a Data URL para poder previsualizarlo sin backend real.
   */
  async uploadPlayerPhoto(blob: Blob, folder = 'players'): Promise<string> {
    if (isMockMode) {
      await delay(400);
      return await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('No se pudo procesar la imagen en modo demo.'));
        reader.readAsDataURL(blob);
      });
    } else {
      const fileName = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.png`;
      const { error: uploadError } = await supabase.storage
        .from('player-photos')
        .upload(fileName, blob, { contentType: 'image/png', upsert: false });
      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from('player-photos').getPublicUrl(fileName);
      return data.publicUrl;
    }
  },

  // =====================================================================
  // HISTORIAL DE PESOS
  // =====================================================================
  async getPlayerWeights(playerId: string): Promise<PlayerWeight[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getPlayerWeights()
        .filter(w => w.player_id === playerId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      const { data, error } = await supabase
        .from('player_weights')
        .select('*')
        .eq('player_id', playerId)
        .order('date', { ascending: true });
      if (error) throw error;
      return data as PlayerWeight[];
    }
  },

  async createPlayerWeight(item: Omit<PlayerWeight, 'id'>): Promise<PlayerWeight> {
    if (isMockMode) {
      await delay(200);
      const list = MockDatabase.getPlayerWeights();
      const newItem: PlayerWeight = { ...item, id: `w-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setPlayerWeights(list);
      
      // Actualizar también el peso de la ficha principal del jugador
      const players = MockDatabase.getPlayers();
      const pIdx = players.findIndex(p => p.id === item.player_id);
      if (pIdx !== -1) {
        players[pIdx].weight = item.weight;
        MockDatabase.setPlayers(players);
      }
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('player_weights')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      
      // Actualizar también el peso de la ficha principal del jugador
      await supabase
        .from('players')
        .update({ weight: item.weight })
        .eq('id', item.player_id);
        
      return data as PlayerWeight;
    }
  },

  // =====================================================================
  // HISTORIAL DE FISIOTERAPIA
  // =====================================================================
  async getPlayerPhysioRecords(playerId: string): Promise<PlayerPhysioRecord[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getPlayerPhysioRecords()
        .filter(r => r.player_id === playerId)
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } else {
      const { data, error } = await supabase
        .from('player_physio_records')
        .select('*')
        .eq('player_id', playerId)
        .order('date', { ascending: false });
      if (error) throw error;
      return data as PlayerPhysioRecord[];
    }
  },

  async createPlayerPhysioRecord(item: Omit<PlayerPhysioRecord, 'id'>): Promise<PlayerPhysioRecord> {
    if (isMockMode) {
      await delay(200);
      const list = MockDatabase.getPlayerPhysioRecords();
      const newItem: PlayerPhysioRecord = { ...item, id: `ph-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setPlayerPhysioRecords(list);
      
      // Actualizar estado de la ficha principal del jugador
      const players = MockDatabase.getPlayers();
      const pIdx = players.findIndex(p => p.id === item.player_id);
      if (pIdx !== -1) {
        players[pIdx].physical_status = item.status;
        if (item.notes) {
          players[pIdx].physio_notes = item.notes;
        }
        MockDatabase.setPlayers(players);
      }
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('player_physio_records')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      
      // Actualizar estado de la ficha principal del jugador
      await supabase
        .from('players')
        .update({ physical_status: item.status, physio_notes: item.notes })
        .eq('id', item.player_id);

      return data as PlayerPhysioRecord;
    }
  },

  // =====================================================================
  // LESIONES (PLAYER INJURIES)
  // =====================================================================
  async getPlayerInjuries(playerId: string): Promise<PlayerInjury[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getPlayerInjuries()
        .filter(i => i.player_id === playerId)
        .sort((a, b) => new Date(b.injury_date).getTime() - new Date(a.injury_date).getTime());
    } else {
      const { data, error } = await supabase
        .from('player_injuries')
        .select('*')
        .eq('player_id', playerId)
        .order('injury_date', { ascending: false });
      if (error) throw error;
      return data as PlayerInjury[];
    }
  },

  async createPlayerInjury(item: Omit<PlayerInjury, 'id'>): Promise<PlayerInjury> {
    if (isMockMode) {
      await delay(200);
      const list = MockDatabase.getPlayerInjuries();
      const newItem: PlayerInjury = { ...item, id: `inj-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setPlayerInjuries(list);
      
      // Update player's physical status in mock mode
      const players = MockDatabase.getPlayers();
      const pIdx = players.findIndex(p => p.id === item.player_id);
      if (pIdx !== -1) {
        const remaining = list.filter(x => x.player_id === item.player_id);
        const hasBaja = remaining.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));
        const hasLesionado = remaining.some(x => x.status === 'Activa');
        const hasDuda = remaining.some(x => x.status === 'En tratamiento');
        players[pIdx].physical_status = hasBaja ? 'Baja' : hasLesionado ? 'Lesionado' : hasDuda ? 'En duda' : 'Disponible';
        MockDatabase.setPlayers(players);
      }
      
      applyCompetitiveLeaveEffects(newItem);
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('player_injuries')
        .insert(item)
        .select()
        .single();
      if (error) throw error;
      
      const { data: remaining } = await supabase.from('player_injuries').select('status, competitive_leave').eq('player_id', item.player_id);
      const hasBaja = remaining?.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));
      const hasLesionado = remaining?.some(x => x.status === 'Activa');
      const hasDuda = remaining?.some(x => x.status === 'En tratamiento');
      const newStatus = hasBaja ? 'Baja' : hasLesionado ? 'Lesionado' : hasDuda ? 'En duda' : 'Disponible';
      
      await supabase
        .from('players')
        .update({ physical_status: newStatus })
        .eq('id', item.player_id);
        
      applyCompetitiveLeaveEffects(data as PlayerInjury);
      return data as PlayerInjury;
    }
  },

  async updatePlayerInjury(id: string, item: Partial<PlayerInjury>): Promise<PlayerInjury> {
    if (isMockMode) {
      await delay(200);
      const list = MockDatabase.getPlayerInjuries();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Lesión no encontrada');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setPlayerInjuries(list);
      
      // Update player's physical status in mock mode
      const playerId = list[idx].player_id;
      const players = MockDatabase.getPlayers();
      const pIdx = players.findIndex(p => p.id === playerId);
      if (pIdx !== -1) {
        const remaining = list.filter(x => x.player_id === playerId);
        const hasBaja = remaining.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));
        const hasLesionado = remaining.some(x => x.status === 'Activa');
        const hasDuda = remaining.some(x => x.status === 'En tratamiento');
        players[pIdx].physical_status = hasBaja ? 'Baja' : hasLesionado ? 'Lesionado' : hasDuda ? 'En duda' : 'Disponible';
        MockDatabase.setPlayers(players);
      }
      
      applyCompetitiveLeaveEffects(list[idx]);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('player_injuries')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      
      // Update player's physical status in real mode
      if (item.status && data) {
        const { data: remaining } = await supabase.from('player_injuries').select('status, competitive_leave').eq('player_id', data.player_id);
        const hasBaja = remaining?.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));
        const hasLesionado = remaining?.some(x => x.status === 'Activa');
        const hasDuda = remaining?.some(x => x.status === 'En tratamiento');
        const newStatus = hasBaja ? 'Baja' : hasLesionado ? 'Lesionado' : hasDuda ? 'En duda' : 'Disponible';
        
        await supabase
          .from('players')
          .update({ physical_status: newStatus })
          .eq('id', data.player_id);
      }
      
      applyCompetitiveLeaveEffects(data as PlayerInjury);
      return data as PlayerInjury;
    }
  },

  async deletePlayerInjury(id: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let list = MockDatabase.getPlayerInjuries();
      const injury = list.find(x => x.id === id);
      list = list.filter(x => x.id !== id);
      MockDatabase.setPlayerInjuries(list);

      if (injury) {
        const players = MockDatabase.getPlayers();
        const pIdx = players.findIndex(p => p.id === injury.player_id);
        if (pIdx !== -1) {
          const remaining = list.filter(x => x.player_id === injury.player_id);
          const hasBaja = remaining.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));
          const hasLesionado = remaining.some(x => x.status === 'Activa');
          const hasDuda = remaining.some(x => x.status === 'En tratamiento');
          players[pIdx].physical_status = hasBaja ? 'Baja' : hasLesionado ? 'Lesionado' : hasDuda ? 'En duda' : 'Disponible';
          MockDatabase.setPlayers(players);
        }
      }
    } else {
      const { data: injury } = await supabase.from('player_injuries').select('player_id').eq('id', id).single();
      const { error } = await supabase
        .from('player_injuries')
        .delete()
        .eq('id', id);
      if (error) throw error;

      if (injury) {
        const { data: remaining } = await supabase.from('player_injuries').select('status, competitive_leave').eq('player_id', injury.player_id);
        const hasBaja = remaining?.some(x => x.status === 'Baja' || (x.competitive_leave && x.status !== 'Recuperado'));
        const hasLesionado = remaining?.some(x => x.status === 'Activa');
        const hasDuda = remaining?.some(x => x.status === 'En tratamiento');
        const newStatus = hasBaja ? 'Baja' : hasLesionado ? 'Lesionado' : hasDuda ? 'En duda' : 'Disponible';
        
        await supabase.from('players').update({ physical_status: newStatus }).eq('id', injury.player_id);
      }
    }
  },

  // =====================================================================
  // EVENTOS SOCIALES (SOCIAL EVENTS)
  // =====================================================================
  async getSocialEvents(): Promise<SocialEvent[]> {
    if (isMockMode) {
      await delay(200);
      const list = localStorage.getItem('ud_atzeneta_social_events');
      return list ? JSON.parse(list) : [];
    } else {
      try {
        const { data, error } = await supabase
          .from('social_events')
          .select('*')
          .order('date', { ascending: false });
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205' || error.message.includes('relation "social_events" does not exist')) {
            console.warn('⚠️ La tabla "social_events" no existe en Supabase. Usando localStorage como fallback.');
            const list = localStorage.getItem('ud_atzeneta_social_events');
            return list ? JSON.parse(list) : [];
          }
          throw error;
        }
        return data as SocialEvent[];
      } catch (err) {
        console.warn('⚠️ Fallback a localStorage por error en Supabase:', err);
        const list = localStorage.getItem('ud_atzeneta_social_events');
        return list ? JSON.parse(list) : [];
      }
    }
  },

  async createSocialEvent(item: Omit<SocialEvent, 'id'>): Promise<SocialEvent> {
    if (isMockMode) {
      await delay(200);
      const listRaw = localStorage.getItem('ud_atzeneta_social_events');
      const list: SocialEvent[] = listRaw ? JSON.parse(listRaw) : [];
      const newItem: SocialEvent = { ...item, id: `se-${Date.now()}` };
      list.push(newItem);
      localStorage.setItem('ud_atzeneta_social_events', JSON.stringify(list));
      return newItem;
    } else {
      try {
        const { data, error } = await supabase
          .from('social_events')
          .insert(item)
          .select()
          .single();
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205' || error.message.includes('relation "social_events" does not exist')) {
            console.warn('⚠️ Guardando en localStorage fallback. Crea la tabla en Supabase para sincronizar.');
            const listRaw = localStorage.getItem('ud_atzeneta_social_events');
            const list: SocialEvent[] = listRaw ? JSON.parse(listRaw) : [];
            const newItem: SocialEvent = { ...item, id: `se-${Date.now()}` };
            list.push(newItem);
            localStorage.setItem('ud_atzeneta_social_events', JSON.stringify(list));
            return newItem;
          }
          throw error;
        }
        return data as SocialEvent;
      } catch (err) {
        console.warn('⚠️ Error guardando en Supabase, usando localStorage fallback:', err);
        const listRaw = localStorage.getItem('ud_atzeneta_social_events');
        const list: SocialEvent[] = listRaw ? JSON.parse(listRaw) : [];
        const newItem: SocialEvent = { ...item, id: `se-${Date.now()}` };
        list.push(newItem);
        localStorage.setItem('ud_atzeneta_social_events', JSON.stringify(list));
        return newItem;
      }
    }
  },

  async deleteSocialEvent(id: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      const listRaw = localStorage.getItem('ud_atzeneta_social_events');
      if (listRaw) {
        let list: SocialEvent[] = JSON.parse(listRaw);
        list = list.filter(x => x.id !== id);
        localStorage.setItem('ud_atzeneta_social_events', JSON.stringify(list));
      }
      return;
    } else {
      try {
        const { error } = await supabase
          .from('social_events')
          .delete()
          .eq('id', id);
        if (error) {
          if (error.code === '42P01' || error.code === 'PGRST205' || error.message.includes('relation "social_events" does not exist')) {
            const listRaw = localStorage.getItem('ud_atzeneta_social_events');
            if (listRaw) {
              let list: SocialEvent[] = JSON.parse(listRaw);
              list = list.filter(x => x.id !== id);
              localStorage.setItem('ud_atzeneta_social_events', JSON.stringify(list));
            }
            return;
          }
          throw error;
        }
      } catch (err) {
        console.warn('⚠️ Error eliminando en Supabase, usando localStorage fallback:', err);
        const listRaw = localStorage.getItem('ud_atzeneta_social_events');
        if (listRaw) {
          let list: SocialEvent[] = JSON.parse(listRaw);
          list = list.filter(x => x.id !== id);
          localStorage.setItem('ud_atzeneta_social_events', JSON.stringify(list));
        }
      }
    }
  },

  // =====================================================================
  // TAREAS DE ENTRENAMIENTO (TRAINING TASKS)
  // =====================================================================
  async getTrainingTasks(): Promise<TrainingTask[]> {
    if (isMockMode) {
      await delay(200);
      return MockDatabase.getTrainingTasks();
    } else {
      const { data, error } = await supabase
        .from('training_tasks')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') return MockDatabase.getTrainingTasks();
        throw error;
      }
      return data as TrainingTask[];
    }
  },

  async createTrainingTask(item: Omit<TrainingTask, 'id'>): Promise<TrainingTask> {
    if (isMockMode) {
      await delay(200);
      const list = MockDatabase.getTrainingTasks();
      const newItem: TrainingTask = { ...item, id: `tt-${Date.now()}` };
      list.push(newItem);
      MockDatabase.setTrainingTasks(list);
      return newItem;
    } else {
      const { data, error } = await supabase
        .from('training_tasks')
        .insert(item)
        .select()
        .single();
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
          const list = MockDatabase.getTrainingTasks();
          const newItem: TrainingTask = { ...item, id: `tt-${Date.now()}` };
          list.push(newItem);
          MockDatabase.setTrainingTasks(list);
          return newItem;
        }
        throw error;
      }
      return data as TrainingTask;
    }
  },

  async updateTrainingTask(id: string, item: Partial<TrainingTask>): Promise<TrainingTask> {
    if (isMockMode) {
      await delay(200);
      const list = MockDatabase.getTrainingTasks();
      const idx = list.findIndex(x => x.id === id);
      if (idx === -1) throw new Error('Tarea no encontrada');
      list[idx] = { ...list[idx], ...item };
      MockDatabase.setTrainingTasks(list);
      return list[idx];
    } else {
      const { data, error } = await supabase
        .from('training_tasks')
        .update(item)
        .eq('id', id)
        .select()
        .single();
      if (error) {
         if (error.code === '42P01' || error.code === 'PGRST205') {
            const list = MockDatabase.getTrainingTasks();
            const idx = list.findIndex(x => x.id === id);
            if (idx === -1) throw new Error('Tarea no encontrada');
            list[idx] = { ...list[idx], ...item };
            MockDatabase.setTrainingTasks(list);
            return list[idx];
         }
         throw error;
      }
      return data as TrainingTask;
    }
  },

  async deleteTrainingTask(id: string): Promise<void> {
    if (isMockMode) {
      await delay(200);
      let list = MockDatabase.getTrainingTasks();
      list = list.filter(x => x.id !== id);
      MockDatabase.setTrainingTasks(list);
    } else {
      const { error } = await supabase
        .from('training_tasks')
        .delete()
        .eq('id', id);
      if (error) {
         if (error.code === '42P01' || error.code === 'PGRST205') {
            let list = MockDatabase.getTrainingTasks();
            list = list.filter(x => x.id !== id);
            MockDatabase.setTrainingTasks(list);
            return;
         }
         throw error;
      }
    }
  },

  async getSessionTasksByTraining(trainingId: string): Promise<TrainingSessionTask[]> {
    if (isMockMode) {
      await delay(200);
      const sessionTasks = MockDatabase.getTrainingSessionTasks().filter(x => x.training_id === trainingId);
      const allTasks = MockDatabase.getTrainingTasks();
      
      // Poblamos la relación task
      return sessionTasks.map(st => ({
        ...st,
        task: allTasks.find(t => t.id === st.task_id)
      })).sort((a, b) => a.order_index - b.order_index);
    } else {
      const { data, error } = await supabase
        .from('training_session_tasks')
        .select('*, task:training_tasks(*)')
        .eq('training_id', trainingId)
        .order('order_index', { ascending: true });
      if (error) {
        if (error.code === '42P01' || error.code === 'PGRST205') {
           const sessionTasks = MockDatabase.getTrainingSessionTasks().filter(x => x.training_id === trainingId);
           const allTasks = MockDatabase.getTrainingTasks();
           return sessionTasks.map(st => ({
             ...st,
             task: allTasks.find(t => t.id === st.task_id)
           })).sort((a, b) => a.order_index - b.order_index);
        }
        throw error;
      }
      return data as TrainingSessionTask[];
    }
  },

  async saveSessionTasks(trainingId: string, tasks: Omit<TrainingSessionTask, 'id'>[]): Promise<TrainingSessionTask[]> {
    if (isMockMode) {
      await delay(200);
      let sessionTasks = MockDatabase.getTrainingSessionTasks();
      // Eliminar actuales de este training
      sessionTasks = sessionTasks.filter(x => x.training_id !== trainingId);
      
      // Insertar nuevos
      const newItems = tasks.map((x, idx) => ({
        ...x,
        id: `tst-${Date.now()}-${idx}`
      }));
      sessionTasks.push(...newItems);
      MockDatabase.setTrainingSessionTasks(sessionTasks);
      return newItems;
    } else {
      // En real: 1. Delete todos los del training 2. Insertar los nuevos (o usar upsert si hay id)
      // Simplificado: delete + insert
      const deleteRes = await supabase
        .from('training_session_tasks')
        .delete()
        .eq('training_id', trainingId);
        
      if (deleteRes.error && deleteRes.error.code !== '42P01' && deleteRes.error.code !== 'PGRST205') throw deleteRes.error;

      if (tasks.length === 0) return [];

      const { data, error } = await supabase
        .from('training_session_tasks')
        .insert(tasks)
        .select('*, task:training_tasks(*)');
        
      if (error) {
         if (error.code === '42P01' || error.code === 'PGRST205') {
            let sessionTasks = MockDatabase.getTrainingSessionTasks();
            sessionTasks = sessionTasks.filter(x => x.training_id !== trainingId);
            const newItems = tasks.map((x, idx) => ({
              ...x,
              id: `tst-${Date.now()}-${idx}`
            }));
            sessionTasks.push(...newItems);
            MockDatabase.setTrainingSessionTasks(sessionTasks);
            return newItems;
         }
         throw error;
      }
      return data as TrainingSessionTask[];
    }
  }
};
