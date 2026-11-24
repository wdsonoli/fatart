import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Grid, PenTool, Ruler } from 'lucide-react';
import { CanvasCreator } from './components/CanvasCreator';
import { GuideSections } from './components/GuideSections';
import { SliceWorkspace } from './components/SliceWorkspace';
import { TopBar } from './components/TopBar';
import { VisualSizingWorkspace } from './components/VisualSizingWorkspace';
import {
  ImageFilters,
  PosterSettings,
  SampleArtwork,
} from './types/poster';
import {
  DEFAULT_FILTERS,
  hasActiveImageFilters,
  loadImageElement,
  renderProcessedCanvas,
} from './utils/imageProcessing';
import { generatePosterPdf } from './utils/pdfGenerator';
import { calculatePosterLayout } from './utils/posterMath';

const SAMPLES: SampleArtwork[] = [
  {
    id: 'botanical',
    title: 'Botânico',
    category: 'Pôster Decorativo',
    src: '/src/assets/images/sample_botanical_poster_1794916641767.jpg',
    recommendedSettings: {
      sizingMode: 'proportional_sheets',
      sheetAxis: 'cols',
      cols: 2,
      rows: 2,
      paperSize: 'A4',
      orientation: 'portrait',
    },
  },
  {
    id: 'stencil',
    title: 'Stencil Tatuagem',
    category: 'Tatuagem & Transfer',
    src: '/src/assets/images/sample_tattoo_stencil_1794916642482.jpg',
    recommendedSettings: {
      sizingMode: 'proportional_sheets',
      sheetAxis: 'cols',
      cols: 2,
      rows: 2,
      paperSize: 'A4',
      orientation: 'auto',
    },
    recommendedFilters: {
      stencilMode: true,
      stencilThreshold: 150,
    },
  },
  {
    id: 'mural',
    title: 'Mural Solar',
    category: 'Mural Escolar',
    src: '/src/assets/images/sample_school_mural_1794916642629.jpg',
    recommendedSettings: {
      sizingMode: 'free_grid',
      cols: 3,
      rows: 2,
      paperSize: 'A4',
      orientation: 'landscape',
    },
  },
];

const INITIAL_SETTINGS: PosterSettings = {
  paperSize: 'A4',
  customPaperWMm: 210,
  customPaperHMm: 297,
  orientation: 'auto',
  sizingMode: 'proportional_sheets',
  sheetAxis: 'cols',
  cols: 2,
  rows: 2,
  targetWidthCm: 60,
  targetHeightCm: 80,
  physicalUnit: 'cm',
  lockAspectRatio: true,
  marginMm: 5,
  overlapMm: 10,
  guidedAssembly: false,
  manualPositioning: false,
  imageOffsetXMm: 0,
  imageOffsetYMm: 0,
  imageScale: 1,
  showCutMarks: true,
  showPageNumbers: true,
  includeAssemblyMap: true,
  skipBlankPages: true,
  panelShape: 'rect',
  roundDiameterCm: 50,
};

