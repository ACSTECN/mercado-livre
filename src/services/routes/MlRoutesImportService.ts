import { normalizarCodigoPacote, codigosIguaisNormalizados } from '@/lib/utils';

export interface RotaImportada {
  idRota?: string | number;
  statusRota?: string;
  entregador: string;
  idsPacote: Array<{ id: string; idOriginal?: string | number; tipoCampo: 'address.id' | 'stop.id' }>;
}

export interface ResultadoParseRotas {
  ok: boolean;
  erro?: string;
  rotas: RotaImportada[];
  totalIds: number;
  totalEntregadoresUnicos: number;
  porEntregador: Record<string, string[]>;
  duplicadosInternos: number;
}

function buscarDriver(obj: unknown, profundidade = 0): string | undefined {
  if (profundidade > 5 || obj === null || obj === undefined) return undefined;
  if (typeof obj === 'string') return obj.length >= 3 ? obj : undefined;
  if (typeof obj !== 'object') return undefined;
  const o = obj as Record<string, unknown>;
  if (typeof o.driver === 'string' && o.driver.trim().length >= 2) return o.driver.trim();
  if (typeof o.driver_name === 'string' && o.driver_name.trim().length >= 2) return (o.driver_name as string).trim();
  if (typeof o.driverName === 'string' && o.driverName.trim().length >= 2) return (o.driverName as string).trim();
  if (typeof o.entregador === 'string' && (o.entregador as string).trim().length >= 2) return (o.entregador as string).trim();
  if (typeof o.nome === 'string' && obj && !Array.isArray(obj) && (typeof (o as Record<string, unknown>).id !== 'undefined')) {
    const nome = (o.nome as string).trim();
    if (nome.length >= 4 && typeof (o as Record<string, unknown>).stops === 'undefined') return nome;
  }
  for (const chave of ['route', 'data', 'rota', 'monitoring', 'payload']) {
    const sub = (obj as Record<string, unknown>)[chave];
    const r = buscarDriver(sub, profundidade + 1);
    if (r) return r;
  }
  return undefined;
}

function extrairIdsDeStops(stops: unknown, saida: RotaImportada['idsPacote']) {
  if (!Array.isArray(stops)) return;
  const vistos = new Set<string>();
  for (const stop of stops) {
    if (stop === null || stop === undefined || typeof stop !== 'object') continue;
    const s = stop as Record<string, unknown>;

    if (s.address && typeof s.address === 'object' && s.address !== null) {
      const addr = s.address as Record<string, unknown>;
      if (typeof addr.id !== 'undefined' && addr.id !== null) {
        const cod = normalizarCodigoPacote(String(addr.id));
        if (cod.length > 0 && !vistos.has(cod)) {
          saida.push({ id: cod, idOriginal: typeof addr.id === 'number' ? addr.id : String(addr.id), tipoCampo: 'address.id' });
          vistos.add(cod);
        }
      }
    }
    if (typeof s.id !== 'undefined' && s.id !== null) {
      const cod = normalizarCodigoPacote(String(s.id));
      if (cod.length > 0 && !vistos.has(cod)) {
        saida.push({ id: cod, idOriginal: typeof s.id === 'number' ? s.id : String(s.id), tipoCampo: 'stop.id' });
        vistos.add(cod);
      }
    }
    if (Array.isArray(s.packages) || Array.isArray(s.pacotes)) {
      for (const p of (Array.isArray(s.packages) ? s.packages : (s.pacotes as unknown[])) ?? []) {
        if (p === null || typeof p !== 'object') continue;
        const pp = p as Record<string, unknown>;
        for (const chave of ['id', 'package_id', 'codigo', 'tracking_code', 'code']) {
          if (typeof pp[chave] !== 'undefined' && pp[chave] !== null) {
            const cod = normalizarCodigoPacote(String(pp[chave]));
            if (cod.length > 0 && !vistos.has(cod)) {
              saida.push({ id: cod, idOriginal: typeof pp[chave] === 'number' ? (pp[chave] as number) : String(pp[chave]), tipoCampo: 'stop.id' });
              vistos.add(cod);
            }
          }
        }
      }
    }

    if (Array.isArray((s as Record<string, unknown>).stops)) {
      extrairIdsDeStops((s as Record<string, unknown>).stops, saida);
    }
  }
}

