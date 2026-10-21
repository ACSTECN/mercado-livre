'use client';

import * as React from 'react';
import {
  Package,
  CheckCircle2,
  CheckCheck,
  Truck,
  RefreshCw,
  Undo2,
  Users,
  Layers,
  BarChart3,
  PieChart as PieIcon,
  TrendingUp,
  Boxes,
  Clock,
  Sparkles,
  MapPin,
  Search,
  SlidersHorizontal,
  X,
  Gauge,
  Activity,
} from 'lucide-react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Cell,
  PieChart,
  Pie,
  AreaChart,
  Area,
} from 'recharts';
import type { PacoteLidoLocal, StatusPacote } from '@/types';
import { STATUS_PACOTE_META } from '@/types';

/* ============================ Tipos ============================ */

export type ContagemEntregador = {
  nome: string;
  qtd: number;
  retornos: number;
  entregues: number;
  devolucoes: number;
  lidos: number;
};

export type ContagemZona = ContagemEntregador & { entregadores: number };

export type ResumoSacaDash = {
  saca: { id: string; nome: string; created_at: string; status: string };
  total: number;
  unicos: number;
};

type Metrica = 'total' | 'lidos' | 'entregues' | 'retornos' | 'devolucoes';

const METRICAS: Array<{ k: Metrica; label: string; cor: string }> = [
  { k: 'total', label: 'Total', cor: '#818cf8' },
  { k: 'lidos', label: 'Lidos', cor: '#38bdf8' },
  { k: 'entregues', label: 'Entregues', cor: '#34d399' },
  { k: 'retornos', label: 'Retornos', cor: '#fb923c' },
  { k: 'devolucoes', label: 'Devoluções', cor: '#fb7185' },
];

const PALETA_DASH = [
  '#6366f1',
  '#22c55e',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#8b5cf6',
  '#ef4444',
  '#14b8a6',
  '#f97316',
  '#3b82f6',
  '#a855f7',
  '#10b981',
];

const corMetrica = (m: Metrica): string => METRICAS.find((x) => x.k === m)?.cor ?? '#818cf8';

const valorMetrica = (c: ContagemEntregador, m: Metrica): number => {
  switch (m) {
    case 'lidos':
      return c.lidos ?? 0;
    case 'entregues':
      return c.entregues ?? 0;
    case 'retornos':
      return c.retornos ?? 0;
    case 'devolucoes':
      return c.devolucoes ?? 0;
    default:
      return c.qtd;
  }
};

const encurtar = (s: string, max = 14): string => (s.length > max ? s.slice(0, max - 1) + '…' : s);

const pct = (n: number, tot: number): string => (!tot ? '0' : ((n / tot) * 100).toFixed(1));

/* ============================ Helpers de cálculo ============================ */

function calcularContagemEntregadores(pacotes: PacoteLidoLocal[]): ContagemEntregador[] {
  const q = new Map<string, number>();
  const re = new Map<string, number>();
  const en = new Map<string, number>();
  const de = new Map<string, number>();
  const li = new Map<string, number>();
  for (const p of pacotes) {
    const k = p.entregador ?? 'Sem entregador';
    q.set(k, (q.get(k) ?? 0) + 1);
    if (p.status === 'retorno') re.set(k, (re.get(k) ?? 0) + 1);
    if (p.status === 'entregue') en.set(k, (en.get(k) ?? 0) + 1);
    if (p.status === 'devolucao') de.set(k, (de.get(k) ?? 0) + 1);
    if (p.status === 'lido') li.set(k, (li.get(k) ?? 0) + 1);
  }
  const out: ContagemEntregador[] = [];
  for (const [nome, qtd] of q.entries()) {
    out.push({
      nome,
      qtd,
      retornos: re.get(nome) ?? 0,
      entregues: en.get(nome) ?? 0,
      devolucoes: de.get(nome) ?? 0,
      lidos: li.get(nome) ?? 0,
    });
  }
  return out.sort((a, b) => b.qtd - a.qtd);
}

function calcularContagemZonas(pacotes: PacoteLidoLocal[]): ContagemZona[] {
  const q = new Map<string, number>();
  const re = new Map<string, number>();
  const en = new Map<string, number>();
  const de = new Map<string, number>();
  const li = new Map<string, number>();
  const ent = new Map<string, Set<string>>();
  for (const p of pacotes) {
    const k = p.zona_ml ?? '— Sem zona —';
    q.set(k, (q.get(k) ?? 0) + 1);
    if (p.status === 'retorno') re.set(k, (re.get(k) ?? 0) + 1);
    if (p.status === 'entregue') en.set(k, (en.get(k) ?? 0) + 1);
    if (p.status === 'devolucao') de.set(k, (de.get(k) ?? 0) + 1);
    if (p.status === 'lido') li.set(k, (li.get(k) ?? 0) + 1);
    if (p.entregador) {
      const s = ent.get(k) ?? new Set<string>();
      s.add(p.entregador);
      ent.set(k, s);
    }
  }
  const out: ContagemZona[] = [];
  for (const [nome, qtd] of q.entries()) {
    out.push({
      nome,
      qtd,
      retornos: re.get(nome) ?? 0,
      entregues: en.get(nome) ?? 0,
      devolucoes: de.get(nome) ?? 0,
      lidos: li.get(nome) ?? 0,
      entregadores: ent.get(nome)?.size ?? 0,
    });
  }
  return out.sort((a, b) => b.qtd - a.qtd);
}

/* ============================ Subcomponentes ============================ */

