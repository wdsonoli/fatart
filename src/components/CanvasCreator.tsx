import React, { useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  Circle,
  Copy,
  Crown,
  Flower2,
  Heart,
  ImagePlus,
  Music,
  Scissors,
  Send,
  Sparkles,
  Square,
  Star,
  Trash2,
  Triangle,
  Type,
  Zap,
} from 'lucide-react';
import { EditorElement, IconKind, ShapeKind } from '../types/poster';

interface CanvasCreatorProps {
  onSendToSlicer: (dataUrl: string, title: string) => void;
}

type CanvasAspect = {
  id: string;
  label: string;
  width: number;
  height: number;
};

const CANVAS_ASPECTS: CanvasAspect[] = [
  { id: 'poster-3-4', label: 'Pôster 3:4', width: 1500, height: 2000 },
  { id: 'a4-portrait', label: 'A4 Retrato', width: 1485, height: 2100 },
  { id: 'a4-landscape', label: 'Mural 4:3', width: 2000, height: 1500 },
  { id: 'square', label: 'Quadrado 1:1', width: 1800, height: 1800 },
];

const INITIAL_ELEMENTS: EditorElement[] = [
  {
    id: 'el-1',
    type: 'shape',
    shapeKind: 'rect',
    x: 6,
    y: 6,
    width: 88,
    height: 88,
    rotation: 0,
    opacity: 1,
    fillColor: 'transparent',
    strokeColor: '#0F172A',
    strokeWidth: 8,
  },
  {
    id: 'el-2',
    type: 'icon',
    iconKind: 'sparkles',
    x: 41,
    y: 14,
    width: 18,
    height: 14,
    rotation: 0,
    opacity: 1,
    fillColor: '#E85D04',
  },
  {
    id: 'el-3',
    type: 'text',
    text: 'SEMANA DA CIÊNCIA',
    x: 10,
    y: 34,
    width: 80,
    height: 18,
    rotation: 0,
    opacity: 1,
    fontSize: 82,
    fontFamily: 'Plus Jakarta Sans',
    fontWeight: '800',
    textAlign: 'center',
    color: '#0F172A',
  },
  {
    id: 'el-4',
    type: 'text',
    text: 'Mural Coletivo · Apresentação 2026',
    x: 15,
    y: 56,
    width: 70,
    height: 10,
    rotation: 0,
    opacity: 1,
    fontSize: 38,
    fontFamily: 'DM Sans',
    fontWeight: '500',
    textAlign: 'center',
    color: '#475569',
  },
];

const ICON_OPTIONS: { kind: IconKind; label: string; Icon: React.FC<{ className?: string }> }[] = [
  { kind: 'heart', label: 'Coração', Icon: Heart },
  { kind: 'bolt', label: 'Raio', Icon: Zap },
  { kind: 'crown', label: 'Coroa', Icon: Crown },
  { kind: 'scissors', label: 'Tesoura', Icon: Scissors },
  { kind: 'flower', label: 'Flor', Icon: Flower2 },
  { kind: 'trophy', label: 'Troféu', Icon: Triangle }, // rendered cleanly via SVG below
  { kind: 'music', label: 'Música', Icon: Music },
  { kind: 'sparkles', label: 'Estrelas', Icon: Sparkles },
];