function parsearUmaRota(obj: Record<string, unknown>): RotaImportada | null {
  const entregador = buscarDriver(obj);
  const ids: RotaImportada['idsPacote'] = [];
  extrairIdsDeStops((obj as Record<string, unknown>).stops, ids);
  if (Array.isArray((obj as Record<string, unknown>).addresses)) {
    extrairIdsDeStops((obj as Record<string, unknown>).addresses, ids);
  }
  const entregadorFinal = entregador ?? 'Sem entregador';
  return {
    idRota: (obj as Record<string, unknown>).id as string | number | undefined,
    statusRota: typeof (obj as Record<string, unknown>).status === 'string' ? ((obj as Record<string, unknown>).status as string) : undefined,
    entregador: entregadorFinal,
    idsPacote: ids,
  };
}

export function parsearJsonRotasML(rawTextoJson: string): ResultadoParseRotas {
  const texto = rawTextoJson.trim();
  if (!texto) return { ok: false, erro: 'JSON vazio', rotas: [], totalIds: 0, totalEntregadoresUnicos: 0, porEntregador: {}, duplicadosInternos: 0 };
  let obj: unknown;
  try {
    obj = JSON.parse(texto);
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'JSON inválido';
    return { ok: false, erro: `Não consegui ler o JSON: ${msg}`, rotas: [], totalIds: 0, totalEntregadoresUnicos: 0, porEntregador: {}, duplicadosInternos: 0 };
  }

  const rotas: RotaImportada[] = [];
  const tentar = (raiz: unknown, prof = 0) => {
    if (prof > 4 || raiz === null || raiz === undefined) return;
    if (typeof raiz !== 'object') return;
    if (Array.isArray(raiz)) {
      for (const item of raiz) tentar(item, prof + 1);
      return;
    }
    const r = raiz as Record<string, unknown>;
    let pareceRota = false;
    if (typeof r.driver === 'string' || typeof r.driver_name === 'string' || typeof r.driverName === 'string' || typeof r.entregador === 'string') pareceRota = true;
    if (Array.isArray(r.stops) && r.stops.length > 0) pareceRota = true;

    if (pareceRota) {
      const parseada = parsearUmaRota(r);
      if (parseada) rotas.push(parseada);
    }

    for (const chave of ['routes', 'rotas', 'data', 'payload', 'items', 'monitoring', 'result']) {
      if (r[chave] !== undefined && r[chave] !== null) tentar(r[chave], prof + 1);
    }

    if (!pareceRota) {
      for (const v of Object.values(r)) {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const vr = v as Record<string, unknown>;
          if (typeof vr.driver === 'string' || Array.isArray(vr.stops)) tentar(v, prof + 1);
        }
      }
    }
  };
  tentar(obj);

  if (!rotas.length) {
    return {
      ok: false,
      erro: 'Não encontrei nenhuma rota no JSON. Verifique se tem campos "driver" e "stops[].address.id" (formato API Mercado Livre).',
      rotas: [],
      totalIds: 0,
      totalEntregadoresUnicos: 0,
      porEntregador: {},
      duplicadosInternos: 0,
    };
  }

  const porEntregador: Record<string, string[]> = {};
  const globalVistos = new Map<string, string>();
  let duplicadosInternos = 0;
  for (const rota of rotas) {
    const arr = porEntregador[rota.entregador] ?? [];
    for (const itemId of rota.idsPacote) {
      const chave = codigosIguaisNormalizados(itemId.id, itemId.id) ? itemId.id : normalizarCodigoPacote(itemId.id);
      if (globalVistos.has(chave) && globalVistos.get(chave) === rota.entregador) {
        duplicadosInternos++;
        continue;
      }
      if (!globalVistos.has(chave)) {
        arr.push(itemId.id);
        globalVistos.set(chave, rota.entregador);
      } else if (globalVistos.get(chave) !== rota.entregador) {
        arr.push(itemId.id);
      }
    }
    porEntregador[rota.entregador] = arr;
  }
  const totalIds = Object.values(porEntregador).reduce((acc, arr) => acc + arr.length, 0);
  const totalEntregadoresUnicos = new Set(Object.keys(porEntregador)).size;

  return {
    ok: true,
    rotas,
    totalIds,
    totalEntregadoresUnicos,
    porEntregador,
    duplicadosInternos,
  };
}

