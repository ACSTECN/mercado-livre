'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowLeft, Layers, RefreshCw, Boxes, ChevronDown, Check, X, Users } from 'lucide-react';
import { usePacoteStore } from '@/stores/pacoteStore';
import { TelaDashboard } from '@/components/dashboard/TelaDashboard';

const SEM_ENTREGADOR = '__sem_entregador__';

type OpcaoMulti = { id: string; nome: string; badge: number; prefixo?: string };

type Accent = 'indigo' | 'emerald';

const ACCENT: Record<Accent, { icone: string; foco: string; ativo: string; check: string; chip: string }> = {
  indigo: {
    icone: 'text-indigo-300',
    foco: 'hover:border-indigo-400/40 focus:border-indigo-400/60 focus:ring-indigo-500/20',
    ativo: 'bg-indigo-500/15 text-indigo-100 ring-1 ring-indigo-400/30',
    check: 'bg-indigo-500 text-white',
    chip: 'bg-indigo-500/25 text-indigo-100 ring-indigo-400/40',
  },
  emerald: {
    icone: 'text-emerald-300',
    foco: 'hover:border-emerald-400/40 focus:border-emerald-400/60 focus:ring-emerald-500/20',
    ativo: 'bg-emerald-500/15 text-emerald-100 ring-1 ring-emerald-400/30',
    check: 'bg-emerald-500 text-white',
    chip: 'bg-emerald-500/25 text-emerald-100 ring-emerald-400/40',
  },
};

function SeletorMulti({
  icone,
  titulo,
  label,
  textoTodas,
  opcoes,
  selecionados,
  onChange,
  total,
  accent = 'indigo',
}: {
  icone: React.ReactNode;
  titulo: string;
  label: string;
  textoTodas: string;
  opcoes: OpcaoMulti[];
  selecionados: string[];
  onChange: (ids: string[]) => void;
  total: number;
  accent?: Accent;
}) {
  const cor = ACCENT[accent];
  const [aberto, setAberto] = React.useState(false);
  const [posicao, setPosicao] = React.useState<{ top: number; right: number } | null>(null);
  const painelRef = React.useRef<HTMLDivElement | null>(null);
  const botaoRef = React.useRef<HTMLButtonElement | null>(null);

  const reposicionar = React.useCallback(() => {
    const r = botaoRef.current?.getBoundingClientRect();
    if (!r) return;
    setPosicao({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
  }, []);

  const alternar = React.useCallback(() => {
    setAberto((v) => {
      if (!v) reposicionar();
      return !v;
    });
  }, [reposicionar]);

  React.useEffect(() => {
    if (!aberto) return;
    const onDown = (ev: MouseEvent) => {
      const alvo = ev.target as Node;
      if (painelRef.current?.contains(alvo)) return;
      if (botaoRef.current?.contains(alvo)) return;
      setAberto(false);
    };
    const aoMover = () => reposicionar();
    document.addEventListener('mousedown', onDown);
    window.addEventListener('scroll', aoMover, true);
    window.addEventListener('resize', aoMover);
    return () => {
      document.removeEventListener('mousedown', onDown);
      window.removeEventListener('scroll', aoMover, true);
      window.removeEventListener('resize', aoMover);
    };
  }, [aberto, reposicionar]);

  const selecao = React.useMemo(() => new Set(selecionados), [selecionados]);

  const toggle = (id: string) => {
    onChange(selecionados.includes(id) ? selecionados.filter((x) => x !== id) : [...selecionados, id]);
  };

  return (
    <>
      <button
        ref={botaoRef}
        type="button"
        onClick={alternar}
        className={`inline-flex items-center gap-2 h-10 min-w-[210px] max-w-[320px] px-3 rounded-2xl bg-slate-900/80 border border-white/10 text-slate-100 text-[12px] font-bold cursor-pointer outline-none transition ${cor.foco}`}
      >
        <span className={`shrink-0 ${cor.icone}`}>{icone}</span>
        <span className="truncate">{label}</span>
        {selecionados.length > 0 && (
          <span className={`inline-flex items-center justify-center h-5 min-w-5 px-1.5 rounded-full text-[10px] font-black ring-1 ${cor.chip}`}>
            {selecionados.length}
          </span>
        )}
        <ChevronDown className={`h-3.5 w-3.5 ml-auto text-slate-400 shrink-0 transition-transform ${aberto ? 'rotate-180' : ''}`} />
      </button>

      {aberto && posicao && typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={painelRef}
            style={{ position: 'fixed', top: posicao.top, right: posicao.right }}
            className="w-[300px] max-w-[calc(100vw-24px)] max-h-[65vh] overflow-y-auto rounded-2xl bg-[linear-gradient(180deg,rgba(17,26,44,0.99),rgba(10,17,31,0.99))] border border-white/10 shadow-2xl z-[200] p-1.5 animate-slide-up"
          >
            <div className="flex items-center justify-between px-2 py-1.5 border-b border-white/10 mb-1">
              <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">{titulo}</p>
              {selecionados.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChange([])}
                  className="inline-flex items-center gap-1 text-[10.5px] font-bold text-slate-400 hover:text-slate-200 transition"
                >
                  <X className="h-3 w-3" />
                  Limpar
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onChange([])}
              className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold transition ${
                selecionados.length === 0 ? cor.ativo : 'text-slate-300 hover:bg-white/[0.06]'
              }`}
            >
              <span className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${selecionados.length === 0 ? cor.check : 'bg-white/5 ring-1 ring-white/15'}`}>
                {selecionados.length === 0 && <Check className="h-3 w-3" />}
              </span>
              {textoTodas}
              <span className="ml-auto text-[11px] font-black text-slate-400">{total}</span>
            </button>

            {opcoes.length > 0 && <div className="my-1 border-t border-white/10" />}

            {opcoes.map((o) => {
              const marcada = selecao.has(o.id);
              return (
                <button
                  key={o.id}
                  type="button"
                  onClick={() => toggle(o.id)}
                  className={`w-full flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold transition ${
                    marcada ? cor.ativo : 'text-slate-300 hover:bg-white/[0.06]'
                  }`}
                >
                  <span className={`h-4 w-4 rounded-md flex items-center justify-center shrink-0 ${marcada ? cor.check : 'bg-white/5 ring-1 ring-white/15'}`}>
                    {marcada && <Check className="h-3 w-3" />}
                  </span>
                  <span className="truncate text-left">
                    {o.prefixo}
                    {o.nome}
                  </span>
                  <span className="ml-auto text-[11px] font-black text-slate-400 shrink-0">{o.badge}</span>
                </button>
              );
            })}
          </div>,
          document.body,
        )}
    </>
  );
}