const ICON_SVG_PATHS: Record<IconKind, string> = {
  heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
  bolt: 'M13 2L3 14h9l-1 8 10-12h-9l1-8z',
  crown: 'M2 19h20v2H2v-2zm0-2l2-11 5 5 3-7 3 7 5-5 2 11H2z',
  scissors: 'M6 2a3 3 0 100 6 3 3 0 000-6zm0 14a3 3 0 100 6 3 3 0 000-6zm13-9l-7.5 5 7.5 5-2 2-8.5-5.5L6 15l-1.5-1.5L17 4l2 3z',
  flower: 'M12 2a3 3 0 013 3c0 1.2-.7 2.2-1.7 2.7A3 3 0 0119 10a3 3 0 01-2.7 3 3 3 0 011.7 5 3 3 0 01-4.5.7A3 3 0 0112 22a3 3 0 01-1.5-3.3A3 3 0 016 18a3 3 0 011.7-5A3 3 0 015 10a3 3 0 015.7-2.3A3 3 0 019 5a3 3 0 013-3zm0 7a3 3 0 100 6 3 3 0 000-6z',
  trophy: 'M19 5h-2V3H7v2H5c-1.1 0-2 .9-2 2v1c0 2.55 1.92 4.63 4.39 4.94.63 1.5 1.98 2.63 3.61 2.96V19H7v2h10v-2h-4v-3.1c1.63-.33 2.98-1.46 3.61-2.96C19.08 12.63 21 10.55 21 8V7c0-1.1-.9-2-2-2z',
  music: 'M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z',
  sparkles: 'M12 2l2.4 7.2L22 12l-7.6 2.8L12 22l-2.4-7.2L2 12l7.6-2.8L12 2z',
};