export default function App() {
  const [workspaceMode, setWorkspaceMode] = useState<'slicer' | 'visual' | 'creator'>('slicer');
  const [activeImageSrc, setActiveImageSrc] = useState<string>(SAMPLES[0].src);
  const [activeImageName, setActiveImageName] = useState<string>(SAMPLES[0].title);
  const [loadedImageEl, setLoadedImageEl] = useState<HTMLImageElement | null>(null);
  const [isLoadingImage, setIsLoadingImage] = useState<boolean>(true);
  const [imageError, setImageError] = useState<string | null>(null);

  const [settings, setSettings] = useState<PosterSettings>(INITIAL_SETTINGS);
  const [filters, setFilters] = useState<ImageFilters>(DEFAULT_FILTERS);

  const [isExporting, setIsExporting] = useState(false);
  const [exportSuccessMsg, setExportSuccessMsg] = useState<string | null>(null);
  const uploadedObjectUrlRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (uploadedObjectUrlRef.current) {
        URL.revokeObjectURL(uploadedObjectUrlRef.current);
      }
    };
  }, []);

  // Load current source image whenever activeImageSrc changes
  useEffect(() => {
    let cancelled = false;
    setIsLoadingImage(true);
    setImageError(null);

    loadImageElement(activeImageSrc)
      .then((img) => {
        if (cancelled) return;
        setLoadedImageEl(img);
        setIsLoadingImage(false);
      })
      .catch(() => {
        if (cancelled) return;
        setImageError('Não foi possível carregar esta imagem. Tente outro arquivo.');
        setIsLoadingImage(false);
      });

    return () => {
      cancelled = true;
    };
  }, [activeImageSrc]);

  const hasActiveFilters = useMemo(
    () => hasActiveImageFilters(filters),
    [filters]
  );

  // Apply pixel & orientation filters
  const processedCanvas = useMemo(() => {
    if (!loadedImageEl) return null;
    return renderProcessedCanvas(loadedImageEl, filters, 2800);
  }, [loadedImageEl, filters]);

  // Compute physical layout & tile grid
  const layout = useMemo(() => {
    if (!processedCanvas) return null;
    return calculatePosterLayout(
      processedCanvas.width,
      processedCanvas.height,
      settings
    );
  }, [processedCanvas, settings]);

  const handleChangeSettings = useCallback((patch: Partial<PosterSettings>) => {
    setExportSuccessMsg(null);
    setSettings((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleChangeFilters = useCallback((patch: Partial<ImageFilters>) => {
    setExportSuccessMsg(null);
    setFilters((prev) => ({ ...prev, ...patch }));
  }, []);

  const handleResetFilters = useCallback(() => {
    setFilters(DEFAULT_FILTERS);
  }, []);

  const handleUploadFile = useCallback((file: File) => {
    setExportSuccessMsg(null);
    setImageError(null);
    const cleanName = file.name.replace(/\.[^.]+$/, '') || 'Imagem enviada';

    const applyUploadedSrc = (src: string) => {
      setActiveImageSrc(src);
      setActiveImageName(cleanName);
      setFilters(DEFAULT_FILTERS);
      setSettings((prev) => ({
        ...prev,
        manualPositioning: false,
        imageScale: 1,
        imageOffsetXMm: 0,
        imageOffsetYMm: 0,
      }));
    };

    try {
      const nextUrl = URL.createObjectURL(file);
      const prevUrl = uploadedObjectUrlRef.current;
      uploadedObjectUrlRef.current = nextUrl;
      applyUploadedSrc(nextUrl);
      if (prevUrl) {
        setTimeout(() => URL.revokeObjectURL(prevUrl), 2000);
      }
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          applyUploadedSrc(reader.result);
        }
      };
      reader.readAsDataURL(file);
    }
  }, []);

  const handleSelectSample = useCallback((sample: SampleArtwork) => {
    setExportSuccessMsg(null);
    setActiveImageSrc(sample.src);
    setActiveImageName(sample.title);
    setFilters({ ...DEFAULT_FILTERS, ...(sample.recommendedFilters || {}) });
    if (sample.recommendedSettings) {
      setSettings((prev) => ({
        ...prev,
        ...sample.recommendedSettings,
        manualPositioning: false,
        imageScale: 1,
        imageOffsetXMm: 0,
        imageOffsetYMm: 0,
      }));
    }
  }, []);

  const handleLoadSamplePreset = useCallback(
    (sampleId: string, stencilOverride?: boolean) => {
      const sample = SAMPLES.find((s) => s.id === sampleId);
      if (!sample) return;
      setWorkspaceMode('slicer');
      setActiveImageSrc(sample.src);
      setActiveImageName(sample.title);
      setFilters({
        ...DEFAULT_FILTERS,
        ...(sample.recommendedFilters || {}),
        ...(stencilOverride !== undefined ? { stencilMode: stencilOverride } : {}),
      });
      if (sample.recommendedSettings) {
        setSettings((prev) => ({ ...prev, ...sample.recommendedSettings }));
      }
      document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' });
    },
    []
  );

  const handleSendFromCreator = useCallback((dataUrl: string, title: string) => {
    setExportSuccessMsg(null);
    setActiveImageSrc(dataUrl);
    setActiveImageName(title);
    setFilters(DEFAULT_FILTERS);
    setWorkspaceMode('slicer');
    document.getElementById('workspace')?.scrollIntoView({ behavior: 'smooth' });
  }, []);

  const handleDownloadPdf = useCallback(async () => {
    if (!processedCanvas || !layout) {
      if (workspaceMode === 'creator') {
        setWorkspaceMode('slicer');
      }
      return;
    }
    setIsExporting(true);
    setExportSuccessMsg(null);
    try {
      const res = await generatePosterPdf(
        processedCanvas,
        layout,
        settings,
        activeImageName
      );
      setExportSuccessMsg(
        `PDF baixado com sucesso (${res.exportedPages} páginas${
          res.skippedBlankPages > 0
            ? `, ${res.skippedBlankPages} folhas em branco puladas`
            : ''
        }).`
      );
    } finally {
      setIsExporting(false);
    }
  }, [processedCanvas, layout, settings, activeImageName, workspaceMode]);

  const handleNavigateSection = useCallback(
    (sectionId: string, switchMode?: 'slicer' | 'visual' | 'creator') => {
      if (switchMode) {
        setWorkspaceMode(switchMode);
      }
      setTimeout(() => {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth' });
      }, 20);
    },
    []
  );

  return (
    <div className="min-h-screen flex flex-col bg-[#F6F7F9] text-slate-900">
      <TopBar
        onDownloadPdf={handleDownloadPdf}
        isExporting={isExporting}
        canExport={Boolean(processedCanvas && layout)}
        onNavigateSection={handleNavigateSection}
      />

      <main className="flex-1 max-w-[1440px] w-full mx-auto px-4 sm:px-6 lg:px-8 pt-8">
        {/* Compact Studio Hero + Mode Switch */}
        <section id="workspace" className="scroll-mt-20">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4 mb-6">
            <div className="max-w-2xl">
              <h1 className="font-display text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-slate-900 text-balance">
                Divida qualquer imagem em múltiplas folhas A4 para imprimir pôsteres gigantes
              </h1>
              <p className="text-slate-600 text-sm sm:text-base mt-2">
                Configure a grade ou medidas em centímetros, adicione faixas de sobreposição e gere um PDF pronto para recortar e montar.
              </p>
            </div>

            {/* Workspace Mode Switcher */}
            <div className="inline-flex items-center p-1 bg-slate-200/80 rounded-lg self-start lg:self-end shrink-0">
              <button
                type="button"
                onClick={() => setWorkspaceMode('slicer')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  workspaceMode === 'slicer'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Grid className="w-4 h-4" />
                Fatiar Imagem
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('visual')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  workspaceMode === 'visual'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Ruler className="w-4 h-4" />
                Ajuste Visual
              </button>
              <button
                type="button"
                onClick={() => setWorkspaceMode('creator')}
                className={`inline-flex items-center gap-2 px-4 py-2 text-xs sm:text-sm font-semibold rounded-md transition-colors whitespace-nowrap cursor-pointer ${
                  workspaceMode === 'creator'
                    ? 'bg-white text-slate-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <PenTool className="w-4 h-4" />
                Editor do Zero
              </button>
            </div>
          </div>

          {imageError && (
            <div className="mb-4 px-4 py-3 text-sm text-rose-800 bg-rose-50 border border-rose-200 rounded-lg">
              {imageError}
            </div>
          )}

          {workspaceMode === 'slicer' ? (
            <SliceWorkspace
              samples={SAMPLES}
              activeImageSrc={activeImageSrc}
              activeImageName={activeImageName}
              hasActiveFilters={hasActiveFilters}
              processedCanvas={processedCanvas}
              layout={layout}
              settings={settings}
              filters={filters}
              isLoadingImage={isLoadingImage}
              isExporting={isExporting}
              exportSuccessMsg={exportSuccessMsg}
              onUploadFile={handleUploadFile}
              onSelectSample={handleSelectSample}
              onChangeSettings={handleChangeSettings}
              onChangeFilters={handleChangeFilters}
              onResetFilters={handleResetFilters}
              onDownloadPdf={handleDownloadPdf}
            />
          ) : workspaceMode === 'visual' ? (
            <VisualSizingWorkspace
              samples={SAMPLES}
              activeImageSrc={activeImageSrc}
              activeImageName={activeImageName}
              hasActiveFilters={hasActiveFilters}
              processedCanvas={processedCanvas}
              layout={layout}
              settings={settings}
              isLoadingImage={isLoadingImage}
              isExporting={isExporting}
              exportSuccessMsg={exportSuccessMsg}
              onUploadFile={handleUploadFile}
              onSelectSample={handleSelectSample}
              onChangeSettings={handleChangeSettings}
              onDownloadPdf={handleDownloadPdf}
            />
          ) : (
            <CanvasCreator onSendToSlicer={handleSendFromCreator} />
          )}
        </section>

        <GuideSections
          samples={SAMPLES}
          onLoadSamplePreset={handleLoadSamplePreset}
        />
      </main>
    </div>
  );
}
