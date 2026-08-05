import * as XLSX from 'xlsx';
import type { MapeamentoColunas, RegistroPlanilha } from '@/types';
import { normalizarEndereco } from '../address/AddressNormalizer';
import { gerarId, hashArquivo } from '@/lib/utils';
import { REGEX_PREFIXOS_LOGRADOURO } from '@/lib/regex';

type LinhaRaw = Record<string, unknown>;

export type PlanilhaPreview = {
  arquivoNome: string;
  arquivoTamanho: number;
  hash: string;
  cabecalhos: string[];
  amostra: Record<string, string>[];
  totalLinhas: number;
  linhasJson: LinhaRaw[];
};

const REGEX_RUIDO_LINHAS = /(unidades|und|qtd|quantidade|total|assinatura|observacao|obs)/i;

function extrairValor(linha: Record<string, unknown>, col?: string): string {
  if (!col) return '';
  return String(linha[col] ?? '').trim();
}

function linhaPareceEnderecoValor(valor: string): boolean {
  if (!valor) return false;
  if (REGEX_RUIDO_LINHAS.test(valor)) return false;
  if (valor.length < 8) return false;
  if (REGEX_PREFIXOS_LOGRADOURO.test(valor)) return true;
  if (/\d{3,}/.test(valor) && /[,.;\-–]\s*\d+/.test(valor)) return true;
  return false;
}

function linhaPareceCodigoValor(valor: string): boolean {
  if (!valor) return false;
  return /^\s*\d{1,8}\s*$/.test(valor);
}

function montarParesEnderecoCodigo(
  linhas: LinhaRaw[],
  colEndereco: string,
  colCodigo: string,
): Array<{ endereco: LinhaRaw; codigo: LinhaRaw; idxEndereco: number; idxCodigo: number }> {
  const pares: Array<{
    endereco: LinhaRaw;
    codigo: LinhaRaw;
    idxEndereco: number;
    idxCodigo: number;
  }> = [];

  for (let i = 0; i < linhas.length; i++) {
    const linha = linhas[i];
    const valEndereco = extrairValor(linha, colEndereco);
    const valCodigoMesmaLinha = extrairValor(linha, colCodigo);
    const temEnderecoValido = linhaPareceEnderecoValor(valEndereco);
    if (!temEnderecoValido) continue;

    let codigoFinal: string = valCodigoMesmaLinha;
    let idxCodigo = i;

    if (!linhaPareceCodigoValor(codigoFinal)) {
      // 1. Tentar linha ACIMA na coluna do CÓDIGO (col B nº acima de endereço na col A)
      if (i - 1 >= 0) {
        const acimaB = extrairValor(linhas[i - 1], colCodigo);
        if (linhaPareceCodigoValor(acimaB)) {
          codigoFinal = acimaB;
          idxCodigo = i - 1;
        } else {
          // 2. Tentar linha ACIMA na coluna ENDEREÇO (caso o nº tenha caído na col A da linha de cima)
          const acimaA = extrairValor(linhas[i - 1], colEndereco);
          if (linhaPareceCodigoValor(acimaA)) {
            codigoFinal = acimaA;
            idxCodigo = i - 1;
          }
        }
      }
      // 3. Tentar 2 linhas acima
      if (!linhaPareceCodigoValor(codigoFinal) && i - 2 >= 0) {
        const d = extrairValor(linhas[i - 2], colCodigo);
        if (linhaPareceCodigoValor(d)) {
          codigoFinal = d;
          idxCodigo = i - 2;
        } else {
          const d2 = extrairValor(linhas[i - 2], colEndereco);
          if (linhaPareceCodigoValor(d2)) {
            codigoFinal = d2;
            idxCodigo = i - 2;
          }
        }
      }
    }

    if (!linhaPareceCodigoValor(codigoFinal)) continue;

    const virtualEndereco: LinhaRaw = { ...linha };
    virtualEndereco[colCodigo] = codigoFinal;

    pares.push({
      endereco: virtualEndereco,
      codigo: linhas[idxCodigo] ?? linha,
      idxEndereco: i,
      idxCodigo,
    });
  }

  return pares;
}

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

  const linhasJson = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });

  if (!linhasJson.length) throw new Error('A planilha não possui dados');

  const cabecalhos = Object.keys(linhasJson[0]).filter((c) => String(c).trim() !== '');
  if (!cabecalhos.length) throw new Error('Não foi possível identificar cabeçalhos');

  // Chute inicial para colunas (mesmo que usuário mude depois, só para amostra)
  const colEnderecoGuess =
    cabecalhos.find((c) => /endere|rua|av|lograd|cidade|bairro|cep|local/i.test(c)) ??
    cabecalhos[0];
  const colCodigoGuess =
    cabecalhos.find((c) => /posi[çc][aã]o|nume|cod|id|rota|ordem|seq/i.test(c)) ??
    (cabecalhos[1] ?? cabecalhos[0]);

  const pares = montarParesEnderecoCodigo(linhasJson, colEnderecoGuess, colCodigoGuess);
  const amostraRaw = pares.slice(0, 5);
  const amostra: Record<string, string>[] = amostraRaw.length
    ? amostraRaw.map((p) => {
        const out: Record<string, string> = {};
        for (const h of cabecalhos) {
          const vEnd = extrairValor(p.endereco, h);
          const vCod = extrairValor(p.codigo, h);
          out[h] = vEnd || vCod;
        }
        return out;
      })
    : linhasJson.slice(0, 5).map((linha) => {
        const out: Record<string, string> = {};
        for (const h of cabecalhos) out[h] = String(linha[h] ?? '').trim();
        return out;
      });

  return {
    arquivoNome: file.name,
    arquivoTamanho: file.size,
    hash,
    cabecalhos,
    amostra,
    totalLinhas: pares.length || linhasJson.length,
    linhasJson, // ← CHAVE: NÃO precisamos reabrir o File nunca mais!
  };
}

