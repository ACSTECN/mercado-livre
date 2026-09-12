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

export const NEXT_PUBLIC_SUPABASE_URL_DEBUG = _raw('NEXT_PUBLIC_SUPABASE_URL');
export const NEXT_PUBLIC_SUPABASE_ANON_KEY_DEBUG = _raw('NEXT_PUBLIC_SUPABASE_ANON_KEY');

const HARDCODED_URL = 'https://ppewtznjwigjowgmhrge.supabase.co';
const HARDCODED_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBwZXd0em5qd2lnam93Z21ocmdlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Mjk0MTAsImV4cCI6MjA5OTUwNTQxMH0.9F64wV85Qq3vF4J1G7Y8QJz4sW7vM3fR2nN1mHkK9lU';

function _lerChave(chave: string, fallbackHardcoded: string): string {
  const v = _raw(chave);
  if (v) return v;
  return fallbackHardcoded;
}

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
