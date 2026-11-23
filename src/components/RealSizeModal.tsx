import React, { useEffect, useState } from 'react';
import { Maximize2, Monitor, Ruler, User, X } from 'lucide-react';
import { PosterLayout, PosterSettings } from '../types/poster';
import { getPaperSpecLabel } from '../utils/posterMath';
import { ArtworkPreview } from './ArtworkPreview';

interface RealSizeModalProps {
  isOpen: boolean;
  onClose: () => void;
  processedCanvas: HTMLCanvasElement | null;
  originalSrc?: string | null;
  useOriginalSrc?: boolean;
  activeImageName: string;
  layout: PosterLayout | null;
  settings: PosterSettings;
}

type ReferenceObject = 'person' | 'a4' | 'desk';

export const RealSizeModal: React.FC<RealSizeModalProps> = ({
  isOpen,
  onClose,
  processedCanvas,
  originalSrc,
  useOriginalSrc = false,
  activeImageName,
  layout,
  settings,
}) => {
  const [tab, setTab] = useState<'wall' | 'screen'>('wall');
  const [reference, setReference] = useState<ReferenceObject>('person');
  // Standard CSS reference is ~37.8 px per cm at 96 DPI; user can fine-tune with a bank card (8.56 cm)
  const [pxPerCm, setPxPerCm] = useState<number>(37.8);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  if (!isOpen || !layout || !processedCanvas) return null;

  const posterWCm = layout.totalGridWMm / 10;
  const posterHCm = layout.totalGridHMm / 10;
  const artWCm = layout.imgWMm / 10;
  const artHCm = layout.imgHMm / 10;
  const paperSpec = getPaperSpecLabel(settings);

  // Wall comparison scaling: fit poster + reference inside a 340px tall stage
  const refHeightCm = reference === 'person' ? 170 : reference === 'desk' ? 75 : 29.7;
  const refWidthCm = reference === 'person' ? 52 : reference === 'desk' ? 120 : 21.0;
  const maxHeightCm = Math.max(posterHCm, refHeightCm, 35);
  const stagePxPerCm = Math.min(
    330 / maxHeightCm,
    460 / Math.max(posterWCm + refWidthCm + 20, 60)
  );

  const posterWallW = Math.max(24, posterWCm * stagePxPerCm);
  const posterWallH = Math.max(24, posterHCm * stagePxPerCm);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/65 backdrop-blur-xs p-3 sm:p-6"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Visualização em tamanho real"
    >
      <div
        className="bg-white border border-slate-200 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-pink-50 text-[#E11D74] flex items-center justify-center shrink-0">
              <Maximize2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-slate-900">
                Ver em Tamanho Real
              </h2>
              <p className="text-xs text-slate-500 tabular-nums">
                Pôster: {posterWCm.toFixed(1)} × {posterHCm.toFixed(1)} cm · Arte:{' '}
                {artWCm.toFixed(1)} × {artHCm.toFixed(1)} cm · {layout.cols}×{layout.rows}{' '}
                {paperSpec.shortLabel}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex p-0.5 bg-slate-100 rounded-lg">
              <button
                type="button"
                onClick={() => setTab('wall')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  tab === 'wall'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-3.5 h-3.5" />
                Comparar na Parede
              </button>
              <button
                type="button"
                onClick={() => setTab('screen')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                  tab === 'screen'
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Escala 1:1 na Tela
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
              aria-label="Fechar visualização em tamanho real"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Body */}
        {tab === 'wall' ? (
          <div className="flex-1 overflow-auto p-6 flex flex-col gap-5 bg-[#F8FAFC]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-medium text-slate-600">
                Objeto de referência para comparar a proporção física:
              </span>
              <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg p-1">
                {(
                  [
                    ['person', 'Pessoa (1,70 m)'],
                    ['a4', 'Folha A4 (21×29,7 cm)'],
                    ['desk', 'Mesa (1,20 m)'],
                  ] as [ReferenceObject, string][]
                ).map(([id, label]) => (
                  <button
                    key={id}
                    type="button"
                    onClick={() => setReference(id)}
                    className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      reference === id
                        ? 'bg-[#0F172A] text-white'
                        : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Wall comparison scene */}
            <div className="flex-1 min-h-[390px] bg-white border border-slate-200 rounded-xl drafting-grid p-8 flex items-end justify-center gap-10 relative overflow-hidden">
              {/* Reference object */}
              <div className="flex flex-col items-center shrink-0">
                {reference === 'person' && (
                  <div
                    className="flex flex-col items-center justify-end"
                    style={{ height: `${170 * stagePxPerCm}px` }}
                  >
                    <svg
                      viewBox="0 0 80 220"
                      className="h-full w-auto text-slate-300"
                      fill="currentColor"
                      aria-hidden="true"
                    >
                      <circle cx="40" cy="24" r="16" />
                      <path d="M18 52c0-7 6-12 14-12h16c8 0 14 5 14 12l6 56c1 5-3 9-8 9h-4l-4 94c0 5-4 9-9 9h-6c-5 0-9-4-9-9l-4-94h-4c-5 0-9-4-8-9l6-56z" />
                    </svg>
                  </div>
                )}

                {reference === 'a4' && (
                  <div
                    className="bg-white border-2 border-slate-400 shadow-sm flex items-center justify-center text-[10px] font-mono text-slate-500"
                    style={{
                      width: `${21 * stagePxPerCm}px`,
                      height: `${29.7 * stagePxPerCm}px`,
                    }}
                  >
                    A4
                  </div>
                )}

                {reference === 'desk' && (
                  <div
                    className="flex flex-col justify-between border-t-4 border-slate-400 bg-slate-200/40 relative"
                    style={{
                      width: `${120 * stagePxPerCm}px`,
                      height: `${75 * stagePxPerCm}px`,
                    }}
                  >
                    <div className="flex justify-between h-full px-2">
                      <div className="w-1.5 bg-slate-400 h-full" />
                      <div className="w-1.5 bg-slate-400 h-full" />
                    </div>
                  </div>
                )}

                <span className="mt-2.5 text-xs font-medium text-slate-500 tabular-nums">
                  {reference === 'person'
                    ? '1,70 m'
                    : reference === 'a4'
                    ? 'A4 (21 × 29,7 cm)'
                    : 'Mesa (120 × 75 cm)'}
                </span>
              </div>

              {/* Scaled Poster */}
              <div className="flex flex-col items-center shrink-0">
                <div className="mb-2 px-2 py-0.5 rounded-full bg-[#E11D74] text-white text-[11px] font-mono tabular-nums font-bold shadow-xs">
                  {posterWCm.toFixed(1)} cm
                </div>

                <div className="flex items-center gap-2">
                  <div
                    className="relative bg-white shadow-lg border border-slate-300 overflow-hidden"
                    style={{
                      width: `${posterWallW}px`,
                      height: `${posterWallH}px`,
                    }}
                  >
                    <ArtworkPreview
                      processedCanvas={processedCanvas}
                      originalSrc={originalSrc}
                      useOriginalSrc={useOriginalSrc}
                      alt={activeImageName}
                      className="absolute pointer-events-none"
                      style={{
                        left: `${(layout.imgXMm / layout.totalGridWMm) * 100}%`,
                        top: `${(layout.imgYMm / layout.totalGridHMm) * 100}%`,
                        width: `${(layout.imgWMm / layout.totalGridWMm) * 100}%`,
                        height: `${(layout.imgHMm / layout.totalGridHMm) * 100}%`,
                      }}
                    />
                    {layout.tiles.map((tile) => (
                      <div
                        key={tile.index}
                        className="absolute border border-slate-900/20 pointer-events-none"
                        style={{
                          left: `${(tile.gridXMm / layout.totalGridWMm) * 100}%`,
                          top: `${(tile.gridYMm / layout.totalGridHMm) * 100}%`,
                          width: `${(tile.printableWMm / layout.totalGridWMm) * 100}%`,
                          height: `${(tile.printableHMm / layout.totalGridHMm) * 100}%`,
                        }}
                      />
                    ))}
                  </div>

                  <div className="px-2 py-0.5 rounded-full bg-[#E11D74] text-white text-[11px] font-mono tabular-nums font-bold shadow-xs">
                    {posterHCm.toFixed(1)} cm
                  </div>
                </div>

                <span className="mt-2.5 text-xs font-semibold text-slate-800 tabular-nums">
                  Seu pôster ({layout.cols}×{layout.rows} folhas {paperSpec.shortLabel})
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden bg-[#F8FAFC]">
            {/* 1:1 Screen Calibrator Bar */}
            <div className="px-5 py-3 bg-white border-b border-slate-200 flex flex-wrap items-center justify-between gap-4 text-xs">
              <div className="flex items-center gap-3">
                <Ruler className="w-4 h-4 text-[#E11D74] shrink-0" />
                <span className="text-slate-600">
                  Calibre segurando um cartão padrão (8,56 cm) ou régua sobre a barra rosa:
                </span>
                <div
                  className="h-5 bg-[#E11D74]/15 border-x-2 border-b-2 border-[#E11D74] flex items-center justify-center font-mono text-[10px] font-bold text-[#E11D74] shrink-0"
                  style={{ width: `${Math.round(8.56 * pxPerCm)}px` }}
                >
                  8,56 cm
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-slate-500">Escala tela:</span>
                <input
                  type="range"
                  min={24}
                  max={60}
                  step={0.5}
                  value={pxPerCm}
                  onChange={(e) => setPxPerCm(Number(e.target.value))}
                  className="w-28 accent-[#E11D74]"
                />
                <span className="font-mono tabular-nums text-slate-700 w-14 text-right">
                  {Math.round(pxPerCm * 2.54)} PPI
                </span>
              </div>
            </div>

            {/* Scrollable 1:1 viewport */}
            <div className="flex-1 overflow-auto drafting-grid p-8">
              <div
                className="relative bg-white shadow-xl border border-slate-300 overflow-hidden mx-auto"
                style={{
                  width: `${Math.round(posterWCm * pxPerCm)}px`,
                  height: `${Math.round(posterHCm * pxPerCm)}px`,
                }}
              >
                <ArtworkPreview
                  processedCanvas={processedCanvas}
                  originalSrc={originalSrc}
                  useOriginalSrc={useOriginalSrc}
                  alt={activeImageName}
                  className="absolute pointer-events-none"
                  style={{
                    left: `${(layout.imgXMm / layout.totalGridWMm) * 100}%`,
                    top: `${(layout.imgYMm / layout.totalGridHMm) * 100}%`,
                    width: `${(layout.imgWMm / layout.totalGridWMm) * 100}%`,
                    height: `${(layout.imgHMm / layout.totalGridHMm) * 100}%`,
                  }}
                />
                {layout.tiles.map((tile) => (
                  <div
                    key={tile.index}
                    className="absolute border border-dashed border-slate-500/40 pointer-events-none"
                    style={{
                      left: `${(tile.gridXMm / layout.totalGridWMm) * 100}%`,
                      top: `${(tile.gridYMm / layout.totalGridHMm) * 100}%`,
                      width: `${(tile.printableWMm / layout.totalGridWMm) * 100}%`,
                      height: `${(tile.printableHMm / layout.totalGridHMm) * 100}%`,
                    }}
                  >
                    <span className="inline-block m-2 px-1.5 py-0.5 rounded bg-white/85 text-slate-700 font-mono text-[11px] font-semibold border border-slate-200">
                      Folha {tile.index} ({tile.pageLabel})
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
