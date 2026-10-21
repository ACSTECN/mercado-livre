import type { PacoteLido, PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote, ResultadoMoverPacote, StatusPacote } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId, normalizarCodigoPacote, codigosIguaisNormalizados } from '@/lib/utils';
import { exportarParaXlsx } from '../spreadsheet/ExcelService';
import { pegarIdSacaAtiva } from './SacaService';

/**
 * Camada de acesso a pacotes.
 *
 * FONTE ÚNICA DA VERDADE = Supabase.
 * Não há cache local de registros: toda leitura vem do banco e toda escrita é
 * confirmada pelo banco antes de retornar. Isso garante que todos os aparelhos
 * vejam exatamente o mesmo estado.
 */

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIMITE_LEITURA = 5000;

let _realtimeInscrito = false;
let _realtimeCallback: ((tipo: 'pacotes' | 'sacas' | 'entregadores') => void) | null = null;
let _realtimeRef = 0;

// cache curto apenas em memória para evitar rajadas de requisições num mesmo tick
let _cacheEntregadores: string[] | null = null;
let _cacheEntregadoresTs = 0;

function ordenarNomes(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

function igualArrayString(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

/** Remove duplicatas de id e de código normalizado dentro da mesma saca. */
function deduplicarLidos(rows: PacoteLido[]): PacoteLidoLocal[] {
  const idsVistos = new Set<string>();
  const chavesPorSaca = new Map<string, Set<string>>();
  const saida: PacoteLidoLocal[] = [];
  for (const item of rows) {
    const chaveSaca = item.saca_id ?? '__null__';
    if (item.id && idsVistos.has(item.id)) continue;
    const norm = normalizarCodigoPacote(item.codigo_pacote);
    let set = chavesPorSaca.get(chaveSaca);
    if (!set) {
      set = new Set<string>();
      chavesPorSaca.set(chaveSaca, set);
    }
    if (norm && set.has(norm)) continue;
    if (norm) set.add(norm);
    if (item.id) idsVistos.add(item.id);
    saida.push({ ...item, sincronizado: true });
  }
  return saida;
}

/* ------------------------------------------------------------------ */
/* Entregadores                                                        */
/* ------------------------------------------------------------------ */

export async function listarEntregadores(force = false): Promise<string[]> {
  const agora = Date.now();
  if (!force && _cacheEntregadores && agora - _cacheEntregadoresTs < 3000) {
    return _cacheEntregadores;
  }
  const sb = getSupabase();
  if (!isSupabaseConfigurado || !sb) return _cacheEntregadores ?? [];
  try {
    const { data, error } = await sb
      .from('entregadores')
      .select('nome')
      .order('created_at', { ascending: false })
      .limit(2000);
    if (error || !data) return _cacheEntregadores ?? [];
    const nomes = ordenarNomes((data as Array<{ nome: string }>).map((e) => e.nome));
    _cacheEntregadores = nomes;
    _cacheEntregadoresTs = agora;
    return nomes;
  } catch {
    return _cacheEntregadores ?? [];
  }
}

export async function adicionarEntregador(nome: string): Promise<string[]> {
  const limpo = nome.trim();
  if (!limpo) return listarEntregadores(true);
  const sb = getSupabase();
  if (isSupabaseConfigurado && sb) {
    try {
      await sb.from('entregadores').insert({ nome: limpo });
    } catch {
      /* provável conflito de unique: já existe */
    }
  }
  return listarEntregadores(true);
}

export async function removerEntregador(nome: string): Promise<string[]> {
  const limpo = nome.trim();
  if (!limpo) return listarEntregadores(true);
  const sb = getSupabase();
  if (isSupabaseConfigurado && sb) {
    try {
      await sb.from('entregadores').delete().ilike('nome', limpo);
    } catch {
      /* noop */
    }
  }
  return listarEntregadores(true);
}

export async function renomearEntregador(nomeAntigo: string, nomeNovo: string): Promise<string[]> {
  const limpoAntigo = nomeAntigo.trim();
  const limpoNovo = nomeNovo.trim();
  if (!limpoAntigo || !limpoNovo) return listarEntregadores(true);
  if (limpoAntigo.toLowerCase() === limpoNovo.toLowerCase()) return listarEntregadores(true);
  const sb = getSupabase();
  if (isSupabaseConfigurado && sb) {
    try {
      await sb.from('entregadores').update({ nome: limpoNovo }).ilike('nome', limpoAntigo);
    } catch {
      /* noop */
    }
  }
  return listarEntregadores(true);
}

export function invalidarCacheEntregadores() {
  _cacheEntregadores = null;
  _cacheEntregadoresTs = 0;
}

export { igualArrayString };

/* ------------------------------------------------------------------ */
/* Realtime                                                            */
/* ------------------------------------------------------------------ */

export function inscreverRealtimePacotes(
  onMudouPacotes: () => void,
  onMudouSacas: () => void,
  onMudouEntregadores: () => void = () => {},
): () => void {
  if (!isSupabaseConfigurado) return () => {};
  const sb = getSupabase();
  if (!sb) return () => {};

  _realtimeRef += 1;
  const meuRef = _realtimeRef;

  const wrapperCb = (tipo: 'pacotes' | 'sacas' | 'entregadores') => {
    if (tipo === 'pacotes') {
      onMudouPacotes();
    } else if (tipo === 'sacas') {
      onMudouSacas();
    } else {
      invalidarCacheEntregadores();
      onMudouEntregadores();
    }
  };

  if (_realtimeInscrito && _realtimeCallback) {
    const antigo = _realtimeCallback;
    _realtimeCallback = (tipo) => wrapperCb(tipo);
    return () => {
      if (meuRef === _realtimeRef) {
        _realtimeCallback = antigo;
      }
    };
  }
  _realtimeInscrito = true;
  _realtimeCallback = (tipo) => wrapperCb(tipo);

  try {
    const canalPacotes = sb
      .channel('pacotes_lidos_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pacotes_lidos' },
        () => _realtimeCallback?.('pacotes'),
      )
      .subscribe(() => {});

    const canalSacas = sb
      .channel('sacas_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'sacas' },
        () => _realtimeCallback?.('sacas'),
      )
      .subscribe(() => {});

    const canalEntregadores = sb
      .channel('entregadores_changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'entregadores' },
        () => _realtimeCallback?.('entregadores'),
      )
      .subscribe(() => {});

    return () => {
      if (meuRef !== _realtimeRef) return;
      try {
        void sb.removeChannel(canalPacotes).catch(() => {});
        void sb.removeChannel(canalSacas).catch(() => {});
        void sb.removeChannel(canalEntregadores).catch(() => {});
      } catch {
        /* noop */
      }
      _realtimeInscrito = false;
      _realtimeCallback = null;
    };
  } catch {
    _realtimeInscrito = false;
    return () => {};
  }
}

/* ------------------------------------------------------------------ */
/* Helpers internos                                                    */
/* ------------------------------------------------------------------ */

async function buscarNoBancoPorCodigo(codigo: string, sacaId: string | null): Promise<PacoteLidoLocal | null> {
  const sb = getSupabase();
  if (!isSupabaseConfigurado || !sb) return null;
  const codNorm = normalizarCodigoPacote(codigo);
  if (!codNorm) return null;
  try {
    let query = sb.from('pacotes_lidos').select('*');
    query = sacaId ? query.eq('saca_id', sacaId) : query.is('saca_id', null);
    const { data } = await query;
    if (!data || !Array.isArray(data)) return null;
    const match = (data as PacoteLido[]).find((p) => codigosIguaisNormalizados(p.codigo_pacote, codNorm));
    if (!match) return null;
    return { ...match, sincronizado: true };
  } catch {
    return null;
  }
}

async function buscarHistoricoStatusPorCodigo(codigo: string, sacaAtualId: string | null): Promise<StatusPacote | null> {
  const alvo = normalizarCodigoPacote(codigo);
  if (!alvo) return null;
  const sb = getSupabase();
  if (!isSupabaseConfigurado || !sb) return null;
  try {
    let q = sb.from('pacotes_lidos').select('status,created_at,codigo_pacote,saca_id');
    if (sacaAtualId) q = q.neq('saca_id', sacaAtualId);
    q = q.order('created_at', { ascending: false }).limit(50);
    const { data } = await q;
    if (data && Array.isArray(data)) {
      for (const row of data as Array<{ status?: unknown; codigo_pacote?: string | null }>) {
        const s = row.status as StatusPacote | null | undefined;
        if (s && ['retorno', 'lido', 'entregue', 'devolucao'].includes(s) && codigosIguaisNormalizados(row.codigo_pacote, alvo)) {
          return s;
        }
      }
    }
  } catch {
    /* noop */
  }
  return null;
}

/* ------------------------------------------------------------------ */
/* API pública                                                         */
/* ------------------------------------------------------------------ */

export const PacoteService = {
  async listarTodasSacas(): Promise<PacoteLidoLocal[]> {
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) return [];
    const { data, error } = await sb
      .from('pacotes_lidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMITE_LEITURA);
    if (error) throw new Error(error.message);
    return deduplicarLidos((data ?? []) as PacoteLido[]);
  },

  async listar(sacaIdArg?: string | null): Promise<PacoteLidoLocal[]> {
    const sacaId = sacaIdArg ?? pegarIdSacaAtiva();
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) return [];
    let q = sb
      .from('pacotes_lidos')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMITE_LEITURA);
    q = sacaId ? q.eq('saca_id', sacaId) : q.is('saca_id', null);
    const { data, error } = await q;
    if (error) throw new Error(error.message);
    return deduplicarLidos((data ?? []) as PacoteLido[]);
  },

  async adicionar(
    codigo_pacote: string,
    origem: OrigemLeitura,
    extra: Partial<PacoteLido> = {},
  ): Promise<ResultadoAdicaoPacote> {
    const codExtraido = normalizarCodigoPacote(codigo_pacote);
    if (!codExtraido) {
      return { sucesso: false, duplicado: false, mensagem: 'Código vazio' };
    }

    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) {
      return { sucesso: false, duplicado: false, mensagem: 'Banco de dados não configurado' };
    }

    const saca_id = extra.saca_id ?? pegarIdSacaAtiva() ?? null;
    const entregador = extra.entregador ?? null;

    try {
      const jaExisteBanco = await buscarNoBancoPorCodigo(codExtraido, saca_id);
      if (jaExisteBanco) {
        return {
          sucesso: false,
          duplicado: true,
          existente: jaExisteBanco,
          mensagem: `ID ${codExtraido} já foi contado nesta saca`,
        };
      }

      let statusHerado: StatusPacote | null = extra.status ?? null;
      if (extra.status == null) {
        statusHerado = await buscarHistoricoStatusPorCodigo(codExtraido, saca_id);
      }

      const novo: PacoteLidoLocal = {
        id: extra.id ?? gerarId(),
        codigo_pacote: codExtraido,
        tipo: extra.tipo ?? null,
        origem,
        metadados: extra.metadados ?? null,
        created_at: extra.created_at ?? new Date().toISOString(),
        updated_at: extra.updated_at ?? null,
        user_id: extra.user_id ?? null,
        saca_id,
        entregador,
        zona_ml: extra.zona_ml ?? null,
        status: extra.status ?? statusHerado,
        sincronizado: true,
      };

      const payload = {
        id: novo.id,
        codigo_pacote: novo.codigo_pacote,
        tipo: novo.tipo,
        origem: novo.origem,
        metadados: novo.metadados ?? {},
        created_at: novo.created_at,
        saca_id: novo.saca_id,
        entregador: novo.entregador ?? null,
        zona_ml: novo.zona_ml ?? null,
        status: novo.status ?? null,
      };

      const { error } = await sb.from('pacotes_lidos').insert(payload);
      if (error) {
        if (/duplicate|unique|23505/i.test(error.message ?? error.code ?? '')) {
          const noBanco = await buscarNoBancoPorCodigo(codExtraido, saca_id);
          if (noBanco) {
            return {
              sucesso: false,
              duplicado: true,
              existente: noBanco,
              mensagem: `ID ${codExtraido} já está nesta saca`,
            };
          }
        }
        return { sucesso: false, duplicado: false, mensagem: error.message ?? 'Falha ao gravar no banco' };
      }

      return {
        sucesso: true,
        duplicado: false,
        pacote: novo,
        mensagem: `ID ${codExtraido} contado com sucesso`,
        statusHerdado: statusHerado,
      };
    } catch (e) {
      return {
        sucesso: false,
        duplicado: false,
        mensagem: e instanceof Error ? e.message : 'Erro desconhecido',
      };
    }
  },

  async mover(
    id: string,
    novoEntregador: string,
    origemMovimento: 're_scan' | 'manual' = 'manual',
  ): Promise<ResultadoMoverPacote> {
    const entregadorLimpo = novoEntregador.trim();
    if (!entregadorLimpo) {
      return { sucesso: false, movido: false, mensagem: 'Entregador inválido' };
    }
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) {
      return { sucesso: false, movido: false, mensagem: 'Banco de dados não configurado' };
    }
    try {
      const { data, error } = await sb
        .from('pacotes_lidos')
        .update({ entregador: entregadorLimpo })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error) {
        return { sucesso: false, movido: false, mensagem: error.message };
      }
      const pacote = data ? ({ ...(data as PacoteLido), sincronizado: true } as PacoteLidoLocal) : undefined;
      return {
        sucesso: true,
        movido: true,
        pacote,
        mensagem: origemMovimento === 're_scan'
          ? `Movido para "${entregadorLimpo}"`
          : `Pacote movido para "${entregadorLimpo}"`,
      };
    } catch (e) {
      return { sucesso: false, movido: false, mensagem: e instanceof Error ? e.message : 'Erro desconhecido' };
    }
  },

  async definirStatus(id: string, status: StatusPacote | null): Promise<PacoteLidoLocal | null> {
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) return null;
    try {
      const { data, error } = await sb
        .from('pacotes_lidos')
        .update({ status })
        .eq('id', id)
        .select('*')
        .maybeSingle();
      if (error || !data) return null;
      return { ...(data as PacoteLido), sincronizado: true } as PacoteLidoLocal;
    } catch {
      return null;
    }
  },

  async remover(id: string): Promise<void> {
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');
    const { error } = await sb.from('pacotes_lidos').delete().eq('id', id);
    if (error) throw new Error(error.message);
  },

  async removerEmLote(ids: string[]): Promise<{ removidos: number }> {
    if (!ids.length) return { removidos: 0 };
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');
    const { error } = await sb.from('pacotes_lidos').delete().in('id', ids);
    if (error) throw new Error(error.message);
    return { removidos: ids.length };
  },

  async limpar(sacaIdArg?: string | null): Promise<void> {
    const sacaId = sacaIdArg ?? pegarIdSacaAtiva();
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');
    let q = sb.from('pacotes_lidos').delete();
    q = sacaId ? q.eq('saca_id', sacaId) : q.is('saca_id', null);
    const { error } = await q;
    if (error) throw new Error(error.message);
  },

  async contar(sacaIdArg?: string | null): Promise<{ total: number; unicos: number }> {
    const lista = await PacoteService.listar(sacaIdArg);
    const unicos = new Set(lista.map((p) => normalizarCodigoPacote(p.codigo_pacote)).filter(Boolean));
    return { total: lista.length, unicos: unicos.size };
  },

  async exportarCsv(
    sacaIdArg?: string | null,
    nomeArquivo?: string,
    listaFiltrada?: Array<{ id: string; codigo_pacote: string; tipo?: string | null; entregador?: string | null; status?: string | null; origem?: string | null; created_at: string; sincronizado?: boolean }>,
  ): Promise<void> {
    const itens = listaFiltrada && listaFiltrada.length ? listaFiltrada : await PacoteService.listar(sacaIdArg);
    const linhas = itens.map((h, idx) => {
      const d = new Date(h.created_at);
      return {
        Ordem: itens.length - idx,
        ID: h.id,
        Codigo: h.codigo_pacote,
        Tipo: h.tipo ?? '',
        Entregador: h.entregador ?? '',
        Status: h.status ?? '',
        Origem: h.origem === 'camera' ? 'Câmera' : h.origem === 'leitor_externo' ? 'Leitor externo' : 'Manual',
        Data: d.toLocaleDateString('pt-BR'),
        Hora: d.toLocaleTimeString('pt-BR'),
        Sincronizado: h.sincronizado ? 'Sim' : 'Não',
      };
    });
    const finalNome = nomeArquivo ?? `contagem_pacotes_${Date.now()}.xlsx`;
    exportarParaXlsx(linhas, finalNome, 'Pacotes');
  },

  async exportarBackupJson(): Promise<{
    versao: number;
    extraidoEm: string;
    pacotes: PacoteLidoLocal[];
    sacas: unknown;
    sacaAtivaId: string | null;
    entregadorAtivo: string | null;
  }> {
    const pacotes = await PacoteService.listarTodasSacas();
    let sacas: unknown = [];
    const sb = getSupabase();
    if (isSupabaseConfigurado && sb) {
      try {
        const { data } = await sb.from('sacas').select('*').order('created_at', { ascending: false }).limit(500);
        sacas = data ?? [];
      } catch {
        /* noop */
      }
    }
    return {
      versao: 2,
      extraidoEm: new Date().toISOString(),
      pacotes,
      sacas,
      sacaAtivaId: pegarIdSacaAtiva(),
      entregadorAtivo: (() => {
        try {
          return localStorage.getItem('ml_entregador_ativo_v1');
        } catch {
          return null;
        }
      })(),
    };
  },

  async baixarArquivoBackup(): Promise<void> {
    const payload = await PacoteService.exportarBackupJson();
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const ts = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    a.href = url;
    a.download = `backup-mercadolivre-${ts}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  },

  async importarBackupJson(payload: unknown): Promise<{ ok: boolean; pacotesRestaurados: number; erro?: string }> {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Arquivo inválido');
      const p = payload as { pacotes?: PacoteLidoLocal[] };
      if (!Array.isArray(p.pacotes)) throw new Error('Arquivo sem campo "pacotes" array');
      const sb = getSupabase();
      if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');

      const rows = p.pacotes
        .filter((x) => x && x.codigo_pacote)
        .map((x) => ({
          id: x.id && UUID_RE.test(x.id) ? x.id : gerarId(),
          codigo_pacote: normalizarCodigoPacote(x.codigo_pacote),
          tipo: x.tipo ?? null,
          origem: x.origem ?? 'manual',
          metadados: x.metadados ?? {},
          created_at: x.created_at ?? new Date().toISOString(),
          saca_id: x.saca_id ?? null,
          entregador: x.entregador ?? null,
          zona_ml: x.zona_ml ?? null,
          status: x.status ?? null,
        }));

      if (rows.length) {
        const { error } = await sb.from('pacotes_lidos').upsert(rows, { onConflict: 'id' });
        if (error) throw new Error(error.message);
      }
      return { ok: true, pacotesRestaurados: rows.length };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : 'Erro desconhecido';
      console.error('[backup] importarBackupJson falhou:', e);
      return { ok: false, pacotesRestaurados: 0, erro: mensagem };
    }
  },

  async testarConexaoBanco(): Promise<{ ok: boolean; erro?: string; tabelas: { sacas: number | null; pacotes: number | null } }> {
    if (!isSupabaseConfigurado) return { ok: false, erro: 'Supabase não configurado (.env)', tabelas: { sacas: null, pacotes: null } };
    const sb = getSupabase();
    if (!sb) return { ok: false, erro: 'cliente supabase nulo', tabelas: { sacas: null, pacotes: null } };
    try {
      const [{ count: cS, error: eS }, { count: cP, error: eP }] = await Promise.all([
        sb.from('sacas').select('*', { count: 'exact', head: true }),
        sb.from('pacotes_lidos').select('*', { count: 'exact', head: true }),
      ]);
      if (eS || eP) return { ok: false, erro: `sacas:${eS?.message ?? ''} pacotes:${eP?.message ?? ''}`, tabelas: { sacas: cS ?? null, pacotes: cP ?? null } };
      return { ok: true, tabelas: { sacas: cS ?? null, pacotes: cP ?? null } };
    } catch (e) {
      const mensagem = e instanceof Error ? e.message : String(e);
      return { ok: false, erro: mensagem, tabelas: { sacas: null, pacotes: null } };
    }
  },
};
