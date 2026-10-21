import { create } from 'zustand';
import type { PacoteLido, PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote, Saca, ResumoSaca, ResultadoMoverPacote, StatusPacote } from '@/types';
import { PacoteService, adicionarEntregador, removerEntregador, renomearEntregador, listarEntregadores, invalidarCacheEntregadores, inscreverRealtimePacotes } from '@/services/packages/PacoteService';
import { SacaService } from '@/services/packages/SacaService';
import { getSupabase, isSupabaseConfigurado } from '@/lib/supabase';

type ContagemEntregador = { nome: string; qtd: number; retornos: number; entregues: number; devolucoes: number; lidos: number };

type PacoteState = {
  pacotes: PacoteLidoLocal[];
  sacas: Saca[];
  resumos: ResumoSaca[];
  sacaAtiva: Saca | null;
  carregando: boolean;
  carregandoSacas: boolean;
  ultimoLido: PacoteLidoLocal | null;
  ultimoDuplicado: PacoteLidoLocal | null;
  ultimoResultado: ResultadoAdicaoPacote | null;
  ultimoMovido: PacoteLidoLocal | null;
  ultimoResultadoMover: ResultadoMoverPacote | null;
  ultimoAlteradoStatus: { id: string; status: StatusPacote | null; ts: number } | null;
  mostrarModalSaca: boolean;
  mostrarHistoricoSacas: boolean;

  entregadorAtivo: string | null;
  entregadores: string[];
  entregadoresSaca: string[];
  contagensEntregadores: ContagemEntregador[];

  carregar: () => Promise<void>;
  carregarTodasSacas: () => Promise<void>;
  carregarSacas: () => Promise<void>;
  definirSacaAtiva: (sacaId: string) => Promise<void>;
  criarSaca: (nome: string, descricao?: string) => Promise<Saca>;
  fecharSacaAtiva: () => Promise<void>;
  fecharSaca: (id: string) => Promise<void>;
  reabrirSaca: (id: string) => Promise<void>;
  removerSaca: (id: string) => Promise<void>;
  abrirModalSaca: () => void;
  fecharModalSaca: () => void;
  abrirHistoricoSacas: () => void;
  fecharHistoricoSacas: () => void;

  definirEntregador: (nome: string | null) => Promise<void>;
  cadastrarEntregador: (nome: string) => Promise<string[]>;
  removerEntregador: (nome: string) => Promise<string[]>;
  renomearEntregador: (nomeAntigo: string, nomeNovo: string) => Promise<string[]>;
  carregarEntregadoresBanco: () => Promise<void>;

  adicionar: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<ResultadoAdicaoPacote>;
  moverPacote: (id: string, novoEntregador: string, origemMovimento?: 'manual' | 're_scan') => Promise<ResultadoMoverPacote>;
  adicionarOuMover: (codigo: string, origem: OrigemLeitura, extra?: Partial<PacoteLidoLocal>) => Promise<{ tipo: 'adicao' | 'movimento' | 'duplicado_mesmo_entregador' | 'erro'; resultado: ResultadoAdicaoPacote | ResultadoMoverPacote }>;
  definirStatus: (id: string, status: StatusPacote | null) => Promise<void>;
  definirStatusEmLote: (ids: string[], status: StatusPacote | null) => Promise<void>;
  definirEntregadorEmLote: (ids: string[], entregador: string | null) => Promise<{ atualizados: number; falhas: number }>;
  importarLotePorEntregador: (porEntregador: Record<string, string[]>, origem?: string) => Promise<{
    importados: number;
    duplicados: number;
    falhas: number;
    porEntregador: Record<string, { importados: number; duplicados: number }>;
  }>;
  importarLotePorZona: (porZona: Record<string, string[]>, origem?: string, entregadorDestino?: string | null) => Promise<{
    importados: number;
    duplicados: number;
    falhas: number;
    porZona: Record<string, { importados: number; duplicados: number }>;
  }>;
  alternarStatusRetorno: (id: string) => Promise<void>;
  ciclarStatus: (id: string) => Promise<void>;
  remover: (id: string) => Promise<void>;
  removerEmLote: (ids: string[]) => Promise<{ removidos: number }>;
  limpar: () => Promise<void>;
  total: () => number;
  unicos: () => number;
  contarPorStatus: () => { lido: number; entregue: number; retorno: number; devolucao: number; semStatus: number };
  exportar: (listaFiltrada?: PacoteLidoLocal[], sufixoNomeArquivo?: string) => Promise<void>;
  limparFeedback: () => void;
  inscreverRealtime: () => () => void;
  forcarSincronizacaoCompleta: () => Promise<{
    sacas: { sincronizados: number; falhas: number; total: number; primeiroErro: string | null };
    pacotes: { sincronizados: number; falhas: number; total: number; primeiroErro: string | null };
  }>;
};

