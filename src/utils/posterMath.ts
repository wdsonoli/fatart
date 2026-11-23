import {
  PaperSize,
  PosterLayout,
  PosterSettings,
  TileSlice,
} from '../types/poster';

export interface PaperSpec {
  id: Exclude<PaperSize, 'CUSTOM'>;
  width: number; // mm (portrait)
  height: number; // mm (portrait)
  shortLabel: string;
  dimsLabel: string;
  name: string;
  featured?: boolean;
}

export const PAPER_CATALOG: PaperSpec[] = [
  { id: 'A5', width: 148, height: 210, shortLabel: 'A5', dimsLabel: '148×210 mm', name: 'A5 (148 × 210 mm)', featured: true },
  { id: 'A4', width: 210, height: 297, shortLabel: 'A4', dimsLabel: '210×297 mm', name: 'A4 (210 × 297 mm)', featured: true },
  { id: 'A3', width: 297, height: 420, shortLabel: 'A3', dimsLabel: '297×420 mm', name: 'A3 (297 × 420 mm)', featured: true },
  { id: 'A2', width: 420, height: 594, shortLabel: 'A2', dimsLabel: '420×594 mm', name: 'A2 (420 × 594 mm)', featured: true },
  { id: 'LETTER', width: 215.9, height: 279.4, shortLabel: 'Carta', dimsLabel: '216×279 mm', name: 'Carta / Letter (216 × 279 mm)', featured: true },
  { id: 'LEGAL', width: 215.9, height: 355.6, shortLabel: 'Ofício', dimsLabel: '216×356 mm', name: 'Ofício / Legal (216 × 356 mm)', featured: true },
  { id: 'A1', width: 594, height: 841, shortLabel: 'A1', dimsLabel: '594×841 mm', name: 'A1 (594 × 841 mm)' },
  { id: 'A0', width: 841, height: 1189, shortLabel: 'A0', dimsLabel: '841×1189 mm', name: 'A0 (841 × 1189 mm)' },
  { id: 'A6', width: 105, height: 148, shortLabel: 'A6', dimsLabel: '105×148 mm', name: 'A6 (105 × 148 mm)' },
  { id: 'B2', width: 500, height: 707, shortLabel: 'B2', dimsLabel: '500×707 mm', name: 'B2 (500 × 707 mm)' },
  { id: 'B3', width: 353, height: 500, shortLabel: 'B3', dimsLabel: '353×500 mm', name: 'B3 (353 × 500 mm)' },
  { id: 'B4', width: 250, height: 353, shortLabel: 'B4', dimsLabel: '250×353 mm', name: 'B4 (250 × 353 mm)' },
  { id: 'B5', width: 176, height: 250, shortLabel: 'B5', dimsLabel: '176×250 mm', name: 'B5 (176 × 250 mm)' },
  { id: 'TABLOID', width: 279.4, height: 431.8, shortLabel: 'Tablóide', dimsLabel: '279×432 mm', name: 'Tablóide / Ledger (279 × 432 mm)' },
  { id: 'EXECUTIVE', width: 184.2, height: 266.7, shortLabel: 'Executivo', dimsLabel: '184×267 mm', name: 'Executivo (184 × 267 mm)' },
  { id: 'HALF_LETTER', width: 139.7, height: 215.9, shortLabel: 'Meia Carta', dimsLabel: '140×216 mm', name: 'Meia Carta (140 × 216 mm)' },
  { id: 'PHOTO_10X15', width: 100, height: 150, shortLabel: '10×15 cm', dimsLabel: '100×150 mm', name: 'Foto 10×15 cm' },
  { id: 'PHOTO_13X18', width: 130, height: 180, shortLabel: '13×18 cm', dimsLabel: '130×180 mm', name: 'Foto 13×18 cm' },
  { id: 'PHOTO_15X21', width: 150, height: 210, shortLabel: '15×21 cm', dimsLabel: '150×210 mm', name: 'Foto 15×21 cm' },
  { id: 'PHOTO_20X25', width: 203, height: 254, shortLabel: '20×25 cm', dimsLabel: '203×254 mm', name: 'Foto 20×25 cm' },
  { id: 'PHOTO_20X30', width: 200, height: 300, shortLabel: '20×30 cm', dimsLabel: '200×300 mm', name: 'Foto 20×30 cm' },
  { id: 'SQ_20X20', width: 200, height: 200, shortLabel: '20×20 cm', dimsLabel: '200×200 mm', name: 'Quadrado 20×20 cm' },
  { id: 'SQ_30X30', width: 300, height: 300, shortLabel: '30×30 cm', dimsLabel: '300×300 mm', name: 'Quadrado 30×30 cm' },
];

