import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookmarkPlus,
  CheckCircle2,
  ChevronDown,
  Crown,
  Download,
  Droplets,
  Eye,
  FileDown,
  FlipHorizontal,
  Grid2x2,
  Layers,
  Lock,
  Maximize2,
  Move,
  Palette,
  RotateCcw,
  RotateCw,
  Ruler,
  Scissors,
  Search,
  SlidersHorizontal,
  Sparkles,
  Square,
  Stamp,
  Trash2,
  Unlock,
  Upload,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CalibrationProfile,
  ImageFilters,
  Orientation,
  PaperSize,
  PosterLayout,
  PosterSettings,
  SampleArtwork,
  TileSlice,
  WatermarkLayout,
} from '../types/poster';
import {
  isTileCanvasBlank,
  PAPER_COLOR_PROFILES,
} from '../utils/imageProcessing';
import { generateCalibrationTestPdf } from '../utils/pdfGenerator';
import {
  getDpiQualityLabel,
  getPaperSpecLabel,
  PAPER_CATALOG,
} from '../utils/posterMath';
import { ArtworkPreview } from './ArtworkPreview';
import { PdfPreviewModal } from './PdfPreviewModal';
import { TilePreviewModal } from './TilePreviewModal';

interface SliceWorkspaceProps {
  samples: SampleArtwork[];
  activeImageSrc: string;
  activeImageName: string;
  hasActiveFilters: boolean;
  processedCanvas: HTMLCanvasElement | null;
  layout: PosterLayout | null;
  settings: PosterSettings;
  filters: ImageFilters;
  isLoadingImage: boolean;
  isExporting: boolean;
  exportSuccessMsg: string | null;
  onUploadFile: (file: File) => void;
  onSelectSample: (sample: SampleArtwork) => void;
  onChangeSettings: (patch: Partial<PosterSettings>) => void;
  onChangeFilters: (patch: Partial<ImageFilters>) => void;
  onResetFilters: () => void;
  onDownloadPdf: () => void;
}

type RulerShape = 'line' | 'rect';
type AccordionSection =
  | 'division'
  | 'paper'
  | 'cuts'
  | 'guided'
  | 'overlap'
  | 'manual'
  | 'reticle'
  | 'watermark'
  | 'color'
  | 'stencil';

interface RulerCoords {
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

const PROFILES_STORAGE_KEY = 'fatiart_calibration_profiles_v1';

function formatCm(val: number): string {
  return `${val.toFixed(1).replace('.', ',')} cm`;
}

export const SliceWorkspace: React.FC<SliceWorkspaceProps> = ({
  samples,
  activeImageSrc,
  activeImageName,
  hasActiveFilters,
  processedCanvas,
  layout,
  settings,
  filters,
  isLoadingImage,
  isExporting,
  exportSuccessMsg,
  onUploadFile,
  onSelectSample,
  onChangeSettings,
  onChangeFilters,
  onResetFilters,
  onDownloadPdf,
}) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [inspectedTile, setInspectedTile] = useState<TileSlice | null>(null);
  const [isPdfPreviewOpen, setIsPdfPreviewOpen] = useState(false);
  const [hoveredTileIndex, setHoveredTileIndex] = useState<number | null>(null);

  // Accordion open state (multiple sections can be expanded freely)
  const [openSections, setOpenSections] = useState<Record<AccordionSection, boolean>>({
    division: true,
    paper: false,
    cuts: false,
    guided: false,
    overlap: false,
    manual: false,
    reticle: false,
    watermark: false,
    color: false,
    stencil: false,
  });

  // Paper panel controls
  const [paperSearch, setPaperSearch] = useState('');
  const [showAllPapers, setShowAllPapers] = useState(false);

  const toggleSection = (sec: AccordionSection) => {
    setOpenSections((prev) => ({ ...prev, [sec]: !prev[sec] }));
  };

  // Ruler tool state
  const [rulerEnabled, setRulerEnabled] = useState(false);
  const [rulerShape, setRulerShape] = useState<RulerShape>('line');
  const [lineCoords, setLineCoords] = useState<RulerCoords>({
    x1: 6,
    y1: 36,
    x2: 94,
    y2: 36,
  });
  const [rectCoords, setRectCoords] = useState<RulerCoords>({
    x1: 20,
    y1: 22,
    x2: 80,
    y2: 68,
  });
  const [hasCustomRuler, setHasCustomRuler] = useState(true);
  const gridSurfaceRef = useRef<HTMLDivElement | null>(null);

  // Calibration profiles stored in localStorage
  const [savedProfiles, setSavedProfiles] = useState<CalibrationProfile[]>(() => {
    try {
      const raw = localStorage.getItem(PROFILES_STORAGE_KEY);
      return raw ? (JSON.parse(raw) as CalibrationProfile[]) : [];
    } catch {
      return [];
    }
  });
  const [newProfileName, setNewProfileName] = useState('');

  useEffect(() => {
    try {
      localStorage.setItem(PROFILES_STORAGE_KEY, JSON.stringify(savedProfiles));
    } catch {
      // ignore storage quota errors
    }
  }, [savedProfiles]);


  const blankTileIndices = useMemo(() => {
    const set = new Set<number>();
    if (!processedCanvas || !layout || !settings.skipBlankPages) return set;
    for (const tile of layout.tiles) {
      if (isTileCanvasBlank(processedCanvas, tile)) {
        set.add(tile.index);
      }
    }
    return set;
  }, [processedCanvas, layout, settings.skipBlankPages]);

  const activeSheetCount = useMemo(() => {
    if (!layout) return 0;
    const count = layout.tiles.filter((t) => !blankTileIndices.has(t.index)).length;
    return Math.max(1, count);
  }, [layout, blankTileIndices]);

