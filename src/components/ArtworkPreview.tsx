import React, { useEffect, useRef } from 'react';

interface ArtworkPreviewProps {
  processedCanvas: HTMLCanvasElement | null;
  originalSrc?: string | null;
  useOriginalSrc?: boolean;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders the poster artwork directly without calling heavy `canvas.toDataURL('image/png')`
 * (which can fail, hit memory/URL limits, or render blank on mobile browsers / Brave Shields).
 *
 * - When no filters/rotations are active (`useOriginalSrc && originalSrc`), uses a native `<img>`
 *   bound directly to the uploaded blob/data/local URL for instant hardware-accelerated display.
 * - When filters are active, draws `processedCanvas` directly onto an on-screen `<canvas>`
 *   using `ctx.drawImage`, avoiding base64 serialization completely.
 */
export const ArtworkPreview: React.FC<ArtworkPreviewProps> = ({
  processedCanvas,
  originalSrc,
  useOriginalSrc = false,
  alt,
  className = '',
  style,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const showDirectImg = Boolean(useOriginalSrc && originalSrc);

  useEffect(() => {
    if (showDirectImg || !processedCanvas || !canvasRef.current) return;
    const target = canvasRef.current;
    const maxPreviewDim = 1400;
    const scale = Math.min(
      1,
      maxPreviewDim / Math.max(1, processedCanvas.width, processedCanvas.height)
    );
    const w = Math.max(1, Math.round(processedCanvas.width * scale));
    const h = Math.max(1, Math.round(processedCanvas.height * scale));

    if (target.width !== w) target.width = w;
    if (target.height !== h) target.height = h;

    const ctx = target.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, w, h);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(processedCanvas, 0, 0, w, h);
  }, [processedCanvas, showDirectImg]);

  if (showDirectImg && originalSrc) {
    return (
      <img
        src={originalSrc}
        alt={alt}
        draggable={false}
        decoding="async"
        className={`max-w-none max-h-none block ${className}`}
        style={style}
      />
    );
  }

  return (
    <canvas
      ref={canvasRef}
      aria-label={alt}
      className={`max-w-none max-h-none block ${className}`}
      style={style}
    />
  );
};
