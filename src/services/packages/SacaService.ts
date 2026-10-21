import type { Saca, StatusSaca, ResumoSaca } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId } from '@/lib/utils';
import { PacoteService } from './PacoteService';

/**
 * Camada de acesso a sacas.
 *
 * FONTE ÚNICA DA VERDADE = Supabase. Toda leitura vem do banco e toda escrita
 * é confirmada pelo banco antes de retornar. Apenas a "saca ativa" (preferência
 * de interface do aparelho) permanece local.
 */

const CHAVE_SACA_ATIVA = 'ml_saca_ativa_id_v1';
const LIMITE_SACAS = 500;

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

export const SacaService = {
  async listar(): Promise<Saca[]> {
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) return [];
    const { data, error } = await sb
      .from('sacas')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(LIMITE_SACAS);
    if (error) throw new Error(error.message);
    return (data ?? []) as Saca[];
  },

  async criar(nome: string, extra: Partial<Saca> = {}): Promise<Saca> {
    const nomeTratado = nome.trim();
    if (!nomeTratado) throw new Error('Nome da saca é obrigatório');

    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');

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

    const { data, error } = await sb
      .from('sacas')
      .insert({
        id: nova.id,
        nome: nova.nome,
        descricao: nova.descricao ?? null,
        status: nova.status,
        created_at: nova.created_at,
        updated_at: nova.updated_at,
      })
      .select('*')
      .maybeSingle();
    if (error) throw new Error(error.message);

    const criada = ((data as Saca) ?? nova);
    salvarIdSacaAtiva(criada.id);
    return criada;
  },

  async atualizar(id: string, patch: Partial<Saca>): Promise<void> {
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');
    const { error } = await sb
      .from('sacas')
      .update({ ...patch, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) throw new Error(error.message);
  },

  async fechar(id: string): Promise<void> {
    await SacaService.atualizar(id, { status: 'fechada' });
  },

  async reabrir(id: string): Promise<void> {
    await SacaService.atualizar(id, { status: 'aberta' });
  },

  async remover(id: string): Promise<void> {
    const sb = getSupabase();
    if (!isSupabaseConfigurado || !sb) throw new Error('Banco de dados não configurado');
    const { error: errPacotes } = await sb.from('pacotes_lidos').delete().eq('saca_id', id);
    if (errPacotes) throw new Error(errPacotes.message);
    const { error } = await sb.from('sacas').delete().eq('id', id);
    if (error) throw new Error(error.message);
    if (pegarIdSacaAtiva() === id) salvarIdSacaAtiva(null);
  },

  async ativar(id: string): Promise<void> {
    salvarIdSacaAtiva(id);
  },

  async desativar(): Promise<void> {
    salvarIdSacaAtiva(null);
  },

  async pegarAtiva(): Promise<Saca | null> {
    const todas = await SacaService.listar();
    const id = pegarIdSacaAtiva();
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