/**
 * Única preferência guardada no aparelho: qual entregador está ativo na tela.
 * Nenhum registro (pacote/saca) é armazenado localmente — a fonte é o banco.
 */
const CHAVE_ENTREGADOR_ATIVO = 'ml_entregador_ativo_v1';

function recalcular(pacotes: PacoteLidoLocal[]): { entregadoresSaca: string[]; contagens: ContagemEntregador[] } {
  const mapaQtd = new Map<string, number>();
  const mapaRetornos = new Map<string, number>();
  const mapaEntregues = new Map<string, number>();
  const mapaDevolucoes = new Map<string, number>();
  const mapaLidos = new Map<string, number>();
  for (const p of pacotes) {
    const k = p.entregador ?? 'Sem entregador';
    mapaQtd.set(k, (mapaQtd.get(k) ?? 0) + 1);
    if (p.status === 'retorno') mapaRetornos.set(k, (mapaRetornos.get(k) ?? 0) + 1);
    if (p.status === 'entregue') mapaEntregues.set(k, (mapaEntregues.get(k) ?? 0) + 1);
    if (p.status === 'devolucao') mapaDevolucoes.set(k, (mapaDevolucoes.get(k) ?? 0) + 1);
    if (p.status === 'lido') mapaLidos.set(k, (mapaLidos.get(k) ?? 0) + 1);
  }
  const contagens: ContagemEntregador[] = [];
  for (const [nome, qtd] of mapaQtd.entries()) {
    contagens.push({
      nome,
      qtd,
      retornos: mapaRetornos.get(nome) ?? 0,
      entregues: mapaEntregues.get(nome) ?? 0,
      devolucoes: mapaDevolucoes.get(nome) ?? 0,
      lidos: mapaLidos.get(nome) ?? 0,
    });
  }
  contagens.sort((a, b) => b.qtd - a.qtd);

  const nomes = new Set<string>();
  for (const p of pacotes) {
    if (p.entregador) nomes.add(p.entregador);
  }
  return { entregadoresSaca: Array.from(nomes), contagens };
}

