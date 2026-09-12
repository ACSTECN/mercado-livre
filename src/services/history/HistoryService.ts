import type { HistoricoConsulta } from '@/types';
import { gerarId } from '@/lib/utils';
import { exportarParaXlsx } from '../spreadsheet/ExcelService';

const CHAVE_STORAGE = 'ml_historico_consultas_v1';
const MAXIMO = 500;

function todos(): HistoricoConsulta[] {
  try {
    const raw = localStorage.getItem(CHAVE_STORAGE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as HistoricoConsulta[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function salvar(lista: HistoricoConsulta[]) {
  const limitado = lista.slice(0, MAXIMO);
  localStorage.setItem(CHAVE_STORAGE, JSON.stringify(limitado));
}

export const HistoryService = {
  listar(): HistoricoConsulta[] {
    return todos().sort((a, b) => b.dataHora - a.dataHora);
  },

  adicionar(entry: Omit<HistoricoConsulta, 'id' | 'dataHora'> & { id?: string; dataHora?: number }): HistoricoConsulta {
    const lista = todos();
    const novo: HistoricoConsulta = {
      id: entry.id ?? gerarId(),
      dataHora: entry.dataHora ?? Date.now(),
      textoOcr: entry.textoOcr,
      enderecoEstruturado: entry.enderecoEstruturado,
      codigoEncontrado: entry.codigoEncontrado,
      confianca: entry.confianca,
      status: entry.status,
      multiplosResultados: entry.multiplosResultados,
      usuario: entry.usuario,
      imagemPreview: entry.imagemPreview,
    };
    lista.unshift(novo);
    salvar(lista);
    return novo;
  },

  limpar(): void {
    localStorage.removeItem(CHAVE_STORAGE);
  },

  remover(id: string): void {
    const lista = todos().filter((h) => h.id !== id);
    salvar(lista);
  },

  async exportarCsv(): Promise<void> {
    const itens = HistoryService.listar();
    const linhas = itens.map((h) => ({
      Data: new Date(h.dataHora).toLocaleString('pt-BR'),
      Status: h.status,
      Codigo: h.codigoEncontrado ?? '',
      Confianca: h.confianca != null ? `${h.confianca}%` : '',
      TextoOCR: h.textoOcr,
      Logradouro: h.enderecoEstruturado?.logradouro ?? '',
      Numero: h.enderecoEstruturado?.numero ?? '',
      Bairro: h.enderecoEstruturado?.bairro ?? '',
      Cidade: h.enderecoEstruturado?.cidade ?? '',
      Estado: h.enderecoEstruturado?.estado ?? '',
      CEP: h.enderecoEstruturado?.cep ?? '',
      Usuario: h.usuario ?? '',
    }));
    exportarParaXlsx(linhas, `historico_consultas_${Date.now()}.xlsx`, 'Historico');
  },
};
