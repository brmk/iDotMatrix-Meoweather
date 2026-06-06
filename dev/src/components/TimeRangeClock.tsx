import { useCallback, useEffect, useRef, useState } from 'react';

interface TimeRangeClockProps {
  from: number;
  to: number;
  onChange: (from: number, to: number) => void;
  onDragStart: () => void;
}

const CX = 60;
const CY = 60;
const TRACK_R = 44;
const HANDLE_R = 7;
const TICK_R_INNER_MAJOR = 36;
const TICK_R_INNER_MINOR = 39;
const LABEL_R = 29;

function hourToAngle(h: number): number {
  return (h / 24) * Math.PI * 2 - Math.PI / 2;
}

function hourToXY(h: number, r: number): [number, number] {
  const a = hourToAngle(h);
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
}

function xyToHour(x: number, y: number): number {
  const dx = x - CX;
  const dy = y - CY;
  let a = Math.atan2(dy, dx) + Math.PI / 2;
  if (a < 0) a += Math.PI * 2;
  return Math.round((a / (Math.PI * 2)) * 24) % 24;
}

function arcPath(fromH: number, toH: number): string {
  const [x1, y1] = hourToXY(fromH, TRACK_R);
  const [x2, y2] = hourToXY(toH, TRACK_R);
  const spanHours = toH > fromH ? toH - fromH : 24 - fromH + toH;
  const largeArc = spanHours > 12 ? 1 : 0;
  // degenerate: span == 0 or full circle
  if (spanHours === 0) return '';
  if (spanHours === 24) {
    // full circle as two arcs
    const [mx, my] = hourToXY(fromH + 12, TRACK_R);
    return `M ${x1} ${y1} A ${TRACK_R} ${TRACK_R} 0 0 1 ${mx} ${my} A ${TRACK_R} ${TRACK_R} 0 0 1 ${x1} ${y1} Z`;
  }
  return `M ${x1} ${y1} A ${TRACK_R} ${TRACK_R} 0 ${largeArc} 1 ${x2} ${y2}`;
}

export default function TimeRangeClock({ from, to, onChange, onDragStart }: Readonly<TimeRangeClockProps>) {
  const svgRef = useRef<SVGSVGElement>(null);
  const draggingRef = useRef<'from' | 'to' | null>(null);
  const [currentHour, setCurrentHour] = useState(() => new Date().getHours());

  useEffect(() => {
    const id = setInterval(() => setCurrentHour(new Date().getHours()), 60_000);
    return () => clearInterval(id);
  }, []);

  const getSvgPoint = useCallback((e: React.PointerEvent): [number, number] => {
    const rect = svgRef.current!.getBoundingClientRect();
    const scaleX = 120 / rect.width;
    const scaleY = 120 / rect.height;
    return [(e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY];
  }, []);

  const onPointerDown = useCallback((handle: 'from' | 'to') => (e: React.PointerEvent) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    draggingRef.current = handle;
    onDragStart();
  }, [onDragStart]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (!draggingRef.current) return;
    const [px, py] = getSvgPoint(e);
    const h = xyToHour(px, py);
    if (draggingRef.current === 'from') {
      onChange(h, to);
    } else {
      onChange(from, h);
    }
  }, [from, to, onChange, getSvgPoint]);

  const onPointerUp = useCallback(() => {
    draggingRef.current = null;
  }, []);

  const [fx, fy] = hourToXY(from, TRACK_R);
  const [tx, ty] = hourToXY(to, TRACK_R);
  const [cwx, cwy] = hourToXY(currentHour, TRACK_R - 14);

  const spanHours = to > from ? to - from : 24 - from + to;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg
        ref={svgRef}
        viewBox="0 0 120 120"
        width={120}
        height={120}
        style={{ touchAction: 'none', userSelect: 'none', cursor: draggingRef.current ? 'grabbing' : 'default' }}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerLeave={onPointerUp}
      >
        {/* track background */}
        <circle cx={CX} cy={CY} r={TRACK_R} fill="none" stroke="#333" strokeWidth={3} />

        {/* tick marks */}
        {Array.from({ length: 24 }, (_, h) => {
          const [x1, y1] = hourToXY(h, TRACK_R);
          const isMajor = h % 6 === 0;
          const [x2, y2] = hourToXY(h, isMajor ? TICK_R_INNER_MAJOR : TICK_R_INNER_MINOR);
          return (
            <line key={h} x1={x1} y1={y1} x2={x2} y2={y2}
              stroke={isMajor ? '#666' : '#444'} strokeWidth={isMajor ? 1.5 : 1} />
          );
        })}

        {/* hour labels */}
        {([0, 6, 12, 18] as const).map((h) => {
          const [lx, ly] = hourToXY(h, LABEL_R);
          return (
            <text key={h} x={lx} y={ly} textAnchor="middle" dominantBaseline="middle"
              fill="#666" fontSize={9} fontFamily="monospace">
              {h}
            </text>
          );
        })}

        {/* off-period arc */}
        {spanHours > 0 && (
          <path d={arcPath(from, to)} fill="none" stroke="#d84" strokeWidth={4} strokeLinecap="round" />
        )}

        {/* current time indicator */}
        <line x1={CX} y1={CY} x2={cwx} y2={cwy} stroke="#555" strokeWidth={1.5} strokeLinecap="round" />
        <circle cx={CX} cy={CY} r={2} fill="#555" />

        {/* from handle */}
        <circle
          cx={fx} cy={fy} r={HANDLE_R}
          fill="#d84" stroke="#1a1a1a" strokeWidth={1.5}
          style={{ cursor: 'grab' }}
          onPointerDown={onPointerDown('from')}
        />

        {/* to handle */}
        <circle
          cx={tx} cy={ty} r={HANDLE_R}
          fill="#8ad" stroke="#1a1a1a" strokeWidth={1.5}
          style={{ cursor: 'grab' }}
          onPointerDown={onPointerDown('to')}
        />
      </svg>

      <div style={{ fontSize: 10, fontFamily: 'monospace', color: '#888', textAlign: 'center' }}>
        <span style={{ color: '#d84' }}>●</span> {String(from).padStart(2, '0')}:00
        {' '}→{' '}
        <span style={{ color: '#8ad' }}>●</span> {String(to).padStart(2, '0')}:00
        <span style={{ color: '#555' }}>{spanHours > 0 ? ` (${spanHours}h off)` : ''}</span>
      </div>
    </div>
  );
}
