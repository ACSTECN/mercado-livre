import { create } from 'zustand';
import { persist, createJSONStorage, type StateStorage } from 'zustand/middleware';
import type { MapeamentoColunas, PlanilhaImportada, RegistroPlanilha } from '@/types';
import { gerarId } from '@/lib/utils';

/**
 * Storage wrapper 100% seguro SSR / client side
 *
 * - Nunca toca em window/localStorage do lado do servidor
 * - No 1o acesso no cliente: tenta localStorage
 *   - Se falhar (bloqueado / modo privado): fallback para MEMÓRIA (Map em singleton)
 * - Todos os erros são engolidos silenciosamente (não crasha hydration)
 */
function createSafeStorage(): StateStorage {
  const inMemory = new Map<string, unknown>();
  let isBrowser = false;
  let canUseLocalStorage = false;

  const check = () => {
    if (typeof window === 'undefined') {
      isBrowser = false;
      canUseLocalStorage = false;
      return;
    }
    isBrowser = true;
    try {
      const k = '__ml_safe_check__';
      window.localStorage.setItem(k, '1');
      window.localStorage.removeItem(k);
      canUseLocalStorage = true;
    } catch {
      canUseLocalStorage = false;
    }
  };

  check();

  const storage: StateStorage = {
    getItem: (name: string): string | null | Promise<string | null> => {
      if (!isBrowser) return null;
      check();
      if (canUseLocalStorage) {
        try {
          return window.localStorage.getItem(name);
        } catch {
          // fallback para memória
        }
      }
      const v = inMemory.get(name);
      return v === undefined ? null : (typeof v === 'string' ? v : JSON.stringify(v));
    },
    setItem: (name: string, value: string): void | Promise<void> => {
      if (!isBrowser) return;
      check();
      if (canUseLocalStorage) {
        try {
          window.localStorage.setItem(name, value);
          return;
        } catch {
          // fallback para memória abaixo
        }
      }
      inMemory.set(name, value);
    },
    removeItem: (name: string): void | Promise<void> => {
      if (!isBrowser) return;
      check();
      if (canUseLocalStorage) {
        try {
          window.localStorage.removeItem(name);
        } catch {
          /* noop */
        }
      }
      inMemory.delete(name);
    },
  };

  return storage;
}

type SpreadsheetState = {
  planilha: PlanilhaImportada | null;
  mapeamento: MapeamentoColunas;
  __rehydrated: boolean;
  set: (updater: Partial<SpreadsheetState>) => void;
  importar: (args: {
    nomeArquivo: string;
    hash: string;
    cabecalhos: string[];
    mapeamento: MapeamentoColunas;
    registros: RegistroPlanilha[];
  }) => void;
  substituir: (args: {
    nomeArquivo: string;
    hash: string;
    cabecalhos: string[];
    mapeamento: MapeamentoColunas;
    registros: RegistroPlanilha[];
  }) => void;
  limpar: () => void;
  totalRegistros: () => number;
};

export const useSpreadsheetStore = create<SpreadsheetState>()(
  persist(
    (set, get) => ({
      planilha: null,
      mapeamento: {},
      __rehydrated: false,
      set: (u) => set((s) => ({ ...s, ...u })),
      importar: (args) => {
        const p: PlanilhaImportada = {
          id: gerarId(),
          nomeArquivo: args.nomeArquivo,
          hashArquivo: args.hash,
          totalRegistros: args.registros.length,
          cabecalhos: args.cabecalhos,
          mapeamento: args.mapeamento,
          registros: args.registros,
          importadaEm: Date.now(),
        };
        set({ planilha: p, mapeamento: args.mapeamento });
      },
      substituir: (args) => {
        const atual = get().planilha;
        const p: PlanilhaImportada = {
          id: atual?.id ?? gerarId(),
          nomeArquivo: args.nomeArquivo,
          hashArquivo: args.hash,
          totalRegistros: args.registros.length,
          cabecalhos: args.cabecalhos,
          mapeamento: args.mapeamento,
          registros: args.registros,
          importadaEm: Date.now(),
        };
        set({ planilha: p, mapeamento: args.mapeamento });
      },
      limpar: () => set({ planilha: null, mapeamento: {} }),
      totalRegistros: () => get().planilha?.registros.length ?? 0,
    }),
    {
      name: 'ml_planilha_v1',
      storage: createJSONStorage(() => createSafeStorage()),
      partialize: (s) => ({ planilha: s.planilha, mapeamento: s.mapeamento }),
      onRehydrateStorage: () => {
        return (_state) => {
          try {
            useSpreadsheetStore.setState({ __rehydrated: true } as Partial<SpreadsheetState>);
          } catch {
            /* noop */
          }
        };
      },
    },
  ),
);
