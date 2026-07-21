import React, { useState } from 'react';
import { GRUPO_LABEL, HEATMAP_COLORS, colorForCount } from '../lib/fuerzaConstants';
import { anteriorData, posteriorData } from '../lib/bodyHighlighterData';

const groupToHighlighterMuscles: Record<string, string[]> = {
  cuadriceps: ['quadriceps'],
  isquiotibiales: ['hamstring'],
  gluteos: ['gluteal'],
  gemelos: ['calves'],
  core: ['abs', 'obliques'],
  pecho: ['chest'],
  espalda: ['upper-back', 'lower-back', 'trapezius'],
  hombro: ['front-deltoids', 'back-deltoids'],
  biceps: ['biceps'],
  triceps: ['triceps'],
};

// Create a reverse mapping to easily know which "group" a muscle belongs to
const muscleToGroup: Record<string, string> = {};
Object.entries(groupToHighlighterMuscles).forEach(([group, muscles]) => {
  muscles.forEach(m => {
    muscleToGroup[m] = group;
  });
});

export default function MuscleHeatmap({ counts = {}, size = 220 }: { counts?: Record<string, number>, size?: number }) {
  const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; text: string }>({
    visible: false,
    x: 0,
    y: 0,
    text: ''
  });

  const handleMouseMove = (e: React.MouseEvent, groupKey: string) => {
    if (!groupKey) return;
    const c = counts[groupKey] || 0;
    const text = `${(GRUPO_LABEL as any)[groupKey]}: ${c} ejercicio${c !== 1 ? 's' : ''}`;
    setTooltip({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      text
    });
  };

  const handleMouseLeave = () => {
    setTooltip(t => ({ ...t, visible: false }));
  };

  const getColor = (muscle: string) => {
    const group = muscleToGroup[muscle];
    if (!group) return HEATMAP_COLORS[0];
    const count = counts[group] || 0;
    return colorForCount(count);
  };

  return (
    <div className="relative flex flex-col sm:flex-row items-center justify-center gap-12 w-full max-w-4xl mx-auto">
      
      {tooltip.visible && (
        <div 
          className="fixed z-50 px-3 py-2 bg-brand-gray-dark border border-brand-black-border text-white text-xs rounded-lg pointer-events-none shadow-glow-sm"
          style={{ left: tooltip.x + 15, top: tooltip.y + 15 }}
        >
          {tooltip.text}
        </div>
      )}

      <div className="flex flex-col items-center">
        <h4 className="text-sm font-bold text-brand-gray-muted mb-4 uppercase tracking-wider">Frontal</h4>
        <svg
          width={size}
          viewBox="0 0 100 220"
          className="drop-shadow-lg"
          style={{ maxWidth: '100%' }}
          onMouseLeave={handleMouseLeave}
        >
          {anteriorData.map(item => (
            <g key={item.muscle}>
              {item.svgPoints.map((points, idx) => {
                const group = muscleToGroup[item.muscle];
                return (
                  <polygon
                    key={idx}
                    points={points}
                    fill={getColor(item.muscle)}
                    stroke="#1A1C20"
                    strokeWidth="0.5"
                    className="transition-colors duration-300 hover:brightness-110 cursor-pointer"
                    onMouseMove={group ? (e) => handleMouseMove(e, group) : undefined}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
      
      <div className="flex flex-col items-center">
        <h4 className="text-sm font-bold text-brand-gray-muted mb-4 uppercase tracking-wider">Dorsal</h4>
        <svg
          width={size}
          viewBox="0 0 100 220"
          className="drop-shadow-lg"
          style={{ maxWidth: '100%' }}
          onMouseLeave={handleMouseLeave}
        >
          {posteriorData.map(item => (
            <g key={item.muscle}>
              {item.svgPoints.map((points, idx) => {
                const group = muscleToGroup[item.muscle];
                return (
                  <polygon
                    key={idx}
                    points={points}
                    fill={getColor(item.muscle)}
                    stroke="#1A1C20"
                    strokeWidth="0.5"
                    className="transition-colors duration-300 hover:brightness-110 cursor-pointer"
                    onMouseMove={group ? (e) => handleMouseMove(e, group) : undefined}
                  />
                );
              })}
            </g>
          ))}
        </svg>
      </div>
    </div>
  );
}

export function MuscleHeatmapLegend() {
  return (
    <div className="flex items-center gap-2.5 text-xs text-brand-gray-muted flex-wrap justify-center mt-6">
      <span>0</span>
      {[0, 1, 2, 3, 4].map(n => (
        <div key={n} className="flex items-center gap-1">
          <span 
            className="w-3 h-3 rounded-sm border border-brand-black-border inline-block"
            style={{ background: colorForCount(n) }} 
          />
        </div>
      ))}
      <span>4+ ejercicios</span>
    </div>
  );
}
