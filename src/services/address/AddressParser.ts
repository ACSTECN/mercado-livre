import type { EnderecoEstruturado } from '@/types';
import {
  REGEX_BAIRRO_INDICADORES,
  REGEX_COMPLEMENTO,
  REGEX_CEP,
  REGEX_ESTADO,
  REGEX_LIMPEZA_OCR,
  REGEX_NUMERO_IMOVEL,
  REGEX_PREFIXOS_LOGRADOURO,
  CIDADES_COMUNS,
} from '@/lib/regex';
import {
  normalizarCep,
  normalizarEstado,
  normalizarNumero,
  normalizarString,
} from './AddressNormalizer';

export type ParseResult = {
  endereco: EnderecoEstruturado;
  textoLimpo: string;
};

function limparRuidoOcr(texto: string): string {
  let t = texto;
  for (const rx of REGEX_LIMPEZA_OCR) t = t.replace(rx, ' ');
  t = t.replace(/\s*\n\s*/g, '\n').replace(/[ \t]+/g, ' ');
  t = t.replace(/\n{2,}/g, '\n');
  return t.trim();
}

function extrairCep(texto: string, saida: EnderecoEstruturado): string {
  const matches = texto.match(REGEX_CEP);
  if (matches?.length) {
    saida.cep = normalizarCep(matches[matches.length - 1]);
    return texto.replace(REGEX_CEP, ' ');
  }
  const limpo = texto.match(/\d{8}/);
  if (limpo) {
    saida.cep = limpo[0];
    return texto.replace(/\d{8}/, ' ');
  }
  return texto;
}

function extrairEstado(texto: string, saida: EnderecoEstruturado): string {
  const reg = new RegExp(/[-\s,/–]\s*([A-Z]{2})\b/gi);
  const matches = [...texto.matchAll(reg)].map((m) => m[1].toUpperCase());
  const estadosValidos = matches.filter((uf) => REGEX_ESTADO.test(uf));
  if (estadosValidos.length) {
    saida.estado = normalizarEstado(estadosValidos[estadosValidos.length - 1]);
  }
  return texto;
}

function extrairCidade(texto: string, estado: string, saida: EnderecoEstruturado): void {
  const linhas = texto.split(/\n|[,.\-–]/g).map((l) => l.trim()).filter(Boolean);
  for (const linha of linhas) {
    const n = normalizarString(linha);
    for (const cidade of CIDADES_COMUNS) {
      if (n.includes(cidade)) {
        saida.cidade = cidade;
        return;
      }
    }
  }
  const regex = new RegExp(
    `([A-ZÀ-Ù][A-ZÀ-Ù\\s]{3,40})\\s*[-–]\\s*${estado || '[A-Z]{2}'}`,
    'i',
  );
  const m = texto.match(regex);
  if (m) {
    saida.cidade = normalizarString(m[1]);
  }
}

function extrairComplemento(texto: string, saida: EnderecoEstruturado): string {
  const m = texto.match(REGEX_COMPLEMENTO);
  if (m) {
    saida.complemento = normalizarString(m[0]);
    return texto.replace(REGEX_COMPLEMENTO, ' ');
  }
  return texto;
}

function extrairBairro(texto: string, saida: EnderecoEstruturado, cidadeExtraida: string): string {
  const linhas = texto.split(/\n|[,.\-–]/g).map((l) => l.trim()).filter(Boolean);
  for (const linha of linhas) {
    const n = normalizarString(linha);
    if (!n) continue;
    if (REGEX_BAIRRO_INDICADORES.test(n)) {
      saida.bairro = n;
      return texto.replace(linha, ' ');
    }
    if (
      n.length >= 3 &&
      n.length <= 50 &&
      !REGEX_PREFIXOS_LOGRADOURO.test(n) &&
      !/\d{2,}/.test(n) &&
      n !== normalizarString(cidadeExtraida) &&
      n !== normalizarString(saida.cidade)
    ) {
      if (!saida.bairro) {
        saida.bairro = n;
      }
    }
  }
  return texto;
}

function extrairNumeroELogradouro(texto: string, saida: EnderecoEstruturado): void {
  const linhas = texto
    .split(/\n+/)
    .map((l) => normalizarString(l))
    .filter((l) => l.length >= 3);

  for (const linha of linhas) {
    if (!REGEX_PREFIXOS_LOGRADOURO.test(linha)) continue;
    const semPre = linha.replace(REGEX_PREFIXOS_LOGRADOURO, (m) => m.toUpperCase());
    const numeros = semPre.match(/\d+/g) ?? [];
    let numero = '';
    let soNumeros = semPre;
    if (numeros.length) {
      numero = numeros[0]!;
      soNumeros = semPre.replace(numero, ' ');
    } else {
      const m = semPre.match(REGEX_NUMERO_IMOVEL);
      if (m?.[1]) {
        numero = m[1];
        soNumeros = semPre.replace(m[0], ' ');
      }
    }
    const logradouro = soNumeros.replace(/\s+/g, ' ').trim();
    if (!saida.logradouro && logradouro) {
      saida.logradouro = logradouro;
      if (numero) saida.numero = normalizarNumero(numero);
      return;
    }
  }

  if (!saida.logradouro) {
    for (const linha of linhas) {
      if (linha.length >= 8 && /\d/.test(linha)) {
        const numeros = linha.match(/\d+/g) ?? [];
        if (numeros.length) {
          const primeiro = numeros[0]!;
          const idx = linha.indexOf(primeiro);
          saida.logradouro = linha.slice(0, idx).trim() || linha;
          saida.numero = normalizarNumero(primeiro);
          return;
        }
        saida.logradouro = linha;
        return;
      }
    }
    if (linhas[0]) saida.logradouro = linhas[0];
  }
}

export function parsearEnderecoOcr(textoBruto: string): ParseResult {
  const saida: EnderecoEstruturado = {
    logradouro: '',
    numero: '',
    complemento: '',
    bairro: '',
    cidade: '',
    estado: '',
    cep: '',
  };

  const textoLimpo = limparRuidoOcr(textoBruto);
  let working = textoLimpo.toUpperCase();

  working = extrairCep(working, saida);
  extrairEstado(working, saida);
  extrairCidade(working, saida.estado, saida);
  working = extrairComplemento(working, saida);
  working = extrairBairro(working, saida, saida.cidade);
  extrairNumeroELogradouro(working, saida);

  return {
    endereco: saida,
    textoLimpo,
  };
}

export function validarEnderecoParseado(end: EnderecoEstruturado): {
  valido: boolean;
  camposFaltando: string[];
} {
  const campos: Array<keyof EnderecoEstruturado> = ['logradouro'];
  const faltando: string[] = [];
  for (const c of campos) {
    if (!end[c]) faltando.push(c);
  }
  if (!end.numero && !end.cep) faltando.push('numero ou cep');
  return { valido: faltando.length === 0, camposFaltando: faltando };
}
