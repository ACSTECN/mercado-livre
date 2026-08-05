'use client';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let singleton: SupabaseClient | null = null;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

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
    });
    return singleton;
  } catch {
    return null;
  }
}

export const isSupabaseConfigurado = Boolean(url && anonKey);
