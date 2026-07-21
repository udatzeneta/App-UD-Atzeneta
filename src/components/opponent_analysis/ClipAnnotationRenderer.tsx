import React, { useEffect, useRef } from 'react';
import ReactPlayer from 'react-player';
import { ClipAnnotation } from '../../types';

// ViewBox 16:9
const VBW = 160;
const VBH = 90;

export const MagnifierLens: React.FC<{
  a: ClipAnnotation;
  videoUrl: string;
  freezeTime: number;
  cw: number;
  ch: number;
}> = ({ a, videoUrl, freezeTime, cw, ch }) => {
  const ref = useRef<HTMLVideoElement>(null);
  const zoom = a.zoom || 2;
  const r = (a.radius || 0.1);
  const lensD = r * 2 * cw; // diámetro en px

  const seek = () => {
    if (ref.current) {
      try { ref.current.currentTime = freezeTime; } catch { /* noop */ }
    }
  };
  useEffect(() => { seek(); }, [freezeTime]); // eslint-disable-line react-hooks/exhaustive-deps

  if (cw === 0) return null;

  return (
    <div
      className="absolute rounded-full overflow-hidden pointer-events-none shadow-[0_0_0_3px_rgba(255,255,255,0.9),0_8px_24px_rgba(0,0,0,0.6)]"
      style={{
        width: lensD,
        height: lensD,
        left: a.x * cw - lensD / 2,
        top: a.y * ch - lensD / 2,
      }}
    >
      <div
        className="absolute"
        style={{
          width: cw * zoom,
          height: ch * zoom,
          left: -(a.x * cw * zoom) + lensD / 2,
          top: -(a.y * ch * zoom) + lensD / 2,
        }}
      >
        <ReactPlayer
          ref={ref as any}
          src={videoUrl}
          width="100%"
          height="100%"
          controls={false}
          playing={false}
          onReady={seek}
        />
      </div>
    </div>
  );
};

interface RendererProps {
  annotations: ClipAnnotation[];
  selectedId?: string | null;
  cw: number;
  ch: number;
  videoUrl: string;
  freezeTime: number;
}

