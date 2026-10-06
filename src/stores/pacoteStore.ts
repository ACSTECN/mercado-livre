import { create } from 'zustand';
import type { PacoteLidoLocal, OrigemLeitura, ResultadoAdicaoPacote, Saca, ResumoSaca, ResultadoMoverPacote, StatusPacote } from '@/types';
import { PacoteService, adicionarEntregador, removerEntregador, renomearEntregador, listarEntregadores, listarEntregadoresSyncOffline, invalidarCacheEntregadores, inscreverRealtimePacotes } from '@/services/packages/PacoteService';
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

  definirEntregador: (nome: string | null) => void;
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

const CHAVE_CACHE = 'ml_pacote_store_v1';
const CHAVE_CACHE_SACAS = 'ml_sacas_store_v1';
const CHAVE_CACHE_SACA_ATIVA = 'ml_saca_ativa_store_v1';
const CHAVE_CACHE_ENTREGADOR_ATIVO = 'ml_entregador_ativo_v1';

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

function mesclarPreservandoNaoSincronizados(doBanco: PacoteLidoLocal[], atuaisLocal: PacoteLidoLocal[]): PacoteLidoLocal[] {
  const mapaLocal = new Map(atuaisLocal.map((p) => [p.id, p]));
  const mapaBanco = new Map(doBanco.map((p) => [p.id, p]));
  const saida: PacoteLidoLocal[] = [];
  for (const p of doBanco) {
    const local = mapaLocal.get(p.id);
    if (local) {
      if (local.sincronizado === false) {
        saida.push(local);
      } else {
        const tLocal = local.updated_at ? new Date(local.updated_at).getTime() : 0;
        const tBanco = p.updated_at ? new Date(p.updated_at).getTime() : 0;
        if (tLocal > 0 && tBanco > 0 && tLocal > tBanco) saida.push(local);
        else saida.push(p);
      }
    } else {
      saida.push(p);
    }
  }
  for (const local of atuaisLocal) {
    if (!mapaBanco.has(local.id)) saida.push(local);
  }
  return saida;
}

function ordenarNomes(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))].sort((a, b) =>
    a.localeCompare(b, 'pt-BR', { sensitivity: 'base' }),
  );
}

