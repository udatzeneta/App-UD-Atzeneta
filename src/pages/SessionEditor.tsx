import React, { useState, useEffect } from 'react';
import { Reorder } from 'framer-motion';
import { 
  ClipboardList, Plus, Trash2, GripVertical, Save, X, Edit2, Search, Dumbbell, FolderSearch
} from 'lucide-react';
import { dataService } from '../services/data';
import { Training, TrainingTask, TrainingSessionTask } from '../types';
import { useToast } from '../context/ToastContext';
import { TaskBoardEditor } from '../components/TaskBoardEditor';

export const SessionEditor: React.FC = () => {
  const { addToast } = useToast();
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [selectedTrainingId, setSelectedTrainingId] = useState<string>('');
  
  const [libraryTasks, setLibraryTasks] = useState<TrainingTask[]>([]);
  const [sessionTasks, setSessionTasks] = useState<TrainingSessionTask[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Modals State
  const [isLibraryModalOpen, setIsLibraryModalOpen] = useState(false);
  const [librarySearch, setLibrarySearch] = useState('');
  
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<Partial<TrainingTask>>({
    title: '', description: '', duration: 15, category: 'Principal', board_data: ''
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    if (selectedTrainingId) {
      loadSessionTasks(selectedTrainingId);
    } else {
      setSessionTasks([]);
    }
  }, [selectedTrainingId]);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [trainingsData, tasksData] = await Promise.all([
        dataService.getTrainings(),
        dataService.getTrainingTasks()
      ]);
      setTrainings(trainingsData);
      setLibraryTasks(tasksData);
      
      if (trainingsData.length > 0) {
        const sorted = [...trainingsData].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
        const future = sorted.find(t => new Date(t.date) >= new Date());
        setSelectedTrainingId(future ? future.id : sorted[sorted.length - 1].id);
      }
    } catch (error) {
      console.error("Error loading SessionEditor data:", error);
      addToast({ type: 'error', message: 'Error cargando datos del editor.' });
    } finally {
      setLoading(false);
    }
  };

  const loadSessionTasks = async (trainingId: string) => {
    try {
      const data = await dataService.getSessionTasksByTraining(trainingId);
      setSessionTasks(data);
    } catch (error) {
      addToast({ type: 'error', message: 'Error cargando las tareas de la sesión.' });
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
      addToast({ type: 'success', message: 'Sesión guardada correctamente.' });
    } catch (error) {
      addToast({ type: 'error', message: 'Error al guardar la sesión.' });
    } finally {
      setIsSaving(false);
    }
  };

  const addTaskToSession = (task: TrainingTask) => {
    if (!selectedTrainingId) {
      addToast({ type: 'warning', message: 'Selecciona una sesión de entrenamiento primero.' });
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
    addToast({ type: 'success', message: 'Tarea añadida a la sesión.' });
  };

  const removeTaskFromSession = (index: number) => {
    const newTasks = [...sessionTasks];
    newTasks.splice(index, 1);
    setSessionTasks(newTasks);
  };

  // --- Task Editor ---

  const handleTaskModalSave = async () => {
    if (!editingTask.title || !editingTask.duration || !editingTask.category) {
      addToast({ type: 'warning', message: 'Rellena todos los campos obligatorios del panel derecho.' });
      return;
    }

    try {
      if (editingTask.id) {
        await dataService.updateTrainingTask(editingTask.id, editingTask);
        addToast({ type: 'success', message: 'Tarea actualizada.' });
      } else {
        await dataService.createTrainingTask(editingTask as Omit<TrainingTask, 'id'>);
        addToast({ type: 'success', message: 'Nueva tarea creada.' });
      }
      
      const tasksData = await dataService.getTrainingTasks();
      setLibraryTasks(tasksData);
      setIsTaskModalOpen(false);
      
      if (selectedTrainingId) {
        loadSessionTasks(selectedTrainingId);
      }
    } catch (error) {
      addToast({ type: 'error', message: 'Error al guardar la tarea.' });
    }
  };

  const openNewTaskModal = () => {
    setEditingTask({ title: '', description: '', duration: 15, category: 'Principal', board_data: '' });
    setIsTaskModalOpen(true);
  };

  const openEditTaskModal = (task: TrainingTask) => {
    setEditingTask({ ...task });
    setIsTaskModalOpen(true);
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

  return (
    <div className="space-y-6">
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

        <div className="flex items-center gap-3">
          <select
            value={selectedTrainingId}
            onChange={(e) => setSelectedTrainingId(e.target.value)}
            className="bg-brand-black-card border border-brand-black-border rounded-lg px-4 py-2 text-brand-gray-light text-sm focus:border-brand-red-600 outline-none min-w-[250px]"
          >
            <option value="">Selecciona un entrenamiento...</option>
            {trainings.map(t => (
              <option key={t.id} value={t.id}>
                {new Date(t.date).toLocaleDateString()} - {t.objective || 'Sin objetivo'}
              </option>
            ))}
          </select>

          <button
            onClick={handleSaveSession}
            disabled={!selectedTrainingId || isSaving}
            className="flex items-center gap-2 bg-brand-red-600 hover:bg-brand-red-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors shadow-glow-red disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-4 h-4" />
            {isSaving ? 'Guardando...' : 'Guardar Sesión'}
          </button>
        </div>
      </div>

      {/* Main Single Column layout */}
      <div className="bg-brand-black-card border border-brand-black-border rounded-xl flex flex-col min-h-[70vh]">
        
        {/* Session Toolbar */}
        <div className="p-4 border-b border-brand-black-border flex flex-wrap items-center justify-between gap-4">
          <div>
            <h2 className="text-sm font-bold text-brand-gray-light flex items-center gap-2">
              <ClipboardList className="w-4 h-4 text-brand-red-600" />
              Sesión Actual
            </h2>
            {selectedTraining && (
              <div className="mt-2 text-xs text-brand-gray-muted flex items-center gap-4">
                <span>🗓 {new Date(selectedTraining.date).toLocaleDateString()}</span>
                <span>📍 {selectedTraining.location}</span>
                <span className="bg-brand-black px-2 py-1 rounded">⏱ Total: {sessionTasks.reduce((acc, curr) => acc + (curr.duration || 0), 0)}' / {selectedTraining.duration}'</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsLibraryModalOpen(true)}
              className="flex items-center gap-2 bg-brand-black border border-brand-black-border hover:border-brand-gray-muted text-brand-gray-light px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <FolderSearch className="w-4 h-4" />
              Librería de Tareas
            </button>
            <button
              onClick={openNewTaskModal}
              className="flex items-center gap-2 bg-brand-red-600/20 text-brand-red-600 hover:bg-brand-red-600 hover:text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
            >
              <Plus className="w-4 h-4" />
              Crear Nueva Tarea
            </button>
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
                  className="bg-brand-black border border-brand-black-border rounded-lg p-4 flex gap-4 items-center group shadow-sm hover:border-brand-gray-muted transition-colors"
                >
                  <div className="cursor-grab active:cursor-grabbing p-1 text-brand-gray-muted hover:text-white bg-brand-black-hover rounded">
                    <GripVertical className="w-5 h-5" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="text-base font-bold text-brand-gray-light truncate">
                        {index + 1}. {sessionTask.task?.title || 'Tarea Desconocida'}
                      </h3>
                      <div className="flex items-center gap-3">
                        <span className="text-[11px] uppercase tracking-wider font-semibold text-brand-gray-muted bg-brand-black-hover px-2 py-1 rounded">
                          {sessionTask.task?.category}
                        </span>
                        <span className="text-sm font-bold text-white flex items-center gap-1">
                          ⏱ {sessionTask.duration}'
                        </span>
                      </div>
                    </div>
                    {sessionTask.task?.description && (
                       <p className="mt-2 text-xs text-brand-gray-muted line-clamp-2">{sessionTask.task.description}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2 border-l border-brand-black-border pl-4">
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
              
              {/* Left: Tactical Board */}
              <div className="flex-1 p-0 overflow-hidden border-b lg:border-b-0 lg:border-r border-brand-black-border bg-[#0a0a0a]">
                 <TaskBoardEditor 
                    value={editingTask.board_data || ''} 
                    onChange={(val) => setEditingTask(prev => ({ ...prev, board_data: val }))} 
                 />
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

                <div>
                  <label className="block text-[10px] font-bold text-brand-gray-muted mb-1 uppercase">Duración (min)</label>
                  <input 
                    type="number"
                    value={editingTask.duration}
                    onChange={(e) => setEditingTask({...editingTask, duration: parseInt(e.target.value) || 0})}
                    className="w-full bg-brand-black border border-brand-black-border rounded-lg px-2 py-1.5 text-sm text-brand-gray-light focus:border-brand-red-600 outline-none"
                    min="1"
                  />
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

    </div>
  );
};