export const ClipAnnotationRenderer: React.FC<RendererProps> = ({ annotations, selectedId, cw, ch, videoUrl, freezeTime }) => {
  const spotlights = annotations.filter(a => a.type === 'spotlight');

  return (
    <>
      <svg
        viewBox={`0 0 ${VBW} ${VBH}`}
        preserveAspectRatio="none"
        className="absolute inset-0 w-full h-full pointer-events-none z-20"
      >
        <defs>
          {spotlights.length > 0 && (
            <mask id="spotmask">
              <rect x="0" y="0" width={VBW} height={VBH} fill="white" />
              {spotlights.map(s => (
                <circle key={s.id} cx={s.x * VBW} cy={s.y * VBH} r={(s.radius || 0.1) * VBW} fill="black" />
              ))}
            </mask>
          )}
          <marker id="arrowhead" markerWidth="4" markerHeight="4" refX="3" refY="2" orient="auto">
            <polygon points="0 0, 4 2, 0 4" fill="context-stroke" />
          </marker>
        </defs>

        {/* Oscurecido del foco */}
        {spotlights.length > 0 && (
          <rect x="0" y="0" width={VBW} height={VBH} fill="black" opacity="0.6" mask="url(#spotmask)" />
        )}
        {spotlights.map(s => (
          <circle key={`ring-${s.id}`} cx={s.x * VBW} cy={s.y * VBH} r={(s.radius || 0.1) * VBW}
            fill="none" stroke={s.color} strokeWidth={selectedId === s.id ? 1.4 : 0.8}
            strokeDasharray={selectedId === s.id ? '2 1.5' : undefined} />
        ))}

        {/* Zonas (polígono a mano alzada; rect para datos antiguos) */}
        {annotations.filter(a => a.type === 'zone').map(z => (
          z.points && z.points.length >= 2 ? (
            <polygon key={z.id}
              points={z.points.map(p => `${p.x * VBW},${p.y * VBH}`).join(' ')}
              fill={z.color} fillOpacity="0.2" stroke={z.color}
              strokeWidth={selectedId === z.id ? 1.6 : 1} strokeLinejoin="round" />
          ) : (
            <rect key={z.id} x={z.x * VBW} y={z.y * VBH} width={(z.w || 0) * VBW} height={(z.h || 0) * VBH}
              fill={z.color} fillOpacity="0.18" stroke={z.color}
              strokeWidth={selectedId === z.id ? 1.4 : 0.9} rx="1" />
          )
        ))}

        {/* Líneas que enlazan jugadores */}
        {annotations.filter(a => a.type === 'line' && a.points && a.points.length > 0).map(l => (
          <g key={l.id}>
            {l.points!.length > 1 && (
              <polyline points={l.points!.map(p => `${p.x * VBW},${p.y * VBH}`).join(' ')}
                fill="none" stroke={l.color} strokeWidth={selectedId === l.id ? 1.8 : 1.3}
                strokeLinejoin="round" strokeLinecap="round" />
            )}
            {l.points!.map((p, i) => (
              <circle key={i} cx={p.x * VBW} cy={p.y * VBH} r={1.6}
                fill={l.color} stroke="black" strokeWidth={0.5} />
            ))}
          </g>
        ))}

        {/* Flechas */}
        {annotations.filter(a => a.type === 'arrow').map(a => (
          <line key={a.id} x1={a.x * VBW} y1={a.y * VBH} x2={(a.x2 || a.x) * VBW} y2={(a.y2 || a.y) * VBH}
            stroke={a.color} strokeWidth={selectedId === a.id ? 2 : 1.4} strokeLinecap="round"
            markerEnd="url(#arrowhead)" />
        ))}

        {/* Marcadores de jugador: anillo (perspectiva) que rodea al jugador */}
        {annotations.filter(a => a.type === 'player').map(p => {
          const r = p.radius || 0.05;
          const ry = r * VBW * 0.5;
          return (
            <g key={p.id}>
              <ellipse cx={p.x * VBW} cy={p.y * VBH} rx={r * VBW} ry={ry}
                fill={p.color} fillOpacity="0.1" stroke={p.color}
                strokeWidth={selectedId === p.id ? 1.8 : 1.2} />
              {p.label ? (
                <text x={p.x * VBW} y={p.y * VBH - ry - 2} fill={p.color}
                  fontSize="5.5" fontWeight="800" textAnchor="middle"
                  style={{ paintOrder: 'stroke' }} stroke="black" strokeWidth="1">
                  {p.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {/* Texto */}
        {annotations.filter(a => a.type === 'text').map(t => (
          <text key={t.id} x={t.x * VBW} y={t.y * VBH} fill={t.color} fontSize="6" fontWeight="800"
            textAnchor="middle" style={{ paintOrder: 'stroke' }} stroke="black" strokeWidth="1.2">
            {t.label || 'Texto'}
          </text>
        ))}

        {/* Aros de referencia de la lupa */}
        {annotations.filter(a => a.type === 'magnifier').map(m => (
          <circle key={m.id} cx={m.x * VBW} cy={m.y * VBH} r={(m.radius || 0.11) * VBW}
            fill="none" stroke={selectedId === m.id ? m.color : 'transparent'} strokeWidth="1"
            strokeDasharray="2 1.5" />
        ))}
      </svg>

      {/* Lupas (HTML, encima del SVG) */}
      {cw > 0 && annotations.filter(a => a.type === 'magnifier').map(m => (
        <MagnifierLens key={m.id} a={m} videoUrl={videoUrl} freezeTime={freezeTime} cw={cw} ch={ch} />
      ))}
    </>
  );
};
