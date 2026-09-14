import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatarCep(valor: string): string {
  const limpo = valor.replace(/\D/g, '').slice(0, 8);
  if (limpo.length <= 5) return limpo;
  return `${limpo.slice(0, 5)}-${limpo.slice(5)}`;
}

export function hashString(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0;
  }
  return Math.abs(hash).toString(36) + str.length.toString(36);
}

export async function hashArquivo(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  const bytes = new Uint8Array(buf.slice(0, Math.min(buf.byteLength, 524_288)));
  let h1 = 0xdeadbeef ^ 0;
  let h2 = 0x41c6ce57 ^ 0;
  for (let i = 0; i < bytes.length; i++) {
    const ch = bytes[i];
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

export function lerArquivoComoDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = reject;
    r.readAsDataURL(file);
  });
}

export function copiarParaAreaTransferencia(texto: string): Promise<void> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    return navigator.clipboard.writeText(texto);
  }
  return new Promise((resolve, reject) => {
    try {
      const ta = document.createElement('textarea');
      ta.value = texto;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      resolve();
    } catch (e) {
      reject(e);
    }
  });
}

export function gerarId(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return crypto.randomUUID();
  }
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function formatarData(ts: number): string {
  const d = new Date(ts);
  const p = (n: number) => n.toString().padStart(2, '0');
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function truncate(str: string, n: number): string {
  if (!str) return '';
  return str.length > n ? str.slice(0, n - 1) + '…' : str;
}

export function normalizarCodigoPacote(raw: string | null | undefined): string {
  if (!raw) return '';
  let s = String(raw).trim();
  if (!s) return '';
  s = s.replace(/^\uFEFF/, '').trim();
  try {
    const obj = JSON.parse(s);
    if (typeof obj === 'object' && obj !== null) {
      const entries = Object.entries(obj as Record<string, unknown>);
      const chavesCod = new Set(['id', 'codigo', 'code', 'cod', 'pacote', 'package', 'nfe', 'numero', 'number']);
      const chavesTipo = new Set(['t', 'type', 'tipo', 'tp']);
      for (const [k, v] of entries) {
        const kl = k.trim().toLowerCase();
        if (chavesCod.has(kl) && v != null) {
          const c = String(v).trim();
          if (c) return c;
        }
      }
      for (const [k, v] of entries) {
        const kl = k.trim().toLowerCase();
        if (!chavesTipo.has(kl) && typeof v === 'string' && /^\d{4,}$/.test(v.trim())) return v.trim();
      }
    }
  } catch {
    /* não é JSON válido, ignora e segue o fallback */
  }
  const digitos = s.match(/\d{4,}/g);
  if (digitos && digitos.length) {
    const maior = digitos.reduce((a, b) => (a.length >= b.length ? a : b));
    if (maior.length >= 6) return maior;
  }
  return s.replace(/\s+/g, '');
}

export function codigosIguaisNormalizados(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizarCodigoPacote(a);
  const nb = normalizarCodigoPacote(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const da = na.replace(/\D/g, '');
  const db = nb.replace(/\D/g, '');
  return !!da && da === db;
}

export function classNamesConfianca(score: number) {
  if (score >= 85) return 'bg-success/15 text-success border-success/30';
  if (score >= 60) return 'bg-warning/15 text-warning border-warning/30';
  return 'bg-danger/15 text-danger border-danger/30';
}
