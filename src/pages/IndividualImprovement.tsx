import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  TrendingUp, Plus, ChevronLeft, ChevronRight, Trash2, Send, Save,
  ClipboardList, Star, MessageSquare, Clock, Loader2, Film, Bell, Check,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts';
import { Modal } from '../components/Modal';
import { TaskBoardEditor } from '../components/TaskBoardEditor';
import { supabase, isMockMode } from '../lib/supabase';
import { dataService } from '../services/data';
import { improvementService, seasonFromDate } from '../services/improvement';
import {
  Match, Player,
  ImprovementAnalysis, ImprovementAction, ImprovementStatus,
  ImprovementActionType, ImprovementResult, ImprovementImportance, ImprovementHalf,
  ImprovementMessage, ImprovementNotification, ImprovementObjective,
  EMOTIONAL_STATES,
} from '../types';

const NOTIF_LABEL: Record<ImprovementNotification['type'], string> = {
  analysis_submitted: 'Nuevo análisis enviado',
  coach_replied: 'El entrenador ha respondido',
  objective_assigned: 'Nuevo objetivo asignado',
  analysis_reviewed: 'Tu análisis ha sido revisado',
};

// ---------------------------------------------------------------------
// Constantes de UI
// ---------------------------------------------------------------------
const ACTION_TYPES: ImprovementActionType[] = [
  'Ataque', 'Defensa', 'Transición', 'ABP', 'Duelo', 'Pase',
  'Finalización', 'Presión', 'Cobertura', 'Otro',
];
const RESULTS: ImprovementResult[] = ['Positivo', 'Negativo', 'Mejorable'];
const IMPORTANCES: ImprovementImportance[] = ['Alta', 'Media', 'Baja'];
const HALVES: ImprovementHalf[] = ['Primera parte', 'Segunda parte', 'Prórroga'];

const STATUS_STYLES: Record<ImprovementStatus, string> = {
  Borrador:   'bg-brand-gray-dark/20 text-brand-gray-muted border-brand-black-border',
  Enviado:    'bg-blue-500/10 text-blue-400 border-blue-500/30',
  Revisado:   'bg-amber-500/10 text-amber-400 border-amber-500/30',
  Comentado:  'bg-purple-500/10 text-purple-400 border-purple-500/30',
  Finalizado: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
};

const RESULT_STYLES: Record<ImprovementResult, string> = {
  Positivo:  'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  Negativo:  'bg-brand-red-600/15 text-brand-red-400 border-brand-red-600/40',
  Mejorable: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
};

function matchLabel(m?: Match): string {
  if (!m) return 'Partido';
  const us = 'UD Atzeneta';
  return m.is_local ? `${us} vs ${m.rival}` : `${m.rival} vs ${us}`;
}

// =====================================================================
// COMPONENTE PRINCIPAL
// =====================================================================
type ViewMode = 'list' | 'select-match' | 'detail' | 'player';

