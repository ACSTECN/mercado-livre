import type { Saca, StatusSaca, ResumoSaca } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId } from '@/lib/utils';
import { PacoteService, corrigirSacaIdsNosPacotes } from './PacoteService';

const CHAVE_LOCAL_SACAS = 'ml_sacas_v1';
const CHAVE_SACA_ATIVA = 'ml_saca_ativa_id_v1';

function lerSacasLocal(): Saca[] {
  try {
    const raw = localStorage.getItem(CHAVE_LOCAL_SACAS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Saca[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function salvarSacasLocal(lista: Saca[]) {
  localStorage.setItem(CHAVE_LOCAL_SACAS, JSON.stringify(lista));
}

export function pegarIdSacaAtiva(): string | null {
  try {
    return localStorage.getItem(CHAVE_SACA_ATIVA);
  } catch {
    return null;
  }
}

export function salvarIdSacaAtiva(id: string | null) {
  try {
    if (id) localStorage.setItem(CHAVE_SACA_ATIVA, id);
    else localStorage.removeItem(CHAVE_SACA_ATIVA);
  } catch {
    /* noop */
  }
}

const SACA_UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sincronizarSacasAgora(): Promise<{
  sincronizados: number;
  falhas: number;
  total: number;
  primeiroErro: string | null;
  idsRemapeados: Record<string, string>;
}> {
  if (!isSupabaseConfigurado) return { sincronizados: 0, falhas: 0, total: 0, primeiroErro: null, idsRemapeados: {} };
  const sb = getSupabase();
  if (!sb) return { sincronizados: 0, falhas: 0, total: 0, primeiroErro: null, idsRemapeados: {} };

  const locais = lerSacasLocal();
  let ok = 0;
  let falha = 0;
  let primeiroErro: string | null = null;
  const idsRemapeados: Record<string, string> = {};

  console.log('[sincronia-sacas] processando', locais.length, 'sacas locais');

  for (let i = 0; i < locais.length; i++) {
    const s = locais[i];
    const idAntigo = s.id;
    try {
      const basePayload = {
        nome: s.nome,
        descricao: s.descricao ?? null,
        status: s.status ?? 'aberta',
        created_at: s.created_at,
        updated_at: s.updated_at ?? new Date().toISOString(),
        user_id: s.user_id ?? null,
      };
      const idValido = SACA_UUID_RE.test(s.id ?? '');

      if (idValido) {
        const { error } = await sb
          .from('sacas')
          .upsert({ id: s.id, ...basePayload }, { onConflict: 'id' });
        if (!error) {
          ok += 1;
          continue;
        }
        console.warn('[sincronia-sacas] upsert por id falhou, tentando insert sem id:', s.id, error);
        if (!primeiroErro) primeiroErro = `upsert saca: ${(error as { message?: string })?.message ?? String(error)}`;
      }

      const { data, error: insertErr } = await sb
        .from('sacas')
        .insert(basePayload)
        .select('id')
        .maybeSingle();
      if (!insertErr && data) {
        const novoId = (data as { id: string }).id;
        locais[i] = { ...s, id: novoId };
        if (idAntigo !== novoId) idsRemapeados[idAntigo] = novoId;
        ok += 1;
      } else {
        if (insertErr && /duplicate|unique|23505/i.test((insertErr as { message?: string; code?: string }).message ?? (insertErr as { code?: string }).code ?? '')) {
          ok += 1;
        } else {
          const msg = (insertErr as { message?: string; code?: string })?.message
            ?? (insertErr as { code?: string })?.code
            ?? 'erro desconhecido';
          console.error('[sincronia-sacas] falha definitiva saca:', s.nome, insertErr);
          if (!primeiroErro) primeiroErro = `saca ${s.nome}: ${msg}`;
          falha += 1;
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[sincronia-sacas] catch:', s?.nome, e);
      if (!primeiroErro) primeiroErro = `catch saca: ${msg}`;
      falha += 1;
    }
  }
  salvarSacasLocal(locais);

  if (Object.keys(idsRemapeados).length) {
    console.log('[sincronia-sacas] ids remapeados:', idsRemapeados);
    await corrigirSacaIdsNosPacotes(idsRemapeados);
    const ativaLocal = pegarIdSacaAtiva();
    if (ativaLocal && idsRemapeados[ativaLocal]) salvarIdSacaAtiva(idsRemapeados[ativaLocal]);
  }

  console.log('[sincronia-sacas] resultado sacas:', { sincronizados: ok, falhas: falha, total: locais.length });
  return { sincronizados: ok, falhas: falha, total: locais.length, primeiroErro, idsRemapeados };
}

export const SacaService = {
  async listar(): Promise<Saca[]> {
    if (!isSupabaseConfigurado) {
      return lerSacasLocal().sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    try {
      await sincronizarSacasAgora();
      const sb = getSupabase();
      if (!sb) return lerSacasLocal();
      const { data, error } = await sb
        .from('sacas')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error || !data) return lerSacasLocal();
      const locais = lerSacasLocal();
      const mapaLocal = new Map(locais.map((s) => [s.id, s]));
      const todos: Saca[] = [];
      const ids = new Set<string>();
      for (const item of data as Saca[]) {
        ids.add(item.id);
        todos.push(mapaLocal.get(item.id) ?? item);
      }
      for (const local of locais) {
        if (!ids.has(local.id)) todos.push(local);
      }
      todos.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return todos;
    } catch {
      return lerSacasLocal();
    }
  },

  async criar(nome: string, extra: Partial<Saca> = {}): Promise<Saca> {
    const nomeTratado = nome.trim();
    if (!nomeTratado) throw new Error('Nome da saca é obrigatório');

    const agora = new Date().toISOString();
    const nova: Saca = {
      id: extra.id ?? gerarId(),
      user_id: extra.user_id ?? null,
      nome: nomeTratado,
      descricao: extra.descricao ?? null,
      status: (extra.status ?? 'aberta') as StatusSaca,
      created_at: extra.created_at ?? agora,
      updated_at: agora,
    };

    const locais = lerSacasLocal();
    locais.unshift(nova);
    salvarSacasLocal(locais);
    salvarIdSacaAtiva(nova.id);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          const { error } = await sb.from('sacas').insert(nova);
          if (!error) {
            const atualizados = lerSacasLocal();
            const idx = atualizados.findIndex((s) => s.id === nova.id);
            if (idx >= 0) {
              atualizados[idx] = nova;
              salvarSacasLocal(atualizados);
            }
          }
        }
      } catch {
        /* noop */
      }
    }
    return nova;
  },

  async atualizar(id: string, patch: Partial<Saca>): Promise<void> {
    const locais = lerSacasLocal();
    const idx = locais.findIndex((s) => s.id === id);
    if (idx < 0) return;
    locais[idx] = { ...locais[idx], ...patch, updated_at: new Date().toISOString() };
    salvarSacasLocal(locais);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          await sb
            .from('sacas')
            .update({ ...patch, updated_at: new Date().toISOString() })
            .eq('id', id);
        }
      } catch {
        /* noop */
      }
    }
  },

  async fechar(id: string): Promise<void> {
    await SacaService.atualizar(id, { status: 'fechada' });
  },

  async reabrir(id: string): Promise<void> {
    await SacaService.atualizar(id, { status: 'aberta' });
  },

  async remover(id: string): Promise<void> {
    const locais = lerSacasLocal().filter((s) => s.id !== id);
    salvarSacasLocal(locais);
    const ativa = pegarIdSacaAtiva();
    if (ativa === id) salvarIdSacaAtiva(null);

    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          await sb.from('pacotes_lidos').delete().eq('saca_id', id);
          await sb.from('sacas').delete().eq('id', id);
        }
      } catch {
        /* noop */
      }
    }
  },

  async ativar(id: string): Promise<void> {
    salvarIdSacaAtiva(id);
  },

  async desativar(): Promise<void> {
    salvarIdSacaAtiva(null);
  },

  async pegarAtiva(): Promise<Saca | null> {
    const id = pegarIdSacaAtiva();
    const todas = await SacaService.listar();
    if (id) {
      const match = todas.find((s) => s.id === id);
      if (match) return match;
    }
    const hoje = new Date();
    const inicio = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 0, 0, 0, 0).toISOString();
    const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate(), 23, 59, 59, 999).toISOString();
    const sacasDeHoje = todas.filter((s) => s.created_at >= inicio && s.created_at <= fim);
    if (!sacasDeHoje.length) return null;
    sacasDeHoje.sort((a, b) => {
      if (a.status !== b.status) return a.status === 'aberta' ? -1 : 1;
      return b.created_at.localeCompare(a.created_at);
    });
    const escolhida = sacasDeHoje[0];
    salvarIdSacaAtiva(escolhida.id);
    return escolhida;
  },

  async resumos(): Promise<ResumoSaca[]> {
    const sacas = await SacaService.listar();
    const todosPacotes = await PacoteService.listarTodasSacas();
    return sacas.map((saca) => {
      const daSaca = todosPacotes.filter((p) => p.saca_id === saca.id);
      const unicos = new Set(daSaca.map((p) => p.codigo_pacote));
      return { saca, total: daSaca.length, unicos: unicos.size };
    });
  },

  async sincronizarAgora(): Promise<{
    sincronizados: number;
    falhas: number;
    total: number;
    primeiroErro: string | null;
    idsRemapeados: Record<string, string>;
  }> {
    return sincronizarSacasAgora();
  },
};
