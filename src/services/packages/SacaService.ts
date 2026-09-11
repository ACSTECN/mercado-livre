import type { Saca, StatusSaca, ResumoSaca } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId } from '@/lib/utils';
import { PacoteService } from './PacoteService';

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

async function sincronizarSacasComSupabase(): Promise<void> {
  if (!isSupabaseConfigurado) return;
  const sb = getSupabase();
  if (!sb) return;

  const locais = lerSacasLocal();
  for (const s of locais) {
    try {
      await sb
        .from('sacas')
        .upsert(s, { onConflict: 'id' });
    } catch {
      /* continua */
    }
  }
}

export const SacaService = {
  async listar(): Promise<Saca[]> {
    if (!isSupabaseConfigurado) {
      return lerSacasLocal().sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    try {
      await sincronizarSacasComSupabase();
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
};