export const CanvasCreator: React.FC<CanvasCreatorProps> = ({ onSendToSlicer }) => {
  const [elements, setElements] = useState<EditorElement[]>(INITIAL_ELEMENTS);
  const [selectedId, setSelectedId] = useState<string | null>('el-3');
  const [bgColor, setBgColor] = useState('#FFFDF9');
  const [aspectId, setAspectId] = useState('poster-3-4');
  const [isCompiling, setIsCompiling] = useState(false);

  const stageRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeAspect =
    CANVAS_ASPECTS.find((a) => a.id === aspectId) ?? CANVAS_ASPECTS[0];
  const selectedEl = elements.find((e) => e.id === selectedId) || null;

  const updateElement = (id: string, patch: Partial<EditorElement>) => {
    setElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, ...patch } : el))
    );
  };

  const addText = () => {
    const id = `el-${Date.now()}`;
    setElements((prev) => [
      ...prev,
      {
        id,
        type: 'text',
        text: 'Novo Título',
        x: 20,
        y: 42,
        width: 60,
        height: 14,
        rotation: 0,
        opacity: 1,
        fontSize: 64,
        fontFamily: 'Plus Jakarta Sans',
        fontWeight: '700',
        textAlign: 'center',
        color: '#0F172A',
      },
    ]);
    setSelectedId(id);
  };

  const addShape = (shapeKind: ShapeKind) => {
    const id = `el-${Date.now()}`;
    setElements((prev) => [
      ...prev,
      {
        id,
        type: 'shape',
        shapeKind,
        x: 35,
        y: 35,
        width: 30,
        height: 24,
        rotation: 0,
        opacity: 1,
        fillColor: '#E85D04',
        strokeColor: '#0F172A',
        strokeWidth: 0,
      },
    ]);
    setSelectedId(id);
  };

  const addIcon = (iconKind: IconKind) => {
    const id = `el-${Date.now()}`;
    setElements((prev) => [
      ...prev,
      {
        id,
        type: 'icon',
        iconKind,
        x: 40,
        y: 38,
        width: 20,
        height: 16,
        rotation: 0,
        opacity: 1,
        fillColor: '#0F172A',
      },
    ]);
    setSelectedId(id);
  };

  const handleUploadImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return;
      const id = `el-${Date.now()}`;
      setElements((prev) => [
        ...prev,
        {
          id,
          type: 'image',
          imageSrc: reader.result as string,
          x: 25,
          y: 25,
          width: 50,
          height: 40,
          rotation: 0,
          opacity: 1,
        },
      ]);
      setSelectedId(id);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const duplicateSelected = () => {
    if (!selectedEl) return;
    const id = `el-${Date.now()}`;
    setElements((prev) => [
      ...prev,
      {
        ...selectedEl,
        id,
        x: Math.min(85, selectedEl.x + 4),
        y: Math.min(85, selectedEl.y + 4),
      },
    ]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selectedEl) return;
    setElements((prev) => prev.filter((e) => e.id !== selectedEl.id));
    setSelectedId(null);
  };

  const moveLayer = (dir: 'up' | 'down') => {
    if (!selectedEl) return;
    setElements((prev) => {
      const idx = prev.findIndex((e) => e.id === selectedEl.id);
      if (idx === -1) return prev;
      const nextIdx = dir === 'up' ? idx + 1 : idx - 1;
      if (nextIdx < 0 || nextIdx >= prev.length) return prev;
      const copy = [...prev];
      const [item] = copy.splice(idx, 1);
      copy.splice(nextIdx, 0, item);
      return copy;
    });
  };

  // Dragging & resizing directly on the visual stage
  const startDrag = (e: React.PointerEvent, el: EditorElement) => {
    e.stopPropagation();
    setSelectedId(el.id);
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origX = el.x;
    const origY = el.y;

    const onMove = (ev: PointerEvent) => {
      const dxPct = ((ev.clientX - startX) / rect.width) * 100;
      const dyPct = ((ev.clientY - startY) / rect.height) * 100;
      updateElement(el.id, {
        x: Math.max(-20, Math.min(95, origX + dxPct)),
        y: Math.max(-20, Math.min(95, origY + dyPct)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const startResize = (e: React.PointerEvent, el: EditorElement) => {
    e.stopPropagation();
    const stage = stageRef.current;
    if (!stage) return;
    const rect = stage.getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const origW = el.width;
    const origH = el.height;

    const onMove = (ev: PointerEvent) => {
      const dwPct = ((ev.clientX - startX) / rect.width) * 100;
      const dhPct = ((ev.clientY - startY) / rect.height) * 100;
      updateElement(el.id, {
        width: Math.max(5, Math.min(120, origW + dwPct)),
        height: Math.max(4, Math.min(120, origH + dhPct)),
      });
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
  };

  const exportToSlicer = async () => {
    setIsCompiling(true);
    try {
      const { width, height } = activeAspect;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.fillStyle = bgColor;
      ctx.fillRect(0, 0, width, height);

      for (const el of elements) {
        const px = (el.x / 100) * width;
        const py = (el.y / 100) * height;
        const pw = (el.width / 100) * width;
        const ph = (el.height / 100) * height;

        ctx.save();
        ctx.globalAlpha = el.opacity;
        ctx.translate(px + pw / 2, py + ph / 2);
        ctx.rotate((el.rotation * Math.PI) / 180);
        ctx.translate(-pw / 2, -ph / 2);

        if (el.type === 'shape') {
          ctx.fillStyle = el.fillColor || '#E85D04';
          ctx.strokeStyle = el.strokeColor || '#0F172A';
          ctx.lineWidth = ((el.strokeWidth || 0) * width) / 1000;

          if (el.shapeKind === 'rect') {
            if (el.fillColor && el.fillColor !== 'transparent') {
              ctx.fillRect(0, 0, pw, ph);
            }
            if ((el.strokeWidth || 0) > 0) {
              ctx.strokeRect(0, 0, pw, ph);
            }
          } else if (el.shapeKind === 'circle') {
            ctx.beginPath();
            ctx.ellipse(pw / 2, ph / 2, pw / 2, ph / 2, 0, 0, Math.PI * 2);
            if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
            if ((el.strokeWidth || 0) > 0) ctx.stroke();
          } else if (el.shapeKind === 'triangle') {
            ctx.beginPath();
            ctx.moveTo(pw / 2, 0);
            ctx.lineTo(pw, ph);
            ctx.lineTo(0, ph);
            ctx.closePath();
            if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
            if ((el.strokeWidth || 0) > 0) ctx.stroke();
          } else if (el.shapeKind === 'star') {
            ctx.beginPath();
            const cx = pw / 2;
            const cy = ph / 2;
            const spikes = 5;
            const outerR = Math.min(pw, ph) / 2;
            const innerR = outerR * 0.42;
            for (let i = 0; i < spikes * 2; i++) {
              const r = i % 2 === 0 ? outerR : innerR;
              const angle = (i * Math.PI) / spikes - Math.PI / 2;
              const sx = cx + Math.cos(angle) * r;
              const sy = cy + Math.sin(angle) * r;
              if (i === 0) ctx.moveTo(sx, sy);
              else ctx.lineTo(sx, sy);
            }
            ctx.closePath();
            if (el.fillColor && el.fillColor !== 'transparent') ctx.fill();
            if ((el.strokeWidth || 0) > 0) ctx.stroke();
          }
        } else if (el.type === 'icon' && el.iconKind) {
          const path = new Path2D(ICON_SVG_PATHS[el.iconKind]);
          const s = Math.min(pw, ph) / 24;
          ctx.save();
          ctx.translate((pw - 24 * s) / 2, (ph - 24 * s) / 2);
          ctx.scale(s, s);
          ctx.fillStyle = el.fillColor || '#0F172A';
          ctx.fill(path);
          ctx.restore();
        } else if (el.type === 'text' && el.text) {
          const scaledFontSize = ((el.fontSize || 48) * width) / 1000;
          ctx.fillStyle = el.color || '#0F172A';
          ctx.font = `${el.fontWeight || '700'} ${scaledFontSize}px "${el.fontFamily || 'Plus Jakarta Sans'}", sans-serif`;
          ctx.textBaseline = 'top';
          const align = el.textAlign || 'center';
          ctx.textAlign = align;
          const anchorX = align === 'center' ? pw / 2 : align === 'right' ? pw : 0;

          // Wrap lines within pw
          const rawLines = el.text.split('\n');
          const lines: string[] = [];
          for (const raw of rawLines) {
            const words = raw.split(' ');
            let line = '';
            for (const w of words) {
              const test = line ? `${line} ${w}` : w;
              if (ctx.measureText(test).width > pw && line) {
                lines.push(line);
                line = w;
              } else {
                line = test;
              }
            }
            lines.push(line);
          }

          const lineHeight = scaledFontSize * 1.18;
          const totalTextH = lines.length * lineHeight;
          const startY = Math.max(0, (ph - totalTextH) / 2);
          lines.forEach((ln, idx) => {
            ctx.fillText(ln, anchorX, startY + idx * lineHeight);
          });
        } else if (el.type === 'image' && el.imageSrc) {
          await new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => {
              ctx.drawImage(img, 0, 0, pw, ph);
              resolve();
            };
            img.onerror = () => resolve();
            img.src = el.imageSrc!;
          });
        }

        ctx.restore();
      }

      const dataUrl = canvas.toDataURL('image/png');
      onSendToSlicer(dataUrl, 'arte-criada-fatiart');
    } finally {
      setIsCompiling(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[240px_1fr_320px] min-h-[640px] bg-white border border-slate-200 rounded-xl overflow-hidden shadow-xs">
      {/* Left Element Palette */}
      <aside className="border-b lg:border-b-0 lg:border-r border-slate-200 p-4 flex flex-col gap-5 bg-slate-50/70">
        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Adicionar ao Pôster
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={addText}
              className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              <Type className="w-4 h-4 text-slate-700" />
              Texto
            </button>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center justify-center gap-1.5 p-3 bg-white border border-slate-200 rounded-lg hover:border-slate-300 hover:bg-slate-50 text-xs font-medium text-slate-700 transition-colors cursor-pointer"
            >
              <ImagePlus className="w-4 h-4 text-slate-700" />
              Imagem
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleUploadImage}
            />
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Formas Geométricas
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            <button
              type="button"
              onClick={() => addShape('rect')}
              title="Retângulo"
              className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <Square className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => addShape('circle')}
              title="Círculo"
              className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <Circle className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => addShape('star')}
              title="Estrela"
              className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <Star className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => addShape('triangle')}
              title="Triângulo"
              className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 flex items-center justify-center text-slate-700 cursor-pointer"
            >
              <Triangle className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2.5">
            Ícones Vetoriais
          </h3>
          <div className="grid grid-cols-4 gap-1.5">
            {ICON_OPTIONS.map(({ kind, label }) => (
              <button
                key={kind}
                type="button"
                onClick={() => addIcon(kind)}
                title={label}
                className="p-2.5 bg-white border border-slate-200 rounded-lg hover:border-slate-300 flex items-center justify-center text-slate-700 cursor-pointer"
              >
                <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current">
                  <path d={ICON_SVG_PATHS[kind]} />
                </svg>
              </button>
            ))}
          </div>
        </div>

        <div className="pt-3 border-t border-slate-200 space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Formato da Tela
            </label>
            <select
              value={aspectId}
              onChange={(e) => setAspectId(e.target.value)}
              className="w-full text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-2 text-slate-800"
            >
              {CANVAS_ASPECTS.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-600 mb-1.5">
              Cor de Fundo
            </label>
            <div className="flex items-center gap-2">
              {['#FFFDF9', '#FFFFFF', '#0F172A', '#FEF3C7', '#ECFDF5'].map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setBgColor(c)}
                  className={`w-6 h-6 rounded-md border cursor-pointer ${
                    bgColor === c ? 'ring-2 ring-[#E85D04] border-white' : 'border-slate-300'
                  }`}
                  style={{ backgroundColor: c }}
                  aria-label={`Cor de fundo ${c}`}
                />
              ))}
              <input
                type="color"
                value={bgColor}
                onChange={(e) => setBgColor(e.target.value)}
                className="w-7 h-7 rounded border border-slate-200 cursor-pointer"
                aria-label="Cor personalizada de fundo"
              />
            </div>
          </div>
        </div>
      </aside>

      {/* Center Interactive Canvas */}
      <div
        className="drafting-grid p-6 sm:p-10 flex flex-col items-center justify-center relative overflow-auto"
        onClick={() => setSelectedId(null)}
      >
        <div
          ref={stageRef}
          className="relative shadow-lg border border-slate-300 select-none overflow-hidden"
          style={{
            backgroundColor: bgColor,
            aspectRatio: `${activeAspect.width} / ${activeAspect.height}`,
            width: activeAspect.width >= activeAspect.height ? 'min(100%, 540px)' : 'min(100%, 420px)',
          }}
        >
          {elements.map((el) => {
            const isSelected = el.id === selectedId;
            return (
              <div
                key={el.id}
                onPointerDown={(e) => startDrag(e, el)}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedId(el.id);
                }}
                style={{
                  left: `${el.x}%`,
                  top: `${el.y}%`,
                  width: `${el.width}%`,
                  height: `${el.height}%`,
                  transform: `rotate(${el.rotation}deg)`,
                  opacity: el.opacity,
                }}
                className={`absolute cursor-move group ${
                  isSelected
                    ? 'ring-2 ring-[#E85D04] ring-offset-1'
                    : 'hover:ring-1 hover:ring-slate-400/70'
                }`}
              >
                {el.type === 'text' && (
                  <div
                    className="w-full h-full flex items-center justify-center overflow-hidden leading-tight"
                    style={{
                      color: el.color,
                      fontFamily: el.fontFamily,
                      fontWeight: el.fontWeight,
                      textAlign: el.textAlign,
                      fontSize: `${((el.fontSize || 48) / 1000) * (activeAspect.width >= activeAspect.height ? 540 : 420)}px`,
                    }}
                  >
                    <span className="w-full whitespace-pre-wrap break-words">
                      {el.text}
                    </span>
                  </div>
                )}

                {el.type === 'shape' && (
                  <svg
                    viewBox="0 0 100 100"
                    preserveAspectRatio="none"
                    className="w-full h-full"
                  >
                    {el.shapeKind === 'rect' && (
                      <rect
                        x="2"
                        y="2"
                        width="96"
                        height="96"
                        fill={el.fillColor || '#E85D04'}
                        stroke={el.strokeColor || '#0F172A'}
                        strokeWidth={el.strokeWidth || 0}
                      />
                    )}
                    {el.shapeKind === 'circle' && (
                      <ellipse
                        cx="50"
                        cy="50"
                        rx="48"
                        ry="48"
                        fill={el.fillColor || '#E85D04'}
                        stroke={el.strokeColor || '#0F172A'}
                        strokeWidth={el.strokeWidth || 0}
                      />
                    )}
                    {el.shapeKind === 'triangle' && (
                      <polygon
                        points="50,2 98,98 2,98"
                        fill={el.fillColor || '#E85D04'}
                        stroke={el.strokeColor || '#0F172A'}
                        strokeWidth={el.strokeWidth || 0}
                      />
                    )}
                    {el.shapeKind === 'star' && (
                      <polygon
                        points="50,4 63,35 96,38 71,60 79,93 50,75 21,93 29,60 4,38 37,35"
                        fill={el.fillColor || '#E85D04'}
                        stroke={el.strokeColor || '#0F172A'}
                        strokeWidth={el.strokeWidth || 0}
                      />
                    )}
                  </svg>
                )}

                {el.type === 'icon' && el.iconKind && (
                  <svg
                    viewBox="0 0 24 24"
                    className="w-full h-full"
                    style={{ fill: el.fillColor || '#0F172A' }}
                  >
                    <path d={ICON_SVG_PATHS[el.iconKind]} />
                  </svg>
                )}

                {el.type === 'image' && el.imageSrc && (
                  <img
                    src={el.imageSrc}
                    alt="Elemento enviado"
                    draggable={false}
                    className="w-full h-full object-fill pointer-events-none"
                  />
                )}

                {isSelected && (
                  <div
                    onPointerDown={(e) => startResize(e, el)}
                    title="Redimensionar"
                    className="absolute -right-1.5 -bottom-1.5 w-3.5 h-3.5 bg-white border-2 border-[#E85D04] rounded-xs cursor-nwse-resize"
                  />
                )}
              </div>
            );
          })}
        </div>
        <p className="text-xs text-slate-500 mt-4">
          Clique e arraste os elementos para posicionar. Use o canto inferior direito para redimensionar.
        </p>
      </div>

      {/* Right Element Inspector */}
      <aside className="border-t lg:border-t-0 lg:border-l border-slate-200 p-4 flex flex-col justify-between gap-4 bg-white">
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-200">
            <h3 className="font-display text-sm font-bold text-slate-900">
              Propriedades do Elemento
            </h3>
            {selectedEl && (
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => moveLayer('up')}
                  title="Trazer para frente"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => moveLayer('down')}
                  title="Enviar para trás"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={duplicateSelected}
                  title="Duplicar"
                  className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={deleteSelected}
                  title="Remover"
                  className="p-1.5 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>

          {!selectedEl ? (
            <div className="py-10 text-center text-xs text-slate-500">
              Selecione um texto, forma ou ícone na tela para editar suas propriedades, ou adicione novos itens à esquerda.
            </div>
          ) : (
            <div className="space-y-3.5 text-xs">
              {selectedEl.type === 'text' && (
                <>
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      Conteúdo do Texto
                    </label>
                    <textarea
                      rows={3}
                      value={selectedEl.text || ''}
                      onChange={(e) =>
                        updateElement(selectedEl.id, { text: e.target.value })
                      }
                      className="w-full border border-slate-200 rounded-lg px-2.5 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-[#E85D04]/30"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Fonte
                      </label>
                      <select
                        value={selectedEl.fontFamily || 'Plus Jakarta Sans'}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            fontFamily: e.target.value as EditorElement['fontFamily'],
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="Plus Jakarta Sans">Jakarta Sans</option>
                        <option value="DM Sans">DM Sans</option>
                        <option value="JetBrains Mono">Mono</option>
                        <option value="Georgia">Serifada</option>
                      </select>
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Tamanho
                      </label>
                      <input
                        type="number"
                        min={16}
                        max={220}
                        value={selectedEl.fontSize || 48}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            fontSize: Number(e.target.value) || 48,
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 tabular-nums"
                      />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Cor do Texto
                      </label>
                      <input
                        type="color"
                        value={selectedEl.color || '#0F172A'}
                        onChange={(e) =>
                          updateElement(selectedEl.id, { color: e.target.value })
                        }
                        className="w-full h-8 rounded border border-slate-200 cursor-pointer"
                      />
                    </div>
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Alinhamento
                      </label>
                      <select
                        value={selectedEl.textAlign || 'center'}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            textAlign: e.target.value as 'left' | 'center' | 'right',
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 bg-white"
                      >
                        <option value="left">Esquerda</option>
                        <option value="center">Centro</option>
                        <option value="right">Direita</option>
                      </select>
                    </div>
                  </div>
                </>
              )}

              {(selectedEl.type === 'shape' || selectedEl.type === 'icon') && (
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block font-medium text-slate-600 mb-1">
                      Cor Principal
                    </label>
                    <input
                      type="color"
                      value={
                        selectedEl.fillColor === 'transparent'
                          ? '#ffffff'
                          : selectedEl.fillColor || '#E85D04'
                      }
                      onChange={(e) =>
                        updateElement(selectedEl.id, { fillColor: e.target.value })
                      }
                      className="w-full h-8 rounded border border-slate-200 cursor-pointer"
                    />
                  </div>
                  {selectedEl.type === 'shape' && (
                    <div>
                      <label className="block font-medium text-slate-600 mb-1">
                        Borda (px)
                      </label>
                      <input
                        type="number"
                        min={0}
                        max={24}
                        value={selectedEl.strokeWidth || 0}
                        onChange={(e) =>
                          updateElement(selectedEl.id, {
                            strokeWidth: Number(e.target.value) || 0,
                          })
                        }
                        className="w-full border border-slate-200 rounded-lg px-2 py-1.5 tabular-nums"
                      />
                    </div>
                  )}
                </div>
              )}

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-600">Rotação</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {selectedEl.rotation}°
                  </span>
                </div>
                <input
                  type="range"
                  min={-180}
                  max={180}
                  value={selectedEl.rotation}
                  onChange={(e) =>
                    updateElement(selectedEl.id, {
                      rotation: Number(e.target.value),
                    })
                  }
                  className="w-full accent-[#E85D04]"
                />
              </div>

              <div>
                <div className="flex justify-between mb-1">
                  <span className="font-medium text-slate-600">Opacidade</span>
                  <span className="font-mono tabular-nums text-slate-700">
                    {Math.round(selectedEl.opacity * 100)}%
                  </span>
                </div>
                <input
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(selectedEl.opacity * 100)}
                  onChange={(e) =>
                    updateElement(selectedEl.id, {
                      opacity: Number(e.target.value) / 100,
                    })
                  }
                  className="w-full accent-[#E85D04]"
                />
              </div>
            </div>
          )}
        </div>

        <div className="pt-4 border-t border-slate-200">
          <button
            type="button"
            disabled={isCompiling}
            onClick={exportToSlicer}
            className="w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white bg-[#0F172A] hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
          >
            <Send className="w-4 h-4" />
            <span>
              {isCompiling ? 'Preparando arte...' : 'Enviar para Fatiador A4'}
            </span>
          </button>
        </div>
      </aside>
    </div>
  );
};
