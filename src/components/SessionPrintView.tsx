import React from 'react';
import { Training, TrainingSessionTask } from '../types';
import { useAuth } from '../context/AuthContext';
import { TaskBoardEditor } from './TaskBoardEditor';

interface Props {
  session: Training;
  sessionTasks: TrainingSessionTask[];
}

export const SessionPrintView: React.FC<Props> = ({ session, sessionTasks }) => {
  const { profile } = useAuth();

  const renderTaskRow = (st: TrainingSessionTask) => {
    const task = st.task;
    if (!task) return null;

    return (
      <div key={st.id} className="border-b border-black flex page-break-inside-avoid">
        {/* Left Column: Details */}
        <div className="w-1/2 border-r border-black p-2 flex flex-col text-sm bg-white">
          <h3 className="font-bold uppercase mb-2">{task.title}</h3>
          <p className="flex-1 whitespace-pre-wrap">{task.description}</p>
          <div className="mt-2 text-xs">
            {task.duration && <p><strong>Tiempo:</strong> {task.duration}'</p>}
            {task.series && <p><strong>Series:</strong> {task.series} de {task.series_duration}'</p>}
            {task.task_types && task.task_types.length > 0 && <p><strong>Tipos:</strong> {task.task_types.join(', ')}</p>}
          </div>
        </div>
        {/* Right Column: Board */}
        <div className="w-1/2 relative bg-[#4a7c36] flex items-center justify-center p-2">
          {task.board_data ? (
            <div className="w-full h-full relative" style={{ minHeight: '250px' }}>
              <TaskBoardEditor initialData={task.board_data} readOnly={true} hideToolbar={true} printMode={true} />
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-white/50 text-xs font-bold" style={{ minHeight: '250px' }}>Sin gráfico</div>
          )}
        </div>
      </div>
    );
  };

  const calentamiento = sessionTasks.filter(t => t.task?.category === 'Calentamiento');
  const principal = sessionTasks.filter(t => ['Principal', 'Física', 'Estrategia'].includes(t.task?.category || ''));
  const vuelta = sessionTasks.filter(t => t.task?.category === 'Vuelta a la calma');

  return (
    <div className="w-[210mm] min-h-[297mm] mx-auto text-black bg-white font-sans text-sm p-4 print-container">
      {/* Header section */}
      <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
        <div className="w-16 h-16 flex items-center justify-center font-bold text-xs">
           {/* Placeholder for Club Logo */}
           <img src="https://golsmedia.com/wp-content/uploads/2025/05/atzeneta-1-1024x576.jpg" className="h-full object-contain grayscale" alt="Escudo" />
        </div>
        <div className="text-center flex-1">
          <h1 className="text-xl font-bold uppercase">{profile?.full_name || 'Entrenador'}</h1>
          <h2 className="text-sm font-bold">Entrenador - Nivel III</h2>
        </div>
        <div className="w-16 h-16 flex items-center justify-center font-bold text-xs">
           <img src="https://upload.wikimedia.org/wikipedia/en/thumb/f/f1/Federaci%C3%B3n_de_F%C3%BAtbol_de_la_Comunidad_Valenciana.svg/1200px-Federaci%C3%B3n_de_F%C3%BAtbol_de_la_Comunidad_Valenciana.svg.png" className="h-full object-contain grayscale" alt="FFCV" />
        </div>
      </div>

      {/* Info Table */}
      <table className="w-full text-center border-collapse border border-black mb-4">
        <thead>
          <tr className="bg-blue-200 font-bold uppercase text-xs" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
            <th className="border border-black p-1">EQUIPO</th>
            <th className="border border-black p-1">FECHA</th>
            <th className="border border-black p-1">SESIÓN</th>
            <th className="border border-black p-1">PERIODO</th>
            <th className="border border-black p-1">MESOCICLO</th>
            <th className="border border-black p-1">JUGADORES</th>
            <th className="border border-black p-1">TIEMPO</th>
          </tr>
        </thead>
        <tbody>
          <tr className="text-sm font-semibold">
            <td className="border border-black p-1">UD Atzeneta</td>
            <td className="border border-black p-1">{new Date(session.date).toLocaleDateString('es-ES')}</td>
            <td className="border border-black p-1">1</td>
            <td className="border border-black p-1">1</td>
            <td className="border border-black p-1">-</td>
            <td className="border border-black p-1">-</td>
            <td className="border border-black p-1">{session.duration}'</td>
          </tr>
        </tbody>
      </table>

      {/* Objectives Table */}
      <table className="w-full text-left border-collapse border border-black mb-6 text-xs">
        <tbody>
          <tr>
            <td className="border border-black p-1 font-bold bg-gray-100 w-32" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>MATERIAL</td>
            <td className="border border-black p-1" colSpan={3}>Balones, petos, conos, picas.</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-gray-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>OBJETIVOS</td>
            <td className="border border-black p-1 font-bold bg-gray-100 text-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>OFENSIVOS</td>
            <td className="border border-black p-1 font-bold bg-gray-100 text-center" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>DEFENSIVOS</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-gray-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>TACTICOS</td>
            <td className="border border-black p-1">{session.objective}</td>
            <td className="border border-black p-1"></td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-gray-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>TECNICOS</td>
            <td className="border border-black p-1">Control, conducción, pase.</td>
            <td className="border border-black p-1">Entrada, anticipación, interceptación.</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-gray-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>PSICOLOGICOS</td>
            <td className="border border-black p-1" colSpan={2}>Atención, concentración, voluntad.</td>
          </tr>
          <tr>
            <td className="border border-black p-1 font-bold bg-gray-100" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>FISICOS</td>
            <td className="border border-black p-1" colSpan={2}>Resistencia, Fuerza, Velocidad.</td>
          </tr>
        </tbody>
      </table>

      {/* Tareas */}
      <div className="border border-black">
        {/* Calentamiento */}
        {calentamiento.length > 0 && (
          <>
            <div className="bg-gray-200 font-bold uppercase p-1 px-2 flex justify-between border-b border-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <span>PARTE INICIAL - CALENTAMIENTO</span>
              <span>TIEMPO {calentamiento.reduce((sum, t) => sum + (t.duration || 0), 0)}'</span>
            </div>
            {calentamiento.map(renderTaskRow)}
          </>
        )}

        {/* Principal */}
        {principal.length > 0 && (
          <>
            <div className="bg-gray-200 font-bold uppercase p-1 px-2 flex justify-between border-b border-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <span>PARTE PRINCIPAL</span>
              <span>TIEMPO {principal.reduce((sum, t) => sum + (t.duration || 0), 0)}'</span>
            </div>
            {principal.map(renderTaskRow)}
          </>
        )}

        {/* Vuelta a la calma */}
        {vuelta.length > 0 && (
          <>
            <div className="bg-gray-200 font-bold uppercase p-1 px-2 flex justify-between border-b border-black" style={{ WebkitPrintColorAdjust: 'exact', printColorAdjust: 'exact' }}>
              <span>PARTE FINAL - VUELTA A LA CALMA</span>
              <span>TIEMPO {vuelta.reduce((sum, t) => sum + (t.duration || 0), 0)}'</span>
            </div>
            {vuelta.map(renderTaskRow)}
          </>
        )}
      </div>
    </div>
  );
};