function arraysIguais(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

function ordenarNomes(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

function chavePacote(p: { codigo_pacote: string; saca_id?: string | null }): string {
  return `${p.codigo_pacote}__${p.saca_id ?? 'null'}`;
}

function carregarEntregadorAtivo(): string | null {
  try {
    return localStorage.getItem(CHAVE_ENTREGADOR_ATIVO);
  } catch {
    return null;
  }
}

function salvarEntregadorAtivo(nome: string | null) {
  try {
    if (nome) localStorage.setItem(CHAVE_ENTREGADOR_ATIVO, nome);
    else localStorage.removeItem(CHAVE_ENTREGADOR_ATIVO);
  } catch {
    /* noop */
  }
}

const inicial = recalcular([]);

export const usePacoteStore = create<PacoteState>((set, get) => ({
  pacotes: [],
  sacas: [],
  resumos: [],
  sacaAtiva: null,
  carregando: false,
  carregandoSacas: false,
  ultimoLido: null,
  ultimoDuplicado: null,
  ultimoResultado: null,
  ultimoMovido: null,
  ultimoResultadoMover: null,
  ultimoAlteradoStatus: null,
  mostrarModalSaca: false,
  mostrarHistoricoSacas: false,

  entregadorAtivo: carregarEntregadorAtivo(),
  entregadores: [],
  entregadoresSaca: inicial.entregadoresSaca,
  contagensEntregadores: inicial.contagens,

  carregarEntregadoresBanco: async () => {
    try {
      invalidarCacheEntregadores();
      const lista = await listarEntregadores(true);
      if (!arraysIguais(get().entregadores, lista)) set({ entregadores: lista });
    } catch {
      /* noop */
    }
  },

  carregarSacas: async () => {
    set({ carregandoSacas: true });
    try {
      const [sacas, resumos, ativa, entregadores] = await Promise.all([
        SacaService.listar(),
        SacaService.resumos(),
        SacaService.pegarAtiva(),
        listarEntregadores(false),
      ]);
      const patch: Partial<PacoteState> = {
        sacas,
        resumos,
        sacaAtiva: ativa,
        carregandoSacas: false,
      };
      if (!arraysIguais(get().entregadores, entregadores)) patch.entregadores = entregadores;
      set(patch as PacoteState);
    } catch {
      set({ carregandoSacas: false });
    }
  },

  definirSacaAtiva: async (sacaId) => {
    await SacaService.ativar(sacaId);
    const saca = (await SacaService.listar()).find((s) => s.id === sacaId) ?? null;
    set({ sacaAtiva: saca, mostrarModalSaca: false, mostrarHistoricoSacas: false });
    await get().carregar();
  },

  criarSaca: async (nome, descricao) => {
    const saca = await SacaService.criar(nome, descricao ? { descricao } : undefined);
    await get().carregarSacas();
    set({
      sacaAtiva: saca,
      mostrarModalSaca: false,
      pacotes: [],
      entregadoresSaca: [],
      contagensEntregadores: [],
    });
    return saca;
  },

  fecharSacaAtiva: async () => {
    const a = get().sacaAtiva;
    if (!a) return;
    await get().fecharSaca(a.id);
  },

  fecharSaca: async (id) => {
    await SacaService.fechar(id);
    await get().carregarSacas();
  },

  reabrirSaca: async (id) => {
    await SacaService.reabrir(id);
    await get().carregarSacas();
  },

  removerSaca: async (id) => {
    await SacaService.remover(id);
    const a = get().sacaAtiva;
    if (a && a.id === id) {
      set({
        sacaAtiva: null,
        pacotes: [],
        entregadoresSaca: [],
        contagensEntregadores: [],
      });
    }
    await get().carregarSacas();
    await get().carregar();
  },

  abrirModalSaca: () => set({ mostrarModalSaca: true }),
  fecharModalSaca: () => set({ mostrarModalSaca: false }),
  abrirHistoricoSacas: () => set({ mostrarHistoricoSacas: true }),
  fecharHistoricoSacas: () => set({ mostrarHistoricoSacas: false }),

  definirEntregador: async (nome) => {
    const limpo = nome ? nome.trim() : null;
    salvarEntregadorAtivo(limpo);
    const patch: Partial<PacoteState> = { entregadorAtivo: limpo };
    if (limpo) {
      const cadastrados = get().entregadores;
      if (!cadastrados.some((s) => s.toLowerCase() === limpo.toLowerCase())) {
        const arr = await adicionarEntregador(limpo);
        patch.entregadores = arr;
      }
    }
    set(patch as PacoteState);
  },

  cadastrarEntregador: async (nome) => {
    const arr = await adicionarEntregador(nome);
    if (!arraysIguais(get().entregadores, arr)) set({ entregadores: arr });
    return arr;
  },
  removerEntregador: async (nome) => {
    const arr = await removerEntregador(nome);
    if (!arraysIguais(get().entregadores, arr)) set({ entregadores: arr });
    return arr;
  },
  renomearEntregador: async (nomeAntigo, nomeNovo) => {
    const arr = await renomearEntregador(nomeAntigo, nomeNovo);
    if (!arraysIguais(get().entregadores, arr)) {
      const patch: Partial<PacoteState> = { entregadores: arr };
      const ativo = get().entregadorAtivo;
      if (ativo && ativo.toLowerCase() === nomeAntigo.trim().toLowerCase()) {
        salvarEntregadorAtivo(nomeNovo.trim());
        patch.entregadorAtivo = nomeNovo.trim();
      }
      set(patch as PacoteState);
    }
    return arr;
  },

  carregar: async () => {
    set({ carregando: true });
    try {
      if (!get().sacas.length || !get().sacaAtiva) await get().carregarSacas();
      const sacaId = get().sacaAtiva?.id ?? null;
      const [lista, entregadores] = await Promise.all([
        PacoteService.listar(sacaId),
        listarEntregadores(false),
      ]);
      const r = recalcular(lista);
      const patch: Partial<PacoteState> = {
        pacotes: lista,
        carregando: false,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      if (!arraysIguais(get().entregadores, entregadores)) patch.entregadores = entregadores;
      set(patch as PacoteState);
    } catch {
      set({ carregando: false });
    }
  },

  carregarTodasSacas: async () => {
    set({ carregando: true });
    try {
      if (!get().sacas.length) await get().carregarSacas();
      const [lista, entregadores] = await Promise.all([
        PacoteService.listarTodasSacas(),
        listarEntregadores(false),
      ]);
      const r = recalcular(lista);
      const patch: Partial<PacoteState> = {
        pacotes: lista,
        carregando: false,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      if (!arraysIguais(get().entregadores, entregadores)) patch.entregadores = entregadores;
      set(patch as PacoteState);
    } catch {
      set({ carregando: false });
    }
  },

  adicionar: async (codigo, origem, extra = {}) => {
    if (!codigo.trim()) {
      const r: ResultadoAdicaoPacote = { sucesso: false, duplicado: false, mensagem: 'Código vazio' };
      set({ ultimoResultado: r });
      return r;
    }
    try {
      const sacaAtual = get().sacaAtiva;
      const entregadorAtual = get().entregadorAtivo;
      const resultado = await PacoteService.adicionar(codigo, origem, {
        ...extra,
        saca_id: sacaAtual?.id ?? undefined,
        entregador: entregadorAtual ?? extra.entregador ?? undefined,
      });

      const patch: Partial<PacoteState> = { ultimoResultado: resultado };
      let lista = get().pacotes;

      if (resultado.sucesso && resultado.pacote) {
        const alvo = resultado.pacote;
        const jaTem = lista.some((p) => p.id === alvo.id || chavePacote(p) === chavePacote(alvo));
        if (!jaTem) lista = [alvo, ...lista];
        patch.ultimoLido = alvo;
        patch.ultimoDuplicado = null;
        if (alvo.status === 'retorno') {
          patch.ultimoAlteradoStatus = { id: alvo.id, status: 'retorno', ts: Date.now() };
        }
        if (entregadorAtual) {
          const antigos = get().entregadores;
          if (!antigos.some((s) => s.toLowerCase() === entregadorAtual.toLowerCase())) {
            void adicionarEntregador(entregadorAtual).then((arr) => {
              if (!arraysIguais(get().entregadores, arr)) set({ entregadores: arr });
            });
          }
        }
      } else if (resultado.duplicado && resultado.existente) {
        const alvo = resultado.existente;
        const jaTem = lista.some((p) => p.id === alvo.id || chavePacote(p) === chavePacote(alvo));
        if (!jaTem) lista = [alvo, ...lista];
        patch.ultimoLido = null;
        patch.ultimoDuplicado = alvo;
      }

      const r = recalcular(lista);
      patch.pacotes = lista;
      patch.entregadoresSaca = r.entregadoresSaca;
      patch.contagensEntregadores = r.contagens;
      set(patch as PacoteState);
      return resultado;
    } catch (e) {
      const r: ResultadoAdicaoPacote = {
        sucesso: false,
        duplicado: false,
        mensagem: e instanceof Error ? e.message : 'Erro desconhecido',
      };
      set({ ultimoResultado: r });
      return r;
    }
  },

  moverPacote: async (id, novoEntregador, origemMovimento = 'manual') => {
    const limpo = novoEntregador.trim();
    if (!limpo) {
      const r = { sucesso: false, movido: false, mensagem: 'Entregador inválido' } as const;
      set({ ultimoResultadoMover: r });
      return r;
    }
    const atualPacotes = get().pacotes;
    const idx = atualPacotes.findIndex((p) => p.id === id);
    if (idx < 0) {
      const r = { sucesso: false, movido: false, mensagem: 'Pacote não encontrado' } as const;
      set({ ultimoResultadoMover: r });
      return r;
    }
    if (atualPacotes[idx].entregador === limpo) {
      const r: ResultadoMoverPacote = {
        sucesso: true,
        movido: false,
        pacote: atualPacotes[idx],
        mensagem: 'Já está neste entregador',
      };
      set({ ultimoResultadoMover: r });
      return r;
    }

    const resultado = await PacoteService.mover(id, limpo, origemMovimento);
    if (!resultado.sucesso || !resultado.pacote) {
      set({ ultimoResultadoMover: resultado });
      return resultado;
    }

    const lista = [...get().pacotes];
    const i2 = lista.findIndex((p) => p.id === id);
    if (i2 >= 0) lista[i2] = resultado.pacote;
    const r = recalcular(lista);
    const patch: Partial<PacoteState> = {
      pacotes: lista,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
      ultimoMovido: resultado.pacote,
      ultimoResultadoMover: resultado,
    };
    if (!get().entregadores.some((s) => s.toLowerCase() === limpo.toLowerCase())) {
      patch.entregadores = ordenarNomes([limpo, ...get().entregadores]);
      void adicionarEntregador(limpo).then((arr) => {
        if (!arraysIguais(get().entregadores, arr)) set({ entregadores: arr });
      });
    }
    set(patch as PacoteState);
    return resultado;
  },

  adicionarOuMover: async (codigo, origem, extra = {}) => {
    const entregadorAtual = get().entregadorAtivo;

    const tentativaAdicao = await get().adicionar(codigo, origem, extra);

    if (tentativaAdicao.sucesso) {
      return { tipo: 'adicao' as const, resultado: tentativaAdicao };
    }

    if (tentativaAdicao.duplicado && tentativaAdicao.existente && entregadorAtual) {
      const existente = tentativaAdicao.existente;
      const entregadorDoExistente = existente.entregador ?? null;

      if (entregadorDoExistente === entregadorAtual) {
        return { tipo: 'duplicado_mesmo_entregador' as const, resultado: tentativaAdicao };
      }

      const resultadoMover = await get().moverPacote(existente.id, entregadorAtual, 're_scan');
      return { tipo: 'movimento' as const, resultado: resultadoMover };
    }

    return { tipo: 'erro' as const, resultado: tentativaAdicao };
  },

  definirStatus: async (id, status) => {
    const confirmado = await PacoteService.definirStatus(id, status);
    if (!confirmado) return;
    const atual = get().pacotes;
    const idx = atual.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const lista = [...atual];
    lista[idx] = confirmado;
    const r = recalcular(lista);
    set({
      pacotes: lista,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
      ultimoAlteradoStatus: { id, status, ts: Date.now() },
    });
  },

  definirStatusEmLote: async (ids, status) => {
    if (!ids.length) return;
    const resultados = await Promise.all(
      ids.map((id) => PacoteService.definirStatus(id, status).catch(() => null)),
    );
    const mapa = new Map(resultados.filter((p): p is PacoteLidoLocal => !!p).map((p) => [p.id, p]));
    if (!mapa.size) return;
    const lista = get().pacotes.map((p) => mapa.get(p.id) ?? p);
    const r = recalcular(lista);
    set({
      pacotes: lista,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
  },

  definirEntregadorEmLote: async (ids, entregador) => {
    if (!ids.length) return { atualizados: 0, falhas: 0 };
    const limpo = entregador == null ? '' : entregador.trim();
    let atualizados = 0;
    let falhas = 0;

    const sb = getSupabase();
    const resultados = await Promise.all(
      ids.map(async (id): Promise<PacoteLidoLocal | null> => {
        try {
          if (limpo) {
            const res = await PacoteService.mover(id, limpo, 'manual');
            if (res.sucesso && res.pacote) {
              atualizados++;
              return res.pacote;
            }
            falhas++;
            return null;
          }
          if (!isSupabaseConfigurado || !sb) {
            falhas++;
            return null;
          }
          const { data, error } = await sb
            .from('pacotes_lidos')
            .update({ entregador: null })
            .eq('id', id)
            .select('*')
            .maybeSingle();
          if (error || !data) {
            falhas++;
            return null;
          }
          atualizados++;
          return { ...(data as PacoteLido), sincronizado: true } as PacoteLidoLocal;
        } catch {
          falhas++;
          return null;
        }
      }),
    );

    const mapa = new Map(resultados.filter((p): p is PacoteLidoLocal => !!p).map((p) => [p.id, p]));
    if (mapa.size) {
      const lista = get().pacotes.map((p) => mapa.get(p.id) ?? p);
      const r = recalcular(lista);
      set({
        pacotes: lista,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      });
    }
    if (limpo) {
      const arr = await adicionarEntregador(limpo);
      if (!arraysIguais(get().entregadores, arr)) set({ entregadores: arr });
    }
    return { atualizados, falhas };
  },

  importarLotePorZona: async (porZona, origem = 'import_json_zona', entregadorDestino?: string | null) => {
    const origemLeitura = origem as OrigemLeitura;
    const resumoPorZona: Record<string, { importados: number; duplicados: number }> = {};
    let importados = 0;
    let duplicados = 0;
    let falhas = 0;

    const sacaAtual = get().sacaAtiva;
    const listaOriginal = get().pacotes;
    const pacotesAdicionar: PacoteLidoLocal[] = [];
    const codigosVistos = new Set<string>();
    const novosEntregadores: string[] = [];

    const nomesZonas = Object.keys(porZona);
    for (const nome of nomesZonas) {
      resumoPorZona[nome] = { importados: 0, duplicados: 0 };
      const ids = porZona[nome] ?? [];
      const entregadorDoPacote = entregadorDestino != null && entregadorDestino !== '' ? entregadorDestino : nome;
      for (const cod of ids) {
        try {
          const resultado = await PacoteService.adicionar(cod, origemLeitura, {
            saca_id: sacaAtual?.id ?? undefined,
            entregador: entregadorDoPacote,
            zona_ml: nome,
            status: 'lido',
          });
          let pacoteParaLista: PacoteLidoLocal | null = null;
          if (resultado.sucesso && resultado.pacote) {
            pacoteParaLista = resultado.pacote;
            importados++;
            resumoPorZona[nome].importados++;
          } else if (resultado.duplicado && resultado.existente) {
            pacoteParaLista = resultado.existente;
            duplicados++;
            resumoPorZona[nome].duplicados++;
          }
          if (pacoteParaLista) {
            const chave = chavePacote(pacoteParaLista);
            if (codigosVistos.has(chave)) continue;
            codigosVistos.add(chave);
            pacotesAdicionar.push(pacoteParaLista);
            const entNome = pacoteParaLista.entregador;
            if (entNome && !novosEntregadores.some((x) => x.toLowerCase() === entNome.toLowerCase()) && !get().entregadores.some((x) => x.toLowerCase() === entNome.toLowerCase())) {
              novosEntregadores.push(entNome);
            }
          }
        } catch {
          falhas++;
        }
      }
    }

    if (pacotesAdicionar.length > 0) {
      const chavesNovas = new Set(pacotesAdicionar.map(chavePacote));
      const listaFiltrada = listaOriginal.filter((p) => !chavesNovas.has(chavePacote(p)));
      const nova = [...pacotesAdicionar, ...listaFiltrada];
      const r = recalcular(nova);
      const patch: Partial<PacoteState> = {
        pacotes: nova,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      if (novosEntregadores.length > 0) {
        patch.entregadores = ordenarNomes([...get().entregadores, ...novosEntregadores]);
        novosEntregadores.forEach((n) => void adicionarEntregador(n));
      }
      set(patch as PacoteState);
    }

    return { importados, duplicados, falhas, porZona: resumoPorZona };
  },

  importarLotePorEntregador: async (porEntregador, origem = 'import_json_rotas') => {
    const origemLeitura = origem as OrigemLeitura;
    const resumoPorEntregador: Record<string, { importados: number; duplicados: number }> = {};
    let importados = 0;
    let duplicados = 0;
    let falhas = 0;

    const sacaAtual = get().sacaAtiva;
    const listaOriginal = get().pacotes;
    const pacotesAdicionar: PacoteLidoLocal[] = [];
    const codigosVistos = new Set<string>();
    const novosEntregadores: string[] = [];

    const nomesEntregadores = Object.keys(porEntregador);
    for (const nome of nomesEntregadores) {
      resumoPorEntregador[nome] = { importados: 0, duplicados: 0 };
      const ids = porEntregador[nome] ?? [];
      for (const cod of ids) {
        try {
          const resultado = await PacoteService.adicionar(cod, origemLeitura, {
            saca_id: sacaAtual?.id ?? undefined,
            entregador: nome,
            status: 'lido',
          });
          let pacoteParaLista: PacoteLidoLocal | null = null;
          if (resultado.sucesso && resultado.pacote) {
            pacoteParaLista = resultado.pacote;
            importados++;
            resumoPorEntregador[nome].importados++;
          } else if (resultado.duplicado && resultado.existente) {
            pacoteParaLista = resultado.existente;
            duplicados++;
            resumoPorEntregador[nome].duplicados++;
          }
          if (pacoteParaLista) {
            const chave = chavePacote(pacoteParaLista);
            if (codigosVistos.has(chave)) continue;
            codigosVistos.add(chave);
            pacotesAdicionar.push(pacoteParaLista);
            const entNome = pacoteParaLista.entregador;
            if (entNome && !novosEntregadores.some((x) => x.toLowerCase() === entNome.toLowerCase()) && !get().entregadores.some((x) => x.toLowerCase() === entNome.toLowerCase())) {
              novosEntregadores.push(entNome);
            }
          }
        } catch {
          falhas++;
        }
      }
    }

    if (pacotesAdicionar.length > 0) {
      const chavesNovas = new Set(pacotesAdicionar.map(chavePacote));
      const listaFiltrada = listaOriginal.filter((p) => !chavesNovas.has(chavePacote(p)));
      const nova = [...pacotesAdicionar, ...listaFiltrada];
      const r = recalcular(nova);
      const patch: Partial<PacoteState> = {
        pacotes: nova,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      if (novosEntregadores.length > 0) {
        patch.entregadores = ordenarNomes([...get().entregadores, ...novosEntregadores]);
        novosEntregadores.forEach((n) => void adicionarEntregador(n));
      }
      set(patch as PacoteState);
    }

    return { importados, duplicados, falhas, porEntregador: resumoPorEntregador };
  },

  alternarStatusRetorno: async (id) => {
    const atual = get().pacotes.find((p) => p.id === id);
    const novo: StatusPacote | null = atual?.status === 'retorno' ? null : 'retorno';
    await get().definirStatus(id, novo);
  },

  ciclarStatus: async (id) => {
    const atual = get().pacotes.find((p) => p.id === id);
    const ordem: Array<StatusPacote | null> = [null, 'lido', 'entregue', 'retorno', 'devolucao'];
    const idx = ordem.indexOf(atual?.status ?? null);
    const prox = ordem[(idx + 1) % ordem.length];
    await get().definirStatus(id, prox);
  },

  remover: async (id) => {
    await PacoteService.remover(id);
    const atual = get().pacotes.filter((p) => p.id !== id);
    const r = recalcular(atual);
    set({
      pacotes: atual,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
  },

  removerEmLote: async (ids) => {
    if (!ids.length) return { removidos: 0 };
    const idSet = new Set(ids);
    const atual = get().pacotes;
    const nova = atual.filter((p) => !idSet.has(p.id));
    const removidos = atual.length - nova.length;
    try {
      await PacoteService.removerEmLote(ids);
    } catch {
      // banco é a fonte da verdade: em caso de falha, recarrega para não mentir na tela
      await get().carregar();
      return { removidos: 0 };
    }
    const r = recalcular(nova);
    set({
      pacotes: nova,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
    return { removidos };
  },

  limpar: async () => {
    const sacaAtual = get().sacaAtiva;
    await PacoteService.limpar(sacaAtual?.id ?? null);
    set({
      pacotes: [],
      entregadoresSaca: [],
      contagensEntregadores: [],
      ultimoLido: null,
      ultimoDuplicado: null,
      ultimoResultado: null,
      ultimoMovido: null,
      ultimoResultadoMover: null,
    });
  },

  total: () => get().pacotes.length,

  unicos: () => new Set(get().pacotes.map((p) => p.codigo_pacote)).size,

  contarPorStatus: () => {
    const arr = get().pacotes;
    let lido = 0, entregue = 0, retorno = 0, devolucao = 0, semStatus = 0;
    for (const p of arr) {
      if (p.status === 'lido') lido++;
      else if (p.status === 'entregue') entregue++;
      else if (p.status === 'retorno') retorno++;
      else if (p.status === 'devolucao') devolucao++;
      else semStatus++;
    }
    return { lido, entregue, retorno, devolucao, semStatus };
  },

  exportar: async (listaFiltrada?: Parameters<typeof PacoteService.exportarCsv>[2], sufixoNomeArquivo?: string) => {
    const sacaAtual = get().sacaAtiva;
    const base = sacaAtual ? `saca_${sacaAtual.nome.replace(/\s+/g, '_')}` : 'contagem';
    const parteSufixo = sufixoNomeArquivo ? `_${sufixoNomeArquivo.replace(/\s+/g, '_')}` : '';
    const nomeArquivo = `${base}${parteSufixo}_${Date.now()}.xlsx`;
    await PacoteService.exportarCsv(sacaAtual?.id ?? null, nomeArquivo, listaFiltrada);
  },

  limparFeedback: () => {
    set({
      ultimoLido: null,
      ultimoDuplicado: null,
      ultimoResultado: null,
      ultimoMovido: null,
      ultimoResultadoMover: null,
    });
  },

  inscreverRealtime: () => {
    let debounce: ReturnType<typeof setTimeout> | null = null;
    const disparar = (tipo: 'pacotes' | 'sacas' | 'entregadores') => {
      if (debounce) clearTimeout(debounce);
      debounce = setTimeout(() => {
        const g = get();
        if (tipo === 'sacas') void g.carregarSacas().then(() => void g.carregar());
        else if (tipo === 'entregadores') void g.carregarEntregadoresBanco();
        else void g.carregar();
      }, 120);
    };
    return inscreverRealtimePacotes(
      () => disparar('pacotes'),
      () => disparar('sacas'),
      () => disparar('entregadores'),
    );
  },

  forcarSincronizacaoCompleta: async () => {
    await get().carregarSacas();
    await get().carregar();
    const totalSacas = get().sacas.length;
    const totalPacotes = get().pacotes.length;
    return {
      sacas: { sincronizados: totalSacas, falhas: 0, total: totalSacas, primeiroErro: null },
      pacotes: { sincronizados: totalPacotes, falhas: 0, total: totalPacotes, primeiroErro: null },
    };
  },
}));