export const IndividualImprovement: React.FC = () => {
  const { user, roleSlug } = useAuth();
  const { showToast } = useToast();
  const isStaff = roleSlug === 'admin' || roleSlug === 'trainer';

  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<ViewMode>('list');
  const [backView, setBackView] = useState<ViewMode>('list'); // a dónde vuelve el detalle
  const [me, setMe] = useState<Player | null>(null);
  const [matches, setMatches] = useState<Match[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [analyses, setAnalyses] = useState<ImprovementAnalysis[]>([]);
  const [current, setCurrent] = useState<ImprovementAnalysis | null>(null);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [staffTab, setStaffTab] = useState<'players' | 'stats'>('players');

  const [filterTeam, setFilterTeam] = useState(user?.team_category || 'Primer Equipo');

  useEffect(() => {
    if (user?.team_category) {
      setFilterTeam(user.team_category);
    }
  }, [user?.team_category]);

  const filteredPlayers = players.filter(p => (p.team_category || 'Primer Equipo') === filterTeam);
  const filteredAnalyses = analyses.filter(a => {
    const p = players.find(player => player.id === a.player_id);
    return p && (p.team_category || 'Primer Equipo') === filterTeam;
  });

  // Carga inicial
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [allPlayers, allMatches] = await Promise.all([
          dataService.getPlayers(),
          dataService.getMatches(),
        ]);
        setMatches(allMatches);
        setPlayers(allPlayers);

        if (isStaff) {
          setAnalyses(await improvementService.getAllAnalyses());
        } else {
          const mine = allPlayers.find(p => p.profile_id === user?.id) || null;
          setMe(mine);
          if (mine) setAnalyses(await improvementService.getAnalysesByPlayer(mine.id));
        }
      } catch (e) {
        console.error(e);
        showToast('error', 'Error', 'No se pudieron cargar los análisis.');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, isStaff]);

  const reloadList = async () => {
    if (isStaff) setAnalyses(await improvementService.getAllAnalyses());
    else if (me) setAnalyses(await improvementService.getAnalysesByPlayer(me.id));
  };

  const openAnalysis = async (id: string, from: ViewMode = 'list') => {
    const full = await improvementService.getAnalysis(id);
    if (full) {
      setBackView(from);
      setCurrent(full);
      setView('detail');
    }
  };

  const openPlayer = (p: Player) => {
    setSelectedPlayer(p);
    setView('player');
  };

  const startForMatch = async (match: Match) => {
    if (!me) return;
    try {
      const a = await improvementService.getOrCreateAnalysis(me.id, match);
      const full = await improvementService.getAnalysis(a.id);
      setCurrent(full || a);
      setView('detail');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'No se pudo iniciar el análisis.');
    }
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-brand-red-600 animate-spin" />
      </div>
    );
  }

  // Jugador sin ficha vinculada
  if (!isStaff && !me) {
    return (
      <div className="max-w-2xl mx-auto mt-10 p-6 bg-brand-black-card border border-brand-black-border rounded-xl text-center">
        <TrendingUp className="w-8 h-8 text-brand-gray-muted mx-auto mb-3" />
        <h2 className="text-white font-semibold mb-1">Sin ficha de jugador</h2>
        <p className="text-sm text-brand-gray-muted">
          Tu usuario no está vinculado a ninguna ficha de jugador. Pide al cuerpo técnico que
          asocie tu perfil en la sección de Jugadores.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto pb-16">
      {/* Barra superior con la campana de notificaciones */}
      <div className="flex justify-end mb-2">
        {user?.id && <NotificationBell userId={user.id} onOpenAnalysis={openAnalysis} />}
      </div>

      {/* Pestañas de Equipo (solo para staff) */}
      {isStaff && (user?.role_id === 1 || user?.role_id === 4 || (user?.role_id === 2 && user?.team_category === 'Primer Equipo')) && (
        <div className="flex bg-brand-black-card border-b border-brand-black-border mb-6 mt-2">
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${filterTeam === 'Primer Equipo' ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
            onClick={() => setFilterTeam('Primer Equipo')}
          >
            Primer Equipo
          </button>
          <button 
            className={`px-4 py-3 text-sm font-bold border-b-2 transition-colors ${filterTeam === 'Juvenil' ? 'border-brand-red-600 text-brand-red-600' : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'}`}
            onClick={() => setFilterTeam('Juvenil')}
          >
            Juvenil
          </button>
        </div>
      )}

      {view === 'list' && isStaff && (
        <div>
          <div className="flex gap-1 mb-5 p-1 bg-brand-black-card border border-brand-black-border rounded-lg w-fit">
            {(['players', 'stats'] as const).map(t => (
              <button
                key={t}
                onClick={() => setStaffTab(t)}
                className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  staffTab === t ? 'bg-brand-red-600 text-white' : 'text-brand-gray-muted hover:text-white'
                }`}
              >{t === 'players' ? 'Jugadores' : 'Estadísticas'}</button>
            ))}
          </div>

          {staffTab === 'players' ? (
            <CoachPanel
              players={filteredPlayers}
              analyses={filteredAnalyses}
              onOpenPlayer={openPlayer}
              onOpenAnalysis={(id) => openAnalysis(id, 'list')}
              currentUserId={user?.id || ''}
            />
          ) : (
            <CoachStats players={filteredPlayers} analyses={filteredAnalyses} />
          )}
        </div>
      )}

      {view === 'list' && !isStaff && (
        <>
          <AnalysisList
            isStaff={false}
            analyses={analyses}
            onOpen={(id) => openAnalysis(id, 'list')}
            onNew={() => setView('select-match')}
          />
          {me && <PlayerObjectives playerId={me.id} />}
        </>
      )}

      {view === 'player' && selectedPlayer && (
        <CoachPlayerView
          player={selectedPlayer}
          analyses={analyses.filter(a => a.player_id === selectedPlayer.id)}
          currentUserId={user?.id || ''}
          onOpenAnalysis={(id) => openAnalysis(id, 'player')}
          onBack={() => { setView('list'); setSelectedPlayer(null); }}
        />
      )}

      {view === 'select-match' && (
        <MatchSelector
          matches={matches}
          existing={analyses}
          onBack={() => setView('list')}
          onPick={startForMatch}
        />
      )}

      {view === 'detail' && current && (
        <AnalysisDetail
          analysis={current}
          readOnly={isStaff}
          isStaff={isStaff}
          currentUserId={user?.id || ''}
          onBack={async () => { await reloadList(); setView(backView); setCurrent(null); }}
          onChange={setCurrent}
        />
      )}
    </div>
  );
};

// =====================================================================
// LISTA / PANEL
// =====================================================================
const AnalysisList: React.FC<{
  isStaff: boolean;
  analyses: ImprovementAnalysis[];
  onOpen: (id: string) => void;
  onNew: () => void;
}> = ({ isStaff, analyses, onOpen, onNew }) => {
  const [q, setQ] = useState('');
  const [statusFilter, setStatusFilter] = useState<'' | ImprovementStatus>('');

  const filtered = useMemo(() => {
    return analyses.filter(a => {
      if (statusFilter && a.status !== statusFilter) return false;
      if (!q) return true;
      const hay = `${matchLabel(a.match)} ${a.player?.full_name || ''} ${a.season || ''}`.toLowerCase();
      return hay.includes(q.toLowerCase());
    });
  }, [analyses, q, statusFilter]);

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-brand-red-600" />
            Mejora Individual
          </h1>
          <p className="text-sm text-brand-gray-muted mt-0.5">
            {isStaff
              ? 'Análisis de autoevaluación de todos los jugadores.'
              : 'Analiza tu rendimiento partido a partido y mejora con el feedback del entrenador.'}
          </p>
        </div>
        {!isStaff && (
          <button
            onClick={onNew}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-red-600 hover:bg-brand-red-700 text-white text-sm font-semibold transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuevo análisis
          </button>
        )}
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap gap-2 mb-4">
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Buscar por partido, jugador, temporada…"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg bg-brand-black-card border border-brand-black-border text-sm text-white placeholder:text-brand-gray-dark focus:outline-none focus:border-brand-red-600/50"
        />
        <select
          value={statusFilter}
          onChange={e => setStatusFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-brand-black-card border border-brand-black-border text-sm text-white focus:outline-none focus:border-brand-red-600/50"
        >
          <option value="">Todos los estados</option>
          {(Object.keys(STATUS_STYLES) as ImprovementStatus[]).map(s => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="p-10 text-center bg-brand-black-card border border-brand-black-border rounded-xl">
          <ClipboardList className="w-8 h-8 text-brand-gray-dark mx-auto mb-3" />
          <p className="text-sm text-brand-gray-muted">
            {isStaff ? 'Aún no hay análisis enviados por los jugadores.' : 'Todavía no has creado ningún análisis.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-3">
          {filtered.map(a => (
            <button
              key={a.id}
              onClick={() => onOpen(a.id)}
              className="group flex items-center gap-4 p-4 rounded-xl bg-brand-black-card border border-brand-black-border hover:border-brand-red-600/40 hover:bg-brand-black-hover transition-all text-left"
            >
              <div className="w-11 h-11 rounded-lg bg-brand-black-bg border border-brand-black-border flex items-center justify-center shrink-0">
                <TrendingUp className="w-5 h-5 text-brand-red-600" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-white font-semibold truncate">{matchLabel(a.match)}</span>
                  <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                </div>
                <div className="text-xs text-brand-gray-muted mt-0.5 flex items-center gap-3 flex-wrap">
                  {isStaff && a.player && <span className="text-brand-gray-light">{a.player.nickname || a.player.full_name} {a.player.dorsal != null ? `(${a.player.dorsal})` : ''}</span>}
                  {a.match?.date && <span>{new Date(a.match.date).toLocaleDateString('es-ES')}</span>}
                  {a.season && <span>Temp. {a.season}</span>}
                  {typeof a.rating_match === 'number' && (
                    <span className="inline-flex items-center gap-1"><Star className="w-3 h-3" />{a.rating_match}/10</span>
                  )}
                </div>
              </div>
              <ChevronRight className="w-5 h-5 text-brand-gray-dark group-hover:text-brand-red-600 transition-colors shrink-0" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// SELECTOR DE PARTIDO (Temporada -> Jornada/Partido)
// =====================================================================
const MatchSelector: React.FC<{
  matches: Match[];
  existing: ImprovementAnalysis[];
  onBack: () => void;
  onPick: (m: Match) => void;
}> = ({ matches, existing, onBack, onPick }) => {
  // Solo partidos jugados tienen sentido para analizar
  const played = useMemo(
    () => matches
      .filter(m => m.status === 'Jugado' || (m.score_us != null && m.score_them != null))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [matches],
  );

  const seasons = useMemo(() => {
    const set = new Set(played.map(m => seasonFromDate(m.date)).filter(Boolean));
    return Array.from(set).sort().reverse();
  }, [played]);

  const [season, setSeason] = useState<string>('');
  useEffect(() => { if (seasons.length && !season) setSeason(seasons[0]); }, [seasons, season]);

  const seasonMatches = played.filter(m => seasonFromDate(m.date) === season);
  const doneIds = new Set(existing.map(e => e.match_id));

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-brand-gray-muted hover:text-white mb-4">
        <ChevronLeft className="w-4 h-4" /> Volver
      </button>
      <h1 className="text-xl font-bold text-white mb-1">Elige el partido a analizar</h1>
      <p className="text-sm text-brand-gray-muted mb-5">Selecciona la temporada y el partido.</p>

      {seasons.length > 1 && (
        <div className="flex gap-2 mb-4 flex-wrap">
          {seasons.map(s => (
            <button
              key={s}
              onClick={() => setSeason(s)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                season === s
                  ? 'bg-brand-red-600 border-brand-red-600 text-white'
                  : 'bg-brand-black-card border-brand-black-border text-brand-gray-muted hover:text-white'
              }`}
            >Temp. {s}</button>
          ))}
        </div>
      )}

      {seasonMatches.length === 0 ? (
        <div className="p-8 text-center bg-brand-black-card border border-brand-black-border rounded-xl text-sm text-brand-gray-muted">
          No hay partidos jugados en esta temporada.
        </div>
      ) : (
        <div className="grid gap-2">
          {seasonMatches.map(m => {
            const done = doneIds.has(m.id);
            return (
              <button
                key={m.id}
                onClick={() => onPick(m)}
                className="flex items-center gap-4 p-3.5 rounded-xl bg-brand-black-card border border-brand-black-border hover:border-brand-red-600/40 transition-all text-left"
              >
                <div className="text-center shrink-0 w-16">
                  <div className="text-[11px] text-brand-gray-dark uppercase">{m.competition}</div>
                  {m.matchday && <div className="text-xs text-brand-gray-muted">J{m.matchday}</div>}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-white font-medium truncate">{matchLabel(m)}</div>
                  <div className="text-xs text-brand-gray-muted">
                    {new Date(m.date).toLocaleDateString('es-ES')}
                    {m.score_us != null && m.score_them != null && (
                      <span className="ml-2 text-brand-gray-light font-semibold">
                        {m.is_local ? `${m.score_us}-${m.score_them}` : `${m.score_them}-${m.score_us}`}
                      </span>
                    )}
                  </div>
                </div>
                {done
                  ? <span className="text-[11px] px-2 py-0.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-emerald-400 shrink-0">Continuar</span>
                  : <ChevronRight className="w-5 h-5 text-brand-gray-dark shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// DETALLE / EDITOR DEL ANÁLISIS
// =====================================================================
const RatingRow: React.FC<{
  label: string;
  value?: number | null;
  disabled?: boolean;
  onChange: (v: number) => void;
}> = ({ label, value, disabled, onChange }) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="text-sm text-brand-gray-light">{label}</span>
    <div className="flex gap-1">
      {Array.from({ length: 10 }, (_, i) => i + 1).map(n => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          onClick={() => onChange(n)}
          className={`w-7 h-7 rounded-md text-xs font-semibold transition-colors ${
            value === n
              ? 'bg-brand-red-600 text-white'
              : 'bg-brand-black-bg border border-brand-black-border text-brand-gray-muted hover:border-brand-red-600/40 disabled:hover:border-brand-black-border'
          } disabled:opacity-60`}
        >{n}</button>
      ))}
    </div>
  </div>
);

const Field: React.FC<{ label: string; children: React.ReactNode }> = ({ label, children }) => (
  <label className="block">
    <span className="text-xs font-medium text-brand-gray-muted uppercase tracking-wide">{label}</span>
    <div className="mt-1">{children}</div>
  </label>
);

const inputCls =
  'w-full px-3 py-2 rounded-lg bg-brand-black-bg border border-brand-black-border text-sm text-white placeholder:text-brand-gray-dark focus:outline-none focus:border-brand-red-600/50 disabled:opacity-60';

const AnalysisDetail: React.FC<{
  analysis: ImprovementAnalysis;
  readOnly: boolean;
  isStaff: boolean;
  currentUserId: string;
  onBack: () => void;
  onChange: (a: ImprovementAnalysis) => void;
}> = ({ analysis, readOnly, isStaff, currentUserId, onBack, onChange }) => {
  const { showToast } = useToast();
  const [saving, setSaving] = useState(false);
  const [actions, setActions] = useState<ImprovementAction[]>(analysis.actions || []);
  const [editingAction, setEditingAction] = useState<ImprovementAction | null>(null);
  const [showActionModal, setShowActionModal] = useState(false);
  const startedAt = useMemo(() => Date.now(), []);

  // Estado local del cuestionario
  const [form, setForm] = useState({
    rating_match: analysis.rating_match ?? null,
    rating_physical: analysis.rating_physical ?? null,
    rating_mental: analysis.rating_mental ?? null,
    rating_concentration: analysis.rating_concentration ?? null,
    rating_communication: analysis.rating_communication ?? null,
    did_well: analysis.did_well ?? '',
    to_improve: analysis.to_improve ?? '',
    next_goal: analysis.next_goal ?? '',
    coach_rating: analysis.coach_rating ?? null,
  });

  const setF = (patch: Partial<typeof form>) => setForm(prev => ({ ...prev, ...patch }));

  const persist = async (extra?: Partial<ImprovementAnalysis>) => {
    const elapsed = Math.round((Date.now() - startedAt) / 1000);
    const patch: Partial<ImprovementAnalysis> = {
      ...form,
      time_spent_seconds: (analysis.time_spent_seconds || 0) + elapsed,
      ...extra,
    };
    const updated = await improvementService.updateAnalysis(analysis.id, patch);
    onChange({ ...analysis, ...updated, actions });
    return updated;
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      await persist();
      showToast('success', 'Guardado', 'Tu análisis se ha guardado.');
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'No se pudo guardar.');
    } finally { setSaving(false); }
  };

  const handleSubmit = async () => {
    try {
      setSaving(true);
      await persist();
      await improvementService.submitAnalysis(analysis.id);
      showToast('success', 'Enviado', 'El entrenador ha recibido tu análisis.');
      onBack();
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'No se pudo enviar.');
    } finally { setSaving(false); }
  };

  const handleSaveCoachRating = async () => {
    try {
      setSaving(true);
      await improvementService.updateAnalysis(analysis.id, {
        coach_rating: form.coach_rating,
        status: 'Revisado',
        reviewed_at: new Date().toISOString(),
      });
      showToast('success', 'Guardado', 'Valoración registrada.');
      onBack();
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'No se pudo guardar la valoración.');
    } finally { setSaving(false); }
  };

  // ---- Acciones ----
  const openNewAction = () => { setEditingAction(null); setShowActionModal(true); };
  const openEditAction = (a: ImprovementAction) => { setEditingAction(a); setShowActionModal(true); };

  const saveAction = async (patch: Partial<ImprovementAction>) => {
    try {
      if (editingAction) {
        const upd = await improvementService.updateAction(editingAction.id, patch);
        setActions(prev => prev.map(a => (a.id === upd.id ? upd : a)));
      } else {
        const created = await improvementService.createAction(analysis.id, patch);
        setActions(prev => [...prev, created]);
      }
      setShowActionModal(false);
      setEditingAction(null);
    } catch (e: any) {
      console.error(e);
      showToast('error', 'Error', `No se pudo guardar la acción: ${e.message || 'Error desconocido'}`);
    }
  };

  const removeAction = async (id: string) => {
    try {
      await improvementService.deleteAction(id);
      setActions(prev => prev.filter(a => a.id !== id));
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'No se pudo eliminar.');
    }
  };

  const disabled = readOnly;

  return (
    <div>
      {/* Cabecera */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div>
          <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-brand-gray-muted hover:text-white mb-2">
            <ChevronLeft className="w-4 h-4" /> Volver
          </button>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            {matchLabel(analysis.match)}
            <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[analysis.status]}`}>{analysis.status}</span>
          </h1>
          <div className="text-xs text-brand-gray-muted mt-1 flex items-center gap-3">
            {analysis.match?.date && <span>{new Date(analysis.match.date).toLocaleDateString('es-ES')}</span>}
            {analysis.season && <span>Temp. {analysis.season}</span>}
            {readOnly && analysis.player && <span className="text-brand-gray-light">{analysis.player.nickname || analysis.player.full_name} {analysis.player.dorsal != null ? `(${analysis.player.dorsal})` : ''}</span>}
          </div>
        </div>
        {!readOnly && (
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-black-card border border-brand-black-border text-white text-sm font-medium hover:bg-brand-black-hover disabled:opacity-60">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar
            </button>
            <button onClick={handleSubmit} disabled={saving}
              className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-red-600 hover:bg-brand-red-700 text-white text-sm font-semibold disabled:opacity-60">
              <Send className="w-4 h-4" /> Enviar al entrenador
            </button>
          </div>
        )}
      </div>

      {/* Cuestionario de autoevaluación */}
      <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 mb-5">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <Star className="w-4 h-4 text-brand-red-600" /> Autoevaluación del partido
        </h2>
        <div className="divide-y divide-brand-black-border">
          <RatingRow label="¿Cómo valoras tu partido?" value={form.rating_match} disabled={disabled} onChange={v => setF({ rating_match: v })} />
          <RatingRow label="¿Cómo te has sentido físicamente?" value={form.rating_physical} disabled={disabled} onChange={v => setF({ rating_physical: v })} />
          <RatingRow label="¿Cómo te has sentido mentalmente?" value={form.rating_mental} disabled={disabled} onChange={v => setF({ rating_mental: v })} />
          <RatingRow label="¿Cómo valoras tu concentración?" value={form.rating_concentration} disabled={disabled} onChange={v => setF({ rating_concentration: v })} />
          <RatingRow label="¿Cómo valoras tu comunicación?" value={form.rating_communication} disabled={disabled} onChange={v => setF({ rating_communication: v })} />
        </div>
        <div className="grid md:grid-cols-3 gap-3 mt-4">
          <Field label="¿Qué hiciste mejor?">
            <textarea rows={3} disabled={disabled} className={inputCls} value={form.did_well} onChange={e => setF({ did_well: e.target.value })} />
          </Field>
          <Field label="¿Qué debes mejorar?">
            <textarea rows={3} disabled={disabled} className={inputCls} value={form.to_improve} onChange={e => setF({ to_improve: e.target.value })} />
          </Field>
          <Field label="Objetivo siguiente partido">
            <textarea rows={3} disabled={disabled} className={inputCls} value={form.next_goal} onChange={e => setF({ next_goal: e.target.value })} />
          </Field>
        </div>

        {/* Valoración del entrenador (solo staff) */}
        {readOnly && (
          <div className="mt-5 pt-4 border-t border-brand-black-border">
            <RatingRow label="Tu valoración como entrenador (1-10)" value={form.coach_rating} onChange={v => setF({ coach_rating: v })} />
            <div className="flex justify-end mt-2">
              <button onClick={handleSaveCoachRating} disabled={saving}
                className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg bg-brand-red-600 hover:bg-brand-red-700 text-white text-sm font-semibold disabled:opacity-60">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Guardar valoración
              </button>
            </div>
          </div>
        )}
      </section>

      {/* Acciones / jugadas */}
      <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-white font-semibold flex items-center gap-2">
            <ClipboardList className="w-4 h-4 text-brand-red-600" /> Jugadas analizadas
            <span className="text-xs text-brand-gray-dark">({actions.length})</span>
          </h2>
          {!readOnly && (
            <button onClick={openNewAction}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-black-bg border border-brand-black-border text-white text-sm hover:border-brand-red-600/40">
              <Plus className="w-4 h-4" /> Añadir jugada
            </button>
          )}
        </div>

        {actions.length === 0 ? (
          <p className="text-sm text-brand-gray-muted py-6 text-center">Aún no has añadido ninguna jugada.</p>
        ) : (
          <div className="grid gap-2">
            {actions.map((a, i) => (
              <div key={a.id} className="p-3.5 rounded-lg bg-brand-black-bg hover:bg-brand-black-hover border border-brand-black-border cursor-pointer transition-colors" onClick={() => openEditAction(a)}>
                <div className="flex items-start gap-3">
                  <div className="w-9 h-9 rounded-md bg-brand-black-card border border-brand-black-border flex items-center justify-center text-xs font-bold text-brand-gray-muted shrink-0">
                    {a.minute != null ? `${a.minute}'` : i + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {a.action_type && <span className="text-[11px] px-2 py-0.5 rounded-full bg-brand-black-card border border-brand-black-border text-brand-gray-light">{a.action_type}</span>}
                      {a.result && <span className={`text-[11px] px-2 py-0.5 rounded-full border ${RESULT_STYLES[a.result]}`}>{a.result}</span>}
                      {a.importance && <span className="text-[11px] text-brand-gray-dark">Imp. {a.importance}</span>}
                      {a.emotional_state && <span className="text-xs">{a.emotional_state}</span>}
                      {a.video_url && <Film className="w-3.5 h-3.5 text-brand-gray-muted" />}
                    </div>
                    {a.description && <p className="text-sm text-brand-gray-light">{a.description}</p>}
                    
                    {/* Mensajes sin leer mostrados directamente debajo de la jugada */}
                    {(a.messages || []).filter(m => !m.read_at && m.sender_id !== currentUserId).length > 0 && (
                      <div className="mt-2 space-y-1.5">
                        {(a.messages || []).filter(m => !m.read_at && m.sender_id !== currentUserId).map(m => (
                          <div key={m.id} className="p-2.5 bg-brand-black-bg border border-brand-black-border rounded-lg border-l-2 border-l-brand-red-600 relative cursor-pointer hover:bg-brand-black-hover transition-colors" onClick={() => openEditAction(a)}>
                            <div className="text-[11px] font-bold text-brand-red-500 mb-0.5">Respuesta nueva del entrenador:</div>
                            <p className="text-sm text-brand-gray-light whitespace-pre-wrap">{m.body}</p>
                            <div className="absolute top-2.5 right-2.5 text-[10px] text-brand-gray-dark">Clic para abrir chat</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button onClick={() => openEditAction(a)} title="Ver / editar"
                      className="relative p-1.5 rounded-md text-brand-gray-muted hover:text-white hover:bg-brand-black-hover">
                      <MessageSquare className="w-4 h-4" />
                      {(() => {
                        const unreadCount = a.messages?.filter(m => !m.read_at && m.sender_id !== currentUserId).length || 0;
                        if (unreadCount > 0) {
                          return (
                            <span className="absolute -top-1 -right-1 min-w-[16px] h-[16px] px-1 rounded-full bg-brand-red-600 text-white text-[9px] font-bold flex items-center justify-center">
                              {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                          );
                        }
                        return null;
                      })()}
                    </button>
                    {!readOnly && (
                      <button onClick={(e) => { e.stopPropagation(); removeAction(a.id); }} title="Eliminar"
                        className="p-1.5 rounded-md text-brand-gray-muted hover:text-brand-red-400 hover:bg-brand-black-hover">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {analysis.time_spent_seconds > 0 && (
        <p className="text-[11px] text-brand-gray-dark mt-3 flex items-center gap-1">
          <Clock className="w-3 h-3" /> Tiempo dedicado: {Math.round(analysis.time_spent_seconds / 60)} min
        </p>
      )}

      {showActionModal && (
        <ActionEditor
          action={editingAction}
          analysisId={analysis.id}
          readOnly={readOnly}
          isStaff={isStaff}
          currentUserId={currentUserId}
          onClose={() => { setShowActionModal(false); setEditingAction(null); }}
          onSave={saveAction}
        />
      )}
    </div>
  );
};

// =====================================================================
// EDITOR DE UNA JUGADA (modal)
// =====================================================================
const ActionEditor: React.FC<{
  action: ImprovementAction | null;
  analysisId: string;
  readOnly: boolean;
  isStaff: boolean;
  currentUserId: string;
  onClose: () => void;
  onSave: (patch: Partial<ImprovementAction>) => void;
}> = ({ action, analysisId, readOnly, isStaff, currentUserId, onClose, onSave }) => {
  const [f, setF] = useState<Partial<ImprovementAction>>({
    minute: action?.minute ?? undefined,
    half: action?.half ?? undefined,
    action_type: action?.action_type ?? undefined,
    result: action?.result ?? undefined,
    description: action?.description ?? '',
    reflection_why: action?.reflection_why ?? '',
    reflection_options: action?.reflection_options ?? '',
    reflection_keep_same: action?.reflection_keep_same ?? '',
    reflection_change: action?.reflection_change ?? '',
    reflection_learning: action?.reflection_learning ?? '',
    emotional_state: action?.emotional_state ?? '',
    importance: action?.importance ?? 'Media',
    video_url: action?.video_url ?? '',
    video_timestamp: action?.video_timestamp ?? undefined,
    board_data: action?.board_data ?? undefined,
  });
  const upd = (patch: Partial<ImprovementAction>) => setF(prev => ({ ...prev, ...patch }));

  return (
    <Modal isOpen onClose={onClose} title={action ? 'Jugada' : 'Nueva jugada'} maxWidth="max-w-2xl">
      <div className="p-5 space-y-4 overflow-y-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Field label="Minuto">
            <input type="number" disabled={readOnly} className={inputCls} value={f.minute ?? ''} onChange={e => upd({ minute: e.target.value ? Number(e.target.value) : undefined })} />
          </Field>
          <Field label="Parte">
            <select disabled={readOnly} className={inputCls} value={f.half ?? ''} onChange={e => upd({ half: (e.target.value || undefined) as ImprovementHalf })}>
              <option value="">—</option>
              {HALVES.map(h => <option key={h} value={h}>{h}</option>)}
            </select>
          </Field>
          <Field label="Tipo">
            <select disabled={readOnly} className={inputCls} value={f.action_type ?? ''} onChange={e => upd({ action_type: (e.target.value || undefined) as ImprovementActionType })}>
              <option value="">—</option>
              {ACTION_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="Resultado">
            <select disabled={readOnly} className={inputCls} value={f.result ?? ''} onChange={e => upd({ result: (e.target.value || undefined) as ImprovementResult })}>
              <option value="">—</option>
              {RESULTS.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </Field>
        </div>

        <Field label="¿Qué ocurrió?">
          <textarea rows={2} disabled={readOnly} className={inputCls} value={f.description ?? ''} onChange={e => upd({ description: e.target.value })} placeholder="Describe la acción…" />
        </Field>

        <div className="grid md:grid-cols-2 gap-3">
          <Field label="¿Por qué tomaste esa decisión?">
            <textarea rows={2} disabled={readOnly} className={inputCls} value={f.reflection_why ?? ''} onChange={e => upd({ reflection_why: e.target.value })} />
          </Field>
          <Field label="¿Qué opciones tenías?">
            <textarea rows={2} disabled={readOnly} className={inputCls} value={f.reflection_options ?? ''} onChange={e => upd({ reflection_options: e.target.value })} />
          </Field>
          <Field label="¿Qué volverías a hacer igual?">
            <textarea rows={2} disabled={readOnly} className={inputCls} value={f.reflection_keep_same ?? ''} onChange={e => upd({ reflection_keep_same: e.target.value })} />
          </Field>
          <Field label="¿Qué cambiarías?">
            <textarea rows={2} disabled={readOnly} className={inputCls} value={f.reflection_change ?? ''} onChange={e => upd({ reflection_change: e.target.value })} />
          </Field>
        </div>
        <Field label="¿Qué aprendizaje sacas?">
          <textarea rows={2} disabled={readOnly} className={inputCls} value={f.reflection_learning ?? ''} onChange={e => upd({ reflection_learning: e.target.value })} />
        </Field>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <Field label="Estado emocional">
            <select disabled={readOnly} className={inputCls} value={f.emotional_state ?? ''} onChange={e => upd({ emotional_state: e.target.value })}>
              <option value="">—</option>
              {EMOTIONAL_STATES.map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
          <Field label="Importancia">
            <select disabled={readOnly} className={inputCls} value={f.importance ?? 'Media'} onChange={e => upd({ importance: e.target.value as ImprovementImportance })}>
              {IMPORTANCES.map(i => <option key={i} value={i}>{i}</option>)}
            </select>
          </Field>
          <Field label="Clip de vídeo (URL)">
            <input disabled={readOnly} className={inputCls} value={f.video_url ?? ''} onChange={e => upd({ video_url: e.target.value })} placeholder="Próximamente" />
          </Field>
        </div>

        {/* Campograma táctico (jugadores, flechas, zonas…) */}
        <div className="pt-2">
          <span className="text-xs font-medium text-brand-gray-muted uppercase tracking-wide">Campograma</span>
          <div className="mt-2 rounded-lg overflow-hidden border border-brand-black-border">
            <TaskBoardEditor
              value={f.board_data ?? undefined}
              onChange={readOnly ? undefined : (v: string) => upd({ board_data: v })}
              readOnly={readOnly}
              limitedTools={true}
            />
          </div>
        </div>

        {/* Chat entrenador <-> jugador (solo si la jugada ya existe) */}
        {action && (
          <ChatPanel
            actionId={action.id}
            analysisId={analysisId}
            currentUserId={currentUserId}
            isStaff={isStaff}
          />
        )}
      </div>

      <div className="flex justify-end gap-2 p-4 border-t border-brand-black-border">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-brand-black-bg border border-brand-black-border text-sm text-brand-gray-light hover:bg-brand-black-hover">
          {readOnly ? 'Cerrar' : 'Cancelar'}
        </button>
        {!readOnly && (
          <button onClick={() => onSave(f)} className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-red-600 hover:bg-brand-red-700 text-white text-sm font-semibold">
            <Save className="w-4 h-4" /> Guardar jugada
          </button>
        )}
      </div>
    </Modal>
  );
};

// =====================================================================
// CHAT POR ACCIÓN (tiempo real vía Supabase Realtime)
// =====================================================================
const ChatPanel: React.FC<{
  actionId: string;
  analysisId: string;
  currentUserId: string;
  isStaff: boolean;
}> = ({ actionId, analysisId, currentUserId, isStaff }) => {
  const [messages, setMessages] = useState<ImprovementMessage[]>([]);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const list = await improvementService.getMessages(actionId);
    setMessages(list);
  };

  useEffect(() => {
    load();
    improvementService.markMessagesRead(actionId, currentUserId).catch(() => {});

    if (isMockMode) return;
    // Suscripción en tiempo real a los mensajes de esta acción
    const channel = supabase
      .channel(`ii_msgs_${actionId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'improvement_messages', filter: `action_id=eq.${actionId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [actionId]);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages.length]);

  const send = async () => {
    const body = text.trim();
    if (!body || sending) return;
    try {
      setSending(true);
      const msg = await improvementService.sendMessage(actionId, currentUserId, body);
      setText('');
      // Optimista (la suscripción también lo traerá, pero evitamos parpadeo en local)
      setMessages(prev => (prev.some(m => m.id === msg.id) ? prev : [...prev, msg]));
      if (isStaff) {
        improvementService.notifyAnalysisOwner('coach_replied', {
          analysisId, actionId, actorId: currentUserId, message: body.slice(0, 120),
        }).catch(() => {});
      }
    } catch (e: any) {
      console.error(e);
      alert(`No se pudo enviar el mensaje: ${e.message || 'Error desconocido'}`);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="mt-4 pt-4 border-t border-brand-black-border">
      <h3 className="text-sm font-semibold text-white flex items-center gap-2 mb-3">
        <MessageSquare className="w-4 h-4 text-brand-red-600" /> Conversación
      </h3>

      <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
        {messages.length === 0 ? (
          <p className="text-xs text-brand-gray-dark py-4 text-center">Sin mensajes todavía. Empieza la conversación.</p>
        ) : (
          messages.map(m => {
            const mine = m.sender_id === currentUserId;
            const name = m.sender?.nickname || m.sender?.full_name || (mine ? 'Tú' : 'Usuario');
            const isCoach = m.sender?.role_id === 1 || m.sender?.role_id === 2;
            return (
              <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-xl px-3 py-2 ${
                  mine ? 'bg-brand-red-600 text-white' : 'bg-brand-black-bg border border-brand-black-border text-brand-gray-light'
                }`}>
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`text-[11px] font-semibold ${mine ? 'text-white/90' : 'text-white'}`}>{name}</span>
                    {isCoach && !mine && <span className="text-[9px] px-1 py-px rounded bg-amber-500/20 text-amber-400">Entrenador</span>}
                  </div>
                  <p className="text-sm whitespace-pre-wrap break-words">{m.body}</p>
                  <div className={`text-[10px] mt-0.5 ${mine ? 'text-white/60' : 'text-brand-gray-dark'}`}>
                    {m.created_at ? new Date(m.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      <div className="flex gap-2 mt-3">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); } }}
          placeholder="Escribe un mensaje…"
          className="flex-1 px-3 py-2 rounded-lg bg-brand-black-bg border border-brand-black-border text-sm text-white placeholder:text-brand-gray-dark focus:outline-none focus:border-brand-red-600/50"
        />
        <button onClick={send} disabled={sending || !text.trim()}
          className="inline-flex items-center justify-center w-10 h-10 rounded-lg bg-brand-red-600 hover:bg-brand-red-700 text-white disabled:opacity-50">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
        </button>
      </div>
    </div>
  );
};

// =====================================================================
// CAMPANA DE NOTIFICACIONES (tiempo real)
// =====================================================================
const NotificationBell: React.FC<{
  userId: string;
  onOpenAnalysis: (id: string) => void;
}> = ({ userId, onOpenAnalysis }) => {
  const [items, setItems] = useState<ImprovementNotification[]>([]);
  const [open, setOpen] = useState(false);
  const boxRef = useRef<HTMLDivElement | null>(null);

  const load = async () => setItems(await improvementService.getMyNotifications(userId));

  useEffect(() => {
    load();
    if (isMockMode) return;
    const channel = supabase
      .channel(`ii_notifs_${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'improvement_notifications', filter: `recipient_id=eq.${userId}` },
        () => { load(); },
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // Cerrar al hacer clic fuera
  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const unread = items.filter(n => !n.read_at).length;

  const handleClick = async (n: ImprovementNotification) => {
    if (!n.read_at) {
      await improvementService.markNotificationRead(n.id);
      setItems(prev => prev.map(x => (x.id === n.id ? { ...x, read_at: new Date().toISOString() } : x)));
    }
    setOpen(false);
    if (n.analysis_id) onOpenAnalysis(n.analysis_id);
  };

  const markAll = async () => {
    await improvementService.markAllNotificationsRead(userId);
    setItems(prev => prev.map(x => ({ ...x, read_at: x.read_at || new Date().toISOString() })));
  };

  return (
    <div className="relative" ref={boxRef}>
      <button
        onClick={() => setOpen(o => !o)}
        className="relative p-2 rounded-lg bg-brand-black-card border border-brand-black-border text-brand-gray-muted hover:text-white hover:bg-brand-black-hover"
        aria-label="Notificaciones"
      >
        <Bell className="w-5 h-5" />
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-brand-red-600 text-white text-[10px] font-bold flex items-center justify-center">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto rounded-xl bg-brand-black-card border border-brand-black-border shadow-premium z-50 animate-fade-in">
          <div className="flex items-center justify-between px-3 py-2 border-b border-brand-black-border">
            <span className="text-sm font-semibold text-white">Notificaciones</span>
            {unread > 0 && (
              <button onClick={markAll} className="text-[11px] text-brand-gray-muted hover:text-white inline-flex items-center gap-1">
                <Check className="w-3 h-3" /> Marcar leídas
              </button>
            )}
          </div>
          {items.length === 0 ? (
            <p className="text-xs text-brand-gray-dark text-center py-6">No tienes notificaciones.</p>
          ) : (
            items.map(n => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className={`w-full text-left px-3 py-2.5 border-b border-brand-black-border/60 hover:bg-brand-black-hover transition-colors ${
                  n.read_at ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start gap-2">
                  {!n.read_at && <span className="w-1.5 h-1.5 rounded-full bg-brand-red-600 mt-1.5 shrink-0" />}
                  <div className="min-w-0">
                    <p className="text-sm text-white">{NOTIF_LABEL[n.type]}</p>
                    {n.message && <p className="text-xs text-brand-gray-muted truncate">{n.message}</p>}
                    <p className="text-[10px] text-brand-gray-dark mt-0.5">
                      {n.created_at ? new Date(n.created_at).toLocaleString('es-ES', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : ''}
                    </p>
                  </div>
                </div>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
};

// =====================================================================
// PANEL DEL ENTRENADOR — tabla de todos los jugadores + análisis
// =====================================================================
type PlayerRow = {
  player: Player;
  count: number;
  pending: number;
  unread_messages: number;
  last?: ImprovementAnalysis;
};
type SortKey = 'player' | 'position' | 'date' | 'status' | 'count' | 'pending' | 'unread';

const CoachPanel: React.FC<{
  players: Player[];
  analyses: ImprovementAnalysis[];
  onOpenPlayer: (p: Player) => void;
  onOpenAnalysis: (id: string) => void;
  currentUserId: string;
}> = ({ players, analyses, onOpenPlayer, onOpenAnalysis, currentUserId }) => {
  const [q, setQ] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [asc, setAsc] = useState(false);

  const rows: PlayerRow[] = useMemo(() => {
    return players.map(player => {
      const mine = analyses
        .filter(a => a.player_id === player.id)
        .sort((x, y) => new Date(y.match?.date || y.created_at || 0).getTime() - new Date(x.match?.date || x.created_at || 0).getTime());
      const pending = mine.filter(a => a.status === 'Enviado').length;
      let unread_messages = 0;
      mine.forEach(a => {
        (a.actions || []).forEach(ac => {
          (ac.messages || []).forEach(m => {
            if (!m.read_at && m.sender_id !== currentUserId) {
              unread_messages++;
            }
          });
        });
      });
      return { player, count: mine.length, pending, unread_messages, last: mine[0] };
    });
  }, [players, analyses, currentUserId]);

  const filtered = useMemo(() => {
    const list = rows.filter(r => {
      if (!q) return true;
      return `${r.player.full_name} ${r.player.nickname || ''} ${r.player.position || ''}`.toLowerCase().includes(q.toLowerCase());
    });
    const dir = asc ? 1 : -1;
    return [...list].sort((a, b) => {
      switch (sortKey) {
        case 'player': return dir * (a.player.full_name || '').localeCompare(b.player.full_name || '');
        case 'position': return dir * (a.player.position || '').localeCompare(b.player.position || '');
        case 'status': return dir * (a.last?.status || '').localeCompare(b.last?.status || '');
        case 'count': return dir * (a.count - b.count);
        case 'pending': return dir * (a.pending - b.pending);
        case 'unread': return dir * (a.unread_messages - b.unread_messages);
        case 'date':
        default: {
          const da = new Date(a.last?.match?.date || a.last?.created_at || 0).getTime();
          const db = new Date(b.last?.match?.date || b.last?.created_at || 0).getTime();
          return dir * (da - db);
        }
      }
    });
  }, [rows, q, sortKey, asc]);

  const totalPending = rows.reduce((s, r) => s + r.pending, 0);
  const toggleSort = (k: SortKey) => { if (sortKey === k) setAsc(a => !a); else { setSortKey(k); setAsc(false); } };

  const Th: React.FC<{ k: SortKey; children: React.ReactNode; className?: string }> = ({ k, children, className }) => (
    <th className={`px-3 py-2 text-left font-semibold text-brand-gray-muted select-none cursor-pointer hover:text-white ${className || ''}`}
        onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{children}{sortKey === k && <span className="text-brand-red-600">{asc ? '▲' : '▼'}</span>}</span>
    </th>
  );

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-2">
          <TrendingUp className="w-6 h-6 text-brand-red-600" /> Mejora Individual
        </h1>
        <p className="text-sm text-brand-gray-muted mt-0.5">
          Panel del cuerpo técnico · {players.length} jugadores
          {totalPending > 0 && <span className="ml-2 text-amber-400">· {totalPending} pendientes de revisar</span>}
        </p>
      </div>

      <input
        value={q}
        onChange={e => setQ(e.target.value)}
        placeholder="Buscar jugador…"
        className="w-full mb-4 px-3 py-2 rounded-lg bg-brand-black-card border border-brand-black-border text-sm text-white placeholder:text-brand-gray-dark focus:outline-none focus:border-brand-red-600/50"
      />

      <div className="overflow-x-auto rounded-xl border border-brand-black-border">
        <table className="w-full text-sm min-w-[720px]">
          <thead className="bg-brand-black-card border-b border-brand-black-border">
            <tr>
              <Th k="player">Jugador</Th>
              <Th k="position">Posición</Th>
              <Th k="date">Último análisis</Th>
              <Th k="status">Estado</Th>
              <Th k="count" className="text-center">Acciones</Th>
              <Th k="pending" className="text-center">Pendientes</Th>
              <Th k="unread" className="text-center">Respuestas sin leer</Th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y divide-brand-black-border">
            {filtered.map(r => (
              <tr key={r.player.id} className="bg-brand-black-bg hover:bg-brand-black-hover transition-colors">
                <td className="px-3 py-2.5">
                  <button onClick={() => onOpenPlayer(r.player)} className="flex items-center gap-2.5 text-left group">
                    <PlayerAvatar player={r.player} />
                    <div className="min-w-0">
                      <div className="text-white font-medium truncate group-hover:text-brand-red-400">{r.player.nickname || r.player.full_name}</div>
                      {r.player.dorsal != null && <div className="text-[11px] text-brand-gray-dark">Dorsal {r.player.dorsal}</div>}
                    </div>
                  </button>
                </td>
                <td className="px-3 py-2.5 text-brand-gray-muted">{r.player.position || '—'}</td>
                <td className="px-3 py-2.5 text-brand-gray-muted">
                  {r.last
                    ? <button onClick={() => onOpenAnalysis(r.last!.id)} className="hover:text-white text-left">
                        <div className="text-brand-gray-light truncate max-w-[180px]">{matchLabel(r.last.match)}</div>
                        <div className="text-[11px] text-brand-gray-dark">{r.last.match?.date ? new Date(r.last.match.date).toLocaleDateString('es-ES') : ''}</div>
                      </button>
                    : <span className="text-brand-gray-dark">Sin análisis</span>}
                </td>
                <td className="px-3 py-2.5">
                  {r.last
                    ? <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[r.last.status]}`}>{r.last.status}</span>
                    : '—'}
                </td>
                <td className="px-3 py-2.5 text-center text-brand-gray-light">{r.count}</td>
                <td className="px-3 py-2.5 text-center">
                  {r.pending > 0
                    ? <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-amber-500/15 text-amber-400 text-[11px] font-bold">{r.pending}</span>
                    : <span className="text-brand-gray-dark">0</span>}
                </td>
                <td className="px-3 py-2.5 text-center">
                  {r.unread_messages > 0
                    ? <span className="inline-flex items-center justify-center min-w-[22px] h-5 px-1.5 rounded-full bg-brand-red-600 text-white text-[11px] font-bold">{r.unread_messages}</span>
                    : <span className="text-brand-gray-dark">0</span>}
                </td>
                <td className="px-3 py-2.5 text-right">
                  <button onClick={() => onOpenPlayer(r.player)} className="text-brand-gray-dark hover:text-brand-red-600">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

const PlayerAvatar: React.FC<{ player: Player; size?: number }> = ({ player, size = 34 }) => (
  player.photo_url
    ? <img src={player.photo_url} alt={player.full_name} className="rounded-full object-cover shrink-0 border border-brand-black-border" style={{ width: size, height: size }} />
    : <div className="rounded-full bg-brand-black-card border border-brand-black-border flex items-center justify-center text-brand-gray-muted text-xs font-bold shrink-0" style={{ width: size, height: size }}>
        {(player.full_name || '?').slice(0, 2).toUpperCase()}
      </div>
);

// =====================================================================
// VISTA INDIVIDUAL DEL JUGADOR (para el entrenador)
// =====================================================================
const CoachPlayerView: React.FC<{
  player: Player;
  analyses: ImprovementAnalysis[];
  currentUserId: string;
  onOpenAnalysis: (id: string) => void;
  onBack: () => void;
}> = ({ player, analyses, currentUserId, onOpenAnalysis, onBack }) => {
  const ordered = useMemo(
    () => [...analyses].sort((a, b) => new Date(a.match?.date || a.created_at || 0).getTime() - new Date(b.match?.date || b.created_at || 0).getTime()),
    [analyses],
  );

  const stats = useMemo(() => {
    const rated = ordered.filter(a => a.rating_match != null);
    const avgSelf = rated.length ? rated.reduce((s, a) => s + (a.rating_match || 0), 0) / rated.length : 0;
    const coachRated = ordered.filter(a => a.coach_rating != null);
    const avgCoach = coachRated.length ? coachRated.reduce((s, a) => s + (a.coach_rating || 0), 0) / coachRated.length : 0;
    const totalActions = ordered.reduce((s, a) => s + (a.actions?.length || 0), 0);
    return { total: ordered.length, avgSelf, avgCoach, totalActions };
  }, [ordered]);

  const chartData = ordered
    .filter(a => a.rating_match != null || a.coach_rating != null)
    .map(a => ({
      name: a.match?.date ? new Date(a.match.date).toLocaleDateString('es-ES', { day: '2-digit', month: '2-digit' }) : '',
      Autoevaluación: a.rating_match ?? null,
      Entrenador: a.coach_rating ?? null,
    }));

  return (
    <div>
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-sm text-brand-gray-muted hover:text-white mb-4">
        <ChevronLeft className="w-4 h-4" /> Volver al panel
      </button>

      {/* Cabecera del jugador */}
      <div className="flex items-center gap-4 mb-6">
        <PlayerAvatar player={player} size={64} />
        <div>
          <h1 className="text-2xl font-bold text-white">{player.nickname || player.full_name}</h1>
          <div className="text-sm text-brand-gray-muted flex flex-wrap gap-x-3 gap-y-0.5">
            {player.position && <span>{player.position}</span>}
            {player.dorsal != null && <span>Dorsal {player.dorsal}</span>}
            {player.dominant_foot && <span>{player.dominant_foot}</span>}
          </div>
        </div>
      </div>

      {/* Métricas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Análisis" value={stats.total} />
        <StatCard label="Jugadas" value={stats.totalActions} />
        <StatCard label="Autoeval. media" value={stats.avgSelf ? stats.avgSelf.toFixed(1) : '—'} />
        <StatCard label="Valoración téc. media" value={stats.avgCoach ? stats.avgCoach.toFixed(1) : '—'} />
      </div>

      {/* Gráfico de evolución (percepción vs. entrenador) */}
      <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-red-600" /> Evolución (autoevaluación vs. entrenador)
        </h2>
        {chartData.length < 2 ? (
          <p className="text-sm text-brand-gray-muted py-6 text-center">Se necesitan al menos 2 análisis valorados para ver la evolución.</p>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="#a3a3a3" fontSize={11} />
                <Tooltip contentStyle={{ background: '#161616', border: '1px solid #242424', borderRadius: 8, color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Autoevaluación" stroke="#C1121F" strokeWidth={2} connectNulls dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Entrenador" stroke="#3b82f6" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Objetivos */}
      <ObjectivesSection player={player} currentUserId={currentUserId} />

      {/* Lista de análisis del jugador */}
      <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 mt-6">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-brand-red-600" /> Análisis del jugador
        </h2>
        {ordered.length === 0 ? (
          <p className="text-sm text-brand-gray-muted py-6 text-center">Este jugador aún no ha creado análisis.</p>
        ) : (
          <div className="grid gap-2">
            {[...ordered].reverse().map(a => (
              <button key={a.id} onClick={() => onOpenAnalysis(a.id)}
                className="flex items-center gap-3 p-3 rounded-lg bg-brand-black-bg border border-brand-black-border hover:border-brand-red-600/40 text-left">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium truncate">{matchLabel(a.match)}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${STATUS_STYLES[a.status]}`}>{a.status}</span>
                  </div>
                  <div className="text-xs text-brand-gray-muted mt-0.5 flex gap-3">
                    {a.match?.date && <span>{new Date(a.match.date).toLocaleDateString('es-ES')}</span>}
                    <span>{a.actions?.length || 0} jugadas</span>
                    {a.rating_match != null && <span>Auto {a.rating_match}/10</span>}
                    {a.coach_rating != null && <span>Téc. {a.coach_rating}/10</span>}
                  </div>
                </div>
                <ChevronRight className="w-4 h-4 text-brand-gray-dark shrink-0" />
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: React.ReactNode }> = ({ label, value }) => (
  <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-4">
    <div className="text-2xl font-bold text-white">{value}</div>
    <div className="text-xs text-brand-gray-muted mt-0.5">{label}</div>
  </div>
);

// =====================================================================
// OBJETIVOS DE MEJORA (asigna el entrenador)
// =====================================================================
const ObjectivesSection: React.FC<{ player: Player; currentUserId: string }> = ({ player, currentUserId }) => {
  const { showToast } = useToast();
  const [objectives, setObjectives] = useState<ImprovementObjective[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<ImprovementObjective | null>(null);

  const load = async () => {
    setLoading(true);
    try { setObjectives(await improvementService.getObjectivesByPlayer(player.id)); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [player.id]);

  const save = async (patch: Partial<ImprovementObjective>) => {
    try {
      if (editing) {
        const upd = await improvementService.updateObjective(editing.id, patch);
        setObjectives(prev => prev.map(o => (o.id === upd.id ? upd : o)));
      } else {
        const created = await improvementService.createObjective({
          player_id: player.id,
          title: patch.title || 'Objetivo',
          description: patch.description,
          target_date: patch.target_date,
          progress: patch.progress ?? 0,
          status: patch.status ?? 'Activo',
          created_by: currentUserId,
        });
        setObjectives(prev => [created, ...prev]);
      }
      setShowModal(false);
      setEditing(null);
    } catch (e) {
      console.error(e);
      showToast('error', 'Error', 'No se pudo guardar el objetivo.');
    }
  };

  const remove = async (id: string) => {
    try {
      await improvementService.deleteObjective(id);
      setObjectives(prev => prev.filter(o => o.id !== id));
    } catch { showToast('error', 'Error', 'No se pudo eliminar.'); }
  };

  const setProgress = async (o: ImprovementObjective, progress: number) => {
    const status: ImprovementObjective['status'] = progress >= 100 ? 'Cumplido' : progress > 0 ? 'En progreso' : 'Activo';
    const upd = await improvementService.updateObjective(o.id, { progress, status });
    setObjectives(prev => prev.map(x => (x.id === upd.id ? upd : x)));
  };

  return (
    <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-white font-semibold flex items-center gap-2">
          <Star className="w-4 h-4 text-brand-red-600" /> Objetivos de mejora
        </h2>
        <button onClick={() => { setEditing(null); setShowModal(true); }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-brand-black-bg border border-brand-black-border text-white text-sm hover:border-brand-red-600/40">
          <Plus className="w-4 h-4" /> Nuevo objetivo
        </button>
      </div>

      {loading ? (
        <div className="py-6 text-center"><Loader2 className="w-5 h-5 text-brand-red-600 animate-spin mx-auto" /></div>
      ) : objectives.length === 0 ? (
        <p className="text-sm text-brand-gray-muted py-6 text-center">Sin objetivos asignados.</p>
      ) : (
        <div className="grid gap-2.5">
          {objectives.map(o => (
            <div key={o.id} className="p-3.5 rounded-lg bg-brand-black-bg border border-brand-black-border">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-white font-medium">{o.title}</span>
                    <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      o.status === 'Cumplido' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                      : o.status === 'En progreso' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                      : o.status === 'Descartado' ? 'bg-brand-gray-dark/20 text-brand-gray-muted border-brand-black-border'
                      : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                    }`}>{o.status}</span>
                  </div>
                  {o.description && <p className="text-sm text-brand-gray-muted mt-0.5">{o.description}</p>}
                  {o.target_date && <p className="text-[11px] text-brand-gray-dark mt-1">Fecha objetivo: {new Date(o.target_date).toLocaleDateString('es-ES')}</p>}
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditing(o); setShowModal(true); }} className="p-1.5 rounded-md text-brand-gray-muted hover:text-white hover:bg-brand-black-hover">
                    <Save className="w-4 h-4" />
                  </button>
                  <button onClick={() => remove(o.id)} className="p-1.5 rounded-md text-brand-gray-muted hover:text-brand-red-400 hover:bg-brand-black-hover">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              {/* Barra de progreso */}
              <div className="mt-2.5 flex items-center gap-2">
                <input type="range" min={0} max={100} step={10} value={o.progress}
                  onChange={e => setProgress(o, Number(e.target.value))}
                  className="flex-1 accent-brand-red-600" />
                <span className="text-xs text-brand-gray-light w-10 text-right">{o.progress}%</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <ObjectiveEditor objective={editing} onClose={() => { setShowModal(false); setEditing(null); }} onSave={save} />
      )}
    </section>
  );
};

const ObjectiveEditor: React.FC<{
  objective: ImprovementObjective | null;
  onClose: () => void;
  onSave: (patch: Partial<ImprovementObjective>) => void;
}> = ({ objective, onClose, onSave }) => {
  const [f, setF] = useState<Partial<ImprovementObjective>>({
    title: objective?.title ?? '',
    description: objective?.description ?? '',
    target_date: objective?.target_date ?? '',
    progress: objective?.progress ?? 0,
    status: objective?.status ?? 'Activo',
  });
  const upd = (p: Partial<ImprovementObjective>) => setF(prev => ({ ...prev, ...p }));

  return (
    <Modal isOpen onClose={onClose} title={objective ? 'Editar objetivo' : 'Nuevo objetivo'} maxWidth="max-w-lg">
      <div className="p-5 space-y-4">
        <Field label="Título">
          <input className={inputCls} value={f.title ?? ''} onChange={e => upd({ title: e.target.value })} placeholder="Escanear antes de recibir" />
        </Field>
        <Field label="Descripción">
          <textarea rows={3} className={inputCls} value={f.description ?? ''} onChange={e => upd({ description: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha objetivo">
            <input type="date" className={inputCls} value={f.target_date ?? ''} onChange={e => upd({ target_date: e.target.value })} />
          </Field>
          <Field label="Estado">
            <select className={inputCls} value={f.status ?? 'Activo'} onChange={e => upd({ status: e.target.value as ImprovementObjective['status'] })}>
              {['Activo', 'En progreso', 'Cumplido', 'Descartado'].map(s => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>
      </div>
      <div className="flex justify-end gap-2 p-4 border-t border-brand-black-border">
        <button onClick={onClose} className="px-4 py-2 rounded-lg bg-brand-black-bg border border-brand-black-border text-sm text-brand-gray-light hover:bg-brand-black-hover">Cancelar</button>
        <button onClick={() => onSave(f)} disabled={!f.title?.trim()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-brand-red-600 hover:bg-brand-red-700 text-white text-sm font-semibold disabled:opacity-50">
          <Save className="w-4 h-4" /> Guardar
        </button>
      </div>
    </Modal>
  );
};

// =====================================================================
// ESTADÍSTICAS GLOBALES (cuerpo técnico) + filtros de historial
// =====================================================================
const monthKey = (d?: string | null) => {
  if (!d) return '';
  const dt = new Date(d);
  return isNaN(dt.getTime()) ? '' : `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}`;
};

const CoachStats: React.FC<{ players: Player[]; analyses: ImprovementAnalysis[] }> = ({ players, analyses }) => {
  const { showToast } = useToast();
  const [actions, setActions] = useState<ImprovementAction[]>([]);
  const [objectives, setObjectives] = useState<ImprovementObjective[]>([]);
  const [loading, setLoading] = useState(true);

  // Filtros de historial
  const [fSeason, setFSeason] = useState('');
  const [fCompetition, setFCompetition] = useState('');
  const [fPosition, setFPosition] = useState('');
  const [fRival, setFRival] = useState('');

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        const [acts, objs] = await Promise.all([
          improvementService.getAllActions(),
          improvementService.getAllObjectives(),
        ]);
        setActions(acts);
        setObjectives(objs);
      } catch (e) {
        console.error(e);
        showToast('error', 'Error', 'No se pudieron cargar las estadísticas.');
      } finally { setLoading(false); }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const playerById = useMemo(() => new Map(players.map(p => [p.id, p])), [players]);

  // Opciones de filtro
  const seasons = useMemo(() => Array.from(new Set(analyses.map(a => a.season).filter(Boolean))).sort().reverse() as string[], [analyses]);
  const competitions = useMemo(() => Array.from(new Set(analyses.map(a => a.match?.competition).filter(Boolean))) as string[], [analyses]);
  const positions = useMemo(() => Array.from(new Set(players.map(p => p.position).filter(Boolean))) as string[], [players]);
  const rivals = useMemo(() => Array.from(new Set(analyses.map(a => a.match?.rival).filter(Boolean))).sort() as string[], [analyses]);

  // Análisis filtrados
  const filtered = useMemo(() => analyses.filter(a => {
    if (fSeason && a.season !== fSeason) return false;
    if (fCompetition && a.match?.competition !== fCompetition) return false;
    if (fRival && a.match?.rival !== fRival) return false;
    if (fPosition) {
      const p = playerById.get(a.player_id);
      if (!p || p.position !== fPosition) return false;
    }
    return true;
  }), [analyses, fSeason, fCompetition, fRival, fPosition, playerById]);

  const filteredIds = useMemo(() => new Set(filtered.map(a => a.id)), [filtered]);
  const filteredActions = useMemo(() => actions.filter(a => filteredIds.has(a.analysis_id)), [actions, filteredIds]);

  // KPIs
  const total = filtered.length;
  const avgTime = total ? filtered.reduce((s, a) => s + (a.time_spent_seconds || 0), 0) / total : 0;
  const objDone = objectives.filter(o => o.status === 'Cumplido').length;
  const thisMonth = monthKey(new Date().toISOString());
  const participationThisMonth = filtered.filter(a => monthKey(a.submitted_at || a.created_at) === thisMonth).length;

  // Aspectos positivos / errores por tipo de acción
  const groupByType = (predicate: (a: ImprovementAction) => boolean) => {
    const m = new Map<string, number>();
    filteredActions.filter(predicate).forEach(a => {
      const k = a.action_type || 'Otro';
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).map(([name, value]) => ({ name, value })).sort((x, y) => y.value - x.value).slice(0, 6);
  };
  const positives = groupByType(a => a.result === 'Positivo');
  const negatives = groupByType(a => a.result === 'Negativo' || a.result === 'Mejorable');

  // Participación mensual
  const monthly = useMemo(() => {
    const m = new Map<string, number>();
    filtered.forEach(a => { const k = monthKey(a.submitted_at || a.created_at); if (k) m.set(k, (m.get(k) || 0) + 1); });
    return Array.from(m.entries()).sort().map(([name, value]) => ({ name, Análisis: value }));
  }, [filtered]);

  // Evolución de la autoevaluación media vs. valoración técnica media (por mes)
  const evolution = useMemo(() => {
    const m = new Map<string, { self: number[]; coach: number[] }>();
    filtered.forEach(a => {
      const k = monthKey(a.match?.date || a.created_at);
      if (!k) return;
      if (!m.has(k)) m.set(k, { self: [], coach: [] });
      if (a.rating_match != null) m.get(k)!.self.push(a.rating_match);
      if (a.coach_rating != null) m.get(k)!.coach.push(a.coach_rating);
    });
    const avg = (arr: number[]) => (arr.length ? arr.reduce((s, x) => s + x, 0) / arr.length : null);
    return Array.from(m.entries()).sort().map(([name, v]) => ({
      name,
      Autoevaluación: avg(v.self),
      Entrenador: avg(v.coach),
    }));
  }, [filtered]);

  const selCls = 'px-3 py-2 rounded-lg bg-brand-black-card border border-brand-black-border text-sm text-white focus:outline-none focus:border-brand-red-600/50';

  if (loading) {
    return <div className="py-16 text-center"><Loader2 className="w-6 h-6 text-brand-red-600 animate-spin mx-auto" /></div>;
  }

  return (
    <div>
      {/* Filtros de historial */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select className={selCls} value={fSeason} onChange={e => setFSeason(e.target.value)}>
          <option value="">Todas las temporadas</option>
          {seasons.map(s => <option key={s} value={s}>Temp. {s}</option>)}
        </select>
        <select className={selCls} value={fCompetition} onChange={e => setFCompetition(e.target.value)}>
          <option value="">Todas las competiciones</option>
          {competitions.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <select className={selCls} value={fPosition} onChange={e => setFPosition(e.target.value)}>
          <option value="">Todas las posiciones</option>
          {positions.map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <select className={selCls} value={fRival} onChange={e => setFRival(e.target.value)}>
          <option value="">Todos los rivales</option>
          {rivals.map(r => <option key={r} value={r}>{r}</option>)}
        </select>
        {(fSeason || fCompetition || fPosition || fRival) && (
          <button onClick={() => { setFSeason(''); setFCompetition(''); setFPosition(''); setFRival(''); }}
            className="px-3 py-2 rounded-lg text-sm text-brand-gray-muted hover:text-white">Limpiar</button>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard label="Análisis realizados" value={total} />
        <StatCard label="Tiempo medio" value={avgTime ? `${Math.round(avgTime / 60)} min` : '—'} />
        <StatCard label="Objetivos cumplidos" value={`${objDone}/${objectives.length}`} />
        <StatCard label="Participación este mes" value={participationThisMonth} />
      </div>

      {/* Participación mensual */}
      <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5 mb-6">
        <h2 className="text-white font-semibold mb-3">Participación mensual</h2>
        {monthly.length === 0 ? (
          <p className="text-sm text-brand-gray-muted py-6 text-center">Sin datos.</p>
        ) : (
          <div style={{ width: '100%', height: 220 }}>
            <ResponsiveContainer>
              <BarChart data={monthly} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} />
                <YAxis allowDecimals={false} stroke="#a3a3a3" fontSize={11} />
                <Tooltip contentStyle={{ background: '#161616', border: '1px solid #242424', borderRadius: 8, color: '#fff' }} cursor={{ fill: '#ffffff08' }} />
                <Bar dataKey="Análisis" fill="#C1121F" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      {/* Aspectos positivos / errores más repetidos */}
      <div className="grid md:grid-cols-2 gap-4 mb-6">
        <RankCard title="Aspectos positivos más repetidos" data={positives} color="text-emerald-400" />
        <RankCard title="Errores más repetidos" data={negatives} color="text-brand-red-400" />
      </div>

      {/* Evolución global autoevaluación vs. entrenador */}
      <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
        <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-brand-red-600" /> Evolución de la autoevaluación (media) vs. entrenador
        </h2>
        {evolution.length < 2 ? (
          <p className="text-sm text-brand-gray-muted py-6 text-center">Se necesitan al menos 2 meses con datos.</p>
        ) : (
          <div style={{ width: '100%', height: 260 }}>
            <ResponsiveContainer>
              <LineChart data={evolution} margin={{ top: 5, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#242424" />
                <XAxis dataKey="name" stroke="#a3a3a3" fontSize={11} />
                <YAxis domain={[0, 10]} stroke="#a3a3a3" fontSize={11} />
                <Tooltip contentStyle={{ background: '#161616', border: '1px solid #242424', borderRadius: 8, color: '#fff' }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="Autoevaluación" stroke="#C1121F" strokeWidth={2} connectNulls dot={{ r: 3 }} />
                <Line type="monotone" dataKey="Entrenador" stroke="#3b82f6" strokeWidth={2} connectNulls dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>
    </div>
  );
};

const RankCard: React.FC<{ title: string; data: { name: string; value: number }[]; color: string }> = ({ title, data, color }) => {
  const max = data.length ? data[0].value : 0;
  return (
    <section className="bg-brand-black-card border border-brand-black-border rounded-xl p-5">
      <h2 className="text-white font-semibold mb-3">{title}</h2>
      {data.length === 0 ? (
        <p className="text-sm text-brand-gray-muted py-4 text-center">Sin datos.</p>
      ) : (
        <div className="space-y-2.5">
          {data.map(d => (
            <div key={d.name}>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-brand-gray-light">{d.name}</span>
                <span className={`font-semibold ${color}`}>{d.value}</span>
              </div>
              <div className="h-1.5 rounded-full bg-brand-black-bg overflow-hidden">
                <div className="h-full rounded-full bg-brand-red-600" style={{ width: `${max ? (d.value / max) * 100 : 0}%` }} />
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
};

// =====================================================================
// OBJETIVOS DEL JUGADOR (solo lectura, en su propia vista)
// =====================================================================
const PlayerObjectives: React.FC<{ playerId: string }> = ({ playerId }) => {
  const [objectives, setObjectives] = useState<ImprovementObjective[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try { setObjectives(await improvementService.getObjectivesByPlayer(playerId)); }
      finally { setLoading(false); }
    })();
  }, [playerId]);

  if (loading || objectives.length === 0) return null;

  return (
    <section className="mt-8 bg-brand-black-card border border-brand-black-border rounded-xl p-5">
      <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
        <Star className="w-4 h-4 text-brand-red-600" /> Mis objetivos de mejora
      </h2>
      <div className="grid gap-2.5">
        {objectives.map(o => (
          <div key={o.id} className="p-3.5 rounded-lg bg-brand-black-bg border border-brand-black-border">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-white font-medium">{o.title}</span>
              <span className={`text-[11px] px-2 py-0.5 rounded-full border ${
                o.status === 'Cumplido' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                : o.status === 'En progreso' ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : o.status === 'Descartado' ? 'bg-brand-gray-dark/20 text-brand-gray-muted border-brand-black-border'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}>{o.status}</span>
            </div>
            {o.description && <p className="text-sm text-brand-gray-muted mt-0.5">{o.description}</p>}
            {o.target_date && <p className="text-[11px] text-brand-gray-dark mt-1">Fecha objetivo: {new Date(o.target_date).toLocaleDateString('es-ES')}</p>}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-brand-black-card overflow-hidden">
                <div className="h-full rounded-full bg-brand-red-600" style={{ width: `${o.progress}%` }} />
              </div>
              <span className="text-xs text-brand-gray-light w-10 text-right">{o.progress}%</span>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
};
