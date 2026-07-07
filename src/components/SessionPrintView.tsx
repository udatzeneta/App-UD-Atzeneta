import React from 'react';
import { Training, TrainingSessionTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { TaskBoardEditor } from './TaskBoardEditor';
import { TeamsBoardEditor } from './TeamsBoardEditor';

interface Props {
  session: Training;
  sessionTasks: TrainingSessionTask[];
  sessionNumber?: number;
}

export const SessionPrintView: React.FC<Props> = ({ session, sessionTasks, sessionNumber }) => {
  const { user } = useAuth();

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Calentamiento': return 'bg-amber-500 text-black';
      case 'Parte Principal': return 'bg-red-600 text-white';
      case 'Estrategia': return 'bg-blue-600 text-white';
      case 'Vuelta a la Calma': return 'bg-emerald-600 text-white';
      default: return 'bg-black text-white';
    }
  };

  return (
    <div className="w-[210mm] h-[297mm] mx-auto text-black bg-white font-sans p-4 flex flex-col overflow-hidden box-border print-container">
      
      {/* Header section */}
      <div className="flex justify-between items-end border-b-2 border-black pb-2 mb-2 shrink-0">
        <div className="flex flex-col">
          <div className="flex items-center gap-2 mb-1">
             <img src="https://golsmedia.com/wp-content/uploads/2025/05/atzeneta-1-1024x576.jpg" className="h-8 object-contain grayscale" alt="Escudo" />
             <h1 className="text-xl font-black uppercase tracking-tight">UD Atzeneta</h1>
          </div>
          <h2 className="text-sm font-bold text-gray-700">SESIÓN {sessionNumber || 1} • {new Date(session.date).toLocaleDateString('es-ES')}</h2>
          <div className="text-[10px] text-gray-500 font-bold uppercase">{user?.full_name || 'Entrenador'}</div>
        </div>
        <div className="text-right flex flex-col items-end">
          <div className="text-xs font-bold bg-black text-white px-2 py-0.5 mb-1">{session.duration}' MINUTOS</div>
          <div className="text-[11px] font-semibold">📍 {session.location}</div>
        </div>
      </div>

      {/* Objective section */}
      <div className="bg-gray-100 border border-black p-1.5 mb-3 shrink-0 flex items-center">
        <span className="font-bold uppercase text-[11px] mr-2 shrink-0">OBJETIVO:</span>
        <span className="text-[11px] font-semibold leading-tight">{session.objective || 'Sin objetivo definido'}</span>
      </div>
      
      {/* Tasks List */}
      <div className="flex-1 flex flex-col gap-3 min-h-0">
        {sessionTasks.map((st, i) => {
          const t = st.task;
          if (!t) return null;
          
          return (
            <div key={st.id} className="border border-black flex flex-col overflow-hidden bg-white max-h-[130mm] page-break-inside-avoid">
              
              {/* Task Header */}
              <div className={`${getCategoryColor(t.category)} px-2 py-1 flex justify-between items-center shrink-0`}>
                <span className="font-bold text-[11px] uppercase truncate pr-2">{i+1}. {t.title}</span>
                <div className="flex gap-2 text-[10px] font-bold shrink-0">
                  <span className="opacity-80">{t.category}</span>
                  <span>⏱ {t.duration}'</span>
                </div>
              </div>
              
              {/* Task Content */}
              <div className="flex flex-1 min-h-0">
                
                {/* Col 1: Details */}
                <div className="w-[30%] shrink-0 p-2 border-r border-black flex flex-col text-[10px] leading-snug overflow-hidden">
                  <div className="font-bold mb-1 border-b border-gray-300 pb-0.5">DESCRIPCIÓN:</div>
                  <p className="flex-1 overflow-hidden whitespace-pre-wrap">{t.description}</p>
                  
                  {t.coach_roles && (
                    <div className="mt-1 pt-1 border-t border-gray-300 shrink-0">
                      <div className="font-bold mb-0.5">ROLES ENTRENADOR:</div>
                      <p className="truncate">{t.coach_roles}</p>
                    </div>
                  )}
                  
                  <div className="mt-1 pt-1 border-t border-gray-300 flex flex-wrap gap-1 shrink-0">
                    {t.series && <span><span className="font-bold">Series:</span> {t.series}x{t.series_duration}'</span>}
                    {t.task_types && t.task_types.length > 0 && <span><span className="font-bold">Tipo:</span> {t.task_types[0]}</span>}
                  </div>
                </div>
                
                {/* Col 2 & 3: Boards Area */}
                <div className="flex-1 flex flex-row relative min-w-0">
                  {/* Task Board (Col 2, expands to Col 3 if no teams board) */}
                  <div className={`relative flex items-center justify-center p-2 ${t.teams_board_data && t.teams_board_data.length > 10 ? 'w-1/2 border-r border-black' : 'w-full'}`}>
                    {t.board_data ? (
                      <div className="w-full h-full relative flex items-center justify-center">
                         <TaskBoardEditor initialData={t.board_data} readOnly printMode hideToolbar rotateFullField />
                      </div>
                    ) : (
                      <div className="text-gray-400 text-[10px] font-bold">Sin gráfico</div>
                    )}
                  </div>
                  
                  {/* Teams Board (Col 3) */}
                  {t.teams_board_data && t.teams_board_data.length > 10 && (
                    <div className="relative w-1/2 flex items-center justify-center p-2">
                      <div className="w-full h-full relative">
                         <TeamsBoardEditor value={t.teams_board_data} readOnly printMode />
                      </div>
                    </div>
                  )}
                </div>
                
              </div>
            </div>
          )
        })}
      </div>
      
    </div>
  );
};