export default function DashboardPage() {
  const pacotes = usePacoteStore((s) => s.pacotes);
  const sacas = usePacoteStore((s) => s.sacas);
  const sacaAtiva = usePacoteStore((s) => s.sacaAtiva);
  const resumos = usePacoteStore((s) => s.resumos);
  const carregarSacas = usePacoteStore((s) => s.carregarSacas);
  const carregarTodasSacas = usePacoteStore((s) => s.carregarTodasSacas);

  const [sacasSelecionadas, setSacasSelecionadas] = React.useState<string[]>([]);
  const [entregadoresSelecionados, setEntregadoresSelecionados] = React.useState<string[]>([]);
  const [definido, setDefinido] = React.useState(false);
  const [atualizando, setAtualizando] = React.useState(false);
  const jaDefiniuRef = React.useRef(false);

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

  const opcoesSacas = React.useMemo(() => {
    const porSaca = new Map<string, number>();
    for (const p of pacotes) {
      if (!p.saca_id) continue;
      porSaca.set(p.saca_id, (porSaca.get(p.saca_id) ?? 0) + 1);
    }
    return {
      total: pacotes.length,
      lista: sacas.map<OpcaoMulti>((s) => ({
        id: s.id,
        nome: s.nome,
        badge: porSaca.get(s.id) ?? 0,
        prefixo: s.status === 'aberta' ? '🟢 ' : '⚪ ',
      })),
    };
  }, [pacotes, sacas]);

  const selecaoSacas = React.useMemo(() => new Set(sacasSelecionadas), [sacasSelecionadas]);

  const pacotesEscopo = React.useMemo(() => {
    if (!sacasSelecionadas.length) return pacotes;
    return pacotes.filter((p) => p.saca_id && selecaoSacas.has(p.saca_id));
  }, [pacotes, sacasSelecionadas, selecaoSacas]);

  const opcoesEntregadores = React.useMemo(() => {
    const porEntregador = new Map<string, number>();
    let semEntregador = 0;
    for (const p of pacotesEscopo) {
      if (p.entregador) porEntregador.set(p.entregador, (porEntregador.get(p.entregador) ?? 0) + 1);
      else semEntregador++;
    }
    const lista = Array.from(porEntregador.entries())
      .map<OpcaoMulti>(([nome, badge]) => ({ id: nome, nome, badge }))
      .sort((a, b) => b.badge - a.badge || a.nome.localeCompare(b.nome, 'pt-BR', { sensitivity: 'base' }));
    if (semEntregador > 0) {
      lista.push({ id: SEM_ENTREGADOR, nome: 'Sem entregador', badge: semEntregador, prefixo: '⚠️ ' });
    }
    return { total: pacotesEscopo.length, lista };
  }, [pacotesEscopo]);

  // descarta entregadores selecionados que deixaram de existir no escopo atual
  React.useEffect(() => {
    if (!entregadoresSelecionados.length) return;
    const validos = new Set(opcoesEntregadores.lista.map((o) => o.id));
    const filtrados = entregadoresSelecionados.filter((x) => validos.has(x));
    if (filtrados.length !== entregadoresSelecionados.length) setEntregadoresSelecionados(filtrados);
  }, [opcoesEntregadores, entregadoresSelecionados]);

  const pacotesFiltrados = React.useMemo(() => {
    if (!entregadoresSelecionados.length) return pacotesEscopo;
    const set = new Set(entregadoresSelecionados);
    return pacotesEscopo.filter((p) => set.has(p.entregador ?? SEM_ENTREGADOR));
  }, [pacotesEscopo, entregadoresSelecionados]);

  const sacasEscopoSel = React.useMemo(
    () => (sacasSelecionadas.length ? sacas.filter((s) => selecaoSacas.has(s.id)) : []),
    [sacasSelecionadas, sacas, selecaoSacas],
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

  const entregadorLabel = React.useMemo(() => {
    if (!entregadoresSelecionados.length) return 'Todos os entregadores';
    if (entregadoresSelecionados.length === 1) {
      return entregadoresSelecionados[0] === SEM_ENTREGADOR ? 'Sem entregador' : entregadoresSelecionados[0];
    }
    return `${entregadoresSelecionados.length} entregadores`;
  }, [entregadoresSelecionados]);

  const sacaParaCard = sacasEscopoSel.length === 1 ? sacasEscopoSel[0] : sacaAtiva;

  return (
    <div className="rounded-[2rem] bg-[linear-gradient(180deg,rgba(5,8,15,0.92),rgba(9,16,29,0.92))] border border-white/10 shadow-[0_30px_90px_rgba(0,0,0,0.45)]">
      {/* barra superior da aba */}
      <div className="flex flex-wrap items-center gap-3 px-4 sm:px-5 py-4 border-b border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.03),rgba(255,255,255,0.01))] rounded-t-[2rem]">
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
              {pacotesFiltrados.length} pacote{pacotesFiltrados.length !== 1 ? 's' : ''} no escopo
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2 flex-wrap">
          <SeletorMulti
            icone={<Layers className="h-3.5 w-3.5" />}
            titulo="Sacas no escopo"
            label={escopoLabel}
            textoTodas="📋 Todas as sacas"
            opcoes={opcoesSacas.lista}
            selecionados={sacasSelecionadas}
            onChange={setSacasSelecionadas}
            total={opcoesSacas.total}
            accent="indigo"
          />

          <SeletorMulti
            icone={<Users className="h-3.5 w-3.5" />}
            titulo="Entregadores no escopo"
            label={entregadorLabel}
            textoTodas="👤 Todos os entregadores"
            opcoes={opcoesEntregadores.lista}
            selecionados={entregadoresSelecionados}
            onChange={setEntregadoresSelecionados}
            total={opcoesEntregadores.total}
            accent="emerald"
          />

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
          pacotes={pacotesFiltrados}
          resumos={resumos}
          sacaAtiva={sacaParaCard ? { id: sacaParaCard.id, nome: sacaParaCard.nome, status: sacaParaCard.status } : null}
          hojeFormatado={hojeFormatado}
          escopoLabel={escopoLabel}
        />
      </div>
    </div>
  );
}
