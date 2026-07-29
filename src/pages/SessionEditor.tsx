import React, { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { 
  ClipboardList, Plus, Trash2, GripVertical, Save, X, Edit2, Search, Dumbbell, FolderSearch, Printer, Download
} from 'lucide-react';
// @ts-ignore
import html2pdf from 'html2pdf.js';
import { dataService } from '../services/data';
import { Training, TrainingTask, TrainingSessionTask, Player } from '../types';
import { useToast } from '../context/ToastContext';
import { TaskBoardEditor } from '../components/TaskBoardEditor';
import { TeamsBoardEditor } from '../components/TeamsBoardEditor';
import { SessionPrintView } from '../components/SessionPrintView';
import { useParams, useNavigate } from 'react-router-dom';
import { usePermissions } from '../hooks/usePermissions';

export const SessionEditor: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { showToast } = useToast();
  const { user } = usePermissions();
  
  const [filterTeam, setFilterTeam] = useState(user?.team_category || 'Primer Equipo');

  useEffect(() => {
    if (user?.team_category) {
      setFilterTeam(user.team_category);
    }
  }, [user?.team_category]);

  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>('');
  
  const [libraryTasks, setLibraryTasks] = useState<TrainingTask[]>([]);
  const [sessionTasks, setSessionTasks] = useState<TrainingSessionTask[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const [attendanceList, setAttendanceList] = useState<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modals State
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TrainingTask>>({
    title: '', description: '', duration: 15, category: 'Principal', board_data: '', task_types: [], coach_roles: '', teams_board_data: ''
  });
  const [activeBoardTab, setActiveBoardTab] = useState<'tactical' | 'teams'>('tactical');
  const [teamsPlayerFilter, setTeamsPlayerFilter] = useState<'confirmed' | 'all' | 'primer_equipo'>('all');
  
  const [localObjective, setLocalObjective] = useState('');

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [showTeamsInPdf, setShowTeamsInPdf] = useState(true);

  const attendingPlayers = React.useMemo(() => {
    return players.filter(p => {
      const att = attendanceList.find(a => a.player_id === p.id);
      return att && (att.status === 'ENT' || att.player_intent === true);
    });
  }, [players, attendanceList]);

  const boardPlayersToShow = React.useMemo(() => {
    if (teamsPlayerFilter === 'confirmed') return attendingPlayers;
    if (teamsPlayerFilter === 'primer_equipo') return players.filter(p => p.team_category !== 'Juvenil');
    return players;
  }, [teamsPlayerFilter, attendingPlayers, players]);

  const confirmedGks = attendingPlayers.filter(p => p.position === 'Portero').length;
  const confirmedField = attendingPlayers.length - confirmedGks;

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedTrainingId) {
      loadSessionTasks(selectedTrainingId);
      const currentTraining = trainings.find(t => t.id === selectedTrainingId);
      setLocalObjective(currentTraining?.objective || '');
    } else {
      setSessionTasks([]);
      setLocalObjective('');
    }
  }, [selectedTrainingId]);

  useEffect(() => {
    const filteredTrainings = trainings.filter(t => (t.team_category || 'Primer Equipo') === filterTeam);
    if (filteredTrainings.length > 0) {
      if (!selectedTrainingId || !filteredTrainings.find(t => t.id === selectedTrainingId)) {
        const sorted = [...filteredTrainings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const future = sorted.find(t => new Date(t.date) >= new Date());
        setSelectedTrainingId(future ? future.id : sorted[sorted.length - 1].id);
      }
    } else {
      setSelectedTrainingId('');
    }
  }, [trainings, filterTeam]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [trainingsData, tasksData, playersData] = await Promise.all([
        dataService.getTrainings(),
        dataService.getTrainingTasks(),
        dataService.getPlayers()
      ]);
      setTrainings(trainingsData);
      setLibraryTasks(tasksData);
      setPlayers(playersData);
    } catch (error) {
      console.error("Error loading SessionEditor data:", error);
      showToast('error', 'Error', 'Error cargando datos del editor.');
    } finally {
      setLoading(false);
    }
  };

  const loadSessionTasks = async (trainingId: string) => {
    try {
      const [data, attData] = await Promise.all([
        dataService.getSessionTasksByTraining(trainingId),
        dataService.getAttendanceByTraining(trainingId)
      ]);
      setSessionTasks(data);
      setAttendanceList(attData);
    } catch (error) {
      showToast('error', 'Error', 'Error cargando las tareas de la sesión.');
    }
  };

  const handleSaveSession = async () => {
    if (!selectedTrainingId) return;
    try {
      setIsSaving(true);
      const tasksToSave = sessionTasks.map((st, index) => ({
        training_id: selectedTrainingId,
        task_id: st.task_id,
        order_index: index,
        duration: st.duration,
        notes: st.notes
      }));
      
      await dataService.saveSessionTasks(selectedTrainingId, tasksToSave);
      await loadSessionTasks(selectedTrainingId); 
      showToast('success', 'Éxito', 'Sesión guardada correctamente.');
    } catch (error) {
      showToast('error', 'Error', 'Error al guardar la sesión.');
    } finally {
      setIsSaving(false);
    }
  };

  const addTaskToSession = (task: TrainingTask) => {
    if (!selectedTrainingId) {
      showToast('info', 'Atención', 'Selecciona una sesión de entrenamiento primero.');
      return;
    }
    
    const newTask: TrainingSessionTask = {
      id: `temp-${Date.now()}`,
      training_id: selectedTrainingId,
      task_id: task.id,
      order_index: sessionTasks.length,
      duration: task.duration,
      task: task
    };
    
    setSessionTasks([...sessionTasks, newTask]);
    setIsLibraryModalOpen(false); // Cerramos tras añadir para volver a la sesión
    showToast('success', 'Éxito', 'Tarea añadida a la sesión.');
  };

  const removeTaskFromSession = (index: number) => {
    const newTasks = [...sessionTasks];
    newTasks.splice(index, 1);
    setSessionTasks(newTasks);
  };

  // --- Task Editor ---

  const handleTaskModalSave = async () => {
    if (!editingTask.title || !editingTask.duration || !editingTask.category) {
      showToast('info', 'Atención', 'Rellena todos los campos obligatorios del panel derecho.');
      return;
    }

    try {
      let savedTask;
      if (editingTask.id) {
        savedTask = await dataService.updateTrainingTask(editingTask.id, editingTask);
        showToast('success', 'Éxito', 'Tarea actualizada.');
      } else {
        savedTask = await dataService.createTrainingTask(editingTask as Omit<TrainingTask, 'id'>);
        showToast('success', 'Éxito', 'Nueva tarea creada y añadida a la sesión.');
        
        if (selectedTrainingId) {
          const newTaskToAdd = {
            id: `st-${Date.now()}`,
            training_id: selectedTrainingId,
            task_id: savedTask.id,
            order_index: sessionTasks.length,
            duration: savedTask.duration,
            notes: '',
            task: savedTask
          };
          
          const newSessionTasks = [...sessionTasks, newTaskToAdd];
          setSessionTasks(newSessionTasks);
          
          const tasksToSave = newSessionTasks.map((st, index) => ({
            training_id: selectedTrainingId,
            task_id: st.task_id,
            order_index: index,
            duration: st.duration,
            notes: st.notes
          }));
          await dataService.saveSessionTasks(selectedTrainingId, tasksToSave);
        }
      }
      
      const tasksData = await dataService.getTrainingTasks();
      setLibraryTasks(tasksData);
      setIsTaskModalOpen(false);
      
      if (selectedTrainingId && editingTask.id) {
        loadSessionTasks(selectedTrainingId);
      }
    } catch (error) {
      showToast('error', 'Error', 'Error al guardar la tarea.');
    }
  };

  const handleObjectiveBlur = async () => {
    if (!selectedTrainingId) return;
    const currentTraining = trainings.find(t => t.id === selectedTrainingId);
    if (currentTraining && localObjective !== currentTraining.objective) {
      try {
        await dataService.updateTraining(selectedTrainingId, { objective: localObjective.trim() });
        setTrainings(prev => prev.map(t => t.id === selectedTrainingId ? { ...t, objective: localObjective } : t));
        showToast('success', 'Objetivo actualizado', 'Se ha guardado el objetivo de la sesión.');
      } catch (error) {
        showToast('error', 'Error', 'No se pudo actualizar el objetivo.');
      }
    }
  };

  const openNewTaskModal = () => {
    setEditingTask({ title: '', description: '', duration: 15, category: 'Principal', board_data: '', task_types: [], coach_roles: '', teams_board_data: '' });
    setActiveBoardTab('tactical');
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: TrainingTask) => {
    setEditingTask({ ...task });
    setActiveBoardTab('tactical');
    setIsTaskModalOpen(true);
  };

  const handleDownloadPDF = () => {
    const element = document.getElementById('pdf-export-content');
    const currentTraining = trainings.find(t => t.id === selectedTrainingId);
    if (!element || !currentTraining) return;

    // Generate date string DD_MM_YY
    const d = new Date(currentTraining.date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    
    // session number
    const sNum = getTrainingNumber(currentTraining.id);
    
    const filename = `entrene_UD_Atzeneta_${sNum}_${day}_${month}_${year}.pdf`;

    const opt = {
      margin:       0,
      filename:     filename,
      image:        { type: 'jpeg' as const, quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, scrollY: 0 },
      jsPDF:        { unit: 'mm' as const, format: 'a4', orientation: 'portrait' as const },
      // Paginación: deja que el contenido fluya a varias páginas y evita cortar
      // una tarea por la mitad (cada tarea lleva la clase .pdf-task).
      pagebreak:    { mode: ['css', 'legacy'], avoid: '.pdf-task' }
    };

    html2pdf().set(opt).from(element).save();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="w-8 h-8 rounded-full border-2 border-brand-black-border border-t-brand-red-600 animate-spin" />
      </div>
    );
  }

  const selectedTraining = trainings.find(t => t.id === selectedTrainingId);
  const filteredLibraryTasks = libraryTasks.filter(t => t.title.toLowerCase().includes(librarySearch.toLowerCase()) || t.category.toLowerCase().includes(librarySearch.toLowerCase()));

  const filteredTrainings = trainings.filter(t => (t.team_category || 'Primer Equipo') === filterTeam);
  const sortedTrainingsChronologically = [...filteredTrainings].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  const getTrainingNumber = (id: string) => {
    const index = sortedTrainingsChronologically.findIndex(t => t.id === id);
    return index !== -1 ? index + 1 : 0;
  };
  
  const sortedTrainings = [...filteredTrainings].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const getCategoryColor = (category: string) => {
    switch(category?.toLowerCase()) {
      case 'calentamiento': return 'border-yellow-500/50 bg-yellow-500/5';
      case 'principal': return 'border-brand-red-600/50 bg-brand-red-600/5';
      case 'estrategia': return 'border-blue-500/50 bg-blue-500/5';
      case 'vuelta a la calma': return 'border-green-500/50 bg-green-500/5';
      default: return 'border-brand-black-border bg-brand-black';
    }
  };

  return (
    <>
    <div className="space-y-6 print:hidden">
      {/* Pestañas de Equipo */}
      {(user?.role_id === 1 || user?.role_id === 4 || (user?.role_id === 2 && user?.team_category === 'Primer Equipo')) && (
        <div className="flex bg-brand-black-card border-b border-brand-black-border mb-2">
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-brand-gray-light flex items-center gap-2">
            <ClipboardList className="w-6 h-6 text-brand-red-600" />
            Editor de Sesiones
          </h1>
          <p className="text-sm text-brand-gray-muted mt-1">
            Planifica tu entrenamiento con la pizarra táctica
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full sm:w-auto">
          <select
            value={selectedTrainingId}
            onChange={(e) => setSelectedTrainingId(e.target.value)}
            className="bg-brand-black-card border border-brand-black-border rounded-lg px-4 py-2 text-brand-gray-light text-sm focus:border-brand-red-600 outline-none w-full sm:w-auto sm:min-w-[300px]"
          >
            <option value="">Selecciona un entrenamiento...</option>
            {sortedTrainings.map(t => (
              <option key={t.id} value={t.id}>
                Sesión {getTrainingNumber(t.id)} | {new Date(t.date).toLocaleDateString()} - {t.objective || 'Sin objetivo'}
              </option>
            ))}
          </select>

          <button
            onClick={handleSaveSession}
            disabled={!selectedTrainingId || isSaving}
            className="btn-primary flex-1 sm:flex-none justify-center"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Guardando...' : 'Guardar'}</span>
          </button>

          <button
            onClick={() => setIsPreviewModalOpen(true)}
            disabled={!selectedTrainingId}
            className="btn-secondary justify-center"
            title="Exportar a PDF"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Single Column layout */}
      <div className="bg-brand-black-card border border-brand-black-border rounded-xl flex flex-col min-h-[70vh]">
        
        {/* Session Toolbar */}
        <div className="p-4 border-b border-brand-black-border flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-brand-gray-light flex items-center gap-2">
              <img src="/club-logo.png" className="w-5 h-5 object-contain" alt="Escudo" />
              {selectedTraining ? `Sesión ${getTrainingNumber(selectedTraining.id)}` : 'Sesión Actual'}
            </h2>
            {selectedTraining && (
              <div className="mt-2 text-xs text-brand-gray-muted flex flex-wrap items-center gap-3">
                <span className="bg-brand-black px-2 py-1 rounded">🗓 {new Date(selectedTraining.date).toLocaleDateString()}</span>
                <span className="bg-brand-black px-2 py-1 rounded">📍 {selectedTraining.location}</span>
                <span className="bg-brand-black px-2 py-1 rounded">⏱ Planificado: {selectedTraining.duration}'</span>
                <span className="bg-brand-black px-2 py-1 rounded text-brand-red-400">👥 {attendingPlayers.length} Asistentes ({confirmedGks} POR / {confirmedField} JUG)</span>
                <span className={`px-2 py-1 rounded font-bold ${sessionTasks.reduce((acc, curr) => acc + (curr.duration || 0), 0) > selectedTraining.duration ? 'text-brand-red-600 bg-brand-red-600/10' : 'text-green-500 bg-green-500/10'}`}>
                   ⏱ Tareas: {sessionTasks.reduce((acc, curr) => acc + (curr.duration || 0), 0)}'
                </span>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto mt-3 sm:mt-0 border-t border-brand-black-border pt-3 sm:border-0 sm:pt-0">
            {selectedTraining && (
              <div className="w-full sm:w-64">
                <input
                  type="text"
                  value={localObjective}
                  onChange={(e) => setLocalObjective(e.target.value)}
                  onBlur={handleObjectiveBlur}
                  placeholder="Objetivo principal de la sesión..."
                  className="w-full bg-brand-black border border-brand-black-border rounded-lg px-3 py-2 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                  title="Objetivo de la sesión (se guarda al salir de la caja)"
                />
              </div>
            )}
            <div className="flex gap-2 w-full sm:w-auto">
              <button
                onClick={() => setIsLibraryModalOpen(true)}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-black border border-brand-black-border hover:border-brand-gray-muted text-brand-gray-light px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <FolderSearch className="w-4 h-4" />
                Librería
              </button>
              <button
                onClick={openNewTaskModal}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 bg-brand-red-600/20 text-brand-red-600 hover:bg-brand-red-600 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
              >
                <Plus className="w-4 h-4" />
                Nueva Tarea
              </button>
            </div>
          </div>
        </div>

        {/* Session Tasks List */}
        <div className="flex-1 overflow-y-auto p-4 bg-brand-black/30 no-scrollbar">
          {!selectedTrainingId ? (
            <div className="flex flex-col items-center justify-center h-full text-brand-gray-muted text-sm gap-2">
              <Dumbbell className="w-12 h-12 opacity-20" />
              Selecciona un entrenamiento para empezar a añadir tareas.
            </div>
          ) : sessionTasks.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-brand-gray-muted text-sm border-2 border-dashed border-brand-black-border rounded-xl">
              <FolderSearch className="w-12 h-12 opacity-20 mb-2" />
              No hay tareas en esta sesión.<br/>
              Añade tareas desde la librería o crea una nueva.
            </div>
          ) : (
            <Reorder.Group 
              axis="y" 
              values={sessionTasks} 
              onReorder={setSessionTasks}
              className="space-y-3"
            >
              {sessionTasks.map((sessionTask, index) => (
                <Reorder.Item 
                  key={sessionTask.id} 
                  value={sessionTask}
                  className={`border rounded-lg p-4 pl-8 sm:pl-4 flex flex-col sm:flex-row gap-4 sm:items-center group shadow-sm transition-colors relative ${getCategoryColor(sessionTask.task?.category || '')}`}
                >
                  <div className="cursor-grab active:cursor-grabbing p-1 text-brand-gray-muted hover:text-white rounded absolute left-2 top-4 sm:top-1/2 sm:-translate-y-1/2">
                    <GripVertical className="w-5 h-5" />
                  </div>

                  {/* Thumbnail Preview */}
                  <div className="w-full sm:ml-6 sm:w-60 h-40 shrink-0 overflow-hidden relative rounded border border-white/10 pointer-events-none bg-black/40 flex items-center justify-center">
                     {sessionTask.task?.board_data ? (
                        <div style={{ width: '480px', height: '320px', transform: 'scale(0.5)', transformOrigin: 'center' }} className="flex flex-col justify-center shrink-0">
                           <TaskBoardEditor value={sessionTask.task.board_data} readOnly hideToolbar rotateFullField={true} />
                        </div>
                     ) : (
                        <div className="w-full h-full flex flex-col items-center justify-center text-xs text-brand-gray-muted text-center p-2 opacity-50">
                           <ClipboardList className="w-8 h-8 mb-2" />
                           Sin dibujo
                        </div>
                     )}
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-base font-bold text-white truncate pr-2">
                        {index + 1}. {sessionTask.task?.title || 'Tarea Desconocida'}
                      </h3>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className="text-[10px] uppercase tracking-wider font-bold text-white/80 bg-black/40 px-2 py-1 rounded">
                          {sessionTask.task?.category}
                        </span>
                        <span className="text-sm font-bold text-brand-red-600 flex items-center gap-1 bg-brand-red-600/10 px-2 py-1 rounded">
                          ⏱ {sessionTask.duration}'
                        </span>
                      </div>
                    </div>
                    {sessionTask.task?.description && (
                       <p className="mt-3 text-sm text-brand-gray-light/80 line-clamp-6 leading-relaxed">{sessionTask.task.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto sm:border-l sm:border-brand-black-border sm:pl-4">
                    <button
                      onClick={() => sessionTask.task && openEditTaskModal(sessionTask.task)}
                      className="p-2 text-brand-gray-muted hover:text-brand-gray-light hover:bg-brand-black-hover rounded transition-colors"
                      title="Editar Tarea (Pizarra)"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => removeTaskFromSession(index)}
                      className="p-2 text-brand-gray-muted hover:text-brand-red-600 hover:bg-brand-red-600/10 rounded transition-colors"
                      title="Eliminar de la sesión"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </Reorder.Item>
              ))}
            </Reorder.Group>
          )}
        </div>
      </div>

      {/* --- Modal: Library --- */}
      {isLibraryModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsLibraryModalOpen(false)} />
          <div className="relative bg-brand-black-card border border-brand-black-border rounded-xl w-full max-w-4xl max-h-[85vh] flex flex-col shadow-premium animate-fade-in">
            <div className="flex justify-between items-center p-4 sm:p-6 border-b border-brand-black-border">
              <h2 className="text-lg font-bold text-brand-gray-light flex items-center gap-2">
                <FolderSearch className="w-5 h-5 text-brand-red-600" />
                Librería de Tareas
              </h2>
              <button onClick={() => setIsLibraryModalOpen(false)} className="text-brand-gray-muted hover:text-white p-1">
                <X className="w-6 h-6" />
              </button>
            </div>
            
            <div className="p-4 sm:p-6 border-b border-brand-black-border bg-brand-black/30">
              <div className="relative max-w-md">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-gray-muted" />
                <input 
                  type="text" 
                  value={librarySearch}
                  onChange={(e) => setLibrarySearch(e.target.value)}
                  placeholder="Buscar tareas por nombre o categoría..."
                  className="w-full bg-brand-black border border-brand-black-border rounded-lg pl-9 pr-3 py-2.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                />
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 sm:p-6 no-scrollbar bg-brand-black/30">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredLibraryTasks.map(task => (
                  <div 
                    key={task.id}
                    className="bg-brand-black border border-brand-black-border rounded-lg p-4 hover:border-brand-gray-muted transition-colors flex flex-col"
                  >
                    <div className="flex justify-between items-start mb-3">
                      <h3 className="text-sm font-bold text-brand-gray-light pr-2">{task.title}</h3>
                      <span className="text-[11px] bg-brand-black-hover text-brand-gray-muted px-2 py-0.5 rounded border border-brand-black-border whitespace-nowrap">
                        {task.category}
                      </span>
                    </div>
                    <p className="text-xs text-brand-gray-muted line-clamp-3 mb-4 flex-1">{task.description}</p>
                    <div className="flex justify-between items-center pt-3 border-t border-brand-black-border">
                      <span className="text-xs font-semibold text-brand-gray-light flex items-center gap-1">
                        ⏱ {task.duration} min
                      </span>
                      <div className="flex gap-2">
                        <button 
                          onClick={() => {
                            setIsLibraryModalOpen(false);
                            openEditTaskModal(task);
                          }}
                          className="px-3 py-1.5 text-xs font-medium text-brand-gray-muted hover:text-white bg-brand-black-hover rounded transition-colors"
                        >
                          Editar
                        </button>
                        <button 
                          onClick={() => addTaskToSession(task)}
                          className="px-3 py-1.5 text-xs font-medium bg-brand-red-600/10 text-brand-red-600 hover:bg-brand-red-600 hover:text-white rounded transition-colors"
                        >
                          Añadir a Sesión
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {filteredLibraryTasks.length === 0 && (
                  <div className="col-span-1 md:col-span-2 text-center py-10 text-brand-gray-muted">
                    No se encontraron tareas en la librería.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- Modal: Task Editor (Pizarra) --- */}
      {isTaskModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsTaskModalOpen(false)} />
          <div className="relative bg-brand-black border border-brand-black-border rounded-xl w-full max-w-[1400px] h-[95vh] flex flex-col shadow-premium animate-fade-in overflow-hidden">
            
            <div className="flex justify-between items-center px-4 py-3 border-b border-brand-black-border bg-brand-black-card shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Edit2 className="w-4 h-4 text-brand-red-600" />
                {editingTask.id ? 'Editar Tarea y Pizarra' : 'Diseñar Nueva Tarea'}
              </h2>
              <button onClick={() => setIsTaskModalOpen(false)} className="text-brand-gray-muted hover:text-white p-1 bg-brand-black-hover rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              
              {/* Left: Tactical / Teams Board */}
              <div className="flex-1 flex flex-col overflow-hidden border-b lg:border-b-0 lg:border-r border-brand-black-border bg-[#0a0a0a]">
                 {/* Tabs header */}
                 <div className="flex border-b border-brand-black-border bg-brand-black shrink-0 justify-between items-center pr-2">
                    <div className="flex flex-1">
                      <button 
                        onClick={() => setActiveBoardTab('tactical')}
                        className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 ${activeBoardTab === 'tactical' ? 'border-brand-red-600 text-white' : 'border-transparent text-brand-gray-muted hover:text-white'}`}
                      >
                        Pizarra Táctica
                      </button>
                      <button 
                        onClick={() => setActiveBoardTab('teams')}
                        className={`px-4 py-2 text-xs font-bold transition-colors border-b-2 ${activeBoardTab === 'teams' ? 'border-brand-red-600 text-white' : 'border-transparent text-brand-gray-muted hover:text-white'}`}
                      >
                        Equipos
                      </button>
                    </div>
                    {activeBoardTab === 'teams' && (
                      <select
                        value={teamsPlayerFilter}
                        onChange={(e) => setTeamsPlayerFilter(e.target.value as any)}
                        className="bg-brand-black-bg border border-brand-black-border rounded text-[10px] text-brand-gray-light py-1 px-2 outline-none cursor-pointer"
                      >
                        <option value="all">Todos los jugadores</option>
                        <option value="primer_equipo">Solo 1er Equipo</option>
                        <option value="confirmed">Confirmados Asistencia</option>
                      </select>
                    )}
                 </div>
                 {/* Tab Content */}
                 <div className="flex-1 overflow-hidden relative">
                   {activeBoardTab === 'tactical' ? (
                     <TaskBoardEditor 
                        value={editingTask.board_data || ''} 
                        onChange={(val) => setEditingTask(prev => ({ ...prev, board_data: val }))} 
                     />
                   ) : (
                     <TeamsBoardEditor
                        value={editingTask.teams_board_data || ''}
                        onChange={(val) => setEditingTask(prev => ({ ...prev, teams_board_data: val }))}
                        players={boardPlayersToShow}
                     />
                   )}
                 </div>
              </div>

              {/* Right: Task Details Form */}
              <div className="w-full lg:w-80 bg-brand-black-card p-3 overflow-y-auto shrink-0 flex flex-col gap-3">
                <div>
                  <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase">Título de la Tarea</label>
                  <input 
                    type="text"
                    value={editingTask.title}
                    onChange={(e) => setEditingTask({...editingTask, title: e.target.value})}
                    className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                    placeholder="Ej. Posesión 4v4 + comodines"
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase">Roles Entrenadores</label>
                  <input 
                    type="text"
                    value={editingTask.coach_roles || ''}
                    onChange={(e) => setEditingTask({...editingTask, coach_roles: e.target.value})}
                    className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                    placeholder="Ej. Entr 1: Corrige presión..."
                  />
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase">Tipo de Tarea</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Posesión', 'Rondo', 'Partido reducido', 'Partido', 'Circuito', 'Finalización', 'Ataque-Defensa', 'Secuencia Pases'].map(type => {
                      const isSelected = (editingTask.task_types || []).includes(type);
                      return (
                        <button
                          key={type}
                          onClick={() => {
                            const current = editingTask.task_types || [];
                            if (isSelected) {
                              setEditingTask({ ...editingTask, task_types: current.filter(t => t !== type) });
                            } else {
                              setEditingTask({ ...editingTask, task_types: [...current, type] });
                            }
                          }}
                          className={`px-2 py-1 rounded text-[10px] font-bold border transition-colors ${isSelected ? 'bg-brand-red-600 border-brand-red-600 text-white' : 'bg-brand-black border-brand-black-border text-brand-gray-muted hover:text-brand-gray-light'}`}
                        >
                          {type}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase">Categoría</label>
                  <select
                    value={editingTask.category}
                    onChange={(e) => setEditingTask({...editingTask, category: e.target.value})}
                    className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                  >
                    <option value="Calentamiento">Calentamiento</option>
                    <option value="Principal">Principal</option>
                    <option value="Física">Física</option>
                    <option value="Estrategia">Estrategia</option>
                    <option value="Vuelta a la calma">Vuelta a la calma</option>
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase text-center">Series</label>
                    <input 
                      type="number"
                      value={editingTask.series || ''}
                      onChange={(e) => setEditingTask({...editingTask, series: parseInt(e.target.value) || undefined})}
                      className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none text-center"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase text-center">Min/Serie</label>
                    <input 
                      type="number"
                      value={editingTask.series_duration || ''}
                      onChange={(e) => setEditingTask({...editingTask, series_duration: parseInt(e.target.value) || undefined})}
                      className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none text-center"
                      min="1"
                    />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase text-center">Total (min)</label>
                    <input 
                      type="number"
                      value={editingTask.duration || ''}
                      onChange={(e) => setEditingTask({...editingTask, duration: parseInt(e.target.value) || 0})}
                      className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none text-center"
                      min="1"
                    />
                  </div>
                </div>

                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase">Descripción / Reglas</label>
                  <textarea 
                    value={editingTask.description}
                    onChange={(e) => setEditingTask({...editingTask, description: e.target.value})}
                    className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none resize-none h-full min-h-[100px]"
                    placeholder="Describe el funcionamiento del ejercicio..."
                  />
                </div>

                <button 
                  onClick={handleTaskModalSave}
                  className="w-full py-2 text-sm font-bold bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg transition-colors shadow-glow-red flex items-center justify-center gap-2 mt-auto"
                >
                  <Save className="w-4 h-4" />
                  Guardar Tarea
                </button>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* --- Modal: PDF Preview --- */}
      {isPreviewModalOpen && selectedTraining && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" onClick={() => setIsPreviewModalOpen(false)} />
          <div className="relative bg-brand-black border border-brand-black-border rounded-xl w-full max-w-6xl max-h-[95vh] flex flex-col shadow-premium animate-fade-in overflow-hidden">
            
            <div className="flex justify-between items-center px-4 py-3 border-b border-brand-black-border bg-brand-black-card shrink-0">
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                <Download className="w-4 h-4 text-brand-red-600" />
                Exportar Sesión a PDF
              </h2>
              <button onClick={() => setIsPreviewModalOpen(false)} className="text-brand-gray-muted hover:text-white p-1 bg-brand-black-hover rounded">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
              <div className="w-full lg:w-72 bg-brand-black-card border-b lg:border-b-0 lg:border-r border-brand-black-border p-5 shrink-0 flex flex-col gap-6">
                <div>
                  <h3 className="text-sm font-bold text-white mb-2">Opciones de Exportación</h3>
                  <p className="text-xs text-brand-gray-muted mb-6">Configura cómo se verá el documento final de tu sesión de entrenamiento.</p>
                  
                  <label className="flex items-center gap-3 cursor-pointer group bg-brand-black p-3 border border-brand-black-border rounded-lg hover:border-brand-gray-muted transition-colors">
                    <div className="relative shrink-0">
                      <input 
                        type="checkbox" 
                        className="sr-only" 
                        checked={showTeamsInPdf}
                        onChange={(e) => setShowTeamsInPdf(e.target.checked)}
                      />
                      <div className={`w-10 h-6 bg-[#1a1a1a] border border-brand-black-border rounded-full transition-colors ${showTeamsInPdf ? 'bg-brand-red-600 border-brand-red-600' : ''}`}></div>
                      <div className={`absolute left-1 top-1 bg-white w-4 h-4 rounded-full transition-transform ${showTeamsInPdf ? 'translate-x-4' : ''}`}></div>
                    </div>
                    <span className="text-sm font-semibold text-brand-gray-light group-hover:text-white transition-colors">
                      Mostrar Equipos
                    </span>
                  </label>
                </div>

                <button 
                  onClick={handleDownloadPDF}
                  className="w-full py-3 text-sm font-bold bg-brand-red-600 hover:bg-brand-red-700 text-white rounded-lg transition-colors shadow-glow-red flex items-center justify-center gap-2 mt-auto"
                >
                  <Download className="w-5 h-5" />
                  Descargar PDF
                </button>
              </div>

              <div className="flex-1 bg-[#2a2a2a] overflow-auto p-4 sm:p-8 flex justify-center relative items-start no-scrollbar">
                 <div className="transform-origin-top shadow-2xl transition-all bg-white origin-top scale-75 sm:scale-90 lg:scale-95 xl:scale-100">
                   <div id="pdf-export-content" className="bg-white">
                      <SessionPrintView 
                        session={selectedTraining} 
                        sessionTasks={sessionTasks} 
                        sessionNumber={getTrainingNumber(selectedTraining.id)}
                        showTeamsBoard={showTeamsInPdf}
                      />
                   </div>
                 </div>
              </div>
            </div>
          </div>
        </div>
      )}

    </div>
    
    {selectedTraining && (
      <div className="hidden print:block">
        <SessionPrintView 
          session={selectedTraining} 
          sessionTasks={sessionTasks} 
          sessionNumber={getTrainingNumber(selectedTraining.id)}
        />
      </div>
    )}
    </>
  );
};
