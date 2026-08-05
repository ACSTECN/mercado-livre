'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Progress } from '@/components/ui/Progress';
import { Badge, BadgeConfianca, BadgeLoading } from '@/components/ui/Badge';
import { ImageUploader, ImagemPreview } from '@/components/ImageUploader';
import { AddressForm } from '@/components/AddressForm';
import { MatchCard } from '@/components/MatchCard';
import { SpreadsheetStatus } from '@/components/SpreadsheetStatus';
import { getOcrService } from '@/services/ocr';
import { parsearEnderecoOcr, validarEnderecoParseado } from '@/services/address/AddressParser';
import { AddressMatcher } from '@/services/address/AddressMatcher';
import { useSpreadsheetStore } from '@/stores/spreadsheetStore';
import { useScanStore } from '@/stores/scanStore';
import { HistoryService } from '@/services/history/HistoryService';
import type { StatusConsulta } from '@/types';
import {
  LIMIAR_ALTA_CONFIANCA,
  LIMIAR_BAIXA_CONFIANCA,
} from '@/types';
import {
  AlertTriangle,
  ArrowRight,
  Camera as CamIcon,
  CheckCircle2,
  Copy,
  FileText,
  ListChecks,
  PencilLine,
  RefreshCcw,
  Search,
  Upload,
  Wand2,
  XCircle,
} from 'lucide-react';
import { copiarParaAreaTransferencia } from '@/lib/utils';

type Etapa = 'escolha' | 'processando' | 'corrigir' | 'resultado';

