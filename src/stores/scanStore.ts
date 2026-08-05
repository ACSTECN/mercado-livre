import { create } from 'zustand';
import type { EnderecoEstruturado, OcrProgresso, ResultadoMatch, StatusConsulta } from '@/types';

type ScanState = {
  imagem: string | null;
  arquivoImagem: File | null;
  ocrTexto: string;
  ocrProgresso: OcrProgresso | null;
  endereco: EnderecoEstruturado;
  resultados: ResultadoMatch[];
  status: StatusConsulta | null;

  setImagem: (dataUrl: string | null, file?: File | null) => void;
  setOcrProgresso: (p: OcrProgresso | null) => void;
  setOcrTexto: (t: string) => void;
  setEndereco: (e: EnderecoEstruturado) => void;
  patchEndereco: (campos: Partial<EnderecoEstruturado>) => void;
  setResultados: (r: ResultadoMatch[], s: StatusConsulta) => void;
  setStatus: (s: StatusConsulta) => void;
  reset: () => void;
};

const ENDERECO_VAZIO: EnderecoEstruturado = {
  logradouro: '',
  numero: '',
  complemento: '',
  bairro: '',
  cidade: '',
  estado: '',
  cep: '',
};

export const useScanStore = create<ScanState>((set) => ({
  imagem: null,
  arquivoImagem: null,
  ocrTexto: '',
  ocrProgresso: null,
  endereco: ENDERECO_VAZIO,
  resultados: [],
  status: null,

  setImagem: (dataUrl, file) =>
    set({
      imagem: dataUrl,
      arquivoImagem: file ?? null,
    }),
  setOcrProgresso: (p) => set({ ocrProgresso: p }),
  setOcrTexto: (t) => set({ ocrTexto: t }),
  setEndereco: (e) => set({ endereco: e }),
  patchEndereco: (campos) =>
    set((s) => ({ endereco: { ...s.endereco, ...campos } })),
  setResultados: (r, s) => set({ resultados: r, status: s }),
  setStatus: (s) => set({ status: s }),
  reset: () =>
    set({
      imagem: null,
      arquivoImagem: null,
      ocrTexto: '',
      ocrProgresso: null,
      endereco: ENDERECO_VAZIO,
      resultados: [],
      status: null,
    }),
}));
