import { supabase, isMockMode } from '../lib/supabase';
import { MockDatabase, delay } from './mockData';
import { Training, Match, Fine, PointLog, ScoutingPlayer, OpponentAnalysis, Settings, TrainingAttendance, TacticalBoard } from '../types';

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

  // =====================================================================
  // PARTIDOS (MATCHES)
  // =====================================================================
  async getMatches(): Promise<Match[]> {
    if (isMockMode) {
      await delay(300);
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

  async deleteMatch(id: string): Promise<void> {
    if (isMockMode) {
      await delay(300);
      let list = MockDatabase.getMatches();
      list = list.filter(x => x.id !== id);
      MockDatabase.setMatches(list);
    } else {
      const { error } = await supabase
        .from('matches')
        .delete()
        .eq('id', id);
      if (error) throw error;
    }
  },

  async upsertMatches(items: Omit<Match, 'id'>[]): Promise<Match[]> {
    if (isMockMode) {
      await delay(300);
      const list = MockDatabase.getMatches();
      const updatedList = [...list];
      const results: Match[] = [];

      for (const item of items) {
        // Buscar coincidencia por fecha y rival
        const existingIdx = updatedList.findIndex(
          m => m.date === item.date && m.rival.toLowerCase() === item.rival.toLowerCase()
        );
        if (existingIdx !== -1) {
          updatedList[existingIdx] = { ...updatedList[existingIdx], ...item };
          results.push(updatedList[existingIdx]);
        } else {
          const newItem: Match = { ...item, id: `m-${Date.now()}-${Math.random()}` };
          updatedList.push(newItem);
          results.push(newItem);
        }
      }

      MockDatabase.setMatches(updatedList);
      return results;
    } else {
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
      return fines.map(f => ({
        ...f,
        profiles: profiles.find(p => p.id === f.user_id)
      })).sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    } else {
      const { data, error } = await supabase
        .from('fines')
        .select('*, profiles(*)')
        .order('date', { ascending: false });
      if (error) throw error;
      return data as Fine[];
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
      const { data, error } = await supabase
        .from('scouting')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as ScoutingPlayer[];
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
      const { data, error } = await supabase
        .from('scouting')
        .insert(item)
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
  async getAttendanceByTraining(trainingId: string): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(300);
      const attendance = MockDatabase.getTrainingAttendance();
      const profiles = MockDatabase.getProfiles();
      return attendance
        .filter(x => x.training_id === trainingId)
        .map(a => ({
          ...a,
          profiles: profiles.find(p => p.id === a.user_id)
        }));
    } else {
      const { data, error } = await supabase
        .from('training_attendance')
        .select('*, profiles(*)')
        .eq('training_id', trainingId);
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
        .filter(x => trainingIds.includes(x.training_id))
        .map(a => ({
          ...a,
          profiles: profiles.find(p => p.id === a.user_id)
        }));
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
        .select('*, profiles(*)')
        .in('training_id', trainingIds);

      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async saveAttendanceList(trainingId: string, attendanceList: Omit<TrainingAttendance, 'id'>[]): Promise<TrainingAttendance[]> {
    if (isMockMode) {
      await delay(300);
      let attendance = MockDatabase.getTrainingAttendance();
      // Borrar registros viejos para esta sesión
      attendance = attendance.filter(x => x.training_id !== trainingId);

      const newItems = attendanceList.map((x, idx) => ({
        ...x,
        id: `att-${Date.now()}-${idx}`
      }));
      attendance.push(...newItems);
      MockDatabase.setTrainingAttendance(attendance);

      const profiles = MockDatabase.getProfiles();
      return newItems.map(a => ({
        ...a,
        profiles: profiles.find(p => p.id === a.user_id)
      }));
    } else {
      const itemsToUpsert = attendanceList.map(item => ({
        training_id: item.training_id,
        user_id: item.user_id,
        status: item.status,
        observations: item.observations
      }));

      const { data, error } = await supabase
        .from('training_attendance')
        .upsert(itemsToUpsert, { onConflict: 'training_id,user_id' })
        .select('*, profiles(*)');

      if (error) throw error;
      return data as TrainingAttendance[];
    }
  },

  async updateAttendance(trainingId: string, userId: string, status: any, observations?: string): Promise<TrainingAttendance> {
    if (isMockMode) {
      await delay(200);
      const attendance = MockDatabase.getTrainingAttendance();
      const idx = attendance.findIndex(x => x.training_id === trainingId && x.user_id === userId);
      
      let updatedItem: TrainingAttendance;
      if (idx !== -1) {
        attendance[idx] = { ...attendance[idx], status, observations };
        updatedItem = attendance[idx];
      } else {
        updatedItem = {
          id: `att-${Date.now()}`,
          training_id: trainingId,
          user_id: userId,
          status,
          observations
        };
        attendance.push(updatedItem);
      }
      MockDatabase.setTrainingAttendance(attendance);

      const profiles = MockDatabase.getProfiles();
      return {
        ...updatedItem,
        profiles: profiles.find(p => p.id === userId)
      };
    } else {
      const { data, error } = await supabase
        .from('training_attendance')
        .upsert(
          { training_id: trainingId, user_id: userId, status, observations },
          { onConflict: 'training_id,user_id' }
        )
        .select('*, profiles(*)')
        .single();

      if (error) throw error;
      return data as TrainingAttendance;
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
  }
};
