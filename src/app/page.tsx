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
} from 'lucide-react';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import { SpreadsheetStatus } from '@/components/SpreadsheetStatus';
import { HistoryService } from '@/services/history/HistoryService';

export default function HomePage() {
  const router = useRouter();
  const planilha = useSpreadsheetStore((s) => s.planilha);
  const totalPlanilha = useSpreadsheetStore((s) => s.totalRegistros());
  const [countHistorico, setCountHistorico] = React.useState(0);

  React.useEffect(() => {
    try { setCountHistorico(HistoryService.listar().length); } catch { /* noop */ }
  }, []);

  return (
    <div className="space-y-6 animate-slide-up">
      <section className="hero-shell">
        <div className="absolute -top-12 right-0 h-64 w-64 rounded-full bg-ml-yellow/20 blur-3xl" />
        <div className="absolute -bottom-20 left-0 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="relative p-6 sm:p-8 lg:p-10 xl:p-12">
          <Badge variant="primary" className="mb-5">
            <Sparkles className="h-3 w-3" /> Plataforma operacional Mercado Livre
          </Badge>
          <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
            <div>
              <h1 className="text-[2.15rem] sm:text-[2.8rem] lg:text-[3.4rem] font-black tracking-tight text-white leading-[0.95]">
                Um front mais amplo,
                <br className="hidden sm:block" />
                <span className="bg-gradient-to-r from-white via-[#fff6a4] to-sky-300 bg-clip-text text-transparent">
                  tecnológico e premium
                </span>
              </h1>
              <p className="mt-4 max-w-2xl text-[15px] sm:text-[16px] leading-relaxed text-slate-300">
                Centralize importação, leitura OCR, contagem e dashboard em uma experiência mais limpa,
                espaçosa e rápida para operação diária.
              </p>
              <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Button
                  size="xl"
                  variant="primary"
                  className="!h-14 text-[15px]"
                  onClick={() => router.push('/contagem')}
                >
                  <ListPlus className="h-5 w-5" />
                  Contar pacotes agora
                  <ArrowRight className="ml-1 h-5 w-5" />
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

            <div className="panel-dark p-5 sm:p-6">
              <div className="grid grid-cols-2 gap-3">
                <HeroMetric
                  label="Planilha"
                  value={planilha ? totalPlanilha.toLocaleString('pt-BR') : '0'}
                  sub={planilha ? 'endereços ativos' : 'aguardando importação'}
                />
                <HeroMetric
                  label="Histórico"
                  value={countHistorico.toLocaleString('pt-BR')}
                  sub="consultas salvas"
                />
                <HeroMetric
                  label="Fluxos"
                  value="4"
                  sub="importar, OCR, contagem, dashboard"
                />
                <HeroMetric
                  label="Leitura"
                  value="360º"
                  sub="câmera, galeria e manual"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      <SpreadsheetStatus />

      <section className="grid grid-cols-1 xl:grid-cols-[1.15fr_0.85fr] gap-4">
        <div className="panel-dark p-4 sm:p-5 lg:p-6">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-[1.1rem] sm:text-[1.35rem] font-black tracking-tight text-white">
                Acessos rápidos
              </h2>
              <p className="mt-1 text-sm text-slate-400">
                Entrada direta para cada etapa da operação.
              </p>
            </div>
            <Badge variant="info">Navegação principal</Badge>
          </div>
          <section className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            <QuickCard
              href="/contagem"
              icon={Package}
              title="Contagem"
              subtitle="Câmera · leitor · digitar"
              color="bg-[linear-gradient(135deg,#0f9f6e,#10b981)] text-white"
              destaque
            />
            <QuickCard
              href="/importar"
              icon={Upload}
              title="Importar"
              subtitle={planilha ? `${totalPlanilha} endereços` : 'XLSX · XLS · CSV'}
              color="bg-[linear-gradient(135deg,#fff159,#f5e100)] text-neutral-950"
            />
            <QuickCard
              href="/escanear"
              icon={FileSearch}
              title="Escanear OCR"
              subtitle="Câmera ou galeria"
              color="bg-[linear-gradient(135deg,#3483fa,#4f46e5)] text-white"
            />
            <QuickCard
              href="/historico"
              icon={History}
              title="Histórico"
              subtitle={countHistorico ? `${countHistorico} consultas` : 'Sem consultas'}
              color="bg-[linear-gradient(135deg,rgba(255,255,255,0.14),rgba(148,163,184,0.16))] text-white border border-white/12"
            />
            <QuickCard
              href="/dashboard"
              icon={BarChart3}
              title="Dashboard"
              subtitle="KPIs, filtros e zonas"
              color="bg-[linear-gradient(135deg,#111827,#172554)] text-white border border-white/10"
            />
            <QuickCard
              href="/escanear"
              icon={MapPin}
              title="Busca manual"
              subtitle="Digitar endereço"
              color="bg-[linear-gradient(135deg,rgba(237,233,254,0.16),rgba(245,243,255,0.12))] text-violet-100 border border-violet-400/25"
            />
          </section>
        </div>

        <div className="space-y-4">
          <div className="panel-dark p-5 sm:p-6">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 text-sky-300">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-black tracking-tight text-white">Base unificada</h3>
                <p className="text-sm text-slate-400">Tudo com a mesma cara e hierarquia visual.</p>
              </div>
            </div>
            <div className="grid gap-3">
              <FeatureMini
                title="Mais amplitude"
                text="Containers mais largos, margens melhores e leitura menos apertada."
              />
              <FeatureMini
                title="Mais coerência"
                text="Botões, campos, cards e navegação falam a mesma linguagem."
              />
              <FeatureMini
                title="Mais contraste"
                text="Visual premium com fundo tecnológico e painéis mais destacados."
              />
            </div>
          </div>

          <section className="grid grid-cols-1 gap-3">
            <FeatureCard
              icon={<Package className="h-5 w-5 text-emerald-300" />}
              title="Contagem persistente"
              text="Salva no Supabase + localStorage. Não perde nem em refresh nem fechamento."
            />
            <FeatureCard
              icon={<BarChart3 className="h-5 w-5 text-ml-blue" />}
              title="3 modos de leitura"
              text="Câmera, leitor externo USB ou digitação manual para lançar com velocidade."
            />
            <FeatureCard
              icon={<Sparkles className="h-5 w-5 text-amber-300" />}
              title="JSON automático"
              text="Extrai ID automaticamente de JSON no formato {id:..., t:...} da etiqueta."
            />
          </section>
        </div>
      </section>
    </div>
  );
}

