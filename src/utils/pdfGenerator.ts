import { jsPDF } from 'jspdf';
import { ImageFilters, PosterLayout, PosterSettings, TileSlice } from '../types/poster';
import { isTileCanvasBlank, PAPER_COLOR_PROFILES } from './imageProcessing';
import { getPaperSpecLabel } from './posterMath';

function drawCropMark(doc: jsPDF, x: number, y: number, size = 3.2) {
  doc.line(x - size, y, x + size, y);
  doc.line(x, y - size, x, y + size);
}

export interface PdfExportResult {
  fileName: string;
  exportedPages: number;
  skippedBlankPages: number;
}

export async function generatePosterPdf(
  processedCanvas: HTMLCanvasElement,
  layout: PosterLayout,
  settings: PosterSettings,
  baseName = 'fatiart-poster',
  onProgress?: (pct: number) => void
): Promise<PdfExportResult> {
  const { pageWMm, pageHMm, resolvedOrientation, tiles, cols, rows } = layout;

  const doc = new jsPDF({
    orientation: resolvedOrientation,
    unit: 'mm',
    format: [pageWMm, pageHMm],
    compress: true,
  });

  const activeTiles: TileSlice[] = [];
  let skippedBlankPages = 0;

  for (const tile of tiles) {
    if (settings.skipBlankPages && isTileCanvasBlank(processedCanvas, tile)) {
      skippedBlankPages++;
      continue;
    }
    activeTiles.push(tile);
  }

  if (activeTiles.length === 0 && tiles.length > 0) {
    activeTiles.push(tiles[0]);
    skippedBlankPages = Math.max(0, tiles.length - 1);
  }

  let pageCursor = 0;
  const totalSteps = activeTiles.length + (settings.includeAssemblyMap ? 1 : 0);

  if (settings.includeAssemblyMap) {
    pageCursor++;
    onProgress?.(Math.round((pageCursor / totalSteps) * 100));

    const pad = 16;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.setTextColor(15, 23, 42);
    doc.text('Mapa de Montagem — FatiArt Studio', pad, 20);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(71, 85, 105);
    const paperName = getPaperSpecLabel(settings).shortLabel;
    const summaryLine = `Grade: ${cols} colunas × ${rows} linhas (${activeTiles.length} folhas ${paperName})  |  Tamanho da arte: ${(layout.imgWMm / 10).toFixed(1)} × ${(layout.imgHMm / 10).toFixed(1)} cm  |  Sobreposição: ${settings.overlapMm} mm`;
    doc.text(summaryLine, pad, 27);

    const availW = pageWMm - pad * 2;
    const availH = pageHMm - 54;
    const scale = Math.min(availW / layout.totalGridWMm, availH / layout.totalGridHMm);

    const drawW = layout.totalGridWMm * scale;
    const drawH = layout.totalGridHMm * scale;
    const originX = (pageWMm - drawW) / 2;
    const originY = 36 + (availH - drawH) / 2;

    const previewCanvas = document.createElement('canvas');
    const previewScale = Math.min(
      1,
      900 / Math.max(processedCanvas.width, processedCanvas.height)
    );
    previewCanvas.width = Math.max(1, Math.round(processedCanvas.width * previewScale));
    previewCanvas.height = Math.max(1, Math.round(processedCanvas.height * previewScale));
    const pCtx = previewCanvas.getContext('2d');
    if (pCtx) {
      pCtx.fillStyle = '#ffffff';
      pCtx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
      pCtx.drawImage(processedCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
      const previewDataUrl = previewCanvas.toDataURL('image/jpeg', 0.85);
      doc.addImage(
        previewDataUrl,
        'JPEG',
        originX + layout.imgXMm * scale,
        originY + layout.imgYMm * scale,
        layout.imgWMm * scale,
        layout.imgHMm * scale
      );
    }

    doc.setLineWidth(0.3);
    for (const tile of tiles) {
      const rx = originX + tile.gridXMm * scale;
      const ry = originY + tile.gridYMm * scale;
      const rw = tile.printableWMm * scale;
      const rh = tile.printableHMm * scale;

      const isActive = activeTiles.some((t) => t.index === tile.index);
      doc.setDrawColor(isActive ? 232 : 180, isActive ? 93 : 185, isActive ? 4 : 195);
      doc.rect(rx, ry, rw, rh);

      const activeIdx = activeTiles.findIndex((t) => t.index === tile.index);
      const cellText = isActive ? `${activeIdx + 1} (${tile.pageLabel})` : 'Branco';
      doc.setFillColor(255, 255, 255);
      const textW = Math.min(rw - 2, doc.getTextWidth(cellText) + 3);
      doc.rect(rx + 1.5, ry + 1.5, textW, 5.2, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7);
      doc.setTextColor(isActive ? 15 : 148, isActive ? 23 : 163, isActive ? 42 : 184);
      doc.text(cellText, rx + 2.8, ry + 5.1);
    }

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(71, 85, 105);
    doc.text(
      'Dica: Imprima em "Tamanho Real / 100%" (sem ajustar à página). Recorte pelas marcas de corte e cole usando a faixa de sobreposição.',
      pad,
      pageHMm - 12
    );
  }

  const marginMm = Math.max(0, Math.min(25, settings.marginMm));
  const tileCanvas = document.createElement('canvas');
  const tileCtx = tileCanvas.getContext('2d');

  for (let i = 0; i < activeTiles.length; i++) {
    const tile = activeTiles[i];
    if (settings.includeAssemblyMap || i > 0) {
      doc.addPage([pageWMm, pageHMm], resolvedOrientation);
    }

    pageCursor++;
    onProgress?.(Math.round((pageCursor / totalSteps) * 100));

    if (tile.hasIntersection && tileCtx && tile.srcW > 0.5 && tile.srcH > 0.5) {
      const targetPxW = Math.min(2600, Math.max(80, Math.round((tile.destWMm / 25.4) * 220)));
      const targetPxH = Math.min(3400, Math.max(80, Math.round((tile.destHMm / 25.4) * 220)));

      const finalW = Math.min(targetPxW, Math.max(80, Math.round(tile.srcW * 1.5)));
      const finalH = Math.min(targetPxH, Math.max(80, Math.round(tile.srcH * 1.5)));

      tileCanvas.width = finalW;
      tileCanvas.height = finalH;

      tileCtx.fillStyle = '#ffffff';
      tileCtx.fillRect(0, 0, finalW, finalH);
      tileCtx.imageSmoothingEnabled = true;
      tileCtx.imageSmoothingQuality = 'high';
      tileCtx.drawImage(
        processedCanvas,
        tile.srcX,
        tile.srcY,
        tile.srcW,
        tile.srcH,
        0,
        0,
        finalW,
        finalH
      );

      const tileDataUrl = tileCanvas.toDataURL('image/jpeg', 0.92);
      doc.addImage(
        tileDataUrl,
        'JPEG',
        tile.destXMm,
        tile.destYMm,
        tile.destWMm,
        tile.destHMm
      );
    }

    if (settings.showCutMarks) {
      doc.setDrawColor(148, 163, 184);
      doc.setLineWidth(0.2);

      doc.setLineDashPattern([2, 2], 0);
      doc.rect(marginMm, marginMm, tile.printableWMm, tile.printableHMm);

      if (settings.overlapMm > 0 && tile.col < cols - 1) {
        const overlapX = pageWMm - marginMm - settings.overlapMm;
        doc.setDrawColor(232, 93, 4);
        doc.line(overlapX, marginMm, overlapX, pageHMm - marginMm);
      }
      if (settings.overlapMm > 0 && tile.row < rows - 1) {
        const overlapY = pageHMm - marginMm - settings.overlapMm;
        doc.setDrawColor(232, 93, 4);
        doc.line(marginMm, overlapY, pageWMm - marginMm, overlapY);
      }
      doc.setLineDashPattern([], 0);

      doc.setDrawColor(51, 65, 85);
      doc.setLineWidth(0.25);
      drawCropMark(doc, marginMm, marginMm);
      drawCropMark(doc, pageWMm - marginMm, marginMm);
      drawCropMark(doc, marginMm, pageHMm - marginMm);
      drawCropMark(doc, pageWMm - marginMm, pageHMm - marginMm);
    }

    if (settings.showPageNumbers) {
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      const labelY = marginMm >= 5 ? marginMm - 2.2 : 3.5;
      doc.text(
        `FatiArt · Folha ${i + 1}/${activeTiles.length} · ${tile.pageLabel}`,
        marginMm,
        labelY
      );
      if (settings.overlapMm > 0 && (tile.col < cols - 1 || tile.row < rows - 1)) {
        doc.text(
          `Sobreposição: ${settings.overlapMm} mm`,
          pageWMm - marginMm,
          labelY,
          { align: 'right' }
        );
      }
    }

    if (i % 4 === 3) {
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const cleanSlug =
    baseName
      .toLowerCase()
      .replace(/[^a-z0-9-_]+/g, '-')
      .replace(/^-|-$/g, '') || 'fatiart-poster';
  const fileName = `${cleanSlug}-${cols}x${rows}-${settings.paperSize.toLowerCase()}.pdf`;
  doc.save(fileName);

  return {
    fileName,
    exportedPages: activeTiles.length + (settings.includeAssemblyMap ? 1 : 0),
    skippedBlankPages,
  };
}

/**
 * Generates a single A4 calibration test sheet with the user's current image + color profile + fine tuning + CMYK/Grayscale bars.
 */
export function generateCalibrationTestPdf(
  processedCanvas: HTMLCanvasElement,
  filters: ImageFilters,
  baseName = 'fatiart-teste'
) {
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a4',
    compress: true,
  });

  const pad = 15;
  const profileSpec =
    PAPER_COLOR_PROFILES.find((p) => p.id === filters.paperColorProfile) ||
    PAPER_COLOR_PROFILES[0];

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.setTextColor(15, 23, 42);
  doc.text('Folha de Teste e Calibração (A4) — FatiArt Studio', pad, 20);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9.5);
  doc.setTextColor(71, 85, 105);
  doc.text(
    `Perfil de Papel: ${profileSpec.title}  |  Saturação: ${filters.saturation}%  |  Contraste: ${filters.contrast}%  |  Brilho: ${filters.brightness}  |  Temp: ${filters.temperature}`,
    pad,
    27
  );
  if (filters.reticleEnabled) {
    doc.text(
      `Efeito Retícula ativo: Economia ~${filters.reticleInkSaving}% · Ponto ${filters.reticleCellSize}px (${
        filters.reticleMonochrome ? 'Monocromático' : 'Colorido'
      })`,
      pad,
      33
    );
  }

  // Scaled sample preview of the user's processed artwork
  const maxBoxW = 180;
  const maxBoxH = 165;
  const aspect = processedCanvas.width / Math.max(1, processedCanvas.height);
  let drawW = maxBoxW;
  let drawH = drawW / aspect;
  if (drawH > maxBoxH) {
    drawH = maxBoxH;
    drawW = drawH * aspect;
  }

  const previewCanvas = document.createElement('canvas');
  const scale = Math.min(1, 1400 / Math.max(processedCanvas.width, processedCanvas.height));
  previewCanvas.width = Math.max(1, Math.round(processedCanvas.width * scale));
  previewCanvas.height = Math.max(1, Math.round(processedCanvas.height * scale));
  const ctx = previewCanvas.getContext('2d');
  if (ctx) {
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
    ctx.drawImage(processedCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
    const dataUrl = previewCanvas.toDataURL('image/jpeg', 0.92);
    const imgX = (210 - drawW) / 2;
    const imgY = 42;
    doc.addImage(dataUrl, 'JPEG', imgX, imgY, drawW, drawH);
    doc.setDrawColor(203, 213, 225);
    doc.setLineWidth(0.3);
    doc.rect(imgX, imgY, drawW, drawH);
  }

  // Color & Grayscale calibration swatches
  const barY = 224;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text('Barras de Referência de Cor e Densidade:', pad, barY - 4);

  const colorSwatches: [number, number, number][] = [
    [0, 174, 239],
    [236, 0, 140],
    [255, 242, 0],
    [15, 23, 42],
    [232, 93, 4],
    [22, 163, 74],
    [37, 99, 235],
  ];
  colorSwatches.forEach(([r, g, b], idx) => {
    doc.setFillColor(r, g, b);
    doc.rect(pad + idx * 25.5, barY, 23, 12, 'F');
  });

  // 10-step grayscale ramp
  for (let s = 0; s < 10; s++) {
    const v = Math.round((s / 9) * 255);
    doc.setFillColor(v, v, v);
    doc.rect(pad + s * 18, barY + 16, 17.5, 10, 'F');
  }

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  doc.text(
    'Imprima esta folha única antes do pôster completo para validar brilho, absorção do papel e densidade de retícula na sua impressora.',
    pad,
    274
  );

  doc.save(`${baseName}-folha-teste-a4.pdf`);
}
