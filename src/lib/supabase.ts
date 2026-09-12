'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let singleton: SupabaseClient | null = null;

function _raw(k: string): string | undefined {
  try {
    const v = (process.env as Record<string, string | undefined>)[k];
    if (typeof v === 'string' && v.trim() && !/^(your-|<)/i.test(v)) return v;
  } catch { /* noop */ }
  try {
    const anyGlob = globalThis as unknown as { __NEXT_DATA__?: unknown };
    if (anyGlob.__NEXT_DATA__) {
      const txt = JSON.stringify(anyGlob.__NEXT_DATA__ ?? {});
      const m = txt.match(new RegExp(`"${k}":"([^"]+)"`));
      if (m && m[1] && !/^(your-|<)/i.test(m[1])) return m[1];
    }
  } catch { /* noop */ }
  return undefined;
}

const HARDCODED_URL = 'https://ppewtznjwigjowgmhrge.supabase.co';
const HARDCODED_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXd0em5qd2lnam93Z21ocmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzA5NjcsImV4cCI6MjA4NzY0Njk2N30.NWEuv5mvlduySIUkZbR9oM4mW_cDqr4R6pjUOstaXkM';

function _lerChave(chave: string, fallbackHardcoded: string): string {
  const v = _raw(chave);
  if (v) return v;
  return fallbackHardcoded;
}

export const NEXT_PUBLIC_SUPABASE_URL_DEBUG = _lerChave('NEXT_PUBLIC_SUPABASE_URL', HARDCODED_URL);
export const NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG = _lerChave('NEXT_PUBLIC_SUPABASE_ANON_KEY', HARDCODED_ANON);

const url = _lerChave('NEXT_PUBLIC_SUPABASE_URL', HARDCODED_URL);
const anonKey = _lerChave('NEXT_PUBLIC_SUPABASE_ANON_KEY', HARDCODED_ANON);

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
