import { create } from 'zustand';
import type { PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote, Saca, ResumoSaca, ResultadoMoverPacote } from '@/types';
import { PacoteService, adicionarEntregador, listarEntregadores } from '@/services/packages/PacoteService';
import { SacaService } from '@/services/packages/SacaService';

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
  mostrarModalSaca: boolean;
  mostrarHistoricoSacas: boolean;

  entregadorAtivo: string | null;
  entregadores: string[];

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
  listarEntregadoresDaSaca: () => string[];
  contagemPorEntregador: () => Map<string, number>;

  adicionar: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<ResultadoAdicaoPacote>;
  moverPacote: (id: string, novoEntregador: string, origemMovimento?: 'manual' | 're_scan') => Promise<ResultadoMoverPacote>;
  adicionarOuMover: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<{ tipo: 'adicao' | 'movimento' | 'duplicado_mesmo_entregador' | 'erro'; resultado: ResultadoAdicaoPacote | ResultadoMoverPacote }>;
  remover: (id: string) => Promise<void>;
  limpar: () => Promise<void>;
  total: () => number;
  unicos: () => number;
  exportar: () => Promise<void>;
  limparFeedback: () => void;
};

const CHAVE_CACHE = 'ml_pacote_store_v1';
const CHAVE_CACHE_SACAS = 'ml_sacas_store_v1';
const CHAVE_CACHE_SACA_ATIVA = 'ml_saca_ativa_store_v1';
const CHAVE_CACHE_ENTREGADOR_ATIVO = 'ml_entregador_ativo_v1';

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

export const usePacoteStore = create<PacoteState>((set, get) => ({
  pacotes: carregarDoCache(),
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
  mostrarModalSaca: false,
  mostrarHistoricoSacas: false,

  entregadorAtivo: carregarEntregadorAtivoDoCache(),
  entregadores: listarEntregadores(),

  carregarSacas: async () => {
    set({ carregandoSacas: true });
    try {
      const sacas = await SacaService.listar();
      const resumos = await SacaService.resumos();
      const ativa = await SacaService.pegarAtiva();
      salvarCacheSacas(sacas);
      salvarCacheSacaAtiva(ativa);
      set({
        sacas,
        resumos,
        sacaAtiva: ativa,
        carregandoSacas: false,
        mostrarModalSaca: !ativa,
        entregadores: listarEntregadores(),
      });
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
    set({ sacaAtiva: saca, mostrarModalSaca: false, pacotes: [] });
    salvarCache([]);
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
      set({ sacaAtiva: null, mostrarModalSaca: true });
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
    if (limpo) adicionarEntregador(limpo);
    set({ entregadorAtivo: limpo, entregadores: listarEntregadores() });
  },

  cadastrarEntregador: (nome) => {
    const arr = adicionarEntregador(nome);
    set({ entregadores: arr });
    return arr;
  },

  listarEntregadoresDaSaca: () => {
    const pacotes = get().pacotes;
    const nomes = new Set<string>();
    for (const p of pacotes) {
      if (p.entregador) nomes.add(p.entregador);
    }
    return Array.from(nomes);
  },

  contagemPorEntregador: () => {
    const pacotes = get().pacotes;
    const m = new Map<string, number>();
    for (const p of pacotes) {
      const k = p.entregador ?? 'Sem entregador';
      m.set(k, (m.get(k) ?? 0) + 1);
    }
    return m;
  },

  carregar: async () => {
    set({ carregando: true });
    try {
      if (!get().sacas.length || !get().sacaAtiva) await get().carregarSacas();
      const lista = await PacoteService.listar(get().sacaAtiva?.id ?? null);
      salvarCache(lista);
      set({ pacotes: lista, carregando: false, entregadores: listarEntregadores() });
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
      if (resultado.sucesso && resultado.pacote) {
        const atual = get().pacotes;
        const jaTem = atual.some((p) => p.codigo_pacote === resultado.pacote!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null));
        const nova = jaTem
          ? atual
          : [resultado.pacote, ...atual.filter((p) => !(p.codigo_pacote === resultado.pacote!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null)))];
        salvarCache(nova);
        if (entregadorAtual) adicionarEntregador(entregadorAtual);
        set({
          pacotes: nova,
          ultimoLido: resultado.pacote,
          ultimoDuplicado: null,
          ultimoResultado: resultado,
          entregadores: listarEntregadores(),
        });
      } else if (resultado.duplicado && resultado.existente) {
        const atual = get().pacotes;
        const jaTem = atual.some((p) => p.codigo_pacote === resultado.existente!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null));
        if (!jaTem) {
          const nova = [resultado.existente, ...atual];
          salvarCache(nova);
          set({ pacotes: nova });
        }
        set({
          ultimoLido: null,
          ultimoDuplicado: resultado.existente,
          ultimoResultado: resultado,
        });
      } else {
        set({ ultimoResultado: resultado });
      }
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
        set({
          pacotes: nova,
          ultimoMovido: resultado.movido ? resultado.pacote : null,
          ultimoResultadoMover: resultado,
          entregadores: listarEntregadores(),
        });
      }
    }
    return resultado;
  },

  adicionarOuMover: async (codigo, origem, extra = {}) => {
    const sacaAtual = get().sacaAtiva;
    const entregadorAtual = get().entregadorAtivo;

    const tentativaAdicao = await get().adicionar(codigo, origem, extra);

    if (tentativaAdicao.sucesso) {
      return { tipo: 'adicao', resultado: tentativaAdicao };
    }

    if (tentativaAdicao.duplicado && tentativaAdicao.existente && entregadorAtual) {
      const existente = tentativaAdicao.existente;
      const entregadorDoExistente = existente.entregador ?? null;

      if (entregadorDoExistente === entregadorAtual) {
        return { tipo: 'duplicado_mesmo_entregador', resultado: tentativaAdicao };
      }

      const resultadoMover = await get().moverPacote(existente.id, entregadorAtual, 're_scan');
      return { tipo: 'movimento', resultado: resultadoMover };
    }

    return { tipo: 'erro', resultado: tentativaAdicao };
  },

  remover: async (id) => {
    await PacoteService.remover(id);
    const atual = get().pacotes.filter((p) => p.id !== id);
    salvarCache(atual);
    set({ pacotes: atual });
  },

  limpar: async () => {
    const sacaAtual = get().sacaAtiva;
    await PacoteService.limpar(sacaAtual?.id ?? null);
    salvarCache([]);
    set({
      pacotes: [],
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
}));
