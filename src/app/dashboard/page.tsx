'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, RefreshCw, Boxes, ChevronDown } from 'lucide-react';
import { usePacoteStore } from '@/stores/pacoteStore';
import { TelaDashboard } from '@/components/dashboard/TelaDashboard';

export default function DashboardPage() {
  const pacotes = usePacoteStore((s) => s.pacotes);
  const sacas = usePacoteStore((s) => s.sacas);
  const sacaAtiva = usePacoteStore((s) => s.sacaAtiva);
  const resumos = usePacoteStore((s) => s.resumos);
  const carregarSacas = usePacoteStore((s) => s.carregarSacas);
  const carregarTodasSacas = usePacoteStore((s) => s.carregarTodasSacas);

  const [filtroSaca, setFiltroSaca] = React.useState<string>('__todas__');
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
    setFiltroSaca(sacaAtiva?.id ?? '__todas__');
  }, [definido, sacaAtiva]);

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

  const pacotesEscopo = React.useMemo(() => {
    if (filtroSaca === '__todas__') return pacotes;
    return pacotes.filter((p) => p.saca_id === filtroSaca);
  }, [pacotes, filtroSaca]);

  const sacaSel = React.useMemo(
    () => (filtroSaca === '__todas__' ? null : sacas.find((s) => s.id === filtroSaca) ?? null),
    [filtroSaca, sacas],
  );

  const hojeFormatado = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace('-feira', '')
    .replace(/^\w/, (c) => c.toUpperCase());

  const escopoLabel =
    filtroSaca === '__todas__'
      ? `Todas as sacas · ${sacas.length} saca${sacas.length !== 1 ? 's' : ''}`
      : sacaSel
        ? sacaSel.nome
        : 'Saca';

  const sacaParaCard = sacaSel ?? sacaAtiva;

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#05080f] via-[#0a1120] to-[#05080f] border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
      {/* barra superior da aba */}
      <div className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/10 bg-black/20">
        <Link
          href="/contagem"
          className="inline-flex items-center gap-1.5 h-9 px-2.5 rounded-xl bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10 text-[12px] font-bold transition shrink-0"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Contagem</span>
        </Link>

        <div className="flex items-center gap-2 min-w-0">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-fuchsia-500 text-white flex items-center justify-center shrink-0">
            <Boxes className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[13.5px] font-black tracking-tight text-white leading-tight">Dashboard</div>
            <div className="text-[10.5px] font-semibold text-slate-400 truncate">
              {pacotesEscopo.length} pacote{pacotesEscopo.length !== 1 ? 's' : ''} no escopo
            </div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <label className="inline-flex items-center gap-1.5">
            <span className="inline-flex items-center gap-1 text-[10.5px] font-black uppercase tracking-wider text-slate-400 shrink-0">
              <Layers className="h-3.5 w-3.5" />
              Saca
            </span>
            <div className="relative">
              <select
                value={filtroSaca}
                onChange={(e) => setFiltroSaca(e.target.value)}
                className="appearance-none h-9 pl-2.5 pr-7 rounded-xl bg-slate-900/80 border border-white/10 text-slate-100 text-[12px] font-bold cursor-pointer outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 transition"
              >
                <option value="__todas__">📋 Todas as sacas ({opcoesSacas.total})</option>
                {opcoesSacas.lista.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.aberta ? '🟢 ' : '⚪ '}
                    {s.nome} ({s.qtd})
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            </div>
          </label>

          <button
            type="button"
            onClick={() => void recarregar(true)}
            disabled={atualizando}
            className="inline-flex items-center gap-1 h-9 px-2.5 rounded-xl bg-white/5 ring-1 ring-white/10 text-slate-200 hover:bg-white/10 text-[12px] font-bold transition disabled:opacity-50 shrink-0"
            title="Atualizar dados do banco"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${atualizando ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      <div className="p-3 sm:p-4">
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