export function getPaperSpecLabel(settings: PosterSettings): {
  shortLabel: string;
  dimsLabel: string;
  fullLabel: string;
} {
  if (settings.paperSize === 'CUSTOM') {
    const w = Math.max(30, settings.customPaperWMm || 210);
    const h = Math.max(30, settings.customPaperHMm || 297);
    const dimsLabel = `${Math.round(w)}×${Math.round(h)} mm`;
    return {
      shortLabel: 'Personalizado',
      dimsLabel,
      fullLabel: `Personalizado (${Math.round(w)} × ${Math.round(h)} mm)`,
    };
  }
  const found =
    PAPER_CATALOG.find((p) => p.id === settings.paperSize) || PAPER_CATALOG[1];
  return {
    shortLabel: found.shortLabel,
    dimsLabel: found.dimsLabel,
    fullLabel: found.name,
  };
}

export function getPageDimensions(
  settings: Pick<PosterSettings, 'paperSize' | 'customPaperWMm' | 'customPaperHMm'>,
  orientation: 'portrait' | 'landscape'
): { pageWMm: number; pageHMm: number } {
  let baseW: number;
  let baseH: number;
  if (settings.paperSize === 'CUSTOM') {
    const w = Math.max(30, Math.min(2000, settings.customPaperWMm || 210));
    const h = Math.max(30, Math.min(2000, settings.customPaperHMm || 297));
    baseW = Math.min(w, h);
    baseH = Math.max(w, h);
  } else {
    const found =
      PAPER_CATALOG.find((p) => p.id === settings.paperSize) || PAPER_CATALOG[1];
    baseW = found.width;
    baseH = found.height;
  }

  if (orientation === 'landscape') {
    return { pageWMm: baseH, pageHMm: baseW };
  }
  return { pageWMm: baseW, pageHMm: baseH };
}

