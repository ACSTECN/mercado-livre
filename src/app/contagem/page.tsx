'use client';

import * as React from 'react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Input, Textarea } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { QrCodeScanner, extrairCodigoDoJson } from '@/components/QrCodeScanner';
import { usePacoteStore } from '@/stores/pacoteStore';
import type { OrigemLeitura, ResultadoAdicaoPacote, Saca, PacoteLidoLocal, ResultadoMoverPacote, StatusPacote } from '@/types';
import { STATUS_PACOTE_META } from '@/types';
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
  XCircle,
  Hash,
  AlertTriangle,
  Ban,
  Volume2,
  VolumeX,
  Boxes,
  FolderPlus,
  FolderOpen,
  FolderClosed,
  X,
  ChevronDown,
  ChevronRight,
  Calendar,
  Lock,
  Unlock,
  ListTodo,
  Plus,
  UserRound,
  Truck,
  ArrowRightLeft,
  Users,
  RefreshCw,
  Undo2,
  CheckCheck,
  CheckSquare,
  Filter,
  HardDrive,
  Database,
  FileJson,
  Upload,
  WifiOff,
  BarChart3,
  Route,
  FileText,
  Copy,
  Check,
  UserPlus,
  MapPin,
} from 'lucide-react';
import { formatarData, truncate } from '@/lib/utils';
import {
  NEXT_PUBLIC_SUPABASE_URL_DEBUG,
  NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG,
  VERSAO_HARDCODED_CHAVE,
} from '@/lib/supabase';
import { PacoteService } from '@/services/packages/PacoteService';
import { SacaService } from '@/services/packages/SacaService';
import { parsearJsonRotasML, parsearJsonZonasML, type ResultadoParseRotas, type ResultadoParseZonas } from '@/services/routes/MlRoutesImportService';

type Modo = 'camera' | 'leitor' | 'manual';

const MODO_META: Record<
  Modo,
  { label: string; icon: React.ComponentType<{ className?: string }>; origem?: OrigemLeitura }
> = {
  camera: { label: 'Câmera / QR', icon: QrCode, origem: 'camera' },
  leitor: { label: 'Leitor externo', icon: Usb, origem: 'leitor_externo' },
  manual: { label: 'Digitar ID', icon: PencilLine, origem: 'manual' },
};

type TipoFeedback = 'sucesso' | 'duplicado' | 'erro' | 'movido' | null;

