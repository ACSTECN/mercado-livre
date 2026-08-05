import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MapeamentoColunas, PlanilhaImportada, RegistroPlanilha } from '@/types';
import { gerarId } from '@/lib/utils';

function safeLocalStorage(): Storage | null {
  if (typeof window === 'undefined') return null;
  try {
    const _ = window.localStorage;
    if (!_) return null;
    // teste rápido se é acessível (modo privado as vezes bloqueia)
    const k = '__ml_test__';
    window.localStorage.setItem(k, '1');
    window.localStorage.removeItem(k);
    return window.localStorage;
  } catch {
    return null;
  }
}

type SpreadsheetState = {
  planilha: PlanilhaImportada | null;
  mapeamento: MapeamentoColunas;
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
      storage: createJSONStorage(() => safeLocalStorage() ?? new Map<string, unknown>() as unknown as Storage),
      partialize: (s) => ({ planilha: s.planilha, mapeamento: s.mapeamento }),
      skipHydration: true,
      onRehydrateStorage: () => {
        // reidrata assim que o store for usado pela 1a vez no browser
        return (_state, version) => {
          try {
            // usa o hidratador nativo do zustand após reidratar
            if (version !== undefined) void 0;
          } catch {
            /* noop */
          }
        };
      },
    },
  ),
);

// Dispara reidratação segura somente após componente montar (hydration)
if (typeof window !== 'undefined') {
  Promise.resolve().then(() => {
    try {
      void useSpreadsheetStore.persist.rehydrate?.();
    } catch {
      /* noop */
    }
  });
}
