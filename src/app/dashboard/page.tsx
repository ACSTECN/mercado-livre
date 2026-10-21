'use client';

export const dynamic = 'force-dynamic';

import * as React from 'react';
import Link from 'next/link';
import { ArrowLeft, Layers, RefreshCw, Boxes } from 'lucide-react';
import { usePacoteStore } from '@/stores/pacoteStore';
import { TelaDashboard } from '@/components/dashboard/TelaDashboard';

type Escopo = 'saca' | 'todas';

export default function DashboardPage() {
  const pacotes = usePacoteStore((s) => s.pacotes);
  const sacas = usePacoteStore((s) => s.sacas);
  const sacaAtiva = usePacoteStore((s) => s.sacaAtiva);
  const resumos = usePacoteStore((s) => s.resumos);
  const carregar = usePacoteStore((s) => s.carregar);
  const carregarSacas = usePacoteStore((s) => s.carregarSacas);
  const carregarTodasSacas = usePacoteStore((s) => s.carregarTodasSacas);

  const [escopo, setEscopo] = React.useState<Escopo>('saca');
  const [atualizando, setAtualizando] = React.useState(false);

  const recarregar = React.useCallback(
    async (modo: Escopo, comSpinner = false) => {
      if (comSpinner) setAtualizando(true);
      try {
        await carregarSacas();
        if (modo === 'todas') await carregarTodasSacas();
        else await carregar();
      } catch {
        /* noop */
      } finally {
        if (comSpinner) setAtualizando(false);
      }
    },
    [carregar, carregarSacas, carregarTodasSacas],
  );

  React.useEffect(() => {
    void recarregar(escopo, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    void recarregar(escopo, false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [escopo]);

  const pacotesEscopo = React.useMemo(() => {
    if (escopo === 'saca' && sacaAtiva) return pacotes.filter((p) => p.saca_id === sacaAtiva.id);
    return pacotes;
  }, [escopo, pacotes, sacaAtiva]);

  const hojeFormatado = new Date()
    .toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
    .replace('-feira', '')
    .replace(/^\w/, (c) => c.toUpperCase());

  const escopoLabel =
    escopo === 'todas'
      ? `Todas as sacas · ${sacas.length} saca${sacas.length !== 1 ? 's' : ''}`
      : sacaAtiva
        ? sacaAtiva.nome
        : 'Sem saca ativa · mostrando tudo';

  return (
    <div className="rounded-3xl bg-gradient-to-br from-[#05080f] via-[#0a1120] to-[#05080f] border border-white/10 shadow-2xl shadow-black/40 overflow-hidden">
      {/* barra superior da aba */}
      <div className="flex items-center gap-2 px-3 sm:px-4 py-3 border-b border-white/10 bg-black/20">
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
            <div className="text-[10.5px] font-semibold text-slate-400 truncate">{pacotesEscopo.length} pacotes no escopo</div>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-xl">
            {([
              { k: 'saca' as const, label: 'Saca atual', icon: Layers },
              { k: 'todas' as const, label: 'Todas', icon: Boxes },
            ]).map((o) => {
              const Icon = o.icon;
              const sel = escopo === o.k;
              return (
                <button
                  key={o.k}
                  type="button"
                  onClick={() => setEscopo(o.k)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11.5px] font-black transition ${
                    sel ? 'bg-gradient-to-r from-indigo-500 to-violet-500 text-white shadow-md shadow-indigo-900/40' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{o.label}</span>
                </button>
              );
            })}
          </div>

          <button
            type="button"
            onClick={() => void recarregar(escopo, true)}
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
          sacaAtiva={sacaAtiva ? { id: sacaAtiva.id, nome: sacaAtiva.nome, status: sacaAtiva.status } : null}
          hojeFormatado={hojeFormatado}
          escopoLabel={escopoLabel}
        />
      </div>
    </div>
  );
}
