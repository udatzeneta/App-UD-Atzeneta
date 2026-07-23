import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { OpponentAnalysis, OpponentLibraryVideo, OpponentSubSection, OpponentFormation, OpponentPresentation } from '../types';
import {
  ArrowLeft, ShieldAlert, Award, FileText, Settings as TacticalIcon,
  Edit2, Save, X, Users, Film, Swords, Shield, Flag, Presentation, Plus, Trash2,
} from 'lucide-react';
import { OpponentRosterManager } from '../components/opponent_analysis/OpponentRosterManager';
import { OpponentVideoLibrary } from '../components/opponent_analysis/OpponentVideoLibrary';
import { PhaseSection } from '../components/opponent_analysis/PhaseSection';
import { FormationPitch } from '../components/opponent_analysis/FormationPitch';
import { OpponentPresentationBuilder } from '../components/opponent_analysis/OpponentPresentationBuilder';
import { detectVideoProvider } from '../utils/opponentVideo';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';

// Navegación por anclas del mural.
const NAV = [
  { id: 'generales', label: 'Generales', icon: TacticalIcon },
  { id: 'jugadores', label: 'Jugadores', icon: Users },
  { id: 'con_balon', label: 'Con Balón', icon: Swords },
  { id: 'sin_balon', label: 'Sin Balón', icon: Shield },
  { id: 'abp', label: 'ABP', icon: Flag },
  { id: 'presentacion', label: 'Presentación', icon: Presentation },
  { id: 'videoteca', label: 'Videoteca', icon: Film },
];

