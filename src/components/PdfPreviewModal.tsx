import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  Download,
  FileText,
  Grid,
  Maximize2,
  X,
} from 'lucide-react';
import { PosterLayout, PosterSettings, TileSlice } from '../types/poster';
import { isTileCanvasBlank } from '../utils/imageProcessing';
import { getPaperSpecLabel } from '../utils/posterMath';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirmDownload: () => void;
  isExporting: boolean;
  processedCanvas: HTMLCanvasElement | null;
  layout: PosterLayout | null;
  settings: PosterSettings;
}

type PreviewPageItem =
  | { kind: 'assembly'; pageNumber: number; title: string; subtitle: string }
  | {
      kind: 'tile';
      pageNumber: number;
      sheetIndex: number;
      totalSheets: number;
      title: string;
      subtitle: string;
      tile: TileSlice;
    };

function renderAssemblyMapToCanvas(
  canvas: HTMLCanvasElement,
  processedCanvas: HTMLCanvasElement,
  layout: PosterLayout,
  settings: PosterSettings,
  activeTiles: TileSlice[],
  pxPerMm: number
) {
  const w = Math.max(120, Math.round(layout.pageWMm * pxPerMm));
  const h = Math.max(120, Math.round(layout.pageHMm * pxPerMm));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const pad = 16 * pxPerMm;
  ctx.fillStyle = '#0F172A';
  ctx.font = `700 ${Math.round(5.4 * pxPerMm)}px "Plus Jakarta Sans", sans-serif`;
  ctx.fillText('Mapa de Montagem — FatiArt Studio', pad, 20 * pxPerMm);

  ctx.fillStyle = '#475569';
  ctx.font = `400 ${Math.round(3.4 * pxPerMm)}px "DM Sans", sans-serif`;
  const paperName = getPaperSpecLabel(settings).shortLabel;
  ctx.fillText(
    `Grade: ${layout.cols}×${layout.rows} (${activeTiles.length} folhas ${paperName}) · ${(
      layout.imgWMm / 10
    ).toFixed(1)}×${(layout.imgHMm / 10).toFixed(1)} cm · Sobreposição ${
      settings.overlapMm
    } mm`,
    pad,
    27 * pxPerMm
  );

  const availW = (layout.pageWMm - 32) * pxPerMm;
  const availH = (layout.pageHMm - 54) * pxPerMm;
  const scale = Math.min(availW / layout.totalGridWMm, availH / layout.totalGridHMm);

  const drawW = layout.totalGridWMm * scale;
  const drawH = layout.totalGridHMm * scale;
  const originX = (w - drawW) / 2;
  const originY = 36 * pxPerMm + (availH - drawH) / 2;

  ctx.drawImage(
    processedCanvas,
    originX + layout.imgXMm * scale,
    originY + layout.imgYMm * scale,
    layout.imgWMm * scale,
    layout.imgHMm * scale
  );

  for (const tile of layout.tiles) {
    const rx = originX + tile.gridXMm * scale;
    const ry = originY + tile.gridYMm * scale;
    const rw = tile.printableWMm * scale;
    const rh = tile.printableHMm * scale;

    const activeIdx = activeTiles.findIndex((t) => t.index === tile.index);
    const isActive = activeIdx !== -1;

    ctx.strokeStyle = isActive ? '#E85D04' : '#CBD5E1';
    ctx.lineWidth = Math.max(1, 0.35 * pxPerMm);
    ctx.strokeRect(rx, ry, rw, rh);

    const label = isActive ? `${activeIdx + 1} (${tile.pageLabel})` : 'Branco';
    ctx.font = `700 ${Math.max(8, Math.round(2.5 * pxPerMm))}px "JetBrains Mono", monospace`;
    const tw = Math.min(rw - 4, ctx.measureText(label).width + 6);
    ctx.fillStyle = 'rgba(255,255,255,0.92)';
    ctx.fillRect(rx + 2, ry + 2, tw, Math.max(11, 4.5 * pxPerMm));
    ctx.fillStyle = isActive ? '#0F172A' : '#94A3B8';
    ctx.fillText(label, rx + 4, ry + Math.max(10, 3.8 * pxPerMm));
  }
}

