import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { MapeamentoColunas, PlanilhaImportada, RegistroPlanilha } from '@/types';
import { gerarId } from '@/lib/utils';

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
      storage: createJSONStorage(() => localStorage),
      partialize: (s) => ({ planilha: s.planilha, mapeamento: s.mapeamento }),
    },
  ),
);
