// =====================================================================
// SERVICIO DEL MÓDULO "MEJORA INDIVIDUAL"
// Camino real (Supabase) + fallback ligero en localStorage para modo demo.
// La seguridad "jugador solo ve lo suyo" la garantiza RLS en la BD;
// aquí solo hablamos con Supabase, sin lógica de permisos duplicada.
// =====================================================================

import { supabase, isMockMode } from '../lib/supabase';
import { delay } from './mockData';
import {
  ImprovementAnalysis,
  ImprovementAction,
  ImprovementMessage,
  ImprovementObjective,
  ImprovementNotification,
  Match,
} from '../types';

// ---------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------

/** Temporada futbolística a partir de una fecha (jul–jun). Ej: 2026-09-10 -> '2026/27' */
export function seasonFromDate(dateStr?: string | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const year = d.getFullYear();
  const startYear = d.getMonth() >= 6 ? year : year - 1; // julio (mes 6) en adelante
  const end = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}/${end}`;
}

// --- Mini-store para modo demo (mismo prefijo que MockDatabase) ---
const MOCK_PREFIX = 'ud_atzeneta_mock_';
function mockGet<T>(key: string, def: T): T {
  try {
    const raw = localStorage.getItem(MOCK_PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : def;
  } catch {
    return def;
  }
}
function mockSet<T>(key: string, value: T): void {
  localStorage.setItem(MOCK_PREFIX + key, JSON.stringify(value));
}
const uid = (p: string) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

// ---------------------------------------------------------------------
// Servicio
// ---------------------------------------------------------------------

export const improvementService = {
  // ===================================================================
  // ANÁLISIS (cabecera + autoevaluación)
  // ===================================================================

  /** Análisis de un jugador (con el partido asociado), ordenados por fecha de partido desc. */
  async getAnalysesByPlayer(playerId: string): Promise<ImprovementAnalysis[]> {
    if (isMockMode) {
      await delay(200);
      const list = mockGet<ImprovementAnalysis[]>('ii_analyses', []).filter(a => a.player_id === playerId);
      const matches = mockGet<Match[]>('matches', []);
      return list.map(a => ({ ...a, match: matches.find(m => m.id === a.match_id) }));
    }
    const { data, error } = await supabase
      .from('improvement_analyses')
      .select('*, match:matches(*)')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ImprovementAnalysis[]) ?? [];
  },

  /** Todos los análisis (panel del entrenador). RLS ya restringe a staff. */
  async getAllAnalyses(): Promise<ImprovementAnalysis[]> {
    if (isMockMode) {
      await delay(200);
      const list = mockGet<ImprovementAnalysis[]>('ii_analyses', []);
      const matches = mockGet<Match[]>('matches', []);
      const allActions = mockGet<ImprovementAction[]>('ii_actions', []);
      return list.map(a => ({
        ...a,
        match: matches.find(m => m.id === a.match_id),
        actions: allActions.filter(ac => ac.analysis_id === a.id),
      }));
    }
    const { data, error } = await supabase
      .from('improvement_analyses')
      // actions:...(id) trae solo ids para poder contar acciones sin cargar todo
      .select('*, match:matches(*), player:players(id, full_name, nickname, photo_url, position, dorsal), actions:improvement_actions(id)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ImprovementAnalysis[]) ?? [];
  },

  /** Un análisis con sus acciones (ordenadas). */
  async getAnalysis(id: string): Promise<ImprovementAnalysis | null> {
    if (isMockMode) {
      await delay(150);
      const a = mockGet<ImprovementAnalysis[]>('ii_analyses', []).find(x => x.id === id);
      if (!a) return null;
      const matches = mockGet<Match[]>('matches', []);
      const actions = mockGet<ImprovementAction[]>('ii_actions', [])
        .filter(ac => ac.analysis_id === id)
        .sort((x, y) => x.sort_order - y.sort_order);
      return { ...a, match: matches.find(m => m.id === a.match_id), actions };
    }
    const { data, error } = await supabase
      .from('improvement_analyses')
      .select('*, match:matches(*), actions:improvement_actions(*)')
      .eq('id', id)
      .single();
    if (error) throw error;
    const a = data as ImprovementAnalysis;
    a.actions = (a.actions ?? []).sort((x, y) => x.sort_order - y.sort_order);
    return a;
  },

  /** Devuelve el análisis existente (jugador+partido) o crea uno nuevo en Borrador. */
  async getOrCreateAnalysis(playerId: string, match: Match): Promise<ImprovementAnalysis> {
    const season = seasonFromDate(match.date);

    if (isMockMode) {
      await delay(150);
      const list = mockGet<ImprovementAnalysis[]>('ii_analyses', []);
      const existing = list.find(a => a.player_id === playerId && a.match_id === match.id);
      if (existing) return { ...existing, match };
      const created: ImprovementAnalysis = {
        id: uid('iia'),
        player_id: playerId,
        match_id: match.id,
        season,
        status: 'Borrador',
        time_spent_seconds: 0,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      list.push(created);
      mockSet('ii_analyses', list);
      return { ...created, match, actions: [] };
    }

    // Real: intentar leer; si no existe, insertar.
    const { data: existing } = await supabase
      .from('improvement_analyses')
      .select('*, match:matches(*), actions:improvement_actions(*)')
      .eq('player_id', playerId)
      .eq('match_id', match.id)
      .maybeSingle();
    if (existing) {
      const a = existing as ImprovementAnalysis;
      a.actions = (a.actions ?? []).sort((x, y) => x.sort_order - y.sort_order);
      return a;
    }
    const { data, error } = await supabase
      .from('improvement_analyses')
      .insert({ player_id: playerId, match_id: match.id, season, status: 'Borrador' })
      .select('*, match:matches(*)')
      .single();
    if (error) throw error;
    return { ...(data as ImprovementAnalysis), actions: [] };
  },

  async updateAnalysis(id: string, patch: Partial<ImprovementAnalysis>): Promise<ImprovementAnalysis> {
    const clean = { ...patch, updated_at: new Date().toISOString() };
    if (isMockMode) {
      await delay(120);
      const list = mockGet<ImprovementAnalysis[]>('ii_analyses', []);
      const idx = list.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Análisis no encontrado');
      list[idx] = { ...list[idx], ...clean };
      mockSet('ii_analyses', list);
      return list[idx];
    }
    const { data, error } = await supabase
      .from('improvement_analyses')
      .update(clean)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ImprovementAnalysis;
  },

  /** Marca el análisis como Enviado y notifica al cuerpo técnico. */
  async submitAnalysis(id: string): Promise<ImprovementAnalysis> {
    const updated = await this.updateAnalysis(id, {
      status: 'Enviado',
      submitted_at: new Date().toISOString(),
    });
    // Notificar a los entrenadores/admin (Fase 2 completará el fan-out).
    try {
      await this.notifyStaff('analysis_submitted', id);
    } catch (e) {
      console.warn('No se pudo crear la notificación de envío:', e);
    }
    return updated;
  },

  async deleteAnalysis(id: string): Promise<void> {
    if (isMockMode) {
      await delay(120);
      mockSet('ii_analyses', mockGet<ImprovementAnalysis[]>('ii_analyses', []).filter(a => a.id !== id));
      mockSet('ii_actions', mockGet<ImprovementAction[]>('ii_actions', []).filter(a => a.analysis_id !== id));
      return;
    }
    const { error } = await supabase.from('improvement_analyses').delete().eq('id', id);
    if (error) throw error;
  },

  // ===================================================================
  // ACCIONES / JUGADAS
  // ===================================================================

  /** Todas las acciones (para estadísticas del cuerpo técnico). RLS restringe a staff. */
  async getAllActions(): Promise<ImprovementAction[]> {
    if (isMockMode) {
      await delay(120);
      return mockGet<ImprovementAction[]>('ii_actions', []);
    }
    const { data, error } = await supabase
      .from('improvement_actions')
      .select('id, analysis_id, action_type, result, importance, emotional_state');
    if (error) throw error;
    return (data as ImprovementAction[]) ?? [];
  },

  /** Todos los objetivos (para estadísticas del cuerpo técnico). RLS restringe a staff. */
  async getAllObjectives(): Promise<ImprovementObjective[]> {
    if (isMockMode) {
      await delay(100);
      return mockGet<ImprovementObjective[]>('ii_objectives', []);
    }
    const { data, error } = await supabase
      .from('improvement_objectives')
      .select('id, player_id, status, progress');
    if (error) throw error;
    return (data as ImprovementObjective[]) ?? [];
  },

  async getActions(analysisId: string): Promise<ImprovementAction[]> {
    if (isMockMode) {
      await delay(120);
      return mockGet<ImprovementAction[]>('ii_actions', [])
        .filter(a => a.analysis_id === analysisId)
        .sort((x, y) => x.sort_order - y.sort_order);
    }
    const { data, error } = await supabase
      .from('improvement_actions')
      .select('*')
      .eq('analysis_id', analysisId)
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return (data as ImprovementAction[]) ?? [];
  },

  async createAction(analysisId: string, patch: Partial<ImprovementAction>): Promise<ImprovementAction> {
    if (isMockMode) {
      await delay(120);
      const list = mockGet<ImprovementAction[]>('ii_actions', []);
      const siblings = list.filter(a => a.analysis_id === analysisId);
      const created: ImprovementAction = {
        id: uid('iiac'),
        analysis_id: analysisId,
        importance: 'Media',
        sort_order: siblings.length,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...patch,
      };
      list.push(created);
      mockSet('ii_actions', list);
      return created;
    }
    // sort_order = nº de acciones existentes
    const { count } = await supabase
      .from('improvement_actions')
      .select('id', { count: 'exact', head: true })
      .eq('analysis_id', analysisId);
    const { data, error } = await supabase
      .from('improvement_actions')
      .insert({ analysis_id: analysisId, importance: 'Media', sort_order: count ?? 0, ...patch })
      .select('*')
      .single();
    if (error) throw error;
    return data as ImprovementAction;
  },

  async updateAction(id: string, patch: Partial<ImprovementAction>): Promise<ImprovementAction> {
    const clean = { ...patch, updated_at: new Date().toISOString() };
    if (isMockMode) {
      await delay(100);
      const list = mockGet<ImprovementAction[]>('ii_actions', []);
      const idx = list.findIndex(a => a.id === id);
      if (idx === -1) throw new Error('Acción no encontrada');
      list[idx] = { ...list[idx], ...clean };
      mockSet('ii_actions', list);
      return list[idx];
    }
    const { data, error } = await supabase
      .from('improvement_actions')
      .update(clean)
      .eq('id', id)
      .select('*')
      .single();
    if (error) throw error;
    return data as ImprovementAction;
  },

  async deleteAction(id: string): Promise<void> {
    if (isMockMode) {
      await delay(100);
      mockSet('ii_actions', mockGet<ImprovementAction[]>('ii_actions', []).filter(a => a.id !== id));
      return;
    }
    const { error } = await supabase.from('improvement_actions').delete().eq('id', id);
    if (error) throw error;
  },

  // ===================================================================
  // CHAT POR ACCIÓN  (Fase 2 — camino base ya disponible)
  // ===================================================================

  async getMessages(actionId: string): Promise<ImprovementMessage[]> {
    if (isMockMode) {
      await delay(100);
      return mockGet<ImprovementMessage[]>('ii_messages', [])
        .filter(m => m.action_id === actionId)
        .sort((a, b) => (a.created_at || '').localeCompare(b.created_at || ''));
    }
    const { data, error } = await supabase
      .from('improvement_messages')
      .select('*, sender:profiles(id, full_name, avatar_url, role_id)')
      .eq('action_id', actionId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    return (data as ImprovementMessage[]) ?? [];
  },

  async sendMessage(actionId: string, senderId: string, body: string): Promise<ImprovementMessage> {
    if (isMockMode) {
      await delay(80);
      const list = mockGet<ImprovementMessage[]>('ii_messages', []);
      const profiles = mockGet<any[]>('profiles', []);
      const p = profiles.find(pr => pr.id === senderId);
      const msg: ImprovementMessage = {
        id: uid('iim'), action_id: actionId, sender_id: senderId, body,
        created_at: new Date().toISOString(),
        sender: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url, role_id: p.role_id } : undefined,
      };
      list.push(msg);
      mockSet('ii_messages', list);
      return msg;
    }
    const { data, error } = await supabase
      .from('improvement_messages')
      .insert({ action_id: actionId, sender_id: senderId, body })
      .select('*, sender:profiles(id, full_name, avatar_url, role_id)')
      .single();
    if (error) throw error;
    return data as ImprovementMessage;
  },

  /** Marca como leídos los mensajes de una acción que NO ha enviado el usuario actual. */
  async markMessagesRead(actionId: string, myId: string): Promise<void> {
    if (isMockMode) return;
    await supabase
      .from('improvement_messages')
      .update({ read_at: new Date().toISOString() })
      .eq('action_id', actionId)
      .neq('sender_id', myId)
      .is('read_at', null);
  },

  // ===================================================================
  // OBJETIVOS  (Fase 3)
  // ===================================================================

  async getObjectivesByPlayer(playerId: string): Promise<ImprovementObjective[]> {
    if (isMockMode) {
      await delay(100);
      return mockGet<ImprovementObjective[]>('ii_objectives', [])
        .filter(o => o.player_id === playerId)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }
    const { data, error } = await supabase
      .from('improvement_objectives')
      .select('*')
      .eq('player_id', playerId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return (data as ImprovementObjective[]) ?? [];
  },

  async createObjective(
    input: Pick<ImprovementObjective, 'player_id' | 'title'> &
      Partial<Pick<ImprovementObjective, 'description' | 'target_date' | 'progress' | 'status' | 'created_by'>>,
  ): Promise<ImprovementObjective> {
    if (isMockMode) {
      await delay(120);
      const list = mockGet<ImprovementObjective[]>('ii_objectives', []);
      const obj: ImprovementObjective = {
        id: uid('iio'),
        progress: 0,
        status: 'Activo',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        ...input,
      } as ImprovementObjective;
      list.push(obj);
      mockSet('ii_objectives', list);
      return obj;
    }
    const { data, error } = await supabase
      .from('improvement_objectives')
      .insert(input)
      .select('*')
      .single();
    if (error) throw error;

    // Notificar al jugador (best-effort)
    try {
      const { data: pl } = await supabase
        .from('players').select('profile_id').eq('id', input.player_id).single();
      const recipientId = (pl as any)?.profile_id;
      if (recipientId) {
        await supabase.from('improvement_notifications').insert({
          recipient_id: recipientId,
          actor_id: input.created_by ?? null,
          type: 'objective_assigned',
          message: input.title,
        });
      }
    } catch (e) {
      console.warn('No se pudo notificar el objetivo:', e);
    }
    return data as ImprovementObjective;
  },

  async updateObjective(id: string, patch: Partial<ImprovementObjective>): Promise<ImprovementObjective> {
    const clean = { ...patch, updated_at: new Date().toISOString() };
    if (isMockMode) {
      await delay(100);
      const list = mockGet<ImprovementObjective[]>('ii_objectives', []);
      const idx = list.findIndex(o => o.id === id);
      if (idx === -1) throw new Error('Objetivo no encontrado');
      list[idx] = { ...list[idx], ...clean };
      mockSet('ii_objectives', list);
      return list[idx];
    }
    const { data, error } = await supabase
      .from('improvement_objectives')
      .update(clean).eq('id', id).select('*').single();
    if (error) throw error;
    return data as ImprovementObjective;
  },

  async deleteObjective(id: string): Promise<void> {
    if (isMockMode) {
      await delay(100);
      mockSet('ii_objectives', mockGet<ImprovementObjective[]>('ii_objectives', []).filter(o => o.id !== id));
      return;
    }
    const { error } = await supabase.from('improvement_objectives').delete().eq('id', id);
    if (error) throw error;
  },

  // ===================================================================
  // NOTIFICACIONES  (Fase 2)
  // ===================================================================

  async getMyNotifications(recipientId: string): Promise<ImprovementNotification[]> {
    if (isMockMode) {
      await delay(80);
      return mockGet<ImprovementNotification[]>('ii_notifs', [])
        .filter(n => n.recipient_id === recipientId)
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
    }
    const { data, error } = await supabase
      .from('improvement_notifications')
      .select('*')
      .eq('recipient_id', recipientId)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return (data as ImprovementNotification[]) ?? [];
  },

  /** Crea una notificación para todos los miembros del cuerpo técnico (admin/trainer). */
  async notifyStaff(
    type: ImprovementNotification['type'],
    analysisId: string,
  ): Promise<void> {
    if (isMockMode) return; // sin fan-out en demo
    const { data: staff } = await supabase
      .from('profiles')
      .select('id')
      .in('role_id', [1, 2]);
    if (!staff?.length) return;
    const rows = staff.map((s: { id: string }) => ({
      recipient_id: s.id,
      type,
      analysis_id: analysisId,
    }));
    await supabase.from('improvement_notifications').insert(rows);
  },

  /**
   * Notifica al jugador dueño del análisis (p. ej. cuando el entrenador responde
   * en el chat o revisa el análisis). Resuelve action_id -> analysis -> player.profile_id.
   */
  async notifyAnalysisOwner(
    type: ImprovementNotification['type'],
    opts: { analysisId?: string; actionId?: string; actorId?: string; message?: string },
  ): Promise<void> {
    if (isMockMode) return;
    let analysisId = opts.analysisId;

    // Si venimos de una acción, resolvemos su análisis
    if (!analysisId && opts.actionId) {
      const { data: ac } = await supabase
        .from('improvement_actions')
        .select('analysis_id')
        .eq('id', opts.actionId)
        .single();
      analysisId = ac?.analysis_id;
    }
    if (!analysisId) return;

    // análisis -> jugador -> profile_id
    const { data: a } = await supabase
      .from('improvement_analyses')
      .select('id, player:players(profile_id)')
      .eq('id', analysisId)
      .single();
    const recipientId = (a as any)?.player?.profile_id;
    if (!recipientId) return;

    // No notificarse a uno mismo
    if (recipientId === opts.actorId) return;

    await supabase.from('improvement_notifications').insert({
      recipient_id: recipientId,
      actor_id: opts.actorId ?? null,
      type,
      analysis_id: analysisId,
      action_id: opts.actionId ?? null,
      message: opts.message ?? null,
    });
  },

  async markNotificationRead(id: string): Promise<void> {
    if (isMockMode) return;
    await supabase.from('improvement_notifications')
      .update({ read_at: new Date().toISOString() }).eq('id', id);
  },

  async markAllNotificationsRead(recipientId: string): Promise<void> {
    if (isMockMode) return;
    await supabase.from('improvement_notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('recipient_id', recipientId)
      .is('read_at', null);
  },
};
