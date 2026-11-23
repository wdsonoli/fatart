import React from 'react';
import { Download } from 'lucide-react';

interface TopBarProps {
  onDownloadPdf: () => void;
  isExporting: boolean;
  canExport: boolean;
  onNavigateSection: (sectionId: string, switchMode?: 'slicer' | 'visual' | 'creator') => void;
}

export const TopBar: React.FC<TopBarProps> = ({
  onDownloadPdf,
  isExporting,
  canExport,
  onNavigateSection,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-slate-200/80">
      <div className="max-w-[1440px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
        {/* Zone 1: Single-element Brand Zone */}
        <a
          href="#workspace"
          onClick={(e) => {
            e.preventDefault();
            onNavigateSection('workspace', 'slicer');
          }}
          className="flex items-center gap-2.5 text-slate-900 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#E85D04] rounded-md"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
            className="shrink-0"
          >
            <rect x="2" y="2" width="9" height="9" rx="1.5" fill="#0F172A" />
            <rect x="13" y="2" width="9" height="9" rx="1.5" fill="#E85D04" />
            <rect x="2" y="13" width="9" height="9" rx="1.5" fill="#0F172A" fillOpacity="0.22" />
            <rect x="13" y="13" width="9" height="9" rx="1.5" fill="#0F172A" />
          </svg>
          <span className="font-display text-lg font-extrabold tracking-tight">
            FatiArt
          </span>
        </a>

        {/* Zone 2: 4 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
          <button
            type="button"
            onClick={() => onNavigateSection('workspace', 'slicer')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Fatiador A4
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('workspace', 'visual')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Ajuste Visual
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('workspace', 'creator')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Editor do Zero
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('como-montar')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Como Montar
          </button>
          <button
            type="button"
            onClick={() => onNavigateSection('casos-de-uso')}
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Casos de Uso
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={!canExport || isExporting}
            className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-[#E85D04] hover:bg-[#D44E00] disabled:bg-slate-300 disabled:cursor-not-allowed rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#E85D04]"
          >
            <Download className="w-4 h-4 shrink-0" />
            <span>{isExporting ? 'Gerando PDF...' : 'Baixar PDF'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
