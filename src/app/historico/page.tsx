'use client';

import * as React from 'react';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge, BadgeConfianca } from '@/components/ui/Badge';
import { HistoryService } from '@/services/history/HistoryService';
import type { HistoricoConsulta, StatusConsulta } from '@/types';
import {
  CheckCircle2,
  AlertTriangle,
  ListChecks,
  XCircle,
  ImageOff,
  FileQuestion,
  DatabaseZap,
  Download,
  Filter,
  History,
  Trash2,
  Search,
  Clock,
} from 'lucide-react';
import { formatarData, truncate } from '@/lib/utils';
import { Input } from '@/components/ui/Input';

const STATUS_META: Record<StatusConsulta, { label: string; variant: React.ComponentProps<typeof Badge>['variant']; icon: React.ComponentType<{ className?: string }> }> = {
  ENDERECO_ENCONTRADO: { label: 'Encontrado', variant: 'success', icon: CheckCircle2 },
  ENDERECO_BAIXA_CONFIANCA: { label: 'Baixa confiança', variant: 'warning', icon: AlertTriangle },
  MULTIPLOS_ENCONTRADOS: { label: 'Múltiplos', variant: 'info', icon: ListChecks },
  ENDERECO_NAO_ENCONTRADO: { label: 'Não encontrado', variant: 'danger', icon: XCircle },
  IMAGEM_SEM_QUALIDADE: { label: 'Imagem ruim', variant: 'danger', icon: ImageOff },
  ENDERECO_NAO_IDENTIFICADO: { label: 'OCR incompleto', variant: 'warning', icon: FileQuestion },
  PLANILHA_NAO_IMPORTADA: { label: 'Sem planilha', variant: 'info', icon: DatabaseZap },
};

