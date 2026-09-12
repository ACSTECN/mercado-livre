'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const VERSAO_HARDCODED_CHAVE = '20260912b-CHAVE-VERDADEIRA-SET-2026';

let singleton: SupabaseClient | null = null;

const HARDCODED_URL = 'https://ppewtznjwigjowgmhrge.supabase.co';
const HARDCODED_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXd0em5qd2lnam93Z21ocmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzA5NjcsImV4cCI6MjA4NzY0Njk2N30.NWEuv5mvlduySIUkZbR9oM4mW_cDqr4R6pjUOstaXkM';

function _raw(k: string): string | undefined {
  try {
    const v = (process.env as Record<string, string | undefined>)[k];
    if (typeof v === 'string' && v.trim() && !/^(your-|<|CHAVE|XXX|TODO)/i.test(v)) return v;
  } catch { /* noop */ }
  try {
    const anyGlob = globalThis as unknown as { __NEXT_DATA__?: unknown };
    if (anyGlob.__NEXT_DATA__) {
      const txt = JSON.stringify(anyGlob.__NEXT_DATA__ ?? {});
      const m = txt.match(new RegExp(`"${k}":"([^"]+)"`));
      if (m && m[1] && m[1].trim() && !/^(your-|<|CHAVE|XXX|TODO)/i.test(m[1])) return m[1];
    }
  } catch { /* noop */ }
  return undefined;
}

function _lerChave(chave: string): string {
  if (chave === 'NEXT_PUBLIC_SUPABASE_URL' && HARDCODED_URL) return HARDCODED_URL;
  if (chave === 'NEXT_PUBLIC_SUPABASE_ANON_KEY' && HARDCODED_ANON) return HARDCODED_ANON;
  const v = _raw(chave);
  if (v) return v;
  return '';
}

export const NEXT_PUBLIC_SUPABASE_URL_DEBUG = _lerChave('NEXT_PUBLIC_SUPABASE_URL');
export const NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG = _lerChave('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const url = _lerChave('NEXT_PUBLIC_SUPABASE_URL');
const anonKey = _lerChave('NEXT_PUBLIC_SUPABASE_ANON_KEY');

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (singleton) return singleton;
  try {
    singleton = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      realtime: {
        params: { eventsPerSecond: 20 },
      },
    });
    return singleton;
  } catch {
    return null;
  }
}

export const isSupabaseConfigurado = Boolean(url && anonKey);