function CartaoEscuro({
  children,
  className = '',
  glow = 'from-indigo-500/30',
}: {
  children: React.ReactNode;
  className?: string;
  glow?: string;
}) {
  return (
    <div
      className={`relative rounded-2xl border border-white/10 bg-slate-900/60 backdrop-blur-sm shadow-lg shadow-black/20 overflow-hidden ${className}`}
    >
      <div className={`pointer-events-none absolute -top-16 -right-10 h-32 w-32 rounded-full bg-gradient-to-br ${glow} to-transparent blur-2xl`} />
      <div className="relative">{children}</div>
    </div>
  );
}

function TituloCartao({
  icon: Icon,
  titulo,
  sub,
  grad,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>;
  titulo: string;
  sub?: string;
  grad: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-end justify-between gap-3 mb-3">
      <div>
        <div className="flex items-center gap-2">
          <div className={`h-7 w-7 rounded-lg bg-gradient-to-br ${grad} text-white flex items-center justify-center shadow-md shadow-black/30`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
          <h3 className="text-[14px] font-black tracking-tight text-white">{titulo}</h3>
        </div>
        {sub && <p className="text-[11.5px] font-medium text-slate-400 mt-0.5">{sub}</p>}
      </div>
      {badge}
    </div>
  );
}

function Vazio({ icon: Icon, titulo, sub }: { icon: React.ComponentType<{ className?: string }>; titulo: string; sub?: string }) {
  return (
    <div className="py-12 text-center rounded-xl bg-slate-800/40 border border-dashed border-white/10">
      <div className="h-12 w-12 mx-auto rounded-xl bg-slate-800 text-slate-500 flex items-center justify-center mb-2.5">
        <Icon className="h-6 w-6" />
      </div>
      <div className="text-[13px] font-bold text-slate-200">{titulo}</div>
      {sub && <div className="text-[11.5px] text-slate-400 mt-0.5">{sub}</div>}
    </div>
  );
}

const selectCls =
  'h-9 rounded-xl bg-slate-900/80 border border-white/10 text-slate-100 text-[12px] font-semibold px-2.5 outline-none focus:border-indigo-400/60 focus:ring-2 focus:ring-indigo-500/20 transition';

/* ============================ Componente principal ============================ */

export function TelaDashboard({
  pacotes,
  resumos,
  sacaAtiva,
  hojeFormatado,
  escopoLabel,
}: {
  pacotes: PacoteLidoLocal[];
  resumos: ResumoSacaDash[];
  sacaAtiva: { id: string; nome: string; status: string } | null;
  hojeFormatado: string;
  escopoLabel?: string;
}) {
  const [busca, setBusca] = React.useState('');
  const [filtroEntregador, setFiltroEntregador] = React.useState('__todos__');
  const [filtroStatus, setFiltroStatus] = React.useState<'__todos__' | '__sem_status__' | StatusPacote>('__todos__');
  const [filtroZona, setFiltroZona] = React.useState('__todas__');
  const [metrica, setMetrica] = React.useState<Metrica>('total');

  const opcoesEntregadores = React.useMemo(() => {
    const s = new Set<string>();
    let sem = false;
    for (const p of pacotes) {
      if (p.entregador) s.add(p.entregador);
      else sem = true;
    }
    return { lista: Array.from(s).sort((a, b) => a.localeCompare(b)), sem };
  }, [pacotes]);

  const opcoesZonas = React.useMemo(() => {
    const s = new Set<string>();
    for (const p of pacotes) if (p.zona_ml) s.add(p.zona_ml);
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [pacotes]);

  const filtrados = React.useMemo(() => {
    let lista = pacotes;
    if (filtroEntregador !== '__todos__') {
      if (filtroEntregador === '__sem__') lista = lista.filter((p) => !p.entregador);
      else lista = lista.filter((p) => p.entregador === filtroEntregador);
    }
    if (filtroStatus !== '__todos__') {
      if (filtroStatus === '__sem_status__') lista = lista.filter((p) => !p.status);
      else lista = lista.filter((p) => p.status === filtroStatus);
    }
    if (filtroZona !== '__todas__') {
      if (filtroZona === '__sem__') lista = lista.filter((p) => !p.zona_ml);
      else lista = lista.filter((p) => p.zona_ml === filtroZona);
    }
    const q = busca.trim().toLowerCase();
    if (!q) return lista;
    return lista.filter(
      (p) =>
        p.codigo_pacote.toLowerCase().includes(q) ||
        (p.entregador ?? '').toLowerCase().includes(q) ||
        (p.zona_ml ?? '').toLowerCase().includes(q) ||
        (p.tipo ?? '').toLowerCase().includes(q),
    );
  }, [pacotes, filtroEntregador, filtroStatus, filtroZona, busca]);

  const temFiltro =
    busca.trim() !== '' || filtroEntregador !== '__todos__' || filtroStatus !== '__todos__' || filtroZona !== '__todas__';

  const limparFiltros = () => {
    setBusca('');
    setFiltroEntregador('__todos__');
    setFiltroStatus('__todos__');
    setFiltroZona('__todas__');
  };

  const total = filtrados.length;
  const unicos = React.useMemo(() => new Set(filtrados.map((p) => p.codigo_pacote)).size, [filtrados]);

  const contagensEntregadores = React.useMemo(() => calcularContagemEntregadores(filtrados), [filtrados]);
  const contagensZonas = React.useMemo(() => calcularContagemZonas(filtrados), [filtrados]);

  const retornos = React.useMemo(() => filtrados.filter((p) => p.status === 'retorno').length, [filtrados]);
  const entregues = React.useMemo(() => filtrados.filter((p) => p.status === 'entregue').length, [filtrados]);
  const devolucoes = React.useMemo(() => filtrados.filter((p) => p.status === 'devolucao').length, [filtrados]);
  const lidos = React.useMemo(() => filtrados.filter((p) => p.status === 'lido').length, [filtrados]);

  const entregadoresAtivos = contagensEntregadores.filter((c) => c.qtd > 0).length;
  const mediaPorEntregador = entregadoresAtivos > 0 ? total / entregadoresAtivos : 0;
  const taxaRetornos = total > 0 ? (retornos / total) * 100 : 0;
  const taxaUnicos = total > 0 ? (unicos / total) * 100 : 0;
  const duplicadosBloqueados = Math.max(0, total - unicos);

  const corM = corMetrica(metrica);

  const dadosBarrasEntregador = React.useMemo(() => {
    const ordenado = [...contagensEntregadores].sort((a, b) => valorMetrica(b, metrica) - valorMetrica(a, metrica));
    return ordenado
      .map((c, idx) => ({
        nome: encurtar(c.nome),
        nomeCompleto: c.nome,
        cor: PALETA_DASH[idx % PALETA_DASH.length],
        principal: metrica === 'total' ? c.qtd - c.retornos : valorMetrica(c, metrica),
        retornos: metrica === 'total' ? c.retornos : 0,
        total: valorMetrica(c, metrica),
      }))
      .filter((d) => d.total > 0);
  }, [contagensEntregadores, metrica]);

  const maxBarra = React.useMemo(() => Math.max(1, ...dadosBarrasEntregador.map((d) => d.total)), [dadosBarrasEntregador]);

  const dadosDonut = React.useMemo(
    () =>
      contagensEntregadores
        .map((c, idx) => ({
          name: encurtar(c.nome),
          fullName: c.nome,
          value: c.qtd,
          fill: PALETA_DASH[idx % PALETA_DASH.length],
        }))
        .filter((d) => d.value > 0),
    [contagensEntregadores],
  );

  const dadosLinhaHorario = React.useMemo(() => {
    const buckets = new Array(24).fill(0);
    for (const p of filtrados) {
      try {
        const h = new Date(p.created_at).getHours();
        if (Number.isFinite(h) && h >= 0 && h < 24) buckets[h] += 1;
      } catch {
        /* noop */
      }
    }
    return buckets.map((v, i) => ({ hora: `${String(i).padStart(2, '0')}h`, qtd: v }));
  }, [filtrados]);

  const dadosUltimasSacas = React.useMemo(() => {
    const ultimas = [...resumos]
      .sort((a, b) => (b.saca.created_at ?? '').localeCompare(a.saca.created_at ?? ''))
      .slice(0, 7);
    return ultimas
      .map((r) => ({
        nome: encurtar(r.saca.nome, 10),
        nomeCompleto: r.saca.nome,
        total: r.total,
        unicos: r.unicos,
        status: r.saca.status,
      }))
      .reverse();
  }, [resumos]);

  const origemDistribuicao = React.useMemo(() => {
    const m = new Map<string, number>();
    m.set('camera', 0);
    m.set('leitor_externo', 0);
    m.set('manual', 0);
    for (const p of filtrados) {
      const k = p.origem ?? 'leitor_externo';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return [
      { name: 'Câmera', value: m.get('camera') ?? 0, fill: '#6366f1' },
      { name: 'Leitor', value: m.get('leitor_externo') ?? 0, fill: '#10b981' },
      { name: 'Manual', value: m.get('manual') ?? 0, fill: '#f59e0b' },
    ].filter((o) => o.value > 0);
  }, [filtrados]);

  const zonasReais = React.useMemo(() => contagensZonas.filter((z) => z.nome !== '— Sem zona —'), [contagensZonas]);

  const dadosBarrasZona = React.useMemo(() => {
    return [...zonasReais]
      .sort((a, b) => valorMetrica(b, metrica) - valorMetrica(a, metrica))
      .map((z, idx) => ({
        nome: encurtar(z.nome, 12),
        nomeCompleto: z.nome,
        cor: PALETA_DASH[(idx + 3) % PALETA_DASH.length],
        principal: metrica === 'total' ? z.qtd - z.retornos : valorMetrica(z, metrica),
        retornos: metrica === 'total' ? z.retornos : 0,
        total: valorMetrica(z, metrica),
      }))
      .filter((d) => d.total > 0);
  }, [zonasReais, metrica]);

  const tooltipStyle = React.useMemo(
    () => ({
      borderRadius: 14,
      border: '1px solid rgba(255,255,255,0.12)',
      background: 'rgba(15,23,42,0.96)',
      color: '#e2e8f0',
      boxShadow: '0 18px 40px -12px rgba(0,0,0,0.7)',
      fontSize: 12.5,
      fontWeight: 600,
      padding: '10px 12px',
    }),
    [],
  );

  const kpis = [
    { label: 'Total lidos', valor: total, sub: 'registros recebidos', icon: Package, grad: 'from-indigo-500 to-violet-500', badge: null as string | null },
    { label: 'Únicos', valor: unicos, sub: `${taxaUnicos.toFixed(1)}% aproveit.`, icon: CheckCircle2, grad: 'from-emerald-500 to-teal-500', badge: duplicadosBloqueados > 0 ? `${duplicadosBloqueados} dup` : null },
    { label: 'Lidos', valor: lidos, sub: 'marcados lido', icon: CheckCheck, grad: 'from-sky-500 to-blue-500', badge: lidos > 0 ? `${pct(lidos, total)}%` : null },
    { label: 'Entregues', valor: entregues, sub: 'marcados entregue', icon: Truck, grad: 'from-teal-500 to-emerald-600', badge: entregues > 0 ? `${pct(entregues, total)}%` : null },
    { label: 'Retornos', valor: retornos, sub: `${taxaRetornos.toFixed(1)}% do total`, icon: RefreshCw, grad: 'from-orange-500 to-amber-500', badge: taxaRetornos > 15 ? 'ALTO' : null },
    { label: 'Devoluções', valor: devolucoes, sub: 'marcados devolução', icon: Undo2, grad: 'from-rose-500 to-pink-500', badge: devolucoes > 0 ? `${pct(devolucoes, total)}%` : null },
    { label: 'Média / Entr.', valor: mediaPorEntregador.toFixed(mediaPorEntregador >= 10 ? 0 : 1), sub: `${entregadoresAtivos} ativo${entregadoresAtivos !== 1 ? 's' : ''}`, icon: Users, grad: 'from-violet-500 to-fuchsia-500', badge: null as string | null },
    { label: 'Sacas', valor: resumos.length, sub: sacaAtiva ? (sacaAtiva.status === 'aberta' ? '1 aberta agora' : 'todas fechadas') : 'sem ativa', icon: Layers, grad: 'from-fuchsia-500 to-purple-600', badge: sacaAtiva?.status === 'aberta' ? 'ABERTA' : null },
  ];

  return (
    <div className="space-y-3 sm:space-y-4">
      {/* ===== CABEÇALHO ===== */}
      <CartaoEscuro className="p-3 sm:p-4" glow="from-violet-500/40">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="h-10 w-10 shrink-0 rounded-xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 text-white flex items-center justify-center shadow-lg shadow-violet-900/40">
              <Activity className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-[16px] sm:text-[18px] font-black tracking-tight text-white leading-tight">
                Painel operacional
              </h2>
              <div className="flex items-center gap-1.5 mt-0.5 text-[11px] font-semibold text-slate-400">
                <span className="inline-flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
                  {escopoLabel ?? (sacaAtiva ? sacaAtiva.nome : 'Sem saca ativa')}
                </span>
                <span className="text-slate-600">•</span>
                <span className="truncate">{hojeFormatado}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1.5 ml-auto flex-wrap">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-[10.5px] font-black uppercase tracking-wider">
              <Gauge className="h-3 w-3 text-emerald-400" />
              {filtrados.length} pacote{filtrados.length !== 1 ? 's' : ''}
            </span>
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white/5 ring-1 ring-white/10 text-slate-300 text-[10.5px] font-black uppercase tracking-wider">
              <Sparkles className="h-3 w-3 text-amber-400" />
              {contagensZonas.filter((z) => z.nome !== '— Sem zona —').length} zona{contagensZonas.filter((z) => z.nome !== '— Sem zona —').length !== 1 ? 's' : ''}
            </span>
          </div>
        </div>

        {/* ===== FILTROS ===== */}
        <div className="mt-3 pt-3 border-t border-white/10 flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 flex-1 min-w-[180px] h-9 rounded-xl bg-slate-900/80 border border-white/10 px-2.5 focus-within:border-indigo-400/60 focus-within:ring-2 focus-within:ring-indigo-500/20 transition">
            <Search className="h-3.5 w-3.5 text-slate-500 shrink-0" />
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Buscar código, entregador, zona…"
              className="flex-1 bg-transparent border-0 outline-none text-[12.5px] font-semibold text-slate-100 placeholder:text-slate-500"
            />
            {busca && (
              <button type="button" onClick={() => setBusca('')} className="text-slate-500 hover:text-slate-300">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="inline-flex items-center gap-1.5">
            <Truck className="h-3.5 w-3.5 text-indigo-400 shrink-0" />
            <select value={filtroEntregador} onChange={(e) => setFiltroEntregador(e.target.value)} className={selectCls}>
              <option value="__todos__">Todos os entregadores</option>
              {opcoesEntregadores.sem && <option value="__sem__">Sem entregador</option>}
              {opcoesEntregadores.lista.map((n) => (
                <option key={n} value={n}>
                  {n}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <MapPin className="h-3.5 w-3.5 text-rose-400 shrink-0" />
            <select value={filtroZona} onChange={(e) => setFiltroZona(e.target.value)} className={selectCls}>
              <option value="__todas__">Todas as zonas</option>
              <option value="__sem__">Sem zona</option>
              {opcoesZonas.map((z) => (
                <option key={z} value={z}>
                  {z}
                </option>
              ))}
            </select>
          </div>

          <div className="inline-flex items-center gap-1.5">
            <SlidersHorizontal className="h-3.5 w-3.5 text-sky-400 shrink-0" />
            <select
              value={filtroStatus}
              onChange={(e) => setFiltroStatus(e.target.value as typeof filtroStatus)}
              className={selectCls}
            >
              <option value="__todos__">Todos os status</option>
              <option value="__sem_status__">Sem status</option>
              {(Object.keys(STATUS_PACOTE_META) as StatusPacote[]).map((s) => (
                <option key={s} value={s}>
                  {STATUS_PACOTE_META[s].label}
                </option>
              ))}
            </select>
          </div>

          {temFiltro && (
            <button
              type="button"
              onClick={limparFiltros}
              className="inline-flex items-center gap-1 px-2.5 h-9 rounded-xl bg-rose-500/15 ring-1 ring-rose-400/30 text-rose-300 hover:bg-rose-500/25 text-[11px] font-black uppercase tracking-wider transition"
            >
              <X className="h-3.5 w-3.5" />
              Limpar filtros
            </button>
          )}
        </div>
      </CartaoEscuro>

      {/* ===== KPIs ===== */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-2 sm:gap-3">
        {kpis.map((k, i) => {
          const KIcon = k.icon;
          return (
            <CartaoEscuro key={i} className="p-3 sm:p-3.5" glow={`${k.grad.split(' ')[0].replace('from-', 'from-')}/25`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className={`h-9 w-9 shrink-0 rounded-xl bg-gradient-to-br ${k.grad} text-white flex items-center justify-center shadow-md shadow-black/40`}>
                  <KIcon className="h-4 w-4" />
                </div>
                {k.badge && (
                  <span
                    className={`shrink-0 text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md ring-1 ${
                      /ALTO|aberta/i.test(k.badge)
                        ? 'bg-rose-500/20 text-rose-300 ring-rose-400/30'
                        : 'bg-white/5 text-slate-300 ring-white/10'
                    }`}
                  >
                    {k.badge}
                  </span>
                )}
              </div>
              <div className="text-[22px] sm:text-[24px] font-black tracking-tight text-white tabular-nums leading-none">
                {typeof k.valor === 'number' ? k.valor.toLocaleString('pt-BR') : k.valor}
              </div>
              <div className="mt-1.5">
                <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 leading-none">{k.label}</div>
                <div className="text-[11.5px] font-semibold text-slate-500 mt-0.5 leading-tight">{k.sub}</div>
              </div>
            </CartaoEscuro>
          );
        })}
      </div>

      {/* ===== SELETOR DE MÉTRICA ===== */}
      <CartaoEscuro className="p-2.5 sm:p-3" glow="from-sky-500/25">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-[10.5px] font-black uppercase tracking-wider text-slate-400 px-1">
            <BarChart3 className="h-3.5 w-3.5" />
            Métrica dos gráficos
          </span>
          <div className="flex items-center gap-1 bg-black/30 p-0.5 rounded-xl flex-wrap">
            {METRICAS.map((m) => {
              const sel = metrica === m.k;
              return (
                <button
                  key={m.k}
                  type="button"
                  onClick={() => setMetrica(m.k)}
                  className={`px-2.5 py-1.5 rounded-lg text-[11.5px] font-black transition ${
                    sel ? 'text-white shadow-md' : 'text-slate-400 hover:text-slate-200'
                  }`}
                  style={sel ? { background: `linear-gradient(135deg, ${m.cor}, ${m.cor}bb)` } : undefined}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      </CartaoEscuro>

      {/* ===== LINHA 1 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <CartaoEscuro className="lg:col-span-2 p-3 sm:p-4" glow="from-indigo-500/30">
          <TituloCartao
            icon={BarChart3}
            titulo="Por entregador"
            sub={metrica === 'total' ? 'Volume de pacotes · empilhado com retornos' : `Métrica: ${METRICAS.find((m) => m.k === metrica)?.label}`}
            grad="from-indigo-500 to-violet-500"
            badge={
              entregadoresAtivos > 0 ? (
                <span className="shrink-0 text-[10.5px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-indigo-500/15 text-indigo-300 ring-1 ring-indigo-400/30">
                  {entregadoresAtivos} entreg.
                </span>
              ) : undefined
            }
          />
          {dadosBarrasEntregador.length === 0 ? (
            <Vazio icon={BarChart3} titulo="Sem dados ainda" sub="Bipe pacotes para visualizar aqui." />
          ) : (
            <>
              <div className="h-[240px] sm:h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosBarrasEntregador} margin={{ top: 8, right: 12, bottom: 8, left: -14 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={tooltipStyle}
                      formatter={(value: any, name: any) => [
                        value.toLocaleString('pt-BR'),
                        name === 'retornos' ? 'Retornos' : metrica === 'total' ? 'Normais' : METRICAS.find((m) => m.k === metrica)?.label,
                      ]}
                    />
                    <Legend
                      iconType="rect"
                      wrapperStyle={{ fontSize: 11.5, fontWeight: 700, paddingTop: 8, color: '#cbd5e1' }}
                      formatter={(value) => (
                        <span style={{ color: '#cbd5e1' }}>
                          {value === 'retornos' ? 'Retornos' : metrica === 'total' ? 'Normais' : METRICAS.find((m) => m.k === metrica)?.label}
                        </span>
                      )}
                    />
                    <Bar dataKey="principal" stackId="a" fill={corM} radius={[6, 6, 0, 0]} />
                    {metrica === 'total' && <Bar dataKey="retornos" stackId="a" fill="#f97316" radius={[6, 6, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 space-y-1.5 max-h-[220px] overflow-auto pr-1">
                {dadosBarrasEntregador.slice(0, 8).map((d, i) => (
                  <div key={i} className="group">
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: d.cor }} />
                        <span className="text-[12px] font-bold text-slate-200 truncate">{d.nomeCompleto}</span>
                      </div>
                      <div className="shrink-0 text-[11.5px] font-black tabular-nums text-slate-300 flex items-center gap-1.5">
                        <span>{d.total.toLocaleString('pt-BR')}</span>
                        {d.retornos > 0 && (
                          <span className="text-orange-300 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/15 ring-1 ring-orange-400/30">
                            <RefreshCw className="h-2.5 w-2.5" /> {d.retornos}
                          </span>
                        )}
                        <span className="text-slate-500 text-[10px]">{total > 0 ? ((d.total / total) * 100).toFixed(1) : 0}%</span>
                      </div>
                    </div>
                    <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${(d.total / maxBarra) * 100}%`, background: `linear-gradient(90deg, ${d.cor}dd, ${d.cor}88)` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </CartaoEscuro>

        <CartaoEscuro className="p-3 sm:p-4" glow="from-fuchsia-500/30">
          <TituloCartao icon={PieIcon} titulo="Distribuição" sub="Participação por entregador" grad="from-fuchsia-500 to-pink-500" />
          {dadosDonut.length === 0 ? (
            <Vazio icon={PieIcon} titulo="Sem distribuição" sub="Dados aparecem após bipe." />
          ) : (
            <>
              <div className="h-[200px] sm:h-[220px] w-full relative">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={dadosDonut}
                      cx="50%"
                      cy="50%"
                      innerRadius={58}
                      outerRadius={90}
                      paddingAngle={2}
                      stroke="rgba(2,6,23,0.9)"
                      strokeWidth={2}
                      dataKey="value"
                    >
                      {dadosDonut.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.fill} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={tooltipStyle}
                      formatter={(value: any, name: any, _p: any, payload: any) => {
                        const full = (payload as { payload?: { fullName?: string } })?.payload?.fullName ?? name;
                        return [`${value.toLocaleString('pt-BR')} (${total > 0 ? ((value / total) * 100).toFixed(1) : 0}%)`, full];
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                  <div className="text-[26px] font-black tracking-tight text-white tabular-nums leading-none">
                    {total.toLocaleString('pt-BR')}
                  </div>
                  <div className="text-[10px] font-black uppercase tracking-wider text-slate-400 mt-1">Total</div>
                </div>
              </div>
              <div className="mt-2 max-h-[160px] overflow-auto space-y-1 pr-1">
                {dadosDonut.slice(0, 10).map((d, i) => {
                  const p = total > 0 ? (d.value / total) * 100 : 0;
                  return (
                    <div key={i} className="flex items-center justify-between gap-2 py-0.5">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-sm" style={{ background: d.fill }} />
                        <span className="text-[11.5px] font-bold text-slate-200 truncate">{d.fullName}</span>
                      </div>
                      <span className="text-[11px] font-black tabular-nums text-slate-400 shrink-0">{p.toFixed(1)}%</span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CartaoEscuro>
      </div>

      {/* ===== LINHA 2 ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <CartaoEscuro className="lg:col-span-2 p-3 sm:p-4" glow="from-emerald-500/30">
          <TituloCartao
            icon={TrendingUp}
            titulo="Ritmo hoje"
            sub={`Pacotes por horário · ${hojeFormatado}`}
            grad="from-emerald-500 to-teal-500"
            badge={
              total > 0 ? (
                <span className="shrink-0 text-[10.5px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-emerald-500/15 text-emerald-300 ring-1 ring-emerald-400/30">
                  Pico{' '}
                  {(() => {
                    const m = Math.max(...dadosLinhaHorario.map((d) => d.qtd));
                    const p = dadosLinhaHorario.find((d) => d.qtd === m);
                    return `${p?.hora ?? '--'} (${m})`;
                  })()}
                </span>
              ) : undefined
            }
          />
          <div className="h-[220px] sm:h-[250px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={dadosLinhaHorario} margin={{ top: 8, right: 12, bottom: 4, left: -14 }}>
                <defs>
                  <linearGradient id="gradHorarioDark" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.5} />
                    <stop offset="95%" stopColor="#34d399" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="hora" tick={{ fontSize: 10, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={1} />
                <YAxis tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip contentStyle={tooltipStyle} formatter={(value: any) => [`${value} pacote${value !== 1 ? 's' : ''}`, 'Volume']} />
                <Area
                  type="monotone"
                  dataKey="qtd"
                  stroke="#34d399"
                  strokeWidth={2.5}
                  fill="url(#gradHorarioDark)"
                  activeDot={{ r: 4, fill: '#34d399', stroke: '#020617', strokeWidth: 2 }}
                  dot={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CartaoEscuro>

        <div className="space-y-3 sm:space-y-4">
          <CartaoEscuro className="p-3 sm:p-4" glow="from-amber-500/25">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500 text-white flex items-center justify-center">
                <Boxes className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[14px] font-black tracking-tight text-white">Origem dos dados</h3>
            </div>
            {origemDistribuicao.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-slate-800/40 border border-dashed border-white/10">
                <div className="text-[13px] font-bold text-slate-300">Sem leituras</div>
              </div>
            ) : (
              <div className="space-y-2">
                {origemDistribuicao.map((o, i) => {
                  const p = total > 0 ? (o.value / total) * 100 : 0;
                  return (
                    <div key={i}>
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <span className="text-[12px] font-bold text-slate-200 flex items-center gap-1.5">
                          <span className="h-2 w-2 rounded-full shrink-0" style={{ background: o.fill }} />
                          {o.name}
                        </span>
                        <span className="text-[11.5px] font-black tabular-nums text-slate-300">
                          {o.value.toLocaleString('pt-BR')} · {p.toFixed(1)}%
                        </span>
                      </div>
                      <div className="h-2.5 w-full bg-white/5 rounded-full overflow-hidden">
                        <div className="h-full rounded-full" style={{ width: `${p}%`, background: `linear-gradient(90deg, ${o.fill}, ${o.fill}88)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CartaoEscuro>

          <div className="rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-500 to-fuchsia-500 shadow-lg shadow-violet-900/40 p-[1px]">
            <div className="rounded-[14px] bg-slate-950/90 backdrop-blur p-3 sm:p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-sky-500 to-indigo-500 text-white flex items-center justify-center">
                  <Clock className="h-3.5 w-3.5" />
                </div>
                <h3 className="text-[14px] font-black tracking-tight text-white">{sacaAtiva ? 'Saca atual' : 'Resumo do dia'}</h3>
              </div>
              <div className="rounded-xl bg-white/5 p-3 ring-1 ring-white/10">
                {sacaAtiva ? (
                  <div className="truncate text-[13.5px] font-black text-white mb-1 leading-tight">{sacaAtiva.nome}</div>
                ) : (
                  <div className="text-[12.5px] font-bold text-amber-300 mb-1">Sem saca ativa</div>
                )}
                <div className="grid grid-cols-3 gap-1 mt-2">
                  {[
                    { k: 'Lidos', v: total, c: 'text-indigo-300' },
                    { k: 'Únicos', v: unicos, c: 'text-emerald-300' },
                    { k: 'Retornos', v: retornos, c: 'text-orange-300' },
                  ].map((kv, i) => (
                    <div key={i} className="bg-black/30 rounded-lg p-2 text-center ring-1 ring-white/10">
                      <div className={`text-[16px] font-black tabular-nums leading-none ${kv.c}`}>{kv.v}</div>
                      <div className="text-[9.5px] font-black uppercase tracking-wider text-slate-400 mt-1">{kv.k}</div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ===== ÚLTIMAS SACAS ===== */}
      <CartaoEscuro className="p-3 sm:p-4" glow="from-sky-500/25">
        <TituloCartao
          icon={Layers}
          titulo="Últimas sacas"
          sub={`Comparativo total vs únicos · últimas ${dadosUltimasSacas.length}`}
          grad="from-sky-500 to-blue-600"
        />
        {dadosUltimasSacas.length === 0 ? (
          <Vazio icon={Layers} titulo="Nenhuma saca registrada" />
        ) : (
          <div className="h-[230px] sm:h-[260px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dadosUltimasSacas} margin={{ top: 8, right: 12, bottom: 8, left: -14 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                <XAxis dataKey="nome" tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={36} />
                <Tooltip
                  contentStyle={tooltipStyle}
                  formatter={(value: any, name: any, _p: any, payload: any) => {
                    const nomeFull = (payload as { payload?: { nomeCompleto?: string } })?.payload?.nomeCompleto;
                    const st = (payload as { payload?: { status?: string } })?.payload?.status;
                    return [`${value.toLocaleString('pt-BR')} ${name === 'total' ? '(bruto)' : '(líquido)'}${st ? ` · ${st}` : ''}`, nomeFull ?? name];
                  }}
                />
                <Legend
                  wrapperStyle={{ fontSize: 11.5, fontWeight: 700, paddingTop: 8 }}
                  formatter={(value) => <span style={{ color: '#cbd5e1' }}>{value === 'total' ? 'Total lido' : 'Únicos'}</span>}
                />
                <Bar dataKey="total" fill="#6366f1" radius={[6, 6, 0, 0]} />
                <Bar dataKey="unicos" fill="#10b981" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </CartaoEscuro>

      {/* ===== ZONAS ===== */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 sm:gap-4">
        <CartaoEscuro className="lg:col-span-2 p-3 sm:p-4" glow="from-rose-500/30">
          <TituloCartao
            icon={MapPin}
            titulo="Por zona ML"
            sub={metrica === 'total' ? 'Pacotes por zona importada · empilhado' : `Métrica: ${METRICAS.find((m) => m.k === metrica)?.label}`}
            grad="from-rose-500 to-orange-500"
            badge={
              zonasReais.length > 0 ? (
                <span className="shrink-0 text-[10.5px] font-black uppercase tracking-wider px-2 py-1 rounded-lg bg-rose-500/15 text-rose-300 ring-1 ring-rose-400/30">
                  {zonasReais.length} zona{zonasReais.length !== 1 ? 's' : ''}
                </span>
              ) : undefined
            }
          />
          {zonasReais.length === 0 ? (
            <Vazio icon={MapPin} titulo="Sem zonas importadas ainda" sub='Use "Importar JSON rotas ou zonas" para preencher aqui.' />
          ) : (
            <>
              <div className="h-[240px] sm:h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosBarrasZona} margin={{ top: 8, right: 12, bottom: 8, left: -14 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                    <XAxis dataKey="nome" tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} interval={0} />
                    <YAxis tick={{ fontSize: 10.5, fontWeight: 600, fill: '#94a3b8' }} axisLine={false} tickLine={false} allowDecimals={false} width={40} />
                    <Tooltip
                      cursor={{ fill: 'rgba(255,255,255,0.04)' }}
                      contentStyle={tooltipStyle}
                      formatter={(value: any, name: any) => [
                        value.toLocaleString('pt-BR'),
                        name === 'retornos' ? 'Retornos' : metrica === 'total' ? 'Normais' : METRICAS.find((m) => m.k === metrica)?.label,
                      ]}
                      labelFormatter={(label: any, payload: readonly any[]) => {
                        const first = payload?.[0]?.payload as { nomeCompleto?: string } | undefined;
                        return first?.nomeCompleto ?? String(label ?? 'Zona');
                      }}
                    />
                    <Legend
                      iconType="rect"
                      wrapperStyle={{ fontSize: 11.5, fontWeight: 700, paddingTop: 8 }}
                      formatter={(value) => (
                        <span style={{ color: '#cbd5e1' }}>
                          {value === 'retornos' ? 'Retornos' : metrica === 'total' ? 'Normais' : METRICAS.find((m) => m.k === metrica)?.label}
                        </span>
                      )}
                    />
                    <Bar dataKey="principal" stackId="a" fill="#fb7185" radius={[6, 6, 0, 0]} />
                    {metrica === 'total' && <Bar dataKey="retornos" stackId="a" fill="#f97316" radius={[6, 6, 0, 0]} />}
                  </BarChart>
                </ResponsiveContainer>
              </div>

              <div className="mt-3 space-y-1.5 max-h-[230px] overflow-auto pr-1">
                {(() => {
                  const maxQtd = Math.max(1, ...zonasReais.map((z) => z.qtd));
                  return zonasReais.map((z, idx) => {
                    const cor = PALETA_DASH[(idx + 3) % PALETA_DASH.length];
                    return (
                      <div key={z.nome} className="group">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-2 min-w-0">
                            <MapPin className="h-3 w-3 shrink-0 text-rose-400" />
                            <span className="text-[12px] font-bold text-slate-200 truncate">{z.nome}</span>
                            {z.entregadores > 0 && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-indigo-500/15 ring-1 ring-indigo-400/30 text-[9.5px] font-black uppercase tracking-wider text-indigo-300">
                                <Users className="h-2.5 w-2.5" />
                                {z.entregadores}
                              </span>
                            )}
                          </div>
                          <div className="shrink-0 text-[11.5px] font-black tabular-nums text-slate-300 flex items-center gap-1.5">
                            <span>{z.qtd.toLocaleString('pt-BR')}</span>
                            {z.retornos > 0 && (
                              <span className="text-orange-300 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-orange-500/15 ring-1 ring-orange-400/30">
                                <RefreshCw className="h-2.5 w-2.5" /> {z.retornos}
                              </span>
                            )}
                            <span className="text-slate-500 text-[10px]">{total > 0 ? ((z.qtd / total) * 100).toFixed(1) : 0}%</span>
                          </div>
                        </div>
                        <div className="h-2 w-full bg-white/5 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${(z.qtd / maxQtd) * 100}%`, background: `linear-gradient(90deg, ${cor}dd, ${cor}88)` }} />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          )}
        </CartaoEscuro>

        <div className="space-y-3 sm:space-y-4">
          <CartaoEscuro className="p-3 sm:p-4" glow="from-rose-500/25">
            <div className="flex items-center gap-2 mb-3">
              <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-rose-500 to-pink-500 text-white flex items-center justify-center">
                <MapPin className="h-3.5 w-3.5" />
              </div>
              <h3 className="text-[14px] font-black tracking-tight text-white">Resumo de zonas</h3>
            </div>
            {zonasReais.length === 0 ? (
              <div className="py-8 text-center rounded-xl bg-slate-800/40 border border-dashed border-white/10">
                <div className="text-[13px] font-bold text-slate-300">Sem zonas</div>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-1.5 mb-3">
                  {[
                    { k: 'Zonas', v: zonasReais.length, grad: 'from-rose-500 to-pink-500' },
                    { k: 'Pacotes', v: zonasReais.reduce((a, z) => a + z.qtd, 0), grad: 'from-orange-500 to-amber-500' },
                    { k: 'Entr. únicos', v: zonasReais.reduce((a, z) => a + z.entregadores, 0), grad: 'from-violet-500 to-indigo-500' },
                  ].map((kv, i) => (
                    <div key={i} className={`rounded-xl bg-gradient-to-br ${kv.grad} p-[1px]`}>
                      <div className="rounded-[10px] bg-slate-950/80 px-2 py-2 text-center">
                        <div className="text-[15px] font-black tabular-nums leading-none text-white">{kv.v}</div>
                        <div className="text-[8.5px] font-black uppercase tracking-wider text-slate-400 mt-1">{kv.k}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="space-y-1 max-h-[220px] overflow-auto pr-1">
                  {(() => {
                    const tot = zonasReais.reduce((a, z) => a + z.qtd, 0);
                    return zonasReais.map((z) => {
                      const p = tot > 0 ? (z.qtd / tot) * 100 : 0;
                      return (
                        <div key={z.nome} className="flex items-center justify-between gap-2 py-1">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <MapPin className="h-3 w-3 shrink-0 text-rose-400" />
                            <span className="text-[11px] font-bold text-slate-200 truncate">{z.nome}</span>
                          </div>
                          <span className="text-[11px] font-black tabular-nums text-slate-400 shrink-0">{p.toFixed(1)}%</span>
                        </div>
                      );
                    });
                  })()}
                </div>
              </>
            )}
          </CartaoEscuro>
        </div>
      </div>

      {/* ===== RODAPÉ ===== */}
      <div className="flex items-center justify-between px-1 pt-1">
        <div className="text-[10.5px] font-bold uppercase tracking-wider text-slate-500">{hojeFormatado} · Dashboard</div>
        <div className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 inline-flex items-center gap-1.5">
          <Sparkles className="h-3 w-3 text-amber-400" />
          Mercado Livre · Operações
        </div>
      </div>
    </div>
  );
}
