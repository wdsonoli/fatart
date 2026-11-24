import React, { useMemo } from 'react';
import { PosterLayout } from '../types/poster';

export type RulerShape = 'line' | 'rect';

export interface RulerCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

interface InteractiveRulerOverlayProps {
  layout: PosterLayout;
  surfaceRef: React.RefObject<HTMLDivElement | null>;
  rulerShape: RulerShape;
  lineCoords: RulerCoords;
  rectCoords: RulerCoords;
  onChangeLineCoords: React.Dispatch<React.SetStateAction<RulerCoords>>;
  onChangeRectCoords: React.Dispatch<React.SetStateAction<RulerCoords>>;
  accentColor?: string;
}

export function formatCm(val: number): string {
  return `${val.toFixed(1).replace('.', ',')} cm`;
}

export const InteractiveRulerOverlay: React.FC<InteractiveRulerOverlayProps> = ({
  layout,
  surfaceRef,
  rulerShape,
  lineCoords,
  rectCoords,
  onChangeLineCoords,
  onChangeRectCoords,
  accentColor = '#2563EB',
}) => {
  const getSurfacePct = (clientX: number, clientY: number) => {
    const el = surfaceRef.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    const w = Math.max(1, rect.width);
    const h = Math.max(1, rect.height);
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / w) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / h) * 100));
    return { x, y };
  };

  const attachDragListeners = (
    onMove: (ev: PointerEvent) => void,
    onDone?: () => void
  ) => {
    const cleanup = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', cleanup);
      window.removeEventListener('pointercancel', cleanup);
      onDone?.();
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', cleanup);
    window.addEventListener('pointercancel', cleanup);
  };

  // Draw a brand-new line or rectangle when dragging on empty overlay space
  // Wait for >= 4px movement so an accidental tap does not collapse the current ruler to 0 cm
  const handleSurfacePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startClientX = e.clientX;
    const startClientY = e.clientY;
    const start = getSurfacePct(e.clientX, e.clientY);
    let hasMoved = false;

    const onMove = (ev: PointerEvent) => {
      if (!hasMoved) {
        const dist = Math.hypot(ev.clientX - startClientX, ev.clientY - startClientY);
        if (dist < 4) return;
        hasMoved = true;
      }

      const curr = getSurfacePct(ev.clientX, ev.clientY);
      let nx = curr.x;
      let ny = curr.y;

      if (rulerShape === 'line') {
        if (ev.shiftKey) {
          const dxMm = ((nx - start.x) / 100) * layout.totalGridWMm;
          const dyMm = ((ny - start.y) / 100) * layout.totalGridHMm;
          if (Math.abs(dxMm) > Math.abs(dyMm) * 2) ny = start.y;
          else if (Math.abs(dyMm) > Math.abs(dxMm) * 2) nx = start.x;
        }
        onChangeLineCoords({ x1: start.x, y1: start.y, x2: nx, y2: ny });
      } else {
        if (ev.shiftKey) {
          const dxMm = ((nx - start.x) / 100) * layout.totalGridWMm;
          const dyMm = ((ny - start.y) / 100) * layout.totalGridHMm;
          const sideMm = Math.max(Math.abs(dxMm), Math.abs(dyMm));
          nx = start.x + (Math.sign(dxMm || 1) * sideMm * 100) / layout.totalGridWMm;
          ny = start.y + (Math.sign(dyMm || 1) * sideMm * 100) / layout.totalGridHMm;
          nx = Math.max(0, Math.min(100, nx));
          ny = Math.max(0, Math.min(100, ny));
        }
        onChangeRectCoords({ x1: start.x, y1: start.y, x2: nx, y2: ny });
      }
    };

    attachDragListeners(onMove);
  };

  // Drag either endpoint of the line
  const handleLineHandlePointerDown = (
    e: React.PointerEvent,
    handle: 'start' | 'end'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const onMove = (ev: PointerEvent) => {
      const curr = getSurfacePct(ev.clientX, ev.clientY);
      onChangeLineCoords((prev) => {
        const anchor =
          handle === 'start'
            ? { x: prev.x2, y: prev.y2 }
            : { x: prev.x1, y: prev.y1 };
        let nx = curr.x;
        let ny = curr.y;
        if (ev.shiftKey) {
          const dxMm = ((nx - anchor.x) / 100) * layout.totalGridWMm;
          const dyMm = ((ny - anchor.y) / 100) * layout.totalGridHMm;
          if (Math.abs(dxMm) > Math.abs(dyMm) * 2) ny = anchor.y;
          else if (Math.abs(dyMm) > Math.abs(dxMm) * 2) nx = anchor.x;
        }
        return handle === 'start'
          ? { ...prev, x1: nx, y1: ny }
          : { ...prev, x2: nx, y2: ny };
      });
    };

    attachDragListeners(onMove);
  };

  // Drag the entire line segment without changing its length/angle
  const handleLineMovePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = getSurfacePct(e.clientX, e.clientY);
    const orig = { ...lineCoords };
    const minX = Math.min(orig.x1, orig.x2);
    const maxX = Math.max(orig.x1, orig.x2);
    const minY = Math.min(orig.y1, orig.y2);
    const maxY = Math.max(orig.y1, orig.y2);

    const onMove = (ev: PointerEvent) => {
      const curr = getSurfacePct(ev.clientX, ev.clientY);
      const rawDx = curr.x - start.x;
      const rawDy = curr.y - start.y;
      const dx = Math.max(-minX, Math.min(100 - maxX, rawDx));
      const dy = Math.max(-minY, Math.min(100 - maxY, rawDy));
      onChangeLineCoords({
        x1: orig.x1 + dx,
        y1: orig.y1 + dy,
        x2: orig.x2 + dx,
        y2: orig.y2 + dy,
      });
    };

    attachDragListeners(onMove);
  };

  // Drag any corner of the rectangle
  const handleRectCornerPointerDown = (
    e: React.PointerEvent,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();

    const minX = Math.min(rectCoords.x1, rectCoords.x2);
    const maxX = Math.max(rectCoords.x1, rectCoords.x2);
    const minY = Math.min(rectCoords.y1, rectCoords.y2);
    const maxY = Math.max(rectCoords.y1, rectCoords.y2);

    const anchorX = corner === 'nw' || corner === 'sw' ? maxX : minX;
    const anchorY = corner === 'nw' || corner === 'ne' ? maxY : minY;

    const onMove = (ev: PointerEvent) => {
      const curr = getSurfacePct(ev.clientX, ev.clientY);
      let nx = curr.x;
      let ny = curr.y;
      if (ev.shiftKey) {
        const dxMm = ((nx - anchorX) / 100) * layout.totalGridWMm;
        const dyMm = ((ny - anchorY) / 100) * layout.totalGridHMm;
        const sideMm = Math.max(Math.abs(dxMm), Math.abs(dyMm));
        nx = anchorX + (Math.sign(dxMm || 1) * sideMm * 100) / layout.totalGridWMm;
        ny = anchorY + (Math.sign(dyMm || 1) * sideMm * 100) / layout.totalGridHMm;
        nx = Math.max(0, Math.min(100, nx));
        ny = Math.max(0, Math.min(100, ny));
      }
      onChangeRectCoords({ x1: anchorX, y1: anchorY, x2: nx, y2: ny });
    };

    attachDragListeners(onMove);
  };

  // Drag the entire rectangle
  const handleRectMovePointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const start = getSurfacePct(e.clientX, e.clientY);
    const orig = { ...rectCoords };
    const minX = Math.min(orig.x1, orig.x2);
    const maxX = Math.max(orig.x1, orig.x2);
    const minY = Math.min(orig.y1, orig.y2);
    const maxY = Math.max(orig.y1, orig.y2);
    const w = maxX - minX;
    const h = maxY - minY;

    const onMove = (ev: PointerEvent) => {
      const curr = getSurfacePct(ev.clientX, ev.clientY);
      const dx = curr.x - start.x;
      const dy = curr.y - start.y;
      const nextMinX = Math.max(0, Math.min(100 - w, minX + dx));
      const nextMinY = Math.max(0, Math.min(100 - h, minY + dy));
      onChangeRectCoords({
        x1: nextMinX,
        y1: nextMinY,
        x2: nextMinX + w,
        y2: nextMinY + h,
      });
    };

    attachDragListeners(onMove);
  };

  const metrics = useMemo(() => {
    const gridWcm = layout.totalGridWMm / 10;
    const gridHcm = layout.totalGridHMm / 10;

    const lineDxCm = ((lineCoords.x2 - lineCoords.x1) / 100) * gridWcm;
    const lineDyCm = ((lineCoords.y2 - lineCoords.y1) / 100) * gridHcm;
    const lineLenCm = Math.hypot(lineDxCm, lineDyCm);
    const lineMidX = (lineCoords.x1 + lineCoords.x2) / 2;
    const lineMidY = (lineCoords.y1 + lineCoords.y2) / 2;

    const rectLeftPct = Math.min(rectCoords.x1, rectCoords.x2);
    const rectTopPct = Math.min(rectCoords.y1, rectCoords.y2);
    const rectWPct = Math.abs(rectCoords.x2 - rectCoords.x1);
    const rectHPct = Math.abs(rectCoords.y2 - rectCoords.y1);
    const rectWCm = (rectWPct / 100) * gridWcm;
    const rectHCm = (rectHPct / 100) * gridHcm;
    const rectDiagCm = Math.hypot(rectWCm, rectHCm);

    return {
      lineLenCm,
      lineMidX,
      lineMidY,
      rectLeftPct,
      rectTopPct,
      rectWPct,
      rectHPct,
      rectWCm,
      rectHCm,
      rectDiagCm,
    };
  }, [layout, lineCoords, rectCoords]);

  const placeBadgeBelow = metrics.lineMidY < 14;

  return (
    <div
      onPointerDown={handleSurfacePointerDown}
      className="absolute inset-0 z-20 cursor-crosshair select-none touch-none"
    >
      {rulerShape === 'line' && (
        <>
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full overflow-visible pointer-events-none"
          >
            {/* Subtle white halo behind the measurement line for legibility on dark artwork */}
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke="rgba(255,255,255,0.8)"
              strokeWidth="4.5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke={accentColor}
              strokeWidth="2.5"
              vectorEffect="non-scaling-stroke"
              strokeLinecap="round"
            />
            {/* Generous invisible hit area so the user can drag the entire line */}
            <line
              x1={lineCoords.x1}
              y1={lineCoords.y1}
              x2={lineCoords.x2}
              y2={lineCoords.y2}
              stroke="transparent"
              strokeWidth="22"
              vectorEffect="non-scaling-stroke"
              className="pointer-events-auto cursor-move touch-none"
              onPointerDown={handleLineMovePointerDown}
            />
          </svg>

          {/* Measurement Badge */}
          <div
            style={{
              left: `${metrics.lineMidX}%`,
              top: `${metrics.lineMidY}%`,
            }}
            className={`absolute -translate-x-1/2 pointer-events-none bg-white/95 text-slate-900 border border-slate-200/90 shadow-md px-2.5 py-0.5 rounded-md font-display text-xs font-bold tabular-nums whitespace-nowrap ${
              placeBadgeBelow ? 'translate-y-3' : '-translate-y-full -mt-2.5'
            }`}
          >
            {formatCm(metrics.lineLenCm)}
          </div>

          {/* Start Endpoint Handle (32px touch target wrapping 14px visual dot) */}
          <div
            onPointerDown={(e) => handleLineHandlePointerDown(e, 'start')}
            style={{
              left: `${lineCoords.x1}%`,
              top: `${lineCoords.y1}%`,
            }}
            title="Arraste para ajustar início da linha"
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none group"
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 shadow-sm transition-transform group-hover:scale-125"
              style={{ borderColor: accentColor }}
            />
          </div>

          {/* End Endpoint Handle (32px touch target wrapping 14px visual dot) */}
          <div
            onPointerDown={(e) => handleLineHandlePointerDown(e, 'end')}
            style={{
              left: `${lineCoords.x2}%`,
              top: `${lineCoords.y2}%`,
            }}
            title="Arraste para ajustar fim da linha"
            className="absolute -translate-x-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center cursor-grab active:cursor-grabbing touch-none group"
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 shadow-sm transition-transform group-hover:scale-125"
              style={{ borderColor: accentColor }}
            />
          </div>
        </>
      )}

      {rulerShape === 'rect' && (
        <div
          onPointerDown={handleRectMovePointerDown}
          style={{
            left: `${metrics.rectLeftPct}%`,
            top: `${metrics.rectTopPct}%`,
            width: `${metrics.rectWPct}%`,
            height: `${metrics.rectHPct}%`,
            borderColor: accentColor,
            backgroundColor: `${accentColor}1F`,
          }}
          className="absolute border-2 cursor-move touch-none"
        >
          {/* Center Dimension Readout */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-white/95 text-slate-900 border border-slate-200/90 shadow-md px-2.5 py-1 rounded-md text-center whitespace-nowrap">
            <div className="font-display text-xs font-bold tabular-nums">
              {metrics.rectWCm.toFixed(1).replace('.', ',')} ×{' '}
              {metrics.rectHCm.toFixed(1).replace('.', ',')} cm
            </div>
            {metrics.rectWPct > 18 && metrics.rectHPct > 14 && (
              <div className="text-[10px] font-mono tabular-nums text-slate-500">
                Diag: {formatCm(metrics.rectDiagCm)}
              </div>
            )}
          </div>

          {/* 4 Corner Handles with generous touch hit areas */}
          <div
            onPointerDown={(e) => handleRectCornerPointerDown(e, 'nw')}
            className="absolute -left-4 -top-4 w-8 h-8 flex items-center justify-center cursor-nwse-resize touch-none group"
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 shadow-sm transition-transform group-hover:scale-125"
              style={{ borderColor: accentColor }}
            />
          </div>
          <div
            onPointerDown={(e) => handleRectCornerPointerDown(e, 'ne')}
            className="absolute -right-4 -top-4 w-8 h-8 flex items-center justify-center cursor-nesw-resize touch-none group"
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 shadow-sm transition-transform group-hover:scale-125"
              style={{ borderColor: accentColor }}
            />
          </div>
          <div
            onPointerDown={(e) => handleRectCornerPointerDown(e, 'sw')}
            className="absolute -left-4 -bottom-4 w-8 h-8 flex items-center justify-center cursor-nesw-resize touch-none group"
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 shadow-sm transition-transform group-hover:scale-125"
              style={{ borderColor: accentColor }}
            />
          </div>
          <div
            onPointerDown={(e) => handleRectCornerPointerDown(e, 'se')}
            className="absolute -right-4 -bottom-4 w-8 h-8 flex items-center justify-center cursor-nwse-resize touch-none group"
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-slate-950 border-2 shadow-sm transition-transform group-hover:scale-125"
              style={{ borderColor: accentColor }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
