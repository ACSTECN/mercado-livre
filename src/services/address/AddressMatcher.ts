import Fuse from 'fuse.js';
import levenshtein from 'js-levenshtein';
import type {
  EnderecoEstruturado,
  PesosMatch,
  RegistroPlanilha,
  ResultadoMatch,
} from '@/types';
import { PESOS_DEFAULT } from '@/types';
import { normalizarEndereco, normalizarString } from './AddressNormalizer';

type RegistroIndexado = {
  registro: RegistroPlanilha;
  normalizado: EnderecoEstruturado;
  chaveCep: string;
  chaveNumero: string;
  logradouroTokens: string[];
};

export class AddressMatcher {
  private index: RegistroIndexado[] = [];
  private fuseLogradouro?: Fuse<RegistroIndexado>;
  private pesos: PesosMatch;

  constructor(registros: RegistroPlanilha[], pesos: PesosMatch = PESOS_DEFAULT) {
    this.pesos = pesos;
    this.indexar(registros);
  }

  private indexar(registros: RegistroPlanilha[]) {
    this.index = registros.map((r) => {
      const normalizado = normalizarEndereco({
        logradouro: r.logradouro ?? r.enderecoCompleto,
        numero: r.numero,
        bairro: r.bairro,
        cidade: r.cidade,
        estado: r.estado,
        cep: r.cep,
      });
      if (!normalizado.numero && r.enderecoCompleto) {
        const mn = r.enderecoCompleto.match(/\d+/);
        if (mn) normalizado.numero = mn[0];
      }
      if (!normalizado.cep && r.enderecoCompleto) {
        const mc = r.enderecoCompleto.match(/\d{5}[-\s]?\d{3}/);
        if (mc) normalizado.cep = mc[0].replace(/\D/g, '');
      }
      return {
        registro: r,
        normalizado,
        chaveCep: normalizado.cep,
        chaveNumero: normalizado.numero,
        logradouroTokens: normalizado.logradouro.split(' ').filter(Boolean),
      };
    });

    this.fuseLogradouro = new Fuse(this.index, {
      includeScore: true,
      threshold: 0.45,
      minMatchCharLength: 4,
      keys: [
        { name: 'normalizado.logradouro', weight: 0.7 },
        { name: 'normalizado.bairro', weight: 0.2 },
        { name: 'normalizado.cidade', weight: 0.1 },
      ],
      ignoreLocation: true,
      useExtendedSearch: true,
    });
  }

  private similaridade(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    const maxLen = Math.max(a.length, b.length);
    const dist = levenshtein(a, b);
    const sim = 1 - dist / maxLen;
    if (a.includes(b) || b.includes(a)) {
      return Math.max(sim, 0.6 + Math.min(a.length, b.length) / (2 * maxLen));
    }
    return sim;
  }

  private scoreCep(a: string, b: string): number {
    if (!a || !b) return 0;
    if (a === b) return 1;
    let iguais = 0;
    const len = Math.min(a.length, b.length);
    for (let i = 0; i < len; i++) if (a[i] === b[i]) iguais++;
    return iguais / 8;
  }

  private scoreNumero(a: string, b: string): number {
    if (!a || !b) return 0.4;
    if (a === b) return 1;
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) {
      if (na === nb) return 1;
      const max = Math.max(na, nb);
      const dif = Math.abs(na - nb);
      return Math.max(0, 1 - dif / Math.max(max, 100));
    }
    return this.similaridade(a, b);
  }

  private scoreLogradouroTokens(aTokens: string[], bTokens: string[]): number {
    if (aTokens.length === 0 || bTokens.length === 0) return 0;
    const stopwords = new Set(['DE', 'DO', 'DA', 'DOS', 'DAS', 'E', 'OU', 'NO', 'NA', 'O', 'A']);
    const a = aTokens.filter((t) => !stopwords.has(t));
    const b = new Set(bTokens.filter((t) => !stopwords.has(t)));
    if (!a.length || !b.size) return 0;
    let matches = 0;
    for (const t of a) {
      if (b.has(t)) matches++;
      else {
        for (const tb of b) {
          if (this.similaridade(t, tb) >= 0.82) {
            matches++;
            break;
          }
        }
      }
    }
    return matches / Math.max(a.length, b.size);
  }

  private calcularScore(
    consulta: EnderecoEstruturado,
    item: RegistroIndexado,
  ): ResultadoMatch['scoreDetalhado'] {
    const scoreCep = this.scoreCep(consulta.cep, item.chaveCep);
    const scoreNumero = this.scoreNumero(consulta.numero, item.chaveNumero);
    const tokensConsulta = consulta.logradouro.split(' ').filter(Boolean);
    const scoreLogradouro = this.scoreLogradouroTokens(tokensConsulta, item.logradouroTokens);
    const scoreBairro = this.similaridade(consulta.bairro, item.normalizado.bairro);
    const cidadeConsulta = `${consulta.cidade} ${consulta.estado}`.trim();
    const cidadeItem = `${item.normalizado.cidade} ${item.normalizado.estado}`.trim();
    const scoreCidadeEstado = normalizarString(cidadeConsulta) && normalizarString(cidadeItem)
      ? this.similaridade(cidadeConsulta, cidadeItem)
      : 0.5;

    return { cep: scoreCep, numero: scoreNumero, logradouro: scoreLogradouro, bairro: scoreBairro, cidadeEstado: scoreCidadeEstado };
  }

  private pontuacao(d: ResultadoMatch['scoreDetalhado']): number {
    return Math.round(
      (d.cep * this.pesos.cep +
        d.numero * this.pesos.numero +
        d.logradouro * this.pesos.logradouro +
        d.bairro * this.pesos.bairro +
        d.cidadeEstado * this.pesos.cidadeEstado) *
        100,
    );
  }

  buscar(endereco: EnderecoEstruturado, limite = 5): ResultadoMatch[] {
    const consulta = normalizarEndereco(endereco);

    if (consulta.cep && consulta.numero) {
      const exata = this.index.filter(
        (r) => r.chaveCep === consulta.cep && r.chaveNumero === consulta.numero,
      );
      if (exata.length) {
        const resultados = exata
          .map((r) => ({
            registro: r.registro,
            scoreDetalhado: this.calcularScore(consulta, r),
            score: 0,
          }))
          .map((r) => ({ ...r, score: this.pontuacao(r.scoreDetalhado) }))
          .sort((a, b) => b.score - a.score);
        if (resultados[0].score >= 90) return resultados.slice(0, limite);
      }
    }

    let candidatos: RegistroIndexado[] | undefined;
    if (consulta.cep) {
      candidatos = this.index.filter((r) => r.chaveCep.startsWith(consulta.cep.slice(0, 5)));
    }
    if (!candidatos?.length && consulta.logradouro && this.fuseLogradouro) {
      candidatos = this.fuseLogradouro.search(consulta.logradouro).slice(0, 50).map((r) => r.item);
    }
    if (!candidatos?.length) {
      candidatos = this.index.slice(0, 200);
    }

    const resultados = candidatos
      .map((r) => {
        const detalhado = this.calcularScore(consulta, r);
        return {
          registro: r.registro,
          scoreDetalhado: detalhado,
          score: this.pontuacao(detalhado),
        };
      })
      .sort((a, b) => b.score - a.score);

    return resultados.slice(0, limite);
  }
}
