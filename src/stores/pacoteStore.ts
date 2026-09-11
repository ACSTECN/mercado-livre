import { create } from 'zustand';
import type { PacoteLidoLocal, OrigemLeitura } from '@/types';
import { PacoteService } from '@/services/packages/PacoteService';

type PacoteState = {
  pacotes: PacoteLidoLocal[];
  carregando: boolean;
  ultimoLido: PacoteLidoLocal | null;
  carregar: () => Promise<void>;
  adicionar: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<PacoteLidoLocal | null>;
  remover: (id: string) => Promise<void>;
  limpar: () => Promise<void>;
  total: () => number;
  unicos: () => number;
  exportar: () => Promise<void>;
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
    if (!codigo.trim()) return null;
    try {
      const criado = await PacoteService.adicionar(codigo, origem, extra);
      const atual = get().pacotes;
      const nova = [criado, ...atual];
      salvarCache(nova);
      set({ pacotes: nova, ultimoLido: criado });
      return criado;
    } catch {
      return null;
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
    set({ pacotes: [], ultimoLido: null });
  },

  total: () => get().pacotes.length,

  unicos: () => new Set(get().pacotes.map((p) => p.codigo_pacote)).size,

  exportar: async () => {
    await PacoteService.exportarCsv();
  },
}));