function renderTileToCanvas(
  canvas: HTMLCanvasElement,
  processedCanvas: HTMLCanvasElement,
  layout: PosterLayout,
  settings: PosterSettings,
  tile: TileSlice,
  sheetIndex: number,
  totalSheets: number,
  pxPerMm: number
) {
  const w = Math.max(120, Math.round(layout.pageWMm * pxPerMm));
  const h = Math.max(120, Math.round(layout.pageHMm * pxPerMm));
  canvas.width = w;
  canvas.height = h;

  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  if (tile.hasIntersection && tile.srcW > 0.5 && tile.srcH > 0.5) {
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
  }

  const marginPx = settings.marginMm * pxPerMm;
  const printableWPx = tile.printableWMm * pxPerMm;
  const printableHPx = tile.printableHMm * pxPerMm;

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

  if (settings.showCutMarks) {
    ctx.save();
    ctx.strokeStyle = '#94A3B8';
    ctx.lineWidth = Math.max(0.8, 0.25 * pxPerMm);
    ctx.setLineDash([4, 3]);
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

  if (settings.showPageNumbers && pxPerMm >= 1.2) {
    ctx.fillStyle = '#475569';
    ctx.font = `600 ${Math.max(8, Math.round(2.8 * pxPerMm))}px "JetBrains Mono", monospace`;
    const labelY = Math.max(10, marginPx - 4);
    ctx.fillText(
      `FatiArt · Folha ${sheetIndex}/${totalSheets} · ${tile.pageLabel}`,
      marginPx,
      labelY
    );
  }
}

const PageThumbnail: React.FC<{
  page: PreviewPageItem;
  processedCanvas: HTMLCanvasElement;
  layout: PosterLayout;
  settings: PosterSettings;
  activeTiles: TileSlice[];
  isSelected: boolean;
  onClick: () => void;
}> = ({
  page,
  processedCanvas,
  layout,
  settings,
  activeTiles,
  isSelected,
  onClick,
}) => {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    if (page.kind === 'assembly') {
      renderAssemblyMapToCanvas(
        ref.current,
        processedCanvas,
        layout,
        settings,
        activeTiles,
        1.1
      );
    } else {
      renderTileToCanvas(
        ref.current,
        processedCanvas,
        layout,
        settings,
        page.tile,
        page.sheetIndex,
        page.totalSheets,
        1.1
      );
    }
  }, [page, processedCanvas, layout, settings, activeTiles]);

  return (
    <button
      type="button"
      onClick={onClick}
      className={`group bg-white rounded-xl border p-3 text-left transition-all cursor-pointer flex flex-col gap-2.5 ${
        isSelected
          ? 'border-[#2563EB] ring-2 ring-[#2563EB]/25 shadow-sm'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-xs'
      }`}
    >
      <div className="w-full bg-slate-100 rounded-lg p-2 flex items-center justify-center overflow-hidden">
        <canvas
          ref={ref}
          className="max-h-52 w-auto h-auto shadow-xs border border-slate-200 bg-white block"
        />
      </div>
      <div className="flex items-center justify-between gap-2 w-full">
        <div className="min-w-0">
          <div className="font-display text-xs font-bold text-slate-900 truncate">
            {page.title}
          </div>
          <div className="text-[11px] text-slate-500 truncate">{page.subtitle}</div>
        </div>
        <span className="font-mono tabular-nums text-[11px] font-semibold text-slate-500 shrink-0">
          Pág. {page.pageNumber}
        </span>
      </div>
    </button>
  );
};