export interface ZonaImportada {
  zoneId?: string | number;
  zoneName: string;
  zoneExternalId?: string;
  totalShipmentsInformado?: number;
  shipmentsEncontrados: Array<{ id: string; idOriginal: string | number; plannedRouteId?: string | number; stopSequence?: number }>;
}

export interface ResultadoParseZonas {
  ok: boolean;
  erro?: string;
  zonas: ZonaImportada[];
  totalIds: number;
  totalZonasUnicas: number;
  porZona: Record<string, string[]>;
  duplicadosInternos: number;
}

function extrairShipmentsDeMarkers(
  markers: unknown,
  saida: ZonaImportada['shipmentsEncontrados'],
  vistos: Set<string>,
) {
  if (!Array.isArray(markers)) return;
  for (const marker of markers) {
    if (marker === null || marker === undefined || typeof marker !== 'object') continue;
    const m = marker as Record<string, unknown>;
    if (typeof m.shipment_id !== 'undefined' && m.shipment_id !== null) {
      const cod = normalizarCodigoPacote(String(m.shipment_id));
      if (cod.length > 0 && !vistos.has(cod)) {
        saida.push({
          id: cod,
          idOriginal: typeof m.shipment_id === 'number' ? m.shipment_id : String(m.shipment_id),
          plannedRouteId: typeof m.planned_route_id !== 'undefined' && m.planned_route_id !== null
            ? (typeof m.planned_route_id === 'number' ? m.planned_route_id : String(m.planned_route_id))
            : undefined,
          stopSequence: typeof m.stop_sequence === 'number' ? m.stop_sequence : undefined,
        });
        vistos.add(cod);
      }
    }
    if (Array.isArray((m as Record<string, unknown>).shipments) || Array.isArray((m as Record<string, unknown>).packages)) {
      const subs = (Array.isArray((m as Record<string, unknown>).shipments)
        ? (m as Record<string, unknown>).shipments
        : (m as Record<string, unknown>).packages) as unknown[];
      for (const sub of subs) {
        if (sub === null || sub === undefined || typeof sub !== 'object') continue;
        const s = sub as Record<string, unknown>;
        const candidatos = [s.shipment_id, s.id, s.tracking_code, s.code, s.codigo, s.package_id];
        for (const cand of candidatos) {
          if (cand === undefined || cand === null) continue;
          const cod = normalizarCodigoPacote(String(cand));
          if (cod.length > 0 && !vistos.has(cod)) {
            saida.push({
              id: cod,
              idOriginal: typeof cand === 'number' ? cand : String(cand),
              plannedRouteId: typeof m.planned_route_id !== 'undefined' && m.planned_route_id !== null
                ? (typeof m.planned_route_id === 'number' ? m.planned_route_id : String(m.planned_route_id))
                : undefined,
            });
            vistos.add(cod);
          }
        }
      }
    }
  }
}

