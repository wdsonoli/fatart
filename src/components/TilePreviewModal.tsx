import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';
import { PosterLayout, PosterSettings, TileSlice } from '../types/poster';
import { getPaperSpecLabel } from '../utils/posterMath';

interface TilePreviewModalProps {
  tile: TileSlice | null;
  layout: PosterLayout;
  settings: PosterSettings;
  processedCanvas: HTMLCanvasElement | null;
  onClose: () => void;
  onSelectTile: (tile: TileSlice) => void;
}

export const TilePreviewModal: React.FC<TilePreviewModalProps> = ({
  tile,
  layout,
  settings,
  processedCanvas,
  onClose,
  onSelectTile,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!tile || !processedCanvas || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const pxPerMm = 3.2;
    const w = Math.round(layout.pageWMm * pxPerMm);
    const h = Math.round(layout.pageHMm * pxPerMm);
    canvas.width = w;
    canvas.height = h;

    // White sheet background
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, w, h);

    const isRoundTile =
      settings.panelShape === 'round' &&
      layout.circleCenterXMm !== undefined &&
      layout.circleCenterYMm !== undefined &&
      layout.circleRadiusMm !== undefined;

    // Draw tile slice
    if (tile.hasIntersection && tile.srcW > 0.5 && tile.srcH > 0.5) {
      ctx.save();
      if (isRoundTile) {
        const cxPx = (settings.marginMm + (layout.circleCenterXMm! - tile.gridXMm)) * pxPerMm;
        const cyPx = (settings.marginMm + (layout.circleCenterYMm! - tile.gridYMm)) * pxPerMm;
        const rPx = layout.circleRadiusMm! * pxPerMm;
        ctx.beginPath();
        ctx.arc(cxPx, cyPx, rPx, 0, Math.PI * 2);
        ctx.clip();
      }
      ctx.drawImage(
        processedCanvas,
        tile.srcX,
        tile.srcY,
        tile.srcW,
        tile.srcH,
        tile.destXMm * pxPerMm,
        tile.destYMm * pxPerMm,
        tile.destWMm * pxPerMm,
        tile.destHMm * pxPerMm
      );
      ctx.restore();

      if (isRoundTile && settings.showCutMarks) {
        const cxPx = (settings.marginMm + (layout.circleCenterXMm! - tile.gridXMm)) * pxPerMm;
        const cyPx = (settings.marginMm + (layout.circleCenterYMm! - tile.gridYMm)) * pxPerMm;
        const rPx = layout.circleRadiusMm! * pxPerMm;
        ctx.save();
        ctx.beginPath();
        ctx.rect(
          settings.marginMm * pxPerMm,
          settings.marginMm * pxPerMm,
          tile.printableWMm * pxPerMm,
          tile.printableHMm * pxPerMm
        );
        ctx.clip();
        ctx.strokeStyle = '#E11D74';
        ctx.lineWidth = 1.6;
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(cxPx, cyPx, rPx, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
      }
    }

    const marginPx = settings.marginMm * pxPerMm;
    const printableWPx = tile.printableWMm * pxPerMm;
    const printableHPx = tile.printableHMm * pxPerMm;

    // Overlap zones tint
    if (settings.overlapMm > 0) {
      const ovPx = settings.overlapMm * pxPerMm;
      ctx.fillStyle = 'rgba(232, 93, 4, 0.12)';
      if (tile.col < layout.cols - 1) {
        ctx.fillRect(w - marginPx - ovPx, marginPx, ovPx, printableHPx);
      }
      if (tile.row < layout.rows - 1) {
        ctx.fillRect(marginPx, h - marginPx - ovPx, printableWPx, ovPx);
      }
    }

    // Cut guides
    if (settings.showCutMarks) {
      ctx.save();
      ctx.strokeStyle = '#94a3b8';
      ctx.lineWidth = 1;
      ctx.setLineDash([5, 4]);
      ctx.strokeRect(marginPx, marginPx, printableWPx, printableHPx);

      ctx.strokeStyle = '#E85D04';
      if (settings.overlapMm > 0 && tile.col < layout.cols - 1) {
        const x = w - marginPx - settings.overlapMm * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(x, marginPx);
        ctx.lineTo(x, h - marginPx);
        ctx.stroke();
      }
      if (settings.overlapMm > 0 && tile.row < layout.rows - 1) {
        const y = h - marginPx - settings.overlapMm * pxPerMm;
        ctx.beginPath();
        ctx.moveTo(marginPx, y);
        ctx.lineTo(w - marginPx, y);
        ctx.stroke();
      }
      ctx.restore();
    }

    if (settings.showPageNumbers) {
      ctx.fillStyle = '#475569';
      ctx.font = '600 11px "JetBrains Mono", monospace';
      const labelY = Math.max(12, marginPx - 6);
      ctx.fillText(
        `FatiArt · Folha ${tile.index}/${layout.tiles.length} · ${tile.pageLabel}`,
        marginPx,
        labelY
      );
    }
  }, [tile, layout, settings, processedCanvas]);

  useEffect(() => {
    if (!tile) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tile, onClose]);

  if (!tile) return null;

  const currentIdx = layout.tiles.findIndex((t) => t.index === tile.index);
  const prevTile = currentIdx > 0 ? layout.tiles[currentIdx - 1] : null;
  const nextTile =
    currentIdx >= 0 && currentIdx < layout.tiles.length - 1
      ? layout.tiles[currentIdx + 1]
      : null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Prévia da folha ${tile.index}`}
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between gap-4">
          <div>
            <h3 className="font-display text-base font-bold text-slate-900">
              Folha {tile.index} de {layout.tiles.length} — {tile.pageLabel}
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 tabular-nums">
              {getPaperSpecLabel(settings).fullLabel} · Margem {settings.marginMm} mm · Sobreposição {settings.overlapMm} mm
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            aria-label="Fechar prévia"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 drafting-grid overflow-auto flex items-center justify-center flex-1">
          <div className="bg-white shadow-md border border-slate-300 inline-block">
            <canvas
              ref={canvasRef}
              className="max-h-[58vh] w-auto h-auto block"
            />
          </div>
        </div>

        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-4">
          <span className="text-xs text-slate-600">
            Faixa alaranjada indica área de sobreposição para colagem.
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!prevTile}
              onClick={() => prevTile && onSelectTile(prevTile)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Anterior
            </button>
            <button
              type="button"
              disabled={!nextTile}
              onClick={() => nextTile && onSelectTile(nextTile)}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              Próxima
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
