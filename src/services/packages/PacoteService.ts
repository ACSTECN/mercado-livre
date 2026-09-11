import type { PacoteLido, PacoteLidoLocal, OrigemLeitura } from '@/types';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';
import { gerarId } from '@/lib/utils';
import { exportarParaCsv } from '../spreadsheet/ExcelService';

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
      };
      const { error } = await sb
        .from('pacotes_lidos')
        .upsert({ id: p.id, ...payload }, { onConflict: 'id' });
      if (!error) {
        p.sincronizado = true;
      }
    } catch {
      /* continua */
    }
  }
  salvarLocal(locais);
}

export const PacoteService = {
  async listar(): Promise<PacoteLidoLocal[]> {
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
        .limit(1000);

      if (error || !data) {
        return lerLocal();
      }

      const locais = lerLocal();
      const mapaLocal = new Map(locais.map((p) => [p.id, p]));

      const todos: PacoteLidoLocal[] = [];
      const idsVistos = new Set<string>();

      for (const item of data as PacoteLido[]) {
        idsVistos.add(item.id);
        const local = mapaLocal.get(item.id);
        todos.push({ ...item, sincronizado: true });
      }

      for (const local of locais) {
        if (!idsVistos.has(local.id)) {
          todos.push(local);
        }
      }

      todos.sort((a, b) => b.created_at.localeCompare(a.created_at));
      return todos;
    } catch {
      return lerLocal();
    }
  },

  async adicionar(
    codigo_pacote: string,
    origem: OrigemLeitura,
    extra: Partial<PacoteLido> = {},
  ): Promise<PacoteLidoLocal> {
    const trimmed = codigo_pacote.trim();
    if (!trimmed) throw new Error('Código vazio');

    const novo: PacoteLidoLocal = {
      id: extra.id ?? gerarId(),
      codigo_pacote: trimmed,
      tipo: extra.tipo ?? null,
      origem,
      metadados: extra.metadados ?? null,
      created_at: extra.created_at ?? new Date().toISOString(),
      user_id: extra.user_id ?? null,
      sincronizado: false,
    };

    const locais = lerLocal();
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
          };
          const { error } = await sb.from('pacotes_lidos').insert(payload);
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

    return novo;
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

  async limpar(): Promise<void> {
    salvarLocal([]);
    if (isSupabaseConfigurado) {
      try {
        const sb = getSupabase();
        if (sb) {
          await sb.from('pacotes_lidos').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        }
      } catch {
        /* noop */
      }
    }
  },

  async contar(): Promise<{ total: number; unicos: number }> {
    const lista = await PacoteService.listar();
    const unicos = new Set(lista.map((p) => p.codigo_pacote));
    return { total: lista.length, unicos: unicos.size };
  },

  async exportarCsv(): Promise<void> {
    const itens = await PacoteService.listar();
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
    await exportarParaCsv(linhas, `contagem_pacotes_${Date.now()}.xlsx`);
  },
};
