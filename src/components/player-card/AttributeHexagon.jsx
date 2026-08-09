import React from 'react';

// Custom inline-SVG attribute hexagon for the Broadcast XI card.
// 6 axes (PAC/SHO/PAS/DRI/DEF/PHY), animated stroke draw-on, soft gradient
// fill, and glowing vertices. Deliberately NOT Recharts — this is ~one file of
// hand-rolled SVG so we control the broadcast look and the draw animation.
const AXES = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'];

export default function AttributeHexagon({
  values = {},           // { PAC, SHO, PAS, DRI, DEF, PHY } 0-100
  size = 176,
  draw = true,           // animate the stroke draw-on
  reduced = false,       // prefers-reduced-motion → snap, no draw
  stroke = 'var(--bx-green-400, #3ddc84)',
  fill = 'var(--bx-green-400, #3ddc84)',
}) {
  const uid = React.useId().replace(/:/g, '');
  const cx = size / 2;
  const cy = size / 2;
  const maxR = size / 2 - 24;

  const angleAt = (i) => (-90 + i * 60) * (Math.PI / 180);
  const clamp = (v) => Math.max(0, Math.min(100, v ?? 0)) / 100;

  // filled data shape
  const pts = AXES.map((k, i) => {
    const a = angleAt(i);
    const r = maxR * clamp(values[k]);
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r];
  });
  const shape = pts.map((p) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ');

  // concentric grid rings at 33/66/100%
  const ring = (r) => AXES.map((_, i) => {
    const a = angleAt(i);
    return `${(cx + Math.cos(a) * maxR * r).toFixed(1)},${(cy + Math.sin(a) * maxR * r).toFixed(1)}`;
  }).join(' ');

  // dash length = polygon perimeter (used for the draw-on)
  let perim = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    perim += Math.hypot(q[0] - p[0], q[1] - p[1]);
  }
  const drawing = draw && !reduced;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`bxhexfill-${uid}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={fill} stopOpacity="0.5" />
          <stop offset="100%" stopColor={fill} stopOpacity="0.06" />
        </linearGradient>
        <filter id={`bxglow-${uid}`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2.4" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* grid rings */}
      {[1, 0.66, 0.33].map((r, i) => (
        <polygon key={`ring-${i}`} points={ring(r)} fill="none" stroke="#ffffff" strokeOpacity={0.10} strokeWidth="1" />
      ))}
      {/* axis spokes */}
      {AXES.map((_, i) => {
        const a = angleAt(i);
        return (
          <line key={`spoke-${i}`} x1={cx} y1={cy} x2={cx + Math.cos(a) * maxR} y2={cy + Math.sin(a) * maxR}
            stroke="#ffffff" strokeOpacity={0.07} strokeWidth="1" />
        );
      })}

      {/* filled attribute shape with animated draw-on */}
      <polygon
        points={shape}
        fill={`url(#bxhexfill-${uid})`}
        stroke={stroke}
        strokeWidth="2"
        strokeLinejoin="round"
        filter={`url(#bxglow-${uid})`}
        className={drawing ? 'bx-hex-draw' : undefined}
        style={{
          strokeDasharray: perim,
          strokeDashoffset: drawing ? undefined : 0,
          '--bx-hex-len': perim,
        }}
      />

      {/* glowing vertices */}
      {pts.map((p, i) => (
        <circle key={`v-${i}`} cx={p[0]} cy={p[1]} r="2.6" fill="#ffffff" filter={`url(#bxglow-${uid})`} />
      ))}

      {/* axis labels */}
      {AXES.map((k, i) => {
        const a = angleAt(i);
        const lr = maxR + 14;
        return (
          <text key={`lbl-${k}`} x={cx + Math.cos(a) * lr} y={cy + Math.sin(a) * lr} dy="0.32em"
            textAnchor="middle" className="bx-display" fontSize="9.5" fontWeight="700" fill="var(--bx-ink-1,#a7b3ad)">
            {k}
          </text>
        );
      })}
    </svg>
  );
}