function beep(tipo: 'sucesso' | 'erro' | 'movido') {
  try {
    if (typeof window === 'undefined' || !(window as unknown as { AudioContext?: unknown }).AudioContext) return;
    const AC = (window as unknown as { AudioContext: typeof AudioContext }).AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    if (tipo === 'sucesso') {
      osc.frequency.value = 880;
      osc.type = 'sine';
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } else if (tipo === 'movido') {
      osc.frequency.value = 660;
      osc.type = 'triangle';
      gain.gain.setValueAtTime(0.22, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.22);
      osc.start();
      osc.stop(ctx.currentTime + 0.22);
    } else {
      osc.frequency.value = 220;
      osc.type = 'square';
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch {
    /* noop */
  }
}

function ModalBase({
  aberto,
  aoFechar,
  children,
  maxW = 'max-w-lg',
}: {
  aberto: boolean;
  aoFechar: () => void;
  children: React.ReactNode;
  maxW?: string;
}) {
  if (!aberto) return null;
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 animate-fade-in">
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={aoFechar}
      />
      <div
        className={`relative w-full ${maxW} bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-3xl shadow-2xl animate-slide-up max-h-[92vh] overflow-hidden flex flex-col`}
      >
        {children}
      </div>
    </div>
  );
}

function ModalNovaSaca() {
  const store = usePacoteStore();
  const [nome, setNome] = React.useState('');
  const [descricao, setDescricao] = React.useState('');
  const [erro, setErro] = React.useState<string | null>(null);
  const [carregando, setCarregando] = React.useState(false);

  const sugestao = React.useMemo(() => {
    const d = new Date();
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const aaaa = d.getFullYear();
    return `Saca ${dd}/${mm}/${aaaa}`;
  }, []);

  React.useEffect(() => {
    if (store.mostrarModalSaca && !nome) setNome(sugestao);
  }, [store.mostrarModalSaca, sugestao, nome]);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nome.trim()) {
      setErro('Informe o nome da saca');
      return;
    }
    try {
      setCarregando(true);
      await store.criarSaca(nome.trim(), descricao.trim() || undefined);
      setNome('');
      setDescricao('');
      setErro(null);
    } catch (e) {
      setErro(e instanceof Error ? e.message : 'Erro ao criar saca');
    } finally {
      setCarregando(false);
    }
  };

  return (
    <ModalBase aberto={store.mostrarModalSaca} aoFechar={() => {}} maxW="max-w-md">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-ml-blue to-emerald-400 text-white flex items-center justify-center shadow-lg shadow-blue-500/20">
              <Boxes className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Iniciar nova saca
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Cada dia/lote é uma saca separada
              </p>
            </div>
          </div>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="saca-nome" className="text-[13px] font-bold">
              Nome da saca *
            </Label>
            <Input
              id="saca-nome"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Ex: Saca 11/09 Manhã"
              className="!h-12 text-[15px] font-bold"
              autoFocus
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="saca-desc" className="text-[13px] font-bold text-slate-400">
              Descrição (opcional)
            </Label>
            <Input
              id="saca-desc"
              value={descricao}
              onChange={(e) => setDescricao(e.target.value)}
              placeholder="Ex: Rota centro, entregador João..."
              className="!h-11 text-[14px]"
            />
          </div>

          {erro && (
            <div className="rounded-xl border border-red-400/30 bg-red-400/12 px-3 py-2 flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-red-300 shrink-0" />
              <span className="text-[12.5px] font-semibold text-red-200">{erro}</span>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            {store.sacas.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="lg"
                onClick={() => {
                  store.fecharModalSaca();
                  store.abrirHistoricoSacas();
                }}
              >
                <ListTodo className="h-4 w-4" />
                Abrir existente
              </Button>
            )}
            <Button
              type="submit"
              variant="primary"
              size="lg"
              disabled={!nome.trim() || carregando}
              className="flex-1"
            >
              {carregando ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Criando...
                </>
              ) : (
                <>
                  <FolderPlus className="h-4 w-4" />
                  Criar e começar
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </ModalBase>
  );
}

function ModalHistoricoSacas() {
  const store = usePacoteStore();
  const [filtro, setFiltro] = React.useState('');
  const [removendo, setRemovendo] = React.useState<string | null>(null);

  const filtradas = React.useMemo(() => {
    if (!filtro.trim()) return store.sacas;
    const q = filtro.toLowerCase();
    return store.sacas.filter(
      (s) => s.nome.toLowerCase().includes(q) || (s.descricao ?? '').toLowerCase().includes(q),
    );
  }, [store.sacas, filtro]);

  const resumoMap = React.useMemo(() => {
    const m = new Map<string, { total: number; unicos: number }>();
    for (const r of store.resumos) m.set(r.saca.id, { total: r.total, unicos: r.unicos });
    return m;
  }, [store.resumos]);

  return (
    <ModalBase
      aberto={store.mostrarHistoricoSacas}
      aoFechar={store.fecharHistoricoSacas}
      maxW="max-w-xl"
    >
      <div className="p-6 sm:p-7 border-b border-white/10 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-ml-blue" />
            Sacas
          </h2>
          <p className="text-sm text-slate-400 mt-0.5">
            Total de {store.sacas.length} saca(s) · clique para abrir
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              store.fecharHistoricoSacas();
              store.abrirModalSaca();
            }}
          >
            <Plus className="h-4 w-4" />
            Nova
          </Button>
          <button
            onClick={store.fecharHistoricoSacas}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      <div className="px-6 sm:px-7 pt-4">
        <div className="flex items-center gap-2">
          <Search className="h-4 w-4 text-slate-400" />
          <Input
            placeholder="Buscar saca..."
            value={filtro}
            onChange={(e) => setFiltro(e.target.value)}
            className="!h-10"
          />
        </div>
      </div>

      <div className="p-5 sm:p-7 overflow-auto space-y-2">
        {!filtradas.length ? (
          <div className="py-10 text-center">
            <FolderClosed className="h-12 w-12 text-neutral-300 mx-auto" />
            <p className="text-sm text-slate-400 mt-2">Nenhuma saca encontrada</p>
          </div>
        ) : (
          filtradas.map((s) => {
            const resumo = resumoMap.get(s.id) ?? { total: 0, unicos: 0 };
            const aberta = s.status === 'aberta';
            const ativa = store.sacaAtiva?.id === s.id;
            return (
              <Card
                key={s.id}
                className={`cursor-pointer transition-all duration-200 group ${
                  ativa
                    ? 'ring-2 ring-ml-blue border-blue-400/30 bg-blue-400/12'
                    : 'hover:shadow-md hover:-translate-y-0.5'
                }`}
                onClick={() => {
                  void store.definirSacaAtiva(s.id);
                }}
              >
                <CardContent className="!p-4 !pl-5 flex items-center gap-4">
                  <div
                    className={`h-12 w-12 shrink-0 rounded-2xl flex items-center justify-center ${
                      aberta
                        ? 'bg-emerald-400/12 text-emerald-300'
                        : 'bg-white/[0.06] text-slate-400'
                    }`}
                  >
                    {aberta ? (
                      <FolderOpen className="h-6 w-6" />
                    ) : (
                      <FolderClosed className="h-6 w-6" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-[16px] font-black tracking-tight text-white truncate">
                        {s.nome}
                      </h3>
                      <Badge variant={aberta ? 'success' : 'info'} className="!text-[10.5px] !py-0.5">
                        {aberta ? 'Aberta' : 'Fechada'}
                      </Badge>
                      {ativa && (
                        <Badge variant="warning" className="!text-[10.5px] !py-0.5">
                          Atual
                        </Badge>
                      )}
                    </div>
                    {s.descricao && (
                      <p className="text-[12px] text-slate-400 truncate mt-0.5">{s.descricao}</p>
                    )}
                    <div className="flex items-center gap-2 text-[11.5px] text-slate-400 mt-1">
                      <Calendar className="h-3 w-3" />
                      {formatarData(new Date(s.created_at).getTime())}
                      <span className="text-neutral-300">·</span>
                      <Hash className="h-3 w-3" />
                      {resumo.unicos} IDs
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <p className="text-[22px] font-black tabular-nums text-ml-blue leading-none">
                      {resumo.unicos}
                    </p>
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      únicos
                    </p>
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => {
                          if (aberta) void store.fecharSaca(s.id);
                          else void store.reabrirSaca(s.id);
                        }}
                      >
                        {aberta ? (
                          <>
                            <Lock className="h-3 w-3" /> Fechar
                          </>
                        ) : (
                          <>
                            <Unlock className="h-3 w-3" /> Abrir
                          </>
                        )}
                      </Button>
                      <Button
                        size="xs"
                        variant="ghost"
                        disabled={removendo === s.id}
                        onClick={() => {
                          if (!confirm(`Remover saca "${s.nome}" e TODOS os ${resumo.unicos} pacotes dela?`)) return;
                          setRemovendo(s.id);
                          void store.removerSaca(s.id).finally(() => setRemovendo(null));
                        }}
                      >
                        <Trash2 className="h-3 w-3 text-red-400" />
                      </Button>
                    </div>
                  </div>
                  <ChevronRight className="h-5 w-5 text-neutral-300 group-hover:text-ml-blue transition shrink-0" />
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
    </ModalBase>
  );
}

function SeletorEntregador({ aoGerenciar }: { aoGerenciar?: () => void }) {
  const store = usePacoteStore();
  const [aberto, setAberto] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const containerRef = React.useRef<HTMLDivElement>(null);

  const entregadoresStore = store.entregadores;
  const entregadoresDaSaca = store.entregadoresSaca;
  const contagensEntregadores = store.contagensEntregadores;

  const mapaContagem = React.useMemo(() => {
    const m = new Map<string, { qtd: number; retornos: number }>();
    for (const c of contagensEntregadores) m.set(c.nome, { qtd: c.qtd, retornos: c.retornos });
    return m;
  }, [contagensEntregadores]);

  const todos = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of entregadoresDaSaca) s.add(e);
    for (const e of entregadoresStore) s.add(e);
    const arr = Array.from(s);
    arr.sort((a, b) => {
      const ca = mapaContagem.get(a) ?? { qtd: 0, retornos: 0 };
      const cb = mapaContagem.get(b) ?? { qtd: 0, retornos: 0 };
      if (cb.qtd !== ca.qtd) return cb.qtd - ca.qtd;
      return a.localeCompare(b, 'pt-BR');
    });
    return arr;
  }, [entregadoresStore, entregadoresDaSaca, mapaContagem]);

  const q = query.trim();
  const qLow = q.toLowerCase();

  const matchExato = React.useMemo(() => {
    if (!q) return null;
    return todos.find((t) => t.toLowerCase() === qLow) ?? null;
  }, [todos, q, qLow]);

  const filtrados = React.useMemo(() => {
    if (!q) return todos;
    const restantes = todos.filter((t) => !(matchExato && t.toLowerCase() === qLow));
    const comeca = restantes.filter((t) => t.toLowerCase().startsWith(qLow));
    const contem = restantes.filter(
      (t) => !t.toLowerCase().startsWith(qLow) && t.toLowerCase().includes(qLow),
    );
    return [...comeca, ...contem];
  }, [todos, q, qLow, matchExato]);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target as Node)) setAberto(false);
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const ativo = store.entregadorAtivo;

  const fechar = () => {
    setAberto(false);
    setQuery('');
  };

  const escolher = (nome: string) => {
    void store.definirEntregador(nome);
    fechar();
  };

  const confirmar = () => {
    if (!q) return;
    if (matchExato) {
      escolher(matchExato);
      return;
    }
    if (filtrados.length === 1) {
      escolher(filtrados[0]);
      return;
    }
  };

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto">
      <button
        type="button"
        onClick={() => {
          setAberto((v) => !v);
          setQuery('');
        }}
        className={`w-full sm:w-auto inline-flex items-center gap-1.5 rounded-xl border px-2.5 py-1.5 transition ${
          ativo
            ? 'bg-gradient-to-r from-indigo-400/12 to-violet-400/12 border-indigo-400/30 hover:shadow-sm'
            : 'bg-amber-400/12 border-amber-400/30 hover:shadow-sm'
        }`}
      >
        <div
          className={`h-7 w-7 rounded-lg flex items-center justify-center ${
            ativo ? 'bg-indigo-400/15 text-indigo-300' : 'bg-amber-400/15 text-amber-300'
          }`}
        >
          {ativo ? <Truck className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
        </div>
        <div className="text-left min-w-0">
          <div className={`text-[9.5px] font-bold uppercase tracking-wider leading-none mb-0.5 ${
            ativo ? 'text-indigo-400' : 'text-amber-300'
          }`}>
            {ativo ? 'Entregador' : 'Selecionar'}
          </div>
          <div className="flex items-center gap-1 flex-wrap">
            <div className={`text-[12.5px] font-black tracking-tight truncate max-w-[140px] leading-tight ${
              ativo ? 'text-white' : 'text-amber-200'
            }`}>
              {ativo ?? 'Toque aqui'}
            </div>
            {ativo && (() => {
              const c = mapaContagem.get(ativo);
              if (!c || c.qtd === 0) return null;
              return (
                <span className="text-[10px] font-black tabular-nums bg-violet-400/15 text-violet-300 px-1.5 py-0.5 rounded shrink-0">
                  {c.qtd}
                </span>
              );
            })()}
          </div>
        </div>
        <ChevronDown className={`h-3.5 w-3.5 shrink-0 ${ativo ? 'text-indigo-400' : 'text-amber-400'} ${aberto ? 'rotate-180' : ''} transition`} />
      </button>

      {aberto && (
        <div className="absolute z-50 top-full mt-2 left-0 right-0 sm:w-[340px] bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl shadow-2xl border border-white/10 p-3 animate-slide-up">
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-slate-400 shrink-0" />
              <Input
                autoFocus
                placeholder="Buscar entregador..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmar();
                  }
                }}
                className="!h-10 !text-[13.5px]"
              />
            </div>

            {q && !matchExato && filtrados.length === 0 && (
              <div className="rounded-xl border border-amber-400/25 bg-amber-400/12 p-3 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-300 shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="text-[12px] font-black text-amber-200 leading-tight">
                    Nenhum entregador encontrado
                  </div>
                  <div className="text-[11px] text-amber-300 mt-0.5">
                    Toque em "Gerenciar entregadores" abaixo para cadastrar.
                  </div>
                </div>
              </div>
            )}

            <div className="max-h-64 overflow-auto space-y-1 pr-1 pt-1">
              {todos.length === 0 && !q ? (
                <div className="py-6 text-center">
                  <div className="h-12 w-12 mx-auto rounded-xl bg-white/[0.06] text-slate-400 flex items-center justify-center mb-2.5">
                    <Users className="h-6 w-6" />
                  </div>
                  <div className="text-[13px] font-bold text-slate-300">Sem entregadores</div>
                  <div className="text-[11.5px] text-slate-400 mt-0.5">
                    Toque em Gerenciar abaixo para cadastrar.
                  </div>
                </div>
              ) : (
                <>
                  {matchExato && (
                    <button
                      key={matchExato}
                      type="button"
                      onClick={() => escolher(matchExato)}
                      className="w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition bg-indigo-400/12 text-indigo-300 ring-1 ring-indigo-400/30"
                    >
                      <div className="flex items-center gap-2 min-w-0 flex-1">
                        <span className="text-[13.5px] font-black truncate">{matchExato}</span>
                      </div>
                      <div className="shrink-0 inline-flex items-center gap-1.5">
                        {(() => {
                          const counts = mapaContagem.get(matchExato);
                          return counts && counts.qtd > 0 ? (
                            <span className="text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md bg-indigo-400/15 text-indigo-300">
                              {counts.qtd}
                            </span>
                          ) : null;
                        })()}
                        <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-300" />
                      </div>
                    </button>
                  )}
                  {filtrados.map((nome) => {
                    const selecionado = ativo === nome;
                    const counts = mapaContagem.get(nome);
                    return (
                      <button
                        key={nome}
                        type="button"
                        onClick={() => escolher(nome)}
                        className={`w-full text-left px-3 py-2 rounded-xl flex items-center justify-between gap-2 transition ${
                          selecionado
                            ? 'bg-indigo-400/12 text-indigo-300 ring-1 ring-indigo-400/30'
                            : 'hover:bg-white/[0.06] text-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="text-[13.5px] font-bold truncate">{nome}</span>
                        </div>
                        <div className="shrink-0 inline-flex items-center gap-1.5">
                          {counts && counts.qtd > 0 && (
                            <span
                              className={`text-[11px] font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                                selecionado
                                  ? 'bg-indigo-400/15 text-indigo-300'
                                  : 'bg-violet-400/12 text-violet-300'
                              }`}
                            >
                              {counts.qtd}
                            </span>
                          )}
                          {counts && counts.retornos > 0 && (
                            <span
                              className={`inline-flex items-center gap-0.5 text-[10.5px] font-black tabular-nums px-1.5 py-0.5 rounded-md ${
                                selecionado
                                  ? 'bg-orange-400/15 text-orange-300'
                                  : 'bg-orange-400/12 text-orange-300 ring-1 ring-orange-400/30'
                              }`}
                              title={`${counts.retornos} retorno(s)`}
                            >
                              <RefreshCw className="h-3 w-3" />
                              {counts.retornos}
                            </span>
                          )}
                          {selecionado && <CheckCircle2 className="h-4 w-4 shrink-0 text-indigo-300" />}
                        </div>
                      </button>
                    );
                  })}
                </>
              )}
            </div>

            <div className="pt-1 border-t border-white/10 space-y-1.5">
              {aoGerenciar && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full !h-9 justify-start gap-2 !text-indigo-300 hover:!bg-indigo-400/12"
                  onClick={() => {
                    aoGerenciar();
                    fechar();
                  }}
                >
                  <Users className="h-4 w-4 shrink-0" />
                  <span className="text-[12.5px] font-black">Gerenciar entregadores</span>
                  <ChevronRight className="h-3.5 w-3.5 shrink-0 ml-auto" />
                </Button>
              )}
              {ativo && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full !h-8 !text-slate-400"
                  onClick={() => {
                    store.definirEntregador(null);
                    fechar();
                  }}
                >
                  <Ban className="h-3.5 w-3.5" /> Limpar seleção
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ModalMoverPacote({
  aberto,
  pacote,
  aoFechar,
}: {
  aberto: boolean;
  pacote: PacoteLidoLocal | null;
  aoFechar: () => void;
}) {
  const store = usePacoteStore();
  const [query, setQuery] = React.useState('');
  const [movendo, setMovendo] = React.useState(false);

  const entregadoresStore = store.entregadores;
  const entregadoresDaSaca = store.entregadoresSaca;

  const opcoes = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of entregadoresDaSaca) s.add(e);
    for (const e of entregadoresStore) s.add(e);
    return Array.from(s);
  }, [entregadoresStore, entregadoresDaSaca]);

  const q = query.trim();
  const qLow = q.toLowerCase();

  const matchExato = React.useMemo(() => {
    if (!q) return null;
    return opcoes.find((o) => o.toLowerCase() === qLow) ?? null;
  }, [opcoes, q, qLow]);

  const destinoValido = React.useMemo(() => {
    if (matchExato) return matchExato;
    return q || null;
  }, [matchExato, q]);

  React.useEffect(() => {
    if (aberto) {
      setQuery('');
      setMovendo(false);
    }
  }, [aberto, pacote?.id]);

  const confirmar = async () => {
    if (!pacote || !destinoValido) return;
    setMovendo(true);
    try {
      await store.moverPacote(pacote.id, destinoValido, 'manual');
      aoFechar();
    } finally {
      setMovendo(false);
    }
  };

  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar} maxW="max-w-md">
      <div className="p-6 sm:p-7">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 text-white flex items-center justify-center shadow-lg shadow-amber-500/20">
              <ArrowRightLeft className="h-6 w-6" />
            </div>
            <div>
              <h2 className="text-xl font-black tracking-tight text-white">
                Alterar rota
              </h2>
              <p className="text-sm text-slate-400 mt-0.5">
                Mover pacote para outro entregador
              </p>
            </div>
          </div>
          <button
            onClick={aoFechar}
            className="h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-slate-300"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {pacote && (
          <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/[0.06] border border-white/10 flex items-center justify-center text-slate-400">
              <Package className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="text-[18px] font-black tabular-nums tracking-tight text-white break-all">
                {pacote.codigo_pacote}
              </div>
              <div className="text-[11.5px] text-slate-400 mt-0.5">
                Entregador atual:{' '}
                <span className="font-bold text-slate-300">
                  {pacote.entregador ?? 'Sem entregador'}
                </span>
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label className="text-[13px] font-bold">Entregador de destino *</Label>
            <div className="space-y-2">
              {opcoes.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {opcoes.map((nome) => {
                    const selecionado = destinoValido === nome;
                    return (
                      <button
                        key={nome}
                        type="button"
                        onClick={() => setQuery(nome)}
                        className={`px-3 py-1.5 rounded-xl text-[12.5px] font-bold transition ${
                          selecionado
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'bg-white/[0.06] border border-white/10 text-slate-300 hover:border-indigo-300 hover:text-indigo-300'
                        }`}
                      >
                        {selecionado && <CheckCircle2 className="h-3.5 w-3.5 inline mr-1" />}
                        {nome}
                      </button>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <UserRound className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                  <Input
                    id="modal-mover-input"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void confirmar();
                      }
                    }}
                    placeholder="Ou crie um novo entregador..."
                    className="!h-11 !pl-9"
                    autoComplete="off"
                    autoCorrect="off"
                    autoCapitalize="off"
                    spellCheck={false}
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-2 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="lg"
              onClick={aoFechar}
              className="flex-1"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="primary"
              size="lg"
              disabled={!destinoValido || movendo || !pacote}
              onClick={confirmar}
              className="flex-1"
            >
              {movendo ? (
                <>
                  <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                  Movendo...
                </>
              ) : (
                <>
                  <ArrowRightLeft className="h-4 w-4" />
                  Mover
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </ModalBase>
  );
}

function ModalGerenciarEntregadores({
  aberto,
  aoFechar,
}: {
  aberto: boolean;
  aoFechar: () => void;
}) {
  const store = usePacoteStore();
  const entregadores = usePacoteStore((s) => s.entregadores);
  const entregadorAtivo = usePacoteStore((s) => s.entregadorAtivo);
  const contagensEntregadores = usePacoteStore((s) => s.contagensEntregadores);
  const mapaContagem = React.useMemo(() => {
    const m = new Map<string, { qtd: number; retornos: number }>();
    for (const c of contagensEntregadores) m.set(c.nome, { qtd: c.qtd, retornos: c.retornos });
    return m;
  }, [contagensEntregadores]);

  const [query, setQuery] = React.useState('');
  const [novoNome, setNovoNome] = React.useState('');
  const [editando, setEditando] = React.useState<{ nomeAntigo: string; valor: string } | null>(null);
  const [processando, setProcessando] = React.useState<string | null>(null);

  const q = query.trim().toLowerCase();

  const filtrados = React.useMemo(() => {
    if (!q) return entregadores;
    return entregadores.filter((n) => n.toLowerCase().includes(q));
  }, [entregadores, q]);

  const podeCriar = React.useMemo(() => {
    const s = novoNome.trim();
    if (!s) return false;
    const low = s.toLowerCase();
    return !entregadores.some((e) => e.toLowerCase() === low);
  }, [novoNome, entregadores]);

  const confirmarCriar = async () => {
    const s = novoNome.trim();
    if (!s || !podeCriar) return;
    setProcessando('criar');
    try {
      await store.cadastrarEntregador(s);
      setNovoNome('');
    } finally {
      setProcessando(null);
    }
  };

  const iniciarEditar = (nome: string) => {
    setEditando({ nomeAntigo: nome, valor: nome });
  };

  const cancelarEditar = () => setEditando(null);

  const confirmarEditar = async () => {
    if (!editando) return;
    const novo = editando.valor.trim();
    if (!novo) return;
    if (novo.toLowerCase() === editando.nomeAntigo.toLowerCase()) {
      cancelarEditar();
      return;
    }
    const conflito = entregadores.some(
      (e) => e.toLowerCase() === novo.toLowerCase() && e.toLowerCase() !== editando.nomeAntigo.toLowerCase(),
    );
    if (conflito) return;
    setProcessando(`edit:${editando.nomeAntigo}`);
    try {
      await store.renomearEntregador(editando.nomeAntigo, novo);
      cancelarEditar();
    } finally {
      setProcessando(null);
    }
  };

  const excluir = async (nome: string) => {
    const c = mapaContagem.get(nome);
    const msg = c && c.qtd > 0
      ? `Tem certeza que deseja excluir "${nome}"?\n\nEsse entregador possui ${c.qtd} pacote(s) na saca atual.\n\nA exclusão remove só o cadastro, os pacotes continuam existindo.`
      : `Tem certeza que deseja excluir o entregador "${nome}"?`;
    if (!window.confirm(msg)) return;
    setProcessando(`del:${nome}`);
    try {
      await store.removerEntregador(nome);
      if (entregadorAtivo && entregadorAtivo.toLowerCase() === nome.toLowerCase()) {
        store.definirEntregador(null);
      }
    } finally {
      setProcessando(null);
    }
  };

  React.useEffect(() => {
    if (!aberto) {
      setQuery('');
      setNovoNome('');
      cancelarEditar();
    }
  }, [aberto]);

  return (
    <ModalBase aberto={aberto} aoFechar={aoFechar} maxW="max-w-lg">
      <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="h-10 w-10 shrink-0 rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white flex items-center justify-center shadow-sm">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h2 className="text-[17px] font-black tracking-tight text-white leading-tight">Entregadores</h2>
            <p className="text-[11.5px] text-slate-400 font-semibold mt-0.5">Gerencie a lista de entregadores cadastrados</p>
          </div>
        </div>
        <button
          type="button"
          onClick={aoFechar}
          className="h-9 w-9 shrink-0 rounded-xl flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition"
          aria-label="Fechar"
        >
          <X className="h-4.5 w-4.5" />
        </button>
      </div>

      <div className="p-4 sm:p-5 space-y-4 overflow-auto">
        {/* NOVO ENTREGADOR */}
        <div className="rounded-2xl border border-indigo-400/25 bg-gradient-to-br from-indigo-400/12 to-violet-400/12 p-3.5">
          <div className="text-[10.5px] font-black uppercase tracking-[0.12em] text-indigo-300 mb-2">Novo entregador</div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <UserRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-indigo-400 pointer-events-none" />
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    void confirmarCriar();
                  }
                }}
                placeholder="Nome completo (ex: João Silva)"
                className="!h-11 !pl-9 !text-[14px] !bg-white/[0.06]"
              />
            </div>
            <Button
              size="sm"
              variant="primary"
              disabled={!podeCriar || processando === 'criar'}
              onClick={() => void confirmarCriar()}
              className="!h-11 shrink-0 !px-3.5"
            >
              {processando === 'criar' ? (
                <div className="h-4 w-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
              ) : (
                <Plus className="h-4 w-4" />
              )}
              <span className="hidden sm:inline text-[12px] font-black">Cadastrar</span>
            </Button>
          </div>
        </div>

        {/* BUSCAR */}
        <div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar entregador..."
              className="!h-10 !pl-9 !text-[13.5px] !bg-white/[0.06]"
            />
          </div>
        </div>

        {/* LISTA */}
        <div className="rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] overflow-hidden">
          <div className="px-4 py-2.5 bg-white/[0.06] border-b border-white/10 flex items-center justify-between">
            <span className="text-[10.5px] font-black uppercase tracking-[0.12em] text-slate-400">
              {filtrados.length} entregador{filtrados.length !== 1 ? 'es' : ''}
            </span>
            {q && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="text-[11px] font-bold text-slate-400 hover:text-slate-300 transition"
              >
                Limpar busca
              </button>
            )}
          </div>

          <div className="divide-y divide-white/10 max-h-[48vh] overflow-auto">
            {filtrados.length === 0 ? (
              <div className="py-12 text-center">
                <div className="h-14 w-14 mx-auto rounded-2xl bg-white/[0.06] text-slate-400 flex items-center justify-center mb-3">
                  {entregadores.length === 0 ? <UserRound className="h-7 w-7" /> : <Search className="h-7 w-7" />}
                </div>
                <div className="text-[13.5px] font-bold text-slate-300">
                  {entregadores.length === 0 ? 'Nenhum entregador cadastrado' : 'Nenhum resultado encontrado'}
                </div>
                <div className="text-[11.5px] text-slate-400 mt-1">
                  {entregadores.length === 0 ? 'Cadastre o primeiro acima.' : 'Tente buscar por outro nome.'}
                </div>
              </div>
            ) : (
              filtrados.map((nome) => {
                const contagem = mapaContagem.get(nome);
                const eAtivo = entregadorAtivo && entregadorAtivo.toLowerCase() === nome.toLowerCase();
                const isEdit = editando && editando.nomeAntigo.toLowerCase() === nome.toLowerCase();
                const procDel = processando === `del:${nome}`;
                const procEdit = processando === `edit:${nome}`;

                return (
                  <div
                    key={nome}
                    className={`px-4 py-3 flex items-center gap-3 transition ${
                      eAtivo ? 'bg-gradient-to-r from-indigo-400/12 to-violet-400/12' : 'hover:bg-white/[0.06]'
                    }`}
                  >
                    <div
                      className={`h-9 w-9 shrink-0 rounded-xl flex items-center justify-center ${
                        eAtivo ? 'bg-indigo-400/15 text-indigo-300' : 'bg-white/[0.06] text-slate-400'
                      }`}
                    >
                      <Truck className="h-4 w-4" />
                    </div>

                    {isEdit ? (
                      <div className="flex-1 min-w-0 flex items-center gap-2">
                        <Input
                          autoFocus
                          value={editando!.valor}
                          onChange={(e) => setEditando({ ...editando!, valor: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              void confirmarEditar();
                            } else if (e.key === 'Escape') {
                              e.preventDefault();
                              cancelarEditar();
                            }
                          }}
                          className="!h-9 !text-[13.5px]"
                        />
                        <button
                          type="button"
                          onClick={cancelarEditar}
                          className="h-9 w-9 shrink-0 rounded-lg flex items-center justify-center text-slate-400 hover:bg-white/[0.06] hover:text-slate-300 transition"
                          title="Cancelar"
                        >
                          <X className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void confirmarEditar()}
                          disabled={procEdit || !editando!.valor.trim()}
                          className="h-9 px-3 shrink-0 rounded-lg bg-emerald-400/12 text-emerald-300 hover:bg-emerald-400/15 disabled:opacity-50 transition inline-flex items-center gap-1.5"
                          title="Salvar"
                        >
                          {procEdit ? (
                            <div className="h-3.5 w-3.5 border-2 border-emerald-400/40 border-t-emerald-700 rounded-full animate-spin" />
                          ) : (
                            <CheckCircle2 className="h-4 w-4" />
                          )}
                          <span className="text-[12px] font-black hidden sm:inline">Salvar</span>
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className={`text-[14px] font-black truncate ${
                              eAtivo ? 'text-indigo-200' : 'text-slate-300'
                            }`}>
                              {nome}
                            </span>
                            {eAtivo && (
                              <span className="shrink-0 text-[9.5px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-md bg-indigo-400/15 text-indigo-300 ring-1 ring-indigo-400/30">
                                Ativo
                              </span>
                            )}
                          </div>
                          {contagem && contagem.qtd > 0 && (
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[11px] font-bold tabular-nums text-slate-400 bg-white/[0.06] px-1.5 py-0.5 rounded">
                                {contagem.qtd} nesta saca
                              </span>
                              {contagem.retornos > 0 && (
                                <span
                                  className="text-[11px] font-bold tabular-nums bg-orange-400/15 text-orange-300 px-1.5 py-0.5 rounded inline-flex items-center gap-0.5"
                                  title="Retornos"
                                >
                                  <RefreshCw className="h-3 w-3" />
                                  {contagem.retornos}
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        <div className="shrink-0 flex items-center gap-1">
                          {!eAtivo && (
                            <button
                              type="button"
                              onClick={() => {
                                void store.definirEntregador(nome);
                              }}
                              className="h-8 px-2 rounded-lg text-[11px] font-black text-indigo-300 hover:bg-indigo-400/12 transition inline-flex items-center gap-1"
                              title="Definir como ativo"
                            >
                              <CheckCircle2 className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Usar</span>
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => iniciarEditar(nome)}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-amber-400/12 hover:text-amber-300 transition"
                            title="Renomear"
                          >
                            <PencilLine className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => void excluir(nome)}
                            disabled={procDel}
                            className="h-8 w-8 rounded-lg flex items-center justify-center text-slate-400 hover:bg-red-400/12 hover:text-red-300 disabled:opacity-50 transition"
                            title="Excluir"
                          >
                            {procDel ? (
                              <div className="h-3.5 w-3.5 border-2 border-red-400/40 border-t-red-600 rounded-full animate-spin" />
                            ) : (
                              <Trash2 className="h-3.5 w-3.5" />
                            )}
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-3.5 border-t border-white/10 flex items-center justify-end gap-2 bg-white/[0.04]">
        <Button
          size="sm"
          variant="ghost"
          onClick={aoFechar}
          className="!h-9 !px-3.5"
        >
          Fechar
        </Button>
      </div>
    </ModalBase>
  );
}

function ModalImportarJson({
  aberto,
  aoFechar,
  jsonTexto,
  setJsonTexto,
  abaImport,
  setAbaImport,
  tipoImportacao,
  setTipoImportacao,
  parseResultadoRotas,
  setParseResultadoRotas,
  parseResultadoZonas,
  setParseResultadoZonas,
  importandoRodando,
  setImportandoRodando,
  importandoStatus,
  setImportandoStatus,
  onConfirmarRotas,
  onConfirmarZonas,
  fileInputRef,
  entregadoresCadastrados,
}: {
  aberto: boolean;
  aoFechar: () => void;
  jsonTexto: string;
  setJsonTexto: (s: string) => void;
  abaImport: 'colar' | 'upload';
  setAbaImport: (a: 'colar' | 'upload') => void;
  tipoImportacao: 'rotas' | 'zonas';
  setTipoImportacao: (t: 'rotas' | 'zonas') => void;
  parseResultadoRotas: ResultadoParseRotas | null;
  setParseResultadoRotas: (r: ResultadoParseRotas | null) => void;
  parseResultadoZonas: ResultadoParseZonas | null;
  setParseResultadoZonas: (r: ResultadoParseZonas | null) => void;
  importandoRodando: boolean;
  setImportandoRodando: (b: boolean) => void;
  importandoStatus: null | { importados: number; duplicados: number; falhas: number; total: number };
  setImportandoStatus: (s: null | { importados: number; duplicados: number; falhas: number; total: number }) => void;
  onConfirmarRotas: (porEntregador: Record<string, string[]>) => Promise<void>;
  onConfirmarZonas: (porZona: Record<string, string[]>, entregadorDestino?: string) => Promise<void>;
  fileInputRef: React.MutableRefObject<HTMLInputElement | null>;
  entregadoresCadastrados: string[];
}) {
  const [copiado, setCopiado] = React.useState(false);
  const [zonaEntregadorDestino, setZonaEntregadorDestino] = React.useState<string>('');
  const copiarEsqueleto = () => {
    const modelo = tipoImportacao === 'rotas'
      ? JSON.stringify({
          id: 447616030,
          status: 'active',
          driver: 'Nome do Entregador Exemplo',
          stops: [
            {
              id: 20427248346,
              address: {
                id: 16538169400,
                address_line: 'Rua Exemplo, 100',
                street_name: 'Rua Exemplo',
                street_number: '100',
              },
              neighborhood: 'Bairro Exemplo',
              city: 'São Paulo',
              state: 'São Paulo',
              zip_code: '00000-000',
            },
          ],
        }, null, 2)
      : JSON.stringify({
          zone_id: 40760,
          zone_name: 'HELIOPOLIS',
          zone_external_id: 'Z1',
          total_shipments: 78,
          stops: 56,
          markers: [
            {
              shipment_id: 48163717674,
              planned_route_id: 504003142001,
              stop_sequence: 12,
              lat: -23.61986,
              lon: -46.592262,
            },
            {
              shipment_id: 48163717675,
              planned_route_id: 504003142002,
              stop_sequence: 13,
              lat: -23.61987,
              lon: -46.592263,
            },
          ],
        }, null, 2);
    void navigator.clipboard.writeText(modelo);
    setCopiado(true);
    setTimeout(() => setCopiado(false), 1800);
  };
  const handleUpload = async (ev: React.ChangeEvent<HTMLInputElement>) => {
    const arquivo = ev.target.files?.[0];
    if (!arquivo) return;
    try {
      const txt = await arquivo.text();
      setJsonTexto(txt);
      if (tipoImportacao === 'rotas') {
        setParseResultadoRotas(parsearJsonRotasML(txt));
        setParseResultadoZonas(null);
      } else {
        setParseResultadoZonas(parsearJsonZonasML(txt));
        setParseResultadoRotas(null);
      }
      setAbaImport('colar');
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };
  const fazerParse = () => {
    setParseResultadoRotas(null);
    setParseResultadoZonas(null);
    if (tipoImportacao === 'rotas') {
      setParseResultadoRotas(parsearJsonRotasML(jsonTexto));
    } else {
      setParseResultadoZonas(parsearJsonZonasML(jsonTexto));
    }
  };
  const limparParse = () => {
    setJsonTexto('');
    setParseResultadoRotas(null);
    setParseResultadoZonas(null);
  };
  const parseAtual = tipoImportacao === 'rotas' ? parseResultadoRotas : parseResultadoZonas;
  const totalPrevisto = parseAtual?.ok ? parseAtual.totalIds : 0;
  const porEntregadorEntries = tipoImportacao === 'rotas' && parseResultadoRotas?.ok
    ? Object.entries(parseResultadoRotas.porEntregador).sort((a, b) => b[1].length - a[1].length)
    : [];
  const porZonaEntries = tipoImportacao === 'zonas' && parseResultadoZonas?.ok
    ? Object.entries(parseResultadoZonas.porZona).sort((a, b) => b[1].length - a[1].length)
    : [];
  const total = Math.max(...(tipoImportacao === 'rotas' ? porEntregadorEntries : porZonaEntries).map(([, arr]) => arr.length), 1);
  return (
    <ModalBase aberto={aberto} aoFechar={importandoRodando ? () => {} : aoFechar} maxW="max-w-3xl">
      <div className="px-5 sm:px-6 py-4 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className={`shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-md ${tipoImportacao === 'rotas' ? 'from-violet-500 to-fuchsia-500' : 'from-rose-500 to-orange-500'}`}>
            {tipoImportacao === 'rotas' ? <Route className="h-5 w-5" /> : <MapPin className="h-5 w-5" />}
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-black tracking-tight text-white">
              {tipoImportacao === 'rotas' ? 'Importar rotas Mercado Livre' : 'Importar zonas Mercado Livre'}
            </h3>
            <p className="text-[12.5px] text-slate-400 mt-0.5 leading-relaxed">
              {tipoImportacao === 'rotas'
                ? 'Cole o JSON da API de monitoring do ML. Extrai entregador (driver) e os IDs (address.id de cada stop).'
                : 'Cole o JSON de zona do monitoring ML. Extrai zone_name como agrupador e markers[].shipment_id como IDs dos pacotes; depois atribua para entregadores.'}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={importandoRodando ? undefined : aoFechar}
          disabled={importandoRodando}
          className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition disabled:opacity-50"
          title="Fechar"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="px-5 sm:px-6 py-3 border-b border-white/10 flex flex-wrap items-center gap-1.5 bg-white/[0.06]">
        <div className="inline-flex rounded-xl bg-white/[0.06] p-1 ring-1 ring-white/10 gap-0.5 mr-2">
          <button
            type="button"
            onClick={() => { setTipoImportacao('rotas'); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-black transition ${
              tipoImportacao === 'rotas'
                ? 'bg-white/10 text-violet-300 shadow-sm ring-1 ring-violet-400/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <Route className="h-3.5 w-3.5" /> Rotas (por entregador)
          </button>
          <button
            type="button"
            onClick={() => { setTipoImportacao('zonas'); }}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11.5px] font-black transition ${
              tipoImportacao === 'zonas'
                ? 'bg-white/10 text-rose-300 shadow-sm ring-1 ring-rose-400/30'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            <MapPin className="h-3.5 w-3.5" /> Zonas (shipment_id → entregador depois)
          </button>
        </div>
        <div className="h-5 w-px bg-white/10 mx-0.5" />
        <button
          type="button"
          onClick={() => setAbaImport('colar')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-black transition ${
            abaImport === 'colar'
              ? 'bg-white/10 shadow-sm text-violet-300 ring-1 ring-violet-400/30'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Copy className="h-3.5 w-3.5" /> Colar JSON
        </button>
        <button
          type="button"
          onClick={() => setAbaImport('upload')}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11.5px] font-black transition ${
            abaImport === 'upload'
              ? 'bg-white/10 shadow-sm text-violet-300 ring-1 ring-violet-400/30'
              : 'text-slate-400 hover:text-slate-300'
          }`}
        >
          <Upload className="h-3.5 w-3.5" /> Subir arquivo .json
        </button>
        <div className="ml-auto flex items-center gap-1.5">
          <button
            type="button"
            onClick={copiarEsqueleto}
            className="inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.06] hover:bg-white/10 text-[10.5px] font-black text-slate-300 transition"
            title="Copia um JSON exemplo (esqueleto do formato da API ML)"
          >
            {copiado ? <Check className="h-3 w-3 text-emerald-300" /> : <FileText className="h-3 w-3" />}
            {copiado ? 'Copiado!' : 'Copiar modelo (esqueleto)'}
          </button>
        </div>
      </div>

      <div className="px-5 sm:px-6 py-4 space-y-3 max-h-[62vh] overflow-auto">
        {abaImport === 'colar' ? (
          <>
            <div>
              <Label className="!text-[11px] !font-black uppercase tracking-wider text-slate-400 mb-1.5">
                Cole o JSON aqui
              </Label>
              <Textarea
                placeholder={tipoImportacao === 'rotas'
                  ? `{\n  \"id\": 447616030,\n  \"driver\": \"Nome do Entregador\",\n  \"stops\": [\n    { \"address\": { \"id\": 16538169400 } }\n  ]\n}`
                  : `{\n  \"zone_id\": 40760,\n  \"zone_name\": \"HELIOPOLIS\",\n  \"total_shipments\": 78,\n  \"markers\": [\n    { \"shipment_id\": 48163717674 }\n  ]\n}`}
                value={jsonTexto}
                onChange={(e) => { setJsonTexto(e.target.value); if (parseAtual) { setParseResultadoRotas(null); setParseResultadoZonas(null); } }}
                className="!min-h-[210px] !text-[12px] font-mono leading-relaxed !p-3"
              />
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="primary"
                onClick={fazerParse}
                disabled={!jsonTexto.trim() || importandoRodando}
                className="!h-9"
              >
                <Search className="h-3.5 w-3.5" />
                Analisar JSON
              </Button>
              {jsonTexto && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={limparParse}
                  disabled={importandoRodando}
                  className="!h-9"
                >
                  Limpar
                </Button>
              )}
            </div>
          </>
        ) : (
          <div className="rounded-2xl border-2 border-dashed border-white/10 bg-white/[0.04] p-6 sm:p-8 text-center hover:bg-violet-400/12 hover:border-violet-400/40 transition cursor-pointer"
               onClick={() => fileInputRef.current?.click()}
          >
            <div className="h-14 w-14 rounded-2xl bg-white/[0.06] shadow-sm ring-1 ring-white/10 inline-flex items-center justify-center mx-auto mb-3">
              <Upload className="h-6 w-6 text-violet-300" />
            </div>
            <h4 className="text-[14px] font-black text-white mb-1">Selecione ou arraste o arquivo .json</h4>
            <p className="text-[12px] text-slate-400 mb-3">
              {tipoImportacao === 'rotas'
                ? 'Formatos aceitos: .json da API de rotas Mercado Livre (monitoring/routes/...)'
                : 'Formatos aceitos: .json com zone_name + markers[].shipment_id (API zonas ML)'}
            </p>
            <Button size="sm" variant="primary" onClick={() => fileInputRef.current?.click()} className="!h-9">
              <FileJson className="h-3.5 w-3.5" /> Escolher arquivo
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              onChange={handleUpload}
              className="hidden"
            />
          </div>
        )}

        {parseAtual && !parseAtual.ok && (
          <div className="rounded-xl bg-red-400/12 ring-1 ring-red-400/30 px-3.5 py-2.5 flex items-start gap-2">
            <XCircle className="h-4 w-4 text-red-300 shrink-0 mt-0.5" />
            <div className="min-w-0">
              <p className="text-[11.5px] font-black text-red-200">Não consegui importar</p>
              <p className="text-[11.5px] text-red-300 mt-0.5 leading-relaxed">{parseAtual.erro}</p>
            </div>
          </div>
        )}

        {parseAtual?.ok && (
          <div className="space-y-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div className="rounded-xl bg-emerald-400/12 ring-1 ring-emerald-400/30 px-3 py-2">
                <div className="text-[9.5px] font-black uppercase tracking-wider text-emerald-300">Shipments / IDs</div>
                <div className="text-[18px] font-black tabular-nums text-emerald-200 leading-tight">{parseAtual.totalIds}</div>
              </div>
              {tipoImportacao === 'rotas' && parseResultadoRotas && (
                <>
                  <div className="rounded-xl bg-violet-400/12 ring-1 ring-violet-400/30 px-3 py-2">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-violet-300">Entregadores</div>
                    <div className="text-[18px] font-black tabular-nums text-violet-200 leading-tight">{parseResultadoRotas.totalEntregadoresUnicos}</div>
                  </div>
                  <div className="rounded-xl bg-amber-400/12 ring-1 ring-amber-400/30 px-3 py-2">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">Duplicados</div>
                    <div className="text-[18px] font-black tabular-nums text-amber-200 leading-tight">{parseResultadoRotas.duplicadosInternos}</div>
                  </div>
                  <div className="rounded-xl bg-sky-400/12 ring-1 ring-sky-400/30 px-3 py-2">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-sky-300">Rotas</div>
                    <div className="text-[18px] font-black tabular-nums text-sky-200 leading-tight">{parseResultadoRotas.rotas.length}</div>
                  </div>
                </>
              )}
              {tipoImportacao === 'zonas' && parseResultadoZonas && (
                <>
                  <div className="rounded-xl bg-rose-400/12 ring-1 ring-rose-400/30 px-3 py-2">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-rose-300">Zonas</div>
                    <div className="text-[18px] font-black tabular-nums text-rose-200 leading-tight">{parseResultadoZonas.totalZonasUnicas}</div>
                  </div>
                  <div className="rounded-xl bg-amber-400/12 ring-1 ring-amber-400/30 px-3 py-2">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-amber-300">Duplicados</div>
                    <div className="text-[18px] font-black tabular-nums text-amber-200 leading-tight">{parseResultadoZonas.duplicadosInternos}</div>
                  </div>
                  <div className="rounded-xl bg-sky-400/12 ring-1 ring-sky-400/30 px-3 py-2">
                    <div className="text-[9.5px] font-black uppercase tracking-wider text-sky-300">Objetos zona</div>
                    <div className="text-[18px] font-black tabular-nums text-sky-200 leading-tight">{parseResultadoZonas.zonas.length}</div>
                  </div>
                </>
              )}
            </div>

            {tipoImportacao === 'zonas' && parseResultadoZonas?.ok && (
              <div className="rounded-xl bg-gradient-to-br from-rose-400/12 to-orange-400/12 ring-1 ring-rose-400/30 px-3.5 py-3">
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5"><Truck className="h-4 w-4 text-rose-300" /></div>
                  <div className="flex-1 min-w-0 space-y-2">
                    <div>
                      <p className="text-[11px] font-black uppercase tracking-wider text-rose-200 mb-1">
                        Entregador destino (evita ter que mover depois)
                      </p>
                      <p className="text-[11.5px] text-rose-300 leading-relaxed">
                        Escolhendo abaixo, os pacotes <strong className="font-black">já importam DIRETO para o entregador selecionado</strong>,
                        sem passar por zona temporária. Deixe vazio para usar o comportamento padrão (zone_name como entregador temporário, depois mover).
                      </p>
                    </div>
                    <div>
                      <Label className="!text-[10.5px] !font-black uppercase tracking-wider text-rose-200 mb-1">
                        Destino final
                      </Label>
                      <select
                        value={zonaEntregadorDestino}
                        onChange={(e) => setZonaEntregadorDestino(e.target.value)}
                        disabled={importandoRodando}
                        className="w-full h-10 rounded-xl border border-rose-400/30 bg-white/[0.06] px-3 text-[12.5px] text-white shadow-sm focus:outline-none focus:ring-2 focus:ring-rose-300 focus:border-rose-400 transition disabled:opacity-60"
                      >
                        <option value="">⏳ Criar zona temporária com zone_name (padrão)</option>
                        {entregadoresCadastrados.length === 0 && (
                          <option value="" disabled>Nenhum entregador cadastrado ainda</option>
                        )}
                        {entregadoresCadastrados.map((nomeEnt) => (
                          <option key={nomeEnt} value={nomeEnt}>✅ {nomeEnt} (importa direto)</option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div>
              <p className="text-[11px] font-black uppercase tracking-wider text-slate-400 mb-1.5">
                {tipoImportacao === 'rotas' ? 'Por entregador' : 'Por zona (agrupa antes de atribuir entregador)'}
              </p>
              <div className="rounded-xl bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] ring-1 ring-white/10 divide-y divide-white/10 overflow-hidden">
                {(tipoImportacao === 'rotas' ? porEntregadorEntries : porZonaEntries).length === 0 && (
                  <div className="px-3 py-3 text-[12px] text-slate-400 text-center">Nenhum ID encontrado</div>
                )}
                {(tipoImportacao === 'rotas' ? porEntregadorEntries : porZonaEntries).map(([nome, ids], idx) => {
                  const maxQtd = Math.max(...(tipoImportacao === 'rotas' ? porEntregadorEntries : porZonaEntries).map(([, x]) => x.length), 1);
                  return (
                    <div key={nome} className="px-3 py-2 sm:px-3.5 sm:py-2.5">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="inline-flex items-center gap-1.5 min-w-0">
                          {tipoImportacao === 'rotas' ? (
                            <Truck className="h-3.5 w-3.5 text-violet-300 shrink-0" />
                          ) : (
                            <MapPin className="h-3.5 w-3.5 text-rose-300 shrink-0" />
                          )}
                          <span className="text-[12.5px] font-black text-white truncate">{nome}</span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md ring-1 text-[10px] font-black tabular-nums ${
                            tipoImportacao === 'rotas'
                              ? 'bg-violet-400/12 text-violet-300 ring-violet-400/30'
                              : 'bg-rose-400/12 text-rose-300 ring-rose-400/30'
                          }`}>
                            {ids.length}
                          </span>
                        </div>
                        <span className="text-[10px] font-bold text-slate-400 tabular-nums">
                          {totalPrevisto > 0 ? ((ids.length / totalPrevisto) * 100).toFixed(0) : 0}%
                        </span>
                      </div>
                      <div className="h-1.5 w-full rounded-full overflow-hidden" style={{ background: tipoImportacao === 'rotas' ? 'rgba(139,92,246,0.15)' : 'rgba(244,63,94,0.15)' }}>
                        <div
                          className={`h-full rounded-full ${
                            tipoImportacao === 'rotas'
                              ? 'bg-gradient-to-r from-violet-500 to-fuchsia-500'
                              : 'bg-gradient-to-r from-rose-500 to-orange-500'
                          }`}
                          style={{ width: `${(ids.length / maxQtd) * 100}%` }}
                        />
                      </div>
                      {idx === 0 && ids.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1 max-h-[60px] overflow-auto">
                          {ids.slice(0, 12).map((id) => (
                            <span key={id} className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.06] ring-1 ring-white/10 text-[10px] font-bold tabular-nums text-slate-300">
                              {truncate(id, 14)}
                            </span>
                          ))}
                          {ids.length > 12 && (
                            <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-white/[0.06] text-slate-400 text-[10px] font-bold tabular-nums">
                              +{ids.length - 12} mais
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {importandoStatus && (
              <div className={`rounded-xl ring-1 px-3.5 py-3 ${
                importandoRodando
                  ? 'bg-sky-400/12 ring-sky-400/30'
                  : 'bg-emerald-400/12 ring-emerald-400/30'
              }`}>
                <div className="flex items-center gap-2">
                  {importandoRodando ? (
                    <div className="h-4 w-4 border-2 border-sky-500/30 border-t-sky-600 rounded-full animate-spin shrink-0" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4 text-emerald-300 shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-[12px] font-black text-white">
                      {importandoRodando
                        ? `Importando ${importandoStatus.importados} de ${importandoStatus.total}...`
                        : 'Importação concluída! 🎉'}
                    </p>
                    <div className="mt-1.5 h-1.5 w-full rounded-full bg-white/10 ring-1 ring-white/10 overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${importandoRodando ? 'bg-sky-500' : 'bg-emerald-500'}`}
                        style={{ width: `${importandoStatus.total ? ((importandoStatus.importados + importandoStatus.duplicados + importandoStatus.falhas) / importandoStatus.total) * 100 : 0}%` }}
                      />
                    </div>
                    <p className="text-[10.5px] font-bold text-slate-400 mt-1.5 inline-flex items-center gap-2 flex-wrap">
                      <span className="text-emerald-300">✅ {importandoStatus.importados} novos</span>
                      <span className="text-amber-300">🔄 {importandoStatus.duplicados} duplicados</span>
                      {importandoStatus.falhas > 0 && (
                        <span className="text-red-300">❌ {importandoStatus.falhas} falhas</span>
                      )}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="px-5 sm:px-6 py-3.5 border-t border-white/10 flex items-center justify-end gap-2 bg-white/[0.04]">
        <Button
          size="sm"
          variant="ghost"
          onClick={aoFechar}
          disabled={importandoRodando}
          className="!h-9 !px-3.5"
        >
          Fechar
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={!parseAtual?.ok || !totalPrevisto || importandoRodando}
          onClick={() => {
            if (!parseAtual?.ok) return;
            if (tipoImportacao === 'rotas' && parseResultadoRotas?.ok) {
              void onConfirmarRotas(parseResultadoRotas.porEntregador);
            } else if (tipoImportacao === 'zonas' && parseResultadoZonas?.ok) {
              void onConfirmarZonas(parseResultadoZonas.porZona, zonaEntregadorDestino || undefined);
            }
          }}
          className={`!h-9 !px-3.5 ${
            tipoImportacao === 'zonas'
              ? '!bg-gradient-to-r !from-rose-500 !to-orange-500 hover:!from-rose-600 hover:!to-orange-600'
              : ''
          }`}
        >
          {importandoRodando ? (
            <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Plus className="h-3.5 w-3.5" />
          )}
          {importandoRodando
            ? 'Importando...'
            : totalPrevisto > 0
            ? `Importar ${totalPrevisto} ID${totalPrevisto !== 1 ? 's' : ''}`
            : 'Nenhum ID para importar'}
        </Button>
      </div>
    </ModalBase>
  );
}

function ModalAtribuirEntregadorLote({
  aberto,
  aoFechar,
  idsSelecionados,
  entregadoresCadastrados,
  onConfirmar,
}: {
  aberto: boolean;
  aoFechar: () => void;
  idsSelecionados: string[];
  entregadoresCadastrados: string[];
  onConfirmar: (entregador: string | null) => Promise<void>;
}) {
  const [entregadorEscolhido, setEntregadorEscolhido] = React.useState<string | null>(null);
  const [aplicando, setAplicando] = React.useState(false);
  React.useEffect(() => {
    if (aberto) {
      setEntregadorEscolhido(null);
      setAplicando(false);
    }
  }, [aberto]);
  return (
    <ModalBase aberto={aberto} aoFechar={aplicando ? () => {} : aoFechar} maxW="max-w-md">
      <div className="px-5 py-4 border-b border-white/10 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="shrink-0 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white shadow-md">
            <UserPlus className="h-5 w-5" />
          </span>
          <div className="min-w-0">
            <h3 className="text-[17px] font-black tracking-tight text-white">
              Atribuir entregador
            </h3>
            <p className="text-[12.5px] text-slate-400 mt-0.5 leading-relaxed">
              {idsSelecionados.length} pacote{idsSelecionados.length !== 1 ? 's' : ''} selecionado{idsSelecionados.length !== 1 ? 's' : ''}. Escolha o entregador destino:
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={aplicando ? undefined : aoFechar}
          disabled={aplicando}
          className="shrink-0 h-9 w-9 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-300 hover:bg-white/[0.06] transition disabled:opacity-50"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="px-5 py-4 space-y-3 max-h-[55vh] overflow-auto">
        <button
          type="button"
          onClick={() => setEntregadorEscolhido(null)}
          className={`w-full text-left rounded-xl px-3 py-2.5 transition border ${
            entregadorEscolhido === null
              ? 'bg-white/[0.06] ring-2 ring-white/15 border-white/15'
              : 'border-white/10 hover:bg-white/[0.06]'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex items-center gap-2">
              <Ban className="h-4 w-4 text-slate-400 shrink-0" />
              <span className="text-[13px] font-bold text-slate-300">Sem entregador (limpar)</span>
            </div>
            {entregadorEscolhido === null && <Check className="h-4 w-4 text-violet-300" />}
          </div>
        </button>
        <div>
          <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400 mb-1.5">Entregadores cadastrados</p>
          <div className="space-y-1.5">
            {entregadoresCadastrados.length === 0 && (
              <div className="text-[12px] text-slate-400 text-center py-4">
                Nenhum entregador cadastrado. Use o menu &quot;Gerenciar entregadores&quot; primeiro.
              </div>
            )}
            {entregadoresCadastrados.map((nome) => {
              const selecionado = entregadorEscolhido === nome;
              return (
                <button
                  key={nome}
                  type="button"
                  onClick={() => setEntregadorEscolhido(nome)}
                  className={`w-full text-left rounded-xl px-3 py-2.5 transition border ${
                    selecionado
                      ? 'bg-violet-400/12 ring-2 ring-violet-400/40 border-violet-400/40'
                      : 'border-white/10 hover:bg-violet-400/12'
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="inline-flex items-center gap-2 min-w-0">
                      <Truck className="h-4 w-4 text-violet-300 shrink-0" />
                      <span className="text-[13px] font-bold text-white truncate">{nome}</span>
                    </div>
                    {selecionado && <Check className="h-4 w-4 text-violet-300 shrink-0" />}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      <div className="px-5 py-3.5 border-t border-white/10 flex items-center justify-end gap-2 bg-white/[0.04]">
        <Button
          size="sm"
          variant="ghost"
          onClick={aoFechar}
          disabled={aplicando}
          className="!h-9 !px-3.5"
        >
          Cancelar
        </Button>
        <Button
          size="sm"
          variant="primary"
          disabled={idsSelecionados.length === 0 || aplicando}
          onClick={async () => {
            try {
              setAplicando(true);
              await onConfirmar(entregadorEscolhido);
            } finally {
              setAplicando(false);
            }
          }}
          className="!h-9 !px-3.5 !bg-gradient-to-r !from-indigo-500 !to-violet-500 hover:!from-indigo-600 hover:!to-violet-600"
        >
          {aplicando ? (
            <div className="h-3.5 w-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
          ) : (
            <Users className="h-3.5 w-3.5" />
          )}
          {aplicando
            ? 'Aplicando...'
            : `Aplicar em ${idsSelecionados.length} pacote${idsSelecionados.length !== 1 ? 's' : ''}`}
        </Button>
      </div>
    </ModalBase>
  );
}

export default function ContagemPage() {
  const pacotes = usePacoteStore((s) => s.pacotes);
  const carregando = usePacoteStore((s) => s.carregando);
  const ultimoLido = usePacoteStore((s) => s.ultimoLido);
  const ultimoDuplicado = usePacoteStore((s) => s.ultimoDuplicado);
  const ultimoResultado = usePacoteStore((s) => s.ultimoResultado);
  const ultimoMovido = usePacoteStore((s) => s.ultimoMovido);
  const ultimoResultadoMover = usePacoteStore((s) => s.ultimoResultadoMover);
  const sacaAtiva = usePacoteStore((s) => s.sacaAtiva);
  const sacas = usePacoteStore((s) => s.sacas);
  const carregandoSacas = usePacoteStore((s) => s.carregandoSacas);
  const definirSacaAtiva = usePacoteStore((s) => s.definirSacaAtiva);
  const resumos = usePacoteStore((s) => s.resumos);
  const carregar = usePacoteStore((s) => s.carregar);
  const carregarSacas = usePacoteStore((s) => s.carregarSacas);
  const criarSaca = usePacoteStore((s) => s.criarSaca);
  const adicionarOuMover = usePacoteStore((s) => s.adicionarOuMover);
  const remover = usePacoteStore((s) => s.remover);
  const limpar = usePacoteStore((s) => s.limpar);
  const total = usePacoteStore((s) => s.total());
  const unicos = usePacoteStore((s) => s.unicos());
  const exportar = usePacoteStore((s) => s.exportar);
  const limparFeedback = usePacoteStore((s) => s.limparFeedback);
  const abrirModalSaca = usePacoteStore((s) => s.abrirModalSaca);
  const abrirHistoricoSacas = usePacoteStore((s) => s.abrirHistoricoSacas);
  const fecharSacaAtiva = usePacoteStore((s) => s.fecharSacaAtiva);
  const entregadorAtivo = usePacoteStore((s) => s.entregadorAtivo);
  const entregadores = usePacoteStore((s) => s.entregadores);
  const contagensEntregadoresStore = usePacoteStore((s) => s.contagensEntregadores);
  const alternarStatusRetorno = usePacoteStore((s) => s.alternarStatusRetorno);
  const ciclarStatus = usePacoteStore((s) => s.ciclarStatus);
  const definirStatus = usePacoteStore((s) => s.definirStatus);
  const definirStatusEmLote = usePacoteStore((s) => s.definirStatusEmLote);
  const removerEmLote = usePacoteStore((s) => s.removerEmLote);
  const inscreverRealtime = usePacoteStore((s) => s.inscreverRealtime);
  const forcarSincronizacaoCompleta = usePacoteStore((s) => s.forcarSincronizacaoCompleta);
  const carregarEntregadoresBanco = usePacoteStore((s) => s.carregarEntregadoresBanco);

  const [modo, setModo] = React.useState<Modo>('leitor');
  const modoRef = React.useRef<Modo>(modo);
  React.useEffect(() => { modoRef.current = modo; }, [modo]);
  const [codigoManual, setCodigoManual] = React.useState('');
  const [codigoLeitor, setCodigoLeitor] = React.useState('');
  const [filtro, setFiltro] = React.useState('');
  const [filtroEntregador, setFiltroEntregador] = React.useState<string>('__todos__');
  const [filtroStatus, setFiltroStatus] = React.useState<'__todos__' | '__sem_status__' | StatusPacote>('__todos__');
  const [autoFiltraEntregadorAtivo, setAutoFiltraEntregadorAtivo] = React.useState(true);
  React.useEffect(() => {
    if (!autoFiltraEntregadorAtivo) return;
    if (entregadorAtivo) setFiltroEntregador(entregadorAtivo);
    else setFiltroEntregador('__todos__');
  }, [entregadorAtivo, autoFiltraEntregadorAtivo]);
  const [selecionados, setSelecionados] = React.useState<Set<string>>(new Set());
  const toggleSelecionado = React.useCallback((id: string) => {
    setSelecionados((prev) => {
      const novo = new Set(prev);
      if (novo.has(id)) novo.delete(id);
      else novo.add(id);
      return novo;
    });
  }, []);
  const limparSelecao = React.useCallback(() => setSelecionados(new Set()), []);
  const idsSelecionadosArray = React.useMemo(() => Array.from(selecionados), [selecionados]);
  type StatusSincronia = 'ocioso' | 'sincronizando' | 'conectado' | 'erro' | 'offline';
  const [statusSincronia, setStatusSincronia] = React.useState<StatusSincronia>('ocioso');
  const [exportando, setExportando] = React.useState(false);
  const [flashId, setFlashId] = React.useState<string | null>(null);
  const [shakeId, setShakeId] = React.useState<string | null>(null);
  const [moverId, setMoverId] = React.useState<string | null>(null);
  const [sincronizando, setSincronizando] = React.useState(false);
  const [resultadoSync, setResultadoSync] = React.useState<{
    sacas: { sincronizados: number; falhas: number; total: number; primeiroErro: string | null };
    pacotes: { sincronizados: number; falhas: number; total: number; primeiroErro: string | null };
  } | null>(null);
  const [diagnostico, setDiagnostico] = React.useState<{
    etapa: string;
    ok: boolean;
    detalhe: string;
    tabelasBanco?: { sacas: number | null; pacotes: number | null };
  } | null>(null);
  const [mostrarBackup, setMostrarBackup] = React.useState(false);
  const [backupMsg, setBackupMsg] = React.useState<{ ok: boolean; texto: string } | null>(null);
  const inputArquivoRef = React.useRef<HTMLInputElement | null>(null);
  const [som, setSom] = React.useState<boolean>(() => {
    try {
      const raw = localStorage.getItem('ml_som_contagem');
      return raw ? raw === '1' : true;
    } catch {
      return true;
    }
  });
  const [feedback, setFeedback] = React.useState<{ tipo: TipoFeedback; mensagem: string; codigo?: string } | null>(null);
  const inputLeitorRef = React.useRef<HTMLInputElement>(null);
  const inputManualRef = React.useRef<HTMLTextAreaElement>(null);
  const sacaCriadaRef = React.useRef(false);

  const pacoteParaMover = React.useMemo(() => {
    if (!moverId) return null;
    return pacotes.find((p) => p.id === moverId) ?? null;
  }, [moverId, pacotes]);

  const algumInputInterativoTemFoco = React.useCallback((): boolean => {
    try {
      if (typeof document === 'undefined') return false;
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return false;
      const tag = el.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable) return true;
      if (el.closest('input, textarea, select, [contenteditable="true"]')) return true;
      const id = el.id;
      if (id === 'leitor-input') return false;
      return false;
    } catch {
      return false;
    }
  }, []);

  const focarLeitor = React.useCallback(() => {
    if (modo !== 'leitor') return;
    if (algumInputInterativoTemFoco()) return;
    try {
      inputLeitorRef.current?.focus({ preventScroll: true });
    } catch {
      try { inputLeitorRef.current?.focus(); } catch { /* noop */ }
    }
  }, [modo, algumInputInterativoTemFoco]);

  const clicandoModalMoverRef = React.useRef(false);
  React.useEffect(() => {
    clicandoModalMoverRef.current = !!moverId;
  }, [moverId]);

  React.useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (clicandoModalMoverRef.current) return;
      const target = event.target as HTMLElement | null;
      if (!target) return;
      const tag = target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) return;
      if (target.closest('input, textarea, select, button, a, label, [contenteditable="true"], [role="button"], [role="tabindex"], [tabindex]')) {
        if (!(target.id === 'leitor-input' || target.closest('#leitor-input'))) return;
      }
      if (target.id === 'leitor-input' || target.closest('#leitor-input')) return;
      setTimeout(() => focarLeitor(), 300);
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, [focarLeitor]);

  const onBlurLeitorCondicional = React.useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    const rel = (e.relatedTarget ?? document.activeElement) as HTMLElement | null;
    if (rel) {
      const tag = rel.tagName;
      if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL') return;
      if (rel.isContentEditable) return;
      if (rel.closest('button,a,input,select,textarea,label,[role="button"],[role="tabindex"],[tabindex],[contenteditable="true"]')) return;
    }
    setTimeout(() => focarLeitor(), 50);
  }, [focarLeitor]);

  React.useEffect(() => {
    try {
      localStorage.setItem('ml_som_contagem', som ? '1' : '0');
    } catch {
      /* noop */
    }
  }, [som]);

  const sincronizarAgoraAuto = React.useCallback(async (forcar = false) => {
    try {
      if (typeof navigator !== 'undefined' && navigator.onLine === false) {
        setStatusSincronia('offline');
        return;
      }
    } catch { /* noop */ }
    setStatusSincronia('sincronizando');
    let ok = true;
    try {
      await forcarSincronizacaoCompleta();
    } catch { ok = false; }
    try {
      await carregarSacas();
      await carregar();
      await carregarEntregadoresBanco();
    } catch { ok = false; }
    setStatusSincronia(ok ? 'conectado' : 'erro');
  }, [forcarSincronizacaoCompleta, carregarSacas, carregar, carregarEntregadoresBanco]);

  React.useEffect(() => {
    let cancelado = false;
    const rodarInicial = async () => {
      try {
        await carregarSacas();
        if (cancelado) return;
        await carregar();
        await carregarEntregadoresBanco();
        if (cancelado) return;
        const hj = new Date();
        const nomeSacaHoje = `Saca Hoje ${String(hj.getDate()).padStart(2, '0')}/${String(hj.getMonth() + 1).padStart(2, '0')}/${hj.getFullYear()}`;
        const estado = usePacoteStore.getState();
        const jaExisteSacaHoje = estado.sacas.find((s) => s.nome.trim() === nomeSacaHoje);
        if (jaExisteSacaHoje && estado.sacaAtiva?.id !== jaExisteSacaHoje.id) {
          try { await definirSacaAtiva(jaExisteSacaHoje.id); } catch { /* noop */ }
        } else if ((!estado.sacas.length || !estado.sacaAtiva) && !sacaCriadaRef.current) {
          sacaCriadaRef.current = true;
          try {
            await criarSaca(nomeSacaHoje);
            await carregarSacas();
            await carregar();
          } catch { /* noop */ }
        }
        try {
          await sincronizarAgoraAuto(true);
        } catch { /* noop */ }
      } catch {
        /* noop */
      }
    };
    void rodarInicial();
    const pausarPolling = { current: false };
    const atualizarPausa = () => {
      pausarPolling.current = modoRef.current === 'camera';
    };
    atualizarPausa();
    const idPausa = setInterval(atualizarPausa, 500);
    const id2 = setInterval(() => {
      if (pausarPolling.current) return;
      void sincronizarAgoraAuto(false);
    }, 30000);
    return () => {
      cancelado = true;
      clearInterval(idPausa);
      clearInterval(id2);
    };
  }, [carregarSacas, carregar, carregarEntregadoresBanco, sincronizarAgoraAuto, criarSaca, definirSacaAtiva, modoRef]);

  React.useEffect(() => {
    const onVis = () => {
      if (document.visibilityState === 'visible') void sincronizarAgoraAuto(true);
    };
    const onOnline = () => { setStatusSincronia('conectado'); void sincronizarAgoraAuto(true); };
    const onOffline = () => { setStatusSincronia('offline'); };
    try {
      document.addEventListener('visibilitychange', onVis);
      window.addEventListener('online', onOnline);
      window.addEventListener('offline', onOffline);
      if (typeof navigator !== 'undefined' && navigator.onLine === false) setStatusSincronia('offline');
    } catch { /* noop */ }
    return () => {
      try {
        document.removeEventListener('visibilitychange', onVis);
        window.removeEventListener('online', onOnline);
        window.removeEventListener('offline', onOffline);
      } catch { /* noop */ }
    };
  }, [sincronizarAgoraAuto]);

  React.useEffect(() => {
    const cleanup = inscreverRealtime();
    return cleanup;
  }, [inscreverRealtime]);

  React.useEffect(() => {
    if (algumInputInterativoTemFoco()) return;
    focarLeitor();
    if (modo === 'manual' && inputManualRef.current && !algumInputInterativoTemFoco()) inputManualRef.current.focus();
  }, [modo, sacaAtiva, focarLeitor, algumInputInterativoTemFoco]);

  React.useEffect(() => {
    if (ultimoLido) {
      setFlashId(ultimoLido.id);
      const t = setTimeout(() => setFlashId(null), 1500);
      return () => clearTimeout(t);
    }
  }, [ultimoLido]);

  React.useEffect(() => {
    if (ultimoMovido) {
      setFlashId(ultimoMovido.id);
      const t = setTimeout(() => setFlashId(null), 1800);
      return () => clearTimeout(t);
    }
  }, [ultimoMovido]);

  React.useEffect(() => {
    if (ultimoMovido && ultimoResultadoMover) return;
    if (!ultimoResultado) return;

    let fb: { tipo: TipoFeedback; mensagem: string; codigo?: string } | null = null;
    if (ultimoResultado.sucesso && ultimoResultado.pacote) {
      fb = {
        tipo: 'sucesso',
        mensagem: ultimoResultado.mensagem ?? 'Contado com sucesso',
        codigo: ultimoResultado.pacote.codigo_pacote,
      };
      if (som) beep('sucesso');
    } else if (ultimoResultado.duplicado && ultimoResultado.existente) {
      fb = {
        tipo: 'duplicado',
        mensagem: ultimoResultado.mensagem ?? 'ID já contado no mesmo entregador',
        codigo: ultimoResultado.existente.codigo_pacote,
      };
      setShakeId(ultimoResultado.existente.id);
      setTimeout(() => setShakeId(null), 600);
      if (som) beep('erro');
    } else if (!ultimoResultado.sucesso) {
      fb = {
        tipo: 'erro',
        mensagem: ultimoResultado.mensagem ?? 'Erro',
      };
      if (som) beep('erro');
    }

    if (fb) {
      setFeedback(fb);
      const t = setTimeout(() => {
        setFeedback(null);
        limparFeedback();
      }, 2500);
      return () => clearTimeout(t);
    }
  }, [ultimoResultado, som, limparFeedback, ultimoMovido, ultimoResultadoMover]);

  React.useEffect(() => {
    if (!ultimoResultadoMover || !ultimoResultadoMover.movido) return;
    const fb: { tipo: TipoFeedback; mensagem: string; codigo?: string } = {
      tipo: 'movido',
      mensagem: ultimoResultadoMover.mensagem ?? 'Rota alterada',
      codigo: ultimoResultadoMover.pacote?.codigo_pacote,
    };
    if (som) beep('movido');
    setFeedback(fb);
    const t = setTimeout(() => {
      setFeedback(null);
      limparFeedback();
    }, 2600);
    return () => clearTimeout(t);
  }, [ultimoResultadoMover, som, limparFeedback]);

  const processarCodigo = async (raw: string, origem: OrigemLeitura) => {
    if (!sacaAtiva) {
      abrirModalSaca();
      return;
    }
    const extraido = extrairCodigoDoJson(raw);
    if (!extraido.codigo) return;
    await adicionarOuMover(extraido.codigo, origem, { tipo: extraido.tipo });
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
    focarLeitor();
  };

  const onSubmitManual = async (e: React.FormEvent) => {
    e.preventDefault();
    const val = codigoManual.trim();
    if (!val) return;
    const codigosBrutos = val
      .split(/[\s,;\n\r\t]+/)
      .map((c) => c.trim())
      .filter(Boolean);
    if (!codigosBrutos.length) return;
    const unicosNoLote = Array.from(new Set(codigosBrutos));
    let adicionados = 0;
    let movidos = 0;
    let duplicadosMesmoEntregador = 0;
    let erros = 0;
    const ultimos: Array<{ tipo: string; codigo: string }> = [];
    for (const raw of unicosNoLote) {
      try {
        const extraido = extrairCodigoDoJson(raw);
        if (!extraido.codigo) { erros++; continue; }
        const r = await adicionarOuMover(extraido.codigo, 'manual', { tipo: extraido.tipo });
        if (r.tipo === 'adicao') {
          adicionados++;
          ultimos.unshift({ tipo: 'adicao', codigo: extraido.codigo });
        } else if (r.tipo === 'movimento') {
          movidos++;
          ultimos.unshift({ tipo: 'movimento', codigo: extraido.codigo });
        } else if (r.tipo === 'duplicado_mesmo_entregador') {
          duplicadosMesmoEntregador++;
          ultimos.unshift({ tipo: 'duplicado', codigo: extraido.codigo });
        } else {
          erros++;
          ultimos.unshift({ tipo: 'erro', codigo: extraido.codigo });
        }
      } catch {
        erros++;
      }
      if (ultimos.length > 3) ultimos.pop();
    }
    const total = unicosNoLote.length;
    const partes: string[] = [];
    if (adicionados) partes.push(`${adicionados} novo${adicionados > 1 ? 's' : ''}`);
    if (movidos) partes.push(`${movidos} movido${movidos > 1 ? 's' : ''}`);
    if (duplicadosMesmoEntregador) partes.push(`${duplicadosMesmoEntregador} duplicado${duplicadosMesmoEntregador > 1 ? 's' : ''}`);
    if (erros) partes.push(`${erros} erro${erros > 1 ? 's' : ''}`);
    const resumo = partes.join(' · ') || '0 processados';
    setFeedback({
      tipo: erros > 0 ? 'erro' : duplicadosMesmoEntregador > 0 ? 'duplicado' : movidos > 0 ? 'movido' : 'sucesso',
      mensagem: total > 1
        ? `${total} ID${total > 1 ? 's' : ''} processados → ${resumo}`
        : resumo,
      codigo: ultimos[0]?.codigo,
    });
    if (som) beep(adicionados > 0 ? 'sucesso' : movidos > 0 ? 'movido' : 'erro');
    setCodigoManual('');
    inputManualRef.current?.focus();
  };

  const confirmarLimpar = () => {
    if (!pacotes.length) return;
    if (!confirm(`Remover TODOS os ${pacotes.length} pacotes da saca "${sacaAtiva?.nome ?? 'atual'}"?`)) return;
    void limpar();
  };

  const acaoExportar = async () => {
    if (!filtrados.length) return;
    try {
      setExportando(true);
      const partesNome: string[] = [];
      if (filtroEntregador !== '__todos__') {
        partesNome.push(filtroEntregador === '__sem__' ? 'sem_entregador' : filtroEntregador);
      }
      if (filtroStatus === 'retorno') partesNome.push('retorno');
      if (filtro.trim()) partesNome.push('busca');
      await exportar(filtrados, partesNome.join('__'));
    } finally {
      setExportando(false);
    }
  };

  const confirmarFecharSaca = () => {
    if (!sacaAtiva) return;
    if (!confirm(`Fechar a saca "${sacaAtiva.nome}"? Você poderá reabri-la depois.`)) return;
    void fecharSacaAtiva();
  };

  const pacotesDaSaca = React.useMemo(() => {
    if (!sacaAtiva) return [];
    return pacotes.filter((p) => p.saca_id === sacaAtiva.id);
  }, [pacotes, sacaAtiva]);

  const totalDaSaca = React.useMemo(() => pacotesDaSaca.length, [pacotesDaSaca]);
  const unicosDaSaca = React.useMemo(() => new Set(pacotesDaSaca.map((p) => p.codigo_pacote)).size, [pacotesDaSaca]);

  const removerSelecionados = React.useCallback(() => {
    const ids = Array.from(selecionados);
    if (!ids.length) return;
    if (!confirm(`Remover ${ids.length} pacote${ids.length !== 1 ? 's' : ''} selecionado${ids.length !== 1 ? 's' : ''}? Esta ação é definitiva.`)) return;
    void removerEmLote(ids).then(() => limparSelecao());
  }, [selecionados, removerEmLote, limparSelecao]);

  const removerTodosDaSaca = React.useCallback(() => {
    const ids = pacotesDaSaca.map((p) => p.id);
    if (!ids.length) return;
    if (!confirm(`Remover TODOS os ${ids.length} pacotes desta saca? Esta ação é definitiva e não pode ser desfeita.`)) return;
    void removerEmLote(ids).then(() => limparSelecao());
  }, [pacotesDaSaca, removerEmLote, limparSelecao]);

  const contagemEntregadores = React.useMemo(() => {
    const mapaQtd = new Map<string, number>();
    const mapaRetornos = new Map<string, number>();
    const mapaEntregues = new Map<string, number>();
    const mapaDevolucoes = new Map<string, number>();
    const mapaLidos = new Map<string, number>();
    for (const p of pacotesDaSaca) {
      const k = p.entregador ?? 'Sem entregador';
      mapaQtd.set(k, (mapaQtd.get(k) ?? 0) + 1);
      if (p.status === 'retorno') mapaRetornos.set(k, (mapaRetornos.get(k) ?? 0) + 1);
      if (p.status === 'entregue') mapaEntregues.set(k, (mapaEntregues.get(k) ?? 0) + 1);
      if (p.status === 'devolucao') mapaDevolucoes.set(k, (mapaDevolucoes.get(k) ?? 0) + 1);
      if (p.status === 'lido') mapaLidos.set(k, (mapaLidos.get(k) ?? 0) + 1);
    }
    const resultado: Array<{ nome: string; qtd: number; retornos: number; entregues: number; devolucoes: number; lidos: number }> = [];
    for (const [nome, qtd] of mapaQtd.entries()) {
      resultado.push({
        nome,
        qtd,
        retornos: mapaRetornos.get(nome) ?? 0,
        entregues: mapaEntregues.get(nome) ?? 0,
        devolucoes: mapaDevolucoes.get(nome) ?? 0,
        lidos: mapaLidos.get(nome) ?? 0,
      });
    }
    return resultado.sort((a, b) => b.qtd - a.qtd);
  }, [pacotesDaSaca]);

  const filtrados = React.useMemo(() => {
    let lista = pacotesDaSaca;
    if (filtroEntregador !== '__todos__') {
      if (filtroEntregador === '__sem__') {
        lista = lista.filter((p) => !p.entregador);
      } else {
        lista = lista.filter((p) => p.entregador === filtroEntregador);
      }
    }
    if (filtroStatus !== '__todos__') {
      if (filtroStatus === '__sem_status__') lista = lista.filter((p) => !p.status);
      else lista = lista.filter((p) => p.status === filtroStatus);
    }
    if (!filtro.trim()) return lista;
    const q = filtro.trim().toLowerCase();
    return lista.filter(
      (p) =>
          p.codigo_pacote.toLowerCase().includes(q) ||
          (p.tipo ?? '').toLowerCase().includes(q) ||
          p.id.toLowerCase().includes(q) ||
          (p.entregador ?? '').toLowerCase().includes(q),
      );
  }, [pacotesDaSaca, filtro, filtroEntregador, filtroStatus]);

  const selecionarTodosFiltrados = React.useCallback(() => {
    setSelecionados(new Set(filtrados.map((p) => p.id)));
  }, [filtrados]);
  const todosFiltradosSelecionados = React.useMemo(
    () => filtrados.length > 0 && filtrados.every((p) => selecionados.has(p.id)),
    [filtrados, selecionados],
  );

  const resumoAtual = resumos.find((r) => r.saca.id === sacaAtiva?.id);

  const escopo = React.useMemo(() => {
    let base = pacotesDaSaca;
    if (filtroEntregador !== '__todos__') {
      if (filtroEntregador === '__sem__') base = base.filter((p) => !p.entregador);
      else base = base.filter((p) => p.entregador === filtroEntregador);
    }
    if (filtroStatus !== '__todos__') {
      if (filtroStatus === '__sem_status__') base = base.filter((p) => !p.status);
      else base = base.filter((p) => p.status === filtroStatus);
    }
    const unicos = new Set(base.map((p) => p.codigo_pacote));
    const retornos = base.filter((p) => p.status === 'retorno').length;
    const entregadores = new Set(
      base.filter((p) => p.entregador).map((p) => p.entregador as string),
    );
    return {
      lista: base,
      total: base.length,
      unicos: unicos.size,
      retornos,
      entregadores: entregadores.size,
    };
  }, [pacotesDaSaca, filtroEntregador, filtroStatus]);

  const feedbackCor =
    feedback?.tipo === 'sucesso'
      ? 'bg-emerald-500 text-white'
      : feedback?.tipo === 'duplicado'
      ? 'bg-red-500 text-white'
      : feedback?.tipo === 'movido'
      ? 'bg-gradient-to-r from-amber-500 to-orange-500 text-white'
      : feedback?.tipo === 'erro'
      ? 'bg-amber-500 text-white'
      : 'bg-neutral-800 text-white';

  const hojeFormatado = new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' })
  .replace('-feira', '')
  .replace(/^\w/, (c) => c.toUpperCase());
  const sacaHoje = (() => {
    const d = new Date();
    const inicio = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0).toISOString();
    const fim = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999).toISOString();
    const matches = sacas.filter((s) => s.created_at >= inicio && s.created_at <= fim);
    if (!matches.length) return null;
    matches.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'aberta' ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
    return matches[0];
  })();

  const bloqueado = !sacaAtiva;

  const criarSacaHoje = () => {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const h = new Date();
    const nome = `Saca ${pad(h.getDate())}/${pad(h.getMonth() + 1)}/${h.getFullYear()}`;
    void criarSaca(nome, '');
  };
  const [menuAberto, setMenuAberto] = React.useState(false);
  const [gerenciarEntregadoresAberto, setGerenciarEntregadoresAberto] = React.useState(false);
  const [modalImportJsonAberto, setModalImportJsonAberto] = React.useState(false);
  const [tipoImportacao, setTipoImportacao] = React.useState<'rotas' | 'zonas'>('rotas');
  const [abaImport, setAbaImport] = React.useState<'colar' | 'upload'>('colar');
  const [jsonTexto, setJsonTexto] = React.useState('');
  const [parseResultadoRotas, setParseResultadoRotas] = React.useState<ResultadoParseRotas | null>(null);
  const [parseResultadoZonas, setParseResultadoZonas] = React.useState<ResultadoParseZonas | null>(null);
  const [importandoStatus, setImportandoStatus] = React.useState<null | { importados: number; duplicados: number; falhas: number; total: number }>(null);
  const [importandoRodando, setImportandoRodando] = React.useState(false);
  const [modalAtribuirEntregadorAberto, setModalAtribuirEntregadorAberto] = React.useState(false);
  const fileInputJsonRef = React.useRef<HTMLInputElement | null>(null);
  const importarLotePorEntregador = usePacoteStore((s) => s.importarLotePorEntregador);
  const importarLotePorZona = usePacoteStore((s) => s.importarLotePorZona);
  const definirEntregadorEmLote = usePacoteStore((s) => s.definirEntregadorEmLote);
  const menuRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuAberto(false);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, []);

  const chipSync = React.useMemo(() => {
    const st = statusSincronia;
    if (st === 'sincronizando') {
      return { bg: 'bg-amber-400/12', txt: 'text-amber-300', ring: 'ring-amber-400/30', label: 'Sincronizando', icon: RefreshCw, spin: true, pulse: true };
    }
    if (st === 'offline') {
      return { bg: 'bg-orange-400/12', txt: 'text-orange-300', ring: 'ring-orange-400/30', label: 'Fora do ar', icon: WifiOff, spin: false, pulse: false };
    }
    if (st === 'erro') {
      return { bg: 'bg-red-400/12', txt: 'text-red-300', ring: 'ring-red-400/30', label: 'Erro', icon: AlertTriangle, spin: false, pulse: true };
    }
    return { bg: 'bg-transparent', txt: 'text-emerald-300', ring: 'ring-transparent', label: 'OK', icon: CheckCircle2, spin: false, pulse: false };
  }, [statusSincronia]);
  const SyncIcon = chipSync.icon;

  const botoesStatus: Array<{ k: string; label: string; colorSel: string; colorHover: string; count: number; icon: React.ComponentType<{ className?: string }> | null }> = React.useMemo(() => {
    return [
      { k: '__todos__', label: 'Todos', colorSel: 'bg-neutral-900 text-white', colorHover: 'hover:text-slate-300', count: pacotesDaSaca.length, icon: null },
      { k: '__sem_status__', label: 'Sem status', colorSel: 'bg-neutral-500 text-white', colorHover: 'hover:text-slate-300', count: pacotesDaSaca.filter((p) => !p.status).length, icon: null },
      { k: 'lido', label: 'Lido', colorSel: 'bg-sky-500 text-white', colorHover: 'hover:text-sky-300', count: pacotesDaSaca.filter((p) => p.status === 'lido').length, icon: CheckCheck },
      { k: 'entregue', label: 'Entregue', colorSel: 'bg-emerald-500 text-white', colorHover: 'hover:text-emerald-300', count: pacotesDaSaca.filter((p) => p.status === 'entregue').length, icon: Truck },
      { k: 'retorno', label: 'Retorno', colorSel: 'bg-orange-500 text-white', colorHover: 'hover:text-orange-300', count: pacotesDaSaca.filter((p) => p.status === 'retorno').length, icon: RefreshCw },
      { k: 'devolucao', label: 'Devolução', colorSel: 'bg-rose-500 text-white', colorHover: 'hover:text-rose-300', count: pacotesDaSaca.filter((p) => p.status === 'devolucao').length, icon: Undo2 },
    ];
  }, [pacotesDaSaca]);

  const acaoMenu = (fn: () => void) => { fn(); setMenuAberto(false); };

  return (
    <div className="min-h-screen bg-transparent">
      <ModalNovaSaca />
      <ModalHistoricoSacas />
      <ModalMoverPacote
        aberto={!!pacoteParaMover}
        pacote={pacoteParaMover}
        aoFechar={() => setMoverId(null)}
      />
      <ModalGerenciarEntregadores
        aberto={gerenciarEntregadoresAberto}
        aoFechar={() => setGerenciarEntregadoresAberto(false)}
      />
      <ModalImportarJson
        aberto={modalImportJsonAberto}
        aoFechar={() => setModalImportJsonAberto(false)}
        jsonTexto={jsonTexto}
        setJsonTexto={setJsonTexto}
        abaImport={abaImport}
        setAbaImport={setAbaImport}
        tipoImportacao={tipoImportacao}
        setTipoImportacao={setTipoImportacao}
        parseResultadoRotas={parseResultadoRotas}
        setParseResultadoRotas={setParseResultadoRotas}
        parseResultadoZonas={parseResultadoZonas}
        setParseResultadoZonas={setParseResultadoZonas}
        importandoRodando={importandoRodando}
        setImportandoRodando={setImportandoRodando}
        importandoStatus={importandoStatus}
        setImportandoStatus={setImportandoStatus}
        onConfirmarRotas={async (porEntregador) => {
          if (importandoRodando) return;
          const total = Object.values(porEntregador).reduce((a, b) => a + b.length, 0);
          setImportandoRodando(true);
          setImportandoStatus({ importados: 0, duplicados: 0, falhas: 0, total });
          try {
            const res = await importarLotePorEntregador(porEntregador);
            setImportandoStatus({ importados: res.importados, duplicados: res.duplicados, falhas: res.falhas, total });
            setMenuAberto(false);
            setTimeout(() => { setImportandoRodando(false); }, 1500);
          } catch {
            setImportandoStatus({ importados: 0, duplicados: 0, falhas: total, total });
            setImportandoRodando(false);
          }
        }}
        onConfirmarZonas={async (porZona, entregadorDestino) => {
          if (importandoRodando) return;
          const total = Object.values(porZona).reduce((a, b) => a + b.length, 0);
          setImportandoRodando(true);
          setImportandoStatus({ importados: 0, duplicados: 0, falhas: 0, total });
          try {
            const res = await importarLotePorZona(porZona, 'import_json_zona', entregadorDestino);
            setImportandoStatus({ importados: res.importados, duplicados: res.duplicados, falhas: res.falhas, total });
            setMenuAberto(false);
            setTimeout(() => { setImportandoRodando(false); }, 1500);
          } catch {
            setImportandoStatus({ importados: 0, duplicados: 0, falhas: total, total });
            setImportandoRodando(false);
          }
        }}
        fileInputRef={fileInputJsonRef}
        entregadoresCadastrados={entregadores}
      />
      <ModalAtribuirEntregadorLote
        aberto={modalAtribuirEntregadorAberto}
        aoFechar={() => setModalAtribuirEntregadorAberto(false)}
        idsSelecionados={Array.from(selecionados)}
        entregadoresCadastrados={entregadores}
        onConfirmar={async (entregador) => {
          if (selecionados.size === 0) return;
          try {
            await definirEntregadorEmLote(Array.from(selecionados), entregador);
          } catch { /* noop */ }
          setSelecionados(new Set());
          setModalAtribuirEntregadorAberto(false);
        }}
      />

      {feedback && (
        <div
          className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 shadow-xl rounded-xl px-4 py-2.5 flex items-center gap-2.5 max-w-[92vw] w-auto animate-slide-down ${feedbackCor}`}
        >
          {feedback.tipo === 'sucesso' ? (
            <CheckCircle2 className="h-4 w-4 shrink-0" />
          ) : feedback.tipo === 'duplicado' ? (
            <Ban className="h-4 w-4 shrink-0" />
          ) : feedback.tipo === 'movido' ? (
            <ArrowRightLeft className="h-4 w-4 shrink-0" />
          ) : (
            <AlertTriangle className="h-4 w-4 shrink-0" />
          )}
          <div className="min-w-0">
            <div className="font-black text-[13px] leading-tight">
              {feedback.tipo === 'sucesso'
                ? 'Contado'
                : feedback.tipo === 'movido'
                ? 'Rota alterada'
                : feedback.tipo === 'duplicado'
                ? 'Duplicado'
                : 'Aviso'}
              {feedback.codigo && (
                <span className="ml-1.5 tabular-nums font-black opacity-95">#{feedback.codigo}</span>
              )}
            </div>
            {feedback.mensagem && (
              <div className="text-[11px] opacity-90 leading-tight">{feedback.mensagem}</div>
            )}
          </div>
        </div>
      )}

      <div className="max-w-[1580px] mx-auto px-2 sm:px-3 lg:px-4 py-3 sm:py-5 space-y-4 sm:space-y-5 animate-fade-in">
        {/* ===== HEADER COMPACTO ===== */}
        <header className="relative flex items-center gap-3 sm:gap-4 bg-[linear-gradient(135deg,rgba(19,29,50,0.94),rgba(11,19,34,0.9))] rounded-[1.9rem] px-4 sm:px-5 py-3.5 border border-white/10 shadow-[0_24px_60px_rgba(15,23,42,0.12)]">
          <span aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden rounded-[1.9rem]">
            <span className="absolute inset-x-0 top-0 h-[4px] bg-gradient-to-r from-ml-blue via-violet-500 to-emerald-400" />
            <span className="absolute -top-20 right-0 h-48 w-48 rounded-full bg-blue-400/10 blur-3xl" />
          </span>
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <div className="h-11 w-11 shrink-0 rounded-2xl bg-gradient-to-br from-ml-blue to-emerald-400 text-white flex items-center justify-center shadow-[0_14px_28px_rgba(52,131,250,0.22)]">
              <Boxes className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <button
                type="button"
                onClick={abrirHistoricoSacas}
                className="text-left w-full group"
              >
                <h1 className="text-[17px] sm:text-[18px] font-black tracking-tight text-white truncate leading-tight">
                  {sacaAtiva ? sacaAtiva.nome : (!sacas.length ? 'Contagem' : 'Escolher saca')}
                </h1>
                <div className="flex items-center gap-1.5 mt-1 text-[10.5px] sm:text-[11px] text-slate-400 font-semibold">
                  {sacaAtiva ? (
                    <>
                      <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ring-1 ${
                        sacaAtiva.status === 'aberta' ? 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30' : 'bg-white/[0.06] text-slate-400 ring-white/10'
                      }`}>
                        {sacaAtiva.status === 'aberta' ? <Unlock className="h-2.5 w-2.5" /> : <Lock className="h-2.5 w-2.5" />}
                        {sacaAtiva.status === 'aberta' ? 'Aberta' : 'Fechada'}
                      </span>
                      <span className="hidden sm:inline truncate">
                        {sacas.length} saca{sacas.length !== 1 ? 's' : ''} · {hojeFormatado}
                      </span>
                    </>
                  ) : (
                    <span className="text-amber-300">Sem saca ativa · clique para escolher</span>
                  )}
                </div>
              </button>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <div className={`hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg ring-1 ${chipSync.bg} ${chipSync.txt} ${chipSync.ring} ${chipSync.pulse ? 'animate-pulse' : ''}`}>
              <SyncIcon className={`h-3 w-3 shrink-0 ${chipSync.spin ? 'animate-spin' : ''}`} />
              <span className="text-[10px] font-black uppercase tracking-wider">{chipSync.label}</span>
            </div>

            <SeletorEntregador aoGerenciar={() => setGerenciarEntregadoresAberto(true)} />

            <Link
              href="/dashboard"
              className="inline-flex items-center gap-1 h-9 px-3 rounded-xl bg-gradient-to-r from-indigo-500 to-violet-500 text-white text-[12px] font-black shadow-sm shadow-indigo-500/30 hover:from-indigo-600 hover:to-violet-600 transition"
              title="Abrir dashboard em tela cheia"
            >
              <BarChart3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Dashboard</span>
            </Link>

            <Button
              size="sm"
              variant="primary"
              onClick={acaoExportar}
              disabled={!pacotes.length || exportando}
              className="!h-9 !px-3"
            >
              <Download className="h-3.5 w-3.5" />
              <span className="hidden sm:inline text-[12px]">{exportando ? 'Exportando' : 'Excel'}</span>
            </Button>

            <div ref={menuRef} className="relative">
              <button
                type="button"
                onClick={() => setMenuAberto((v) => !v)}
                className={`h-9 w-9 rounded-xl flex items-center justify-center transition ${
                  menuAberto ? 'bg-white/[0.06] text-white' : 'text-slate-400 hover:bg-white/[0.06] hover:text-slate-300'
                }`}
                aria-label="Menu"
                title="Ações"
              >
                <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor" className="shrink-0">
                  <circle cx="5" cy="12" r="1.8" />
                  <circle cx="12" cy="12" r="1.8" />
                  <circle cx="19" cy="12" r="1.8" />
                </svg>
              </button>

              {menuAberto && (
                <div className="absolute right-0 top-full mt-1.5 w-[260px] sm:w-[280px] bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl shadow-2xl border border-white/10 p-1.5 z-[80] animate-slide-up">
                  <div className="px-2.5 py-1.5 border-b border-white/10 mb-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Sincronia</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => acaoMenu(async () => {
                      if (sincronizando) return;
                      setSincronizando(true);
                      setResultadoSync(null);
                      try {
                        const r = await forcarSincronizacaoCompleta();
                        setResultadoSync(r);
                      } finally {
                        setSincronizando(false);
                        setTimeout(() => setResultadoSync(null), 9000);
                      }
                    })}
                    disabled={sincronizando}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition disabled:opacity-60"
                  >
                    <RefreshCw className={`h-4 w-4 text-emerald-300 shrink-0 ${sincronizando ? 'animate-spin' : ''}`} />
                    Sincronizar agora
                  </button>
                  <button
                    type="button"
                    onClick={() => acaoMenu(async () => {
                      setDiagnostico({ etapa: 'Testando conexão…', ok: false, detalhe: '…' });
                      try {
                        const conn = await PacoteService.testarConexaoBanco();
                        const extraInfo = [
                          `Build: ${VERSAO_HARDCODED_CHAVE}`,
                          `URL: ${NEXT_PUBLIC_SUPABASE_URL_DEBUG ? NEXT_PUBLIC_SUPABASE_URL_DEBUG.slice(0, 40) + '…' : '❌ NÃO ENCONTRADA'}`,
                          `Anon: ${NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG ? NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG.slice(0, 8) + '…' + NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG.slice(-8) : '❌ NÃO ENCONTRADA'}`,
                        ].join('\n');
                        if (!conn.ok) {
                          setDiagnostico({ etapa: '❌ Supabase não conectado', ok: false, detalhe: (conn.erro ?? 'erro') + '\n\n' + extraInfo });
                          return;
                        }
                        setDiagnostico({
                          etapa: '✅ Supabase conectado',
                          ok: true,
                          detalhe: `Sacas: ${conn.tabelas.sacas ?? 0} · Pacotes: ${conn.tabelas.pacotes ?? 0}\n\n${extraInfo}`,
                          tabelasBanco: conn.tabelas,
                        });
                        setTimeout(() => setDiagnostico(null), 10000);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        setDiagnostico({ etapa: '❌ Exceção', ok: false, detalhe: msg });
                      }
                    })}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <Database className="h-4 w-4 text-sky-300 shrink-0" />
                    Diagnóstico banco
                  </button>

                  <div className="px-2.5 py-1.5 border-b border-t border-white/10 my-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Entregadores</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => acaoMenu(() => setGerenciarEntregadoresAberto(true))}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <Users className="h-4 w-4 text-indigo-300 shrink-0" />
                    Gerenciar entregadores
                  </button>

                  <div className="px-2.5 py-1.5 border-b border-t border-white/10 my-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Importação de rotas e zonas ML</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => acaoMenu(() => {
                      setJsonTexto('');
                      setParseResultadoRotas(null);
                      setParseResultadoZonas(null);
                      setTipoImportacao('rotas');
                      setImportandoStatus(null);
                      setModalImportJsonAberto(true);
                    })}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <div className="flex items-center -space-x-1">
                      <Route className="h-4 w-4 text-violet-300 shrink-0" />
                      <MapPin className="h-4 w-4 text-orange-300 shrink-0" />
                    </div>
                    Importar JSON rotas ou zonas
                    <span className="ml-auto inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-gradient-to-r from-violet-400/12 to-orange-400/12 text-slate-300 ring-1 ring-violet-400/30 text-[9.5px] font-black uppercase">
                      NEW
                    </span>
                  </button>

                  <div className="px-2.5 py-1.5 border-b border-t border-white/10 my-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Backup</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => acaoMenu(async () => { await PacoteService.baixarArquivoBackup(); setBackupMsg({ ok: true, texto: '✅ Arquivo JSON baixado. Guarde esse arquivo.' }); setTimeout(() => setBackupMsg(null), 5000); })}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <FileJson className="h-4 w-4 text-emerald-300 shrink-0" />
                    Exportar JSON backup
                  </button>
                  <button
                    type="button"
                    onClick={() => acaoMenu(() => { inputArquivoRef.current?.click(); })}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <Upload className="h-4 w-4 text-slate-300 shrink-0" />
                    Restaurar backup…
                  </button>
                  <input
                    ref={inputArquivoRef}
                    type="file"
                    accept="application/json,.json"
                    className="hidden"
                    onChange={async (ev) => {
                      const arquivo = ev.target.files?.[0];
                      if (!arquivo) return;
                      try {
                        const texto = await arquivo.text();
                        const obj = JSON.parse(texto);
                        const r = await PacoteService.importarBackupJson(obj);
                        if (!r.ok) throw new Error(r.erro ?? 'falhou');
                        setBackupMsg({ ok: true, texto: `✅ ${r.pacotesRestaurados} pacotes restaurados. Recarregando…` });
                        setTimeout(() => window.location.reload(), 1800);
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : 'arquivo inválido';
                        setBackupMsg({ ok: false, texto: `❌ Não restaurou: ${msg}` });
                      } finally {
                        if (inputArquivoRef.current) inputArquivoRef.current.value = '';
                      }
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => acaoMenu(async () => {
                      try {
                        const sacas = await SacaService.listar();
                        const pacotes = await PacoteService.listarTodasSacas();
                        const unicosPorSaca = new Map<string, number>();
                        for (const p of pacotes) {
                          const k = p.saca_id ?? '__sem_saca__';
                          unicosPorSaca.set(k, (unicosPorSaca.get(k) ?? 0) + 1);
                        }
                        const detalhe = [
                          `Sacas locais: ${sacas.length}`,
                          ...sacas.map((s) => `  · ${s.nome} (${s.status}) — ${unicosPorSaca.get(s.id) ?? 0} pacotes`),
                          `Pacotes locais: ${pacotes.length}`,
                        ].join('\n');
                        setBackupMsg({ ok: true, texto: detalhe });
                      } catch (e) {
                        const msg = e instanceof Error ? e.message : String(e);
                        setBackupMsg({ ok: false, texto: `❌ ${msg}` });
                      }
                    })}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <HardDrive className="h-4 w-4 text-slate-400 shrink-0" />
                    Ver dados locais
                  </button>

                  <div className="px-2.5 py-1.5 border-b border-t border-white/10 my-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Saca</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => acaoMenu(() => abrirHistoricoSacas())}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <FolderOpen className="h-4 w-4 text-slate-400 shrink-0" />
                    Histórico de sacas
                  </button>
                  <button
                    type="button"
                    onClick={() => acaoMenu(() => abrirModalSaca())}
                    className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <FolderPlus className="h-4 w-4 text-ml-blue shrink-0" />
                    Criar nova saca
                  </button>
                  {sacaAtiva && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAberto(false);
                        if (confirm(`Remover TODOS os ${pacotes.length} pacotes da saca "${sacaAtiva.nome}"?`)) void limpar();
                      }}
                      disabled={!pacotes.length}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-red-300 hover:bg-red-400/12 transition disabled:opacity-60"
                    >
                      <Trash2 className="h-4 w-4 shrink-0" />
                      Limpar saca atual
                    </button>
                  )}
                  {sacaAtiva && sacaAtiva.status === 'aberta' && (
                    <button
                      type="button"
                      onClick={() => {
                        setMenuAberto(false);
                        confirmarFecharSaca();
                      }}
                      className="w-full text-left flex items-center gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                    >
                      <Lock className="h-4 w-4 text-slate-400 shrink-0" />
                      Fechar saca atual
                    </button>
                  )}

                  <div className="px-2.5 py-1.5 border-b border-t border-white/10 my-1">
                    <p className="text-[10.5px] font-black uppercase tracking-wider text-slate-400">Preferências</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSom((s) => !s)}
                    className="w-full text-left flex items-center justify-between gap-2 px-2.5 py-2 rounded-xl text-[12.5px] font-bold text-slate-300 hover:bg-white/[0.06] transition"
                  >
                    <span className="flex items-center gap-2">
                      {som ? <Volume2 className="h-4 w-4 text-emerald-300 shrink-0" /> : <VolumeX className="h-4 w-4 text-slate-400 shrink-0" />}
                      {som ? 'Som ativado' : 'Som desativado'}
                    </span>
                    <div className={`h-5 w-9 rounded-full relative transition ${som ? 'bg-emerald-500' : 'bg-white/15'}`}>
                      <div className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow-sm transition-all ${som ? 'left-[18px]' : 'left-0.5'}`} />
                    </div>
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* ===== SEM SACA: TELA BOAS-VINDAS MINIMALISTA ===== */}
        {!sacaAtiva && (
          <div className="bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl border border-white/10 shadow-sm px-4 sm:px-6 py-6 sm:py-10">
            <div className="text-center max-w-lg mx-auto">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-ml-blue to-emerald-400 text-white flex items-center justify-center shadow-lg mx-auto mb-4">
                <Package className="h-7 w-7" />
              </div>
              <p className="text-[11px] font-black uppercase tracking-[0.18em] text-ml-blue mb-2">
                {hojeFormatado}
              </p>
              <h2 className="text-[22px] sm:text-[26px] font-black tracking-tight text-white leading-tight">
                {sacaHoje ? 'Continue a contagem de hoje' : 'Vamos começar a contagem'}
              </h2>
              <p className="text-[13px] text-slate-400 mt-2 leading-relaxed">
                {sacaHoje
                  ? 'Selecione uma saca existente abaixo ou crie uma nova para separar lotes.'
                  : 'Cada lote/dia é uma "saca" separada. Crie a saca de hoje para começar a escanear.'}
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-2 mt-5">
                {sacaHoje && (
                  <Button
                    size="lg"
                    variant="primary"
                    onClick={() => void definirSacaAtiva(sacaHoje.id)}
                    className="w-full sm:w-auto"
                  >
                    <FolderOpen className="h-4 w-4" />
                    Abrir saca de hoje
                  </Button>
                )}
                <Button
                  size="lg"
                  variant={sacaHoje ? 'ghost' : 'primary'}
                  onClick={sacaHoje ? abrirModalSaca : criarSacaHoje}
                  className="w-full sm:w-auto"
                >
                  <FolderPlus className="h-4 w-4" />
                  {sacaHoje ? 'Criar nova saca' : 'Criar saca de hoje'}
                </Button>
                {sacas.length > 0 && (
                  <Button
                    size="lg"
                    variant="ghost"
                    onClick={abrirHistoricoSacas}
                    className="w-full sm:w-auto"
                  >
                    <ListTodo className="h-4 w-4" />
                    Histórico ({sacas.length})
                  </Button>
                )}
              </div>
            </div>

            {sacas.length > 0 && (
              <div className="mt-6 sm:mt-8 pt-6 border-t border-white/10">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {sacas.slice(0, 9).map((s) => {
                    const r = resumos.find((x) => x.saca.id === s.id);
                    const d = new Date(s.created_at);
                    const dia = d.toLocaleDateString('pt-BR');
                    const ehHoje = s.id === sacaHoje?.id;
                    return (
                      <button
                        type="button"
                        key={s.id}
                        onClick={() => void definirSacaAtiva(s.id)}
                        className={`text-left rounded-xl p-3 border transition hover:shadow-sm ${
                          ehHoje
                            ? 'bg-sky-400/12 border-sky-400/30'
                            : 'bg-white/[0.06] border-white/10 hover:border-white/15'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {ehHoje && (
                              <span className="text-[9.5px] font-black uppercase tracking-wider text-sky-300 bg-sky-400/15 px-1.5 py-0.5 rounded-md shrink-0">
                                HOJE
                              </span>
                            )}
                            <span
                              className={`font-black tracking-tight truncate ${ehHoje ? 'text-[14px] text-white' : 'text-[13px] text-slate-300'}`}
                            >
                              {s.nome}
                            </span>
                          </div>
                          <span
                            className={`text-[9.5px] font-black uppercase px-1.5 py-0.5 rounded-md shrink-0 ring-1 ${
                              s.status === 'aberta'
                                ? 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30'
                                : 'bg-white/[0.06] text-slate-400 ring-white/10'
                            }`}
                          >
                            {s.status === 'aberta' ? 'Aberta' : 'Fechada'}
                          </span>
                        </div>
                        <div className="mt-2.5 flex items-end justify-between gap-2">
                          <div>
                            <div className="text-[20px] font-black tabular-nums leading-none text-white">
                              {r ? r.unicos : 0}
                            </div>
                            <div className="text-[10px] font-bold text-slate-400 mt-0.5">IDs</div>
                          </div>
                          <div className="text-right text-[10px] text-slate-400 font-semibold">
                            {dia}
                          </div>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {sacaAtiva && (
          <>
            {/* ===== ESTATÍSTICAS MINIMALISTAS ===== */}
            <section className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3">
              {[
                {
                  n: escopo.unicos,
                  lab: filtroEntregador === '__todos__' && filtroStatus === '__todos__' ? 'IDs únicos' : 'Filtrado únicos',
                  cor: 'text-white',
                  corLab: 'text-slate-400',
                  badge: ultimoLido ? { txt: 'Último: #' + ultimoLido.codigo_pacote, cor: 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30' } : null,
                },
                {
                  n: escopo.total,
                  lab: 'Leituras totais',
                  cor: 'text-ml-blue',
                  corLab: 'text-slate-400',
                  badge: escopo.unicos !== escopo.total
                    ? { txt: `${escopo.total - escopo.unicos} dup. bloqueadas`, cor: 'bg-amber-400/12 text-amber-300 ring-amber-400/30' }
                    : escopo.total > 0
                    ? { txt: '100% únicos', cor: 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30' }
                    : null,
                },
                {
                  n: filtroEntregador !== '__todos__' ? (escopo.total > 0 ? 1 : 0) : escopo.entregadores,
                  lab: 'Entregadores',
                  cor: 'text-violet-300',
                  corLab: 'text-slate-400',
                  badge: entregadorAtivo ? { txt: 'Ativo: ' + entregadorAtivo, cor: 'bg-violet-400/12 text-violet-300 ring-violet-400/30' } : null,
                },
                {
                  n: escopo.retornos,
                  lab: 'Retornos',
                  cor: 'text-orange-300',
                  corLab: 'text-slate-400',
                  badge: escopo.retornos > 0 && escopo.total > 0
                    ? { txt: `${Math.round((escopo.retornos / escopo.total) * 100)}% do total`, cor: 'bg-orange-400/12 text-orange-300 ring-orange-400/30' }
                    : null,
                },
              ].map((card, i) => (
                <div
                  key={i}
                  className="relative overflow-hidden bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl border border-white/10 px-3 sm:px-4 py-3 shadow-sm transition hover:shadow-md hover:-translate-y-0.5"
                >
                  <span
                    aria-hidden
                    className={`absolute inset-x-0 top-0 h-[3px] bg-gradient-to-r ${
                      ['from-ml-blue to-violet-500', 'from-emerald-500 to-teal-500', 'from-violet-500 to-fuchsia-500', 'from-orange-500 to-amber-500'][i % 4]
                    }`}
                  />
                  <p className={`text-[10px] sm:text-[11px] font-black uppercase tracking-wider ${card.corLab}`}>
                    {card.lab}
                  </p>
                  <p className={`mt-0.5 text-[26px] sm:text-[30px] font-black tracking-tight tabular-nums leading-tight ${card.cor}`}>
                    {card.n}
                  </p>
                  {card.badge && (
                    <div className={`mt-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-md ring-1 text-[10.5px] font-bold truncate max-w-full ${card.badge.cor}`}>
                      <span className="truncate">{card.badge.txt}</span>
                    </div>
                  )}
                </div>
              ))}
            </section>

            {/* ===== POR ENTREGADOR: SÓ CHIPS ===== */}
            {contagemEntregadores.length > 0 && (
              <div className="bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl border border-white/10 px-3 sm:px-4 py-3 shadow-sm">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Truck className="h-3.5 w-3.5 text-violet-400 shrink-0" />
                  <span className="text-[11px] font-black uppercase tracking-wider text-slate-400 mr-0.5">
                    Entregadores
                  </span>
                  <button
                    type="button"
                    onClick={() => setAutoFiltraEntregadorAtivo((v) => !v)}
                    title={autoFiltraEntregadorAtivo ? 'Desligar: selecionar entregador no header NÃO filtra mais a lista' : 'Ligar: selecionar entregador no header automaticamente filtra a lista'}
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9.5px] font-black transition ring-1 ${
                      autoFiltraEntregadorAtivo
                        ? 'bg-violet-400/15 text-violet-200 ring-violet-400/40'
                        : 'bg-white/[0.06] text-slate-400 ring-white/10 hover:bg-white/10'
                    }`}
                  >
                    {autoFiltraEntregadorAtivo ? '🔗 AUTO' : '⛓️ OFF'}
                  </button>
                  <div className="w-px h-4 bg-white/10 mx-0.5" />
                  <button
                    type="button"
                    onClick={() => setFiltroEntregador('__todos__')}
                    className={`px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                      filtroEntregador === '__todos__'
                        ? 'bg-neutral-900 text-white'
                        : 'bg-white/[0.06] text-slate-400 hover:bg-white/10'
                    }`}
                  >
                    Todos
                  </button>
                  {contagemEntregadores.map(({ nome, qtd, retornos }) => {
                    const selecionado = filtroEntregador === (nome === 'Sem entregador' ? '__sem__' : nome);
                    return (
                      <button
                        key={nome}
                        type="button"
                        onClick={() => setFiltroEntregador(nome === 'Sem entregador' ? '__sem__' : nome)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition ${
                          selecionado
                            ? 'bg-violet-600 text-white shadow-sm'
                            : nome === 'Sem entregador'
                            ? 'bg-white/[0.06] text-slate-400 hover:bg-white/10'
                            : 'bg-violet-400/12 text-violet-300 hover:bg-violet-400/15'
                        }`}
                      >
                        <span className="truncate max-w-[140px]">{nome}</span>
                        <span
                          className={`tabular-nums font-black text-[10.5px] px-1 py-0.5 rounded ${
                            selecionado ? 'bg-white/20' : 'bg-white/10'
                          }`}
                        >
                          {qtd}
                        </span>
                        {retornos > 0 && (
                          <span
                            className={`inline-flex items-center gap-0.5 tabular-nums font-black text-[10.5px] px-1 py-0.5 rounded ${
                              selecionado ? 'bg-orange-400/30 text-white' : 'bg-orange-400/15 text-orange-300'
                            }`}
                          >
                            <RefreshCw className="h-2 w-2" />
                            {retornos}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ===== MODO LEITURA ===== */}
            <div className={`bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl border border-white/10 px-3 sm:px-4 py-3 shadow-sm ${bloqueado ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="grid grid-cols-4 gap-1 p-1 rounded-xl bg-white/[0.06] mb-3">
                {(Object.keys(MODO_META) as Modo[]).map((m) => {
                  const meta = MODO_META[m];
                  const Icon = meta.icon;
                  const ativo = modo === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setModo(m)}
                      className={`rounded-lg py-2.5 px-2 flex items-center justify-center gap-1.5 font-bold text-[12px] transition ${
                        ativo
                          ? 'bg-gradient-to-r from-ml-blue to-violet-500 text-white shadow-sm shadow-indigo-500/30'
                          : 'text-slate-400 hover:text-slate-300'
                      }`}
                    >
                      <Icon className={`h-4 w-4 ${ativo ? 'text-white' : ''}`} />
                      <span className="hidden sm:inline">{meta.label}</span>
                    </button>
                  );
                })}
              </div>

              {modo === 'camera' && <QrCodeScanner onCodigoLido={onCodigoCamera} />}

              {modo === 'leitor' && (
                <form onSubmit={onSubmitLeitor} className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      id="leitor-input"
                      ref={inputLeitorRef}
                      placeholder="Leitor externo…"
                      value={codigoLeitor}
                      onChange={(e) => setCodigoLeitor(e.target.value)}
                      onBlur={onBlurLeitorCondicional}
                      className="!h-11 text-base font-bold tabular-nums"
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
                      className="!h-11 !px-4"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {entregadorAtivo && (
                    <p className="text-[10.5px] font-bold text-violet-300 inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Lançando em: {entregadorAtivo}
                    </p>
                  )}
                </form>
              )}

              {modo === 'manual' && (
                <form onSubmit={onSubmitManual} className="space-y-2">
                  <div className="flex gap-2 items-start">
                    <div className="flex-1 space-y-1">
                      <Textarea
                        id="manual-input"
                        ref={inputManualRef}
                        placeholder="Digite os IDs (1 por linha, vírgula ou espaço)…"
                        value={codigoManual}
                        onChange={(e) => setCodigoManual(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            const form = (e.currentTarget.closest('form') ?? null) as HTMLFormElement | null;
                            form?.requestSubmit();
                          }
                        }}
                        rows={4}
                        className="text-sm font-semibold tabular-nums resize-y"
                        autoComplete="off"
                        autoCorrect="off"
                        autoCapitalize="off"
                        spellCheck={false}
                      />
                      {codigoManual.trim() && (
                        <p className="text-[10.5px] font-bold text-slate-400">
                          {(() => {
                            const qtd = Array.from(
                              new Set(
                                codigoManual
                                  .split(/[\s,;\n\r\t]+/)
                                  .map((c) => c.trim())
                                  .filter(Boolean),
                              ),
                            ).length;
                            return (
                              <span className={qtd > 1 ? 'text-indigo-300' : ''}>
                                {qtd} ID{qtd !== 1 ? 's' : ''} pronto{qtd !== 1 ? 's' : ''}
                              </span>
                            );
                          })()}
                        </p>
                      )}
                    </div>
                    <Button
                      type="submit"
                      size="lg"
                      variant="primary"
                      disabled={!codigoManual.trim()}
                      className="!h-11 !px-4 shrink-0"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                    </Button>
                  </div>
                  {entregadorAtivo && (
                    <p className="text-[10.5px] font-bold text-violet-300 inline-flex items-center gap-1">
                      <Truck className="h-3 w-3" /> Lançando em: {entregadorAtivo}
                    </p>
                  )}
                </form>
              )}
            </div>

            <>
                {/* ===== FILTROS COMPACTOS ===== */}
                <div className="flex items-center gap-2 flex-wrap bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl border border-white/10 px-3 sm:px-4 py-2.5 shadow-sm">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer select-none shrink-0">
                    <input
                      type="checkbox"
                      checked={selecionados.size > 0 ? todosFiltradosSelecionados : false}
                      ref={(el) => {
                        if (!el) return;
                        el.indeterminate = selecionados.size > 0 && !todosFiltradosSelecionados && filtrados.some((p) => selecionados.has(p.id));
                      }}
                      onChange={(e) => {
                        if (e.target.checked) selecionarTodosFiltrados();
                        else limparSelecao();
                      }}
                      className="h-4 w-4 rounded border-white/15 text-indigo-300 focus:ring-indigo-500 cursor-pointer"
                    />
                    <span className="text-[11px] font-black text-slate-300 hidden sm:inline">
                      {selecionados.size > 0 ? `${selecionados.size} selec.` : 'Selecionar'}
                    </span>
                  </label>
                  <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
                  <div className="flex items-center gap-1.5 flex-1 min-w-[160px]">
                    <Search className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <Input
                      placeholder={`Buscar ${filtrados.length} ${filtrados.length === 1 ? 'ID…' : 'IDs…'}`}
                      value={filtro}
                      onChange={(e) => setFiltro(e.target.value)}
                      className="!h-8 !text-[13px] !px-2 !border-0 !ring-0 !p-0 focus-visible:!ring-0 focus-visible:!ring-offset-0 !bg-transparent"
                    />
                  </div>
                  <div className="w-px h-5 bg-white/10 mx-0.5 shrink-0" />
                  <div className={`sm:hidden inline-flex items-center gap-1 px-1.5 py-1 rounded-lg ring-1 ${chipSync.bg} ${chipSync.txt} ${chipSync.ring} ${chipSync.pulse ? 'animate-pulse' : ''}`}>
                    <SyncIcon className={`h-2.5 w-2.5 ${chipSync.spin ? 'animate-spin' : ''}`} />
                  </div>
                  <div className="flex items-center gap-1 bg-white/[0.06] p-0.5 rounded-lg shrink-0 flex-wrap">
                    {botoesStatus.map((b) => {
                      const Icon = b.icon;
                      const sel = filtroStatus === b.k;
                      return (
                        <button
                          key={b.k}
                          type="button"
                          onClick={() => setFiltroStatus(b.k as typeof filtroStatus)}
                          className={`px-2 py-1 rounded-md text-[11px] font-bold transition inline-flex items-center gap-1 ${
                            sel ? b.colorSel : `text-slate-400 ${b.colorHover}`
                          }`}
                        >
                          {Icon && <Icon className="h-2.5 w-2.5" />}
                          {b.label}
                          <span className={`tabular-nums opacity-80 ${sel ? 'text-white/90' : 'text-slate-400'}`}>
                            {b.count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <div className="text-[10.5px] font-semibold text-slate-400 shrink-0">
                    {filtrados.length}/{pacotesDaSaca.length}
                  </div>
                  <button
                    type="button"
                    onClick={removerTodosDaSaca}
                    disabled={!pacotesDaSaca.length}
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10.5px] font-black uppercase tracking-wider text-red-300 ring-1 ring-red-400/30 bg-red-400/12 hover:bg-red-400/15 transition disabled:opacity-40 disabled:cursor-not-allowed shrink-0"
                    title="Remover todos os pacotes desta saca (definitivo)"
                  >
                    <Trash2 className="h-3 w-3" />
                    <span className="hidden sm:inline">Remover todos</span>
                  </button>
                </div>

                {selecionados.size > 0 && (
                  <div className="sticky top-0 z-20 bg-gradient-to-r from-indigo-400/12 via-violet-400/12 to-fuchsia-400/12 rounded-2xl border border-indigo-400/30 px-3 sm:px-4 py-2.5 shadow-sm flex items-center gap-2 sm:gap-3 flex-wrap animate-fade-in">
                    <div className="inline-flex items-center gap-1.5 shrink-0">
                      <span className="flex h-6 w-6 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm">
                        <CheckSquare className="h-3.5 w-3.5" />
                      </span>
                      <div className="leading-tight">
                        <div className="text-[12px] font-black text-indigo-200">
                          {selecionados.size} pacote{selecionados.size !== 1 ? 's' : ''} selecionado{selecionados.size !== 1 ? 's' : ''}
                        </div>
                        <div className="text-[10px] font-bold text-indigo-300/80">
                          Clique num status abaixo para marcar todos de uma vez
                        </div>
                      </div>
                    </div>
                    <div className="h-5 w-px bg-indigo-400/30 shrink-0 hidden sm:block" />
                    <div className="flex items-center gap-1 sm:gap-1.5 flex-wrap flex-1 min-w-0">
                      {([
                        { st: 'lido' as const,      Icon: CheckCheck, bg: 'bg-sky-600 hover:bg-sky-700', label: 'Marcar lidos' },
                        { st: 'entregue' as const,  Icon: Truck,     bg: 'bg-emerald-600 hover:bg-emerald-700', label: 'Marcar entregues' },
                        { st: 'retorno' as const,   Icon: RefreshCw, bg: 'bg-orange-500 hover:bg-orange-600', label: 'Marcar retornos' },
                        { st: 'devolucao' as const, Icon: Undo2,     bg: 'bg-rose-600 hover:bg-rose-700', label: 'Marcar devoluções' },
                      ]).map(({ st, Icon, bg, label }) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => {
                            void definirStatusEmLote(idsSelecionadosArray, st);
                          }}
                          className={`inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg text-white text-[11px] font-black shadow-sm transition ${bg}`}
                          title={label}
                        >
                          <Icon className="h-3.5 w-3.5 shrink-0" />
                          <span className="hidden sm:inline">{STATUS_PACOTE_META[st].label}</span>
                        </button>
                      ))}
                      <button
                        type="button"
                        onClick={() => {
                          setModalAtribuirEntregadorAberto(true);
                        }}
                        className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg !bg-gradient-to-r !from-indigo-500 !to-violet-500 hover:!from-indigo-600 hover:!to-violet-600 text-white text-[11px] font-black shadow-sm transition"
                        title="Atribuir entregador para os pacotes selecionados"
                      >
                        <UserPlus className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline">Atribuir entregador</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          void definirStatusEmLote(idsSelecionadosArray, null);
                        }}
                        className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-neutral-700 hover:bg-neutral-800 text-white text-[11px] font-black shadow-sm transition"
                        title="Remover status de todos selecionados"
                      >
                        <X className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline">Sem status</span>
                      </button>
                      <button
                        type="button"
                        onClick={removerSelecionados}
                        className="inline-flex items-center gap-1 px-2 sm:px-2.5 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-[11px] font-black shadow-sm transition"
                        title="Remover os pacotes selecionados (definitivo)"
                      >
                        <Trash2 className="h-3.5 w-3.5 shrink-0" />
                        <span className="hidden sm:inline">Remover selecionados</span>
                      </button>
                    </div>
                    <button
                      type="button"
                      onClick={limparSelecao}
                      className="ml-auto inline-flex items-center gap-1 px-2 py-1.5 rounded-lg bg-white/[0.06] ring-1 ring-indigo-400/30 text-indigo-300 hover:bg-indigo-400/12 text-[11px] font-black shadow-sm transition shrink-0"
                    >
                      <X className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Limpar</span>
                    </button>
                  </div>
                )}

                {/* ===== LISTA PACOTES COMPACTA ===== */}
                {!filtrados.length ? (
                  <div className="bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] rounded-2xl border border-white/10 px-4 py-10 text-center shadow-sm">
                    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/[0.06] text-slate-400 mx-auto mb-3">
                      <Package className="h-6 w-6" />
                    </div>
                    <h3 className="text-[14px] font-bold text-white">
                      {pacotes.length
                        ? 'Nenhum resultado nos filtros'
                        : 'Nenhum pacote escaneado ainda'}
                    </h3>
                    <p className="text-[12px] text-slate-400 mt-1">
                      {pacotes.length
                        ? 'Ajuste a busca ou os filtros.'
                        : 'Use câmera, leitor ou digite acima.'}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-[65vh] overflow-auto scrollbar-thin pr-0.5">
                    {filtrados.map((p, idx) => {
                      const origemMap: Partial<Record<OrigemLeitura | string, { label: string; variant: 'info' | 'success' | 'warning' | 'default' }>> = {
                        camera: { label: 'Câmera', variant: 'info' },
                        leitor_externo: { label: 'Leitor', variant: 'success' },
                        manual: { label: 'Manual', variant: 'warning' },
                        import_json_rotas: { label: 'JSON rotas', variant: 'info' },
                        import_json_zona: { label: 'JSON zona', variant: 'success' },
                      };
                      const oMeta = origemMap[p.origem] ?? { label: String(p.origem ?? 'Outro'), variant: 'default' };
                      const destaque = flashId === p.id;
                      const shaking = shakeId === p.id;
                      const d = new Date(p.created_at);
                      const hora = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
                      const sel = selecionados.has(p.id);
                      return (
                        <div
                          key={p.id}
                          className={`bg-white/[0.06] rounded-xl border transition-all duration-300 flex items-center gap-2 sm:gap-2.5 px-2 sm:px-2.5 py-2 ${
                            sel
                              ? 'ring-2 ring-indigo-400/80 border-indigo-400/30 bg-indigo-400/12 shadow-sm'
                              : destaque
                              ? 'ring-2 ring-emerald-400 shadow-md bg-emerald-400/12 border-emerald-400/30'
                              : shaking
                              ? 'ring-2 ring-red-400 animate-shake border-red-400/30 bg-red-400/12'
                              : 'border-white/10 hover:border-white/15 hover:shadow-sm'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={sel}
                            onChange={(e) => toggleSelecionado(p.id)}
                            className="h-4 w-4 shrink-0 rounded border-white/15 text-indigo-300 focus:ring-indigo-500 cursor-pointer"
                            title={sel ? 'Desmarcar' : 'Marcar para lote'}
                          />
                          <div className="shrink-0 text-[10px] font-black tabular-nums text-slate-400 w-5 sm:w-7 text-center">
                            {pacotes.length - idx}
                          </div>

                          <div className="min-w-0 flex-1 flex items-center gap-2 flex-wrap">
                            <span className="text-[15px] sm:text-[16px] font-black tracking-tight tabular-nums text-white break-all leading-tight">
                              {p.codigo_pacote}
                            </span>
                            {p.entregador && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-violet-400/12 text-violet-300 ring-1 ring-violet-400/30 text-[10.5px] font-black truncate max-w-[160px]">
                                <Truck className="h-2.5 w-2.5 shrink-0" />
                                <span className="truncate">{p.entregador}</span>
                              </span>
                            )}
                            {p.status && (
                              <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[10.5px] font-black ring-1 ${STATUS_PACOTE_META[p.status].bg} ${STATUS_PACOTE_META[p.status].txt} ${STATUS_PACOTE_META[p.status].ring}`}>
                                {STATUS_PACOTE_META[p.status].icone === 'check' && <CheckCheck className="h-2.5 w-2.5" />}
                                {STATUS_PACOTE_META[p.status].icone === 'truck' && <Truck className="h-2.5 w-2.5" />}
                                {STATUS_PACOTE_META[p.status].icone === 'refresh' && <RefreshCw className="h-2.5 w-2.5" />}
                                {STATUS_PACOTE_META[p.status].icone === 'undo' && <Undo2 className="h-2.5 w-2.5" />}
                                {STATUS_PACOTE_META[p.status].badge}
                              </span>
                            )}
                            <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-black ring-1 ${
                              oMeta.variant === 'info' || oMeta.variant === 'default'
                                ? 'bg-sky-400/12 text-sky-300 ring-sky-400/30'
                                : oMeta.variant === 'success'
                                ? 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30'
                                : 'bg-amber-400/12 text-amber-300 ring-amber-400/30'
                            }`}>
                              {oMeta.label}
                            </span>
                            <span
                              className={`inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[9.5px] font-black ring-1 ${
                                p.sincronizado
                                  ? 'bg-emerald-400/12 text-emerald-300 ring-emerald-400/30'
                                  : 'bg-amber-400/12 text-amber-300 ring-amber-400/30'
                              }`}
                            >
                              {p.sincronizado ? 'BD' : 'Local'}
                            </span>
                          </div>

                          <div className="shrink-0 flex items-center gap-0.5 text-[10.5px] text-slate-400">
                            <Clock className="h-2.5 w-2.5 hidden sm:inline" />
                            <span className="tabular-nums hidden sm:inline">{hora}</span>
                            {([
                              { st: 'lido',      Icon: CheckCheck, bgOn: 'bg-sky-400/15 text-sky-300 ring-sky-400/30',      bgOff: 'hover:bg-sky-400/12 hover:text-sky-300',       title: 'Marcar como lido' },
                              { st: 'entregue',  Icon: Truck,     bgOn: 'bg-emerald-400/15 text-emerald-300 ring-emerald-400/30', bgOff: 'hover:bg-emerald-400/12 hover:text-emerald-300', title: 'Marcar entregue' },
                              { st: 'retorno',   Icon: RefreshCw, bgOn: 'bg-orange-400/15 text-orange-300 ring-orange-400/30',  bgOff: 'hover:bg-orange-400/12 hover:text-orange-300',  title: 'Marcar retorno' },
                              { st: 'devolucao', Icon: Undo2,     bgOn: 'bg-rose-400/15 text-rose-300 ring-rose-400/30',        bgOff: 'hover:bg-rose-400/12 hover:text-rose-300',      title: 'Marcar devolução' },
                            ] as const).map(({ st, Icon, bgOn, bgOff, title }) => {
                              const ativo = p.status === st;
                              return (
                                <button
                                  key={st}
                                  type="button"
                                  onClick={() => void definirStatus(p.id, ativo ? null : st)}
                                  className={`ml-0.5 flex h-7 w-7 items-center justify-center rounded-lg transition ring-1 ${
                                    ativo ? `${bgOn}` : `text-slate-400 ring-transparent ${bgOff}`
                                  }`}
                                  title={ativo ? `Desmarcar ${STATUS_PACOTE_META[st].label}` : title}
                                >
                                  <Icon className="h-3.5 w-3.5" />
                                </button>
                              );
                            })}
                            <button
                              type="button"
                              onClick={() => setMoverId(p.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-amber-400/12 hover:text-amber-300 transition"
                              title="Mover entregador"
                            >
                              <ArrowRightLeft className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void remover(p.id)}
                              className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-red-400/12 hover:text-red-300 transition"
                              title="Remover"
                            >
                              <XCircle className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
          </>
        )}

        {/* ===== POPUPS MENORES ===== */}
        {diagnostico && (
          <div className={`fixed bottom-28 right-4 z-[90] w-[280px] sm:w-[380px] rounded-2xl p-3.5 shadow-2xl ring-1 animate-slide-up whitespace-pre-line ${diagnostico.ok ? 'bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] ring-sky-400/30' : 'bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] ring-red-400/30'}`}>
            <div className="flex items-center gap-2">
              {diagnostico.ok ? (
                <Database className="h-4 w-4 text-sky-300 shrink-0" />
              ) : (
                <AlertTriangle className="h-4 w-4 text-red-300 shrink-0" />
              )}
              <p className="text-[12px] font-black text-white">{diagnostico.etapa}</p>
            </div>
            <p className="text-[11px] text-slate-300 mt-1 break-all leading-snug">{diagnostico.detalhe}</p>
          </div>
        )}

        {backupMsg && (
          <div className={`fixed bottom-28 left-1/2 -translate-x-1/2 z-[90] max-w-[92vw] rounded-2xl px-4 py-3 shadow-2xl ring-1 whitespace-pre-line animate-slide-up ${backupMsg.ok ? 'bg-emerald-400/12 ring-emerald-400/30' : 'bg-red-400/12 ring-red-400/30'}`}>
            <p className={`text-[12px] font-bold leading-snug ${backupMsg.ok ? 'text-emerald-200' : 'text-red-200'}`}>
              {backupMsg.texto}
            </p>
          </div>
        )}

        {resultadoSync && !sincronizando && (
          <div className="fixed bottom-28 right-4 z-[90] w-[270px] sm:w-[330px] rounded-2xl bg-[linear-gradient(180deg,rgba(19,29,50,0.92),rgba(11,19,34,0.86))] ring-1 ring-white/10 shadow-2xl p-3.5 animate-slide-up">
            <div className="flex items-center gap-2 mb-2">
              {resultadoSync.sacas.falhas === 0 && resultadoSync.pacotes.falhas === 0 ? (
                <>
                  <CheckCircle2 className="h-4 w-4 text-emerald-300" />
                  <p className="text-[12px] font-black text-white">Sincronização OK</p>
                </>
              ) : (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-300" />
                  <p className="text-[12px] font-black text-white">Sincronização com falhas</p>
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-1.5 text-[11px]">
              <div className="rounded-xl bg-white/[0.06] p-2 ring-1 ring-white/10">
                <p className="text-slate-400 font-black uppercase tracking-wider text-[9.5px]">Sacas</p>
                <p className="text-white font-black tabular-nums mt-0.5">
                  {resultadoSync.sacas.sincronizados}/{resultadoSync.sacas.total}
                </p>
              </div>
              <div className="rounded-xl bg-white/[0.06] p-2 ring-1 ring-white/10">
                <p className="text-slate-400 font-black uppercase tracking-wider text-[9.5px]">Pacotes</p>
                <p className="text-white font-black tabular-nums mt-0.5">
                  {resultadoSync.pacotes.sincronizados}/{resultadoSync.pacotes.total}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
