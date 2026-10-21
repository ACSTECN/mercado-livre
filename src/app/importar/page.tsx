'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeLoading } from '@/components/ui/Badge';
import { ColumnMapper } from '@/components/ColumnMapper';
import { ImageUploader } from '@/components/ImageUploader';
import { SpreadsheetStatus } from '@/components/SpreadsheetStatus';
import { processarRegistros, lerPlanilha, type PlanilhaPreview } from '@/services/spreadsheet/ExcelService';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import type { MapeamentoColunas } from '@/types';
import { AlertTriangle, CheckCircle2, FileSpreadsheet, RefreshCw, Trash2, Upload } from 'lucide-react';
import { Progress } from '@/components/ui/Progress';

export default function ImportarPage() {
  const router = useRouter();
  const planilhaAtual = useSpreadsheetStore((s) => s.planilha);
  const importarStore = useSpreadsheetStore((s) => s.importar);
  const substituir = useSpreadsheetStore((s) => s.substituir);
  const limparStore = useSpreadsheetStore((s) => s.limpar);

  const inputRef = React.useRef<HTMLInputElement>(null);
  const [preview, setPreview] = React.useState<PlanilhaPreview | null>(null);
  const [mapeamento, setMapeamento] = React.useState<MapeamentoColunas>(
    planilhaAtual?.mapeamento ?? {},
  );
  const [erro, setErro] = React.useState<string | null>(null);
  const [processando, setProcessando] = React.useState(false);
  const [progresso, setProgresso] = React.useState(0);
  const [sucesso, setSucesso] = React.useState(false);

  const aoSelecionarArquivo = async (files: FileList | null) => {
    const f = files?.[0];
    if (!f) return;
    setErro(null);
    setSucesso(false);
    setProcessando(true);
    setProgresso(5);
    try {
      setProgresso(25);
      const p = await lerPlanilha(f);
      setProgresso(70);
      setPreview(p);
      if (planilhaAtual?.mapeamento) {
        const mapeado: MapeamentoColunas = {};
        for (const k of Object.keys(planilhaAtual.mapeamento) as (keyof MapeamentoColunas)[]) {
          const col = planilhaAtual.mapeamento[k];
          if (col && p.cabecalhos.includes(col)) mapeado[k] = col;
        }
        setMapeamento(mapeado);
      }
      setProgresso(100);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao ler planilha');
    } finally {
      setProcessando(false);
      setTimeout(() => setProgresso(0), 500);
    }
  };

  const onConfirmar = async () => {
    if (!preview) return;
    setErro(null);
    setProcessando(true);
    setProgresso(10);
    try {
      setProgresso(40);
      const registros = processarRegistros(preview, mapeamento);
      if (!registros.length) {
        throw new Error(
          'Nenhum endereço válido encontrado. Verifique o mapeamento de colunas (é preciso Endereço + Posição / Número).',
        );
      }
      setProgresso(80);
      const payload = {
        nomeArquivo: preview.arquivoNome,
        hash: preview.hash,
        cabecalhos: preview.cabecalhos,
        mapeamento,
        registros,
      };
      if (planilhaAtual && planilhaAtual.hashArquivo !== preview.hash) {
        substituir(payload);
      } else {
        importarStore(payload);
      }
      setProgresso(100);
      setSucesso(true);
      setTimeout(() => router.push('/escanear'), 800);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao importar');
    } finally {
      setProcessando(false);
      setTimeout(() => setProgresso(0), 500);
    }
  };

  return (
    <div className="space-y-5 animate-slide-up">
      <section className="hero-shell">
        <div className="relative p-6 sm:p-8 lg:p-9">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="max-w-3xl">
              <Badge variant="primary" className="mb-4">
                <Upload className="h-3 w-3" /> Entrada de dados
              </Badge>
              <h1 className="section-title">Importar planilha de endereços</h1>
              <p className="section-subtitle mt-2 max-w-2xl">
                Faça upload da base, confira o mapeamento e deixe a operação pronta para OCR e
                busca. Agora com um layout mais amplo e confortável para arquivos grandes.
              </p>
            </div>
            <div className="panel-dark min-w-[240px] p-4 sm:p-5">
              <div className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Formatos</div>
              <div className="mt-2 text-2xl font-black tracking-tight text-white">XLSX · XLS · CSV</div>
              <div className="mt-1 text-sm text-slate-400">Mapeamento visual e substituição controlada</div>
            </div>
          </div>
        </div>
      </section>

      {planilhaAtual && <SpreadsheetStatus />}

      {sucesso && (
        <Card className="border-emerald-400/25 bg-emerald-400/12">
          <CardContent className="!p-5 flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-300 shadow-[0_12px_24px_rgba(16,185,129,0.18)]">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-black tracking-tight text-white">Importação concluída</p>
              <p className="text-sm text-slate-400">Redirecionando para escanear...</p>
            </div>
            <Badge variant="success">Concluído</Badge>
          </CardContent>
        </Card>
      )}

      {erro && (
        <Card className="border-rose-400/25 bg-rose-400/12">
          <CardContent className="!p-5 flex items-start gap-3">
            <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-rose-400/12 text-rose-300 shadow-[0_12px_24px_rgba(239,68,68,0.14)]">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-black tracking-tight text-rose-300">Erro na importação</p>
              <p className="text-sm text-rose-300">{erro}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {processando && (
        <Card>
          <CardContent className="!p-6 space-y-3">
            <BadgeLoading />
            <Progress value={progresso} label="Processando planilha..." />
          </CardContent>
        </Card>
      )}

      <input
        ref={inputRef}
        type="file"
        accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv"
        className="hidden"
        onChange={(e) => aoSelecionarArquivo(e.target.files)}
      />

      {!preview ? (
        <div className="grid gap-4 xl:grid-cols-[1.15fr_0.85fr]">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileSpreadsheet className="h-5 w-5 text-ml-blue" />
                Selecionar arquivo
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div
                className="cursor-pointer"
                onClick={() => inputRef.current?.click()}
                onDragOver={(e) => {
                  e.preventDefault();
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  aoSelecionarArquivo(e.dataTransfer.files);
                }}
              >
                <ImageUploader onSelecionado={() => void 0} className="hidden" />
                <div className="flex min-h-[360px] flex-col items-center justify-center gap-4 rounded-[1.75rem] border-2 border-dashed border-white/15 bg-white/[0.04] p-8 text-center transition hover:border-ml-blue hover:bg-white/10">
                  <div className="flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-[linear-gradient(135deg,#fff159,#f5e100)] text-neutral-950 shadow-[0_14px_30px_rgba(255,241,89,0.22)]">
                    <Upload className="h-7 w-7" />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[18px] font-black tracking-tight text-white">
                      Clique para selecionar ou arraste a planilha aqui
                    </p>
                    <p className="text-sm text-slate-400">
                      Necessário: coluna de código/número + coluna de endereço
                    </p>
                  </div>
                  <Button size="lg" variant="primary">
                    Escolher arquivo Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-4">
            {planilhaAtual && (
              <Card>
                <CardContent className="!p-5 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <RefreshCw className="h-5 w-5 text-slate-400" />
                    <div>
                      <p className="text-sm font-black tracking-tight text-white">
                        Já existe uma planilha ativa
                      </p>
                      <p className="text-xs text-slate-400">
                        A importação acima substituirá a anterior.
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      limparStore();
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" /> Remover
                  </Button>
                </CardContent>
              </Card>
            )}

            <Card className="panel-dark !bg-[linear-gradient(180deg,rgba(9,17,31,0.94),rgba(10,18,30,0.88))] !text-white">
              <CardContent className="!p-6 space-y-4">
                <div>
                  <p className="text-[11px] font-black uppercase tracking-[0.18em] text-slate-400">Fluxo</p>
                  <h3 className="mt-2 text-xl font-black tracking-tight text-white">Importação guiada</h3>
                </div>
                <div className="space-y-3">
                  {[
                    'Upload da planilha',
                    'Leitura dos cabeçalhos',
                    'Mapeamento das colunas',
                    'Confirmação e uso no OCR',
                  ].map((item, index) => (
                    <div key={item} className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-3">
                      <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-white/10 text-sky-300 font-black">
                        {index + 1}
                      </div>
                      <span className="text-sm font-semibold text-slate-200">{item}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      ) : (
        <>
          <Card>
            <CardContent className="!p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/12 text-emerald-300">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-white">{preview.arquivoNome}</p>
                  <p className="text-xs text-slate-400">
                    {preview.totalLinhas} linhas · {preview.cabecalhos.length} colunas
                  </p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="ghost" onClick={() => setPreview(null)}>
                  Trocar arquivo
                </Button>
                <Button size="sm" variant="primary" onClick={() => inputRef.current?.click()}>
                  <Upload className="h-3.5 w-3.5" /> Reimportar
                </Button>
              </div>
            </CardContent>
          </Card>

          <ColumnMapper
            cabecalhos={preview.cabecalhos}
            amostra={preview.amostra}
            value={mapeamento}
            onChange={setMapeamento}
            onConfirmar={onConfirmar}
            totalLinhas={preview.totalLinhas}
            nomeArquivo={preview.arquivoNome}
            disabled={processando}
          />
        </>
      )}
    </div>
  );
}
