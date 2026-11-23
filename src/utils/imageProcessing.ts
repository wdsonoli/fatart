import { ImageFilters, PaperColorProfileId, TileSlice } from '../types/poster';

export const DEFAULT_FILTERS: ImageFilters = {
  rotation: 0,
  mirrorX: false,
  grayscale: false,
  stencilMode: false,
  stencilThreshold: 145,
  invert: false,
  saturation: 0,
  brightness: 0,
  contrast: 0,
  temperature: 0,
  paperColorProfile: 'none',
  reticleEnabled: false,
  reticleInkSaving: 40,
  reticleCellSize: 7,
  reticleMonochrome: false,
  watermarkEnabled: false,
  watermarkText: 'FatiArt Studio',
  watermarkOpacity: 28,
  watermarkLayout: 'tiled',
};

export interface PaperProfileSpec {
  id: PaperColorProfileId;
  title: string;
  description: string;
  swatchColor: string;
  brightnessBoost: number;
  contrastBoost: number;
  saturationBoost: number;
  temperatureShift: number;
}

export const PAPER_COLOR_PROFILES: PaperProfileSpec[] = [
  {
    id: 'none',
    title: 'Nenhuma correção',
    description: 'Imprime exatamente as cores originais da imagem.',
    swatchColor: '#1E293B',
    brightnessBoost: 0,
    contrastBoost: 0,
    saturationBoost: 0,
    temperatureShift: 0,
  },
  {
    id: 'sulfite',
    title: 'Sulfite / Papel comum',
    description: 'Absorve mais tinta e deixa as cores foscas e escuras.',
    swatchColor: '#F3EFE6',
    brightnessBoost: 14,
    contrastBoost: 8,
    saturationBoost: 18,
    temperatureShift: -4,
  },
  {
    id: 'matte',
    title: 'Fosco / Matte fotográfico',
    description: 'Correção intermediária, absorção controlada.',
    swatchColor: '#EAE4D8',
    brightnessBoost: 9,
    contrastBoost: 6,
    saturationBoost: 12,
    temperatureShift: 0,
  },
  {
    id: 'glossy',
    title: 'Fotográfico brilhante',
    description: 'Mantém a saturação, quase nenhuma correção.',
    swatchColor: '#E2E8F0',
    brightnessBoost: 2,
    contrastBoost: 3,
    saturationBoost: 4,
    temperatureShift: 0,
  },
  {
    id: 'recycled',
    title: 'Reciclado / Offset amarelado',
    description: 'Base amarelada e muita absorção, correção mais forte.',
    swatchColor: '#EAD8B1',
    brightnessBoost: 18,
    contrastBoost: 12,
    saturationBoost: 22,
    temperatureShift: -14,
  },
  {
    id: 'couche',
    title: 'Couché / Revista',
    description: 'Papel semi-brilhante, correção leve.',
    swatchColor: '#F8FAFC',
    brightnessBoost: 5,
    contrastBoost: 5,
    saturationBoost: 8,
    temperatureShift: 0,
  },
];

export function hasActiveImageFilters(filters: ImageFilters): boolean {
  return (
    filters.rotation !== 0 ||
    filters.mirrorX ||
    filters.grayscale ||
    filters.stencilMode ||
    filters.invert ||
    filters.saturation !== 0 ||
    filters.brightness !== 0 ||
    filters.contrast !== 0 ||
    filters.temperature !== 0 ||
    filters.paperColorProfile !== 'none' ||
    filters.reticleEnabled ||
    (filters.watermarkEnabled && filters.watermarkText.trim().length > 0)
  );
}

export function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // Only set crossOrigin for external http(s) URLs; setting it on blob:/data: URLs can break mobile WebViews/Brave
    if (/^https?:\/\//i.test(src)) {
      img.crossOrigin = 'anonymous';
    }
    img.onload = () => {
      if (typeof img.decode === 'function') {
        img
          .decode()
          .then(() => resolve(img))
          .catch(() => resolve(img));
      } else {
        resolve(img);
      }
    };
    img.onerror = (err) => reject(err);
    img.src = src;
  });
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

/**
 * Applies Reticle / Halftone dot-screen ink-saver effect onto canvas pixel buffer.
 * Preserves white paper background and converts tonal density into crisp geometric dots,
 * saving up to ~50% ink on solid fills.
 */
