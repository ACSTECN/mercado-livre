import * as XLSX from 'xlsx';
import type { MapeamentoColunas, RegistroPlanilha } from '@/types';
import { normalizarEndereco } from '../address/AddressNormalizer';
import { gerarId, hashArquivo } from '@/lib/utils';

export type PlanilhaPreview = {
  arquivo: File;
  hash: string;
  cabecalhos: string[];
  amostra: Record<string, string>[];
  totalLinhas: number;
};

export async function lerPlanilha(file: File): Promise<PlanilhaPreview> {
  if (!file) throw new Error('Arquivo inválido');
  const ext = file.name.split('.').pop()?.toLowerCase();
  if (!ext || !['xlsx', 'xls', 'csv'].includes(ext)) {
    throw new Error('Formato não suportado. Use .xlsx, .xls ou .csv');
  }

  const [buffer, hash] = await Promise.all([file.arrayBuffer(), hashArquivo(file)]);
  const wb = XLSX.read(buffer, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  if (!ws) throw new Error('Planilha vazia');

  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });

  if (!json.length) throw new Error('A planilha não possui dados');

  const cabecalhos = Object.keys(json[0]).filter((c) => String(c).trim() !== '');
  if (!cabecalhos.length) throw new Error('Não foi possível identificar cabeçalhos');

  const amostra = json.slice(0, 5).map((linha) => {
    const out: Record<string, string> = {};
    for (const h of cabecalhos) out[h] = String(linha[h] ?? '').trim();
    return out;
  });

  return {
    arquivo: file,
    hash,
    cabecalhos,
    amostra,
    totalLinhas: json.length,
  };
}

export function processarRegistros(
  preview: PlanilhaPreview,
  mapeamento: MapeamentoColunas,
): RegistroPlanilha[] {
  return processarRegistrosFromFile(preview.arquivo, mapeamento);
}

function processarRegistrosFromFile(
  file: File,
  mapeamento: MapeamentoColunas,
): RegistroPlanilha[] {
  const wb = XLSX.read(file, { type: 'file' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });

  const saida: RegistroPlanilha[] = [];
  const vistos = new Set<string>();

  for (const linha of json) {
    const get = (campo: keyof MapeamentoColunas) => {
      const col = mapeamento[campo];
      return col ? String(linha[col] ?? '').trim() : '';
    };

    let logradouro = '';
    let numero = '';
    let complemento = '';
    let bairro = '';
    let cidade = '';
    let estado = '';
    let cep = '';
    let enderecoCompleto = '';

    if (mapeamento.enderecoCompleto) {
      enderecoCompleto = get('enderecoCompleto');
      const partes = enderecoCompleto.split(/[,;\-–]/).map((p) => p.trim());
      if (partes[0]) {
        const mRua = partes[0].match(/^(.+?)(?:\s+)(\d+.*)?$/);
        if (mRua) {
          logradouro = mRua[1].trim();
          if (mRua[2]) numero = mRua[2].trim();
        } else {
          logradouro = partes[0];
        }
      }
      if (partes[1] && !numero) {
        const mn = partes[1].match(/\d+/);
        if (mn) numero = mn[0];
        else complemento = partes[1];
      }
      if (partes[2]) {
        if (!bairro) bairro = partes[2];
        else if (!cidade) cidade = partes[2];
      }
      const mCep = enderecoCompleto.match(/\d{5}[-\s]?\d{3}/);
      if (mCep) cep = mCep[0];
    }

    if (mapeamento.logradouro) logradouro = get('logradouro') || logradouro;
    if (mapeamento.numero) numero = get('numero') || numero;
    if (mapeamento.complemento) complemento = get('complemento') || complemento;
    if (mapeamento.bairro) bairro = get('bairro') || bairro;
    if (mapeamento.cidade) cidade = get('cidade') || cidade;
    if (mapeamento.estado) estado = get('estado') || estado;
    if (mapeamento.cep) cep = get('cep') || cep;

    const codigo = get('codigo');
    if (!codigo) continue;

    const r: RegistroPlanilha = {
      id: gerarId(),
      codigo,
      logradouro,
      numero,
      complemento,
      bairro,
      cidade,
      estado,
      cep,
      enderecoCompleto,
      linhaOriginal: linha as Record<string, unknown>,
    };
    r.normalizado = normalizarEndereco(r);

    const chave = `${r.normalizado.logradouro}|${r.normalizado.numero}|${r.normalizado.cep}|${r.codigo}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);

    saida.push(r);
  }

  return saida;
}

export async function importarPlanilha(
  preview: PlanilhaPreview,
  mapeamento: MapeamentoColunas,
): Promise<RegistroPlanilha[]> {
  const colCodigo = mapeamento.codigo;
  if (!colCodigo) throw new Error('Selecione a coluna do código/número');
  const temEndereco =
    mapeamento.enderecoCompleto ||
    (mapeamento.logradouro && (mapeamento.numero || mapeamento.cep));
  if (!temEndereco) {
    throw new Error(
      'Selecione a coluna do endereço completo, ou então logradouro + número/CEP',
    );
  }

  return processarRegistrosFromFile(preview.arquivo, mapeamento);
}

export async function exportarParaCsv(linhas: Record<string, unknown>[], nomeArquivo: string) {
  if (!linhas.length) return;
  const ws = XLSX.utils.json_to_sheet(linhas);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Dados');
  XLSX.writeFile(wb, nomeArquivo);
}