function computeFitForOrientation(
  imgPixelW: number,
  imgPixelH: number,
  settings: PosterSettings,
  orientation: 'portrait' | 'landscape'
) {
  const { pageWMm, pageHMm } = getPageDimensions(settings, orientation);
  const marginMm = Math.max(0, Math.min(30, settings.marginMm));
  const printableWMm = Math.max(20, pageWMm - marginMm * 2);
  const printableHMm = Math.max(20, pageHMm - marginMm * 2);
  const overlapMm = Math.max(
    0,
    Math.min(Math.min(printableWMm, printableHMm) * 0.4, settings.overlapMm)
  );

  const stepWMm = Math.max(10, printableWMm - overlapMm);
  const stepHMm = Math.max(10, printableHMm - overlapMm);

  let cols = Math.max(1, Math.min(20, Math.round(settings.cols)));
  let rows = Math.max(1, Math.min(20, Math.round(settings.rows)));

  const safeImgW = Math.max(1, imgPixelW);
  const safeImgH = Math.max(1, imgPixelH);
  const imgAspect = safeImgW / safeImgH;

  let imgWMm: number;
  let imgHMm: number;

  if (settings.sizingMode === 'physical') {
    imgWMm = Math.max(10, settings.targetWidthCm * 10);
    imgHMm = settings.lockAspectRatio
      ? imgWMm / imgAspect
      : Math.max(10, settings.targetHeightCm * 10);

    cols =
      imgWMm <= printableWMm + 0.01
        ? 1
        : Math.max(1, Math.ceil((imgWMm - overlapMm) / stepWMm));
    rows =
      imgHMm <= printableHMm + 0.01
        ? 1
        : Math.max(1, Math.ceil((imgHMm - overlapMm) / stepHMm));
  } else if (settings.sizingMode === 'proportional_sheets') {
    if (settings.sheetAxis === 'cols') {
      // User chose Páginas de largura -> fill width across `cols`, derive proportional `rows`
      const gridW = cols * printableWMm - (cols - 1) * overlapMm;
      imgWMm = gridW;
      imgHMm = gridW / imgAspect;
      rows =
        imgHMm <= printableHMm + 0.01
          ? 1
          : Math.max(1, Math.ceil((imgHMm - overlapMm) / stepHMm));
    } else {
      // User chose Páginas de altura -> fill height across `rows`, derive proportional `cols`
      const gridH = rows * printableHMm - (rows - 1) * overlapMm;
      imgHMm = gridH;
      imgWMm = gridH * imgAspect;
      cols =
        imgWMm <= printableWMm + 0.01
          ? 1
          : Math.max(1, Math.ceil((imgWMm - overlapMm) / stepWMm));
    }
  } else {
    // 'free_grid': user controls cols and rows directly
    const gridW = cols * printableWMm - (cols - 1) * overlapMm;
    const gridH = rows * printableHMm - (rows - 1) * overlapMm;
    const gridAspect = gridW / gridH;
    if (imgAspect > gridAspect) {
      imgWMm = gridW;
      imgHMm = gridW / imgAspect;
    } else {
      imgHMm = gridH;
      imgWMm = gridH * imgAspect;
    }
  }

  const totalGridWMm = cols * printableWMm - (cols - 1) * overlapMm;
  const totalGridHMm = rows * printableHMm - (rows - 1) * overlapMm;
  const fillEfficiency = (imgWMm * imgHMm) / (totalGridWMm * totalGridHMm);

  return {
    orientation,
    pageWMm,
    pageHMm,
    printableWMm,
    printableHMm,
    overlapMm,
    stepWMm,
    stepHMm,
    cols,
    rows,
    totalGridWMm,
    totalGridHMm,
    imgWMm,
    imgHMm,
    fillEfficiency,
    totalPages: cols * rows,
  };
}

