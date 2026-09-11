export type EnderecoEstruturado = {
  logradouro: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
  cep: string;
};

export type EnderecoCompleto = EnderecoEstruturado & {
  enderecoCompleto?: string;
};

export type RegistroPlanilha = EnderecoEstruturado & {
  id?: string;
  codigo: string;
  enderecoCompleto?: string;
  linhaOriginal?: Record<string, unknown>;
  normalizado?: EnderecoEstruturado;
};

export type ColunaPlanilha =
  | 'codigo'
  | 'enderecoCompleto'
  | 'logradouro'
  | 'numero'
  | 'complemento'
  | 'bairro'
  | 'cidade'
  | 'estado'
  | 'cep';

export type MapeamentoColunas = Partial<Record<ColunaPlanilha, string>>;

export type PlanilhaImportada = {
  id: string;
  nomeArquivo: string;
  hashArquivo: string;
  totalRegistros: number;
  cabecalhos: string[];
  mapeamento: MapeamentoColunas;
  registros: RegistroPlanilha[];
  importadaEm: number;
};

export type StatusConsulta =
  | 'ENDERECO_ENCONTRADO'
  | 'ENDERECO_BAIXA_CONFIANCA'
  | 'MULTIPLOS_ENCONTRADOS'
  | 'ENDERECO_NAO_ENCONTRADO'
  | 'IMAGEM_SEM_QUALIDADE'
  | 'ENDERECO_NAO_IDENTIFICADO'
  | 'PLANILHA_NAO_IMPORTADA';

export type ResultadoMatch = {
  registro: RegistroPlanilha;
  score: number;
  scoreDetalhado: {
    cep: number;
    numero: number;
    logradouro: number;
    bairro: number;
    cidadeEstado: number;
  };
};

export type OcrProgresso = {
  status: 'carregando' | 'inicializando' | 'processando' | 'concluido' | 'erro';
  progresso: number;
  mensagem?: string;
};

export type OcrResultado = {
  texto: string;
  confiancaMedia: number;
};

export interface OcrService {
  extrairTexto(
    imagem: File | string,
    onProgress?: (p: OcrProgresso) => void,
  ): Promise<OcrResultado>;
}

export type HistoricoConsulta = {
  id: string;
  dataHora: number;
  textoOcr: string;
  enderecoEstruturado: EnderecoEstruturado | null;
  codigoEncontrado: string | null;
  confianca: number | null;
  status: StatusConsulta;
  multiplosResultados?: Array<{ codigo: string; score: number; endereco: string }>;
  usuario?: string;
  imagemPreview?: string;
};

export type PesosMatch = {
  cep: number;
  numero: number;
  logradouro: number;
  bairro: number;
  cidadeEstado: number;
};

export const PESOS_DEFAULT: PesosMatch = {
  cep: 0.35,
  numero: 0.30,
  logradouro: 0.25,
  bairro: 0.05,
  cidadeEstado: 0.05,
};

export const LIMIAR_ALTA_CONFIANCA = 85;
export const LIMIAR_BAIXA_CONFIANCA = 60;

export type OrigemLeitura = 'camera' | 'leitor_externo' | 'manual';

export type PacoteLido = {
  id: string;
  codigo_pacote: string;
  tipo?: string | null;
  origem: OrigemLeitura;
  metadados?: Record<string, unknown> | null;
  created_at: string;
  user_id?: string | null;
};

export type PacoteLidoLocal = PacoteLido & {
  sincronizado?: boolean;
};
