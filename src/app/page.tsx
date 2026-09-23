'use client';

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import {
  Upload,
  FileSearch,
  History,
  ArrowRight,
  Sparkles,
  QrCode,
  BarChart3,
  MapPin,
  Package,
  ListPlus,
  RefreshCw,
  Truck,
  Undo2,
  CheckCheck,
  Layers,
  Users,
} from 'lucide-react';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import { SpreadsheetStatus } from '@/components/SpreadsheetStatus';
import { HistoryService } from '@/services/history/HistoryService';
import { usePacoteStore } from '@/stores/pacoteStore';
import { STATUS_PACOTE_META } from '@/types';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Cell,
  PieChart,
  Pie,
} from 'recharts';

export default function HomePage() {
  const router = useRouter();
  const planilha = useSpreadsheetStore((s) => s.planilha);
  const totalPlanilha = useSpreadsheetStore((s) => s.totalRegistros());
  const carregarPacotes = usePacoteStore((s) => s.carregar);
  const carregarSacas = usePacoteStore((s) => s.carregarSacas);
  const totalPacotes = usePacoteStore((s) => s.total());
  const unicosPacotes = usePacoteStore((s) => s.unicos());
  const contarPorStatus = usePacoteStore((s) => s.contarPorStatus);
  const resumos = usePacoteStore((s) => s.resumos);
  const entregadores = usePacoteStore((s) => s.contagensEntregadores);
  const sacaAtiva = usePacoteStore((s) => s.sacaAtiva);
  const [countHistorico, setCountHistorico] = React.useState(0);
  const [inicializado, setInicializado] = React.useState(false);

  React.useEffect(() => {
    try { setCountHistorico(HistoryService.listar().length); } catch { /* noop */ }
    void (async () => {
      await carregarSacas();
      await carregarPacotes();
      setInicializado(true);
    })();
  }, [carregarPacotes, carregarSacas]);

  const st = React.useMemo(() => contarPorStatus(), [contarPorStatus, totalPacotes]);

  const dadosBarrasStatus = React.useMemo(() => ([
    { status: 'Lido',      valor: st.lido,      fill: '#0ea5e9', chave: 'lido' },
    { status: 'Entregue',  valor: st.entregue,  fill: '#10b981', chave: 'entregue' },
    { status: 'Retorno',   valor: st.retorno,   fill: '#f97316', chave: 'retorno' },
    { status: 'Devolução', valor: st.devolucao, fill: '#f43f5e', chave: 'devolucao' },
    { status: 'Sem status', valor: st.semStatus, fill: '#94a3b8', chave: 'sem' },
  ]), [st]);

  const donutDados = React.useMemo(() =>
    dadosBarrasStatus.filter((d) => d.valor > 0).map((d) => ({ name: d.status, value: d.valor, fill: d.fill })),
    [dadosBarrasStatus]
  );

  const topEntregadores = React.useMemo(() =>
    [...entregadores].sort((a, b) => b.qtd - a.qtd).slice(0, 5),
    [entregadores]
  );
  const maxEnt = Math.max(1, ...topEntregadores.map((e) => e.qtd));

  return (
    <div className="space-y-5 animate-slide-up">
      <section className="relative overflow-hidden rounded-3xl gradient-card shadow-premium">
        <div className="absolute -top-10 -right-10 h-48 w-48 rounded-full bg-ml-yellow/40 blur-3xl" />
        <div className="absolute -bottom-14 -left-14 h-52 w-52 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative p-6 sm:p-8">
          <Badge variant="primary" className="mb-4">
            <Sparkles className="h-3 w-3" /> MVP · 100% cliente-side
          </Badge>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight text-neutral-900">
            Leitor de etiquetas <br className="hidden sm:block" />
            <span className="bg-gradient-to-r from-neutral-900 via-neutral-800 to-blue-700 bg-clip-text text-transparent">
              OCR + Busca inteligente
            </span>
          </h1>
          <p className="mt-3 max-w-xl text-[14.5px] leading-relaxed text-neutral-600">
            Fotografe a etiqueta do Mercado Livre. O sistema extrai o endereço via OCR,
            normaliza, compara com pesos ponderados (CEP 35% · Nº 30% · Rua 25%) e
            retorna o código da sua planilha com pontuação de confiança.
          </p>
          <div className="mt-5 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <Button
              size="xl"
              variant="primary"
              className="!h-14 text-[15px]"
              onClick={() => router.push('/contagem')}
            >
              <ListPlus className="h-5 w-5" />
              Contar pacotes agora
              <ArrowRight className="h-4.5 w-4.5 ml-1 h-5 w-5 ml-1" />
            </Button>
            <Button
              size="xl"
              variant="secondary"
              className="!h-14 text-[15px]"
              onClick={() => router.push('/escanear')}
            >
              <QrCode className="h-5 w-5" />
              Escanear etiqueta OCR
            </Button>
          </div>
        </div>
      </section>

      {/* ===== DASHBOARD PRINCIPAL ===== */}
      {inicializado && totalPacotes > 0 ? (
        <section className="space-y-3">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-ml-blue" />
              <h2 className="text-[14.5px] font-black tracking-tight text-neutral-900">
                Visão geral · operações
              </h2>
              {sacaAtiva && (
                <Badge variant="info" className="!text-[10px] !px-2 !py-0.5">
                  <Layers className="h-2.5 w-2.5" />
                  {sacaAtiva.nome}
                </Badge>
              )}
            </div>
            <Link href="/contagem" className="text-[11.5px] font-bold text-ml-blue hover:underline inline-flex items-center gap-0.5">
              Ir para contagem <ArrowRight className="h-3 w-3" />
            </Link>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-6 gap-2.5">
            <HomeKpi
              label="Pacotes lidos"
              valor={totalPacotes}
              sub={`${unicosPacotes} únicos`}
              grad="from-indigo-500 to-violet-500"
              icon={Package}
              badge={totalPacotes !== unicosPacotes ? `${totalPacotes - unicosPacotes} dup` : null}
            />
            <HomeKpi
              label="Lidos"
              valor={st.lido}
              sub={STATUS_PACOTE_META.lido.label}
              grad="from-sky-500 to-blue-500"
              icon={CheckCheck}
              badge={st.lido > 0 ? `${pct(st.lido, totalPacotes)}%` : null}
            />
            <HomeKpi
              label="Entregues"
              valor={st.entregue}
              sub={STATUS_PACOTE_META.entregue.label}
              grad="from-emerald-500 to-teal-500"
              icon={Truck}
              badge={st.entregue > 0 ? `${pct(st.entregue, totalPacotes)}%` : null}
            />
            <HomeKpi
              label="Retornos"
              valor={st.retorno}
              sub={STATUS_PACOTE_META.retorno.label}
              grad="from-orange-500 to-amber-500"
              icon={RefreshCw}
              badge={Number(pct(st.retorno, totalPacotes)) > 15 ? 'ALTO' : st.retorno > 0 ? `${pct(st.retorno, totalPacotes)}%` : null}
            />
            <HomeKpi
              label="Devoluções"
              valor={st.devolucao}
              sub={STATUS_PACOTE_META.devolucao.label}
              grad="from-rose-500 to-pink-500"
              icon={Undo2}
              badge={st.devolucao > 0 ? `${pct(st.devolucao, totalPacotes)}%` : null}
            />
            <HomeKpi
              label="Sacas"
              valor={resumos.length}
              sub={`${entregadores.length} entreg.`}
              grad="from-fuchsia-500 to-violet-500"
              icon={Users}
              badge={sacaAtiva?.status === 'aberta' ? 'ABERTA' : null}
            />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
            <Card className="!rounded-2xl lg:col-span-2 overflow-hidden">
              <CardContent className="!p-4 !space-y-2">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-[12.5px] font-black uppercase tracking-wider text-neutral-500">
                    Volume por status
                  </h3>
                  <span className="text-[10.5px] font-bold text-neutral-400 tabular-nums">
                    Total {totalPacotes}
                  </span>
                </div>
                <div className="h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosBarrasStatus} barCategoryGap="22%" margin={{ top: 4, right: 8, left: -10, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
                      <XAxis
                        dataKey="status"
                        tick={{ fontSize: 11, fontWeight: 700, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{ fontSize: 10.5, fontWeight: 600, fill: '#64748b' }}
                        axisLine={false}
                        tickLine={false}
                        allowDecimals={false}
                        width={38}
                      />
                      <Tooltip
                        cursor={{ fill: '#f8fafc', opacity: 0.7 }}
                        contentStyle={{
                          borderRadius: 14, border: '1px solid #e2e8f0',
                          boxShadow: '0 10px 25px -5px rgba(0,0,0,0.1)',
                          fontSize: 12.5, fontWeight: 600, padding: '10px 12px',
                        }}
                        formatter={(value: any, name: any) => [
                          value.toLocaleString('pt-BR') + ` (${pct(Number(value), totalPacotes)}%)`,
                          name,
                        ]}
                      />
                      <Bar dataKey="valor" radius={[7, 7, 0, 0]}>
                        {dadosBarrasStatus.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card className="!rounded-2xl overflow-hidden">
              <CardContent className="!p-4 !space-y-2">
                <h3 className="text-[12.5px] font-black uppercase tracking-wider text-neutral-500 mb-1">
                  Distribuição
                </h3>
                <div className="relative h-[200px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={donutDados}
                        innerRadius={50}
                        outerRadius={80}
                        paddingAngle={2}
                        strokeWidth={0}
                        dataKey="value"
                      >
                        {donutDados.map((entry, i) => (
                          <Cell key={i} fill={entry.fill} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          borderRadius: 14, border: '1px solid #e2e8f0', fontSize: 12,
                          fontWeight: 600, padding: '8px 10px', boxShadow: '0 8px 20px -5px rgba(0,0,0,0.1)',
                        }}
                        formatter={(value: any, name: any) => {
                          const v = Number(value);
                          return [`${v.toLocaleString('pt-BR')} (${pct(v, totalPacotes)}%)`, name];
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                    <p className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      Total
                    </p>
                    <p className="mt-0.5 text-[26px] font-black tracking-tight tabular-nums text-neutral-900">
                      {totalPacotes}
                    </p>
                  </div>
                </div>
                <div className="space-y-1.5 mt-1">
                  {donutDados.map((d) => (
                    <div key={d.name} className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full shrink-0" style={{ backgroundColor: d.fill }} />
                      <p className="text-[11px] font-bold text-neutral-700 flex-1">{d.name}</p>
                      <p className="text-[11px] font-black tabular-nums text-neutral-900">
                        {d.value}
                      </p>
                      <p className="text-[10px] font-bold text-neutral-400 tabular-nums w-10 text-right">
                        {pct(d.value, totalPacotes)}%
                      </p>
                    </div>
                  ))}
                  {donutDados.length === 0 && (
                    <p className="text-[11px] font-semibold text-neutral-400 text-center py-4">
                      Sem dados ainda.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {topEntregadores.length > 0 && (
            <Card className="!rounded-2xl overflow-hidden">
              <CardContent className="!p-4 !space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-[12.5px] font-black uppercase tracking-wider text-neutral-500">
                    Top entregadores
                  </h3>
                  <span className="text-[10.5px] font-bold text-neutral-400 tabular-nums">
                    {entregadores.length} ativos
                  </span>
                </div>
                <div className="space-y-2">
                  {topEntregadores.map((e) => (
                    <div key={e.nome} className="space-y-1">
                      <div className="flex items-center justify-between">
                        <p className="text-[12px] font-black text-neutral-800 truncate max-w-[60%]">
                          {e.nome}
                        </p>
                        <div className="flex items-center gap-2 text-[10.5px] font-bold tabular-nums">
                          <span className="text-neutral-900">{e.qtd}</span>
                          {e.retornos > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-orange-700">
                              <RefreshCw className="h-2.5 w-2.5" />{e.retornos}
                            </span>
                          )}
                          {e.devolucoes > 0 && (
                            <span className="inline-flex items-center gap-0.5 text-rose-700">
                              <Undo2 className="h-2.5 w-2.5" />{e.devolucoes}
                            </span>
                          )}
                          <span className="text-neutral-400 w-10 text-right">
                            {pct(e.qtd, totalPacotes)}%
                          </span>
                        </div>
                      </div>
                      <div className="h-2 rounded-full bg-neutral-100 overflow-hidden">
                        <div
                          className="h-full bg-gradient-to-r from-violet-500 to-fuchsia-500 rounded-full transition-all"
                          style={{ width: `${(e.qtd / maxEnt) * 100}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      ) : inicializado ? (
        <section className="rounded-2xl border border-dashed border-neutral-300 bg-white/60 px-5 py-7 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-neutral-100 text-neutral-400 mx-auto mb-3">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="text-[14px] font-bold text-neutral-900">Sem pacotes lidos ainda</h3>
          <p className="text-[12px] text-neutral-500 mt-1">
            Comece uma contagem para o dashboard aparecer aqui automaticamente.
          </p>
          <Button
            size="sm"
            variant="primary"
            className="mt-4"
            onClick={() => router.push('/contagem')}
          >
            <ListPlus className="h-4 w-4" /> Ir para Contagem
          </Button>
        </section>
      ) : null}

      <SpreadsheetStatus />

      <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <QuickCard
          href="/contagem"
          icon={Package}
          title="Contagem"
          subtitle="Câmera · leitor · digitar"
          color="bg-gradient-to-br from-emerald-500 to-emerald-600 text-white"
          destaque
        />
        <QuickCard
          href="/importar"
          icon={Upload}
          title="Importar"
          subtitle={planilha ? `${totalPlanilha} endereços` : 'XLSX · XLS · CSV'}
          color="bg-gradient-to-br from-ml-yellow to-[#fde640] text-neutral-900"
        />
        <QuickCard
          href="/escanear"
          icon={FileSearch}
          title="Escanear OCR"
          subtitle="Câmera ou galeria"
          color="bg-gradient-to-br from-ml-blue to-blue-600 text-white"
        />
        <QuickCard
          href="/historico"
          icon={History}
          title="Histórico"
          subtitle={countHistorico ? `${countHistorico} consultas` : 'Sem consultas'}
          color="bg-gradient-to-br from-neutral-100 to-neutral-50 text-neutral-900 border border-black/[0.06]"
        />
        <QuickCard
          href="/escanear"
          icon={MapPin}
          title="Busca manual"
          subtitle="Digitar endereço"
          color="bg-gradient-to-br from-violet-100 to-violet-50 text-violet-900 border border-violet-200"
        />
        <QuickCard
          href="/contagem"
          icon={ListPlus}
          title="Contar rápido"
          subtitle="Leitor USB recomendado"
          color="bg-gradient-to-br from-amber-100 to-amber-50 text-amber-900 border border-amber-200"
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FeatureCard
          icon={<Package className="h-5 w-5 text-emerald-600" />}
          title="Contagem persistente"
          text="Salva no Supabase + localStorage. Não perde nem em refresh nem fechamento."
        />
        <FeatureCard
          icon={<BarChart3 className="h-5 w-5 text-ml-blue" />}
          title="3 modos de leitura"
          text="Câmera (QR/barcode em tempo real), leitor externo USB ou digitação manual."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5 text-amber-600" />}
          title="JSON automático"
          text="Extrai ID automaticamente de JSON no formato {id:..., t:...} da sua etiqueta."
        />
      </section>
    </div>
  );
}

function pct(n: number, tot: number): string {
  if (!tot) return '0';
  return ((n / tot) * 100).toFixed(0);
}

function HomeKpi({
  label, valor, sub, grad, icon: Icon, badge,
}: {
  label: string;
  valor: number;
  sub: string;
  grad: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | null;
}) {
  return (
    <div className="relative rounded-2xl bg-white border border-neutral-200/70 shadow-sm p-3 sm:p-3.5 overflow-hidden">
      <div className={`absolute -top-6 -right-6 h-20 w-20 rounded-full bg-gradient-to-br ${grad} opacity-15`} />
      <div className="relative">
        <div className="flex items-start justify-between gap-2">
          <p className="text-[10px] sm:text-[11px] font-black uppercase tracking-wider text-neutral-500">
            {label}
          </p>
          <div className={`flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-to-br ${grad} text-white shadow-sm`}>
            <Icon className="h-3.5 w-3.5" />
          </div>
        </div>
        <p className="mt-1 text-[26px] sm:text-[28px] font-black tracking-tight tabular-nums leading-tight text-neutral-900">
          {valor.toLocaleString('pt-BR')}
        </p>
        <div className="mt-1.5 flex items-center justify-between gap-2">
          <p className="text-[10.5px] font-bold text-neutral-500 truncate">{sub}</p>
          {badge && (
            <span className={`inline-flex items-center px-1.5 py-0.5 rounded-md text-[9.5px] font-black ring-1 whitespace-nowrap ${
              badge === 'ALTO' ? 'bg-rose-50 text-rose-700 ring-rose-200' :
              badge === 'ABERTA' ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' :
              'bg-neutral-100 text-neutral-600 ring-neutral-200'
            }`}>
              {badge}
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function QuickCard({
  href,
  icon: Icon,
  title,
  subtitle,
  color,
  destaque,
}: {
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle: string;
  color: string;
  destaque?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`group relative overflow-hidden rounded-2xl p-4 sm:p-5 transition hover:-translate-y-0.5 active:scale-[0.99] ${color}`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] font-medium opacity-80">{subtitle}</p>
          <p className={`mt-1 ${destaque ? 'text-xl sm:text-2xl' : 'text-lg sm:text-xl'} font-black tracking-tight`}>
            {title}
          </p>
        </div>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-white/30 backdrop-blur-sm group-hover:bg-white/50">
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </Link>
  );
}

function FeatureCard({
  icon,
  title,
  text,
}: {
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <Card>
      <CardContent className="!p-4 space-y-2">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-neutral-50">
          {icon}
        </div>
        <h3 className="text-[14.5px] font-bold text-neutral-900">{title}</h3>
        <p className="text-[13px] leading-relaxed text-neutral-600">{text}</p>
      </CardContent>
    </Card>
  );
}
