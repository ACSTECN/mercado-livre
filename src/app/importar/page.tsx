'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeLoading } from '@/components/ui/Badge';
import { ColumnMapper } from '@/components/ColumnMapper';
import { ImageUploader } from '@/components/ImageUploader';
import { SpreadsheetStatus } from '@/components/SpreadsheetStatus';
import { importarPlanilha, lerPlanilha, type PlanilhaPreview } from '@/services/spreadsheet/ExcelService';
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
      const registros = await importarPlanilha(preview, mapeamento);
      setProgresso(80);
      const payload = {
        nomeArquivo: preview.arquivo.name,
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
    <div className="space-y-4 animate-slide-up">
      <div>
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900">
          Importar planilha de endereços
        </h1>
        <p className="mt-1 text-sm text-neutral-600">
          Formatos suportados: <span className="font-semibold">.xlsx</span>, <span className="font-semibold">.xls</span>,{' '}
          <span className="font-semibold">.csv</span>.
        </p>
      </div>

      {planilhaAtual && <SpreadsheetStatus />}

      {sucesso && (
        <Card>
          <CardContent className="!p-4 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <CheckCircle2 className="h-6 w-6" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-neutral-900">Importação concluída</p>
              <p className="text-sm text-neutral-600">Redirecionando para escanear...</p>
            </div>
            <Badge variant="success">Concluído</Badge>
          </CardContent>
        </Card>
      )}

      {erro && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="!p-4 flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-4.5 w-4.5" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-800">Erro na importação</p>
              <p className="text-sm text-red-700">{erro}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {processando && (
        <Card>
          <CardContent className="!p-5 space-y-2">
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
        <>
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
                <div className="flex h-48 flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-neutral-300 bg-white/60 p-6 text-center transition hover:border-ml-blue hover:bg-blue-50/30">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-ml-yellow/30 text-neutral-900">
                    <Upload className="h-6 w-6" />
                  </div>
                  <div className="space-y-0.5">
                    <p className="text-[15px] font-semibold text-neutral-900">
                      Clique para selecionar ou arraste a planilha aqui
                    </p>
                    <p className="text-xs text-neutral-500">
                      Necessário: coluna de código/número + coluna de endereço
                    </p>
                  </div>
                  <Button size="sm" variant="primary">
                    Escolher arquivo Excel
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {planilhaAtual && (
            <Card>
              <CardContent className="!p-4 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <RefreshCw className="h-5 w-5 text-neutral-500" />
                  <div>
                    <p className="text-sm font-semibold text-neutral-800">
                      Já existe uma planilha ativa
                    </p>
                    <p className="text-xs text-neutral-500">
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
        </>
      ) : (
        <>
          <Card>
            <CardContent className="!p-4 flex items-center justify-between gap-3 flex-wrap">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700">
                  <CheckCircle2 className="h-5 w-5" />
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold text-neutral-900">{preview.arquivo.name}</p>
                  <p className="text-xs text-neutral-500">
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
            nomeArquivo={preview.arquivo.name}
            disabled={processando}
          />
        </>
      )}
    </div>
  );
}
