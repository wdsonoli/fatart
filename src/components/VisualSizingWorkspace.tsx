import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Download,
  Eye,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  Scan,
  Search,
  Upload,
} from 'lucide-react';
import {
  PosterLayout,
  PosterSettings,
  SampleArtwork,
} from '../types/poster';
import { getPaperSpecLabel } from '../utils/posterMath';
import { ArtworkPreview } from './ArtworkPreview';
import { PdfPreviewModal } from './PdfPreviewModal';
import { RealSizeModal } from './RealSizeModal';

interface VisualSizingWorkspaceProps {
  samples: SampleArtwork[];
  activeImageSrc: string;
  activeImageName: string;
  hasActiveFilters: boolean;
  processedCanvas: HTMLCanvasElement | null;
  layout: PosterLayout | null;
  settings: PosterSettings;
  isLoadingImage: boolean;
  isExporting: boolean;
  exportSuccessMsg: string | null;
  onUploadFile: (file: File) => void;
  onSelectSample: (sample: SampleArtwork) => void;
  onChangeSettings: (patch: Partial<PosterSettings>) => void;
  onDownloadPdf: () => void;
}

export const VisualSizingWorkspace: React.FC<VisualSizingWorkspaceProps> = ({
  samples,
  activeImageSrc,
  activeImageName,
  hasActiveFilters,
  processedCanvas,
  layout,
  settings,
  isLoadingImage,
  isExporting,
  exportSuccessMsg,
  onUploadFile,
  onSelectSample,
  onChangeSettings,
  onDownloadPdf,
}) => {
  const [widthInput, setWidthInput] = useState<string>(
    settings.targetWidthCm.toFixed(1).replace('.', ',')
  );
  const [manualAccordionOpen, setManualAccordionOpen] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isRealSizeOpen, setIsRealSizeOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  const posterBoxRef = useRef<HTMLDivElement | null>(null);

  // Sync displayed width input when layout changes externally
  useEffect(() => {
    if (layout) {
      setWidthInput((layout.totalGridWMm / 10).toFixed(1).replace('.', ','));
    }
  }, [layout?.totalGridWMm]);

  const isCustomUpload = useMemo(
    () => !samples.some((s) => s.title === activeImageName),
    [samples, activeImageName]
  );

  // Attach non-passive wheel listener to poster canvas so scroll wheel smoothly adjusts image scale
  useEffect(() => {
    const el = posterBoxRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      const currentScale = settings.manualPositioning ? settings.imageScale : 1;
      const nextScale = Math.max(
        0.2,
        Math.min(6.0, Math.round((currentScale + delta) * 100) / 100)
      );
      onChangeSettings({
        manualPositioning: true,
        imageScale: nextScale,
      });
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, [settings.manualPositioning, settings.imageScale, onChangeSettings]);

  const handleApplyWidth = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseFloat(widthInput.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) return;
    const clamped = Math.max(10, Math.min(600, parsed));
    const ratio = processedCanvas
      ? processedCanvas.width / Math.max(1, processedCanvas.height)
      : 1;
    onChangeSettings({
      sizingMode: 'physical',
      lockAspectRatio: true,
      targetWidthCm: Number(clamped.toFixed(1)),
      targetHeightCm: Number((clamped / ratio).toFixed(1)),
      manualPositioning: false,
      imageScale: 1,
      imageOffsetXMm: 0,
      imageOffsetYMm: 0,
    });
  };

  const handleStepCols = (delta: number) => {
    const baseCols = layout ? layout.cols : settings.cols;
    const baseRows = layout ? layout.rows : settings.rows;
    const nextCols = Math.max(1, Math.min(15, baseCols + delta));
    onChangeSettings({
      sizingMode: 'free_grid',
      cols: nextCols,
      rows: baseRows,
    });
  };

  const handleStepRows = (delta: number) => {
    const baseCols = layout ? layout.cols : settings.cols;
    const baseRows = layout ? layout.rows : settings.rows;
    const nextRows = Math.max(1, Math.min(15, baseRows + delta));
    onChangeSettings({
      sizingMode: 'free_grid',
      cols: baseCols,
      rows: nextRows,
    });
  };

  const handleScaleChange = (nextScale: number) => {
    const clamped = Math.max(0.2, Math.min(6.0, Number(nextScale.toFixed(2))));
    onChangeSettings({
      manualPositioning: true,
      imageScale: clamped,
    });
  };

  const handleOffsetXChange = (nextXMm: number) => {
    onChangeSettings({
      manualPositioning: true,
      imageOffsetXMm: Math.round(nextXMm),
    });
  };

  const handleOffsetYChange = (nextYMm: number) => {
    onChangeSettings({
      manualPositioning: true,
      imageOffsetYMm: Math.round(nextYMm),
    });
  };

  const handleAutoFit = () => {
    if (!layout || !processedCanvas) return;
    // Compute cover scale so the image fills the entire grid nicely without leaving empty margins
    const gridAspect = layout.totalGridWMm / Math.max(1, layout.totalGridHMm);
    const imgAspect = processedCanvas.width / Math.max(1, processedCanvas.height);
    const fillScale =
      imgAspect > gridAspect
        ? gridAspect / imgAspect < 1
          ? imgAspect / gridAspect
          : 1
        : gridAspect / imgAspect;

    onChangeSettings({
      manualPositioning: true,
      imageScale: Math.max(1, Math.min(6, Number(fillScale.toFixed(2)))),
      imageOffsetXMm: 0,
      imageOffsetYMm: 0,
    });
  };

  const handleResetImageAdjust = () => {
    onChangeSettings({
      manualPositioning: false,
      imageScale: 1,
      imageOffsetXMm: 0,
      imageOffsetYMm: 0,
    });
  };

  // Drag artwork directly on canvas to adjust Pos X & Pos Y
  const handlePosterPointerDown = (e: React.PointerEvent) => {
    if (!layout || !posterBoxRef.current) return;
    e.preventDefault();
    const rect = posterBoxRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = settings.manualPositioning ? settings.imageOffsetXMm : 0;
    const origY = settings.manualPositioning ? settings.imageOffsetYMm : 0;
    const mmPerPxX = layout.totalGridWMm / Math.max(1, rect.width);
    const mmPerPxY = layout.totalGridHMm / Math.max(1, rect.height);

    const onMove = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) * mmPerPxX;
      const dyMm = (ev.clientY - startY) * mmPerPxY;
      onChangeSettings({
        manualPositioning: true,
        imageOffsetXMm: Math.round(origX + dxMm),
        imageOffsetYMm: Math.round(origY + dyMm),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadFile(file);
    }
  };

  const posterWCm = layout ? layout.totalGridWMm / 10 : settings.targetWidthCm;
  const posterHCm = layout ? layout.totalGridHMm / 10 : settings.targetHeightCm;
  const maxOffsetXMm = Math.max(150, Math.round((layout?.totalGridWMm || 400) * 0.75));
  const maxOffsetYMm = Math.max(150, Math.round((layout?.totalGridHMm || 500) * 0.75));
  const activeScalePct = Math.round((settings.manualPositioning ? settings.imageScale : 1) * 100);
  const activePosX = settings.manualPositioning ? settings.imageOffsetXMm : 0;
  const activePosY = settings.manualPositioning ? settings.imageOffsetYMm : 0;

  const isPortrait =
    settings.orientation === 'portrait' ||
    (settings.orientation === 'auto' && layout?.resolvedOrientation === 'portrait');

  // Tick marks for horizontal and vertical physical rulers
  const horizTickCount = Math.max(8, Math.min(40, Math.round(posterWCm / 2)));
  const vertTickCount = Math.max(8, Math.min(44, Math.round(posterHCm / 2)));

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[336px_1fr] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={() => setIsDraggingFile(false)}
      onDrop={handleDrop}
    >
      {/* Left Precision Control Sidebar */}
      <aside className="p-5 border-b lg:border-b-0 lg:border-r border-slate-200 bg-white flex flex-col justify-between gap-5">
        <div className="space-y-5">
          {/* Block 1: Qual tamanho quer? */}
          <form onSubmit={handleApplyWidth} className="space-y-3">
            <div>
              <h2 className="font-display text-xs font-extrabold tracking-wide text-[#E11D74] uppercase">
                Qual tamanho quer?
              </h2>
              <label
                htmlFor="quick-width-cm"
                className="block text-[11px] font-semibold text-slate-500 mt-2 mb-1.5 uppercase tracking-wide"
              >
                Largura (cm)
              </label>
              <div className="flex items-center gap-2">
                <input
                  id="quick-width-cm"
                  type="text"
                  inputMode="decimal"
                  value={widthInput}
                  onChange={(e) => setWidthInput(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-100 border border-slate-200 focus:bg-white focus:border-[#E11D74] rounded-lg px-3 py-2 text-sm font-mono font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E11D74]/20"
                />
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold tracking-wide text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                >
                  Aplicar
                </button>
              </div>
              <div className="text-center text-[11px] font-medium tracking-wider text-slate-400 mt-2 uppercase">
                {settings.sizingMode === 'physical' ? 'Modo Automático' : 'Modo Manual'}
              </div>
            </div>

            {/* Real Poster Size Card */}
            <div className="bg-pink-50/45 border border-pink-100 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#E11D74] uppercase">
                <Scan className="w-3.5 h-3.5" />
                <span>Tamanho real do pôster</span>
              </div>
              <div className="mt-1.5 flex items-baseline gap-1.5 font-display text-2xl font-extrabold text-slate-900 tabular-nums">
                <span>{posterWCm.toFixed(1)}</span>
                <span className="text-sm font-semibold text-slate-400">×</span>
                <span>{posterHCm.toFixed(1)}</span>
                <span className="text-xs font-semibold text-slate-500 ml-0.5">cm</span>
              </div>
              {layout && (
                <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {layout.cols} × {layout.rows} folhas {getPaperSpecLabel(settings).shortLabel} ·{' '}
                  {layout.estimatedDpi} DPI
                </div>
              )}
            </div>
          </form>

          {/* Block 2: Ajuste Manual */}
          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setManualAccordionOpen((v) => !v)}
              className="w-full px-4 py-3 flex items-center justify-between bg-white hover:bg-slate-50 transition-colors cursor-pointer"
            >
              <span className="font-display text-xs font-extrabold tracking-wide text-slate-900 uppercase">
                Ajuste Manual
              </span>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  manualAccordionOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {manualAccordionOpen && (
              <div className="px-4 pb-4 pt-2 border-t border-slate-100 space-y-4">
                {/* Quantas folhas? */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold tracking-wide text-[#E11D74] uppercase">
                    Quantas folhas?
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase">
                        Colunas
                      </span>
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => handleStepCols(-1)}
                          aria-label="Diminuir colunas"
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                          {layout ? layout.cols : settings.cols}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepCols(1)}
                          aria-label="Aumentar colunas"
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <div>
                      <span className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase">
                        Linhas
                      </span>
                      <div className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-lg p-1">
                        <button
                          type="button"
                          onClick={() => handleStepRows(-1)}
                          aria-label="Diminuir linhas"
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <span className="font-mono text-sm font-bold tabular-nums text-slate-900">
                          {layout ? layout.rows : settings.rows}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleStepRows(1)}
                          aria-label="Aumentar linhas"
                          className="w-7 h-7 flex items-center justify-center rounded-md bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Retrato / Paisagem toggle */}
                  <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                    <button
                      type="button"
                      onClick={() => onChangeSettings({ orientation: 'portrait' })}
                      className={`py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        isPortrait
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Retrato
                    </button>
                    <button
                      type="button"
                      onClick={() => onChangeSettings({ orientation: 'landscape' })}
                      className={`py-1.5 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                        !isPortrait
                          ? 'bg-white text-slate-900 shadow-2xs'
                          : 'text-slate-500 hover:text-slate-900'
                      }`}
                    >
                      Paisagem
                    </button>
                  </div>
                </div>

                <hr className="border-slate-100" />

                {/* Ajuste de imagem */}
                <div className="space-y-3.5">
                  <div className="text-[11px] font-bold tracking-wide text-[#E11D74] uppercase">
                    Ajuste de imagem
                  </div>

                  {/* Escala */}
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-500 uppercase">
                        <Search className="w-3.5 h-3.5 text-slate-400" />
                        Escala
                      </span>
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() =>
                            handleScaleChange(
                              (settings.manualPositioning ? settings.imageScale : 1) - 0.1
                            )
                          }
                          aria-label="Reduzir escala"
                          className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="font-mono text-xs font-bold tabular-nums text-[#E11D74] min-w-[44px] text-center">
                          {activeScalePct}%
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            handleScaleChange(
                              (settings.manualPositioning ? settings.imageScale : 1) + 0.1
                            )
                          }
                          aria-label="Aumentar escala"
                          className="w-6 h-6 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={20}
                      max={600}
                      step={1}
                      value={activeScalePct}
                      onChange={(e) => handleScaleChange(Number(e.target.value) / 100)}
                      className="w-full accent-[#E11D74]"
                    />
                  </div>

                  {/* Pos X & Pos Y */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">
                          Pos X
                        </span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOffsetXChange(activePosX - 10)}
                            aria-label="Mover para esquerda"
                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOffsetXChange(activePosX + 10)}
                            aria-label="Mover para direita"
                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={-maxOffsetXMm}
                        max={maxOffsetXMm}
                        step={1}
                        value={Math.max(-maxOffsetXMm, Math.min(maxOffsetXMm, activePosX))}
                        onChange={(e) => handleOffsetXChange(Number(e.target.value))}
                        className="w-full accent-slate-800"
                      />
                    </div>

                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[11px] font-semibold text-slate-500 uppercase">
                          Pos Y
                        </span>
                        <div className="inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleOffsetYChange(activePosY - 10)}
                            aria-label="Mover para cima"
                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Minus className="w-2.5 h-2.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleOffsetYChange(activePosY + 10)}
                            aria-label="Mover para baixo"
                            className="w-5 h-5 flex items-center justify-center rounded bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                          >
                            <Plus className="w-2.5 h-2.5" />
                          </button>
                        </div>
                      </div>
                      <input
                        type="range"
                        min={-maxOffsetYMm}
                        max={maxOffsetYMm}
                        step={1}
                        value={Math.max(-maxOffsetYMm, Math.min(maxOffsetYMm, activePosY))}
                        onChange={(e) => handleOffsetYChange(Number(e.target.value))}
                        className="w-full accent-slate-800"
                      />
                    </div>
                  </div>

                  {/* Auto Ajuste & Resetar */}
                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleAutoFit}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-[#BE185D] bg-pink-50 hover:bg-pink-100 border border-pink-200/80 rounded-lg transition-colors cursor-pointer"
                    >
                      <Maximize2 className="w-3.5 h-3.5" />
                      <span>Auto Ajuste</span>
                    </button>
                    <button
                      type="button"
                      onClick={handleResetImageAdjust}
                      className="inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Resetar</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bottom Export Buttons */}
        <div className="space-y-2 pt-3 border-t border-slate-200">
          <button
            type="button"
            disabled={!layout || !processedCanvas}
            onClick={() => setIsPdfPreviewOpen(true)}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 rounded-lg transition-colors cursor-pointer"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Visualizar PDF antes de baixar</span>
          </button>

          <button
            type="button"
            disabled={!layout || isExporting}
            onClick={onDownloadPdf}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-semibold text-white bg-[#E85D04] hover:bg-[#D44E00] disabled:bg-slate-300 rounded-lg transition-colors cursor-pointer shadow-xs"
          >
            <Download className="w-4 h-4" />
            <span>{isExporting ? 'Gerando PDF...' : 'Baixar PDF'}</span>
          </button>

          {exportSuccessMsg && (
            <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}
        </div>
      </aside>

      {/* Right Drafting Table with Physical Rulers */}
      <div className="flex flex-col min-h-[640px] relative">
        {/* Top Tip & Upload Bar */}
        <div className="px-4 py-2.5 border-b border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar Imagem</span>
              <input
                type="file"
                accept="image/*,.png,.jpg,.jpeg,.webp,.gif,.bmp,.svg"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadFile(file);
                  e.target.value = '';
                }}
              />
            </label>

            {isCustomUpload && activeImageName && (
              <span className="px-2.5 py-1 text-xs font-semibold text-slate-800 bg-pink-50 border border-pink-200 rounded-md max-w-[180px] truncate">
                {activeImageName}
              </span>
            )}

            <div className="flex items-center gap-1 flex-wrap">
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectSample(sample)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeImageName === sample.title
                      ? 'bg-slate-100 border-slate-300 text-slate-900'
                      : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          <p className="text-xs font-semibold text-[#E11D74]">
            Dica: Aumente e diminua a imagem usando o botão de rolar do mouse.
          </p>
        </div>

        {/* Main Drafting Canvas with Rulers */}
        <div className="flex-1 drafting-grid p-6 sm:p-10 flex flex-col items-center justify-center relative overflow-auto">
          {isDraggingFile && (
            <div className="absolute inset-3 z-20 rounded-xl border-2 border-dashed border-[#E11D74] bg-pink-50/80 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
              <Upload className="w-8 h-8 text-[#E11D74] mb-2" />
              <p className="font-display text-base font-bold text-slate-900">
                Solte sua imagem aqui
              </p>
            </div>
          )}

          {isLoadingImage ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-[#E11D74] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600">Carregando imagem...</p>
            </div>
          ) : !layout || !processedCanvas ? (
            <div className="text-center max-w-sm py-12">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <p className="text-sm font-semibold text-slate-800">
                Envie uma imagem para visualizar as réguas físicas
              </p>
            </div>
          ) : (
            <div className="flex flex-col items-center">
              {/* Top + Left Physical Rulers wrapping the Poster Surface */}
              <div className="grid grid-cols-[36px_auto] grid-rows-[36px_auto] gap-3 items-stretch">
                {/* Empty Top-Left Corner */}
                <div className="flex items-center justify-center text-slate-400">
                  <Ruler className="w-4 h-4" />
                </div>

                {/* Top Horizontal Ruler */}
                <div className="relative bg-white/95 border border-slate-200 rounded-md shadow-2xs h-9 flex items-end overflow-hidden">
                  <div className="w-full h-full flex items-end justify-between px-1">
                    {Array.from({ length: horizTickCount + 1 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`w-px ${
                          idx % 5 === 0
                            ? 'h-3.5 bg-slate-500'
                            : 'h-2 bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E11D74] text-white font-mono text-xs font-bold tabular-nums shadow-xs">
                      {posterWCm.toFixed(1)} cm
                    </span>
                  </div>
                </div>

                {/* Left Vertical Ruler */}
                <div className="relative bg-white/95 border border-slate-200 rounded-md shadow-2xs w-9 flex justify-end overflow-hidden">
                  <div className="h-full w-full flex flex-col items-end justify-between py-1">
                    {Array.from({ length: vertTickCount + 1 }).map((_, idx) => (
                      <div
                        key={idx}
                        className={`h-px ${
                          idx % 5 === 0
                            ? 'w-3.5 bg-slate-500'
                            : 'w-2 bg-slate-300'
                        }`}
                      />
                    ))}
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="-rotate-90 px-2.5 py-0.5 rounded-full bg-[#E11D74] text-white font-mono text-xs font-bold tabular-nums shadow-xs whitespace-nowrap">
                      {posterHCm.toFixed(1)} cm
                    </span>
                  </div>
                </div>

                {/* Interactive Poster Surface */}
                <div className="relative flex flex-col items-center">
                  <div
                    ref={posterBoxRef}
                    onPointerDown={handlePosterPointerDown}
                    className="relative bg-white shadow-xl border border-slate-200 overflow-hidden cursor-grab active:cursor-grabbing select-none"
                    style={{
                      aspectRatio: `${layout.totalGridWMm} / ${layout.totalGridHMm}`,
                      width:
                        layout.totalGridWMm >= layout.totalGridHMm
                          ? 'min(540px, 68vw)'
                          : `min(${Math.round(
                              470 * (layout.totalGridWMm / layout.totalGridHMm)
                            )}px, 66vw)`,
                    }}
                  >
                    {/* Artwork */}
                    <ArtworkPreview
                      processedCanvas={processedCanvas}
                      originalSrc={activeImageSrc}
                      useOriginalSrc={!hasActiveFilters}
                      alt={activeImageName}
                      className="absolute pointer-events-none select-none"
                      style={{
                        left: `${(layout.imgXMm / layout.totalGridWMm) * 100}%`,
                        top: `${(layout.imgYMm / layout.totalGridHMm) * 100}%`,
                        width: `${(layout.imgWMm / layout.totalGridWMm) * 100}%`,
                        height: `${(layout.imgHMm / layout.totalGridHMm) * 100}%`,
                      }}
                    />

                    {/* Subtle Sheet Division Grid */}
                    {layout.tiles.map((tile) => (
                      <div
                        key={tile.index}
                        className="absolute border border-slate-900/18 pointer-events-none"
                        style={{
                          left: `${(tile.gridXMm / layout.totalGridWMm) * 100}%`,
                          top: `${(tile.gridYMm / layout.totalGridHMm) * 100}%`,
                          width: `${(tile.printableWMm / layout.totalGridWMm) * 100}%`,
                          height: `${(tile.printableHMm / layout.totalGridHMm) * 100}%`,
                        }}
                      />
                    ))}

                    {/* Floating "Ver em tamanho real" Button anchored at bottom center */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-10">
                      <button
                        type="button"
                        onPointerDown={(e) => e.stopPropagation()}
                        onClick={() => setIsRealSizeOpen(true)}
                        className="inline-flex items-center gap-2 px-4 py-2 bg-white/95 hover:bg-white text-slate-900 border border-slate-200 rounded-full shadow-md text-xs font-extrabold tracking-wide uppercase transition-transform hover:scale-[1.02] cursor-pointer whitespace-nowrap"
                      >
                        <Maximize2 className="w-3.5 h-3.5 text-[#E11D74]" />
                        <span>Ver em tamanho real</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-slate-500 mt-5">
                Arraste a arte diretamente sobre as folhas para posicionar ou use a roda do mouse para dar zoom.
              </p>
            </div>
          )}
        </div>
      </div>

      <RealSizeModal
        isOpen={isRealSizeOpen}
        onClose={() => setIsRealSizeOpen(false)}
        processedCanvas={processedCanvas}
        originalSrc={activeImageSrc}
        useOriginalSrc={!hasActiveFilters}
        activeImageName={activeImageName}
        layout={layout}
        settings={settings}
      />

      <PdfPreviewModal
        isOpen={isPdfPreviewOpen}
        onClose={() => setIsPdfPreviewOpen(false)}
        onConfirmDownload={() => {
          setIsPdfPreviewOpen(false);
          onDownloadPdf();
        }}
        isExporting={isExporting}
        processedCanvas={processedCanvas}
        layout={layout}
        settings={settings}
      />
    </div>
  );
};