function applyReticleEffect(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  inkSavingPct: number,
  cellSize: number,
  monochrome: boolean
) {
  const srcData = ctx.getImageData(0, 0, w, h);
  const src = srcData.data;

  // Create clean white output sheet
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);

  const step = Math.max(4, Math.min(18, Math.round(cellSize)));
  // Ink saving scales maximum dot radius down
  const savingFactor = 1 - Math.max(0.1, Math.min(0.75, inkSavingPct / 100)) * 0.65;
  const maxRadius = step * 0.56 * savingFactor;

  for (let cy = 0; cy < h; cy += step) {
    const rowIdx = Math.floor(cy / step);
    const xOffset = rowIdx % 2 === 1 ? step * 0.5 : 0;

    for (let cx = -step; cx < w + step; cx += step) {
      const sampleX = Math.max(0, Math.min(w - 1, Math.floor(cx + xOffset + step * 0.5)));
      const sampleY = Math.max(0, Math.min(h - 1, Math.floor(cy + step * 0.5)));
      const idx = (sampleY * w + sampleX) * 4;

      const r = src[idx];
      const g = src[idx + 1];
      const b = src[idx + 2];

      const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      const darkness = 1 - lum;
      if (darkness < 0.04) continue;

      const radius = Math.sqrt(darkness) * maxRadius;
      if (radius < 0.45) continue;

      if (monochrome) {
        ctx.fillStyle = '#0f172a';
      } else {
        ctx.fillStyle = `rgb(${r},${g},${b})`;
      }

      ctx.beginPath();
      ctx.arc(cx + xOffset + step * 0.5, cy + step * 0.5, radius, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

/**
 * Draws custom user watermark directly on the processed artwork canvas
 * so it appears identically in preview and slices cleanly across PDF pages.
 */
function applyWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  text: string,
  opacityPct: number,
  layout: ImageFilters['watermarkLayout']
) {
  const cleanText = text.trim();
  if (!cleanText) return;

  ctx.save();
  ctx.globalAlpha = Math.max(0.05, Math.min(0.9, opacityPct / 100));
  ctx.fillStyle = '#0F172A';

  const baseDim = Math.min(w, h);

  if (layout === 'bottom-right') {
    const fontSize = Math.max(18, Math.round(baseDim * 0.032));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'right';
    ctx.textBaseline = 'bottom';
    // Subtle light halo for legibility over dark backgrounds
    ctx.lineWidth = Math.max(2, fontSize * 0.12);
    ctx.strokeStyle = 'rgba(255,255,255,0.75)';
    ctx.strokeText(cleanText, w - fontSize * 0.9, h - fontSize * 0.8);
    ctx.fillText(cleanText, w - fontSize * 0.9, h - fontSize * 0.8);
  } else if (layout === 'center') {
    const fontSize = Math.max(26, Math.round(baseDim * 0.065));
    ctx.font = `800 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 8);
    ctx.lineWidth = Math.max(2, fontSize * 0.08);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.strokeText(cleanText, 0, 0);
    ctx.fillText(cleanText, 0, 0);
  } else {
    // Tiled diagonal watermark
    const fontSize = Math.max(18, Math.round(baseDim * 0.036));
    ctx.font = `700 ${fontSize}px "Plus Jakarta Sans", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textW = ctx.measureText(cleanText).width;
    const stepX = Math.max(fontSize * 5, textW + fontSize * 2.2);
    const stepY = fontSize * 4.5;

    ctx.translate(w / 2, h / 2);
    ctx.rotate(-Math.PI / 6);
    const diag = Math.hypot(w, h);
    for (let y = -diag; y <= diag; y += stepY) {
      const shift = Math.round(y / stepY) % 2 === 0 ? 0 : stepX * 0.5;
      for (let x = -diag; x <= diag; x += stepX) {
        ctx.lineWidth = Math.max(1.5, fontSize * 0.08);
        ctx.strokeStyle = 'rgba(255,255,255,0.65)';
        ctx.strokeText(cleanText, x + shift, y);
        ctx.fillText(cleanText, x + shift, y);
      }
    }
  }

  ctx.restore();
}

/**
 * Renders the source image into a processed HTMLCanvasElement with:
 * rotation, mirror, paper color absorption compensation, saturation, brightness/gamma,
 * contrast, color temperature, grayscale/stencil, invert, reticle ink-saver, and watermark.
 */
export function renderProcessedCanvas(
  img: HTMLImageElement,
  filters: ImageFilters,
  maxDimension = 2800
): HTMLCanvasElement {
  const natW = img.naturalWidth || img.width;
  const natH = img.naturalHeight || img.height;

  const scale = Math.min(1, maxDimension / Math.max(natW, natH));
  const baseW = Math.max(1, Math.round(natW * scale));
  const baseH = Math.max(1, Math.round(natH * scale));

  const swapDims = filters.rotation === 90 || filters.rotation === 270;
  const outW = swapDims ? baseH : baseW;
  const outH = swapDims ? baseW : baseH;

  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return canvas;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, outW, outH);

  ctx.save();
  ctx.translate(outW / 2, outH / 2);
  ctx.rotate((filters.rotation * Math.PI) / 180);
  if (filters.mirrorX) {
    ctx.scale(-1, 1);
  }
  ctx.drawImage(img, -baseW / 2, -baseH / 2, baseW, baseH);
  ctx.restore();

  const paperProfile =
    PAPER_COLOR_PROFILES.find((p) => p.id === filters.paperColorProfile) ||
    PAPER_COLOR_PROFILES[0];

  const totalBrightness = filters.brightness + paperProfile.brightnessBoost;
  const totalContrast = filters.contrast + paperProfile.contrastBoost;
  const totalSaturation = filters.saturation + paperProfile.saturationBoost;
  const totalTemp = filters.temperature + paperProfile.temperatureShift;

  const needsPixelPass =
    totalBrightness !== 0 ||
    totalContrast !== 0 ||
    totalSaturation !== 0 ||
    totalTemp !== 0 ||
    filters.grayscale ||
    filters.stencilMode ||
    filters.invert;

  if (needsPixelPass) {
    const imgData = ctx.getImageData(0, 0, outW, outH);
    const data = imgData.data;

    const brightnessOffset = (totalBrightness / 100) * 255;
    const contrastFactor =
      (259 * (totalContrast + 255)) / (255 * (259 - totalContrast));
    const satFactor = 1 + totalSaturation / 100;
    const tempShift = totalTemp * 1.1;

    for (let i = 0; i < data.length; i += 4) {
      let r = data[i];
      let g = data[i + 1];
      let b = data[i + 2];

      if (totalBrightness !== 0) {
        r += brightnessOffset;
        g += brightnessOffset;
        b += brightnessOffset;
      }

      if (totalContrast !== 0) {
        r = contrastFactor * (r - 128) + 128;
        g = contrastFactor * (g - 128) + 128;
        b = contrastFactor * (b - 128) + 128;
      }

      if (totalTemp !== 0) {
        r += tempShift;
        b -= tempShift;
      }

      if (totalSaturation !== 0) {
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;
        r = gray + (r - gray) * satFactor;
        g = gray + (g - gray) * satFactor;
        b = gray + (b - gray) * satFactor;
      }

      r = clampByte(r);
      g = clampByte(g);
      b = clampByte(b);

      if (filters.stencilMode) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        const bw = lum >= filters.stencilThreshold ? 255 : 0;
        r = bw;
        g = bw;
        b = bw;
      } else if (filters.grayscale) {
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = lum;
        g = lum;
        b = lum;
      }

      if (filters.invert) {
        r = 255 - r;
        g = 255 - g;
        b = 255 - b;
      }

      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
    }

    ctx.putImageData(imgData, 0, 0);
  }

  // Apply Efeito Retícula (Ink Saver)
  if (filters.reticleEnabled) {
    applyReticleEffect(
      ctx,
      outW,
      outH,
      filters.reticleInkSaving,
      filters.reticleCellSize,
      filters.reticleMonochrome
    );
  }

  // Apply Custom Watermark
  if (filters.watermarkEnabled && filters.watermarkText.trim()) {
    applyWatermark(
      ctx,
      outW,
      outH,
      filters.watermarkText,
      filters.watermarkOpacity,
      filters.watermarkLayout
    );
  }

  return canvas;
}

/**
 * Checks if a specific tile slice on the processed canvas is completely blank (all white).
 */
export function isTileCanvasBlank(
  sourceCanvas: HTMLCanvasElement,
  tile: TileSlice
): boolean {
  if (!tile.hasIntersection || tile.srcW <= 1 || tile.srcH <= 1) return true;

  const sampleW = Math.max(1, Math.min(48, Math.round(tile.srcW)));
  const sampleH = Math.max(1, Math.min(48, Math.round(tile.srcH)));

  const probe = document.createElement('canvas');
  probe.width = sampleW;
  probe.height = sampleH;
  const ctx = probe.getContext('2d', { willReadFrequently: true });
  if (!ctx) return false;

  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sampleW, sampleH);
  ctx.drawImage(
    sourceCanvas,
    tile.srcX,
    tile.srcY,
    tile.srcW,
    tile.srcH,
    0,
    0,
    sampleW,
    sampleH
  );

  const pixels = ctx.getImageData(0, 0, sampleW, sampleH).data;
  for (let i = 0; i < pixels.length; i += 4) {
    if (pixels[i] < 248 || pixels[i + 1] < 248 || pixels[i + 2] < 248) {
      return false;
    }
  }
  return true;
}
