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
} from 'lucide-react';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import { SpreadsheetStatus } from '@/components/SpreadsheetStatus';
import { HistoryService } from '@/services/history/HistoryService';
import { useEffect } from 'react';

export default function HomePage() {
  const router = useRouter();
  const planilha = useSpreadsheetStore((s) => s.planilha);
  const total = useSpreadsheetStore((s) => s.totalRegistros());
  const [countHistorico, setCountHistorico] = React.useState(0);

  useEffect(() => {
    try {
      setCountHistorico(HistoryService.listar().length);
    } catch {
      /* noop */
    }
  }, []);

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
              onClick={() => router.push('/escanear')}
            >
              <QrCode className="h-5 w-5" />
              Escanear etiqueta agora
              <ArrowRight className="h-4.5 w-4.5 ml-1 h-4 w-4 ml-1 h-5 w-5 ml-1 h-5 w-5 ml-1" />
            </Button>
            <Button
              size="xl"
              className="!h-14 text-[15px]"
              onClick={() => router.push('/importar')}
            >
              <Upload className="h-5 w-5" />
              {planilha ? 'Atualizar planilha' : 'Importar Excel'}
            </Button>
          </div>
        </div>
      </section>

      <SpreadsheetStatus />

      <section className="grid grid-cols-2 gap-3">
        <QuickCard
          href="/importar"
          icon={Upload}
          title="Importar"
          subtitle={planilha ? `${total} endereços` : 'XLSX · XLS · CSV'}
          color="bg-gradient-to-br from-ml-yellow to-[#fde640] text-neutral-900"
        />
        <QuickCard
          href="/escanear"
          icon={FileSearch}
          title="Escanear"
          subtitle="Câmera ou galeria"
          color="bg-gradient-to-br from-ml-blue to-blue-600 text-white"
          destaque
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
          color="bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-900 border border-emerald-200"
        />
      </section>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <FeatureCard
          icon={<BarChart3 className="h-5 w-5 text-emerald-600" />}
          title="Score ponderado"
          text="CEP (35%) + Número (30%) + Logradouro (25%) com fallback fuzzy."
        />
        <FeatureCard
          icon={<Sparkles className="h-5 w-5 text-ml-blue" />}
          title="Normalização"
          text="Remove acentos, pontuação, expande abreviações (R. → RUA)."
        />
        <FeatureCard
          icon={<QrCode className="h-5 w-5 text-amber-600" />}
          title="Tesseract OCR"
          text="Português + Inglês, com barra de progresso e troca futura para API."
        />
      </section>
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