function HeroMetric({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
      <div className="mt-2 text-[1.8rem] font-black tracking-tight text-white">{value}</div>
      <div className="text-[12px] text-slate-400">{sub}</div>
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
      className={`group relative overflow-hidden rounded-[1.6rem] p-5 sm:p-6 transition duration-200 hover:-translate-y-1 hover:shadow-[0_24px_50px_rgba(15,23,42,0.16)] active:scale-[0.99] ${color}`}
    >
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(255,255,255,0.12),transparent_45%)] opacity-80" />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] sm:text-[13px] font-semibold opacity-80">{subtitle}</p>
          <p className={`mt-1.5 ${destaque ? 'text-2xl sm:text-[2rem]' : 'text-xl sm:text-[1.6rem]'} font-black tracking-tight`}>
            {title}
          </p>
        </div>
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 backdrop-blur-md group-hover:bg-white/30">
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
      <CardContent className="!p-5 space-y-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/[0.07] shadow-[inset_0_0_0_1px_rgba(148,163,184,0.14)]">
          {icon}
        </div>
        <h3 className="text-[15px] font-black tracking-tight text-white">{title}</h3>
        <p className="text-[13px] leading-relaxed text-slate-400">{text}</p>
      </CardContent>
    </Card>
  );
}

function FeatureMini({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
      <div className="text-[13px] font-black tracking-tight text-white">{title}</div>
      <div className="mt-1 text-[12px] leading-relaxed text-slate-400">{text}</div>
    </div>
  );
}
