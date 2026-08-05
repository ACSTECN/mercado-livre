import type { EnderecoEstruturado } from '@/types';

const MAPEAMENTO_ACENTOS: Record<string, string> = {
  Á: 'A', À: 'A', Ã: 'A', Â: 'A', Ä: 'A',
  É: 'E', È: 'E', Ê: 'E', Ë: 'E',
  Í: 'I', Ì: 'I', Î: 'I', Ï: 'I',
  Ó: 'O', Ò: 'O', Ô: 'O', Õ: 'O', Ö: 'O',
  Ú: 'U', Ù: 'U', Û: 'U', Ü: 'U',
  Ç: 'C', 'Ñ': 'N',
};

const MAP_ABREVIACOES: Array<[RegExp, string]> = [
  [/(^|\s)R\.?\s+/gi, '$1RUA '],
  [/(^|\s)AV\.?\s+/gi, '$1AVENIDA '],
  [/(^|\s)AVEN\.?\s+/gi, '$1AVENIDA '],
  [/(^|\s)AL\.?\s+/gi, '$1ALAMEDA '],
  [/(^|\s)ROD\.?\s+/gi, '$1RODOVIA '],
  [/(^|\s)P[ÇC]A\.?\s+/gi, '$1PRACA '],
  [/(^|\s)TRAV\.?\s+/gi, '$1TRAVESSA '],
  [/(^|\s)TV\.?\s+/gi, '$1TRAVESSA '],
  [/(^|\s)EST\.?\s+/gi, '$1ESTRADA '],
  [/(^|\s)JD\.?\s+/gi, '$1JARDIM '],
  [/(^|\s)VL\.?\s+/gi, '$1VILA '],
  [/(^|\s)PQ\.?\s+/gi, '$1PARQUE '],
  [/(^|\s)BL\.?\s+/gi, '$1BLOCO '],
  [/(^|\s)QD\.?\s+/gi, '$1QUADRA '],
  [/(^|\s)Q\.?\s+/gi, '$1QUADRA '],
  [/(^|\s)LT\.?\s+/gi, '$1LOTE '],
  [/(^|\s)AP\.?\s+/gi, '$1APTO '],
  [/(^|\s)APTO\.?\s+/gi, '$1APTO '],
  [/(^|\s)CONJ\.?\s+/gi, '$1CONJUNTO '],
  [/(^|\s)N[°º]\.?\s*/gi, '$1'],
  [/(^|\s)NUM\.?\s+/gi, '$1'],
];

function removerAcentos(texto: string): string {
  return texto.replace(/[À-ÙÇÑ]/g, (ch) => MAPEAMENTO_ACENTOS[ch] ?? ch);
}

function expandirAbreviacoes(texto: string): string {
  let saida = texto;
  for (const [re, sub] of MAP_ABREVIACOES) {
    saida = saida.replace(re, sub);
  }
  return saida;
}

function removerPontuacao(texto: string): string {
  return texto
    .replace(/[.,;:!?"'()\[\]{}°ºª]/g, ' ')
    .replace(/[-_/\\]/g, ' ');
}

function removerEspacos(texto: string): string {
  return texto.replace(/\s+/g, ' ').trim();
}

export function normalizarString(texto: string | null | undefined): string {
  if (!texto) return '';
  let t = String(texto).toUpperCase();
  t = removerAcentos(t);
  t = expandirAbreviacoes(t);
  t = removerPontuacao(t);
  t = removerEspacos(t);
  return t;
}

export function normalizarCep(cep: string | null | undefined): string {
  if (!cep) return '';
  return String(cep).replace(/\D/g, '').slice(0, 8);
}

export function normalizarNumero(numero: string | null | undefined): string {
  if (!numero) return '';
  const n = String(numero).toUpperCase().trim();
  const match = n.match(/\d+/);
  if (match) return match[0];
  return n.replace(/\s+/g, '');
}

export function normalizarEstado(uf: string | null | undefined): string {
  if (!uf) return '';
  return removerAcentos(String(uf).toUpperCase().trim()).slice(0, 2);
}

export function normalizarEndereco(end: Partial<EnderecoEstruturado>): EnderecoEstruturado {
  return {
    logradouro: normalizarString(end.logradouro),
    numero: normalizarNumero(end.numero),
    complemento: normalizarString(end.complemento),
    bairro: normalizarString(end.bairro),
    cidade: normalizarString(end.cidade),
    estado: normalizarEstado(end.estado),
    cep: normalizarCep(end.cep),
  };
}

export function construirEnderecoParaComparacao(end: Partial<EnderecoEstruturado>): string {
  const partes = [
    normalizarString(end.logradouro),
    normalizarNumero(end.numero),
    normalizarString(end.bairro),
    normalizarString(end.cidade),
    normalizarEstado(end.estado),
    normalizarCep(end.cep),
  ].filter(Boolean);
  return partes.join(' ');
}

export function extrairNumeros(texto: string): string[] {
  return (texto.match(/\d+/g) ?? []);
}