export const OpponentAnalysisMural: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const canEdit = hasPermission('opponent_analysis', 'editar');

  const { data: analysisList = [], isLoading } = useQuery({
    queryKey: ['opponent_analysis'],
    queryFn: () => dataService.getOpponentAnalysis(),
  });

  const analysis = analysisList.find(a => a.id === id);

  // --- Estado local para la videoteca (guardado con debounce) ---
  const [libraryVideos, setLibraryVideos] = useState<OpponentLibraryVideo[]>([]);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const migratedRef = useRef(false);

  // --- Estado local del campograma/sistema de juego (guardado con debounce) ---
  const [formation, setFormation] = useState<OpponentFormation>({ system: 'Libre', players: [] });
  const formationTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Sistemas de juego alternativos (guardado con debounce) ---
  const [altFormations, setAltFormations] = useState<OpponentFormation[]>([]);
  const altTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Presentaciones (guardado con debounce) ---
  const [presentations, setPresentations] = useState<OpponentPresentation[]>([]);
  const presTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // --- Estado de edición del bloque General ---
  const [editingGeneral, setEditingGeneral] = useState(false);
  const [editingRoster, setEditingRoster] = useState(false);
  const [editData, setEditData] = useState<Partial<OpponentAnalysis>>({});
  const [strengthsText, setStrengthsText] = useState('');
  const [weaknessesText, setWeaknessesText] = useState('');
  const [keyPlayersText, setKeyPlayersText] = useState('');

  const updateMutation = useMutation({
    mutationFn: (item: Partial<OpponentAnalysis>) => dataService.updateOpponentAnalysis(id!, item),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['opponent_analysis'] }),
    onError: (err: any) => showToast('error', 'Error', err.message),
  });

  // Sincroniza el estado local de la videoteca con el servidor y migra
  // vídeos legacy (dentro de los bloques antiguos) a la videoteca una vez.
  useEffect(() => {
    if (!analysis) return;
    if (analysis.library_videos && analysis.library_videos.length > 0) {
      setLibraryVideos(analysis.library_videos);
      migratedRef.current = true;
      return;
    }
    if (migratedRef.current) return;

    // Migración suave: recopilar vídeos de los bloques legacy.
    const legacy = [
      ...(analysis.with_ball_blocks?.flatMap(b => b.videos || []) || []),
      ...(analysis.without_ball_blocks?.flatMap(b => b.videos || []) || []),
      ...(analysis.abp_blocks?.flatMap(b => b.videos || []) || []),
    ];
    const seen = new Set<string>();
    const migrated: OpponentLibraryVideo[] = [];
    legacy.forEach((v, idx) => {
      if (!v.url || seen.has(v.url)) return;
      seen.add(v.url);
      const { provider, clippable } = detectVideoProvider(v.url);
      migrated.push({
        id: v.id || `libvid-mig-${idx}`,
        url: v.url,
        title: `Vídeo ${migrated.length + 1}`,
        provider,
        clippable,
        clips: v.clips || [],
      });
    });
    migratedRef.current = true;
    if (migrated.length > 0) {
      setLibraryVideos(migrated);
      updateMutation.mutate({ library_videos: migrated });
    }
  }, [analysis?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sincroniza el campograma con el servidor al cargar/cambiar de rival.
  useEffect(() => {
    if (!analysis) return;
    setFormation(analysis.general_formation || { system: 'Libre', players: [] });
    setAltFormations(analysis.alternative_formations || []);
    setPresentations(analysis.presentations || []);
  }, [analysis?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Guardado con debounce del campograma.
  const handleFormationChange = (data: OpponentFormation) => {
    setFormation(data);
    if (formationTimer.current) clearTimeout(formationTimer.current);
    formationTimer.current = setTimeout(() => {
      updateMutation.mutate({ general_formation: data });
    }, 700);
  };

  // Guardado con debounce de los sistemas alternativos.
  const handleAltFormationsChange = (data: OpponentFormation[]) => {
    setAltFormations(data);
    if (altTimer.current) clearTimeout(altTimer.current);
    altTimer.current = setTimeout(() => {
      updateMutation.mutate({ alternative_formations: data });
    }, 700);
  };

  const updateAltFormation = (idx: number, updates: Partial<OpponentFormation>) => {
    handleAltFormationsChange(altFormations.map((f, i) => (i === idx ? { ...f, ...updates } : f)));
  };
  const addAltFormation = () => {
    handleAltFormationsChange([...altFormations, { system: 'Libre', players: [], label: `Alternativa ${altFormations.length + 1}` }]);
  };
  const removeAltFormation = (idx: number) => {
    handleAltFormationsChange(altFormations.filter((_, i) => i !== idx));
  };

  // Guardado con debounce de las presentaciones.
  const handlePresentationsChange = (data: OpponentPresentation[]) => {
    setPresentations(data);
    if (presTimer.current) clearTimeout(presTimer.current);
    presTimer.current = setTimeout(() => {
      updateMutation.mutate({ presentations: data });
    }, 700);
  };

  // Guardado con debounce de la videoteca.
  const handleLibraryChange = (videos: OpponentLibraryVideo[]) => {
    setLibraryVideos(videos);
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      updateMutation.mutate({ library_videos: videos });
    }, 700);
  };

  const totalClips = useMemo(
    () => libraryVideos.reduce((n, v) => n + v.clips.length, 0),
    [libraryVideos]
  );

  const handleSubSectionsChange = (subSections: Record<string, OpponentSubSection>) => {
    updateMutation.mutate({ sub_sections: subSections });
    showToast('success', 'Guardado', 'Subsección actualizada.');
  };

  if (isLoading) {
    return <div className="text-brand-gray-muted p-8 text-center">Cargando mural...</div>;
  }

  if (!analysis) {
    return (
      <div className="text-center p-12">
        <p className="text-brand-gray-light text-lg">Análisis no encontrado.</p>
        <button onClick={() => navigate('/opponent-analysis')} className="btn-secondary mt-4">
          Volver a Análisis de Rivales
        </button>
      </div>
    );
  }

  const subSections = analysis.sub_sections || {};

  const startEditingGeneral = () => {
    setEditData(analysis);
    setStrengthsText((analysis.strengths || []).join('\n'));
    setWeaknessesText((analysis.weaknesses || []).join('\n'));
    setKeyPlayersText((analysis.key_players || []).join('\n'));
    setEditingGeneral(true);
  };

  const saveGeneral = () => {
    updateMutation.mutate(
      {
        general_board: editData.general_board,
        tactical_system: editData.tactical_system,
        observations: editData.observations,
        strengths: strengthsText.includes('\n') ? strengthsText.split('\n').map(s => s.replace(/^[•\-\d.\s]+/, '').trim()).filter(Boolean) : strengthsText.split(',').map(s => s.trim()).filter(Boolean),
        weaknesses: weaknessesText.includes('\n') ? weaknessesText.split('\n').map(s => s.replace(/^[•\-\d.\s]+/, '').trim()).filter(Boolean) : weaknessesText.split(',').map(s => s.trim()).filter(Boolean),
        key_players: keyPlayersText.includes('\n') ? keyPlayersText.split('\n').map(s => s.replace(/^[•\-\d.\s]+/, '').trim()).filter(Boolean) : keyPlayersText.split(',').map(s => s.trim()).filter(Boolean),
      },
      {
        onSuccess: () => {
          setEditingGeneral(false);
          showToast('success', 'Guardado', 'Aspectos generales actualizados.');
        },
      }
    );
  };

  const scrollTo = (anchor: string) => {
    document.getElementById(anchor)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const SectionTitle: React.FC<{ title: string; anchor: string; action?: React.ReactNode }> = ({ title, anchor, action }) => (
    <div id={anchor} className="flex justify-between items-end border-b border-brand-red-600/30 pb-3 mb-6 scroll-mt-24">
      <h2 className="text-xl font-bold text-brand-red-500 uppercase tracking-wider">{title}</h2>
      {action}
    </div>
  );

  return (
    <div className="max-w-[1700px] mx-auto pb-16">
      {/* Botón Volver */}
      <button
        onClick={() => navigate('/opponent-analysis')}
        className="flex items-center gap-2 text-sm text-brand-gray-muted hover:text-white transition-colors mb-4"
      >
        <ArrowLeft className="w-4 h-4" /> Volver al panel de análisis
      </button>

      {/* Cabecera premium */}
      <div className="bg-gradient-to-r from-brand-black to-brand-black-card border border-brand-black-border rounded-2xl p-6 sm:p-8 shadow-premium relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-red-600/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="relative z-10 flex flex-col md:flex-row justify-between md:items-end gap-6">
          <div>
            <p className="text-brand-red-500 text-xs font-bold uppercase tracking-widest mb-1">Mural de Análisis Táctico</p>
            <h1 className="text-3xl sm:text-4xl font-black text-white">{analysis.opponent}</h1>
          </div>
          <div className="flex items-center gap-3 flex-wrap">
            <div className="bg-brand-black border border-brand-black-border px-4 py-2 rounded-xl flex items-center gap-3">
              <TacticalIcon className="w-5 h-5 text-brand-red-600" />
              <span className="text-sm font-bold text-brand-gray-light">Sistema: {analysis.tactical_system}</span>
            </div>
            <div className="bg-brand-black border border-brand-black-border px-4 py-2 rounded-xl flex items-center gap-3">
              <Film className="w-5 h-5 text-brand-red-600" />
              <span className="text-sm font-bold text-brand-gray-light">{libraryVideos.length} vídeos · {totalClips} clips</span>
            </div>
          </div>
        </div>
      </div>

      {/* Navegación sticky */}
      <div className="sticky top-0 z-30 -mx-2 px-2 py-3 mt-4 mb-6 bg-brand-black/80 backdrop-blur-md border-b border-brand-black-border">
        <div className="flex gap-2 overflow-x-auto no-scrollbar">
          {NAV.map(n => {
            const Icon = n.icon;
            return (
              <button
                key={n.id}
                onClick={() => scrollTo(n.id)}
                className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors whitespace-nowrap"
              >
                <Icon className="w-3.5 h-3.5" /> {n.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Layout 2 columnas: contenido + videoteca */}
      <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6 items-start">
        {/* ===== Columna principal ===== */}
        <div className="min-w-0">
          {/* 1. Aspectos Generales */}
          <div className="mb-14">
            <SectionTitle
              title="Aspectos Generales"
              anchor="generales"
              action={canEdit && (
                editingGeneral ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingGeneral(false)} className="btn-secondary py-1.5 text-xs px-3"><X className="w-3.5 h-3.5 mr-1" /> Cancelar</button>
                    <button onClick={saveGeneral} disabled={updateMutation.isPending} className="btn-primary py-1.5 text-xs px-3"><Save className="w-3.5 h-3.5 mr-1" /> Guardar</button>
                  </div>
                ) : (
                  <button onClick={startEditingGeneral} className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                )
              )}
            />

            {editingGeneral ? (
              <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="md:col-span-2">
                    <label className="form-label">Alineación / Sistema de Juego (arrastra los jugadores)</label>
                    <FormationPitch value={formation} onChange={handleFormationChange} opponentName={analysis.opponent} rosterPlayers={analysis.roster_comments || []} />
                  </div>
                  <div className="space-y-4">
                    <div>
                      <label className="form-label flex items-center gap-2"><TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistema Táctico</label>
                      <input type="text" className="form-input" value={editData.tactical_system || ''} onChange={e => setEditData({ ...editData, tactical_system: e.target.value })} />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas (Una por línea)</label>
                      <textarea className="form-input flex-1 min-h-[120px] resize-none" value={strengthsText} onChange={e => setStrengthsText(e.target.value)} />
                    </div>
                    <div className="flex-1 flex flex-col">
                      <label className="form-label flex items-center gap-2"><ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades (Una por línea)</label>
                      <textarea className="form-input flex-1 min-h-[120px] resize-none" value={weaknessesText} onChange={e => setWeaknessesText(e.target.value)} />
                    </div>
                  </div>
                </div>
                <div>
                  <label className="form-label flex items-center gap-2"><FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones Generales</label>
                  <textarea className="form-input h-28 resize-none" value={editData.observations || ''} onChange={e => setEditData({ ...editData, observations: e.target.value })} />
                </div>

                {/* Sistemas de juego alternativos */}
                <div className="border-t border-brand-black-border pt-5">
                  <label className="form-label flex items-center gap-2"><TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistemas de juego alternativos</label>
                  <p className="text-[11px] text-brand-gray-muted mb-3">Variantes al sistema principal (repliegue, con balón, etc.). Se muestran en campogramas pequeños.</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {altFormations.map((f, idx) => (
                      <div key={idx} className="bg-brand-black border border-brand-black-border rounded-xl p-3 space-y-2">
                        <div className="flex items-center gap-1.5">
                          <input
                            type="text"
                            value={f.label || ''}
                            onChange={e => updateAltFormation(idx, { label: e.target.value })}
                            placeholder="Nombre de la alternativa"
                            className="flex-1 min-w-0 bg-black border border-brand-black-border rounded px-2 py-1 text-xs text-brand-gray-light outline-none focus:border-brand-red-600"
                          />
                          <button type="button" onClick={() => removeAltFormation(idx)} className="p-1 text-brand-gray-muted hover:text-brand-red-600 shrink-0"><Trash2 className="w-3.5 h-3.5" /></button>
                        </div>
                        <FormationPitch compact value={f} onChange={data => updateAltFormation(idx, data)} opponentName={analysis.opponent} rosterPlayers={analysis.roster_comments || []} />
                      </div>
                    ))}
                    <button
                      type="button"
                      onClick={addAltFormation}
                      className="flex flex-col items-center justify-center gap-2 min-h-[160px] border-2 border-dashed border-brand-black-border rounded-xl text-brand-gray-muted hover:text-white hover:border-brand-red-600 transition-colors"
                    >
                      <Plus className="w-6 h-6" />
                      <span className="text-xs font-semibold">Añadir alternativa</span>
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 bg-brand-black-card border border-brand-black-border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2">
                      <TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistema de Juego
                    </h4>
                    {formation.system !== 'Libre' && (
                      <span className="text-[11px] font-bold text-brand-red-500 bg-brand-red-600/10 border border-brand-red-600/20 px-2.5 py-1 rounded-full">{formation.system}</span>
                    )}
                  </div>
                  <FormationPitch value={formation} onChange={handleFormationChange} readOnly={!canEdit} opponentName={analysis.opponent} rosterPlayers={analysis.roster_comments || []} />
                </div>
                <div className="lg:col-span-1 flex flex-col gap-6">
                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 flex-1 min-h-[120px] overflow-y-auto no-scrollbar flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3 shrink-0"><ShieldAlert className="w-4 h-4 text-brand-red-600" /> Fortalezas</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.strengths.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguna</span> : analysis.strengths.map((s, i) => (
                        <span key={i} className="text-[11px] bg-red-950/20 text-brand-red-500 border border-brand-red-600/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>
                  <div className="bg-brand-black border border-brand-black-border rounded-xl p-5 flex-1 min-h-[120px] overflow-y-auto no-scrollbar flex flex-col">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3 shrink-0"><ShieldAlert className="w-4 h-4 text-amber-500" /> Debilidades</h4>
                    <div className="flex flex-wrap gap-2">
                      {analysis.weaknesses.length === 0 ? <span className="text-xs text-brand-gray-dark">Ninguna</span> : analysis.weaknesses.map((s, i) => (
                        <span key={i} className="text-[11px] bg-amber-950/20 text-amber-500 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium">{s}</span>
                      ))}
                    </div>
                  </div>

                  {analysis.observations && (
                    <div className="bg-brand-black border border-brand-black-border rounded-xl p-5">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-3"><FileText className="w-4 h-4 text-brand-gray-light" /> Observaciones</h4>
                      <p className="text-sm text-brand-gray-light whitespace-pre-wrap leading-relaxed">{analysis.observations}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Sistemas de juego alternativos (vista) */}
              {altFormations.length > 0 && (
                <div className="mt-6 bg-brand-black-card border border-brand-black-border rounded-xl p-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-brand-gray-muted flex items-center gap-2 mb-4">
                    <TacticalIcon className="w-4 h-4 text-brand-red-600" /> Sistemas de juego alternativos
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                    {altFormations.map((f, idx) => (
                      <div key={idx} className="flex flex-col items-center gap-2">
                        <FormationPitch compact readOnly value={f} onChange={() => {}} opponentName={analysis.opponent} rosterPlayers={analysis.roster_comments || []} />
                        <span className="text-[11px] font-semibold text-brand-gray-light text-center leading-tight">{f.label || f.system}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              </>
            )}
          </div>

          {/* 2. Jugadores Destacados */}
          <div className="mb-14">
            <SectionTitle
              title="Jugadores Destacados"
              anchor="jugadores"
              action={canEdit && (
                editingRoster ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => setEditingRoster(false)} className="btn-secondary py-1.5 text-xs px-3"><X className="w-3.5 h-3.5 mr-1" /> Cancelar</button>
                    <button
                      onClick={() => updateMutation.mutate({ roster_comments: editData.roster_comments }, { onSuccess: () => { setEditingRoster(false); showToast('success', 'Guardado', 'Jugadores actualizados.'); } })}
                      disabled={updateMutation.isPending}
                      className="btn-primary py-1.5 text-xs px-3"
                    >
                      <Save className="w-3.5 h-3.5 mr-1" /> Guardar
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setEditData(analysis); setEditingRoster(true); }} className="flex items-center gap-1.5 text-xs font-semibold text-brand-gray-muted bg-brand-black-card border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-white hover:border-brand-red-600 transition-colors">
                    <Edit2 className="w-3 h-3" /> Editar
                  </button>
                )
              )}
            />

            {editingRoster ? (
              <div className="bg-brand-black-card border border-brand-black-border rounded-xl p-6 shadow-premium h-[600px]">
                <OpponentRosterManager players={editData.roster_comments || []} onChange={players => setEditData({ ...editData, roster_comments: players })} opponentName={analysis.opponent} />
              </div>
            ) : (!analysis.roster_comments || analysis.roster_comments.length === 0) ? (
              <div className="text-center py-12 text-brand-gray-muted text-sm border border-dashed border-brand-black-border rounded-xl">No hay jugadores destacados.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {analysis.roster_comments.map(player => (
                  <div key={player.id} className="bg-brand-black-card border border-brand-black-border rounded-xl p-4 flex flex-col gap-2">
                    <div className="flex items-center gap-3 border-b border-brand-black-border pb-2">
                      <div className="shrink-0 w-10 h-10 rounded-full bg-brand-black-card border border-brand-black-border flex items-center justify-center overflow-hidden">
                        {player.photo_url ? <img src={player.photo_url} alt={player.name} className="w-full h-full object-cover" /> : (
                          <div className="w-full h-full bg-brand-red-600/10 text-brand-red-500 font-bold flex items-center justify-center text-xs">{player.number || '-'}</div>
                        )}
                      </div>
                      <div className="flex-1">
                        <h5 className="text-sm font-bold text-white">{player.name}</h5>
                        <div className="flex gap-2 items-center mt-1">
                          {player.photo_url && player.number && <span className="text-[10px] text-brand-red-500 font-bold bg-brand-red-600/10 px-1.5 py-0.5 rounded">Nº {player.number}</span>}
                          <span className="text-[10px] text-brand-gray-muted font-mono uppercase bg-black px-1.5 py-0.5 rounded">{player.position || 'N/A'}</span>
                        </div>
                      </div>
                    </div>
                    <p className="text-xs text-brand-gray-light whitespace-pre-wrap leading-relaxed flex-1 pt-1">
                      {player.comments || <span className="italic text-brand-gray-dark">Sin comentarios adicionales.</span>}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 3, 4 y 5. Fases con subcategorías */}
          <div id="con_balon" className="scroll-mt-24">
            <PhaseSection phase="con_balon" subSections={subSections} libraryVideos={libraryVideos} canEdit={canEdit} onChange={handleSubSectionsChange} onUpdateLibraryVideos={handleLibraryChange} />
          </div>
          <div id="sin_balon" className="scroll-mt-24">
            <PhaseSection phase="sin_balon" subSections={subSections} libraryVideos={libraryVideos} canEdit={canEdit} onChange={handleSubSectionsChange} onUpdateLibraryVideos={handleLibraryChange} />
          </div>
          <div id="abp" className="scroll-mt-24">
            <PhaseSection phase="abp" subSections={subSections} libraryVideos={libraryVideos} canEdit={canEdit} onChange={handleSubSectionsChange} onUpdateLibraryVideos={handleLibraryChange} />
          </div>

          {/* 6. Presentación a pantalla completa */}
          <div id="presentacion" className="scroll-mt-24 mb-14">
            <SectionTitle title="Presentación" anchor="presentacion" />
            <OpponentPresentationBuilder
              analysis={analysis}
              presentations={presentations}
              libraryVideos={libraryVideos}
              canEdit={canEdit}
              onChange={handlePresentationsChange}
            />
          </div>
        </div>

        {/* ===== Rail Videoteca ===== */}
        <div id="videoteca" className="xl:sticky xl:top-20 scroll-mt-24">
          <OpponentVideoLibrary videos={libraryVideos} onChange={handleLibraryChange} canEdit={canEdit} />
        </div>
      </div>
    </div>
  );
};