function carregarDoCache(): PacoteLidoLocal[] {
  try {
    const raw = sessionStorage.getItem(CHAVE_CACHE);
    if (!raw) return [];
    const arr = JSON.parse(raw) as PacoteLidoLocal[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function carregarSacasDoCache(): Saca[] {
  try {
    const raw = localStorage.getItem(CHAVE_CACHE_SACAS);
    if (!raw) return [];
    const arr = JSON.parse(raw) as Saca[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function carregarSacaAtivaDoCache(): Saca | null {
  try {
    const raw = localStorage.getItem(CHAVE_CACHE_SACA_ATIVA);
    if (!raw) return null;
    return JSON.parse(raw) as Saca;
  } catch {
    return null;
  }
}

function carregarEntregadorAtivoDoCache(): string | null {
  try {
    const raw = localStorage.getItem(CHAVE_CACHE_ENTREGADOR_ATIVO);
    if (!raw) return null;
    return raw;
  } catch {
    return null;
  }
}

function salvarCache(lista: PacoteLidoLocal[]) {
  try {
    sessionStorage.setItem(CHAVE_CACHE, JSON.stringify(lista));
  } catch {
    /* noop */
  }
}

function salvarCacheSacas(lista: Saca[]) {
  try {
    localStorage.setItem(CHAVE_CACHE_SACAS, JSON.stringify(lista));
  } catch {
    /* noop */
  }
}

function salvarCacheSacaAtiva(s: Saca | null) {
  try {
    if (s) localStorage.setItem(CHAVE_CACHE_SACA_ATIVA, JSON.stringify(s));
    else localStorage.removeItem(CHAVE_CACHE_SACA_ATIVA);
  } catch {
    /* noop */
  }
}

function salvarCacheEntregadorAtivo(nome: string | null) {
  try {
    if (nome) localStorage.setItem(CHAVE_CACHE_ENTREGADOR_ATIVO, nome);
    else localStorage.removeItem(CHAVE_CACHE_ENTREGADOR_ATIVO);
  } catch {
    /* noop */
  }
}

const pacotesIniciais = carregarDoCache();
const inicial = recalcular(pacotesIniciais);

export const usePacoteStore = create<PacoteState>((set, get) => ({
  pacotes: pacotesIniciais,
  sacas: carregarSacasDoCache(),
  resumos: [],
  sacaAtiva: carregarSacaAtivaDoCache(),
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

  entregadorAtivo: carregarEntregadorAtivoDoCache(),
  entregadores: listarEntregadoresSyncOffline(),
  entregadoresSaca: inicial.entregadoresSaca,
  contagensEntregadores: inicial.contagens,

  carregarEntregadoresBanco: async () => {
    try {
      invalidarCacheEntregadores();
      const lista = await listarEntregadores(true);
      const atual = get().entregadores;
      if (!arraysIguais(atual, lista)) set({ entregadores: lista });
    } catch { /* noop */ }
  },

  carregarSacas: async () => {
    set({ carregandoSacas: true });
    try {
      const sacasP = SacaService.listar();
      const resumosP = SacaService.resumos();
      const ativaP = SacaService.pegarAtiva();
      const entregadoresP = (async () => {
        try { invalidarCacheEntregadores(); return await listarEntregadores(false); }
        catch { return listarEntregadoresSyncOffline(); }
      })();
      const [sacas, resumos, ativa, entregadores] = await Promise.all([sacasP, resumosP, ativaP, entregadoresP]);
      salvarCacheSacas(sacas);
      salvarCacheSacaAtiva(ativa);
      const stateAntigo = get();
      const patch: Partial<PacoteState> = {
        sacas,
        resumos,
        sacaAtiva: ativa,
        carregandoSacas: false,
      };
      if (!arraysIguais(stateAntigo.entregadores, entregadores)) patch.entregadores = entregadores;
      set(patch);
    } catch {
      set({ carregandoSacas: false });
    }
  },

  definirSacaAtiva: async (sacaId) => {
    await SacaService.ativar(sacaId);
    const saca = (await SacaService.listar()).find((s) => s.id === sacaId) ?? null;
    salvarCacheSacaAtiva(saca);
    set({ sacaAtiva: saca, mostrarModalSaca: false, mostrarHistoricoSacas: false });
    await get().carregar();
  },

  criarSaca: async (nome, descricao) => {
    const saca = await SacaService.criar(nome, descricao ? { descricao } : undefined);
    await get().carregarSacas();
    salvarCacheSacaAtiva(saca);
    salvarCache([]);
    const r = recalcular([]);
    set({
      sacaAtiva: saca,
      mostrarModalSaca: false,
      pacotes: [],
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
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
      salvarCacheSacaAtiva(null);
      salvarCache([]);
      const r = recalcular([]);
      set({
        sacaAtiva: null,
        pacotes: [],
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
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
    salvarCacheEntregadorAtivo(limpo);
    const patch: Partial<PacoteState> = { entregadorAtivo: limpo };
    if (limpo) {
      const cadastradosAntigos = get().entregadores;
      if (cadastradosAntigos.map((s) => s.toLowerCase()).includes(limpo.toLowerCase())) {
        set(patch as PacoteState);
        return;
      }
      const arr = await adicionarEntregador(limpo);
      patch.entregadores = arr;
    }
    set(patch as PacoteState);
  },

  cadastrarEntregador: async (nome) => {
    const arr = await adicionarEntregador(nome);
    const antigos = get().entregadores;
    if (!arraysIguais(antigos, arr)) set({ entregadores: arr });
    return arr;
  },
  removerEntregador: async (nome) => {
    const arr = await removerEntregador(nome);
    const antigos = get().entregadores;
    if (!arraysIguais(antigos, arr)) set({ entregadores: arr });
    return arr;
  },
  renomearEntregador: async (nomeAntigo, nomeNovo) => {
    const arr = await renomearEntregador(nomeAntigo, nomeNovo);
    const antigos = get().entregadores;
    if (!arraysIguais(antigos, arr)) {
      const patch: Partial<PacoteState> = { entregadores: arr };
      const ativo = get().entregadorAtivo;
      if (ativo && ativo.toLowerCase() === nomeAntigo.trim().toLowerCase()) {
        const novoLimpo = nomeNovo.trim();
        salvarCacheEntregadorAtivo(novoLimpo);
        patch.entregadorAtivo = novoLimpo;
      }
      set(patch as PacoteState);
    }
    return arr;
  },

  carregar: async () => {
    set({ carregando: true });
    try {
      if (!get().sacas.length || !get().sacaAtiva) await get().carregarSacas();
      const pacotesP = PacoteService.listar(get().sacaAtiva?.id ?? null);
      const entregadoresP = (async () => {
        try { return await listarEntregadores(false); }
        catch { return listarEntregadoresSyncOffline(); }
      })();
      const [lista, entregadores] = await Promise.all([pacotesP, entregadoresP]);
      const mesclados = mesclarPreservandoNaoSincronizados(lista, get().pacotes);
      salvarCache(mesclados);
      const r = recalcular(mesclados);
      const patch: Partial<PacoteState> = {
        pacotes: mesclados,
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
      const pacotesP = PacoteService.listarTodasSacas();
      const entregadoresP = (async () => {
        try { return await listarEntregadores(false); }
        catch { return listarEntregadoresSyncOffline(); }
      })();
      const [lista, entregadores] = await Promise.all([pacotesP, entregadoresP]);
      const mesclados = mesclarPreservandoNaoSincronizados(lista, get().pacotes);
      salvarCache(mesclados);
      const r = recalcular(mesclados);
      const patch: Partial<PacoteState> = {
        pacotes: mesclados,
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

      let lista = get().pacotes;
      let mudouLista = false;
      let novoEntregadorCadastrado = false;

      if (resultado.sucesso && resultado.pacote) {
        const jaTem = lista.some((p) => p.codigo_pacote === resultado.pacote!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null));
        if (!jaTem) {
          lista = [resultado.pacote, ...lista.filter((p) => !(p.codigo_pacote === resultado.pacote!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null)))];
          mudouLista = true;
        }
        if (entregadorAtual) {
          const antigos = get().entregadores;
          if (!antigos.includes(entregadorAtual)) {
            adicionarEntregador(entregadorAtual);
            novoEntregadorCadastrado = true;
          }
        }
      } else if (resultado.duplicado && resultado.existente) {
        const jaTem = lista.some((p) => p.codigo_pacote === resultado.existente!.codigo_pacote && p.saca_id === (sacaAtual?.id ?? null));
        if (!jaTem) {
          lista = [resultado.existente, ...lista];
          mudouLista = true;
        }
      }

      if (mudouLista) salvarCache(lista);

      const patch: Partial<PacoteState> = { ultimoResultado: resultado };
      if (resultado.sucesso && resultado.pacote) {
        patch.ultimoLido = resultado.pacote;
        patch.ultimoDuplicado = null;
        if (resultado.pacote.status === 'retorno') {
          patch.ultimoAlteradoStatus = {
            id: resultado.pacote.id,
            status: 'retorno',
            ts: Date.now(),
          };
        }
      } else if (resultado.duplicado && resultado.existente) {
        patch.ultimoLido = null;
        patch.ultimoDuplicado = resultado.existente;
      }
      if (mudouLista) {
        patch.pacotes = lista;
        const r = recalcular(lista);
        patch.entregadoresSaca = r.entregadoresSaca;
        patch.contagensEntregadores = r.contagens;
      }
      if (novoEntregadorCadastrado) {
        const atuais = get().entregadores;
        if (!atuais.map((s) => s.toLowerCase()).includes((resultado.pacote?.entregador ?? '').toLowerCase())) {
          patch.entregadores = ordenarNomes([...atuais, resultado.pacote?.entregador ?? '']);
        }
      }
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
    const anterior = atualPacotes[idx];
    if (anterior.entregador === limpo) {
      const r: ResultadoMoverPacote = {
        sucesso: true,
        movido: false,
        pacote: anterior,
        mensagem: 'Já está neste entregador',
      };
      set({ ultimoResultadoMover: r });
      return r;
    }
    const atualizado: PacoteLidoLocal = {
      ...anterior,
      entregador: limpo,
      sincronizado: false,
    };
    const nova = [...atualPacotes];
    nova[idx] = atualizado;
    salvarCache(nova);
    const r = recalcular(nova);
    const patch: Partial<PacoteState> = {
      pacotes: nova,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
      ultimoMovido: atualizado,
      ultimoResultadoMover: {
        sucesso: true,
        movido: true,
        pacote: atualizado,
        mensagem: origemMovimento === 're_scan'
          ? `${anterior.codigo_pacote} movido para "${limpo}"`
          : `Pacote movido para "${limpo}"`,
      },
    };
    const cadastradosAntigos = get().entregadores;
    if (!cadastradosAntigos.map((s) => s.toLowerCase()).includes(limpo.toLowerCase())) {
      patch.entregadores = ordenarNomes([limpo, ...cadastradosAntigos]);
    }
    set(patch as PacoteState);

    void (async () => {
      try {
        await PacoteService.mover(id, limpo, origemMovimento);
        const re = get().pacotes;
        const i2 = re.findIndex((p) => p.id === id);
        if (i2 >= 0) {
          const att = { ...re[i2], sincronizado: true };
          const nova2 = [...re];
          nova2[i2] = att;
          salvarCache(nova2);
          const r2 = recalcular(nova2);
          set({
            pacotes: nova2,
            entregadoresSaca: r2.entregadoresSaca,
            contagensEntregadores: r2.contagens,
          });
        }
      } catch { /* noop */ }
    })();

    return patch.ultimoResultadoMover as ResultadoMoverPacote;
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

  remover: async (id) => {
    await PacoteService.remover(id);
    const atual = get().pacotes.filter((p) => p.id !== id);
    salvarCache(atual);
    const r = recalcular(atual);
    set({
      pacotes: atual,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
  },

  definirStatus: async (id, status) => {
    const atual = get().pacotes;
    const idx = atual.findIndex((p) => p.id === id);
    if (idx < 0) return;
    const anterior = atual[idx];
    const atualizado: PacoteLidoLocal = {
      ...anterior,
      status,
      sincronizado: false,
    };
    const nova = [...atual];
    nova[idx] = atualizado;
    salvarCache(nova);
    const r = recalcular(nova);
    set({
      pacotes: nova,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
      ultimoAlteradoStatus: { id, status, ts: Date.now() },
    });

    void (async () => {
      try {
        const confirmado = await PacoteService.definirStatus(id, status);
        if (!confirmado) return;
        const re = get().pacotes;
        const i2 = re.findIndex((p) => p.id === id);
        if (i2 >= 0) {
          const att = { ...re[i2], sincronizado: confirmado.sincronizado ?? true, status: confirmado.status ?? null };
          const nova2 = [...re];
          nova2[i2] = att;
          salvarCache(nova2);
          const r2 = recalcular(nova2);
          set({
            pacotes: nova2,
            entregadoresSaca: r2.entregadoresSaca,
            contagensEntregadores: r2.contagens,
          });
        }
      } catch { /* noop */ }
    })();
  },

  definirStatusEmLote: async (ids, status) => {
    if (!ids.length) return;
    const idSet = new Set(ids);
    const atual = get().pacotes;
    const nova: PacoteLidoLocal[] = atual.map((p) => {
      if (idSet.has(p.id)) return { ...p, status, sincronizado: false };
      return p;
    });
    salvarCache(nova);
    const r = recalcular(nova);
    set({
      pacotes: nova,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
    void (async () => {
      try {
        for (const id of ids) {
          try { await PacoteService.definirStatus(id, status); } catch { /* noop */ }
        }
      } catch { /* noop */ }
    })();
  },

  definirEntregadorEmLote: async (ids, entregador) => {
    if (!ids.length) return { atualizados: 0, falhas: 0 };
    const entregadorLimpo = entregador == null ? '' : entregador.trim();
    const idSet = new Set(ids);
    const atual = get().pacotes;
    let atualizados = 0;
    let falhas = 0;
    const nova: PacoteLidoLocal[] = atual.map((p) => {
      if (idSet.has(p.id)) {
        const novoValor = entregadorLimpo || undefined;
        if (p.entregador !== novoValor) atualizados++;
        return { ...p, entregador: novoValor, sincronizado: false };
      }
      return p;
    });
    if (atualizados === 0) return { atualizados: 0, falhas: 0 };
    salvarCache(nova);
    const r = recalcular(nova);
    set({
      pacotes: nova,
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
    });
    if (entregadorLimpo) adicionarEntregador(entregadorLimpo);
    void (async () => {
      const agora = nova.map((p) => ({ ...p }));
      try {
        for (const id of ids) {
          try {
            const idx = agora.findIndex((p) => p.id === id);
            if (idx < 0) { falhas++; continue; }
            if (entregadorLimpo) {
              const res = await PacoteService.mover(id, entregadorLimpo, 'manual');
              if (res.sucesso) {
                agora[idx] = { ...agora[idx], entregador: entregadorLimpo, sincronizado: true };
              } else {
                falhas++;
              }
            } else if (isSupabaseConfigurado) {
              const sb = getSupabase();
              if (sb) {
                const { error } = await sb.from('pacotes_lidos').update({ entregador: null }).eq('id', id);
                if (!error) {
                  agora[idx] = { ...agora[idx], entregador: undefined, sincronizado: true };
                } else {
                  falhas++;
                }
              } else {
                falhas++;
              }
            }
          } catch { falhas++; }
        }
        salvarCache(agora);
        const r2 = recalcular(agora);
        set({
          pacotes: agora,
          entregadoresSaca: r2.entregadoresSaca,
          contagensEntregadores: r2.contagens,
        });
      } catch {
        try {
          salvarCache(agora);
          const rFallback = recalcular(agora);
          set({
            pacotes: agora,
            entregadoresSaca: rFallback.entregadoresSaca,
            contagensEntregadores: rFallback.contagens,
          });
        } catch { /* noop */ }
      }
    })();
    return { atualizados, falhas };
  },

  importarLotePorZona: async (porZona, origem = 'import_json_zona', entregadorDestino?: string | null) => {
    const origemLeitura = origem as OrigemLeitura;
    const resumoPorZona: Record<string, { importados: number; duplicados: number }> = {};
    let importados = 0;
    let duplicados = 0;
    let falhas = 0;

    const sacaAtual = get().sacaAtiva;
    const sacaIdComparar = sacaAtual?.id ?? null;
    const listaOriginal = get().pacotes;
    const pacotesAdicionar: PacoteLidoLocal[] = [];
    const codigosVistosLocal = new Set<string>();
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
            const chaveDedup = `${pacoteParaLista.codigo_pacote}__${pacoteParaLista.saca_id ?? 'null'}`;
            if (codigosVistosLocal.has(chaveDedup)) continue;
            codigosVistosLocal.add(chaveDedup);
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
      const codigosNovos = new Map<string, PacoteLidoLocal>();
      for (const p of pacotesAdicionar) {
        codigosNovos.set(`${p.codigo_pacote}__${p.saca_id ?? 'null'}`, p);
      }
      const listaFiltrada = listaOriginal.filter((p) => {
        const chave = `${p.codigo_pacote}__${p.saca_id ?? 'null'}`;
        return !codigosNovos.has(chave);
      });
      const nova = [...pacotesAdicionar, ...listaFiltrada];
      salvarCache(nova);
      const r = recalcular(nova);
      const patch: Partial<PacoteState> = {
        pacotes: nova,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      if (novosEntregadores.length > 0) {
        const atuais = get().entregadores;
        const proximos = ordenarNomes([...atuais, ...novosEntregadores]);
        patch.entregadores = proximos;
        novosEntregadores.forEach((n) => adicionarEntregador(n));
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
    const sacaIdComparar = sacaAtual?.id ?? null;
    const listaOriginal = get().pacotes;
    const pacotesAdicionar: PacoteLidoLocal[] = [];
    const codigosVistosLocal = new Set<string>();
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
            const chaveDedup = `${pacoteParaLista.codigo_pacote}__${pacoteParaLista.saca_id ?? 'null'}`;
            if (codigosVistosLocal.has(chaveDedup)) continue;
            codigosVistosLocal.add(chaveDedup);
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
      const codigosNovos = new Map<string, PacoteLidoLocal>();
      for (const p of pacotesAdicionar) {
        codigosNovos.set(`${p.codigo_pacote}__${p.saca_id ?? 'null'}`, p);
      }
      const listaFiltrada = listaOriginal.filter((p) => {
        const chave = `${p.codigo_pacote}__${p.saca_id ?? 'null'}`;
        return !codigosNovos.has(chave);
      });
      const nova = [...pacotesAdicionar, ...listaFiltrada];
      salvarCache(nova);
      const r = recalcular(nova);
      const patch: Partial<PacoteState> = {
        pacotes: nova,
        entregadoresSaca: r.entregadoresSaca,
        contagensEntregadores: r.contagens,
      };
      if (novosEntregadores.length > 0) {
        const atuais = get().entregadores;
        const proximos = ordenarNomes([...atuais, ...novosEntregadores]);
        patch.entregadores = proximos;
        novosEntregadores.forEach((n) => adicionarEntregador(n));
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

  limpar: async () => {
    const sacaAtual = get().sacaAtiva;
    await PacoteService.limpar(sacaAtual?.id ?? null);
    salvarCache([]);
    const r = recalcular([]);
    set({
      pacotes: [],
      entregadoresSaca: r.entregadoresSaca,
      contagensEntregadores: r.contagens,
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
    console.log('[sincronia] INICIO sincronização forçada');
    const sacas = await SacaService.sincronizarAgora();
    const pacotes = await PacoteService.sincronizarAgora();
    console.log('[sincronia] FIM sincronização forçada:', { sacas, pacotes });
    void get().carregarSacas().then(() => void get().carregar());
    return {
      sacas: { sincronizados: sacas.sincronizados, falhas: sacas.falhas, total: sacas.total, primeiroErro: sacas.primeiroErro },
      pacotes: { sincronizados: pacotes.sincronizados, falhas: pacotes.falhas, total: pacotes.total, primeiroErro: pacotes.primeiroErro },
    };
  },
}));
