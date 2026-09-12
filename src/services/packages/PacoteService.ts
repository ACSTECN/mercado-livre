import type { EntregadorCadastrado, PacoteLido, PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote, ResultadoMoverPacote, StatusPacote } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId } from '@/lib/utils';
import { exportarParaCsv } from '../spreadsheet/ExcelService';
import { pegarIdSacaAtiva } from './SacaService';

export const CHAVE_LOCAL = 'ml_pacotes_lidos_v1';
const CHAVE_ENTREGADORES = 'ml_entregadores_v1';
const CHAVE_ENTREGADORES_BAIXADOS = 'ml_entregadores_baixados_v1';

let _realtimeInscrito = false;
let _realtimeCallback: ((tipo: 'pacotes' | 'sacas' | 'entregadores') => void) | null = null;
let _realtimeRef = 0;
let _ultimoSyncAllTs = 0;
let forcarSyncAllRef = false;
let _ultimoSyncEntregadoresTs = 0;
let _cacheEntregadores: string[] | null = null;
let _cacheEntregadoresTs = 0;

function igualArrayString(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function ordenarNomes(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

function lerLocalEntregadoresOffline(): string[] {
  try {
    const raw = localStorage.getItem(CHAVE_ENTREGADORES);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? ordenarNomes(arr) : [];
  } catch {
    return [];
  }
}

function salvarLocalEntregadoresOffline(nomes: string[]) {
  try {
    localStorage.setItem(CHAVE_ENTREGADORES, JSON.stringify(ordenarNomes(nomes)));
  } catch {
    /* noop */
  }
}

export function listarEntregadoresSyncOffline(): string[] {
  return lerLocalEntregadoresOffline();
}

export async function listarEntregadores(force = false): Promise<string[]> {
  const agora = Date.now();
  const cacheValido = _cacheEntregadores && agora - _cacheEntregadoresTs < 2000 && !force;
  if (cacheValido && _cacheEntregadores) return _cacheEntregadores;

  const offline = lerLocalEntregadoresOffline();

  if (!isSupabaseConfigurado) {
    const r = offline;
    _cacheEntregadores = r;
    _cacheEntregadoresTs = agora;
    return r;
  }
  const sb = getSupabase();
  if (!sb) {
    const r = offline;
    _cacheEntregadores = r;
    _cacheEntregadoresTs = agora;
    return r;
  }
  try {
    const ultimoBaixado = (() => {
      try {
        const raw = localStorage.getItem(CHAVE_ENTREGADORES_BAIXADOS);
        return raw ? (JSON.parse(raw) as EntregadorCadastrado[]) : [];
      } catch {
        return [];
      }
    })();
    const usarBanco = force || agora - _ultimoSyncEntregadoresTs > 15000;
    let baixados: EntregadorCadastrado[] = ultimoBaixado;
    if (usarBanco) {
      const { data } = await sb.from('entregadores').select('id,nome,created_at').order('created_at', { ascending: false }).limit(500);
      if (data && Array.isArray(data)) {
        baixados = data as EntregadorCadastrado[];
        _ultimoSyncEntregadoresTs = agora;
        try { localStorage.setItem(CHAVE_ENTREGADORES_BAIXADOS, JSON.stringify(baixados)); } catch { /* noop */ }
      }
    }
    const nomesBanco = ordenarNomes(baixados.map((e) => e.nome));
    const merged = ordenarNomes([...offline, ...nomesBanco]);
    salvarLocalEntregadoresOffline(merged);
    _cacheEntregadores = merged;
    _cacheEntregadoresTs = agora;
    return merged;
  } catch {
    const r = offline;
    _cacheEntregadores = r;
    _cacheEntregadoresTs = agora;
    return r;
  }
}

export async function adicionarEntregador(nome: string): Promise<string[]> {
  const limpo = nome.trim();
  if (!limpo) return listarEntregadores();
  const offlineAgora = lerLocalEntregadoresOffline();
  if (offlineAgora.map((s) => s.toLowerCase()).includes(limpo.toLowerCase())) {
    return ordenarNomes(offlineAgora);
  }
  const localAtualizado = ordenarNomes([limpo, ...offlineAgora]);
  salvarLocalEntregadoresOffline(localAtualizado);
  _cacheEntregadores = localAtualizado;
  _cacheEntregadoresTs = Date.now();

  if (isSupabaseConfigurado && getSupabase()) {
    void (async () => {
      const sb = getSupabase()!;
      try {
        const { data } = await sb
          .from('entregadores')
          .insert({ nome: limpo })
          .select('id,nome,created_at')
          .maybeSingle();
        if (data) {
          try {
            const raw = localStorage.getItem(CHAVE_ENTREGADORES_BAIXADOS);
            const arr: EntregadorCadastrado[] = raw ? (JSON.parse(raw) as EntregadorCadastrado[]) : [];
            const jaTem = arr.some((e) => e.id === (data as EntregadorCadastrado).id);
            if (!jaTem) {
              arr.unshift(data as EntregadorCadastrado);
              localStorage.setItem(CHAVE_ENTREGADORES_BAIXADOS, JSON.stringify(arr));
            }
          } catch { /* noop */ }
        }
      } catch {
        /* noop - provavel unique conflito, ja existe */
      }
    })();
  }
  return localAtualizado;
}

export async function removerEntregador(nome: string): Promise<string[]> {
  const limpo = nome.trim();
  if (!limpo) return listarEntregadores();
  const offlineAgora = lerLocalEntregadoresOffline().filter((e) => e.toLowerCase() !== limpo.toLowerCase());
  salvarLocalEntregadoresOffline(offlineAgora);
  _cacheEntregadores = offlineAgora;
  _cacheEntregadoresTs = Date.now();

  if (isSupabaseConfigurado && getSupabase()) {
    void (async () => {
      const sb = getSupabase()!;
      try {
        await sb.from('entregadores').delete().ilike('nome', limpo);
      } catch { /* noop */ }
      try {
        const raw = localStorage.getItem(CHAVE_ENTREGADORES_BAIXADOS);
        const arr: EntregadorCadastrado[] = raw ? (JSON.parse(raw) as EntregadorCadastrado[]) : [];
        const filtrado = arr.filter((e) => e.nome.toLowerCase() !== limpo.toLowerCase());
        localStorage.setItem(CHAVE_ENTREGADORES_BAIXADOS, JSON.stringify(filtrado));
      } catch { /* noop */ }
    })();
  }
  return offlineAgora;
}

export function invalidarCacheEntregadores() {
  _cacheEntregadores = null;
  _cacheEntregadoresTs = 0;
  _ultimoSyncEntregadoresTs = 0;
}

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
      try {
        sessionStorage.removeItem('ml_pacote_store_v1');
      } catch {
        /* noop */
      }
      onMudouPacotes();
    } else if (tipo === 'sacas') {
      try {
        localStorage.removeItem('ml_sacas_store_v1');
      } catch {
        /* noop */
      }
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

function lerLocal(): PacoteLidoLocal[] {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PacoteLidoLocal[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function salvarLocal(lista: PacoteLidoLocal[]) {
  localStorage.setItem(CHAVE_LOCAL, JSON.stringify(lista));
}

function encontrarPorCodigo(lista: PacoteLidoLocal[], codigo: string, sacaId: string | null): PacoteLidoLocal | undefined {
  const alvo = codigo.trim();
  return lista.find((p) => p.codigo_pacote.trim() === alvo && (sacaId ? p.saca_id === sacaId : !p.saca_id));
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function corrigirSacaIdsNosPacotes(mapaIdAntigoParaNovo: Record<string, string>): Promise<number> {
  if (!mapaIdAntigoParaNovo || !Object.keys(mapaIdAntigoParaNovo).length) return 0;
  const locais = lerLocal();
  let alterados = 0;
  for (let i = 0; i < locais.length; i++) {
    const p = locais[i];
    if (p.saca_id && mapaIdAntigoParaNovo[p.saca_id]) {
      locais[i] = { ...p, saca_id: mapaIdAntigoParaNovo[p.saca_id], sincronizado: false };
      alterados += 1;
    }
  }
  if (alterados > 0) {
    salvarLocal(locais);
    console.log('[sincronia] corrigidos', alterados, 'pacotes com saca_id desatualizado');
  }
  return alterados;
}

async function sincronizarComSupabase(): Promise<{ sincronizados: number; falhas: number; total: number; primeiroErro: string | null }> {
  if (!isSupabaseConfigurado) return { sincronizados: 0, falhas: 0, total: 0, primeiroErro: null };
  const sb = getSupabase();
  if (!sb) return { sincronizados: 0, falhas: 0, total: 0, primeiroErro: null };

  const locais = lerLocal();
  let ok = 0;
  let falha = 0;
  let primeiroErro: string | null = null;

  console.log('[sincronia] processando', locais.length, 'pacotes locais');

  for (let i = 0; i < locais.length; i++) {
    const p = locais[i];
    try {
      const basePayload = {
        codigo_pacote: p.codigo_pacote,
        tipo: p.tipo ?? null,
        origem: p.origem,
        metadados: p.metadados ?? {},
        created_at: p.created_at,
        saca_id: p.saca_id ?? null,
        entregador: p.entregador ?? null,
        status: p.status ?? null,
      };

      const idValido = UUID_RE.test(p.id ?? '');

      if (idValido) {
        const { error } = await sb
          .from('pacotes_lidos')
          .upsert({ id: p.id, ...basePayload }, { onConflict: 'id' });
        if (!error) {
          locais[i] = { ...p, sincronizado: true };
          ok += 1;
          continue;
        }
        console.warn('[sincronia] upsert pacote por id falhou, tentando insert sem id:', p.id, error);
        if (!primeiroErro) primeiroErro = `upsert: ${(error as { message?: string })?.message ?? String(error)}`;
      }

      const { data, error: insertErr } = await sb
        .from('pacotes_lidos')
        .insert(basePayload)
        .select('id')
        .maybeSingle();
      if (!insertErr && data) {
        locais[i] = { ...p, id: (data as { id: string }).id, sincronizado: true };
        ok += 1;
      } else {
        if (insertErr && /duplicate|unique|23505/i.test((insertErr as { message?: string; code?: string }).message ?? (insertErr as { code?: string }).code ?? '')) {
          locais[i] = { ...p, sincronizado: true };
          ok += 1;
        } else {
          const msg = (insertErr as { message?: string; code?: string })?.message
            ?? (insertErr as { code?: string })?.code
            ?? 'erro desconhecido';
          console.error('[sincronia] falha definitiva pacote:', p.codigo_pacote, insertErr);
          if (!primeiroErro) primeiroErro = `pacote ${p.codigo_pacote}: ${msg}`;
          falha += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[sincronia] catch pacote:', p?.codigo_pacote, e);
      if (!primeiroErro) primeiroErro = `catch: ${msg}`;
      falha += 1;
    }
  }
  salvarLocal(locais);
  console.log('[sincronia] resultado pacotes:', { sincronizados: ok, falhas: falha, total: locais.length });
  return { sincronizados: ok, falhas: falha, total: locais.length, primeiroErro };
}

async function buscarNoBancoPorCodigo(codigo: string, sacaId: string | null): Promise<PacoteLidoLocal | null> {
  if (!isSupabaseConfigurado) return null;
  const sb = getSupabase();
  if (!sb) return null;
  try {
    let query = sb
      .from('pacotes_lidos')
      .select('*')
      .eq('codigo_pacote', codigo.trim());
    if (sacaId) query = query.eq('saca_id', sacaId);
    else query = query.is('saca_id', null);
    const { data } = await query.limit(1).maybeSingle();
    if (!data) return null;
    return { ...(data as PacoteLido), sincronizado: true };
  } catch {
    return null;
  }
}

async function buscarHistoricoStatusPorCodigo(codigo: string, sacaAtualId: string | null): Promise<StatusPacote | null> {
  const alvo = codigo.trim();
  if (!alvo) return null;
  const locais = lerLocal();
  const mesmosCodigosLocal = locais.filter((p) =>
    p.codigo_pacote.trim() === alvo &&
    (sacaAtualId ? p.saca_id !== sacaAtualId : true),
  );
  const maisRecente = [...mesmosCodigosLocal].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  if (maisRecente?.status === 'retorno') return 'retorno';

  if (isSupabaseConfigurado && getSupabase()) {
    const sb = getSupabase()!;
    try {
      let q = sb.from('pacotes_lidos').select('status,created_at').eq('codigo_pacote', alvo);
      if (sacaAtualId) q = q.neq('saca_id', sacaAtualId);
      q = q.order('created_at', { ascending: false }).limit(10);
      const { data } = await q;
      if (data && Array.isArray(data)) {
        for (const row of data as Array<{ status?: unknown; created_at?: string }>) {
          if (row.status === 'retorno') return 'retorno';
        }
      }
    } catch {
      /* noop */
    }
  }
  return maisRecente?.status ?? null;
}

export const PacoteService = {
  async listarTodasSacas(): Promise<PacoteLidoLocal[]> {
    if (!isSupabaseConfigurado) {
      return lerLocal().sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    try {
      const agora = Date.now();
      const forcarSync = forcarSyncAllRef;
      if (forcarSync || agora - _ultimoSyncAllTs > 40000) {
        forcarSyncAllRef = false;
        _ultimoSyncAllTs = agora;
        try {
          await sincronizarComSupabase();
        } catch {
          /* noop - ainda tenta pegar do banco abaixo */
        }
      }
      const sb = getSupabase();
      if (!sb) return lerLocal();

      const { data, error } = await sb
        .from('pacotes_lidos')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5000);

      if (error || !data) return lerLocal();

      const locais = lerLocal();
      const mapaLocal = new Map(locais.map((p) => [p.id, p]));

      const todos: PacoteLidoLocal[] = [];
      const idsVistos = new Set<string>();
      const keyUnica = (p: PacoteLido) => `${p.codigo_pacote}::${p.saca_id ?? '__null__'}`;
      const chavesVistas = new Set<string>();

      for (const item of data as PacoteLido[]) {
        const k = keyUnica(item);
        if (chavesVistas.has(k)) continue;
        idsVistos.add(item.id);
        chavesVistas.add(k);
        const local = mapaLocal.get(item.id);
        todos.push({ ...item, sincronizado: true });
      }

      for (const local of locais) {
        const k = keyUnica(local);
        if (!idsVistos.has(local.id) && !chavesVistas.has(k)) {
          chavesVistas.add(k);
          todos.push(local);
        }
      }

      todos.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return todos;
    } catch {
      return lerLocal();
    }
  },

  async listar(sacaIdArg?: string | null): Promise<PacoteLidoLocal[]> {
    const sacaId = sacaIdArg ?? pegarIdSacaAtiva();
    const todos = await PacoteService.listarTodasSacas();
    return todos.filter((p) => (sacaId ? p.saca_id === sacaId : !p.saca_id));
  },

  async adicionar(
    codigo_pacote: string,
    origem: OrigemLeitura,
    extra: Partial<PacoteLido> = {},
  ): Promise<ResultadoAdicaoPacote> {
    const trimmed = codigo_pacote.trim();
    if (!trimmed) {
      return { sucesso: false, duplicado: false, mensagem: 'Código vazio' };
    }

    const saca_id = extra.saca_id ?? pegarIdSacaAtiva() ?? null;
    const entregador = extra.entregador ?? null;
    const locais = lerLocal();
    const jaExisteLocal = encontrarPorCodigo(locais, trimmed, saca_id);
    if (jaExisteLocal) {
      return {
        sucesso: false,
        duplicado: true,
        existente: jaExisteLocal,
        mensagem: `ID ${trimmed} já foi contado nesta saca`,
      };
    }

    const jaExisteBanco = await buscarNoBancoPorCodigo(trimmed, saca_id);
    if (jaExisteBanco) {
      if (!jaExisteLocal) {
        locais.unshift(jaExisteBanco);
        salvarLocal(locais);
      }
      return {
        sucesso: false,
        duplicado: true,
        existente: jaExisteBanco,
        mensagem: `ID ${trimmed} já está nesta saca no banco`,
      };
    }

    let statusHerado: StatusPacote | null = null;
    const locaisHist = lerLocal();
    const mesmoCodigoLocalSemSaca = locaisHist
      .filter((p) => p.codigo_pacote.trim() === trimmed && (saca_id ? p.saca_id !== saca_id : true))
      .sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
    if (mesmoCodigoLocalSemSaca?.status === 'retorno') statusHerado = 'retorno';

    const novo: PacoteLidoLocal = {
      id: extra.id ?? gerarId(),
      codigo_pacote: trimmed,
      tipo: extra.tipo ?? null,
      origem,
      metadados: extra.metadados ?? null,
      created_at: extra.created_at ?? new Date().toISOString(),
      user_id: extra.user_id ?? null,
      saca_id,
      entregador,
      status: extra.status ?? statusHerado,
      sincronizado: false,
    };

    locais.unshift(novo);
    salvarLocal(locais);

    void (async () => {
      try {
        const bancoHist = await buscarHistoricoStatusPorCodigo(trimmed, saca_id);
        if (bancoHist === 'retorno' && novo.status !== 'retorno') {
          const reais = lerLocal();
          const idx = reais.findIndex((p) => p.id === novo.id);
          if (idx >= 0) {
            reais[idx] = { ...reais[idx], status: 'retorno', sincronizado: false };
            salvarLocal(reais);
            try {
              const sb = getSupabase();
              if (sb) {
                await sb.from('pacotes_lidos').update({ status: 'retorno' }).eq('id', novo.id);
                const ok = lerLocal();
                const i2 = ok.findIndex((p) => p.id === novo.id);
                if (i2 >= 0) {
                  ok[i2] = { ...ok[i2], sincronizado: true };
                  salvarLocal(ok);
                }
              }
            } catch { /* noop */ }
            const cb = _realtimeCallback;
            if (cb) cb('pacotes');
          }
        }
      } catch { /* noop */ }
    })();

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          const payload = {
            id: novo.id,
            codigo_pacote: novo.codigo_pacote,
            tipo: novo.tipo,
            origem: novo.origem,
            metadados: novo.metadados ?? {},
            created_at: novo.created_at,
            saca_id: novo.saca_id,
            entregador: novo.entregador ?? null,
            status: novo.status ?? null,
          };
          const { error } = await sb.from('pacotes_lidos').insert(payload);
          if (error && /duplicate|unique|23505/i.test(error.message ?? error.code ?? '')) {
            const atualizados = lerLocal().filter((p) => !(p.codigo_pacote === trimmed && p.saca_id === saca_id));
            const noBanco = await buscarNoBancoPorCodigo(trimmed, saca_id);
            if (noBanco) {
              atualizados.unshift(noBanco);
              salvarLocal(atualizados);
              return {
                sucesso: false,
                duplicado: true,
                existente: noBanco,
                mensagem: `ID ${trimmed} já está nesta saca no banco`,
              };
            }
          }
          if (!error) {
            novo.sincronizado = true;
            const atualizados = lerLocal();
            const idx = atualizados.findIndex((p) => p.id === novo.id);
            if (idx >= 0) {
              atualizados[idx] = { ...atualizados[idx], sincronizado: true };
              salvarLocal(atualizados);
            }
          }
        }
      } catch {
        /* noop - mantem local e sincroniza depois */
      }
    }

    return {
      sucesso: true,
      duplicado: false,
      pacote: novo,
      mensagem: `ID ${trimmed} contado com sucesso`,
      statusHerdado: statusHerado,
    };
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
    const locais = lerLocal();
    const idx = locais.findIndex((p) => p.id === id);
    if (idx < 0) {
      return { sucesso: false, movido: false, mensagem: 'Pacote não encontrado localmente' };
    }

    const anterior = locais[idx];
    if (anterior.entregador === entregadorLimpo) {
      return { sucesso: true, movido: false, pacote: anterior, mensagem: 'Já está neste entregador' };
    }

    const atualizado: PacoteLidoLocal = {
      ...anterior,
      entregador: entregadorLimpo,
      sincronizado: false,
    };
    locais[idx] = atualizado;
    salvarLocal(locais);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          const { error } = await sb
            .from('pacotes_lidos')
            .update({ entregador: entregadorLimpo })
            .eq('id', id);
          if (!error) {
            const locais2 = lerLocal();
            const idx2 = locais2.findIndex((p) => p.id === id);
            if (idx2 >= 0) {
              locais2[idx2] = { ...locais2[idx2], sincronizado: true };
              salvarLocal(locais2);
              atualizado.sincronizado = true;
            }
          }
        }
      } catch {
        /* noop - marca como não sincronizado e sincroniza depois */
      }
    }

    adicionarEntregador(entregadorLimpo);

    return {
      sucesso: true,
      movido: true,
      pacote: atualizado,
      mensagem: origemMovimento === 're_scan'
        ? `${anterior.codigo_pacote} movido para "${entregadorLimpo}"`
        : `Pacote movido para "${entregadorLimpo}"`,
    };
  },

  async definirStatus(id: string, status: StatusPacote | null): Promise<PacoteLidoLocal | null> {
    const locais = lerLocal();
    const idx = locais.findIndex((p) => p.id === id);
    if (idx < 0) return null;
    const anterior = locais[idx];
    const atualizado: PacoteLidoLocal = {
      ...anterior,
      status,
      sincronizado: false,
    };
    locais[idx] = atualizado;
    salvarLocal(locais);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          const { error } = await sb
            .from('pacotes_lidos')
            .update({ status })
            .eq('id', id);
          if (!error) {
            const locais2 = lerLocal();
            const idx2 = locais2.findIndex((p) => p.id === id);
            if (idx2 >= 0) {
              locais2[idx2] = { ...locais2[idx2], sincronizado: true };
              salvarLocal(locais2);
              atualizado.sincronizado = true;
            }
          }
        }
      } catch {
        /* noop */
      }
    }
    return atualizado;
  },

  async remover(id: string): Promise<void> {
    const locais = lerLocal().filter((p) => p.id !== id);
    salvarLocal(locais);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          await sb.from('pacotes_lidos').delete().eq('id', id);
        }
      } catch {
        /* noop */
      }
    }
  },

  async limpar(sacaIdArg?: string | null): Promise<void> {
    const sacaId = sacaIdArg ?? pegarIdSacaAtiva();
    const restantes = lerLocal().filter((p) => (sacaId ? p.saca_id !== sacaId : !!p.saca_id));
    salvarLocal(restantes);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          let q = sb.from('pacotes_lidos').delete();
          if (sacaId) q = q.eq('saca_id', sacaId);
          else q = q.is('saca_id', null);
          await q;
        }
      } catch {
        /* noop */
      }
    }
  },

  async contar(sacaIdArg?: string | null): Promise<{ total: number; unicos: number }> {
    const lista = await PacoteService.listar(sacaIdArg);
    const unicos = new Set(lista.map((p) => p.codigo_pacote));
    return { total: lista.length, unicos: unicos.size };
  },

  async exportarCsv(sacaIdArg?: string | null, nomeArquivo?: string): Promise<void> {
    const itens = await PacoteService.listar(sacaIdArg);
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
    await exportarParaCsv(linhas, nomeArquivo ?? `contagem_pacotes_${Date.now()}.xlsx`);
  },

  async sincronizarAgora(): Promise<{ sincronizados: number; falhas: number; total: number; primeiroErro: string | null }> {
    forcarSyncAllRef = true;
    _ultimoSyncAllTs = 0;
    const r = await sincronizarComSupabase();
    console.log('[sincronia] resultado pacotes:', r);
    return r;
  },

  exportarBackupJson(): {
    versao: number;
    extraidoEm: string;
    pacotes: PacoteLidoLocal[];
    sacaAtivaId: string | null;
    entregadorAtivo: string | null;
    sacasStoreCache: unknown;
    pacoteStoreCache: unknown;
  } {
    return {
      versao: 1,
      extraidoEm: new Date().toISOString(),
      pacotes: lerLocal(),
      sacaAtivaId: localStorage.getItem('ml_saca_ativa_id_v1'),
      entregadorAtivo: localStorage.getItem('ml_entregador_ativo_v1'),
      sacasStoreCache: (() => {
        try { return JSON.parse(localStorage.getItem('ml_sacas_store_v1') ?? 'null'); } catch { return null; }
      })(),
      pacoteStoreCache: (() => {
        try { return JSON.parse(sessionStorage.getItem('ml_pacote_store_v1') ?? 'null'); } catch { return null; }
      })(),
    };
  },

  baixarArquivoBackup(): void {
    const payload = PacoteService.exportarBackupJson();
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

  importarBackupJson(
    payload: unknown,
  ): {
    ok: boolean;
    pacotesRestaurados: number;
    erro?: string;
  } {
    try {
      if (!payload || typeof payload !== 'object') throw new Error('Arquivo inválido');
      const p = payload as { pacotes?: PacoteLidoLocal[]; sacaAtivaId?: string | null; entregadorAtivo?: string | null };
      if (!Array.isArray(p.pacotes)) throw new Error('Arquivo sem campo "pacotes" array');
      salvarLocal(p.pacotes);
      if (typeof p.sacaAtivaId === 'string' && p.sacaAtivaId) localStorage.setItem('ml_saca_ativa_id_v1', p.sacaAtivaId);
      if (typeof p.entregadorAtivo === 'string' && p.entregadorAtivo) localStorage.setItem('ml_entregador_ativo_v1', p.entregadorAtivo);
      return { ok: true, pacotesRestaurados: p.pacotes.length };
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