export default function HistoricoPage() {
  const [itens, setItens] = useState<HistoricoConsulta[]>([]);
  const [filtro, setFiltro] = useState<StatusConsulta | 'TODOS'>('TODOS');
  const [busca, setBusca] = useState('');
  const [exportando, setExportando] = useState(false);

  useEffect(() => {
    setItens(HistoryService.listar());
  }, []);

  const reobter = () => setItens(HistoryService.listar());

  const filtros: Array<typeof filtro> = ['TODOS', ...(Object.keys(STATUS_META) as StatusConsulta[])];

  const filtrados = itens.filter((h) => {
    if (filtro !== 'TODOS' && h.status !== filtro) return false;
    if (!busca.trim()) return true;
    const q = busca.trim().toLowerCase();
    return (
      h.codigoEncontrado?.toLowerCase().includes(q) ||
      h.textoOcr.toLowerCase().includes(q) ||
      h.enderecoEstruturado?.logradouro.toLowerCase().includes(q) ||
      h.enderecoEstruturado?.bairro?.toLowerCase().includes(q) ||
      h.enderecoEstruturado?.cidade?.toLowerCase().includes(q)
    );
  });

  const contagens = React.useMemo(() => {
    const out: Record<string, number> = { TODOS: itens.length };
    for (const h of itens) out[h.status] = (out[h.status] ?? 0) + 1;
    return out;
  }, [itens]);

  const exportar = async () => {
    try {
      setExportando(true);
      await HistoryService.exportarCsv();
    } finally {
      setExportando(false);
    }
  };

  const limpar = () => {
    if (!confirm('Remover todo o histórico?')) return;
    HistoryService.limpar();
    reobter();
  };

  return (
    <div className="space-y-4 animate-slide-up">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-xl sm:text-2xl font-black tracking-tight text-neutral-900">
            Histórico de consultas
          </h1>
          <p className="mt-1 text-sm text-neutral-600">
            {itens.length} {itens.length === 1 ? 'consulta registrada' : 'consultas registradas'}
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            onClick={exportar}
            disabled={!itens.length || exportando}
          >
            <Download className="h-4 w-4" /> {exportando ? 'Exportando...' : 'Exportar Excel'}
          </Button>
          <Button size="sm" variant="ghost" onClick={limpar} disabled={!itens.length}>
            <Trash2 className="h-4 w-4" /> Limpar
          </Button>
        </div>
      </header>

      <Card>
        <CardContent className="!p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Search className="h-4 w-4 text-neutral-500" />
            <Input
              placeholder="Buscar por código, rua, bairro..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>
          <div className="flex gap-1.5 flex-wrap -mx-1 overflow-x-auto scrollbar-thin px-1 pb-1">
            {filtros.map((f) => {
              const count = contagens[f] ?? 0;
              const ativo = filtro === f;
              return (
                <button
                  key={f}
                  onClick={() => setFiltro(f)}
                  className={`shrink-0 rounded-full px-3 py-1.5 text-[12px] font-semibold transition border ${
                    ativo
                      ? 'bg-ml-blue text-white border-ml-blue shadow-sm'
                      : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                  }`}
                >
                  <Filter className="inline h-3 w-3 mr-1 opacity-70" />
                  {f === 'TODOS' ? 'Todos' : STATUS_META[f as StatusConsulta]?.label ?? f}
                  <span className={`ml-1.5 ${ativo ? 'text-white/80' : 'text-neutral-500'}`}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {!filtrados.length ? (
        <Card>
          <CardContent className="!p-10 flex flex-col items-center gap-3 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-100 text-neutral-500">
              <History className="h-8 w-8" />
            </div>
            <div>
              <h3 className="text-[16px] font-bold text-neutral-900">Nenhuma consulta</h3>
              <p className="text-sm text-neutral-600 mt-1">
                {itens.length
                  ? 'Ajuste os filtros de busca.'
                  : 'Escanear uma etiqueta para começar.'}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2.5">
          {filtrados.map((h) => {
            const meta = STATUS_META[h.status] ?? STATUS_META.ENDERECO_NAO_ENCONTRADO;
            const Icon = meta.icon;
            const end = h.enderecoEstruturado;
            const enderecoResumido = end
              ? [
                  end.logradouro,
                  end.numero ? `, ${end.numero}` : '',
                  end.bairro ? ` - ${end.bairro}` : '',
                  end.cidade ? ` · ${end.cidade}` : '',
                  end.estado ? `/${end.estado}` : '',
                ]
                  .filter(Boolean)
                  .join('')
                  .trim()
              : '';
            return (
              <Card key={h.id} className="overflow-hidden transition hover:shadow-sm">
                <CardContent className="!p-4">
                  <div className="flex gap-4">
                    <div className="flex w-14 shrink-0 flex-col items-center gap-1.5">
                      <div
                        className={`flex h-12 w-12 items-center justify-center rounded-xl ${
                          meta.variant === 'success'
                            ? 'bg-emerald-50 text-emerald-600'
                            : meta.variant === 'warning'
                            ? 'bg-amber-50 text-amber-600'
                            : meta.variant === 'danger'
                            ? 'bg-red-50 text-red-600'
                            : 'bg-blue-50 text-blue-600'
                        }`}
                      >
                        <Icon className="h-5.5 w-5 h-5 w-5 h-5 w-5" />
                      </div>
                      {h.confianca != null && <BadgeConfianca score={h.confianca} />}
                    </div>
                    <div className="min-w-0 flex-1 space-y-1.5">
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2">
                          <Badge variant={meta.variant}>{meta.label}</Badge>
                          {h.codigoEncontrado && (
                            <span className="font-black text-[18px] tracking-tight text-neutral-900 tabular-nums">
                              #{h.codigoEncontrado}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-1.5 text-[11.5px] text-neutral-500">
                          <Clock className="h-3.5 w-3.5" />
                          {formatarData(h.dataHora)}
                        </div>
                      </div>
                      {enderecoResumido && (
                        <p className="text-[13.5px] leading-snug text-neutral-800 break-words">
                          {enderecoResumido}
                        </p>
                      )}
                      {h.textoOcr && (
                        <p className="rounded-lg bg-neutral-50 border border-neutral-100 px-2.5 py-1.5 text-[11.5px] leading-snug text-neutral-600 line-clamp-2">
                          {truncate(h.textoOcr, 180)}
                        </p>
                      )}
                      {h.multiplosResultados && h.multiplosResultados.length > 1 && (
                        <div className="flex flex-wrap gap-1 pt-0.5">
                          {h.multiplosResultados.map((m, i) => (
                            <span
                              key={i}
                              className="inline-flex items-center gap-1 rounded-full border border-neutral-200 bg-white px-2 py-0.5 text-[10.5px] font-semibold text-neutral-700"
                            >
                              #{m.codigo} <span className="text-neutral-500">{m.score}%</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
