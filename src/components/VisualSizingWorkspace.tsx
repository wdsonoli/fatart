import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronDown,
  Circle,
  Download,
  Eye,
  Lock,
  Maximize2,
  Minus,
  Plus,
  RotateCcw,
  Ruler,
  Scan,
  Search,
  Square,
  Unlock,
  Upload,
  X,
} from 'lucide-react';
import {
  PosterLayout,
  PosterSettings,
  SampleArtwork,
} from '../types/poster';
import { getPaperSpecLabel } from '../utils/posterMath';
import { ArtworkPreview } from './ArtworkPreview';
import {
  InteractiveRulerOverlay,
  RulerCoords,
  RulerShape,
} from './InteractiveRulerOverlay';
import { PdfPreviewModal } from './PdfPreviewModal';
import { RealSizeModal } from './RealSizeModal';

interface MetricTick {
  cm: number;
  pct: number;
  kind: 'major' | 'mid' | 'minor';
}

function buildMetricTicks(totalCm: number): MetricTick[] {
  const safeTotal = Math.max(1, totalCm);
  let minorStep = 1;
  let midStep = 5;
  let majorStep = 10;

  if (safeTotal > 180) {
    minorStep = 5;
    midStep = 25;
    majorStep = 50;
  } else if (safeTotal > 75) {
    minorStep = 2;
    midStep = 10;
    majorStep = 20;
  }

  const ticks: MetricTick[] = [];
  for (let cm = 0; cm <= safeTotal + 0.001; cm += minorStep) {
    const clampedCm = Math.min(cm, safeTotal);
    const pct = (clampedCm / safeTotal) * 100;
    const kind: MetricTick['kind'] =
      cm % majorStep === 0 ? 'major' : cm % midStep === 0 ? 'mid' : 'minor';
    ticks.push({ cm, pct, kind });
  }
  return ticks;
}

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
  const [heightInput, setHeightInput] = useState<string>(
    settings.targetHeightCm.toFixed(1).replace('.', ',')
  );
  const [roundDiameterInput, setRoundDiameterInput] = useState<string>(
    settings.roundDiameterCm.toFixed(0)
  );
  const [manualAccordionOpen, setManualAccordionOpen] = useState(true);
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [isRealSizeOpen, setIsRealSizeOpen] = useState(false);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);

  // Interactive measurement ruler state (line / square)
  const [rulerEnabled, setRulerEnabled] = useState(false);
  const [rulerShape, setRulerShape] = useState<RulerShape>('line');
  const [lineCoords, setLineCoords] = useState<RulerCoords>({
    x1: 8,
    y1: 42,
    x2: 92,
    y2: 42,
  });
  const [rectCoords, setRectCoords] = useState<RulerCoords>({
    x1: 18,
    y1: 22,
    x2: 82,
    y2: 68,
  });

  const posterBoxRef = useRef<HTMLDivElement | null>(null);

  // Sync displayed width/height inputs when layout or round diameter changes externally
  useEffect(() => {
    if (layout) {
      setWidthInput((layout.imgWMm / 10).toFixed(1).replace('.', ','));
      setHeightInput((layout.imgHMm / 10).toFixed(1).replace('.', ','));
    }
  }, [layout?.imgWMm, layout?.imgHMm]);

  useEffect(() => {
    setRoundDiameterInput(
      Number.isInteger(settings.roundDiameterCm)
        ? String(settings.roundDiameterCm)
        : settings.roundDiameterCm.toFixed(1).replace('.', ',')
    );
  }, [settings.roundDiameterCm]);

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

  const imageRatio = processedCanvas
    ? processedCanvas.width / Math.max(1, processedCanvas.height)
    : 1;

  const handleWidthInputChange = (val: string) => {
    setWidthInput(val);
    if (settings.lockAspectRatio) {
      const parsed = parseFloat(val.replace(',', '.'));
      if (!Number.isNaN(parsed) && parsed > 0) {
        setHeightInput((parsed / imageRatio).toFixed(1).replace('.', ','));
      }
    }
  };

  const handleHeightInputChange = (val: string) => {
    setHeightInput(val);
    if (settings.lockAspectRatio) {
      const parsed = parseFloat(val.replace(',', '.'));
      if (!Number.isNaN(parsed) && parsed > 0) {
        setWidthInput((parsed * imageRatio).toFixed(1).replace('.', ','));
      }
    }
  };

  const handleApplyRectSize = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsedW = parseFloat(widthInput.replace(',', '.'));
    const parsedH = parseFloat(heightInput.replace(',', '.'));
    if (
      (Number.isNaN(parsedW) || parsedW <= 0) &&
      (Number.isNaN(parsedH) || parsedH <= 0)
    ) {
      return;
    }

    let nextW = !Number.isNaN(parsedW) && parsedW > 0 ? parsedW : parsedH * imageRatio;
    let nextH = !Number.isNaN(parsedH) && parsedH > 0 ? parsedH : parsedW / imageRatio;

    if (settings.lockAspectRatio) {
      // Derive cleanly from width if both edited, respecting bounds
      nextW = Math.max(10, Math.min(600, nextW));
      nextH = Math.max(10, Math.min(600, nextW / imageRatio));
    } else {
      nextW = Math.max(10, Math.min(600, nextW));
      nextH = Math.max(10, Math.min(600, nextH));
    }

    onChangeSettings({
      panelShape: 'rect',
      sizingMode: 'physical',
      targetWidthCm: Number(nextW.toFixed(1)),
      targetHeightCm: Number(nextH.toFixed(1)),
      manualPositioning: false,
      imageScale: 1,
      imageOffsetXMm: 0,
      imageOffsetYMm: 0,
    });
  };

  const handleApplyRoundDiameter = (diameterCm: number) => {
    if (Number.isNaN(diameterCm) || diameterCm <= 0) return;
    const clamped = Math.max(10, Math.min(300, Number(diameterCm.toFixed(1))));
    onChangeSettings({
      panelShape: 'round',
      sizingMode: 'physical',
      roundDiameterCm: clamped,
      targetWidthCm: clamped,
      targetHeightCm: clamped,
      manualPositioning: false,
      imageScale: 1,
      imageOffsetXMm: 0,
      imageOffsetYMm: 0,
    });
  };

  const handleSubmitRoundDiameter = (e?: React.FormEvent) => {
    e?.preventDefault();
    const parsed = parseFloat(roundDiameterInput.replace(',', '.'));
    if (Number.isNaN(parsed) || parsed <= 0) return;
    handleApplyRoundDiameter(parsed);
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
    if (settings.panelShape === 'round') {
      // Round mode already cover-fits the image to the exact circle diameter at scale = 1
      onChangeSettings({
        manualPositioning: true,
        imageScale: 1,
        imageOffsetXMm: 0,
        imageOffsetYMm: 0,
      });
      return;
    }
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
    if (rulerEnabled || !layout || !posterBoxRef.current) return;
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
      window.removeEventListener('pointercancel', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    window.addEventListener('pointercancel', onUp);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (
      file &&
      (file.type.startsWith('image/') ||
        /\.(png|jpe?g|webp|gif|bmp|svg)$/i.test(file.name))
    ) {
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

  // Exact metric ticks (real cm positions flush with poster edges)
  const horizTicks = useMemo(() => buildMetricTicks(posterWCm), [posterWCm]);
  const vertTicks = useMemo(() => buildMetricTicks(posterHCm), [posterHCm]);

  const isRoundPanel =
    settings.panelShape === 'round' &&
    layout?.circleCenterXMm !== undefined &&
    layout?.circleCenterYMm !== undefined &&
    layout?.circleRadiusMm !== undefined;

  const roundDiameterActualCm =
    isRoundPanel && layout?.circleRadiusMm
      ? (layout.circleRadiusMm * 2) / 10
      : settings.roundDiameterCm;

  const ROUND_PANEL_PRESETS = [
    { cm: 30, tag: 'Mini / Topo' },
    { cm: 50, tag: 'Mesa / Bolo' },
    { cm: 80, tag: 'Painel Médio' },
    { cm: 100, tag: 'Painel 1m' },
  ];

  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-[348px_1fr] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs"
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
          {/* Block 1: Formato + Qual tamanho quer? */}
          <div className="space-y-3.5">
            <div>
              <h2 className="font-display text-xs font-extrabold tracking-wide text-[#E11D74] uppercase">
                Qual tamanho quer?
              </h2>

              {/* Panel Shape Segmented Control: Retangular vs Painel Redondo */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg mt-2.5">
                <button
                  type="button"
                  onClick={() =>
                    onChangeSettings({
                      panelShape: 'rect',
                      manualPositioning: false,
                      imageScale: 1,
                      imageOffsetXMm: 0,
                      imageOffsetYMm: 0,
                    })
                  }
                  className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    settings.panelShape !== 'round'
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Retangular</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleApplyRoundDiameter(settings.roundDiameterCm || 50)}
                  className={`inline-flex items-center justify-center gap-1.5 py-1.5 px-2 text-xs font-bold rounded-md transition-colors cursor-pointer ${
                    settings.panelShape === 'round'
                      ? 'bg-white text-[#E11D74] shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <Circle className="w-3.5 h-3.5" />
                  <span>Painel Redondo</span>
                </button>
              </div>
            </div>

            {settings.panelShape === 'round' ? (
              /* Round Panel Mode (Painel de Bolo / Festa) */
              <form onSubmit={handleSubmitRoundDiameter} className="space-y-3">
                <div>
                  <span className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide">
                    Medidas prontas para painel de bolo
                  </span>
                  <div className="grid grid-cols-2 gap-2">
                    {ROUND_PANEL_PRESETS.map((preset) => {
                      const isActive =
                        Math.abs(settings.roundDiameterCm - preset.cm) < 0.2 &&
                        settings.sizingMode === 'physical';
                      return (
                        <button
                          key={preset.cm}
                          type="button"
                          onClick={() => handleApplyRoundDiameter(preset.cm)}
                          className={`flex flex-col items-start px-3 py-2 rounded-lg border text-left transition-colors cursor-pointer ${
                            isActive
                              ? 'bg-pink-50 border-[#E11D74] text-[#BE185D]'
                              : 'bg-slate-50 border-slate-200 text-slate-800 hover:border-slate-300 hover:bg-white'
                          }`}
                        >
                          <span className="font-mono text-sm font-extrabold tabular-nums leading-tight">
                            Ø {preset.cm} cm
                          </span>
                          <span className="text-[10px] font-medium text-slate-500 mt-0.5">
                            {preset.tag}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="round-diameter-cm"
                    className="block text-[11px] font-semibold text-slate-500 mb-1.5 uppercase tracking-wide"
                  >
                    Diâmetro personalizado (cm)
                  </label>
                  <div className="flex items-center gap-2">
                    <input
                      id="round-diameter-cm"
                      type="text"
                      inputMode="decimal"
                      value={roundDiameterInput}
                      onChange={(e) => setRoundDiameterInput(e.target.value)}
                      className="flex-1 min-w-0 bg-slate-100 border border-slate-200 focus:bg-white focus:border-[#E11D74] rounded-lg px-3 py-2 text-sm font-mono font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E11D74]/20"
                    />
                    <button
                      type="submit"
                      className="px-4 py-2 text-xs font-bold tracking-wide text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                    >
                      Aplicar
                    </button>
                  </div>
                </div>
              </form>
            ) : (
              /* Rectangular Mode: Largura (cm) + Altura (cm) + Proportional Lock */
              <form onSubmit={handleApplyRectSize} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2.5">
                  <div>
                    <label
                      htmlFor="quick-width-cm"
                      className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide"
                    >
                      Largura (cm)
                    </label>
                    <input
                      id="quick-width-cm"
                      type="text"
                      inputMode="decimal"
                      value={widthInput}
                      onChange={(e) => handleWidthInputChange(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-200 focus:bg-white focus:border-[#E11D74] rounded-lg px-3 py-2 text-sm font-mono font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E11D74]/20"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="quick-height-cm"
                      className="block text-[11px] font-semibold text-slate-500 mb-1 uppercase tracking-wide"
                    >
                      Altura (cm)
                    </label>
                    <input
                      id="quick-height-cm"
                      type="text"
                      inputMode="decimal"
                      value={heightInput}
                      onChange={(e) => handleHeightInputChange(e.target.value)}
                      className="w-full bg-slate-100 border border-slate-200 focus:bg-white focus:border-[#E11D74] rounded-lg px-3 py-2 text-sm font-mono font-bold tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E11D74]/20"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeSettings({ lockAspectRatio: !settings.lockAspectRatio })
                    }
                    className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1.5 rounded-md border transition-colors cursor-pointer ${
                      settings.lockAspectRatio
                        ? 'bg-slate-50 border-slate-200 text-slate-700'
                        : 'bg-amber-50 border-amber-200 text-amber-800'
                    }`}
                    title="Manter proporção original da imagem"
                  >
                    {settings.lockAspectRatio ? (
                      <Lock className="w-3 h-3" />
                    ) : (
                      <Unlock className="w-3 h-3" />
                    )}
                    <span>
                      {settings.lockAspectRatio ? 'Proporção travada' : 'Medida livre'}
                    </span>
                  </button>

                  <button
                    type="submit"
                    className="px-4 py-1.5 text-xs font-bold tracking-wide text-white bg-slate-950 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer shrink-0"
                  >
                    Aplicar
                  </button>
                </div>

                <div className="text-center text-[11px] font-medium tracking-wider text-slate-400 uppercase">
                  {settings.sizingMode === 'physical' ? 'Modo Automático' : 'Modo Manual'}
                </div>
              </form>
            )}

            {/* Real Poster Size Card */}
            <div className="bg-pink-50/45 border border-pink-100 rounded-xl p-3.5">
              <div className="flex items-center gap-1.5 text-[11px] font-bold tracking-wide text-[#E11D74] uppercase">
                {isRoundPanel ? (
                  <Circle className="w-3.5 h-3.5" />
                ) : (
                  <Scan className="w-3.5 h-3.5" />
                )}
                <span>
                  {isRoundPanel ? 'Diâmetro real do painel' : 'Tamanho real do pôster'}
                </span>
              </div>
              {isRoundPanel ? (
                <div className="mt-1.5 flex items-baseline gap-1.5 font-display text-2xl font-extrabold text-slate-900 tabular-nums">
                  <span className="text-[#E11D74]">Ø</span>
                  <span>{roundDiameterActualCm.toFixed(1).replace('.', ',')}</span>
                  <span className="text-xs font-semibold text-slate-500 ml-0.5">cm</span>
                </div>
              ) : (
                <div className="mt-1.5 flex items-baseline gap-1.5 font-display text-2xl font-extrabold text-slate-900 tabular-nums">
                  <span>{posterWCm.toFixed(1).replace('.', ',')}</span>
                  <span className="text-sm font-semibold text-slate-400">×</span>
                  <span>{posterHCm.toFixed(1).replace('.', ',')}</span>
                  <span className="text-xs font-semibold text-slate-500 ml-0.5">cm</span>
                </div>
              )}
              {layout && (
                <div className="text-[11px] text-slate-500 mt-1 tabular-nums">
                  {layout.tiles.filter((t) => t.hasIntersection).length} de {layout.cols * layout.rows}{' '}
                  folhas {getPaperSpecLabel(settings).shortLabel} · {layout.estimatedDpi} DPI
                </div>
              )}
              {isRoundPanel && (
                <div className="text-[11px] text-[#BE185D] font-medium mt-1">
                  Recorte circular pontilhado incluso no PDF.
                </div>
              )}
            </div>
          </div>

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

          <div className="flex items-center gap-3 flex-wrap">
            {/* Interactive Measurement Ruler Toggle (Line / Square) */}
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => setRulerEnabled((v) => !v)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  rulerEnabled
                    ? 'bg-[#E11D74] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Ativar régua de medição sobre a arte"
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Régua</span>
              </button>

              <div className="w-px h-4 bg-slate-200 mx-0.5" aria-hidden="true" />

              <button
                type="button"
                onClick={() => {
                  setRulerShape('line');
                  setRulerEnabled(true);
                }}
                title="Medição em Linha (cm)"
                aria-label="Medição em Linha"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  rulerEnabled && rulerShape === 'line'
                    ? 'bg-pink-50 text-[#E11D74]'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <svg
                  viewBox="0 0 16 16"
                  className="w-3.5 h-3.5"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                >
                  <line x1="3" y1="13" x2="13" y2="3" />
                </svg>
              </button>

              <button
                type="button"
                onClick={() => {
                  setRulerShape('rect');
                  setRulerEnabled(true);
                }}
                title="Medição em Quadrado / Retângulo (cm)"
                aria-label="Medição em Quadrado ou Retângulo"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  rulerEnabled && rulerShape === 'rect'
                    ? 'bg-pink-50 text-[#E11D74]'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
              </button>

              {rulerEnabled && (
                <>
                  <div className="w-px h-4 bg-slate-200 mx-0.5" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => setRulerEnabled(false)}
                    title="Desativar régua"
                    aria-label="Desativar régua"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            <p className="text-xs font-semibold text-[#E11D74]">
              {rulerEnabled
                ? rulerShape === 'line'
                  ? 'Régua ativa: arraste as pontas ou trace sobre a imagem para medir em cm.'
                  : 'Régua Quadrado ativa: arraste os cantos para medir largura × altura.'
                : 'Dica: Aumente e diminua a imagem usando o botão de rolar do mouse.'}
            </p>
          </div>
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
              <div className="grid grid-cols-[40px_auto] grid-rows-[40px_auto] gap-2.5 items-stretch">
                {/* Top-Left Corner Unit Indicator */}
                <div className="flex items-center justify-center text-[10px] font-mono font-bold text-slate-400 select-none">
                  cm
                </div>

                {/* Top Horizontal Physical Ruler (true cm ticks flush with poster left/right edges) */}
                <div className="relative bg-white/95 border border-slate-200 rounded-md shadow-2xs h-10 overflow-hidden select-none">
                  {horizTicks.map((t) => {
                    const nearCenterBadge = Math.abs(t.pct - 50) < 17;
                    const nearEdge = t.pct < 4 || t.pct > 96;
                    return (
                      <div
                        key={t.cm}
                        style={{ left: `${t.pct}%` }}
                        className="absolute bottom-0 -translate-x-1/2 flex flex-col items-center pointer-events-none"
                      >
                        {t.kind === 'major' && t.cm > 0 && !nearCenterBadge && !nearEdge && (
                          <span className="text-[9px] font-mono tabular-nums text-slate-400 leading-none mb-1">
                            {t.cm}
                          </span>
                        )}
                        <div
                          className={`w-px ${
                            t.kind === 'major'
                              ? 'h-3.5 bg-slate-600'
                              : t.kind === 'mid'
                              ? 'h-2.5 bg-slate-400'
                              : 'h-1.5 bg-slate-300'
                          }`}
                        />
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="px-2.5 py-0.5 rounded-full bg-[#E11D74] text-white font-mono text-xs font-bold tabular-nums shadow-xs">
                      {posterWCm.toFixed(1).replace('.', ',')} cm
                    </span>
                  </div>
                </div>

                {/* Left Vertical Physical Ruler (true cm ticks flush with poster top/bottom edges) */}
                <div className="relative bg-white/95 border border-slate-200 rounded-md shadow-2xs w-10 overflow-hidden select-none">
                  {vertTicks.map((t) => {
                    const nearCenterBadge = Math.abs(t.pct - 50) < 15;
                    const nearEdge = t.pct < 4 || t.pct > 96;
                    return (
                      <div
                        key={t.cm}
                        style={{ top: `${t.pct}%` }}
                        className="absolute right-0 -translate-y-1/2 flex items-center pointer-events-none"
                      >
                        {t.kind === 'major' && t.cm > 0 && !nearCenterBadge && !nearEdge && (
                          <span className="text-[9px] font-mono tabular-nums text-slate-400 leading-none mr-1">
                            {t.cm}
                          </span>
                        )}
                        <div
                          className={`h-px ${
                            t.kind === 'major'
                              ? 'w-3.5 bg-slate-600'
                              : t.kind === 'mid'
                              ? 'w-2.5 bg-slate-400'
                              : 'w-1.5 bg-slate-300'
                          }`}
                        />
                      </div>
                    );
                  })}
                  <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <span className="-rotate-90 px-2.5 py-0.5 rounded-full bg-[#E11D74] text-white font-mono text-xs font-bold tabular-nums shadow-xs whitespace-nowrap">
                      {posterHCm.toFixed(1).replace('.', ',')} cm
                    </span>
                  </div>
                </div>

                {/* Interactive Poster Surface (outer overflow-visible so ruler handles at edges are never clipped) */}
                <div className="relative flex flex-col items-center">
                  <div
                    ref={posterBoxRef}
                    onPointerDown={handlePosterPointerDown}
                    className={`relative bg-white shadow-xl border border-slate-200 overflow-visible select-none touch-none ${
                      rulerEnabled
                        ? 'cursor-crosshair'
                        : 'cursor-grab active:cursor-grabbing'
                    }`}
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
                    {/* Clipped Artwork + Sheet Division Grid */}
                    <div className="absolute inset-0 overflow-hidden">
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
                          className={`absolute border pointer-events-none ${
                            isRoundPanel && !tile.hasIntersection
                              ? 'border-slate-300/60 bg-slate-100/55'
                              : 'border-slate-900/18'
                          }`}
                          style={{
                            left: `${(tile.gridXMm / layout.totalGridWMm) * 100}%`,
                            top: `${(tile.gridYMm / layout.totalGridHMm) * 100}%`,
                            width: `${(tile.printableWMm / layout.totalGridWMm) * 100}%`,
                            height: `${(tile.printableHMm / layout.totalGridHMm) * 100}%`,
                          }}
                        />
                      ))}

                      {/* Round Panel Circular Mask & Dashed Cut Guide */}
                      {isRoundPanel &&
                        layout.circleCenterXMm !== undefined &&
                        layout.circleCenterYMm !== undefined &&
                        layout.circleRadiusMm !== undefined && (
                          <svg
                            viewBox={`0 0 ${layout.totalGridWMm} ${layout.totalGridHMm}`}
                            className="absolute inset-0 w-full h-full pointer-events-none"
                          >
                            {/* Softly mask discarded corners outside the round cake/party panel */}
                            <path
                              fill="rgba(255, 255, 255, 0.84)"
                              fillRule="evenodd"
                              d={`M 0 0 H ${layout.totalGridWMm} V ${layout.totalGridHMm} H 0 Z M ${
                                layout.circleCenterXMm + layout.circleRadiusMm
                              } ${layout.circleCenterYMm} A ${layout.circleRadiusMm} ${
                                layout.circleRadiusMm
                              } 0 1 0 ${
                                layout.circleCenterXMm - layout.circleRadiusMm
                              } ${layout.circleCenterYMm} A ${layout.circleRadiusMm} ${
                                layout.circleRadiusMm
                              } 0 1 0 ${
                                layout.circleCenterXMm + layout.circleRadiusMm
                              } ${layout.circleCenterYMm} Z`}
                            />
                            {/* Crisp dashed scissor cut circle */}
                            <circle
                              cx={layout.circleCenterXMm}
                              cy={layout.circleCenterYMm}
                              r={layout.circleRadiusMm}
                              fill="none"
                              stroke="#E11D74"
                              strokeWidth="2.2"
                              strokeDasharray="6 4"
                              vectorEffect="non-scaling-stroke"
                            />
                          </svg>
                        )}

                      {isRoundPanel && (
                        <div className="absolute top-2.5 left-1/2 -translate-x-1/2 pointer-events-none px-2.5 py-0.5 rounded-full bg-[#E11D74] text-white font-mono text-[11px] font-bold tabular-nums shadow-sm">
                          Painel Redondo Ø {roundDiameterActualCm.toFixed(0)} cm
                        </div>
                      )}
                    </div>

                    {/* Interactive Line/Square Measurement Overlay */}
                    {rulerEnabled && (
                      <InteractiveRulerOverlay
                        layout={layout}
                        surfaceRef={posterBoxRef}
                        rulerShape={rulerShape}
                        lineCoords={lineCoords}
                        rectCoords={rectCoords}
                        onChangeLineCoords={setLineCoords}
                        onChangeRectCoords={setRectCoords}
                        accentColor="#E11D74"
                      />
                    )}

                    {/* Floating "Ver em tamanho real" Button anchored at bottom center */}
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 z-30">
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

              <p className="text-xs text-slate-500 mt-5 text-center">
                {rulerEnabled
                  ? 'Arraste as pontas ou o corpo da régua para medir qualquer parte da imagem em centímetros reais.'
                  : 'Arraste a arte diretamente sobre as folhas para posicionar ou use a roda do mouse para dar zoom.'}
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
