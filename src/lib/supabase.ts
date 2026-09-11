'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let singleton: SupabaseClient | null = null;

function _lerChave(k: string, fallbackHardcoded: string): string | undefined {
  const tryVal = (v: unknown): string | undefined => {
    if (typeof v !== 'string') return undefined;
    const s = v.trim();
    if (!s) return undefined;
    if (/^(your-|<|{{|%)/i.test(s)) return undefined;
    return s;
  };
  try {
    const v = (process.env as Record<string, string | undefined>)[k];
    const r = tryVal(v);
    if (r) return r;
  } catch { /* noop */ }
  try {
    const anyGlob = globalThis as unknown as { __NEXT_DATA__?: unknown };
    if (anyGlob.__NEXT_DATA__) {
      const txt = JSON.stringify(anyGlob.__NEXT_DATA__ ?? {});
      const m = txt.match(new RegExp(`"${k}":"([^"]+)"`));
      const r = tryVal(m?.[1]);
      if (r) return r;
    }
  } catch { /* noop */ }
  return tryVal(fallbackHardcoded) ?? undefined;
}

const HARDCODED_URL = 'https://ppewtznjwigjowgmhrge.supabase.co';
const HARDCODED_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXd0em5qd2lnam93Z21ocmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzIwNzA5NjcsImV4cCI6MjA4NzY0Njk2N30.NWEuv5mvlduySIUkZbR9oM4mW_cDqr4R6pjUOstaXkM';

export const NEXT_PUBLIC_SUPABASE_URL_DEBUG = _lerChave('NEXT_PUBLIC_SUPABASE_URL', HARDCODED_URL);
export const NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG = _lerChave('NEXT_PUBLIC_SUPABASE_ANON_KEY', HARDCODED_ANON);

const url = NEXT_PUBLIC_SUPABASE_URL_DEBUG;
const anonKey = NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG;

export function getSupabase(): SupabaseClient | null {
  if (!url || !anonKey) return null;
  if (singleton) return singleton;
  try {
    singleton = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
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