  const dpiInfo = layout ? getDpiQualityLabel(layout.estimatedDpi) : null;

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDraggingFile(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.type.startsWith('image/')) {
      onUploadFile(file);
    }
  };

  const handlePhysicalWidthChange = (nextWidthCm: number) => {
    const clamped = Math.max(5, Math.min(600, nextWidthCm || 5));
    if (settings.lockAspectRatio && processedCanvas) {
      const ratio = processedCanvas.width / Math.max(1, processedCanvas.height);
      onChangeSettings({
        targetWidthCm: clamped,
        targetHeightCm: Number((clamped / ratio).toFixed(1)),
      });
    } else {
      onChangeSettings({ targetWidthCm: clamped });
    }
  };

  const handlePhysicalHeightChange = (nextHeightCm: number) => {
    const clamped = Math.max(5, Math.min(600, nextHeightCm || 5));
    if (settings.lockAspectRatio && processedCanvas) {
      const ratio = processedCanvas.width / Math.max(1, processedCanvas.height);
      onChangeSettings({
        targetHeightCm: clamped,
        targetWidthCm: Number((clamped * ratio).toFixed(1)),
      });
    } else {
      onChangeSettings({ targetHeightCm: clamped });
    }
  };

  // Manual image drag framing on canvas
  const handleManualImagePointerDown = (e: React.PointerEvent) => {
    if (!settings.manualPositioning || rulerEnabled || !layout || !gridSurfaceRef.current) {
      return;
    }
    e.preventDefault();
    e.stopPropagation();
    const surfaceRect = gridSurfaceRef.current.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origOffsetX = settings.imageOffsetXMm;
    const origOffsetY = settings.imageOffsetYMm;
    const mmPerPxX = layout.totalGridWMm / Math.max(1, surfaceRect.width);
    const mmPerPxY = layout.totalGridHMm / Math.max(1, surfaceRect.height);

    const onMove = (ev: PointerEvent) => {
      const dxMm = (ev.clientX - startX) * mmPerPxX;
      const dyMm = (ev.clientY - startY) * mmPerPxY;
      onChangeSettings({
        imageOffsetXMm: Math.round((origOffsetX + dxMm) * 10) / 10,
        imageOffsetYMm: Math.round((origOffsetY + dyMm) * 10) / 10,
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  // Ruler pointer interactions
  const getSurfacePct = (clientX: number, clientY: number) => {
    const el = gridSurfaceRef.current;
    if (!el) return { x: 50, y: 50 };
    const rect = el.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  };

  const handleRulerSurfacePointerDown = (e: React.PointerEvent) => {
    if (!rulerEnabled || !layout) return;
    e.preventDefault();
    e.stopPropagation();
    const start = getSurfacePct(e.clientX, e.clientY);
    setHasCustomRuler(true);

    if (rulerShape === 'line') {
      setLineCoords({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    } else {
      setRectCoords({ x1: start.x, y1: start.y, x2: start.x, y2: start.y });
    }

    const onMove = (ev: PointerEvent) => {
      const curr = getSurfacePct(ev.clientX, ev.clientY);
      if (rulerShape === 'line') {
        let nx = curr.x;
        let ny = curr.y;
        if (ev.shiftKey) {
          const dxPx = ((nx - start.x) / 100) * layout.totalGridWMm;
          const dyPx = ((ny - start.y) / 100) * layout.totalGridHMm;
          if (Math.abs(dxPx) > Math.abs(dyPx) * 2) ny = start.y;
          else if (Math.abs(dyPx) > Math.abs(dxPx) * 2) nx = start.x;
        }
        setLineCoords({ x1: start.x, y1: start.y, x2: nx, y2: ny });
      } else {
        let nx = curr.x;
        let ny = curr.y;
        if (ev.shiftKey) {
          const dxMm = ((nx - start.x) / 100) * layout.totalGridWMm;
          const dyMm = ((ny - start.y) / 100) * layout.totalGridHMm;
          const sideMm = Math.max(Math.abs(dxMm), Math.abs(dyMm));
          nx = start.x + (Math.sign(dxMm || 1) * sideMm * 100) / layout.totalGridWMm;
          ny = start.y + (Math.sign(dyMm || 1) * sideMm * 100) / layout.totalGridHMm;
          nx = Math.max(0, Math.min(100, nx));
          ny = Math.max(0, Math.min(100, ny));
        }
        setRectCoords({ x1: start.x, y1: start.y, x2: nx, y2: ny });
      }
    };

    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleLineHandlePointerDown = (
    e: React.PointerEvent,
    handle: 'start' | 'end'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!layout) return;

    const onMove = (ev: PointerEvent) => {
      const curr = getSurfacePct(ev.clientX, ev.clientY);
      setLineCoords((prev) => {
        const anchor =
          handle === 'start' ? { x: prev.x2, y: prev.y2 } : { x: prev.x1, y: prev.y1 };
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
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const handleRectCornerPointerDown = (
    e: React.PointerEvent,
    corner: 'nw' | 'ne' | 'sw' | 'se'
  ) => {
    e.preventDefault();
    e.stopPropagation();
    if (!layout) return;

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
      setRectCoords({ x1: anchorX, y1: anchorY, x2: nx, y2: ny });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

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
      setRectCoords({
        x1: nextMinX,
        y1: nextMinY,
        x2: nextMinX + w,
        y2: nextMinY + h,
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const rulerMetrics = useMemo(() => {
    if (!layout) return null;
    const gridWcm = layout.totalGridWMm / 10;
    const gridHcm = layout.totalGridHMm / 10;

    const lineDxCm = ((lineCoords.x2 - lineCoords.x1) / 100) * gridWcm;
    const lineDyCm = ((lineCoords.y2 - lineCoords.y1) / 100) * gridHcm;
    const lineLenCm = Math.hypot(lineDxCm, lineDyCm);

    const rectLeftPct = Math.min(rectCoords.x1, rectCoords.x2);
    const rectTopPct = Math.min(rectCoords.y1, rectCoords.y2);
    const rectWPct = Math.abs(rectCoords.x2 - rectCoords.x1);
    const rectHPct = Math.abs(rectCoords.y2 - rectCoords.y1);
    const rectWCm = (rectWPct / 100) * gridWcm;
    const rectHCm = (rectHPct / 100) * gridHcm;
    const rectDiagCm = Math.hypot(rectWCm, rectHCm);

    return {
      lineLenCm,
      rectLeftPct,
      rectTopPct,
      rectWPct,
      rectHPct,
      rectWCm,
      rectHCm,
      rectDiagCm,
    };
  }, [layout, lineCoords, rectCoords]);

  const handleSaveCalibrationProfile = () => {
    const clean = newProfileName.trim();
    if (!clean) return;
    const profile: CalibrationProfile = {
      id: `prof-${Date.now()}`,
      name: clean,
      createdAt: new Date().toLocaleDateString('pt-BR'),
      paperColorProfile: filters.paperColorProfile,
      saturation: filters.saturation,
      contrast: filters.contrast,
      brightness: filters.brightness,
      temperature: filters.temperature,
      reticleEnabled: filters.reticleEnabled,
      reticleInkSaving: filters.reticleInkSaving,
    };
    setSavedProfiles((prev) => [profile, ...prev]);
    setNewProfileName('');
  };

  const applyCalibrationProfile = (profile: CalibrationProfile) => {
    onChangeFilters({
      paperColorProfile: profile.paperColorProfile,
      saturation: profile.saturation,
      contrast: profile.contrast,
      brightness: profile.brightness,
      temperature: profile.temperature,
      reticleEnabled: profile.reticleEnabled,
      reticleInkSaving: profile.reticleInkSaving,
    });
  };

  const toggleGuidedAssembly = () => {
    const next = !settings.guidedAssembly;
    if (next) {
      onChangeSettings({
        guidedAssembly: true,
        marginMm: 10,
        overlapMm: Math.max(10, settings.overlapMm),
        showCutMarks: true,
        showPageNumbers: true,
        includeAssemblyMap: true,
      });
    } else {
      onChangeSettings({
        guidedAssembly: false,
        marginMm: 8,
      });
    }
  };

  const activeColorProfile =
    PAPER_COLOR_PROFILES.find((p) => p.id === filters.paperColorProfile) ||
    PAPER_COLOR_PROFILES[0];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_385px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Left Preview Stage */}
      <div
        className="flex flex-col min-h-[620px] border-b lg:border-b-0 lg:border-r border-slate-200"
        onDragOver={(e) => {
          e.preventDefault();
          setIsDraggingFile(true);
        }}
        onDragLeave={() => setIsDraggingFile(false)}
        onDrop={handleDrop}
      >
        {/* Stage Toolbar */}
        <div className="px-4 py-3 border-b border-slate-200 bg-slate-50/70 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0">
              <Upload className="w-3.5 h-3.5" />
              <span>Enviar Imagem</span>
              <input
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) onUploadFile(file);
                  e.target.value = '';
                }}
              />
            </label>

            <span className="text-xs text-slate-400 hidden sm:inline">·</span>

            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-slate-500 hidden sm:inline">Exemplos:</span>
              {samples.map((sample) => (
                <button
                  key={sample.id}
                  type="button"
                  onClick={() => onSelectSample(sample)}
                  className={`px-2.5 py-1 text-xs font-medium rounded-md border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeImageName === sample.title
                      ? 'bg-white border-slate-300 text-slate-900 shadow-2xs'
                      : 'bg-transparent border-transparent text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
                  }`}
                >
                  {sample.title}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap shrink-0">
            {/* Ruler Mode Control Group */}
            <div className="inline-flex items-center bg-white border border-slate-200 rounded-lg p-0.5">
              <button
                type="button"
                onClick={() => {
                  setRulerEnabled((v) => !v);
                  setHasCustomRuler(true);
                }}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  rulerEnabled
                    ? 'bg-[#2563EB] text-white'
                    : 'text-slate-700 hover:bg-slate-100'
                }`}
                title="Ativar ou desativar modo régua"
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
                  setHasCustomRuler(true);
                }}
                title="Medição em Linha (distância em cm)"
                aria-label="Medição em Linha"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  rulerEnabled && rulerShape === 'line'
                    ? 'bg-blue-50 text-[#2563EB]'
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
                  setHasCustomRuler(true);
                }}
                title="Medição em Quadrado / Retângulo (largura × altura em cm)"
                aria-label="Medição em Quadrado ou Retângulo"
                className={`p-1.5 rounded-md transition-colors cursor-pointer ${
                  rulerEnabled && rulerShape === 'rect'
                    ? 'bg-blue-50 text-[#2563EB]'
                    : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
              </button>

              {rulerEnabled && hasCustomRuler && (
                <>
                  <div className="w-px h-4 bg-slate-200 mx-0.5" aria-hidden="true" />
                  <button
                    type="button"
                    onClick={() => {
                      setHasCustomRuler(false);
                      setRulerEnabled(false);
                    }}
                    title="Ocultar régua"
                    aria-label="Ocultar régua"
                    className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-md cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </>
              )}
            </div>

            {/* Zoom Controls */}
            <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg p-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.5, Number((z - 0.15).toFixed(2))))}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                title="Diminuir zoom"
                aria-label="Diminuir zoom"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                className="px-2 py-1 text-xs font-mono tabular-nums text-slate-700 hover:bg-slate-100 rounded cursor-pointer"
                title="Resetar zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(1.75, Number((z + 0.15).toFixed(2))))}
                className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                title="Aumentar zoom"
                aria-label="Aumentar zoom"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
            </div>

            <button
              type="button"
              disabled={!layout || !processedCanvas}
              onClick={() => setIsPdfPreviewOpen(true)}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 hover:text-slate-900 disabled:opacity-40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0"
              title="Visualizar todas as páginas do PDF antes de baixar"
            >
              <Eye className="w-3.5 h-3.5" />
              <span>Visualizar PDF</span>
            </button>
          </div>
        </div>

        {/* Interactive Blueprint Canvas */}
        <div className="relative flex-1 drafting-grid p-6 sm:p-8 flex items-center justify-center overflow-auto min-h-[480px]">
          {isDraggingFile && (
            <div className="absolute inset-3 z-20 rounded-xl border-2 border-dashed border-[#E85D04] bg-[#E85D04]/10 backdrop-blur-xs flex flex-col items-center justify-center text-center p-6">
              <Upload className="w-8 h-8 text-[#E85D04] mb-2" />
              <p className="font-display text-base font-bold text-slate-900">
                Solte sua imagem aqui
              </p>
              <p className="text-xs text-slate-600 mt-1">
                JPG, PNG, WebP ou SVG em alta resolução
              </p>
            </div>
          )}

          {isLoadingImage ? (
            <div className="text-center py-16">
              <div className="w-8 h-8 border-2 border-slate-300 border-t-[#E85D04] rounded-full animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-600">Processando imagem...</p>
            </div>
          ) : !layout || !processedCanvas ? (
            <div className="text-center max-w-sm py-12">
              <Upload className="w-10 h-10 text-slate-400 mx-auto mb-3" />
              <h3 className="font-display text-base font-bold text-slate-900">
                Envie uma imagem para começar
              </h3>
              <p className="text-xs text-slate-600 mt-1.5">
                Arraste um arquivo ou selecione um dos exemplos acima para visualizar a divisão em folhas A4.
              </p>
            </div>
          ) : (
            <div
              className="transition-transform duration-150 origin-center"
              style={{ transform: `scale(${zoom})` }}
            >
              {/* Total Grid Sheet Surface */}
              <div
                ref={gridSurfaceRef}
                onPointerDown={handleManualImagePointerDown}
                className={`relative bg-white shadow-lg border border-slate-300 select-none overflow-hidden ${
                  settings.manualPositioning && !rulerEnabled
                    ? 'cursor-grab active:cursor-grabbing ring-2 ring-[#2563EB]/40'
                    : ''
                }`}
                style={{
                  aspectRatio: `${layout.totalGridWMm} / ${layout.totalGridHMm}`,
                  width:
                    layout.totalGridWMm >= layout.totalGridHMm
                      ? 'min(620px, 76vw)'
                      : `min(${Math.round(520 * (layout.totalGridWMm / layout.totalGridHMm))}px, 72vw)`,
                }}
              >
                {/* Placed Image Inside Grid */}
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

                {/* Paper Sheet Grid Overlay */}
                {layout.tiles.map((tile) => {
                  const isBlank = blankTileIndices.has(tile.index);
                  const isHovered = hoveredTileIndex === tile.index;
                  const leftPct = (tile.gridXMm / layout.totalGridWMm) * 100;
                  const topPct = (tile.gridYMm / layout.totalGridHMm) * 100;
                  const widthPct = (tile.printableWMm / layout.totalGridWMm) * 100;
                  const heightPct = (tile.printableHMm / layout.totalGridHMm) * 100;

                  const overlapRightPct =
                    settings.overlapMm > 0 && tile.col < layout.cols - 1
                      ? (settings.overlapMm / tile.printableWMm) * 100
                      : 0;
                  const overlapBottomPct =
                    settings.overlapMm > 0 && tile.row < layout.rows - 1
                      ? (settings.overlapMm / tile.printableHMm) * 100
                      : 0;

                  return (
                    <button
                      key={tile.index}
                      type="button"
                      onClick={() => {
                        if (!settings.manualPositioning && !rulerEnabled) {
                          setInspectedTile(tile);
                        }
                      }}
                      onMouseEnter={() => setHoveredTileIndex(tile.index)}
                      onMouseLeave={() => setHoveredTileIndex(null)}
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        width: `${widthPct}%`,
                        height: `${heightPct}%`,
                      }}
                      title={
                        settings.manualPositioning
                          ? 'Arraste para posicionar a imagem'
                          : `Clique para visualizar Folha ${tile.index} (${tile.pageLabel})`
                      }
                      className={`absolute border transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D04] ${
                        settings.manualPositioning || rulerEnabled
                          ? 'pointer-events-none border-slate-800/40'
                          : isBlank
                          ? 'cursor-pointer bg-slate-100/75 border-slate-300/80'
                          : isHovered
                          ? 'cursor-pointer border-[#E85D04] bg-[#E85D04]/10 z-10'
                          : 'cursor-pointer border-slate-800/45 hover:border-[#E85D04]'
                      }`}
                    >
                      {overlapRightPct > 0 && (
                        <div
                          className="absolute top-0 bottom-0 right-0 bg-[#E85D04]/15 border-l border-dashed border-[#E85D04]/60 pointer-events-none"
                          style={{ width: `${overlapRightPct}%` }}
                        />
                      )}
                      {overlapBottomPct > 0 && (
                        <div
                          className="absolute left-0 right-0 bottom-0 bg-[#E85D04]/15 border-t border-dashed border-[#E85D04]/60 pointer-events-none"
                          style={{ height: `${overlapBottomPct}%` }}
                        />
                      )}

                      <span
                        className={`inline-flex items-center gap-1 m-1.5 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums font-semibold shadow-2xs ${
                          isBlank
                            ? 'bg-slate-200 text-slate-600'
                            : isHovered && !settings.manualPositioning
                            ? 'bg-[#E85D04] text-white'
                            : 'bg-white/90 text-slate-900 border border-slate-200/80'
                        }`}
                      >
                        <span>{tile.index}</span>
                        <span className="opacity-65 hidden sm:inline">{tile.pageLabel}</span>
                        {isBlank && <span className="text-[10px]">(pulada)</span>}
                      </span>

                      {isHovered && !isBlank && !rulerEnabled && !settings.manualPositioning && (
                        <span className="absolute bottom-1.5 right-1.5 p-1 bg-white/95 rounded shadow-xs text-slate-700">
                          <Maximize2 className="w-3 h-3" />
                        </span>
                      )}
                    </button>
                  );
                })}

                {/* Interactive Ruler Overlay (Line & Square/Rectangle modes) */}
                {rulerEnabled && rulerMetrics && (
                  <div
                    onPointerDown={handleRulerSurfacePointerDown}
                    className="absolute inset-0 z-20 cursor-crosshair select-none"
                  >
                    {hasCustomRuler && rulerShape === 'line' && (
                      <>
                        <svg
                          viewBox="0 0 100 100"
                          preserveAspectRatio="none"
                          className="absolute inset-0 w-full h-full pointer-events-none"
                        >
                          <line
                            x1={lineCoords.x1}
                            y1={lineCoords.y1}
                            x2={lineCoords.x2}
                            y2={lineCoords.y2}
                            stroke="#2563EB"
                            strokeWidth="2.5"
                            vectorEffect="non-scaling-stroke"
                          />
                        </svg>

                        <div
                          style={{
                            left: `${(lineCoords.x1 + lineCoords.x2) / 2}%`,
                            top: `${(lineCoords.y1 + lineCoords.y2) / 2}%`,
                          }}
                          className="absolute -translate-x-1/2 -translate-y-1/2 -mt-4 pointer-events-none bg-white/95 text-slate-900 border border-slate-200/90 shadow-md px-2.5 py-0.5 rounded-md font-display text-xs font-bold tabular-nums whitespace-nowrap"
                        >
                          {formatCm(rulerMetrics.lineLenCm)}
                        </div>

                        <div
                          onPointerDown={(e) => handleLineHandlePointerDown(e, 'start')}
                          style={{
                            left: `${lineCoords.x1}%`,
                            top: `${lineCoords.y1}%`,
                          }}
                          title="Arraste para ajustar início da linha"
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-[#2563EB] shadow-sm cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                        />

                        <div
                          onPointerDown={(e) => handleLineHandlePointerDown(e, 'end')}
                          style={{
                            left: `${lineCoords.x2}%`,
                            top: `${lineCoords.y2}%`,
                          }}
                          title="Arraste para ajustar fim da linha"
                          className="absolute -translate-x-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-[#2563EB] shadow-sm cursor-grab active:cursor-grabbing hover:scale-125 transition-transform"
                        />
                      </>
                    )}

                    {hasCustomRuler && rulerShape === 'rect' && (
                      <div
                        onPointerDown={handleRectMovePointerDown}
                        style={{
                          left: `${rulerMetrics.rectLeftPct}%`,
                          top: `${rulerMetrics.rectTopPct}%`,
                          width: `${rulerMetrics.rectWPct}%`,
                          height: `${rulerMetrics.rectHPct}%`,
                        }}
                        className="absolute border-2 border-[#2563EB] bg-[#2563EB]/12 cursor-move"
                      >
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none bg-white/95 text-slate-900 border border-slate-200/90 shadow-md px-2.5 py-1 rounded-md text-center whitespace-nowrap">
                          <div className="font-display text-xs font-bold tabular-nums">
                            {rulerMetrics.rectWCm.toFixed(1).replace('.', ',')} ×{' '}
                            {rulerMetrics.rectHCm.toFixed(1).replace('.', ',')} cm
                          </div>
                          {rulerMetrics.rectWPct > 18 && rulerMetrics.rectHPct > 14 && (
                            <div className="text-[10px] font-mono tabular-nums text-slate-500">
                              Diag: {formatCm(rulerMetrics.rectDiagCm)}
                            </div>
                          )}
                        </div>

                        <div
                          onPointerDown={(e) => handleRectCornerPointerDown(e, 'nw')}
                          className="absolute -left-1.5 -top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-[#2563EB] shadow-sm cursor-nwse-resize"
                        />
                        <div
                          onPointerDown={(e) => handleRectCornerPointerDown(e, 'ne')}
                          className="absolute -right-1.5 -top-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-[#2563EB] shadow-sm cursor-nesw-resize"
                        />
                        <div
                          onPointerDown={(e) => handleRectCornerPointerDown(e, 'sw')}
                          className="absolute -left-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-[#2563EB] shadow-sm cursor-nesw-resize"
                        />
                        <div
                          onPointerDown={(e) => handleRectCornerPointerDown(e, 'se')}
                          className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 rounded-full bg-slate-950 border-2 border-[#2563EB] shadow-sm cursor-nwse-resize"
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Info Bar */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-white flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
          <span>
            {rulerEnabled
              ? rulerShape === 'line'
                ? 'Modo Régua (Linha): arraste sobre a arte para medir ou mova as pontas. Segure Shift para alinhar.'
                : 'Modo Régua (Quadrado): arraste para medir largura × altura. Segure Shift para quadrado perfeito.'
              : settings.manualPositioning
              ? 'Posicionamento Manual ativo: arraste a imagem diretamente na grade para escolher o enquadramento.'
              : 'Clique em qualquer folha na grade para visualizar o corte exato antes de imprimir.'}
          </span>
          {processedCanvas && (
            <span className="font-mono tabular-nums text-slate-600">
              Original: {processedCanvas.width} × {processedCanvas.height} px
            </span>
          )}
        </div>
      </div>

      {/* Right Configuration Accordion Sidebar */}
      <aside className="flex flex-col justify-between bg-white">
        <div className="divide-y divide-slate-200">
          {/* 2. Divisão */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('division')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-display text-xs font-bold shrink-0">
                  2
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Divisão
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {settings.sizingMode === 'proportional_sheets'
                      ? 'folhas'
                      : settings.sizingMode === 'physical'
                      ? 'tamanho'
                      : 'livre'}{' '}
                    · {layout ? `${layout.cols} × ${layout.rows}` : `${settings.cols} × ${settings.rows}`}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.division ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.division && (
              <div className="mt-4 space-y-3.5 text-xs">
                <div>
                  <div className="font-semibold text-slate-700 mb-2">
                    Modo de divisão
                  </div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSettings({ sizingMode: 'proportional_sheets' })
                      }
                      className={`w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        settings.sizingMode === 'proportional_sheets'
                          ? 'border-[#2563EB] bg-blue-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Grid2x2
                          className={`w-4 h-4 ${
                            settings.sizingMode === 'proportional_sheets'
                              ? 'text-[#2563EB]'
                              : 'text-slate-500'
                          }`}
                        />
                        <span>Folhas</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 pl-6">
                        Defina quantas páginas de largura ou altura
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onChangeSettings({ sizingMode: 'physical' })}
                      className={`w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        settings.sizingMode === 'physical'
                          ? 'border-[#2563EB] bg-blue-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Ruler
                          className={`w-4 h-4 ${
                            settings.sizingMode === 'physical'
                              ? 'text-[#2563EB]'
                              : 'text-slate-500'
                          }`}
                        />
                        <span>Tamanho</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 pl-6">
                        Defina o tamanho real em cm ou metros
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => onChangeSettings({ sizingMode: 'free_grid' })}
                      className={`w-full p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                        settings.sizingMode === 'free_grid'
                          ? 'border-[#2563EB] bg-blue-50/50'
                          : 'border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2 font-semibold text-slate-900">
                        <Square
                          className={`w-4 h-4 ${
                            settings.sizingMode === 'free_grid'
                              ? 'text-[#2563EB]'
                              : 'text-slate-500'
                          }`}
                        />
                        <span>Livre</span>
                      </div>
                      <p className="text-[11px] text-slate-500 mt-0.5 pl-6">
                        Controle linhas e colunas diretamente
                      </p>
                    </button>
                  </div>
                </div>

                {/* Mode-specific controls */}
                {settings.sizingMode === 'proportional_sheets' && (
                  <div className="space-y-3 pt-1">
                    <div>
                      <div className="font-semibold text-slate-700 mb-2">
                        Definir por
                      </div>
                      <div className="flex items-center gap-4">
                        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="sheetAxis"
                            checked={settings.sheetAxis === 'cols'}
                            onChange={() => onChangeSettings({ sheetAxis: 'cols' })}
                            className="accent-[#2563EB]"
                          />
                          <span>Páginas de largura</span>
                        </label>
                        <label className="inline-flex items-center gap-2 cursor-pointer text-slate-800">
                          <input
                            type="radio"
                            name="sheetAxis"
                            checked={settings.sheetAxis === 'rows'}
                            onChange={() => onChangeSettings({ sheetAxis: 'rows' })}
                            className="accent-[#2563EB]"
                          />
                          <span>Páginas de altura</span>
                        </label>
                      </div>
                    </div>

                    <div>
                      <label className="block font-semibold text-slate-700 mb-1">
                        {settings.sheetAxis === 'cols'
                          ? 'Páginas de largura'
                          : 'Páginas de altura'}
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={20}
                        value={settings.sheetAxis === 'cols' ? settings.cols : settings.rows}
                        onChange={(e) => {
                          const v = Math.max(1, Math.min(20, Number(e.target.value) || 1));
                          if (settings.sheetAxis === 'cols') {
                            onChangeSettings({ cols: v });
                          } else {
                            onChangeSettings({ rows: v });
                          }
                        }}
                        className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                      />
                    </div>
                  </div>
                )}

                {settings.sizingMode === 'physical' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-slate-700">Unidade</span>
                      <div className="inline-flex p-0.5 bg-slate-100 rounded-md">
                        <button
                          type="button"
                          onClick={() => onChangeSettings({ physicalUnit: 'cm' })}
                          className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                            settings.physicalUnit === 'cm'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Centímetros (cm)
                        </button>
                        <button
                          type="button"
                          onClick={() => onChangeSettings({ physicalUnit: 'm' })}
                          className={`px-2.5 py-1 text-xs font-semibold rounded cursor-pointer ${
                            settings.physicalUnit === 'm'
                              ? 'bg-white text-slate-900 shadow-2xs'
                              : 'text-slate-600'
                          }`}
                        >
                          Metros (m)
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-[1fr_auto_1fr] items-end gap-2">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Largura ({settings.physicalUnit})
                        </label>
                        <input
                          type="number"
                          min={settings.physicalUnit === 'm' ? 0.1 : 5}
                          max={settings.physicalUnit === 'm' ? 6 : 600}
                          step={settings.physicalUnit === 'm' ? 0.05 : 0.5}
                          value={
                            settings.physicalUnit === 'm'
                              ? Number((settings.targetWidthCm / 100).toFixed(2))
                              : settings.targetWidthCm
                          }
                          onChange={(e) => {
                            const raw = Number(e.target.value) || 0;
                            handlePhysicalWidthChange(
                              settings.physicalUnit === 'm' ? raw * 100 : raw
                            );
                          }}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          onChangeSettings({ lockAspectRatio: !settings.lockAspectRatio })
                        }
                        className={`p-2 rounded-lg border transition-colors cursor-pointer ${
                          settings.lockAspectRatio
                            ? 'bg-slate-100 border-slate-300 text-slate-900'
                            : 'bg-white border-slate-200 text-slate-400'
                        }`}
                        title="Travar proporção"
                      >
                        {settings.lockAspectRatio ? (
                          <Lock className="w-3.5 h-3.5" />
                        ) : (
                          <Unlock className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Altura ({settings.physicalUnit})
                        </label>
                        <input
                          type="number"
                          min={settings.physicalUnit === 'm' ? 0.1 : 5}
                          max={settings.physicalUnit === 'm' ? 6 : 600}
                          step={settings.physicalUnit === 'm' ? 0.05 : 0.5}
                          disabled={settings.lockAspectRatio}
                          value={(() => {
                            const cm =
                              settings.lockAspectRatio && layout
                                ? layout.imgHMm / 10
                                : settings.targetHeightCm;
                            return settings.physicalUnit === 'm'
                              ? Number((cm / 100).toFixed(2))
                              : Number(cm.toFixed(1));
                          })()}
                          onChange={(e) => {
                            const raw = Number(e.target.value) || 0;
                            handlePhysicalHeightChange(
                              settings.physicalUnit === 'm' ? raw * 100 : raw
                            );
                          }}
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900 disabled:bg-slate-50 disabled:text-slate-500"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {settings.sizingMode === 'free_grid' && (
                  <div className="space-y-2.5 pt-1">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Colunas (largura)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={settings.cols}
                          onChange={(e) =>
                            onChangeSettings({
                              cols: Math.max(1, Math.min(15, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900"
                        />
                      </div>
                      <div>
                        <label className="block font-medium text-slate-600 mb-1">
                          Linhas (altura)
                        </label>
                        <input
                          type="number"
                          min={1}
                          max={15}
                          value={settings.rows}
                          onChange={(e) =>
                            onChangeSettings({
                              rows: Math.max(1, Math.min(15, Number(e.target.value) || 1)),
                            })
                          }
                          className="w-full border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm font-mono tabular-nums text-slate-900"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-4 gap-1.5">
                      {[
                        [2, 2],
                        [3, 3],
                        [3, 4],
                        [4, 3],
                      ].map(([c, r]) => {
                        const active = settings.cols === c && settings.rows === r;
                        return (
                          <button
                            key={`${c}x${r}`}
                            type="button"
                            onClick={() => onChangeSettings({ cols: c, rows: r })}
                            className={`py-1.5 text-xs font-mono tabular-nums font-medium rounded-md border transition-colors cursor-pointer ${
                              active
                                ? 'bg-[#0F172A] text-white border-[#0F172A]'
                                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                            }`}
                          >
                            {c}×{r}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {layout && (
                  <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs">
                    <span className="text-slate-600">Resultado:</span>
                    <span className="font-mono tabular-nums font-bold text-slate-900">
                      {layout.cols} × {layout.rows} ({layout.cols * layout.rows}{' '}
                      {layout.cols * layout.rows === 1 ? 'folha' : 'folhas'})
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 3. Papel */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('paper')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-full bg-[#2563EB] text-white flex items-center justify-center font-display text-xs font-bold shrink-0">
                  3
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Papel
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {getPaperSpecLabel(settings).shortLabel} · {settings.marginMm}mm ·{' '}
                    {settings.orientation === 'auto'
                      ? 'Auto'
                      : settings.orientation === 'portrait'
                      ? 'Retrato'
                      : 'Paisagem'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.paper ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.paper && (
              <div className="mt-4 space-y-3.5 text-xs">
                {/* Summary Bar */}
                <div className="px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg flex items-center gap-2 text-slate-700 font-medium tabular-nums">
                  <Ruler className="w-3.5 h-3.5 text-[#2563EB] shrink-0" />
                  <span className="truncate">
                    {getPaperSpecLabel(settings).shortLabel} ·{' '}
                    {getPaperSpecLabel(settings).dimsLabel} ·{' '}
                    {layout
                      ? layout.resolvedOrientation === 'portrait'
                        ? 'Retrato'
                        : 'Paisagem'
                      : 'Automática'}
                  </span>
                </div>

                {/* Tamanhos padrão vs Personalizado */}
                <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-lg">
                  <button
                    type="button"
                    onClick={() => {
                      if (settings.paperSize === 'CUSTOM') {
                        onChangeSettings({ paperSize: 'A4' });
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      settings.paperSize !== 'CUSTOM'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Tamanhos padrão
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeSettings({ paperSize: 'CUSTOM' })}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer ${
                      settings.paperSize === 'CUSTOM'
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    Personalizado
                  </button>
                </div>

                {settings.paperSize !== 'CUSTOM' ? (
                  <div className="space-y-2.5">
                    {/* Search input */}
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        value={paperSearch}
                        onChange={(e) => setPaperSearch(e.target.value)}
                        placeholder="Buscar tamanho (ex: A4, Carta...)"
                        className="w-full border border-slate-200 rounded-lg pl-8 pr-3 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#2563EB]/30"
                      />
                    </div>

                    {/* Paper Cards Grid */}
                    {(() => {
                      const q = paperSearch.trim().toLowerCase();
                      const filtered = q
                        ? PAPER_CATALOG.filter(
                            (p) =>
                              p.shortLabel.toLowerCase().includes(q) ||
                              p.name.toLowerCase().includes(q) ||
                              p.dimsLabel.toLowerCase().includes(q)
                          )
                        : showAllPapers
                        ? PAPER_CATALOG
                        : PAPER_CATALOG.filter((p) => p.featured);

                      return (
                        <>
                          <div className="grid grid-cols-3 gap-1.5 max-h-56 overflow-y-auto pr-0.5">
                            {filtered.map((p) => {
                              const active = settings.paperSize === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() =>
                                    onChangeSettings({ paperSize: p.id as PaperSize })
                                  }
                                  title={`${p.shortLabel} — ${p.dimsLabel}`}
                                  className={`p-2 rounded-lg border text-center transition-colors cursor-pointer ${
                                    active
                                      ? 'border-[#2563EB] bg-blue-50/70 text-[#1D4ED8]'
                                      : 'border-slate-200 bg-white text-slate-800 hover:bg-slate-50'
                                  }`}
                                >
                                  <div className="font-display text-xs font-bold truncate">
                                    {p.shortLabel}
                                  </div>
                                  <div className="text-[10px] font-mono tabular-nums text-slate-500 mt-0.5 truncate">
                                    {p.dimsLabel}
                                  </div>
                                </button>
                              );
                            })}
                          </div>

                          {!q && (
                            <button
                              type="button"
                              onClick={() => setShowAllPapers((v) => !v)}
                              className="w-full text-center text-xs font-semibold text-[#2563EB] hover:underline py-1 cursor-pointer"
                            >
                              {showAllPapers
                                ? 'Mostrar principais'
                                : `Ver todos os ${PAPER_CATALOG.length} tamanhos`}
                            </button>
                          )}
                        </>
                      );
                    })()}
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Largura da folha (mm)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={2000}
                        value={settings.customPaperWMm}
                        onChange={(e) =>
                          onChangeSettings({
                            customPaperWMm: Math.max(
                              50,
                              Math.min(2000, Number(e.target.value) || 210)
                            ),
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm font-mono tabular-nums"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Altura da folha (mm)
                      </label>
                      <input
                        type="number"
                        min={50}
                        max={2000}
                        value={settings.customPaperHMm}
                        onChange={(e) =>
                          onChangeSettings({
                            customPaperHMm: Math.max(
                              50,
                              Math.min(2000, Number(e.target.value) || 297)
                            ),
                          })
                        }
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-sm font-mono tabular-nums"
                      />
                    </div>
                  </div>
                )}

                {/* Margem (mm) */}
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Margem (mm)
                  </label>
                  <input
                    type="number"
                    min={0}
                    max={30}
                    value={settings.marginMm}
                    onChange={(e) =>
                      onChangeSettings({
                        marginMm: Math.max(0, Math.min(30, Number(e.target.value) || 0)),
                      })
                    }
                    className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm font-mono tabular-nums text-slate-900"
                  />
                </div>

                {/* Orientação */}
                <div>
                  <div className="font-semibold text-slate-700 mb-2">Orientação</div>
                  <div className="space-y-1.5">
                    {(
                      [
                        ['auto', 'Automática (melhor encaixe)'],
                        ['portrait', 'Retrato'],
                        ['landscape', 'Paisagem'],
                      ] as [Orientation, string][]
                    ).map(([val, label]) => (
                      <label
                        key={val}
                        className="flex items-center gap-2.5 cursor-pointer text-slate-800"
                      >
                        <input
                          type="radio"
                          name="paperOrientation"
                          checked={settings.orientation === val}
                          onChange={() => onChangeSettings({ orientation: val })}
                          className="accent-[#2563EB]"
                        />
                        <span>{label}</span>
                      </label>
                    ))}
                  </div>
                </div>

                <p className="text-[11px] text-slate-500 leading-snug pt-1 border-t border-slate-100">
                  Isto define o tamanho de cada folha impressa. Para o tamanho final do mural montado, use a etapa Divisão.
                </p>
              </div>
            )}
          </div>

          {/* 2. Cortes & Marcas */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('cuts')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Scissors className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Cortes &amp; Marcas
                  </div>
                  <div className="text-xs text-slate-500">
                    {settings.showCutMarks ? 'Padrão com guias' : 'Sem marcas'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.cuts ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.cuts && (
              <div className="mt-3.5 space-y-3 text-xs text-slate-700">
                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-600">Margem da impressora</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {settings.marginMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={20}
                    step={1}
                    value={settings.marginMm}
                    onChange={(e) =>
                      onChangeSettings({ marginMm: Number(e.target.value) })
                    }
                    className="w-full accent-[#E85D04]"
                  />
                </div>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showCutMarks}
                    onChange={(e) =>
                      onChangeSettings({ showCutMarks: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                  <span>Exibir marcas de corte nos cantos</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPageNumbers}
                    onChange={(e) =>
                      onChangeSettings({ showPageNumbers: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                  <span>Numerar folhas (L1 · C1)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.includeAssemblyMap}
                    onChange={(e) =>
                      onChangeSettings({ includeAssemblyMap: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                  <span>Incluir mapa de montagem (Página 1)</span>
                </label>

                <label className="flex items-center gap-2.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.skipBlankPages}
                    onChange={(e) =>
                      onChangeSettings({ skipBlankPages: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                  <span>Pular folhas totalmente em branco</span>
                </label>
              </div>
            )}
          </div>

          {/* 3. Sugestão FatiArt (Montagem Guiada) */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('guided')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Sugestão FatiArt (montagem guiada)
                  </div>
                  <div className="text-xs text-slate-500">
                    {settings.guidedAssembly ? 'Ativado (margem 10 mm)' : 'Desativado'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.guided ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.guided && (
              <div className="mt-3.5 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  Monte seu pôster com mais facilidade. Prepara tudo automaticamente e mostra onde cortar, como organizar as folhas e onde colar.
                </p>
                <label className="flex items-start gap-2.5 cursor-pointer font-medium text-slate-800">
                  <input
                    type="checkbox"
                    checked={settings.guidedAssembly}
                    onChange={toggleGuidedAssembly}
                    className="mt-0.5 rounded border-slate-300 accent-[#2563EB]"
                  />
                  <span>Ativar montagem guiada (margem de 10 mm)</span>
                </label>
                <p className="text-[11px] italic text-slate-500">
                  A margem passa para 10 mm: uma aba maior é mais fácil de dobrar, alinhar e colar.
                </p>
              </div>
            )}
          </div>

          {/* 4. Montagem Fácil (Sobreposição) */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('overlap')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Layers className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Montagem Fácil (Sobreposição)
                  </div>
                  <div className="text-xs text-slate-500 tabular-nums">
                    {settings.overlapMm > 0 ? `${settings.overlapMm} mm ativos` : 'Desativado'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.overlap ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.overlap && (
              <div className="mt-3.5 space-y-3 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={settings.overlapMm > 0}
                    onChange={(e) =>
                      onChangeSettings({ overlapMm: e.target.checked ? 10 : 0 })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                  <span>Adiciona área de sobreposição para colar as folhas</span>
                </label>

                <div>
                  <div className="flex justify-between mb-1">
                    <span className="font-medium text-slate-600">Largura da aba</span>
                    <span className="font-mono tabular-nums text-slate-800">
                      {settings.overlapMm} mm
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={25}
                    step={1}
                    value={settings.overlapMm}
                    onChange={(e) =>
                      onChangeSettings({ overlapMm: Number(e.target.value) })
                    }
                    className="w-full accent-[#E85D04]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* 5. Posicionamento Manual */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('manual')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Move className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Posicionamento Manual
                  </div>
                  <div className="text-xs text-slate-500">
                    {settings.manualPositioning ? 'Ativado (arraste na grade)' : 'Desativado'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.manual ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.manual && (
              <div className="mt-3.5 space-y-3 text-xs">
                <label className="flex items-center gap-2.5 cursor-pointer text-slate-700">
                  <input
                    type="checkbox"
                    checked={settings.manualPositioning}
                    onChange={(e) =>
                      onChangeSettings({ manualPositioning: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#2563EB]"
                  />
                  <span>Arraste a imagem para escolher o enquadramento</span>
                </label>

                {settings.manualPositioning && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-slate-700">Escala da imagem</span>
                        <span className="font-mono tabular-nums text-slate-800">
                          {Math.round(settings.imageScale * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={50}
                        max={200}
                        step={5}
                        value={Math.round(settings.imageScale * 100)}
                        onChange={(e) =>
                          onChangeSettings({ imageScale: Number(e.target.value) / 100 })
                        }
                        className="w-full accent-[#2563EB]"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeSettings({
                          imageOffsetXMm: 0,
                          imageOffsetYMm: 0,
                          imageScale: 1,
                        })
                      }
                      className="w-full py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-md cursor-pointer"
                    >
                      Centralizar enquadramento
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 6. Efeito Retícula (Economia de Tinta) - PRO LIBERADO */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('reticle')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-amber-50 border border-amber-200/70 flex items-center justify-center text-amber-700 shrink-0">
                  <Droplets className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5 font-display text-sm font-bold text-slate-900">
                    <span>Efeito Retícula (Economia de Tinta)</span>
                  </div>
                  <div className="text-xs text-slate-500 flex items-center gap-1.5">
                    <Crown className="w-3 h-3 text-amber-600" />
                    <span>
                      Pro Liberado ·{' '}
                      {filters.reticleEnabled
                        ? `Economia ~${filters.reticleInkSaving}%`
                        : 'Desativado'}
                    </span>
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.reticle ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.reticle && (
              <div className="mt-3.5 p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-3 text-xs">
                <label className="flex items-center justify-between gap-2 cursor-pointer font-semibold text-slate-800">
                  <span>Ativar retícula econômica</span>
                  <input
                    type="checkbox"
                    checked={filters.reticleEnabled}
                    onChange={(e) =>
                      onChangeFilters({ reticleEnabled: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                </label>

                {filters.reticleEnabled && (
                  <div className="space-y-2.5 pt-1 border-t border-slate-200">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-slate-700">Economia de tinta</span>
                        <span className="font-mono tabular-nums text-emerald-700 font-semibold">
                          ~{filters.reticleInkSaving}% menos tinta
                        </span>
                      </div>
                      <input
                        type="range"
                        min={20}
                        max={65}
                        step={5}
                        value={filters.reticleInkSaving}
                        onChange={(e) =>
                          onChangeFilters({ reticleInkSaving: Number(e.target.value) })
                        }
                        className="w-full accent-[#E85D04]"
                      />
                    </div>

                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-slate-700">Tamanho dos pontos</span>
                        <span className="font-mono tabular-nums text-slate-800">
                          {filters.reticleCellSize} px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={4}
                        max={14}
                        step={1}
                        value={filters.reticleCellSize}
                        onChange={(e) =>
                          onChangeFilters({ reticleCellSize: Number(e.target.value) })
                        }
                        className="w-full accent-[#E85D04]"
                      />
                    </div>

                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.reticleMonochrome}
                        onChange={(e) =>
                          onChangeFilters({ reticleMonochrome: e.target.checked })
                        }
                        className="rounded border-slate-300 accent-[#E85D04]"
                      />
                      <span>Retícula monocromática (tinta preta)</span>
                    </label>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 7. Sua Marca d'água */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('watermark')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <Stamp className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Sua marca d&apos;água
                  </div>
                  <div className="text-xs text-slate-500">
                    {filters.watermarkEnabled ? filters.watermarkText || 'Ativa' : 'Desativado'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.watermark ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.watermark && (
              <div className="mt-3.5 space-y-3 text-xs">
                <label className="flex items-center justify-between gap-2 cursor-pointer font-medium text-slate-800">
                  <span>Ativar marca d&apos;água sobre o pôster</span>
                  <input
                    type="checkbox"
                    checked={filters.watermarkEnabled}
                    onChange={(e) =>
                      onChangeFilters({ watermarkEnabled: e.target.checked })
                    }
                    className="rounded border-slate-300 accent-[#E85D04]"
                  />
                </label>

                {filters.watermarkEnabled && (
                  <div className="space-y-2.5 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                    <div>
                      <label className="block font-medium text-slate-700 mb-1">
                        Texto da marca d&apos;água
                      </label>
                      <input
                        type="text"
                        value={filters.watermarkText}
                        onChange={(e) =>
                          onChangeFilters({ watermarkText: e.target.value })
                        }
                        placeholder="Ex.: @seuestudio"
                        className="w-full bg-white border border-slate-200 rounded-md px-2.5 py-1.5 text-xs text-slate-900"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-medium text-slate-700 mb-1">
                          Posição
                        </label>
                        <select
                          value={filters.watermarkLayout}
                          onChange={(e) =>
                            onChangeFilters({
                              watermarkLayout: e.target.value as WatermarkLayout,
                            })
                          }
                          className="w-full bg-white border border-slate-200 rounded-md px-2 py-1.5 text-xs"
                        >
                          <option value="tiled">Mosaico diagonal</option>
                          <option value="center">Centro</option>
                          <option value="bottom-right">Canto inferior</option>
                        </select>
                      </div>
                      <div>
                        <div className="flex justify-between mb-1">
                          <span className="font-medium text-slate-700">Opacidade</span>
                          <span className="font-mono tabular-nums">
                            {filters.watermarkOpacity}%
                          </span>
                        </div>
                        <input
                          type="range"
                          min={10}
                          max={80}
                          value={filters.watermarkOpacity}
                          onChange={(e) =>
                            onChangeFilters({
                              watermarkOpacity: Number(e.target.value),
                            })
                          }
                          className="w-full accent-[#E85D04] mt-1.5"
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 8. Correção de Cor, Ajuste Fino, Folha de Teste & Meus Perfis */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('color')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-blue-50 border border-blue-200/70 flex items-center justify-center text-[#2563EB] shrink-0">
                  <Palette className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Correção de Cor &amp; Ajuste Fino
                  </div>
                  <div className="text-xs text-slate-500">
                    {activeColorProfile.title}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.color ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.color && (
              <div className="mt-3.5 space-y-4 text-xs">
                <p className="text-slate-600 leading-relaxed">
                  O papel absorve tinta e deixa as cores mais foscas do que na tela. Escolha o papel para compensar automaticamente:
                </p>

                {/* Paper Absorption Profiles */}
                <div className="grid grid-cols-2 gap-2">
                  {PAPER_COLOR_PROFILES.map((profile) => {
                    const selected = filters.paperColorProfile === profile.id;
                    return (
                      <button
                        key={profile.id}
                        type="button"
                        onClick={() =>
                          onChangeFilters({ paperColorProfile: profile.id })
                        }
                        className={`p-2.5 rounded-lg border text-left transition-colors cursor-pointer ${
                          selected
                            ? 'border-[#2563EB] bg-blue-50/50'
                            : 'border-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <span
                            className="w-4 h-4 rounded border border-slate-300 shrink-0"
                            style={{ backgroundColor: profile.swatchColor }}
                          />
                          <span className="font-semibold text-slate-900 leading-tight">
                            {profile.title}
                          </span>
                        </div>
                        <p className="text-[11px] text-slate-500 leading-snug">
                          {profile.description}
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Ajuste Fino Sliders */}
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-slate-800">Ajuste fino</span>
                    <button
                      type="button"
                      onClick={() =>
                        onChangeFilters({
                          saturation: 0,
                          contrast: 0,
                          brightness: 0,
                          temperature: 0,
                          paperColorProfile: 'none',
                        })
                      }
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-500 hover:text-slate-900 cursor-pointer"
                    >
                      <RotateCcw className="w-3 h-3" />
                      Zerar
                    </button>
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-700">Saturação</span>
                      <span className="font-mono tabular-nums text-[#2563EB] font-semibold">
                        {filters.saturation}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      value={filters.saturation}
                      onChange={(e) =>
                        onChangeFilters({ saturation: Number(e.target.value) })
                      }
                      className="w-full accent-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-700">Contraste</span>
                      <span className="font-mono tabular-nums text-[#2563EB] font-semibold">
                        {filters.contrast}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-60}
                      max={80}
                      value={filters.contrast}
                      onChange={(e) =>
                        onChangeFilters({ contrast: Number(e.target.value) })
                      }
                      className="w-full accent-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-700">Brilho (gamma)</span>
                      <span className="font-mono tabular-nums text-[#2563EB] font-semibold">
                        {(filters.brightness / 100).toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-60}
                      max={60}
                      value={filters.brightness}
                      onChange={(e) =>
                        onChangeFilters({ brightness: Number(e.target.value) })
                      }
                      className="w-full accent-[#2563EB]"
                    />
                  </div>

                  <div>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-slate-700">Temperatura</span>
                      <span className="font-mono tabular-nums text-[#2563EB] font-semibold">
                        {filters.temperature}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={filters.temperature}
                      onChange={(e) =>
                        onChangeFilters({ temperature: Number(e.target.value) })
                      }
                      className="w-full accent-[#2563EB]"
                    />
                    <p className="text-[11px] text-slate-500 mt-1">
                      Temperatura negativa deixa mais fria (azulada); positiva deixa mais quente (amarelada).
                    </p>
                  </div>
                </div>

                {/* Baixar folha de teste (A4) */}
                <button
                  type="button"
                  disabled={!processedCanvas}
                  onClick={() =>
                    processedCanvas &&
                    generateCalibrationTestPdf(processedCanvas, filters, activeImageName)
                  }
                  className="w-full inline-flex items-center justify-center gap-2 px-3 py-2 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40"
                >
                  <FileDown className="w-3.5 h-3.5" />
                  <span>Baixar folha de teste (A4)</span>
                </button>

                {/* Meus Perfis de Calibração (LocalStorage - sem login) */}
                <div className="pt-2 border-t border-slate-200 space-y-2">
                  <div className="font-semibold text-slate-800">
                    Meus Perfis de Calibração
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={newProfileName}
                      onChange={(e) => setNewProfileName(e.target.value)}
                      placeholder="Nome (ex.: Epson Sulfite)"
                      className="flex-1 border border-slate-200 rounded-md px-2.5 py-1.5 text-xs"
                    />
                    <button
                      type="button"
                      disabled={!newProfileName.trim()}
                      onClick={handleSaveCalibrationProfile}
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold text-white bg-[#0F172A] hover:bg-slate-800 disabled:bg-slate-300 rounded-md cursor-pointer"
                    >
                      <BookmarkPlus className="w-3.5 h-3.5" />
                      Salvar
                    </button>
                  </div>

                  {savedProfiles.length === 0 ? (
                    <p className="text-[11px] text-slate-500">
                      Salve combinações de papel e ajuste fino para reutilizar na sua impressora.
                    </p>
                  ) : (
                    <div className="space-y-1.5">
                      {savedProfiles.map((prof) => (
                        <div
                          key={prof.id}
                          className="flex items-center justify-between gap-2 px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-md"
                        >
                          <button
                            type="button"
                            onClick={() => applyCalibrationProfile(prof)}
                            className="text-left flex-1 truncate font-medium text-slate-800 hover:text-[#2563EB] cursor-pointer"
                          >
                            {prof.name}
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setSavedProfiles((prev) =>
                                prev.filter((p) => p.id !== prof.id)
                              )
                            }
                            className="text-slate-400 hover:text-rose-600 cursor-pointer"
                            aria-label={`Remover perfil ${prof.name}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 9. Modo Stencil & Transformações */}
          <div className="p-4">
            <button
              type="button"
              onClick={() => toggleSection('stencil')}
              className="w-full flex items-center justify-between gap-3 text-left cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
                  <SlidersHorizontal className="w-4 h-4" />
                </div>
                <div>
                  <div className="font-display text-sm font-bold text-slate-900">
                    Modo Stencil &amp; Rotação
                  </div>
                  <div className="text-xs text-slate-500">
                    {filters.stencilMode
                      ? 'Stencil ativo'
                      : filters.grayscale
                      ? 'Preto & Branco'
                      : 'Original'}
                  </div>
                </div>
              </div>
              <ChevronDown
                className={`w-4 h-4 text-slate-400 transition-transform ${
                  openSections.stencil ? 'rotate-180' : ''
                }`}
              />
            </button>

            {openSections.stencil && (
              <div className="mt-3.5 space-y-3 text-xs">
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilters({
                        rotation: ((filters.rotation + 90) % 360) as ImageFilters['rotation'],
                      })
                    }
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-2 font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer"
                  >
                    <RotateCw className="w-3.5 h-3.5" />
                    Girar 90°
                  </button>
                  <button
                    type="button"
                    onClick={() => onChangeFilters({ mirrorX: !filters.mirrorX })}
                    className={`inline-flex items-center justify-center gap-1.5 px-3 py-2 font-medium rounded-lg border cursor-pointer ${
                      filters.mirrorX
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                    Espelhar
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilters({
                        stencilMode: !filters.stencilMode,
                        grayscale: false,
                      })
                    }
                    className={`px-3 py-2 font-semibold rounded-lg border cursor-pointer ${
                      filters.stencilMode
                        ? 'bg-[#E85D04] text-white border-[#E85D04]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Modo Stencil
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      onChangeFilters({
                        grayscale: !filters.grayscale,
                        stencilMode: false,
                      })
                    }
                    className={`px-3 py-2 font-medium rounded-lg border cursor-pointer ${
                      filters.grayscale && !filters.stencilMode
                        ? 'bg-[#0F172A] text-white border-[#0F172A]'
                        : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    Preto &amp; Branco
                  </button>
                </div>

                {filters.stencilMode && (
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
                    <div>
                      <div className="flex justify-between mb-1">
                        <span className="font-medium text-slate-700">Limiar do Traço</span>
                        <span className="font-mono tabular-nums text-slate-800">
                          {filters.stencilThreshold}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={30}
                        max={230}
                        value={filters.stencilThreshold}
                        onChange={(e) =>
                          onChangeFilters({ stencilThreshold: Number(e.target.value) })
                        }
                        className="w-full accent-[#E85D04]"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={filters.invert}
                        onChange={(e) => onChangeFilters({ invert: e.target.checked })}
                        className="rounded border-slate-300 accent-[#E85D04]"
                      />
                      <span>Inverter preto e branco</span>
                    </label>
                  </div>
                )}

                <button
                  type="button"
                  onClick={onResetFilters}
                  className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <RotateCcw className="w-3 h-3" />
                  Resetar todos os filtros
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Summary & Primary Download CTA */}
        <div className="p-4 border-t border-slate-200 space-y-3 bg-slate-50/50">
          {layout && dpiInfo && (
            <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-1.5 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Tamanho final da arte</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {(layout.imgWMm / 10).toFixed(1)} × {(layout.imgHMm / 10).toFixed(1)} cm
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Folhas para imprimir</span>
                <span className="font-mono tabular-nums font-semibold text-slate-900">
                  {activeSheetCount}{' '}
                  {activeSheetCount === 1 ? 'folha' : 'folhas'}{' '}
                  {getPaperSpecLabel(settings).shortLabel} (
                  {layout.resolvedOrientation === 'portrait' ? 'Retrato' : 'Paisagem'})
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-slate-600">Nitidez estimada</span>
                <span
                  className={`font-medium tabular-nums ${
                    dpiInfo.tone === 'emerald'
                      ? 'text-emerald-700'
                      : dpiInfo.tone === 'amber'
                      ? 'text-amber-700'
                      : 'text-rose-700'
                  }`}
                >
                  {dpiInfo.label} ({dpiInfo.detail})
                </span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <button
              type="button"
              disabled={!layout || !processedCanvas}
              onClick={() => setIsPdfPreviewOpen(true)}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-800 bg-white border border-slate-300 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer"
            >
              <Eye className="w-4 h-4" />
              <span>Visualizar PDF antes de baixar</span>
            </button>

            <button
              type="button"
              disabled={!layout || isExporting}
              onClick={onDownloadPdf}
              className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#E85D04] hover:bg-[#D44E00] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors cursor-pointer shadow-xs"
            >
              <Download className="w-4 h-4" />
              <span>
                {isExporting
                  ? 'Gerando arquivo PDF...'
                  : 'Baixar PDF Pronto para Imprimir'}
              </span>
            </button>
          </div>

          {exportSuccessMsg && (
            <div className="flex items-start gap-2 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 rounded-lg p-2.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
              <span>{exportSuccessMsg}</span>
            </div>
          )}
        </div>
      </aside>

      <TilePreviewModal
        tile={inspectedTile}
        layout={layout!}
        settings={settings}
        processedCanvas={processedCanvas}
        onClose={() => setInspectedTile(null)}
        onSelectTile={(tile) => setInspectedTile(tile)}
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
