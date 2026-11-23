import React, { useState } from 'react';
import { ChevronDown, Grid, Layers, Printer, Scissors } from 'lucide-react';
import { SampleArtwork } from '../types/poster';

interface GuideSectionsProps {
  samples: SampleArtwork[];
  onLoadSamplePreset: (sampleId: string, stencilOverride?: boolean) => void;
}

const FAQ_ITEMS = [
  {
    q: 'Como imprimir o PDF no tamanho exato sem cortes?',
    a: 'Na janela de impressão do seu computador ou leitor de PDF, selecione sempre "Tamanho Real" ou "Escala 100%". Evite a opção "Ajustar à página", pois ela reduz levemente as bordas e altera a medida em centímetros.',
  },
  {
    q: 'Para que serve a margem de sobreposição (Overlap)?',
    a: 'As impressoras domésticas não imprimem até a borda física do papel. A faixa de sobreposição repete alguns milímetros da folha vizinha para que você possa aparar apenas um dos lados na linha guia e colar as folhas por cima, sem deixar frestas brancas.',
  },
  {
    q: 'Como funciona o Modo Stencil para tatuagem?',
    a: 'Ao ativar o Modo Stencil, a imagem é convertida em preto e branco de alto contraste com limiar ajustável, destacando os traços principais e economizando tinta. Você também pode espelhar horizontalmente para transferir direto no papel hectográfico.',
  },
  {
    q: 'Minhas imagens são enviadas para algum servidor?',
    a: 'Não. Todo o processamento de imagem, filtros, divisão em grade e geração do arquivo PDF acontece localmente no seu próprio navegador, garantindo velocidade e privacidade total.',
  },
];

export const GuideSections: React.FC<GuideSectionsProps> = ({
  onLoadSamplePreset,
}) => {
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  return (
    <div className="space-y-16 pt-12 pb-16">
      {/* Como Montar */}
      <section id="como-montar" className="scroll-mt-20">
        <div className="max-w-2xl mb-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Como montar seu pôster em 3 passos
          </h2>
          <p className="text-slate-600 mt-2 text-base">
            Transforme qualquer foto, ilustração ou molde em um painel de parede usando apenas uma impressora comum A4 ou Carta.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 mb-4">
              <Grid className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              01. Envie e defina o tamanho
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Carregue sua imagem ou monte sua arte no Editor do Zero. Escolha o número de folhas (ex: 3×3) ou digite a largura final desejada em centímetros.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 mb-4">
              <Printer className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              02. Baixe e imprima em 100%
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              O PDF é gerado com numeração de linha e coluna (L1·C1), mapa de montagem opcional e opção de pular folhas totalmente brancas para economizar papel.
            </p>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6">
            <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-800 mb-4">
              <Scissors className="w-5 h-5" />
            </div>
            <h3 className="font-display text-base font-bold text-slate-900">
              03. Recorte e alinhe as faixas
            </h3>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">
              Apare as bordas seguindo as marcas de corte nas extremidades, alinhe a faixa de sobreposição de 10 mm com a folha vizinha e fixe com cola em bastão ou fita no verso.
            </p>
          </div>
        </div>
      </section>

      {/* Casos de Uso */}
      <section id="casos-de-uso" className="scroll-mt-20 border-t border-slate-200 pt-12">
        <div className="max-w-2xl mb-8">
          <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Feito para quem cria em grande escala
          </h2>
          <p className="text-slate-600 mt-2 text-base">
            Teste os fluxos prontos diretamente no fatiador com um clique.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1.5">
                Decoração &amp; Ilustração
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Pôsteres de Parede em A4
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Amplie ilustrações e fotografias em alta resolução para quadros grandes de 60×80 cm ou mais sem precisar de gráfica.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadSamplePreset('botanical', false)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start cursor-pointer"
            >
              Testar com Pôster Botânico
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1.5">
                Tatuagem &amp; Transfer
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Stencils de Tatuagem
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Divida projetos de fechamento de braço ou costas em escala real, com alto contraste de linhas e espelhamento instantâneo.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadSamplePreset('stencil', true)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start cursor-pointer"
            >
              Testar Modo Stencil
            </button>
          </div>

          <div className="bg-white border border-slate-200 rounded-xl p-6 flex flex-col justify-between gap-5">
            <div>
              <div className="text-xs font-medium text-slate-500 mb-1.5">
                Educação &amp; Eventos
              </div>
              <h3 className="font-display text-lg font-bold text-slate-900">
                Murais Escolares e Painéis
              </h3>
              <p className="text-sm text-slate-600 mt-2 leading-relaxed">
                Monte murais pedagógicos, mapas e painéis temáticos de festa com mapa de montagem numerado na primeira página.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onLoadSamplePreset('mural', false)}
              className="inline-flex items-center justify-center px-4 py-2 text-xs font-semibold text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors self-start cursor-pointer"
            >
              Testar com Mural Escolar
            </button>
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-200 pt-12">
        <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
          <div>
            <h2 className="font-display text-2xl font-bold text-slate-900 tracking-tight">
              Perguntas Frequentes
            </h2>
            <p className="text-sm text-slate-600 mt-2">
              Detalhes técnicos sobre escalas, papel e impressão doméstica.
            </p>
          </div>
          <div className="divide-y divide-slate-200 border border-slate-200 rounded-xl bg-white overflow-hidden">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = openFaq === idx;
              return (
                <div key={item.q}>
                  <button
                    type="button"
                    onClick={() => setOpenFaq(isOpen ? null : idx)}
                    className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-slate-50 transition-colors cursor-pointer"
                  >
                    <span className="font-display text-sm font-semibold text-slate-900">
                      {item.q}
                    </span>
                    <ChevronDown
                      className={`w-4 h-4 text-slate-500 shrink-0 transition-transform ${
                        isOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-4 text-sm text-slate-600 leading-relaxed">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-200 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-2 text-slate-700 font-medium">
          <Layers className="w-4 h-4 text-[#E85D04]" />
          <span>FatiArt Studio — Fatiador de Imagens para Impressão em A4, Carta e A3</span>
        </div>
        <span>Processamento 100% local no navegador</span>
      </footer>
    </div>
  );
};
