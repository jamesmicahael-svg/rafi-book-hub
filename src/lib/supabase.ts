import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL as string;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

if (!url || !key) {
  // Surface a clear error instead of failing silently at runtime
  console.warn('Supabase env vars missing. Copy .env.example to .env and fill VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY.');
}

export const supabase = createClient(url || 'https://placeholder.supabase.co', key || 'placeholder-key');
export const isSupabaseConfigured = Boolean(url && key && !url.includes('placeholder'));
