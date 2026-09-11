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
