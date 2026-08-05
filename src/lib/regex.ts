export const REGEX_CEP = /\b\d{5}[-\s]?\d{3}\b/g;
export const REGEX_CEP_LIMPO = /\b\d{8}\b/;

export const REGEX_ESTADO = /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/;

export const REGEX_NUMERO_IMOVEL = /(?:n[°º]?\.?\s*|número\s+|n:\s*)?(\d{1,6})(?:\s*[,-]|$)/i;

export const REGEX_PREFIXOS_LOGRADOURO =
  /^(\b(?:RUA|RUAS|R|AVENIDA|AV|AVEN|ALAMEDA|AL|RODOVIA|ROD|PRACA|P[ÇC]A|TRAVESSA|TRAV|TV|ESTRADA|EST|VIA|BL|BLOCO|Q|QUADRA|QD|LOTE|LT)\b\.?)\s+/i;

export const REGEX_COMPLEMENTO =
  /\b(?:AP(?:TO)?\.?\s*\d+|CASA\s+\d+|CONJ\.?\s*\d+|BL(?:OCO)?\.?\s*\w+|SALA\s*\d+|ANDAR\s+\d+|FUNDOS|COBERTURA|SOBRADO|LOJA\s*\d+)\b/i;

export const REGEX_BAIRRO_INDICADORES = /\b(?:BAIRRO|JD\.?|JARDIM|JARDINS|VILA|VL\.?|CENTRO|CENTRO[A-Z]|PARQUE|PQ\.?)\b/i;

export const REGEX_LIMPEZA_OCR = [
  /\b(?:Código de rastreamento|Rastreio|Pedido|NF[eE]?[:\s-]*|Nota Fiscal|Remetente|Destinatário|Transportadora|Peso|Dimensões|Volume|Vol\.?)\b.*$/gim,
  /(?:https?:\/\/|www\.)\S+/gi,
  /\b(?:Mercado Livre|MercadoLivre|MLB)\b/gi,
  /^[A-Z]{2,4}\d+$/gm,
  /\b(?:Pack ID|Despachar|XSP\d|SSP\d|R\d|S\/Z|QUI|SEG|TER|QUA|SEX|SAB|DOM)\b.*$/gim,
];

export const CIDADES_COMUNS = [
  'SÃO PAULO',
  'RIO DE JANEIRO',
  'BELO HORIZONTE',
  'PORTO ALEGRE',
  'CURITIBA',
  'RECIFE',
  'SALVADOR',
  'BRASÍLIA',
  'FORTALEZA',
  'MANAUS',
  'GOIÂNIA',
  'BELÉM',
  'SÃO LUÍS',
  'MACEIÓ',
  'NATAL',
  'JOÃO PESSOA',
  'TERESINA',
  'CUIABÁ',
  'CAMPO GRANDE',
  'FLORIANÓPOLIS',
  'VITÓRIA',
  'ARACAJU',
  'PALMAS',
  'MACAPÁ',
  'PORTO VELHO',
  'RIO BRANCO',
  'BOA VISTA',
  'TABATINGA',
  'SÃO JOSÉ DOS CAMPOS',
  'CAMPINAS',
  'SOROCABA',
  'RIBEIRÃO PRETO',
  'SÃO BERNARDO DO CAMPO',
  'SANTO ANDRÉ',
  'SÃO CAETANO DO SUL',
  'DIADEMA',
  'OSASCO',
  'GUARULHOS',
  'SUMARÉ',
  'HORTOLÂNDIA',
  'CAMPOS DO JORDÃO',
  'UBERLÂNDIA',
  'UBERABA',
  'JUIZ DE FORA',
  'NOVA IGUAÇU',
  'NITERÓI',
  'DUQUE DE CAXIAS',
  'BELFORD ROXO',
  'SÃO GONÇALO',
];