export const PdfPreviewModal: React.FC<PdfPreviewModalProps> = ({
  isOpen,
  onClose,
  onConfirmDownload,
  isExporting,
  processedCanvas,
  layout,
  settings,
}) => {
  const [viewMode, setViewMode] = useState<'grid' | 'single'>('grid');
  const [selectedPageIdx, setSelectedPageIdx] = useState(0);
  const singleCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const { activeTiles, skippedCount } = useMemo(() => {
    if (!layout || !processedCanvas) {
      return { activeTiles: [] as TileSlice[], skippedCount: 0 };
    }
    const active: TileSlice[] = [];
    let skipped = 0;
    for (const tile of layout.tiles) {
      if (settings.skipBlankPages && isTileCanvasBlank(processedCanvas, tile)) {
        skipped++;
      } else {
        active.push(tile);
      }
    }
    if (active.length === 0 && layout.tiles.length > 0) {
      active.push(layout.tiles[0]);
      skipped = Math.max(0, layout.tiles.length - 1);
    }
    return { activeTiles: active, skippedCount: skipped };
  }, [layout, processedCanvas, settings.skipBlankPages]);

  const pages: PreviewPageItem[] = useMemo(() => {
    const list: PreviewPageItem[] = [];
    let p = 1;
    if (settings.includeAssemblyMap) {
      list.push({
        kind: 'assembly',
        pageNumber: p++,
        title: 'Mapa de Montagem',
        subtitle: 'Guia visual da grade',
      });
    }
    activeTiles.forEach((tile, idx) => {
      list.push({
        kind: 'tile',
        pageNumber: p++,
        sheetIndex: idx + 1,
        totalSheets: activeTiles.length,
        title: `Folha ${idx + 1} (${tile.pageLabel})`,
        subtitle:
          settings.overlapMm > 0
            ? `Sobreposição ${settings.overlapMm} mm`
            : 'Sem sobreposição',
        tile,
      });
    });
    return list;
  }, [activeTiles, settings.includeAssemblyMap, settings.overlapMm]);

  useEffect(() => {
    if (selectedPageIdx >= pages.length) {
      setSelectedPageIdx(0);
    }
  }, [pages.length, selectedPageIdx]);

  useEffect(() => {
    if (!isOpen || viewMode !== 'single' || !singleCanvasRef.current || !processedCanvas || !layout) {
      return;
    }
    const page = pages[selectedPageIdx];
    if (!page) return;
    if (page.kind === 'assembly') {
      renderAssemblyMapToCanvas(
        singleCanvasRef.current,
        processedCanvas,
        layout,
        settings,
        activeTiles,
        3.1
      );
    } else {
      renderTileToCanvas(
        singleCanvasRef.current,
        processedCanvas,
        layout,
        settings,
        page.tile,
        page.sheetIndex,
        page.totalSheets,
        3.1
      );
    }
  }, [isOpen, viewMode, selectedPageIdx, pages, processedCanvas, layout, settings, activeTiles]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (viewMode === 'single') {
        if (e.key === 'ArrowRight') {
          setSelectedPageIdx((i) => Math.min(pages.length - 1, i + 1));
        } else if (e.key === 'ArrowLeft') {
          setSelectedPageIdx((i) => Math.max(0, i - 1));
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose, viewMode, pages.length]);

  if (!isOpen || !layout || !processedCanvas) return null;

  const activePage = pages[selectedPageIdx] || pages[0];
  const paperSpec = getPaperSpecLabel(settings);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Modo de visualização do PDF antes de baixar"
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-5xl w-full h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 bg-white">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-lg bg-blue-50 text-[#2563EB] flex items-center justify-center shrink-0">
              <FileText className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-display text-base font-bold text-slate-900 truncate">
                Pré-visualização do PDF ({pages.length}{' '}
                {pages.length === 1 ? 'página' : 'páginas'})
              </h2>
              <p className="text-xs text-slate-500 tabular-nums truncate">
                {paperSpec.fullLabel} ·{' '}
                {layout.resolvedOrientation === 'portrait' ? 'Retrato' : 'Paisagem'} · Arte{' '}
                {(layout.imgWMm / 10).toFixed(1)} × {(layout.imgHMm / 10).toFixed(1)} cm
                {skippedCount > 0
                  ? ` · ${skippedCount} folha(s) em branco pulada(s)`
                  : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setViewMode('grid')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'grid'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-3.5 h-3.5" />
                Todas as páginas
              </button>
              <button
                type="button"
                onClick={() => setViewMode('single')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  viewMode === 'single'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Maximize2 className="w-3.5 h-3.5" />
                Página ampliada
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Fechar pré-visualização"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-auto drafting-grid p-5 sm:p-6">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {pages.map((page, idx) => (
                <PageThumbnail
                  key={`${page.kind}-${page.pageNumber}`}
                  page={page}
                  processedCanvas={processedCanvas}
                  layout={layout}
                  settings={settings}
                  activeTiles={activeTiles}
                  isSelected={idx === selectedPageIdx}
                  onClick={() => {
                    setSelectedPageIdx(idx);
                    setViewMode('single');
                  }}
                />
              ))}
            </div>
          ) : (
            <div className="h-full flex flex-col items-center justify-center gap-4">
              <div className="bg-white shadow-lg border border-slate-300 inline-block">
                <canvas
                  ref={singleCanvasRef}
                  className="max-h-[62vh] w-auto h-auto block"
                />
              </div>

              {activePage && (
                <div className="flex items-center gap-3 bg-white border border-slate-200 rounded-lg px-3 py-1.5 shadow-2xs">
                  <button
                    type="button"
                    disabled={selectedPageIdx === 0}
                    onClick={() => setSelectedPageIdx((i) => Math.max(0, i - 1))}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    <ChevronLeft className="w-3.5 h-3.5" />
                    Anterior
                  </button>
                  <span className="text-xs font-mono tabular-nums font-semibold text-slate-800">
                    Página {selectedPageIdx + 1} de {pages.length} — {activePage.title}
                  </span>
                  <button
                    type="button"
                    disabled={selectedPageIdx >= pages.length - 1}
                    onClick={() =>
                      setSelectedPageIdx((i) => Math.min(pages.length - 1, i + 1))
                    }
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                  >
                    Próxima
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-3.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-3">
          <span className="text-xs text-slate-600">
            Confira as marcas de corte, sobreposição e numeração antes de gerar o arquivo final.
          </span>

          <div className="flex items-center gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              Voltar e Ajustar
            </button>
            <button
              type="button"
              disabled={isExporting}
              onClick={() => {
                onConfirmDownload();
              }}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-[#E85D04] hover:bg-[#D44E00] disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-3.5 h-3.5" />
              <span>
                {isExporting ? 'Gerando PDF...' : 'Confirmar e Baixar PDF'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
