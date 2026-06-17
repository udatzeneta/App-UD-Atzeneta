import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataService } from '../services/data';
import { usePermissions } from '../hooks/usePermissions';
import { useToast } from '../context/ToastContext';
import { CardSkeleton } from '../components/Skeletons';
import { Modal } from '../components/Modal';
import { ScoutingPlayer, TacticalPlayer, TacticalBoard } from '../types';
import { FFCV_PLAYERS, FFCVPlayer } from '../services/ffcvPlayers';
import { exportToCSV, exportToPDF, ExportCell } from '../utils/export';
import {
  Search, Plus, Star, Edit2, Trash2, Download, FileText,
  MapPin, User, MessageSquare, Users, Layout, Save, RefreshCw,
  PlusCircle, Check
} from 'lucide-react';

// Formaciones y sus coordenadas tácticas (X, Y en porcentajes 0-100 para campo vertical)
const FORMATIONS_SLOTS: Record<string, { role: string; x: number; y: number }[]> = {
  '4-4-2': [
    { role: 'Portero', x: 50, y: 88 },
    { role: 'Defensa Izquierdo', x: 18, y: 68 },
    { role: 'Central Izquierdo', x: 38, y: 71 },
    { role: 'Central Derecho', x: 62, y: 71 },
    { role: 'Defensa Derecho', x: 82, y: 68 },
    { role: 'Medio Izquierdo', x: 18, y: 44 },
    { role: 'Medio Centro Izq.', x: 38, y: 46 },
    { role: 'Medio Centro Der.', x: 62, y: 46 },
    { role: 'Medio Derecho', x: 82, y: 44 },
    { role: 'Delantero Izquierdo', x: 35, y: 20 },
    { role: 'Delantero Derecho', x: 65, y: 20 },
  ],
  '4-3-3': [
    { role: 'Portero', x: 50, y: 88 },
    { role: 'Defensa Izquierdo', x: 18, y: 68 },
    { role: 'Central Izquierdo', x: 38, y: 71 },
    { role: 'Central Derecho', x: 62, y: 71 },
    { role: 'Defensa Derecho', x: 82, y: 68 },
    { role: 'Volante Izquierdo', x: 28, y: 46 },
    { role: 'Pivote Defensivo', x: 50, y: 53 },
    { role: 'Volante Derecho', x: 72, y: 46 },
    { role: 'Extremo Izquierdo', x: 22, y: 22 },
    { role: 'Delantero Centro', x: 50, y: 16 },
    { role: 'Extremo Derecho', x: 78, y: 22 },
  ],
  '3-5-2': [
    { role: 'Portero', x: 50, y: 88 },
    { role: 'Central Izquierdo', x: 28, y: 71 },
    { role: 'Central Líbano', x: 50, y: 73 },
    { role: 'Central Derecho', x: 72, y: 71 },
    { role: 'Carrilero Izquierdo', x: 15, y: 46 },
    { role: 'Volante Izquierdo', x: 35, y: 49 },
    { role: 'Pivote Organizador', x: 50, y: 55 },
    { role: 'Volante Derecho', x: 65, y: 49 },
    { role: 'Carrilero Derecho', x: 85, y: 46 },
    { role: 'Delantero Izquierdo', x: 35, y: 20 },
    { role: 'Delantero Derecho', x: 65, y: 20 },
  ],
  '4-2-3-1': [
    { role: 'Portero', x: 50, y: 88 },
    { role: 'Defensa Izquierdo', x: 18, y: 68 },
    { role: 'Central Izquierdo', x: 38, y: 71 },
    { role: 'Central Derecho', x: 62, y: 71 },
    { role: 'Defensa Derecho', x: 82, y: 68 },
    { role: 'Medio Centro Def. 1', x: 35, y: 53 },
    { role: 'Medio Centro Def. 2', x: 65, y: 53 },
    { role: 'Medio Ofensivo Izq.', x: 20, y: 33 },
    { role: 'Medio Centro Of.', x: 50, y: 31 },
    { role: 'Medio Ofensivo Der.', x: 80, y: 33 },
    { role: 'Delantero Centro', x: 50, y: 14 },
  ],
};

