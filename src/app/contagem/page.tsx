'use client';

import * as React from 'react';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { QrCodeScanner, extrairCodigoDoJson } from '@/components/QrCodeScanner';
import { usePacoteStore } from '@/stores/pacoteStore';
import type { OrigemLeitura } from '@/types';
import {
  Package,
  QrCode,
  Usb,
  PencilLine,
  Trash2,
  Download,
  Search,
  RotateCcw,
  Clock,
  CheckCircle2,
  Sparkles,
  XCircle,
  Hash,
} from 'lucide-react';
import { formatarData, truncate } from '@/lib/utils';

type Modo = 'camera' | 'leitor' | 'manual';

const MODO_META: Record<
  Modo,
  { label: string; icon: React.ComponentType<{ className?: string }>; origem: OrigemLeitura }
> = {
  camera: { label: 'Câmera / QR', icon: QrCode, origem: 'camera' },
  leitor: { label: 'Leitor externo', icon: Usb, origem: 'leitor_externo' },
  manual: { label: 'Digitar ID', icon: PencilLine, origem: 'manual' },
};

export default function ContagemPage() {
  const pacotes = usePacoteStore((s) => s.pacotes);
  const carregando = usePacoteStore((s) => s.carregando);
  const ultimoLido = usePacoteStore((s) => s.ultimoLido);
  const carregar = usePacoteStore((s) => s.carregar);
  const adicionar = usePacoteStore((s) => s.adicionar);
  const remover = usePacoteStore((s) => s.remover);
  const limpar = usePacoteStore((s) => s.limpar);
  const total = usePacoteStore((s) => s.total());
  const unicos = usePacoteStore((s) => s.unicos());
  const exportar = usePacoteStore((s) => s.exportar);

  const [modo, setModo] = React.useState<Modo>('leitor');
  const [codigoManual, setCodigoManual] = React.useState('');
  const [codigoLeitor, setCodigoLeitor] = React.useState('');
  const [filtro, setFiltro] = React.useState('');
  const [exportando, setExportando] = React.useState(false);
  const [flashId, setFlashId] = React.useState<string | null>(null);
  const inputLeitorRef = React.useRef<HTMLInputElement>(null);
  const inputManualRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    carregar();
  }, [carregar]);

  React.useEffect(() => {
    if (modo === 'leitor' && inputLeitorRef.current) {
      inputLeitorRef.current.focus();
    } else if (modo === 'manual' && inputManualRef.current) {
      inputManualRef.current.focus();
    }
  }, [modo]);

  React.useEffect(() => {
    if (ultimoLido) {
      setFlashId(ultimoLido.id);
      const t = setTimeout(() => setFlashId(null), 1500);
      return () => clearTimeout(t);
    }
  }, [ultimoLido]);

  const processarCodigo = async (raw: string, origem: OrigemLeitura) => {
    const extraido = extrairCodigoDoJson(raw);
    if (!extraido.codigo) return;
    await adicionar(extraido.codigo, origem, { tipo: extraido.tipo });
  };

  const onCodigoCamera = (codigo: string, raw?: string) => {
    void processarCodigo(raw ?? codigo, 'camera');
  };

  const onSubmitLeitor = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = codigoLeitor.trim();
    if (!val) return;
    await processarCodigo(val, 'leitor_externo');
    setCodigoLeitor('');
    inputLeitorRef.current?.focus();
  };

  const onSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = codigoManual.trim();
    if (!val) return;
    await processarCodigo(val, 'manual');
    setCodigoManual('');
    inputManualRef.current?.focus();
  };

  const confirmarLimpar = () => {
    if (!pacotes.length) return;
    if (!confirm(`Remover TODOS os ${pacotes.length} pacotes da contagem?`)) return;
    void limpar();
  };

  const acaoExportar = async () => {
    if (!pacotes.length) return;
    try {
      setExportando(true);
      await exportar();
    } finally {
      setExportando(false);
    }
  };

  const filtrados = React.useMemo(() => {
    if (!filtro.trim()) return pacotes;
    const q = filtro.trim().toLowerCase();
    return pacotes.filter(
      (p) =>
        p.codigo_pacote.toLowerCase().includes(q) ||
        (p.tipo ?? '').toLowerCase().includes(q) ||
        p.id.toLowerCase().includes(q),
    );
  }, [pacotes, filtro]);

  return (
    <div className="space-y-4 animate-slide-up">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900">
            Contagem de pacotes
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            Câmera, leitor externo ou digitação · salvo no banco · não perde em refresh
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={acaoExportar}
            disabled={!pacotes.length || exportando}
          >
            <Download className="h-4 w-4" />
            {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={confirmarLimpar}
            disabled={!pacotes.length}
          >
            <Trash2 className="h-4 w-4" /> Limpar tudo
          </Button>
        </div>
      </header>

      <section className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="relative overflow-hidden gradient-card border-emerald-200">
          <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-emerald-400 via-ml-yellow to-ml-blue" />
          <CardContent className="!p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Total lidos
                </p>
                <p className="mt-1 text-4xl sm:text-5xl font-black tracking-tight tabular-nums bg-gradient-to-b from-neutral-900 to-blue-800 bg-clip-text text-transparent">
                  {total}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-600 shadow-sm">
                <Package className="h-6 w-6" />
              </div>
            </div>
            {ultimoLido && (
              <div className="mt-3 rounded-xl border border-emerald-200 bg-emerald-50/60 px-3 py-2 flex items-center gap-2 min-w-0">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                <span className="text-[12px] font-semibold text-emerald-800 truncate">
                  Último: <span className="font-black text-emerald-900">#{ultimoLido.codigo_pacote}</span>
                </span>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="!p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  IDs únicos
                </p>
                <p className="mt-1 text-4xl sm:text-5xl font-black tracking-tight tabular-nums text-ml-blue">
                  {unicos}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-ml-blue shadow-sm">
                <Hash className="h-6 w-6" />
              </div>
            </div>
            <div className="mt-3 rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2">
              <span className="text-[12px] font-semibold text-neutral-600">
                Duplicados detectados:{' '}
                <span className="font-black text-neutral-900">{total - unicos}</span>
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="!p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-neutral-500">
                  Status
                </p>
                <p className="mt-1 text-2xl sm:text-3xl font-black tracking-tight tabular-nums">
                  {carregando ? (
                    <span className="text-amber-600">Carregando</span>
                  ) : (
                    <Badge variant="success">Sincronizado</Badge>
                  )}
                </p>
              </div>
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-violet-50 text-violet-600 shadow-sm">
                <Sparkles className="h-6 w-6" />
              </div>
            </div>
            <Button
              size="sm"
              variant="ghost"
              className="mt-3 w-full !h-9"
              onClick={() => void carregar()}
            >
              <RotateCcw className="h-3.5 w-3.5" /> Atualizar do banco
            </Button>
          </CardContent>
        </Card>
      </section>

      <Card>
        <CardContent className="!p-4 space-y-4">
          <div className="grid grid-cols-3 gap-1.5 p-1 rounded-2xl bg-neutral-100">
            {(Object.keys(MODO_META) as Modo[]).map((m) => {
              const meta = MODO_META[m];
              const Icon = meta.icon;
              const ativo = modo === m;
              return (
                <button
                  key={m}
                  onClick={() => setModo(m)}
                  className={`rounded-xl py-3 px-2 flex flex-col items-center justify-center gap-1 font-bold text-[12.5px] transition ${
                    ativo
                      ? 'bg-white text-neutral-900 shadow-sm ring-1 ring-black/5'
                      : 'text-neutral-500 hover:text-neutral-700'
                  }`}
                >
                  <Icon className={`h-5 w-5 ${ativo ? 'text-ml-blue' : ''}`} />
                  {meta.label}
                </button>
              );
            })}
          </div>

          {modo === 'camera' && (
            <QrCodeScanner onCodigoLido={onCodigoCamera} />
          )}

          {modo === 'leitor' && (
            <form onSubmit={onSubmitLeitor} className="space-y-2">
              <Label htmlFor="leitor-input" className="flex items-center gap-1.5">
                <Usb className="h-3.5 w-3.5 text-neutral-500" />
                Leitor externo (USB / serial) · aperte ENTER após leitura
              </Label>
              <div className="flex gap-2">
                <Input
                  id="leitor-input"
                  ref={inputLeitorRef}
                  placeholder="Cole ou aponte o leitor aqui..."
                  value={codigoLeitor}
                  onChange={(e) => setCodigoLeitor(e.target.value)}
                  className="!h-14 text-lg font-bold tabular-nums tracking-wide"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="primary"
                  disabled={!codigoLeitor.trim()}
                >
                  <CheckCircle2 className="h-5 w-5" /> Contar
                </Button>
              </div>
              <p className="text-[11.5px] text-neutral-500">
                Dica: leitores externos geralmente enviam Enter automaticamente após cada leitura.
                Campo sempre em foco neste modo.
              </p>
            </form>
          )}

          {modo === 'manual' && (
            <form onSubmit={onSubmitManual} className="space-y-2">
              <Label htmlFor="manual-input" className="flex items-center gap-1.5">
                <PencilLine className="h-3.5 w-3.5 text-neutral-500" />
                Digite o ID / código do pacote
              </Label>
              <div className="flex gap-2">
                <Input
                  id="manual-input"
                  ref={inputManualRef}
                  placeholder="Ex: 47960709702"
                  value={codigoManual}
                  onChange={(e) => setCodigoManual(e.target.value)}
                  className="!h-14 text-lg font-bold tabular-nums tracking-wide"
                  autoComplete="off"
                  autoCorrect="off"
                  autoCapitalize="off"
                  spellCheck={false}
                />
                <Button
                  type="submit"
                  size="lg"
                  variant="primary"
                  disabled={!codigoManual.trim()}
                >
                  <CheckCircle2 className="h-5 w-5" /> Contar
                </Button>
              </div>
            </form>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="!p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-neutral-500" />
            <Input
              placeholder={`Buscar nos ${pacotes.length} pacotes...`}
              value={filtro}
              onChange={(e) => setFiltro(e.target.value)}
              className="!h-10"
            />
          </div>
          <div className="text-[11.5px] font-semibold text-neutral-500">
            Exibindo {filtrados.length} de {pacotes.length}
          </div>
        </CardContent>
      </Card>

      {!filtrados.length ? (
        <Card>
          <CardContent className="!p-10 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <Package className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-neutral-900">
                {pacotes.length ? 'Nenhum resultado na busca' : 'Nenhum pacote contado'}
              </h3>
              <p className="text-sm text-neutral-600 mt-1">
                {pacotes.length
                  ? 'Ajuste o filtro de busca.'
                  : 'Use a câmera, leitor externo ou digite o ID para começar.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2 max-h-[600px] overflow-auto scrollbar-thin pr-1">
          {filtrados.map((p, idx) => {
            const origemMap: Record<OrigemLeitura, { label: string; variant: React.ComponentProps<typeof Badge>['variant']; icon: React.ComponentType<{ className?: string }> }> = {
              camera: { label: 'Câmera', variant: 'info', icon: QrCode },
              leitor_externo: { label: 'Leitor', variant: 'success', icon: Usb },
              manual: { label: 'Manual', variant: 'warning', icon: PencilLine },
            };
            const oMeta = origemMap[p.origem];
            const OIcon = oMeta.icon;
            const destaque = flashId === p.id;
            const d = new Date(p.created_at);
            return (
              <Card
                key={p.id}
                className={`overflow-hidden transition-all duration-300 ${
                  destaque
                    ? 'ring-2 ring-emerald-400 shadow-lg bg-emerald-50/50 border-emerald-200'
                    : 'hover:shadow-sm'
                }`}
              >
                <CardContent className="!p-3.5 !pl-4 flex items-center gap-3">
                  <div className="flex w-12 shrink-0 flex-col items-center justify-center">
                    <div className="text-[10px] font-black uppercase tracking-wider text-neutral-400">
                      #{pacotes.length - idx}
                    </div>
                    <div
                      className={`mt-0.5 flex h-10 w-10 items-center justify-center rounded-xl ${
                        oMeta.variant === 'info'
                          ? 'bg-blue-50 text-ml-blue'
                          : oMeta.variant === 'success'
                          ? 'bg-emerald-50 text-emerald-600'
                          : 'bg-amber-50 text-amber-600'
                      }`}
                    >
                      <OIcon className="h-5 w-5" />
                    </div>
                  </div>

                  <div className="min-w-0 flex-1 space-y-0.5">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[18px] sm:text-[20px] font-black tracking-tight tabular-nums text-neutral-900 break-all">
                        {p.codigo_pacote}
                      </span>
                      {p.tipo && (
                        <Badge variant="info" className="!py-0.5">
                          tipo: {p.tipo}
                        </Badge>
                      )}
                      <Badge variant={oMeta.variant} className="!py-0.5">
                        {oMeta.label}
                      </Badge>
                      {p.sincronizado ? (
                        <Badge variant="success" className="!py-0.5 !text-[10px]">
                          <CheckCircle2 className="h-2.5 w-2.5 mr-0.5" /> BD
                        </Badge>
                      ) : (
                        <Badge variant="warning" className="!py-0.5 !text-[10px]">
                          Local
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-[11.5px] text-neutral-500">
                      <Clock className="h-3 w-3" />
                      {formatarData(d.getTime())}
                      <span className="text-neutral-300">·</span>
                      <span className="truncate">ID: {truncate(p.id, 10)}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => void remover(p.id)}
                    className="shrink-0 flex h-8 w-8 items-center justify-center rounded-lg text-neutral-400 hover:bg-red-50 hover:text-red-600 transition"
                    aria-label="Remover"
                    title="Remover da contagem"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