function processarLinhasJson(
  json: LinhaRaw[],
  mapeamento: MapeamentoColunas,
): RegistroPlanilha[] {
  const colEndereco = mapeamento.enderecoCompleto ?? '';
  const colCodigo = mapeamento.codigo ?? '';

  const saida: RegistroPlanilha[] = [];
  const vistos = new Set<string>();

  if (colEndereco && colCodigo) {
    const pares = montarParesEnderecoCodigo(json, colEndereco, colCodigo);

    for (const par of pares) {
      const linha = par.endereco;
      const get = (campo: keyof MapeamentoColunas) => {
        const col = mapeamento[campo];
        if (!col) return '';
        let v = extrairValor(linha, col);
        if (!v) v = extrairValor(par.codigo, col);
        return v;
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
      if (!logradouro && !enderecoCompleto) continue;

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
        linhaOriginal: {
          endereco: par.idxEndereco,
          codigo: par.idxCodigo,
          dados: linha,
        },
      };
      r.normalizado = normalizarEndereco(r);

      const chave = `${r.normalizado.logradouro}|${r.normalizado.numero}|${r.normalizado.cep}|${r.codigo}`;
      if (vistos.has(chave)) continue;
      vistos.add(chave);

      saida.push(r);
    }

    return saida;
  }

  // Fallback: sem endereçoCompleto ou sem codigo (raro)
  for (const linha of json) {
    const get = (campo: keyof MapeamentoColunas) => {
      const col = mapeamento[campo];
      return col ? String(linha[col] ?? '').trim() : '';
    };

    const logradouro = get('logradouro');
    const numero = get('numero');
    const complemento = get('complemento');
    const bairro = get('bairro');
    const cidade = get('cidade');
    const estado = get('estado');
    const cep = get('cep');
    const codigo = get('codigo');

    if (!codigo) continue;
    if (!logradouro) continue;

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
      enderecoCompleto: [
        [logradouro, numero].filter((x): x is string => Boolean(x)).join(', '),
        bairro,
        cidade,
        estado,
        cep,
      ]
        .filter((x): x is string => Boolean(x))
        .join(' - '),
      linhaOriginal: { endereco: -1, codigo: -1, dados: linha },
    };
    r.normalizado = normalizarEndereco(r);
    saida.push(r);
  }

  return saida;
}

export function processarRegistros(
  preview: PlanilhaPreview,
  mapeamento: MapeamentoColunas,
): RegistroPlanilha[] {
  // ✅ USA O JSON JÁ PARSEADO NA FASE DE PREVIEW — NUNCA MAIS TOCA NO FILE!
  // Resolve "Cannot access file [object File]" para SEMPRE.
  if (!preview.linhasJson || !preview.linhasJson.length) {
    try {
      // fallback impossível (preview já tem que ter salvo)
      return [];
    } catch {
      return [];
    }
  }
  return processarLinhasJson(preview.linhasJson, mapeamento);
}

export function exportarParaCsv(
  registros: RegistroPlanilha[] | Array<Record<string, unknown>>,
  nomeArquivoSugestao?: string,
): string {
  const nomeArquivo = nomeArquivoSugestao ?? `enderecos_${Date.now()}.csv`;
  if (!registros || !registros.length) {
    // cria arquivo vazio para não crashar a UI
    const vazios = '\uFEFF';
    // salvamos arquivo se possível
    if (typeof window !== 'undefined') {
      try {
        const blob = new Blob([vazios], { type: 'text/csv;charset=utf-8;' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = nomeArquivo;
        a.click();
        window.URL.revokeObjectURL(url);
      } catch {
        /* noop */
      }
    }
    return vazios;
  }
  // Inferindo cabeçalhos dos campos da PRIMEIRA linha
  const cabecalhos = Object.keys(registros[0]);
  const escapar = (v: unknown) => {
    if (v === undefined || v === null) return '';
    const s = String(v).replace(/"/g, '""');
    return /[;"\n]/.test(s) ? `"${s}"` : s;
  };
  const linhasCsv: string[] = [cabecalhos.join(';')];
  for (const r of registros) {
    const row = r as Record<string, unknown>;
    linhasCsv.push(cabecalhos.map((h) => escapar(row[h])).join(';'));
  }
  const csvContent = '\uFEFF' + linhasCsv.join('\n');

  // Faz download automático se estiver no browser
  if (typeof window !== 'undefined') {
    try {
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = nomeArquivo;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch {
      /* noop */
    }
  }
  return csvContent;
}