export const Scouting: React.FC = () => {
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const { showToast } = useToast();
  const pitchRef = useRef<HTMLDivElement>(null);

  const canCreate = hasPermission('scouting', 'crear');
  const canEdit = hasPermission('scouting', 'editar');
  const canDelete = hasPermission('scouting', 'eliminar');
  const canExport = hasPermission('scouting', 'exportar');

  // Pestañas
  const [activeTab, setActiveTab] = useState<'wallet' | 'league' | 'pitch'>('wallet');

  // Filtros de Cartera
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingPlayer, setEditingPlayer] = useState<ScoutingPlayer | null>(null);

  // Campos formulario Cartera
  const [playerName, setPlayerName] = useState('');
  const [team, setTeam] = useState('');
  const [age, setAge] = useState('');
  const [position, setPosition] = useState('');
  const [rating, setRating] = useState(3);
  const [notes, setNotes] = useState('');

  // Filtros de Liga
  const [leagueSearch, setLeagueSearch] = useState('');
  const [teamFilter, setTeamFilter] = useState<'all' | 'local' | 'visitante'>('all');
  const [posFilter, setPosFilter] = useState<string>('all');

  // Estados del Tablero Táctico
  const [boardFormation, setBoardFormation] = useState<string>('Libre');
  const [activeDragId, setActiveDragId] = useState<string | null>(null);
  const [selectedFieldPlayer, setSelectedFieldPlayer] = useState<TacticalPlayer | null>(null);
  const [isFieldPlayerModalOpen, setIsFieldPlayerModalOpen] = useState(false);
  const [fieldPlayerComment, setFieldPlayerComment] = useState('');

  // Modales de asignación rápida en Campo
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [placementPlayer, setPlacementPlayer] = useState<{
    id: string;
    nombre: string;
    foto: string;
    team: string;
    posicion: string;
    posicion_abbr: string;
    dorsal: number;
  } | null>(null);
  const [placementComment, setPlacementComment] = useState('');

  // Query Cartera
  const { data: scoutingList = [], isLoading } = useQuery({
    queryKey: ['scouting'],
    queryFn: () => dataService.getScouting()
  });

  // Query Tablero Táctico
  const { data: tacticalBoard } = useQuery<TacticalBoard>({
    queryKey: ['tacticalBoard'],
    queryFn: () => dataService.getTacticalBoard()
  });

  // Estado local para los jugadores colocados en el campo táctico (campograma)
  const [boardPlayers, setBoardPlayers] = useState<TacticalPlayer[]>([]);

  useEffect(() => {
    if (tacticalBoard) {
      setBoardPlayers(tacticalBoard.players || []);
      setBoardFormation(tacticalBoard.formation || 'Libre');
    }
  }, [tacticalBoard]);

  // Mutaciones Cartera
  const createMutation = useMutation({
    mutationFn: (item: Omit<ScoutingPlayer, 'id'>) => dataService.createScouting(item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Candidato agregado', 'Se ha registrado el perfil de scouting.');
      handleCloseModal();
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, item }: { id: string; item: Partial<ScoutingPlayer> }) => dataService.updateScouting(id, item),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Perfil actualizado', 'Se guardaron las modificaciones del candidato.');
      handleCloseModal();
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => dataService.deleteScouting(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['scouting'] });
      showToast('success', 'Perfil eliminado', 'Se ha retirado al jugador de la lista.');
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  // Mutación Tablero Táctico
  const saveBoardMutation = useMutation({
    mutationFn: (board: TacticalBoard) => dataService.saveTacticalBoard(board),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tacticalBoard'] });
      showToast('success', 'Campograma guardado', 'La alineación y los comentarios tácticos se guardaron con éxito.');
    },
    onError: (err: any) => showToast('error', 'Error', err.message)
  });

  // Drag and Drop (Mouse / Touch)
  const handleMouseDown = (e: React.MouseEvent, playerId: string) => {
    e.preventDefault();
    setActiveDragId(playerId);
  };

  const handleTouchStart = (_e: React.TouchEvent, playerId: string) => {
    setActiveDragId(playerId);
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!activeDragId || !pitchRef.current) return;

      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((e.clientX - rect.left) / rect.width) * 100;
      let y = ((e.clientY - rect.top) / rect.height) * 100;

      // Mantener dentro del campo
      x = Math.max(3, Math.min(97, x));
      y = Math.max(3, Math.min(97, y));

      setBoardPlayers(prev =>
        prev.map(p => (p.id === activeDragId ? { ...p, x: Math.round(x), y: Math.round(y) } : p))
      );
      setBoardFormation('Libre');
    };

    const handleMouseUp = () => {
      setActiveDragId(null);
    };

    if (activeDragId) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [activeDragId]);

  useEffect(() => {
    const handleTouchMove = (e: TouchEvent) => {
      if (!activeDragId || !pitchRef.current) return;

      const touch = e.touches[0];
      const rect = pitchRef.current.getBoundingClientRect();
      let x = ((touch.clientX - rect.left) / rect.width) * 100;
      let y = ((touch.clientY - rect.top) / rect.height) * 100;

      x = Math.max(3, Math.min(97, x));
      y = Math.max(3, Math.min(97, y));

      setBoardPlayers(prev =>
        prev.map(p => (p.id === activeDragId ? { ...p, x: Math.round(x), y: Math.round(y) } : p))
      );
      setBoardFormation('Libre');
    };

    const handleTouchEnd = () => {
      setActiveDragId(null);
    };

    if (activeDragId) {
      document.addEventListener('touchmove', handleTouchMove);
      document.addEventListener('touchend', handleTouchEnd);
    }

    return () => {
      document.removeEventListener('touchmove', handleTouchMove);
      document.removeEventListener('touchend', handleTouchEnd);
    };
  }, [activeDragId]);

  // Formulario Cartera
  const handleOpenCreateModal = () => {
    setEditingPlayer(null);
    setPlayerName('');
    setTeam('');
    setAge('22');
    setPosition('Extremo Derecho');
    setRating(3);
    setNotes('');
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (p: ScoutingPlayer) => {
    setEditingPlayer(p);
    setPlayerName(p.player_name);
    setTeam(p.team);
    setAge(String(p.age || ''));
    setPosition(p.position);
    setRating(p.rating);
    setNotes(p.notes);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingPlayer(null);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!playerName.trim()) {
      showToast('error', 'Validación', 'El nombre del jugador es obligatorio.');
      return;
    }
    if (!team.trim()) {
      showToast('error', 'Validación', 'El club de procedencia es obligatorio.');
      return;
    }
    if (!position.trim()) {
      showToast('error', 'Validación', 'La demarcación o posición es obligatoria.');
      return;
    }

    const payload = {
      player_name: playerName.trim(),
      team: team.trim(),
      age: age ? Number(age) : 0,
      position: position.trim(),
      rating,
      notes: notes.trim()
    };

    if (editingPlayer) {
      updateMutation.mutate({ id: editingPlayer.id, item: payload });
    } else {
      createMutation.mutate(payload);
    }
  };

  const handleDelete = (id: string) => {
    if (window.confirm('¿Estás seguro de que deseas eliminar este jugador de la lista de scouting?')) {
      deleteMutation.mutate(id);
    }
  };

  // Filtrado Cartera
  const filteredList = scoutingList.filter(p => {
    const term = search.toLowerCase();
    return (
      p.player_name.toLowerCase().includes(term) ||
      p.team.toLowerCase().includes(term) ||
      p.position.toLowerCase().includes(term)
    );
  });

  // Filtrado de la Liga
  const filteredLeaguePlayers = FFCV_PLAYERS.filter(p => {
    const term = leagueSearch.toLowerCase();
    const matchesSearch =
      p.nombre.toLowerCase().includes(term) ||
      p.nombre_completo.toLowerCase().includes(term) ||
      p.posicion.toLowerCase().includes(term);

    const matchesTeam =
      teamFilter === 'all' ||
      (teamFilter === 'local' && p.equipo.includes("Roda")) ||
      (teamFilter === 'visitante' && p.equipo.includes("Atzeneta"));

    let matchesPos = true;
    if (posFilter !== 'all') {
      if (posFilter === 'Portero') matchesPos = p.portero;
      else if (posFilter === 'Defensa') matchesPos = p.posicion.includes('Defensa') || p.posicion.includes('Lateral') || p.posicion.includes('Central');
      else if (posFilter === 'Medio') matchesPos = p.posicion.includes('Medio') || p.posicion.includes('Extremo') || p.posicion.includes('Volante');
      else if (posFilter === 'Delantero') matchesPos = p.posicion.includes('Delantero') || p.posicion.includes('Centro');
    }

    return matchesSearch && matchesTeam && matchesPos;
  });

  // Métodos de asignación al Campograma
  const handleOpenAssignModal = (player: any) => {
    setPlacementPlayer({
      id: player.id,
      nombre: player.nombre || player.player_name,
      foto: player.foto || '',
      team: player.equipo || player.team,
      posicion: player.posicion || player.position,
      posicion_abbr: player.posicion_abbr || (player.position ? player.position.substring(0, 3).toUpperCase() : 'JC'),
      dorsal: player.dorsal || 0
    });
    setPlacementComment('');
    setIsAssignModalOpen(true);
  };

  const handleConfirmPlacement = (e: React.FormEvent) => {
    e.preventDefault();
    if (!placementPlayer) return;

    // Verificar si ya está en el campo
    const exists = boardPlayers.some(p => p.id === placementPlayer.id);
    if (exists) {
      showToast('info', 'Campograma', 'Este jugador ya está en el campograma. Puedes arrastrarlo para cambiar su posición.');
      setIsAssignModalOpen(false);
      return;
    }

    // Posición inicial por defecto según su rol
    let initX = 50;
    let initY = 50;

    const role = placementPlayer.posicion_abbr;
    if (role === 'P') { initX = 50; initY = 88; }
    else if (['DFC', 'DF'].includes(role)) { initX = 50; initY = 70; }
    else if (role === 'LD') { initX = 80; initY = 68; }
    else if (role === 'LI') { initX = 20; initY = 68; }
    else if (['MC', 'MCD', 'MCO'].includes(role)) { initX = 50; initY = 46; }
    else if (role === 'MD') { initX = 80; initY = 44; }
    else if (role === 'MI') { initX = 20; initY = 44; }
    else if (role === 'ED') { initX = 78; initY = 22; }
    else if (role === 'EI') { initX = 22; initY = 22; }
    else if (role === 'DC') { initX = 50; initY = 16; }

    const newTacticalPlayer: TacticalPlayer = {
      ...placementPlayer,
      x: initX,
      y: initY,
      comment: placementComment.trim()
    };

    const updatedPlayers = [...boardPlayers, newTacticalPlayer];
    setBoardPlayers(updatedPlayers);
    setBoardFormation('Libre');
    setIsAssignModalOpen(false);
    showToast('success', 'Añadido al campo', `${placementPlayer.nombre} ha sido posicionado. Ve a la pestaña Tablero Táctico.`);
  };

  // Clonar jugador de liga a cartera personalizada
  const handleCloneToWallet = (lp: FFCVPlayer) => {
    const exists = scoutingList.some(p => p.player_name.toLowerCase() === lp.nombre.toLowerCase());
    if (exists) {
      showToast('info', 'Cartera', 'Este jugador ya está registrado en tu cartera de candidatos.');
      return;
    }

    createMutation.mutate({
      player_name: lp.nombre,
      team: lp.equipo,
      age: 22, // default
      position: lp.posicion,
      rating: 3,
      notes: lp.historial
    });
  };

  // Modificar formación táctica
  const handleFormationChange = (formation: string) => {
    setBoardFormation(formation);
    if (formation === 'Libre') return;

    const slots = FORMATIONS_SLOTS[formation];
    if (!slots) return;

    // Clasificar jugadores colocados para organizarlos de manera lógica
    const sorted = [...boardPlayers].sort((a, b) => {
      const getScore = (p: TacticalPlayer) => {
        if (p.posicion_abbr === 'P' || p.posicion.includes('Portero')) return 0;
        if (['DFC', 'LD', 'LI', 'DF'].includes(p.posicion_abbr) || p.posicion.includes('Defensa') || p.posicion.includes('Lateral') || p.posicion.includes('Central')) return 1;
        if (['MC', 'MD', 'MI', 'ED', 'EI', 'MCO', 'MCD', 'VOL'].includes(p.posicion_abbr) || p.posicion.includes('Medio') || p.posicion.includes('Extremo') || p.posicion.includes('Volante') || p.posicion.includes('Pivote')) return 2;
        return 3;
      };
      return getScore(a) - getScore(b);
    });

    const repositioned = sorted.map((p, idx) => {
      if (idx < slots.length) {
        return {
          ...p,
          x: slots[idx].x,
          y: slots[idx].y
        };
      }
      return p;
    });

    setBoardPlayers(repositioned);
  };

  // Limpiar tablero táctico
  const handleClearBoard = () => {
    if (window.confirm('¿Deseas retirar a todos los jugadores del campograma?')) {
      setBoardPlayers([]);
      setBoardFormation('Libre');
    }
  };

  // Guardar alineación táctica
  const handleSaveBoard = () => {
    saveBoardMutation.mutate({
      id: 'scouting',
      name: 'Tablero de Scouting',
      formation: boardFormation,
      players: boardPlayers
    });
  };

  // Editar jugador del campograma
  const handleFieldPlayerClick = (p: TacticalPlayer) => {
    setSelectedFieldPlayer(p);
    setFieldPlayerComment(p.comment || '');
    setIsFieldPlayerModalOpen(true);
  };

  const handleSaveFieldPlayerComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFieldPlayer) return;

    const updated = boardPlayers.map(p =>
      p.id === selectedFieldPlayer.id ? { ...p, comment: fieldPlayerComment.trim() } : p
    );
    setBoardPlayers(updated);
    setIsFieldPlayerModalOpen(false);
    showToast('success', 'Comentario Guardado', 'Se actualizó la anotación del jugador.');
  };

  const handleRemoveFromField = (id: string) => {
    setBoardPlayers(prev => prev.filter(p => p.id !== id));
    setIsFieldPlayerModalOpen(false);
    showToast('success', 'Retirado', 'Jugador retirado del campograma.');
  };

  // Exportar Cartera
  const exportHeaders = ['Jugador', 'Equipo', 'Edad', 'Posición', 'Valoración', 'Notas'];
  const buildExportRows = (): ExportCell[][] =>
    filteredList.map(p => [
      p.player_name,
      p.team,
      p.age,
      p.position,
      `${p.rating}/5`,
      p.notes,
    ]);

  const handleExportCSV = () => {
    if (filteredList.length === 0) {
      showToast('info', 'Exportar', 'No hay candidatos en la lista para exportar.');
      return;
    }
    exportToCSV(`scouting_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'CSV Descargado', 'Exportada la cartera de scouting.');
  };

  const handleExportPDF = async () => {
    if (filteredList.length === 0) {
      showToast('info', 'Exportar', 'No hay candidatos en la lista para exportar.');
      return;
    }
    await exportToPDF('Scouting UD Atzeneta', `scouting_atzeneta_${Date.now()}`, exportHeaders, buildExportRows());
    showToast('success', 'PDF Descargado', 'Exportada la cartera de scouting en PDF.');
  };

  return (
    <div className="space-y-6">
      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-brand-gray-light">Cartera de Scouting y Táctica</h2>
          <p className="text-sm text-brand-gray-muted mt-1">
            Fichas de candidatos, base de datos de la liga y campograma interactivo para diseño de alineaciones.
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canExport && activeTab === 'wallet' && (
            <>
              <button onClick={handleExportCSV} className="btn-secondary py-2 text-xs">
                <Download className="w-3.5 h-3.5" /> CSV
              </button>
              <button onClick={handleExportPDF} className="btn-secondary py-2 text-xs">
                <FileText className="w-3.5 h-3.5" /> PDF
              </button>
            </>
          )}
          {canCreate && activeTab === 'wallet' && (
            <button onClick={handleOpenCreateModal} className="btn-primary py-2 text-xs font-semibold">
              <Plus className="w-3.5 h-3.5" /> Registrar Candidato
            </button>
          )}
          {activeTab === 'pitch' && (
            <button
              onClick={handleSaveBoard}
              disabled={saveBoardMutation.isPending}
              className="btn-primary py-2 text-xs font-semibold"
            >
              <Save className="w-3.5 h-3.5" /> {saveBoardMutation.isPending ? 'Guardando...' : 'Guardar Alineación'}
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-brand-black-border flex gap-1">
        <button
          onClick={() => setActiveTab('wallet')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'wallet'
              ? 'border-brand-red-600 text-brand-gray-light bg-brand-black-card/30'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <User className="w-4 h-4" /> Cartera de Scouting
        </button>
        <button
          onClick={() => setActiveTab('league')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'league'
              ? 'border-brand-red-600 text-brand-gray-light bg-brand-black-card/30'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <Users className="w-4 h-4" /> Base de Datos de la Liga
        </button>
        <button
          onClick={() => setActiveTab('pitch')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-all duration-200 flex items-center gap-2 ${
            activeTab === 'pitch'
              ? 'border-brand-red-600 text-brand-gray-light bg-brand-black-card/30'
              : 'border-transparent text-brand-gray-muted hover:text-brand-gray-light'
          }`}
        >
          <Layout className="w-4 h-4" /> Tablero Táctico (Campograma)
        </button>
      </div>

      {/* =====================================================================
          TAB 1: CARTERA DE SCOUTING
          ===================================================================== */}
      {activeTab === 'wallet' && (
        <div className="space-y-6">
          {/* Buscador */}
          <div className="relative bg-brand-black border border-brand-black-border p-4 rounded-xl">
            <Search className="absolute left-7 top-6.5 w-4 h-4 text-brand-gray-dark" />
            <input
              type="text"
              className="form-input pl-10 w-full"
              placeholder="Buscar por nombre, club o demarcación..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* Listado de Jugadores */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          ) : filteredList.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No se registran candidatos en la base de datos.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredList.map((player) => (
                <div
                  key={player.id}
                  className="dashboard-card flex flex-col justify-between hover:scale-[1.005] hover:shadow-glow-red/5 transition-all duration-200"
                >
                  <div>
                    {/* Cabecera Ficha */}
                    <div className="flex justify-between items-start border-b border-brand-black-border pb-3 mb-3">
                      <div>
                        <h3 className="text-base font-bold text-brand-gray-light">{player.player_name}</h3>
                        <span className="text-[10px] bg-brand-red-600/10 text-brand-red-600 px-2 py-0.5 rounded font-semibold inline-block mt-1">
                          {player.position}
                        </span>
                      </div>

                      {/* Valoración Estrellas */}
                      <div className="flex gap-0.5 text-yellow-500">
                        {Array.from({ length: 5 }).map((_, sIdx) => (
                          <Star
                            key={sIdx}
                            className={`w-4 h-4 ${sIdx < player.rating ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`}
                          />
                        ))}
                      </div>
                    </div>

                    {/* Info Rápida */}
                    <div className="grid grid-cols-2 gap-3 text-xs text-brand-gray-muted mb-4 bg-brand-black/30 p-2.5 rounded-lg border border-brand-black-border/50">
                      <div className="flex items-center gap-1.5 truncate">
                        <MapPin className="w-3.5 h-3.5 text-brand-red-600 shrink-0" />
                        <span className="truncate">{player.team}</span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-brand-red-600 shrink-0" />
                        <span>{player.age ? `${player.age} años` : 'Edad desconocida'}</span>
                      </div>
                    </div>

                    {/* Notas de scouting */}
                    {player.notes && (
                      <div className="space-y-1.5 mb-4">
                        <span className="text-[10px] uppercase font-semibold text-brand-gray-muted flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-brand-red-600" /> Notas de Seguimiento
                        </span>
                        <p className="text-xs text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-2.5 rounded border border-brand-black-border">
                          {player.notes}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones de Tarjeta */}
                  <div className="flex justify-between items-center border-t border-brand-black-border pt-3 mt-4">
                    <button
                      onClick={() => handleOpenAssignModal(player)}
                      className="text-xs text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 px-3 py-1.5 rounded-lg hover:bg-emerald-900/30 flex items-center gap-1 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Posicionar en Campo
                    </button>

                    <div className="flex gap-2">
                      {canEdit && (
                        <button
                          onClick={() => handleOpenEditModal(player)}
                          className="text-xs text-brand-gray-muted bg-brand-black-bg border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-brand-gray-light flex items-center gap-1"
                        >
                          <Edit2 className="w-3.5 h-3.5" /> Editar
                        </button>
                      )}
                      {canDelete && (
                        <button
                          onClick={() => handleDelete(player.id)}
                          className="text-xs text-brand-gray-muted bg-brand-black-bg border border-brand-black-border px-3 py-1.5 rounded-lg hover:text-brand-red-600 flex items-center gap-1"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Eliminar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 2: BASE DE DATOS DE LA LIGA (FFCV)
          ===================================================================== */}
      {activeTab === 'league' && (
        <div className="space-y-6">
          {/* Panel de Filtros */}
          <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl grid grid-cols-1 md:grid-cols-4 gap-3">
            <div className="md:col-span-2 relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-brand-gray-dark" />
              <input
                type="text"
                className="form-input pl-9 w-full"
                placeholder="Buscar por nombre o posición..."
                value={leagueSearch}
                onChange={(e) => setLeagueSearch(e.target.value)}
              />
            </div>

            <div>
              <select
                className="form-input w-full"
                value={teamFilter}
                onChange={(e: any) => setTeamFilter(e.target.value)}
              >
                <option value="all">Todos los Equipos</option>
                <option value="local">C.D. Roda B</option>
                <option value="visitante">U.D. Atzeneta de Castellón A</option>
              </select>
            </div>

            <div>
              <select
                className="form-input w-full"
                value={posFilter}
                onChange={(e) => setPosFilter(e.target.value)}
              >
                <option value="all">Todas las Posiciones</option>
                <option value="Portero">Porteros</option>
                <option value="Defensa">Defensas</option>
                <option value="Medio">Centrocampistas</option>
                <option value="Delantero">Delanteros</option>
              </select>
            </div>
          </div>

          {/* Listado Liga */}
          {filteredLeaguePlayers.length === 0 ? (
            <div className="bg-brand-black border border-brand-black-border p-12 rounded-xl text-center">
              <p className="text-sm text-brand-gray-muted">No se encontraron jugadores de la liga con los filtros seleccionados.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredLeaguePlayers.map((player) => (
                <div
                  key={player.id}
                  className="dashboard-card flex flex-col justify-between bg-brand-black-card border border-brand-black-border hover:border-brand-red-600/30 transition-all duration-200"
                >
                  <div>
                    {/* Ficha Cabecera */}
                    <div className="flex gap-3 pb-3 mb-3 border-b border-brand-black-border">
                      <div className="w-12 h-12 bg-brand-black rounded-lg border border-brand-black-border overflow-hidden shrink-0 flex items-center justify-center">
                        {player.foto ? (
                          <img src={player.foto} alt={player.nombre} className="w-full h-full object-cover" />
                        ) : (
                          <User className="w-6 h-6 text-brand-gray-dark" />
                        )}
                      </div>
                      <div>
                        <h4 className="text-sm font-bold text-brand-gray-light leading-tight">{player.nombre}</h4>
                        <div className="flex items-center gap-1.5 mt-1">
                          <span className="text-[10px] bg-brand-black-border text-brand-gray-light px-1.5 py-0.5 rounded font-mono font-bold">
                            #{player.dorsal}
                          </span>
                          <span className="text-[9px] bg-brand-red-600/10 text-brand-red-600 px-1.5 py-0.5 rounded font-semibold">
                            {player.posicion}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Datos procedencia */}
                    <div className="text-[11px] text-brand-gray-muted mb-3 space-y-1 bg-brand-black/25 p-2 rounded">
                      <div>
                        <span className="font-semibold text-brand-gray-dark">Club:</span> {player.equipo}
                      </div>
                      <div>
                        <span className="font-semibold text-brand-gray-dark">Titularidad:</span> {player.titular ? 'Titular en acta' : 'Suplente en acta'}
                      </div>
                    </div>

                    {/* Historial Técnico / Eventos */}
                    {player.historial && (
                      <div className="space-y-1 text-xs mb-4">
                        <span className="text-[9px] uppercase font-bold text-brand-gray-muted flex items-center gap-1">
                          <MessageSquare className="w-3 h-3 text-brand-red-600" /> Reporte de Actuación
                        </span>
                        <p className="text-[11px] text-brand-gray-light leading-relaxed bg-brand-black-bg/50 p-2 rounded border border-brand-black-border/60">
                          {player.historial}
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Acciones */}
                  <div className="flex justify-between items-center pt-3 border-t border-brand-black-border">
                    <button
                      onClick={() => handleOpenAssignModal(player)}
                      className="text-[11px] text-emerald-400 bg-emerald-950/20 border border-emerald-900/40 px-2.5 py-1.5 rounded-lg hover:bg-emerald-900/30 flex items-center gap-1 transition-all"
                    >
                      <PlusCircle className="w-3.5 h-3.5" /> Al Campo
                    </button>

                    <button
                      onClick={() => handleCloneToWallet(player)}
                      className="text-[11px] text-brand-red-600 bg-brand-red-600/10 border border-brand-red-600/20 px-2.5 py-1.5 rounded-lg hover:bg-brand-red-600/20 flex items-center gap-1 transition-all"
                    >
                      <Plus className="w-3.5 h-3.5" /> Agregar a Scouting
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          TAB 3: TABLERO TÁCTICO (CAMPOGRAMA)
          ===================================================================== */}
      {activeTab === 'pitch' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Panel Lateral: Jugadores Disponibles para ubicar */}
          <div className="lg:col-span-1 bg-brand-black border border-brand-black-border p-4 rounded-xl space-y-4">
            <div>
              <h3 className="font-bold text-brand-gray-light text-base">Jugadores Disponibles</h3>
              <p className="text-xs text-brand-gray-muted mt-1">
                Haz clic en el botón verde de cualquier jugador para posicionarlo en el campograma.
              </p>
            </div>

            {/* Listado en miniatura scrollable */}
            <div className="space-y-2 max-h-[550px] overflow-y-auto pr-1">
              {/* Combinamos ambos listados en la UI lateral para conveniencia */}
              <div className="space-y-1.5">
                <span className="text-[10px] uppercase font-bold text-brand-red-600 tracking-wider">Cartera de Scouting</span>
                {scoutingList.length === 0 ? (
                  <p className="text-[11px] text-brand-gray-dark italic px-2">No hay candidatos.</p>
                ) : (
                  scoutingList.map(p => {
                    const isPlaced = boardPlayers.some(bp => bp.id === p.id);
                    return (
                      <div key={p.id} className="flex justify-between items-center bg-brand-black-card border border-brand-black-border p-2 rounded text-xs">
                        <div className="truncate">
                          <span className="font-bold text-brand-gray-light block truncate">{p.player_name}</span>
                          <span className="text-[10px] text-brand-gray-muted">{p.position} ({p.team})</span>
                        </div>
                        <button
                          onClick={() => handleOpenAssignModal(p)}
                          disabled={isPlaced}
                          className={`px-2 py-1 rounded text-[10px] flex items-center gap-0.5 transition-all ${
                            isPlaced
                              ? 'bg-brand-black text-brand-gray-dark pointer-events-none'
                              : 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-900/60'
                          }`}
                        >
                          {isPlaced ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                          {isPlaced ? 'En Campo' : 'Ubicar'}
                        </button>
                      </div>
                    );
                  })
                )}
              </div>

              <div className="space-y-1.5 pt-3 border-t border-brand-black-border">
                <span className="text-[10px] uppercase font-bold text-brand-red-600 tracking-wider">Plantilla de la Liga</span>
                {FFCV_PLAYERS.map(p => {
                  const isPlaced = boardPlayers.some(bp => bp.id === p.id);
                  return (
                    <div key={p.id} className="flex justify-between items-center bg-brand-black-card border border-brand-black-border p-2 rounded text-xs">
                      <div className="truncate">
                        <span className="font-bold text-brand-gray-light block truncate">{p.nombre}</span>
                        <span className="text-[10px] text-brand-gray-muted">{p.posicion} (#{p.dorsal})</span>
                      </div>
                      <button
                        onClick={() => handleOpenAssignModal(p)}
                        disabled={isPlaced}
                        className={`px-2 py-1 rounded text-[10px] flex items-center gap-0.5 transition-all ${
                          isPlaced
                            ? 'bg-brand-black text-brand-gray-dark pointer-events-none'
                            : 'bg-emerald-900/40 text-emerald-400 hover:bg-emerald-900/60 border border-emerald-900/60'
                        }`}
                      >
                        {isPlaced ? <Check className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
                        {isPlaced ? 'En Campo' : 'Ubicar'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Panel Central y Derecho: Campograma (Campo de Juego) */}
          <div className="lg:col-span-2 space-y-4">
            {/* Controles de Formación */}
            <div className="bg-brand-black border border-brand-black-border p-4 rounded-xl flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <label className="text-sm font-semibold text-brand-gray-light flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4 text-brand-red-600" /> Esquema / Formación:
                </label>
                <select
                  value={boardFormation}
                  onChange={(e) => handleFormationChange(e.target.value)}
                  className="form-input bg-brand-black-bg border-brand-black-border py-1.5 text-xs w-36"
                >
                  <option value="Libre">Libre (Arrastrar)</option>
                  <option value="4-4-2">4-4-2</option>
                  <option value="4-3-3">4-3-3</option>
                  <option value="3-5-2">3-5-2</option>
                  <option value="4-2-3-1">4-2-3-1</option>
                </select>
              </div>

              <div className="flex gap-2">
                <button
                  onClick={handleClearBoard}
                  className="btn-secondary py-1.5 px-3 text-xs text-red-400 hover:text-red-300"
                >
                  Limpiar Campo
                </button>
              </div>
            </div>

            {/* Campograma (Representación del campo) */}
            <div
              ref={pitchRef}
              className="relative w-full max-w-lg mx-auto aspect-[2/3] bg-gradient-to-b from-emerald-800 to-emerald-950 border-4 border-emerald-100/30 rounded-2xl overflow-hidden shadow-2xl select-none"
            >
              {/* Franjas del césped */}
              <div className="absolute inset-0 flex flex-col justify-between pointer-events-none opacity-5">
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
                <div className="h-[10%] bg-white w-full"></div>
                <div className="h-[10%] bg-transparent w-full"></div>
              </div>

              {/* Líneas tácticas del Campo */}
              {/* Línea de medio campo */}
              <div className="absolute top-1/2 left-0 right-0 h-[2px] bg-emerald-100/35 -translate-y-1/2"></div>
              {/* Círculo central */}
              <div className="absolute top-1/2 left-1/2 w-[30%] aspect-square border-2 border-emerald-100/35 rounded-full -translate-x-1/2 -translate-y-1/2"></div>
              <div className="absolute top-1/2 left-1/2 w-2 h-2 bg-emerald-100/40 rounded-full -translate-x-1/2 -translate-y-1/2"></div>

              {/* Área grande arriba */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-b-2 border-x-2 border-emerald-100/35"></div>
              {/* Área pequeña arriba */}
              <div className="absolute top-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-b-2 border-x-2 border-emerald-100/35"></div>
              {/* Semiarco arriba */}
              <div className="absolute top-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-b-2 border-emerald-100/35 rounded-b-full"></div>
              {/* Punto penal arriba */}
              <div className="absolute top-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/35 rounded-full -translate-x-1/2"></div>

              {/* Área grande abajo */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-3/5 h-[16%] border-t-2 border-x-2 border-emerald-100/35"></div>
              {/* Área pequeña abajo */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/3 h-[6%] border-t-2 border-x-2 border-emerald-100/35"></div>
              {/* Semiarco abajo */}
              <div className="absolute bottom-[16%] left-1/2 -translate-x-1/2 w-[20%] h-[7%] border-t-2 border-emerald-100/35 rounded-t-full"></div>
              {/* Punto penal abajo */}
              <div className="absolute bottom-[11%] left-1/2 w-1.5 h-1.5 bg-emerald-100/35 rounded-full -translate-x-1/2"></div>

              {/* Renderizar jugadores colocados */}
              {boardPlayers.map((player) => (
                <div
                  key={player.id}
                  style={{
                    left: `${player.x}%`,
                    top: `${player.y}%`,
                    transform: 'translate(-50%, -50%)',
                    cursor: activeDragId === player.id ? 'grabbing' : 'grab'
                  }}
                  onMouseDown={(e) => handleMouseDown(e, player.id)}
                  onTouchStart={(e) => handleTouchStart(e, player.id)}
                  onClick={() => handleFieldPlayerClick(player)}
                  className="absolute z-10 group flex flex-col items-center select-none"
                >
                  <div className="relative w-11 h-11 rounded-full bg-brand-black-card border-2 border-brand-red-600 shadow-premium flex items-center justify-center overflow-visible group-hover:scale-110 transition-transform duration-150">
                    {player.foto ? (
                      <img src={player.foto} alt={player.nombre} className="w-full h-full object-cover rounded-full pointer-events-none" />
                    ) : (
                      <User className="w-5 h-5 text-brand-gray-light pointer-events-none" />
                    )}
                    {/* Badge de Dorsal */}
                    <span className="absolute -bottom-1 -right-1 bg-brand-red-600 text-white font-mono text-[9px] font-black w-4.5 h-4.5 rounded-full border border-emerald-950 flex items-center justify-center">
                      {player.dorsal}
                    </span>
                  </div>

                  {/* Nombre del jugador */}
                  <span className="mt-1 bg-brand-black-card/90 text-brand-gray-light text-[9px] font-bold px-1.5 py-0.5 rounded shadow border border-brand-black-border max-w-[80px] truncate text-center leading-none">
                    {player.nombre.split(' ')[0]}
                  </span>

                  {/* Comentario tooltip miniatura */}
                  {player.comment && (
                    <span className="absolute bottom-12 hidden group-hover:block bg-brand-black-card border border-brand-black-border text-brand-gray-light text-[10px] p-2 rounded shadow-2xl max-w-[150px] text-center z-20">
                      {player.comment}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          MODAL CREAR / EDITAR CARTERA
          ===================================================================== */}
      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={editingPlayer ? 'Editar Ficha del Candidato' : 'Registrar Candidato en Cartera'}
      >
        <form onSubmit={handleSave} className="space-y-4">
          <div>
            <label className="form-label">Nombre del Futbolista</label>
            <input
              type="text"
              className="form-input"
              placeholder="Marcos Fornés"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Club de Procedencia</label>
              <input
                type="text"
                className="form-input"
                placeholder="Hércules CF B"
                value={team}
                onChange={(e) => setTeam(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Edad</label>
              <input
                type="number"
                min="14"
                max="45"
                className="form-input"
                placeholder="21"
                value={age}
                onChange={(e) => setAge(e.target.value)}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="form-label">Demarcación / Posición</label>
              <input
                type="text"
                className="form-input"
                placeholder="Delantero Centro"
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              />
            </div>
            <div>
              <label className="form-label">Valoración Técnica ({rating} estrellas)</label>
              <div className="flex gap-1.5 py-2 text-yellow-500">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    className="hover:scale-110 transition-transform"
                  >
                    <Star className={`w-6 h-6 ${s <= rating ? 'fill-yellow-500 text-yellow-500' : 'text-brand-black-border'}`} />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">Observaciones y Reporte Físico/Táctico</label>
            <textarea
              className="form-input h-24 resize-none"
              placeholder="Rápido al desmarque, buena potencia de tiro, etc..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex gap-2 pt-4 justify-end">
            <button type="button" onClick={handleCloseModal} className="btn-secondary py-2 text-xs">
              Cancelar
            </button>
            <button type="submit" className="btn-primary py-2 text-xs font-semibold">
              Guardar Candidato
            </button>
          </div>
        </form>
      </Modal>

      {/* =====================================================================
          MODAL DE ASIGNACIÓN AL TABLERO TÁCTICO
          ===================================================================== */}
      <Modal
        isOpen={isAssignModalOpen}
        onClose={() => setIsAssignModalOpen(false)}
        title="Posicionar Futbolista en Campo"
      >
        {placementPlayer && (
          <form onSubmit={handleConfirmPlacement} className="space-y-4">
            <div className="flex items-center gap-3 bg-brand-black/35 p-3 rounded border border-brand-black-border">
              <div className="w-10 h-10 bg-brand-black border border-brand-black-border rounded-full overflow-hidden flex items-center justify-center">
                {placementPlayer.foto ? (
                  <img src={placementPlayer.foto} alt={placementPlayer.nombre} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-5 h-5 text-brand-gray-light" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-gray-light">{placementPlayer.nombre}</h4>
                <p className="text-[11px] text-brand-gray-muted mt-0.5">
                  #{placementPlayer.dorsal} • {placementPlayer.posicion} ({placementPlayer.team})
                </p>
              </div>
            </div>

            <div>
              <label className="form-label">Comentarios o Instrucciones Tácticas</label>
              <textarea
                className="form-input h-20 resize-none"
                placeholder="Ej. 'Realizar coberturas cortas a banda', 'Presión tras pérdida en 3/4'..."
                value={placementComment}
                onChange={(e) => setPlacementComment(e.target.value)}
              />
            </div>

            <div className="flex gap-2 justify-end pt-2">
              <button type="button" onClick={() => setIsAssignModalOpen(false)} className="btn-secondary py-2 text-xs">
                Cancelar
              </button>
              <button type="submit" className="btn-primary py-2 text-xs font-semibold">
                Ubicar en Campo
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* =====================================================================
          MODAL EDICIÓN JUGADOR COLOCADO EN TABLERO
          ===================================================================== */}
      <Modal
        isOpen={isFieldPlayerModalOpen}
        onClose={() => setIsFieldPlayerModalOpen(false)}
        title="Observación de Jugador en Campo"
      >
        {selectedFieldPlayer && (
          <form onSubmit={handleSaveFieldPlayerComment} className="space-y-4">
            <div className="flex gap-3 bg-brand-black/25 p-3 rounded border border-brand-black-border">
              <div className="w-12 h-12 rounded-full overflow-hidden border border-brand-black-border shrink-0 flex items-center justify-center">
                {selectedFieldPlayer.foto ? (
                  <img src={selectedFieldPlayer.foto} alt={selectedFieldPlayer.nombre} className="w-full h-full object-cover" />
                ) : (
                  <User className="w-6 h-6 text-brand-gray-light" />
                )}
              </div>
              <div>
                <h4 className="text-sm font-bold text-brand-gray-light leading-tight">{selectedFieldPlayer.nombre}</h4>
                <p className="text-[11px] text-brand-gray-muted mt-1 font-mono">
                  Dorsal: #{selectedFieldPlayer.dorsal} • Equipo: {selectedFieldPlayer.team}
                </p>
                <p className="text-[10px] text-brand-gray-muted font-semibold mt-0.5">
                  Demarcación: {selectedFieldPlayer.posicion}
                </p>
              </div>
            </div>

            <div>
              <label className="form-label">Instrucciones / Anotaciones Scouting</label>
              <textarea
                className="form-input h-24 resize-none"
                placeholder="Escribe comentarios específicos de este jugador sobre el campo..."
                value={fieldPlayerComment}
                onChange={(e) => setFieldPlayerComment(e.target.value)}
              />
            </div>

            <div className="flex justify-between items-center pt-2 border-t border-brand-black-border">
              <button
                type="button"
                onClick={() => handleRemoveFromField(selectedFieldPlayer.id)}
                className="text-xs text-red-400 bg-red-950/20 border border-red-900/40 px-3 py-2 rounded-lg hover:bg-red-900/30 flex items-center gap-1 transition-all"
              >
                <Trash2 className="w-3.5 h-3.5" /> Retirar de Campo
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsFieldPlayerModalOpen(false)}
                  className="btn-secondary py-2 text-xs"
                >
                  Cerrar
                </button>
                <button type="submit" className="btn-primary py-2 text-xs font-semibold">
                  Guardar Anotación
                </button>
              </div>
            </div>
          </form>
        )}
      </Modal>
    </div>
  );
};
