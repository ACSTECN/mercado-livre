import type { PacoteLido, PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId } from '@/lib/utils';
import { exportarParaCsv } from '../spreadsheet/ExcelService';
import { pegarIdSacaAtiva } from './SacaService';

const CHAVE_LOCAL = 'ml_pacotes_lidos_v1';

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

async function sincronizarComSupabase(): Promise<void> {
  if (!isSupabaseConfigurado) return;
  const sb = getSupabase();
  if (!sb) return;

  const locais = lerLocal();
  const naoSincronizados = locais.filter((p) => !p.sincronizado);

  for (const p of naoSincronizados) {
    try {
      const payload = {
        codigo_pacote: p.codigo_pacote,
        tipo: p.tipo ?? null,
        origem: p.origem,
        metadados: p.metadados ?? {},
        created_at: p.created_at,
        user_id: p.user_id ?? null,
        saca_id: p.saca_id ?? null,
      };
      const { error } = await sb
        .from('pacotes_lidos')
        .upsert({ id: p.id, ...payload }, { onConflict: 'codigo_pacote', ignoreDuplicates: true });
      if (!error || (error && /duplicate|unique/i.test(error.message ?? ''))) {
        p.sincronizado = true;
      }
    } catch {
      /* continua */
    }
  }
  salvarLocal(locais);
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

export const PacoteService = {
  async listarTodasSacas(): Promise<PacoteLidoLocal[]> {
    if (!isSupabaseConfigurado) {
      return lerLocal().sort((a, b) => b.created_at.localeCompare(a.created_at));
    }
    try {
      await sincronizarComSupabase();
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

    const novo: PacoteLidoLocal = {
      id: extra.id ?? gerarId(),
      codigo_pacote: trimmed,
      tipo: extra.tipo ?? null,
      origem,
      metadados: extra.metadados ?? null,
      created_at: extra.created_at ?? new Date().toISOString(),
      user_id: extra.user_id ?? null,
      saca_id,
      sincronizado: false,
    };

    locais.unshift(novo);
    salvarLocal(locais);

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
            user_id: novo.user_id,
            saca_id: novo.saca_id,
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
    };
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
        Origem: h.origem === 'camera' ? 'Câmera' : h.origem === 'leitor_externo' ? 'Leitor externo' : 'Manual',
        Data: d.toLocaleDateString('pt-BR'),
        Hora: d.toLocaleTimeString('pt-BR'),
        Sincronizado: h.sincronizado ? 'Sim' : 'Não',
      };
    });
    await exportarParaCsv(linhas, nomeArquivo ?? `contagem_pacotes_${Date.now()}.xlsx`);
  },
};