export default function EscanearPage() {
  const router = useRouter();
  const planilha = useSpreadsheetStore((s) => s.planilha);
  const registros = useSpreadsheetStore((s) => s.planilha?.registros ?? []);

  const imagem = useScanStore((s) => s.imagem);
  const ocrTexto = useScanStore((s) => s.ocrTexto);
  const ocrProgresso = useScanStore((s) => s.ocrProgresso);
  const endereco = useScanStore((s) => s.endereco);
  const resultados = useScanStore((s) => s.resultados);
  const status = useScanStore((s) => s.status);
  const setImagem = useScanStore((s) => s.setImagem);
  const setOcrProgresso = useScanStore((s) => s.setOcrProgresso);
  const setOcrTexto = useScanStore((s) => s.setOcrTexto);
  const setEndereco = useScanStore((s) => s.setEndereco);
  const patchEndereco = useScanStore((s) => s.patchEndereco);
  const setResultados = useScanStore((s) => s.setResultados);
  const setStatus = useScanStore((s) => s.setStatus);
  const reset = useScanStore((s) => s.reset);

  const [etapa, setEtapa] = React.useState<Etapa>('escolha');
  const [erro, setErro] = React.useState<string | null>(null);
  const [copiado, setCopiado] = React.useState(false);
  const [validParse, setValidParse] = React.useState<{ valido: boolean; camposFaltando: string[] }>({
    valido: true,
    camposFaltando: [],
  });
  const inputCameraRef = React.useRef<HTMLInputElement>(null);
  const inputUploadRef = React.useRef<HTMLInputElement>(null);

  const planilhaValida = planilha && planilha.registros.length > 0;

  const aoSelecionarArquivo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    try {
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = reject;
        fr.readAsDataURL(file);
      });
      await aoCapturarImagem(dataUrl, file);
    } catch (err) {
      setErro(err instanceof Error ? err.message : 'Erro ao ler arquivo');
    }
  };

  const aoCapturarImagem = async (dataUrl: string, file: File) => {
    setImagem(dataUrl, file);
    setErro(null);
    await executarOcr(dataUrl, file);
  };

  const executarOcr = async (dataUrl: string, file: File) => {
    setEtapa('processando');
    try {
      const svc = getOcrService();
      setOcrProgresso({ status: 'carregando', progresso: 0, mensagem: 'Preparando imagem...' });
      const res = await svc.extrairTexto(file, setOcrProgresso);
      if (!res.texto || res.texto.trim().length < 5) {
        setEndereco({
          logradouro: '',
          numero: '',
          complemento: '',
          bairro: '',
          cidade: '',
          estado: '',
          cep: '',
        });
        setOcrTexto(res.texto);
        setStatus('IMAGEM_SEM_QUALIDADE');
        setEtapa('corrigir');
        return;
      }
      setOcrTexto(res.texto);
      const parsed = parsearEnderecoOcr(res.texto);
      setEndereco(parsed.endereco);
      const v = validarEnderecoParseado(parsed.endereco);
      setValidParse(v);

      if (!v.valido) {
        setStatus('ENDERECO_NAO_IDENTIFICADO');
        setEtapa('corrigir');
        return;
      }
      await pesquisarEndereco(parsed.endereco, res.texto, dataUrl);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao processar OCR');
      setEtapa('escolha');
    } finally {
      setOcrProgresso(null);
    }
  };

  const pesquisarEndereco = async (
    end: typeof endereco,
    textoOcr: string,
    imagePreview: string | null,
  ) => {
    if (!planilhaValida) {
      setStatus('PLANILHA_NAO_IMPORTADA');
      setEtapa('resultado');
      return;
    }
    const matcher = new AddressMatcher(registros);
    const matchs = matcher.buscar(end, 5);

    let s: StatusConsulta = 'ENDERECO_NAO_ENCONTRADO';
    if (matchs.length === 0) {
      s = 'ENDERECO_NAO_ENCONTRADO';
    } else if (matchs.length >= 2 && matchs[0].score < LIMIAR_ALTA_CONFIANCA && matchs[0].score - matchs[1].score < 15) {
      s = 'MULTIPLOS_ENCONTRADOS';
    } else if (matchs[0].score >= LIMIAR_ALTA_CONFIANCA) {
      s = 'ENDERECO_ENCONTRADO';
    } else if (matchs[0].score >= LIMIAR_BAIXA_CONFIANCA) {
      s = 'ENDERECO_BAIXA_CONFIANCA';
    } else {
      s = 'ENDERECO_NAO_ENCONTRADO';
    }

    setResultados(matchs, s);

    try {
      HistoryService.adicionar({
        status: s,
        textoOcr,
        enderecoEstruturado: end,
        codigoEncontrado: matchs[0]?.registro.codigo ?? null,
        confianca: matchs[0]?.score ?? null,
        multiplosResultados: matchs.slice(0, 5).map((m) => ({
          codigo: m.registro.codigo,
          score: m.score,
          endereco:
            [m.registro.logradouro, m.registro.numero && `, ${m.registro.numero}`, m.registro.bairro && ` - ${m.registro.bairro}`]
              .filter(Boolean)
              .join('')
              .trim(),
        })),
        imagemPreview: imagePreview ?? undefined,
      });
    } catch {
      /* noop */
    }

    setEtapa('resultado');
  };

  const copiarCodigo = async (codigo: string) => {
    await copiarParaAreaTransferencia(codigo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1500);
  };

  const melhorResultado = resultados[0];
  const multiplos = status === 'MULTIPLOS_ENCONTRADOS';

  return (
    <div className="space-y-4 animate-slide-up">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900">
            Escanear etiqueta
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Câmera ou upload · OCR Português + Inglês · Score com pesos ponderados
          </p>
        </div>
        <Badge variant={planilhaValida ? 'success' : 'danger'}>
          {planilhaValida ? `${registros.length} endereços ativos` : 'Sem planilha ativa'}
        </Badge>
      </header>

      {!planilhaValida && etapa === 'escolha' && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="!p-4 flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-amber-900">Importe uma planilha primeiro</p>
              <p className="text-sm text-amber-800">
                O OCR vai funcionar, mas não há dados para comparar.{' '}
                <Link href="/importar" className="font-semibold underline underline-offset-2">
                  Ir para importação →
                </Link>
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      {etapa === 'escolha' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Card>
              <CardContent className="!p-5 flex flex-col gap-4 h-full">
                <div className="flex items-center justify-between">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-ml-blue shadow-sm">
                    <CamIcon className="h-6 w-6" />
                  </div>
                  <Badge variant="info">Recomendado</Badge>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Abrir câmera</h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    Abre a câmera TRASEIRA do celular direto (sem instalar nada). Fotografa a etiqueta e já envia para leitura.
                  </p>
                </div>
                <Button
                  size="lg"
                  variant="primary"
                  className="mt-auto"
                  onClick={() => inputCameraRef.current?.click()}
                >
                  <CamIcon className="h-4.5 w-4.5" /> Usar câmera do celular
                </Button>
                <input
                  ref={inputCameraRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={aoSelecionarArquivo}
                />
              </CardContent>
            </Card>

            <Card>
              <CardContent className="!p-5 flex flex-col gap-4 h-full">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                  <Upload className="h-6 w-6" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-neutral-900">Fazer upload</h3>
                  <p className="text-sm text-neutral-600 mt-1">
                    Já tem a foto? Envie da galeria, downloads ou arquivos do computador.
                  </p>
                </div>
                <div className="mt-auto">
                  <ImageUploader onSelecionado={aoCapturarImagem} />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="border-neutral-200 bg-white">
            <CardContent className="!p-4 flex flex-col sm:flex-row items-start sm:items-center sm:justify-between gap-3">
              <div className="min-w-0">
                <p className="font-bold text-neutral-900 text-[14.5px] flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4 text-blue-600" />
                  Dicas para a foto / etiqueta
                </p>
                <ul className="mt-1.5 text-sm text-neutral-600 list-disc list-inside space-y-0.5 pl-0.5">
                  <li>Boa iluminação (preferência luz natural)</li>
                  <li>Foco nítido na área do endereço / CEP</li>
                  <li>Procure enquadrar TODO o endereço (evite cortes)</li>
                </ul>
              </div>
              <div className="flex gap-2 shrink-0">
                <Button variant="secondary" size="sm" onClick={() => inputCameraRef.current?.click()}>
                  <CamIcon className="h-4 w-4" /> Câmera rápida
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => inputUploadRef.current?.click()}
                >
                  <Upload className="h-4 w-4" /> Galeria
                </Button>
                <input
                  ref={inputUploadRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={aoSelecionarArquivo}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {etapa === 'processando' && ocrProgresso && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[16px]">
              <Wand2 className="h-4.5 w-4.5 text-ml-blue animate-pulse-slow" />
              Processando imagem...
            </CardTitle>
            <CardDescription>
              {ocrProgresso.mensagem ?? 'Aguarde enquanto o OCR é executado.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {imagem && (
              <div className="overflow-hidden rounded-xl border border-black/5 bg-neutral-100">
                <img src={imagem} alt="etiqueta" className="h-56 w-full object-contain" />
              </div>
            )}
            <Progress
              value={ocrProgresso.progresso}
              label={
                ocrProgresso.status === 'concluido'
                  ? 'Concluído'
                  : ocrProgresso.status === 'erro'
                  ? 'Erro'
                  : ocrProgresso.mensagem
              }
            />
            <BadgeLoading />
          </CardContent>
        </Card>
      )}

      {erro && (
        <Card className="border-red-200 bg-red-50/40">
          <CardContent className="!p-4 flex items-start gap-3">
            <XCircle className="mt-0.5 h-5 w-5 text-red-600 shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-red-900">Erro</p>
              <p className="text-sm text-red-800">{erro}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {(etapa === 'corrigir' || etapa === 'resultado') && (
        <div className="space-y-4">
          <Card>
            <CardHeader className="!pb-2">
              <CardTitle className="text-[16px] flex items-center gap-2">
                <FileText className="h-4.5 w-4.5 text-neutral-700" />
                Texto extraído via OCR
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap rounded-xl bg-neutral-50 border border-neutral-200 p-3.5 text-[13px] leading-relaxed text-neutral-800 min-h-[72px] max-h-[200px] overflow-auto scrollbar-thin">
                {ocrTexto || <span className="text-neutral-400">(sem texto)</span>}
              </p>
              {etapa === 'resultado' && (
                <div className="mt-3 flex justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEtapa('corrigir')}>
                    <PencilLine className="h-3.5 w-3.5" /> Corrigir manualmente
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {imagem && etapa === 'corrigir' && (
            <ImagemPreview src={imagem} onRefazer={() => { reset(); setEtapa('escolha'); setErro(null); }} />
          )}

          {etapa === 'corrigir' && (
            <>
              {!validParse.valido && (
                <Card className="border-amber-200 bg-amber-50/40">
                  <CardContent className="!p-4 flex items-start gap-3">
                    <AlertTriangle className="mt-0.5 h-5 w-5 text-amber-600 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-amber-900">
                        Confira e corrija o endereço
                      </p>
                      <p className="text-sm text-amber-800">
                        Campos faltando ou fracos:{' '}
                        <span className="font-semibold">{validParse.camposFaltando.join(', ')}</span>
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )}
              <AddressForm value={endereco} onChange={setEndereco} />
              <div className="flex gap-2 justify-end flex-wrap">
                <Button variant="ghost" onClick={() => { reset(); setEtapa('escolha'); }}>
                  <RefreshCcw className="h-4 w-4" /> Cancelar
                </Button>
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => pesquisarEndereco(endereco, ocrTexto, imagem)}
                >
                  <Search className="h-4.5 w-4.5" />
                  Buscar novamente
                  <ArrowRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </>
          )}

          {etapa === 'resultado' && (
            <div className="space-y-4">
              {status === 'PLANILHA_NAO_IMPORTADA' && (
                <Card>
                  <CardContent className="!p-5 flex flex-col items-center gap-3 text-center">
                    <div className="flex h-16 w-16 items-center justify-center rounded-full bg-amber-50 text-amber-600">
                      <AlertTriangle className="h-8 w-8" />
                    </div>
                    <div>
                      <h3 className="text-lg font-bold">Planilha não importada</h3>
                      <p className="text-sm text-neutral-600 mt-1">
                        Importe um arquivo Excel para buscar os endereços.
                      </p>
                    </div>
                    <Button variant="primary" onClick={() => router.push('/importar')}>
                      Importar Excel
                    </Button>
                  </CardContent>
                </Card>
              )}

              {status !== 'PLANILHA_NAO_IMPORTADA' && (
                <>
                  {melhorResultado && status !== 'MULTIPLOS_ENCONTRADOS' && (
                    <Card className="relative overflow-hidden gradient-card border-emerald-200">
                      <div className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-emerald-400 via-ml-yellow to-ml-blue" />
                      <CardContent className="!p-0">
                        <div className="rounded-t-2xl bg-gradient-to-br from-ml-yellow via-[#fff48a] to-[#ffe600] px-4 py-5 sm:px-6 sm:py-7 border-b border-black/5">
                          <div className="flex flex-col gap-1 items-center text-center">
                            <span className="inline-flex items-center gap-1.5 rounded-full bg-black/85 px-3 py-1 text-[10.5px] font-bold uppercase tracking-[0.15em] text-[#fff159]">
                              {status === 'ENDERECO_ENCONTRADO' ? (
                                <>
                                  <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Número encontrado
                                </>
                              ) : (
                                <>
                                  <AlertTriangle className="h-3.5 w-3.5 text-amber-300" /> Resultado provável
                                </>
                              )}
                            </span>
                            <div className="mt-1 w-full flex items-center justify-center gap-2 flex-wrap">
                              <p className="bg-gradient-to-b from-neutral-900 via-neutral-800 to-blue-800 bg-clip-text text-transparent font-black tabular-nums leading-none break-all"
                                style={{ fontSize: 'clamp(3.5rem, 14vw, 7.5rem)' }}
                              >
                                {melhorResultado.registro.codigo}
                              </p>
                              {melhorResultado && <BadgeConfianca score={melhorResultado.score} />}
                            </div>
                            <div className="mt-2 w-full">
                              <Button
                                size="lg"
                                className="w-full sm:w-auto sm:min-w-[220px] !h-12 text-[15px] shadow-md"
                                variant={copiado ? 'success' : 'primary'}
                                onClick={() => copiarCodigo(melhorResultado.registro.codigo)}
                              >
                                {copiado ? (
                                  <>
                                    <CheckCircle2 className="h-5 w-5" /> Número copiado ✓
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-5 w-5" /> Copiar número
                                  </>
                                )}
                              </Button>
                            </div>
                          </div>
                        </div>

                        <div className="p-4 sm:p-5 space-y-4">
                          <MatchCard
                            item={melhorResultado}
                            destacado
                            onCopiar={copiarCodigo}
                          />
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {status === 'MULTIPLOS_ENCONTRADOS' && resultados.length > 1 && (
                    <Card>
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-[16px]">
                          <ListChecks className="h-5 w-5 text-amber-600" />
                          Encontramos {resultados.length} possibilidades
                        </CardTitle>
                        <CardDescription>Selecione o endereço correto manualmente</CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {resultados.map((r, i) => (
                          <div key={r.registro.id ?? i} className="flex gap-2 items-start">
                            <div className="pt-1.5 font-black text-neutral-400">{i + 1}.</div>
                            <div className="flex-1">
                              <MatchCard item={r} onCopiar={copiarCodigo} />
                            </div>
                          </div>
                        ))}
                      </CardContent>
                    </Card>
                  )}

                  {status === 'ENDERECO_NAO_ENCONTRADO' && (
                    <Card>
                      <CardContent className="!p-6 flex flex-col items-center gap-3 text-center">
                        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-red-50 text-red-600">
                          <XCircle className="h-7 w-7" />
                        </div>
                        <div>
                          <h3 className="text-lg font-bold text-neutral-900">
                            Nenhum endereço correspondente
                          </h3>
                          <p className="text-sm text-neutral-600 mt-1">
                            Verifique a planilha ou corrija os dados do endereço lido.
                          </p>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <Button
                      variant="primary"
                      size="lg"
                      className="sm:col-span-2 !h-14"
                      onClick={() => {
                        reset();
                        setEtapa('escolha');
                        setValidParse({ valido: true, camposFaltando: [] });
                      }}
                    >
                      <CamIcon className="h-5 w-5" />
                      Escanear outra etiqueta
                    </Button>
                    <Button
                      variant="ghost"
                      size="lg"
                      className="!h-14"
                      onClick={() => setEtapa('corrigir')}
                    >
                      <PencilLine className="h-4.5 w-4.5" /> Ajustar busca
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

      {planilhaValida && etapa === 'escolha' && <SpreadsheetStatus compact />}
    </div>
  );
}