function parsearUmaZona(obj: Record<string, unknown>): ZonaImportada | null {
  const zoneName = typeof obj.zone_name === 'string' && obj.zone_name.trim().length > 0 ? obj.zone_name.trim() : undefined;
  if (!zoneName) return null;
  const vistos = new Set<string>();
  const shipments: ZonaImportada['shipmentsEncontrados'] = [];
  extrairShipmentsDeMarkers(obj.markers, shipments, vistos);
  if (Array.isArray(obj.shipments)) extrairShipmentsDeMarkers(obj.shipments, shipments, vistos);
  if (Array.isArray(obj.packages)) extrairShipmentsDeMarkers(obj.packages, shipments, vistos);
  if (shipments.length === 0) return null;
  return {
    zoneId: typeof obj.zone_id !== 'undefined' && obj.zone_id !== null
      ? (typeof obj.zone_id === 'number' ? obj.zone_id : String(obj.zone_id))
      : undefined,
    zoneName,
    zoneExternalId: typeof obj.zone_external_id === 'string' && obj.zone_external_id.trim().length > 0
      ? obj.zone_external_id.trim()
      : undefined,
    totalShipmentsInformado: typeof obj.total_shipments === 'number' ? obj.total_shipments : undefined,
    shipmentsEncontrados: shipments,
  };
}

export function parsearJsonZonasML(rawTextoJson: string): ResultadoParseZonas {
  if (!rawTextoJson || !rawTextoJson.trim()) {
    return { ok: false, erro: 'JSON está vazio.', zonas: [], totalIds: 0, totalZonasUnicas: 0, porZona: {}, duplicadosInternos: 0 };
  }
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawTextoJson.trim());
  } catch {
    return { ok: false, erro: 'JSON inválido. Cole ou envie um arquivo JSON válido.', zonas: [], totalIds: 0, totalZonasUnicas: 0, porZona: {}, duplicadosInternos: 0 };
  }
  const zonas: ZonaImportada[] = [];
  const visitar = (obj: unknown, profundidade = 0) => {
    if (profundidade > 6 || obj === null || obj === undefined) return;
    if (Array.isArray(obj)) {
      for (const item of obj) visitar(item, profundidade + 1);
      return;
    }
    if (typeof obj !== 'object') return;
    const o = obj as Record<string, unknown>;
    const z = parsearUmaZona(o);
    if (z) {
      zonas.push(z);
      if (!Array.isArray(o.zones) && !Array.isArray(o.zonas) && !Array.isArray(o.items)) {
        for (const markerOrShip of ['zones', 'zonas', 'items', 'results', 'regions', 'bairros']) {
          if (Array.isArray(o[markerOrShip])) visitar(o[markerOrShip], profundidade + 1);
        }
      }
      return;
    }
    for (const chave of ['zone', 'zones', 'zona', 'zonas', 'data', 'payload', 'result', 'results', 'monitoring', 'items', 'body', 'response']) {
      visitar(o[chave], profundidade + 1);
    }
  };
  visitar(parsed);
  if (zonas.length === 0) {
    return {
      ok: false,
      erro: 'Não encontrei nenhuma zona no JSON. Verifique se tem campos "zone_name" e "markers[].shipment_id" (formato API Mercado Livre).',
      zonas: [],
      totalIds: 0,
      totalZonasUnicas: 0,
      porZona: {},
      duplicadosInternos: 0,
    };
  }
  const porZona: Record<string, string[]> = {};
  const globalVistos = new Map<string, string>();
  let duplicadosInternos = 0;
  for (const zona of zonas) {
    const arr = porZona[zona.zoneName] ?? [];
    for (const s of zona.shipmentsEncontrados) {
      if (globalVistos.has(s.id) && globalVistos.get(s.id) === zona.zoneName) {
        duplicadosInternos++;
        continue;
      }
      if (!globalVistos.has(s.id)) {
        arr.push(s.id);
        globalVistos.set(s.id, zona.zoneName);
      } else if (globalVistos.get(s.id) !== zona.zoneName) {
        arr.push(s.id);
      }
    }
    porZona[zona.zoneName] = arr;
  }
  const totalIds = Object.values(porZona).reduce((acc, arr) => acc + arr.length, 0);
  const totalZonasUnicas = new Set(Object.keys(porZona)).size;
  return { ok: true, zonas, totalIds, totalZonasUnicas, porZona, duplicadosInternos };
}
