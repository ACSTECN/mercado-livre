'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, Layers, RefreshCw, Boxes, ChevronDown, Check, X } from 'lucide-react';
import { usePacoteStore } from '@/stores/pacoteStore';
import { TelaDashboard } from '@/components/dashboard/TelaDashboard';

export default function DashboardPage() {
  const pacotes = usePacoteStore((s) => s.pacotes);
  const sacas = usePacoteStore((s) => s.sacas);
  const sacaAtiva = usePacoteStore((s) => s.sacaAtiva);
  const resumos = usePacoteStore((s) => s.resumos);
  const carregarSacas = usePacoteStore((s) => s.carregarSacas);
  const carregarTodasSacas = usePacoteStore((s) => s.carregarTodasSacas);

  const [sacasSelecionadas, setSacasSelecionadas] = React.useState<string[]>([]);
  const [definido, setDefinido] = React.useState(false);
  const [atualizando, setAtualizando] = React.useState(false);
  const [dropdownAberto, setDropdownAberto] = React.useState(false);
  const [posicao, setPosicao] = React.useState<{ top: number; right: number } | null>(null);
  const jaDefiniuRef = React.useRef(false);
  const dropdownRef = React.useRef<HTMLDivElement | null>(null);
  const botaoRef = React.useRef<HTMLButtonElement | null>(null);

  const reposicionar = React.useCallback(() => {
    const r = botaoRef.current?.getBoundingClientRect();
    if (!r) return;
    setPosicao({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
  }, []);

  const alternarDropdown = React.useCallback(() => {
    setDropdownAberto((v) => {
      if (!v) reposicionar();
      return !v;
    });
  }, [reposicionar]);

  const recarregar = React.useCallback(
    async (comSpinner = false) => {
      if (comSpinner) setAtualizando(true);
      try {
        await carregarSacas();
        await carregarTodasSacas();
      } catch {
        /* noop */
      } finally {
        if (comSpinner) setAtualizando(false);
      }
    },
    [carregarSacas, carregarTodasSacas],
  );

  React.useEffect(() => {
    void (async () => {
      await recarregar(false);
      setDefinido(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // define a saca padrão (a ativa) após o primeiro carregamento
  React.useEffect(() => {
    if (!definido || jaDefiniuRef.current) return;
    jaDefiniuRef.current = true;
    setSacasSelecionadas(sacaAtiva?.id ? [sacaAtiva.id] : []);
  }, [definido, sacaAtiva]);

  // fecha o dropdown ao clicar fora
  React.useEffect(() => {
    if (!dropdownAberto) return;
    const onDown = (ev: MouseEvent) => {
      const alvo = ev.target as Node;
      if (dropdownRef.current?.contains(alvo)) return;
      if (botaoRef.current?.contains(alvo)) return;
      setDropdownAberto(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [dropdownAberto]);

  // reposiciona enquanto aberto (scroll/resize)
  React.useEffect(() => {
    if (!dropdownAberto) return;
    const aoMover = () => reposicionar();
    window.addEventListener('scroll', aoMover, true);
    window.addEventListener('resize', aoMover);
    return () => {
      window.removeEventListener('scroll', aoMover, true);
      window.removeEventListener('resize', aoMover);
    };
  }, [dropdownAberto, reposicionar]);

  const opcoesSacas = React.useMemo(() => {
    const porSaca = new Map<string, number>();
    for (const p of pacotes) {
      if (!p.saca_id) continue;
      porSaca.set(p.saca_id, (porSaca.get(p.saca_id) ?? 0) + 1);
    }
    return {
      total: pacotes.length,
      lista: sacas.map((s) => ({
        id: s.id,
        nome: s.nome,
        qtd: porSaca.get(s.id) ?? 0,
        aberta: s.status === 'aberta',
      })),
    };
  }, [pacotes, sacas]);

  const selecaoSet = React.useMemo(() => new Set(sacasSelecionadas), [sacasSelecionadas]);

  const toggleSaca = React.useCallback((id: string) => {
    setSacasSelecionadas((atual) => (atual.includes(id) ? atual.filter((x) => x !== id) : [...atual, id]));
  }, []);

  const pacotesEscopo = React.useMemo(() => {
    if (!sacasSelecionadas.length) return pacotes;
    return pacotes.filter((p) => p.saca_id && selecaoSet.has(p.saca_id));
  }, [pacotes, sacasSelecionadas, selecaoSet]);

  const sacasEscopoSel = React.useMemo(
    () => (sacasSelecionadas.length ? sacas.filter((s) => selecaoSet.has(s.id)) : []),
    [sacasSelecionadas, sacas, selecaoSet],
  );

  const hojeFormatado = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace('-feira', '')
    .replace(/^\w/, (c) => c.toUpperCase());

  const escopoLabel = React.useMemo(() => {
    if (!sacasSelecionadas.length) return `Todas as sacas · ${sacas.length} saca${sacas.length !== 1 ? 's' : ''}`;
    if (sacasEscopoSel.length === 1) return sacasEscopoSel[0].nome;
    return `${sacasEscopoSel.length} sacas selecionadas`;
  }, [sacasSelecionadas, sacas.length, sacasEscopoSel]);

  const sacaParaCard = sacasEscopoSel.length === 1 ? sacasEscopoSel[0] : sacaAtiva;

  return (
    <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(5,8,15,0.92),rgba(9,16,29,0.92))] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.45)] overflow-hidden">
      {/* barra superior da aba */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))]">
        <Link
          href="/contagem"
          className="inline-flex items-center gap-1.5 h-10 px-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10 text-[12px] font-bold transition shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Contagem</span>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-10 w-10 rounded-2xl bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0 shadow-[0_14px_28px_rgba(99,102,241,0.28)]">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-black tracking-tight text-white leading-tight">Dashboard</div>
            <div className="text-[10.5px] font-semibold text-slate-400 truncate">
              {pacotesEscopo.length} pacote{pacotesEscopo.length !== 1 ? 's' : ''} no escopo
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <div className="relative">
            <button
              ref={botaoRef}
              type="button"
              onClick={alternarDropdown}
              className="inline-flex items-center gap-2 h-10 min-w-[220px] max-w-[320px] px-3 rounded-2xl bg-slate-900/80 border border-white/10 text-slate-100 text-[12px] font-bold cursor-pointer outline-none hover:border-indigo-400/40 focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 transition"
            >
              <Layers className="h-3.5 w-3.5 text-indigo-300 shrink-0" />
              <span className="truncate">{escopoLabel}</span>
              {sacasSelecionadas.length > 0 && (
                <span className="inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full bg-indigo-500/25 text-indigo-100 text-[10px] font-black ring-1 ring-indigo-400/40">
                  {sacasSelecionadas.length}
                </span>
              )}
              <ChevronDown className={`h-3.5 w-3.5 ml-auto text-slate-400 shrink-0 transition-transform ${dropdownAberto ? 'rotate-180' : ''}`} />
            </button>

            {dropdownAberto && posicao && typeof document !== 'undefined' &&
              createPortal(
                <div
                  ref={dropdownRef}
                  style={{ position: 'fixed', top: posicao.top, right: posicao.right }}
                  className="w-[300px] max-w-[calc(100vw-24px)] max-h-[65vh] overflow-y-auto rounded-2xl bg-[linear-gradient(180deg,rgba(17,26,44,0.99),rgba(10,17,31,0.99))] border border-white/10 shadow-2xl z-[200] p-1.5 animate-slide-up"
                >
                  <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10 mb-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Sacas no escopo</p>
                    {sacasSelecionadas.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setSacasSelecionadas([])}
                        className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-400 hover:text-slate-200 transition"
                      >
                        <X className="h-3 w-3" />
                        Limpar
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => setSacasSelecionadas([])}
                    className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold transition ${
                      sacasSelecionadas.length === 0 ? 'bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/30' : 'text-slate-300 hover:bg-white/[0.06]'
                    }`}
                  >
                    <span className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${sacasSelecionadas.length === 0 ? 'bg-indigo-500 text-white' : 'bg-white/5 ring-1 ring-white/15'}`}>
                      {sacasSelecionadas.length === 0 && <Check className="h-3 w-3" />}
                    </span>
                    📋 Todas as sacas
                    <span className="ml-auto text-[11px] font-black text-slate-400">{opcoesSacas.total}</span>
                  </button>

                  <div className="my-1 border-t border-white/10" />

                  {opcoesSacas.lista.map((s) => {
                    const marcada = selecaoSet.has(s.id);
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => toggleSaca(s.id)}
                        className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold transition ${
                          marcada ? 'bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/30' : 'text-slate-300 hover:bg-white/[0.06]'
                        }`}
                      >
                        <span className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${marcada ? 'bg-indigo-500 text-white' : 'bg-white/5 ring-1 ring-white/15'}`}>
                          {marcada && <Check className="h-3 w-3" />}
                        </span>
                        <span className="truncate text-left">
                          {s.aberta ? '🟢 ' : '⚪ '}
                          {s.nome}
                        </span>
                        <span className="ml-auto text-[11px] font-black text-slate-400 shrink-0">{s.qtd}</span>
                      </button>
                    );
                  })}
                </div>,
                document.body,
              )}
          </div>

          <button
            type="button"
            onClick={() => void recarregar(true)}
            disabled={atualizando}
            className="inline-flex items-center gap-1 h-10 px-3 rounded-2xl bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10 text-[12px] font-bold transition disabled:opacity-50 shrink-0"
            title="Atualizar dados do banco"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      <div className="p-4 sm:p-5">
        <TelaDashboard
          pacotes={pacotesEscopo}
          resumos={resumos}
          sacaAtiva={sacaParaCard ? { id: sacaParaCard.id, nome: sacaParaCard.nome, status: sacaParaCard.status } : null}
          hojeFormatado={hojeFormatado}
          escopoLabel={escopoLabel}
        />
      </div>
    </div>
  );
}
