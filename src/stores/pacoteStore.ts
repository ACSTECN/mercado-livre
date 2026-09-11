import { create } from 'zustand';
import type { PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote, Saca, ResumoSaca, ResultadoMoverPacote, StatusPacote } from '@/types';
import { PacoteService, adicionarEntregador, listarEntregadores, inscreverRealtimePacotes } from '@/services/packages/PacoteService';
import { SacaService } from '@/services/packages/SacaService';

type ContagemEntregador = { nome: string; qtd: number; retornos: number };

type PacoteState = {
  pacotes: PacoteLidoLocal[];
  sacas: Saca[];
  resumos: ResumoSaca[];
  sacaAtiva: Saca | null;
  carregando: boolean;
  carregandoSacas: boolean;
  ultimoLido: PacoteLidoLocal | null;
  ultimoDuplicado: PacoteLidoLocal | null;
  ultimoResultado: ResultadoAdicaoPacote | null;
  ultimoMovido: PacoteLidoLocal | null;
  ultimoResultadoMover: ResultadoMoverPacote | null;
  ultimoAlteradoStatus: { id: string; status: StatusPacote | null; ts: number } | null;
  mostrarModalSaca: boolean;
  mostrarHistoricoSacas: boolean;

  entregadorAtivo: string | null;
  entregadores: string[];
  entregadoresSaca: string[];
  contagensEntregadores: ContagemEntregador[];

  carregar: () => Promise<void>;
  carregarSacas: () => Promise<void>;
  definirSacaAtiva: (sacaId: string) => Promise<void>;
  criarSaca: (nome: string, descricao?: string) => Promise<Saca>;
  fecharSacaAtiva: () => Promise<void>;
  fecharSaca: (id: string) => Promise<void>;
  reabrirSaca: (id: string) => Promise<void>;
  removerSaca: (id: string) => Promise<void>;
  abrirModalSaca: () => void;
  fecharModalSaca: () => void;
  abrirHistoricoSacas: () => void;
  fecharHistoricoSacas: () => void;

  definirEntregador: (nome: string | null) => void;
  cadastrarEntregador: (nome: string) => string[];

  adicionar: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<ResultadoAdicaoPacote>;
  moverPacote: (id: string, novoEntregador: string, origemMovimento?: 'manual' | 're_scan') => Promise<ResultadoMoverPacote>;
  adicionarOuMover: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<{ tipo: 'adicao' | 'movimento' | 'duplicado_mesmo_entregador' | 'erro'; resultado: ResultadoAdicaoPacote | ResultadoMoverPacote }>;
  definirStatus: (id: string, status: StatusPacote | null) => Promise<void>;
  alternarStatusRetorno: (id: string) => Promise<void>;
  remover: (id: string) => Promise<void>;
  limpar: () => Promise<void>;
  total: () => number;
  unicos: () => number;
  exportar: () => Promise<void>;
  limparFeedback: () => void;
  inscreverRealtime: () => () => void;
  forcarSincronizacaoCompleta: () => Promise<{
    sacas: { sincronizados: number; falhas: number; total: number; primeiroErro: string | null };
    pacotes: { sincronizados: number; falhas: number; total: number; primeiroErro: string | null };
  }>;
};

const CHAVE_CACHE = 'ml_pacote_store_v1';
const CHAVE_CACHE_SACAS = 'ml_sacas_store_v1';
const CHAVE_CACHE_SACA_ATIVA = 'ml_saca_ativa_store_v1';
const CHAVE_CACHE_ENTREGADOR_ATIVO = 'ml_entregador_ativo_v1';

function recalcular(pacotes: PacoteLidoLocal[]): { entregadoresSaca: string[]; contagens: ContagemEntregador[] } {
  const mapaQtd = new Map<string, number>();
  const mapaRetornos = new Map<string, number>();
  for (const p of pacotes) {
    const k = p.entregador ?? 'Sem entregador';
    mapaQtd.set(k, (mapaQtd.get(k) ?? 0) + 1);
    if (p.status === 'retorno') mapaRetornos.set(k, (mapaRetornos.get(k) ?? 0) + 1);
  }
  const contagens: ContagemEntregador[] = [];
  for (const [nome, qtd] of mapaQtd.entries()) {
    contagens.push({ nome, qtd, retornos: mapaRetornos.get(nome) ?? 0 });
  }
  contagens.sort((a, b) => b.qtd - a.qtd);

  const nomes = new Set<string>();
  for (const p of pacotes) {
    if (p.entregador) nomes.add(p.entregador);
  }
  return { entregadoresSaca: Array.from(nomes), contagens };
}

function arraysIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function carregarDoCache(): PacoteLidoLocal[] {
  try {
    const raw = sessionStorage.getItem(CHAVE_CACHE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PacoteLidoLocal[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function carregarSacasDoCache(): Saca[] {
  try {
    const raw = localStorage.getItem(CHAVE_CACHE_SACAS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Saca[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function carregarSacaAtivaDoCache(): Saca | null {
  try {
    const raw = localStorage.getItem(CHAVE_CACHE_SACA_ATIVA);
    if (!raw) return null;
    return JSON.parse(raw) as Saca;
  } catch {
    return null;
  }
}

function carregarEntregadorAtivoDoCache(): string | null {
  try {
    const raw = localStorage.getItem(CHAVE_CACHE_ENTREGADOR_ATIVO);
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

function salvarCache(lista: PacoteLidoLocal[]) {
  try {
    sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(lista));
  } catch {
    /* noop */
  }
}

function salvarCacheSacas(lista: Saca[]) {
  try {
    localStorage.setItem(CHAVE_CACHE_SACAS, JSON.stringify(lista));
  } catch {
    /* noop */
  }
}

function salvarCacheSacaAtiva(s: Saca | null) {
  try {
    if (s) localStorage.setItem(CHAVE_CACHE_SACA_ATIVA, JSON.stringify(s));
    else localStorage.removeItem(CHAVE_CACHE_SACA_ATIVA);
  } catch {
    /* noop */
  }
}

function salvarCacheEntregadorAtivo(nome: string | null) {
  try {
    if (nome) localStorage.setItem(CHAVE_CACHE_ENTREGADOR_ATIVO, nome);
    else localStorage.removeItem(CHAVE_CACHE_ENTREGADOR_ATIVO);
  } catch {
    /* noop */
  }
}

const pacotesIniciais = carregarDoCache();
const inicial = recalcular(pacotesIniciais);

export const usePacoteStore = create<PacoteState>((set, get) => ({
  pacotes: pacotesIniciais,
  sacas: carregarSacasDoCache(),
  resumos: [],
  sacaAtiva: carregarSacaAtivaDoCache(),
  carregando: false,
  carregandoSacas: false,
  ultimoLido: null,
  ultimoDuplicado: null,
  ultimoResultado: null,
  ultimoMovido: null,
  ultimoResultadoMover: null,
  ultimoAlteradoStatus: null,
  mostrarModalSaca: false,
  mostrarHistoricoSacas: false,

  entregadorAtivo: carregarEntregadorAtivoDoCache(),
  entregadores: listarEntregadores(),
  entregadoresSaca: inicial.entregadoresSaca,
  contagensEntregadores: inicial.contagens,

  carregarSacas: async () => {
    set({ carregandoSacas: true });
    try {
      const sacas = await SacaService.listar();
      const resumos = await SacaService.resumos();
      const ativa = await SacaService.pegarAtiva();
      salvarCacheSacas(sacas);
      salvarCacheSacaAtiva(ativa);
      const entregadores = listarEntregadores();
      const stateAntigo = get();
      const patch: Partial<PacoteState> = {
        sacas,
        resumos,
        sacaAtiva: ativa,
        carregandoSacas: false,
      };
      if (!arraysIguais(stateAntigo.entregadores, entregadores)) patch.entregadores = entregadores;
      set(patch);
    } catch {
      set({ carregandoSacas: false });
    }
  },

  definirSacaAtiva: async (sacaId) => {
    await SacaService.ativar(sacaId);
    const saca = (await SacaService.listar()).find((s) => s.id === sacaId) ?? null;
    salvarCacheSacaAtiva(saca);
    set({ sacaAtiva: saca, mostrarModalSaca: false, mostrarHistoricoSacas: false });
    await get().carregar();
  },

  criarSaca: async (nome, descricao) => {
    const saca = await SacaService.criar(nome, descricao ? { descricao } : undefined);
    await get().carregarSacas();
    salvarCacheSacaAtiva(saca);
    salvarCache([]);
    const r = recalcular([]);
    set({
      sacaAtiva: saca,
      mostrarModalSaca: false,
      pacotes: [],
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
    return saca;
  },

  fecharSacaAtiva: async () => {
    const a = get().sacaAtiva;
    if (!a) return;
    await get().fecharSaca(a.id);
  },

  fecharSaca: async (id) => {
    await SacaService.fechar(id);
    await get().carregarSacas();
  },

  reabrirSaca: async (id) => {
    await SacaService.reabrir(id);
    await get().carregarSacas();
  },

  removerSaca: async (id) => {
    await SacaService.remover(id);
    const a = get().sacaAtiva;
    if (a && a.id === id) {
      salvarCacheSacaAtiva(null);
      salvarCache([]);
      const r = recalcular([]);
      set({
        sacaAtiva: null,
        pacotes: [],
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      });
    }
    await get().carregarSacas();
    await get().carregar();
  },

  abrirModalSaca: () => set({ mostrarModalSaca: true }),
  fecharModalSaca: () => set({ mostrarModalSaca: false }),
  abrirHistoricoSacas: () => set({ mostrarHistoricoSacas: true }),
  fecharHistoricoSacas: () => set({ mostrarHistoricoSacas: false }),

  definirEntregador: (nome) => {
    const limpo = nome ? nome.trim() : null;
    salvarCacheEntregadorAtivo(limpo);
    const patch: Partial<PacoteState> = { entregadorAtivo: limpo };
    if (limpo) {
      const cadastradosAntigos = get().entregadores;
      if (cadastradosAntigos.includes(limpo)) {
        set(patch as PacoteState);
        return;
      }
      adicionarEntregador(limpo);
      patch.entregadores = listarEntregadores();
    }
    set(patch as PacoteState);
  },

  cadastrarEntregador: (nome) => {
    const arr = adicionarEntregador(nome);
    const antigos = get().entregadores;
    if (!arraysIguais(antigos, arr)) set({ entregadores: arr });
    return arr;
  },

  carregar: async () => {
    set({ carregando: true });
    try {
      if (!get().sacas.length || !get().sacaAtiva) await get().carregarSacas();
      const lista = await PacoteService.listar(get().sacaAtiva?.id ?? null);
      salvarCache(lista);
      const r = recalcular(lista);
      const patch: Partial<PacoteState> = {
        pacotes: lista,
        carregando: false,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      const entregadores = listarEntregadores();
      if (!arraysIguais(get().entregadores, entregadores)) patch.entregadores = entregadores;
      set(patch as PacoteState);
    } catch {
      set({ carregando: false });
    }
  },

  adicionar: async (codigo, origem, extra = {}) => {
    if (!codigo.trim()) {
      const r: ResultadoAdicaoPacote = { sucesso: false, duplicado: false, mensagem: 'Código vazio' };
      set({ ultimoResultado: r });
      return r;
    }
    try {
      const sacaAtual = get().sacaAtiva;
      const entregadorAtual = get().entregadorAtivo;
      const resultado = await PacoteService.adicionar(codigo, origem, {
        ...extra,
        saca_id: sacaAtual?.id ?? undefined,
        entregador: entregadorAtual ?? extra.entregador ?? undefined,
      });

      let lista = get().pacotes;
      let mudouLista = false;
      let novoEntregadorCadastrado = false;

      if (resultado.sucesso && resultado.pacote) {
        const jaTem = lista.some((p) => p.codigo_pacote === resultado.pacote!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null));
        if (!jaTem) {
          lista = [resultado.pacote, ...lista.filter((p) => !(p.codigo_pacote === resultado.pacote!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null)))];
          mudouLista = true;
        }
        if (entregadorAtual) {
          const antigos = get().entregadores;
          if (!antigos.includes(entregadorAtual)) {
            adicionarEntregador(entregadorAtual);
            novoEntregadorCadastrado = true;
          }
        }
      } else if (resultado.duplicado && resultado.existente) {
        const jaTem = lista.some((p) => p.codigo_pacote === resultado.existente!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null));
        if (!jaTem) {
          lista = [resultado.existente, ...lista];
          mudouLista = true;
        }
      }

      if (mudouLista) salvarCache(lista);

      const patch: Partial<PacoteState> = { ultimoResultado: resultado };
      if (resultado.sucesso && resultado.pacote) {
        patch.ultimoLido = resultado.pacote;
        patch.ultimoDuplicado = null;
      } else if (resultado.duplicado && resultado.existente) {
        patch.ultimoLido = null;
        patch.ultimoDuplicado = resultado.existente;
      }
      if (mudouLista) {
        patch.pacotes = lista;
        const r = recalcular(lista);
        patch.entregadoresSaca = r.entregadoresSaca;
        patch.contagensEntregadores = r.contagens;
      }
      if (novoEntregadorCadastrado) patch.entregadores = listarEntregadores();
      set(patch as PacoteState);
      return resultado;
    } catch (e) {
      const r: ResultadoAdicaoPacote = {
        sucesso: false,
        duplicado: false,
        mensagem: e instanceof Error ? e.message : 'Erro desconhecido',
      };
      set({ ultimoResultado: r });
      return r;
    }
  },

  moverPacote: async (id, novoEntregador, origemMovimento = 'manual') => {
    const resultado = await PacoteService.mover(id, novoEntregador, origemMovimento);
    if (resultado.sucesso && resultado.pacote) {
      const atual = get().pacotes;
      const idx = atual.findIndex((p) => p.id === id);
      if (idx >= 0) {
        const nova = [...atual];
        nova[idx] = resultado.pacote;
        salvarCache(nova);
        const r = recalcular(nova);
        const patch: Partial<PacoteState> = {
          pacotes: nova,
          entregadoresSaca: r.entregadoresSaca,
          contagensEntregadores: r.contagens,
          ultimoResultadoMover: resultado,
        };
        if (resultado.movido) patch.ultimoMovido = resultado.pacote;
        const cadastradosAntigos = get().entregadores;
        if (!cadastradosAntigos.includes(novoEntregador.trim())) {
          patch.entregadores = listarEntregadores();
        }
        set(patch as PacoteState);
      } else {
        set({ ultimoResultadoMover: resultado });
      }
    } else {
      set({ ultimoResultadoMover: resultado });
    }
    return resultado;
  },

  adicionarOuMover: async (codigo, origem, extra = {}) => {
    const entregadorAtual = get().entregadorAtivo;

    const tentativaAdicao = await get().adicionar(codigo, origem, extra);

    if (tentativaAdicao.sucesso) {
      return { tipo: 'adicao' as const, resultado: tentativaAdicao };
    }

    if (tentativaAdicao.duplicado && tentativaAdicao.existente && entregadorAtual) {
      const existente = tentativaAdicao.existente;
      const entregadorDoExistente = existente.entregador ?? null;

      if (entregadorDoExistente === entregadorAtual) {
        return { tipo: 'duplicado_mesmo_entregador' as const, resultado: tentativaAdicao };
      }

      const resultadoMover = await get().moverPacote(existente.id, entregadorAtual, 're_scan');
      return { tipo: 'movimento' as const, resultado: resultadoMover };
    }

    return { tipo: 'erro' as const, resultado: tentativaAdicao };
  },

  remover: async (id) => {
    await PacoteService.remover(id);
    const atual = get().pacotes.filter((p) => p.id !== id);
    salvarCache(atual);
    const r = recalcular(atual);
    set({
      pacotes: atual,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
  },

  definirStatus: async (id, status) => {
    const atualizado = await PacoteService.definirStatus(id, status);
    if (!atualizado) return;
    const atual = get().pacotes;
    const idx = atual.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const nova = [...atual];
    nova[idx] = atualizado;
    salvarCache(nova);
    const r = recalcular(nova);
    set({
      pacotes: nova,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
      ultimoAlteradoStatus: { id, status, ts: Date.now() },
    });
  },

  alternarStatusRetorno: async (id) => {
    const atual = get().pacotes.find((p) => p.id === id);
    const novo: StatusPacote | null = atual?.status === 'retorno' ? null : 'retorno';
    await get().definirStatus(id, novo);
  },

  limpar: async () => {
    const sacaAtual = get().sacaAtiva;
    await PacoteService.limpar(sacaAtual?.id ?? null);
    salvarCache([]);
    const r = recalcular([]);
    set({
      pacotes: [],
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
      ultimoLido: null,
      ultimoDuplicado: null,
      ultimoResultado: null,
      ultimoMovido: null,
      ultimoResultadoMover: null,
    });
  },

  total: () => get().pacotes.length,

  unicos: () => new Set(get().pacotes.map((p) => p.codigo_pacote)).size,

  exportar: async () => {
    const sacaAtual = get().sacaAtiva;
    const nomeArquivo = sacaAtual
      ? `saca_${sacaAtual.nome.replace(/\s+/g, '_')}_${Date.now()}.xlsx`
      : undefined;
    await PacoteService.exportarCsv(sacaAtual?.id ?? null, nomeArquivo);
  },

  limparFeedback: () => {
    set({
      ultimoLido: null,
      ultimoDuplicado: null,
      ultimoResultado: null,
      ultimoMovido: null,
      ultimoResultadoMover: null,
    });
  },

  inscreverRealtime: () => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const disparar = (tipo: 'pacotes' | 'sacas') => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const g = get();
        if (tipo === 'sacas') void g.carregarSacas().then(() => void g.carregar());
        else void g.carregar();
      }, 120);
    };
    return inscreverRealtimePacotes(
      () => disparar('pacotes'),
      () => disparar('sacas'),
    );
  },

  forcarSincronizacaoCompleta: async () => {
    console.log('[sincronia] INICIO sincronização forçada');
    const sacas = await SacaService.sincronizarAgora();
    const pacotes = await PacoteService.sincronizarAgora();
    console.log('[sincronia] FIM sincronização forçada:', { sacas, pacotes });
    void get().carregarSacas().then(() => void get().carregar());
    return {
      sacas: { sincronizados: sacas.sincronizados, falhas: sacas.falhas, total: sacas.total, primeiroErro: sacas.primeiroErro },
      pacotes: { sincronizados: pacotes.sincronizados, falhas: pacotes.falhas, total: pacotes.total, primeiroErro: pacotes.primeiroErro },
    };
  },
}));
