import { create } from 'zustand';
import type { PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote } from '@/types';
import { PacoteService } from '@/services/packages/PacoteService';

type PacoteState = {
  pacotes: PacoteLidoLocal[];
  carregando: boolean;
  ultimoLido: PacoteLidoLocal | null;
  ultimoDuplicado: PacoteLidoLocal | null;
  ultimoResultado: ResultadoAdicaoPacote | null;
  carregar: () => Promise<void>;
  adicionar: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<ResultadoAdicaoPacote>;
  remover: (id: string) => Promise<void>;
  limpar: () => Promise<void>;
  total: () => number;
  unicos: () => number;
  exportar: () => Promise<void>;
  limparFeedback: () => void;
};

const CHAVE_CACHE = 'ml_pacote_store_v1';

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

function salvarCache(lista: PacoteLidoLocal[]) {
  try {
    sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(lista));
  } catch {
    /* noop */
  }
}

export const usePacoteStore = create<PacoteState>((set, get) => ({
  pacotes: carregarDoCache(),
  carregando: false,
  ultimoLido: null,
  ultimoDuplicado: null,
  ultimoResultado: null,

  carregar: async () => {
    set({ carregando: true });
    try {
      const lista = await PacoteService.listar();
      salvarCache(lista);
      set({ pacotes: lista, carregando: false });
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
      const resultado = await PacoteService.adicionar(codigo, origem, extra);
      if (resultado.sucesso && resultado.pacote) {
        const atual = get().pacotes;
        const jaTem = atual.some((p) => p.codigo_pacote === resultado.pacote!.codigo_pacote);
        const nova = jaTem ? atual : [resultado.pacote, ...atual.filter((p) => p.codigo_pacote !== resultado.pacote!.codigo_pacote)];
        salvarCache(nova);
        set({
          pacotes: nova,
          ultimoLido: resultado.pacote,
          ultimoDuplicado: null,
          ultimoResultado: resultado,
        });
      } else if (resultado.duplicado && resultado.existente) {
        const atual = get().pacotes;
        const jaTem = atual.some((p) => p.codigo_pacote === resultado.existente!.codigo_pacote);
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

  remover: async (id) => {
    await PacoteService.remover(id);
    const atual = get().pacotes.filter((p) => p.id !== id);
    salvarCache(atual);
    set({ pacotes: atual });
  },

  limpar: async () => {
    await PacoteService.limpar();
    salvarCache([]);
    set({ pacotes: [], ultimoLido: null, ultimoDuplicado: null, ultimoResultado: null });
  },

  total: () => get().pacotes.length,

  unicos: () => new Set(get().pacotes.map((p) => p.codigo_pacote)).size,

  exportar: async () => {
    await PacoteService.exportarCsv();
  },

  limparFeedback: () => {
    set({ ultimoLido: null, ultimoDuplicado: null, ultimoResultado: null });
  },
}));