export function calculatePosterLayout(
  imgPixelW: number,
  imgPixelH: number,
  settings: PosterSettings
): PosterLayout {
  let chosen;
  if (settings.orientation === 'auto') {
    const portraitFit = computeFitForOrientation(imgPixelW, imgPixelH, settings, 'portrait');
    const landscapeFit = computeFitForOrientation(imgPixelW, imgPixelH, settings, 'landscape');

    if (settings.sizingMode === 'physical' || settings.sizingMode === 'proportional_sheets') {
      if (portraitFit.totalPages !== landscapeFit.totalPages) {
        chosen = portraitFit.totalPages < landscapeFit.totalPages ? portraitFit : landscapeFit;
      } else {
        chosen = portraitFit.fillEfficiency >= landscapeFit.fillEfficiency ? portraitFit : landscapeFit;
      }
    } else {
      chosen = portraitFit.fillEfficiency >= landscapeFit.fillEfficiency ? portraitFit : landscapeFit;
    }
  } else {
    chosen = computeFitForOrientation(imgPixelW, imgPixelH, settings, settings.orientation);
  }

  const {
    orientation: resolvedOrientation,
    pageWMm,
    pageHMm,
    printableWMm,
    printableHMm,
    stepWMm,
    stepHMm,
    cols,
    rows,
    totalGridWMm,
    totalGridHMm,
    imgWMm: baseImgWMm,
    imgHMm: baseImgHMm,
  } = chosen;

  const marginMm = Math.max(0, Math.min(30, settings.marginMm));
  const scaleFactor = settings.manualPositioning
    ? Math.max(0.2, Math.min(6.0, settings.imageScale || 1))
    : 1;

  const imgWMm = baseImgWMm * scaleFactor;
  const imgHMm = baseImgHMm * scaleFactor;

  const offsetX = settings.manualPositioning ? settings.imageOffsetXMm || 0 : 0;
  const offsetY = settings.manualPositioning ? settings.imageOffsetYMm || 0 : 0;
  const imgXMm = (totalGridWMm - imgWMm) / 2 + offsetX;
  const imgYMm = (totalGridHMm - imgHMm) / 2 + offsetY;

  const imgRightMm = imgXMm + imgWMm;
  const imgBottomMm = imgYMm + imgHMm;

  const tiles: TileSlice[] = [];
  let seq = 1;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const gridXMm = c * stepWMm;
      const gridYMm = r * stepHMm;
      const tileRightMm = gridXMm + printableWMm;
      const tileBottomMm = gridYMm + printableHMm;

      const interLeft = Math.max(gridXMm, imgXMm);
      const interTop = Math.max(gridYMm, imgYMm);
      const interRight = Math.min(tileRightMm, imgRightMm);
      const interBottom = Math.min(tileBottomMm, imgBottomMm);

      const interW = interRight - interLeft;
      const interH = interBottom - interTop;
      const hasIntersection = interW > 0.4 && interH > 0.4;

      const destXMm = marginMm + (interLeft - gridXMm);
      const destYMm = marginMm + (interTop - gridYMm);
      const destWMm = hasIntersection ? interW : 0;
      const destHMm = hasIntersection ? interH : 0;

      const srcX = hasIntersection ? ((interLeft - imgXMm) / imgWMm) * imgPixelW : 0;
      const srcY = hasIntersection ? ((interTop - imgYMm) / imgHMm) * imgPixelH : 0;
      const srcW = hasIntersection ? (interW / imgWMm) * imgPixelW : 0;
      const srcH = hasIntersection ? (interH / imgHMm) * imgPixelH : 0;

      tiles.push({
        index: seq++,
        row: r,
        col: c,
        pageLabel: `L${r + 1} · C${c + 1}`,
        gridXMm,
        gridYMm,
        printableWMm,
        printableHMm,
        hasIntersection,
        isBlank: !hasIntersection,
        destXMm,
        destYMm,
        destWMm,
        destHMm,
        srcX,
        srcY,
        srcW,
        srcH,
      });
    }
  }

  const imgInchesW = imgWMm / 25.4;
  const imgInchesH = imgHMm / 25.4;
  const dpiW = imgPixelW / Math.max(0.1, imgInchesW);
  const dpiH = imgPixelH / Math.max(0.1, imgInchesH);
  const estimatedDpi = Math.round(Math.min(dpiW, dpiH));

  return {
    resolvedOrientation,
    pageWMm,
    pageHMm,
    printableWMm,
    printableHMm,
    cols,
    rows,
    totalGridWMm,
    totalGridHMm,
    imgXMm,
    imgYMm,
    imgWMm,
    imgHMm,
    estimatedDpi,
    tiles,
  };
}

export function getDpiQualityLabel(dpi: number): {
  label: string;
  detail: string;
  tone: 'emerald' | 'amber' | 'rose';
} {
  if (dpi >= 150) {
    return {
      label: 'Alta nitidez',
      detail: `${dpi} DPI`,
      tone: 'emerald',
    };
  }
  if (dpi >= 90) {
    return {
      label: 'Boa para pôster',
      detail: `${dpi} DPI`,
      tone: 'amber',
    };
  }
  return {
    label: 'Resolução baixa',
    detail: `${dpi} DPI`,
    tone: 'rose',
  };
}
